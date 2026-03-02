/**
 * RetryManager — Runtime-Validated Webhook Delivery Retry
 *
 * Tracks delivery attempts for outbound webhooks and retries with
 * exponential backoff. Before each retry, validates the task still
 * exists and is actionable via BlockAttributeValidator.exists().
 *
 * Retry safety rules:
 *   - No retry for completed / deleted / rescheduled / archived tasks
 *   - Block attribute validation before every retry
 *   - Max attempts with exponential backoff (configurable)
 *   - Abandoned deliveries emit task:webhook:resolved
 *
 * AI urgency rule (CRITICAL):
 *   Webhook retry MUST NOT trigger SmartSuggestionEngine.increaseUrgency().
 *   RetryManager emits task:webhook:retry (NOT task:escalated).
 *   The aiUrgencyGuarded flag on each DeliveryRecord ensures downstream
 *   PatternLearner ignores retry-based events.
 *   This prevents false urgency spikes that would later corrupt
 *   the Coaching Assistant.
 *
 * Integration:
 *   IntegrationDispatcher.fire() → RetryManager.track()
 *   RetryManager tick → validate block → IntegrationDispatcher.retry()
 *
 * Lifecycle:
 *   start() — begin retry tick loop
 *   stop()  — cancel tick loop, flush pending, MUST stop after onunload
 *
 * FORBIDDEN:
 *   - Import frontend / Svelte
 *   - Bypass block validation on retry
 *   - Retry after plugin.onunload()
 *   - Emit task:escalated (prevents AI urgency false spike)
 *   - Use raw BlockAttributeSync (must use BlockAttributeValidator)
 */

import type { BlockAttributeValidator } from "@backend/services/BlockAttributeValidator";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { WebhookEvent } from "@backend/events/types/EventTypes";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface RetryManagerDeps {
  blockValidator: BlockAttributeValidator;
  pluginEventBus: PluginEventBus;
  /** Called when a delivery should be retried (typically IntegrationDispatcher.retry) */
  onRetry: (record: DeliveryRecord) => Promise<boolean>;
  /** Lookup current task status before retry — returns undefined if task not found */
  getTaskStatus?: (taskId: string) => string | undefined;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface DeliveryRecord {
  /** Unique delivery ID */
  deliveryId: string;
  /** Task ID associated with this delivery */
  taskId: string;
  /** Block ID (if task is block-linked) */
  blockId?: string;
  /** The webhook event being delivered */
  event: WebhookEvent;
  /** Target URL */
  url: string;
  /** Number of attempts made */
  attempts: number;
  /** ISO timestamp of last attempt */
  lastAttemptAt: string;
  /** ISO timestamp for next retry */
  nextRetryAt: string;
  /** Current status */
  status: "pending" | "delivered" | "failed" | "abandoned";
  /** Last error message */
  lastError?: string;
  /** ISO timestamp when record was created */
  createdAt: string;
  /**
   * AI urgency guard flag.
   * When true, this retry MUST NOT trigger SmartSuggestionEngine.increaseUrgency().
   * Always true for webhook retries (set in track()).
   */
  aiUrgencyGuarded: boolean;
}

export interface RetryManagerStats {
  pending: number;
  delivered: number;
  failed: number;
  abandoned: number;
  totalRetries: number;
  totalBlockValidationFailures: number;
  totalAIGuardedRetries: number;
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  initialDelayMs: 30_000,        // 30 seconds
  maxDelayMs: 30 * 60 * 1000,   // 30 minutes
  backoffMultiplier: 2,
};

const RETRY_TICK_INTERVAL_MS = 15_000; // Check every 15s
const MAX_PENDING_RECORDS = 200;

/** Task statuses that should NOT be retried */
const NON_RETRYABLE_STATUSES = new Set([
  "done",
  "completed",
  "archived",
  "deleted",
  "cancelled",
]);

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class RetryManager {
  private readonly blockValidator: BlockAttributeValidator;
  private readonly eventBus: PluginEventBus;
  private readonly onRetry: (record: DeliveryRecord) => Promise<boolean>;
  private readonly getTaskStatus?: (taskId: string) => string | undefined;
  private readonly config: RetryConfig;

  private records: Map<string, DeliveryRecord> = new Map();
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupTimers: Set<ReturnType<typeof setTimeout>> = new Set();
  private active = false;

  // Stats
  private totalRetries = 0;
  private totalBlockValidationFailures = 0;
  private totalAIGuardedRetries = 0;

  constructor(deps: RetryManagerDeps, config?: Partial<RetryConfig>) {
    this.blockValidator = deps.blockValidator;
    this.eventBus = deps.pluginEventBus;
    this.onRetry = deps.onRetry;
    this.getTaskStatus = deps.getTaskStatus;
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;

    this.tickInterval = setInterval(() => {
      this.processPendingRetries().catch((err) => {
        logger.error("[RetryManager] Retry tick failed", err);
      });
    }, RETRY_TICK_INTERVAL_MS);

    logger.info("[RetryManager] Started", { maxAttempts: this.config.maxAttempts });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    for (const timer of this.cleanupTimers) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    const stats = this.getStats();
    logger.info("[RetryManager] Stopped", stats);
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Track a new delivery for potential retry.
   * Called after initial webhook delivery attempt by IntegrationDispatcher.
   *
   * All tracked records are AI-urgency-guarded by default: retries
   * MUST NOT trigger SmartSuggestionEngine.increaseUrgency().
   */
  track(
    deliveryId: string,
    taskId: string,
    event: WebhookEvent,
    url: string,
    success: boolean,
    blockId?: string,
    error?: string,
  ): void {
    if (!this.active) return;

    if (success) {
      // Record success but don't keep in pending map
      this.records.set(deliveryId, {
        deliveryId,
        taskId,
        blockId,
        event,
        url,
        attempts: 1,
        lastAttemptAt: new Date().toISOString(),
        nextRetryAt: "",
        status: "delivered",
        createdAt: new Date().toISOString(),
        aiUrgencyGuarded: true,
      });

      // Clean up delivered records after a short window
      const timer = setTimeout(() => {
        this.records.delete(deliveryId);
        this.cleanupTimers.delete(timer);
      }, 60_000);
      this.cleanupTimers.add(timer);
      return;
    }

    // ── Delivery failed — schedule retry ──
    const nextRetryAt = this.computeNextRetry(1);

    const record: DeliveryRecord = {
      deliveryId,
      taskId,
      blockId,
      event,
      url,
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
      nextRetryAt,
      status: "pending",
      lastError: error,
      createdAt: new Date().toISOString(),
      aiUrgencyGuarded: true, // ALWAYS guarded — prevents AI urgency escalation
    };

    // Enforce max pending limit
    if (this.records.size >= MAX_PENDING_RECORDS) {
      this.evictOldest();
    }

    this.records.set(deliveryId, record);
    logger.debug("[RetryManager] Tracking failed delivery", {
      deliveryId,
      taskId,
      nextRetryAt,
    });

    // ── Emit webhook retry event (NOT task:escalated) ──
    this.eventBus.emit("task:webhook:retry", {
      taskId,
      deliveryId,
      attempt: 1,
      nextRetryAt,
    });
  }

  /**
   * Resolve (cancel) all pending retries for a task.
   * Called when task is completed, deleted, or rescheduled.
   */
  resolve(taskId: string, resolvedBy: "completed" | "rescheduled" | "deleted" | "manual"): void {
    let resolved = 0;
    for (const [id, record] of this.records) {
      if (record.taskId === taskId && record.status === "pending") {
        record.status = "abandoned";
        this.records.delete(id);
        resolved++;
      }
    }
    if (resolved > 0) {
      this.eventBus.emit("task:webhook:resolved", {
        taskId,
        resolvedBy,
      });
      logger.info("[RetryManager] Resolved pending retries", {
        taskId,
        resolvedBy,
        count: resolved,
      });
    }
  }

  /**
   * Check if there are pending retries for a task.
   */
  hasPending(taskId: string): boolean {
    for (const record of this.records.values()) {
      if (record.taskId === taskId && record.status === "pending") return true;
    }
    return false;
  }

  /**
   * Get retry statistics.
   */
  getStats(): RetryManagerStats {
    let pending = 0, delivered = 0, failed = 0, abandoned = 0;
    for (const record of this.records.values()) {
      switch (record.status) {
        case "pending": pending++; break;
        case "delivered": delivered++; break;
        case "failed": failed++; break;
        case "abandoned": abandoned++; break;
      }
    }
    return {
      pending,
      delivered,
      failed,
      abandoned,
      totalRetries: this.totalRetries,
      totalBlockValidationFailures: this.totalBlockValidationFailures,
      totalAIGuardedRetries: this.totalAIGuardedRetries,
    };
  }

  // ── Internal ─────────────────────────────────────────────────

  /**
   * Process all pending retries that are due.
   */
  private async processPendingRetries(): Promise<void> {
    const now = Date.now();
    const due: DeliveryRecord[] = [];

    for (const record of this.records.values()) {
      if (
        record.status === "pending" &&
        record.nextRetryAt &&
        new Date(record.nextRetryAt).getTime() <= now
      ) {
        due.push(record);
      }
    }

    if (due.length === 0) return;

    logger.debug("[RetryManager] Processing retries", { count: due.length });

    for (const record of due) {
      await this.retryDelivery(record);
    }
  }

  /**
   * Retry a single delivery with full block validation.
   *
   * Before retry, validates via BlockAttributeValidator.exists():
   *   - Block must still exist
   *   - Status must not be terminal
   *
   * If validation fails, the delivery is abandoned (NOT retried).
   * The aiUrgencyGuarded flag ensures this retry doesn't trigger
   * SmartSuggestionEngine — only task:webhook:retry is emitted.
   */
  private async retryDelivery(record: DeliveryRecord): Promise<void> {
    // ── Task status check: abandon if task reached terminal status ──
    if (this.getTaskStatus) {
      const currentStatus = this.getTaskStatus(record.taskId);
      if (currentStatus && NON_RETRYABLE_STATUSES.has(currentStatus)) {
        this.abandon(record, `Task status is '${currentStatus}' — non-retryable`);
        return;
      }
    }

    // ── Block validation: task must still be actionable ──
    try {
      // Use a minimal task-like object for BlockAttributeValidator
      const taskLike = {
        id: record.taskId,
        blockId: record.blockId,
      } as Parameters<BlockAttributeValidator["exists"]>[0];

      const blockResult = await this.blockValidator.exists(taskLike);

      if (!blockResult.valid) {
        this.totalBlockValidationFailures++;
        const reason = blockResult.reason || "Block validation failed";
        this.abandon(record, reason);
        return;
      }
    } catch (err) {
      // Block validation errored — still attempt retry (SiYuan API may be down)
      logger.warn("[RetryManager] Block validation error, proceeding with retry", {
        deliveryId: record.deliveryId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ── Attempt retry ──
    record.attempts++;
    record.lastAttemptAt = new Date().toISOString();
    this.totalRetries++;

    // Track AI-guarded retries
    if (record.aiUrgencyGuarded) {
      this.totalAIGuardedRetries++;
    }

    try {
      const success = await this.onRetry(record);
      if (success) {
        record.status = "delivered";
        this.records.delete(record.deliveryId);
        logger.debug("[RetryManager] Retry succeeded", {
          deliveryId: record.deliveryId,
          attempt: record.attempts,
        });
        return;
      }
    } catch (err) {
      record.lastError = err instanceof Error ? err.message : String(err);
    }

    // ── Check max attempts ──
    if (record.attempts >= this.config.maxAttempts) {
      this.abandon(record, `Max attempts (${this.config.maxAttempts}) reached`);
      return;
    }

    // ── Schedule next retry ──
    record.nextRetryAt = this.computeNextRetry(record.attempts);

    // Emit webhook retry event (NOT task:escalated → prevents AI urgency spike)
    this.eventBus.emit("task:webhook:retry", {
      taskId: record.taskId,
      deliveryId: record.deliveryId,
      attempt: record.attempts,
      nextRetryAt: record.nextRetryAt,
    });
  }

  /**
   * Mark a delivery as abandoned and emit resolved event.
   */
  private abandon(record: DeliveryRecord, reason: string): void {
    record.status = "abandoned";
    this.records.delete(record.deliveryId);

    logger.warn("[RetryManager] Delivery abandoned", {
      deliveryId: record.deliveryId,
      taskId: record.taskId,
      reason,
      attempts: record.attempts,
    });

    // Emit webhook resolved (NOT task:escalation:blocked → prevents AI confusion)
    this.eventBus.emit("task:webhook:resolved", {
      taskId: record.taskId,
      resolvedBy: `abandoned: ${reason}`,
    });
  }

  /**
   * Compute ISO timestamp for next retry using exponential backoff.
   */
  private computeNextRetry(attempt: number): string {
    const delay = Math.min(
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1),
      this.config.maxDelayMs,
    );
    return new Date(Date.now() + delay).toISOString();
  }

  /**
   * Evict oldest pending record when capacity is exceeded.
   */
  private evictOldest(): void {
    let oldest: DeliveryRecord | null = null;
    for (const record of this.records.values()) {
      if (record.status === "pending") {
        if (!oldest || record.createdAt < oldest.createdAt) {
          oldest = record;
        }
      }
    }
    if (oldest) {
      this.abandon(oldest, "Evicted due to capacity overflow");
    }
  }
}
