/**
 * webhook-retry.ts — Exponential Backoff Retry Engine
 *
 * Manages retry scheduling for failed webhook deliveries.
 * Computes next retry times using configurable backoff strategies
 * and tracks delivery lifecycle.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Pure retry logic — scheduling and policy enforcement
 *   ✔ Integrates with WebhookQueue for status updates
 *   ✔ Configurable per-endpoint retry policies
 *   ❌ No HTTP calls (that's the dispatcher's job)
 *   ❌ No frontend imports
 */

import type {
  WebhookRetryPolicy,
  QueuedDelivery,
  DeliveryLogEntry,
  WebhookEndpoint,
} from "./webhook-types";
import {
  DEFAULT_RETRY_POLICY,
  WEBHOOK_LOG_KEY,
} from "./webhook-types";

// ═══════════════════════════════════════════════════════════════
// Retry Delay Calculation
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate the delay in milliseconds for a given retry attempt.
 *
 * Strategies:
 * - `exponential`: baseDelay * 2^(attempt-1) + jitter
 * - `linear`: baseDelay * attempt + jitter
 * - `fixed`: baseDelay + jitter
 *
 * Jitter is ±10% of the computed delay to prevent thundering herd.
 */
export function calculateRetryDelay(
  attempt: number,
  policy: WebhookRetryPolicy = DEFAULT_RETRY_POLICY,
): number {
  let delay: number;

  switch (policy.strategy) {
    case "exponential":
      delay = policy.baseDelayMs * Math.pow(2, attempt - 1);
      break;
    case "linear":
      delay = policy.baseDelayMs * attempt;
      break;
    case "fixed":
      delay = policy.baseDelayMs;
      break;
    default:
      delay = policy.baseDelayMs * Math.pow(2, attempt - 1);
  }

  // Apply jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  delay = Math.round(delay + jitter);

  // Clamp to max
  return Math.min(delay, policy.maxDelayMs);
}

/**
 * Compute the ISO timestamp for the next retry attempt.
 * Returns `null` if max retries have been exhausted.
 */
export function computeNextRetryAt(
  currentAttempt: number,
  policy: WebhookRetryPolicy = DEFAULT_RETRY_POLICY,
): string | null {
  if (currentAttempt >= policy.maxRetries) {
    return null; // No more retries
  }

  const delay = calculateRetryDelay(currentAttempt + 1, policy);
  return new Date(Date.now() + delay).toISOString();
}

// ═══════════════════════════════════════════════════════════════
// Retry Policy Resolution
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve the effective retry policy for an endpoint.
 * Uses endpoint-specific policy if set, otherwise falls back to default.
 */
export function resolveRetryPolicy(
  endpoint: WebhookEndpoint,
  defaultPolicy: WebhookRetryPolicy = DEFAULT_RETRY_POLICY,
): WebhookRetryPolicy {
  return endpoint.retryPolicy ?? defaultPolicy;
}

/**
 * Check whether a delivery should be retried based on the HTTP status code.
 *
 * Retryable conditions:
 * - Network errors (no status code)
 * - 5xx server errors
 * - 408 Request Timeout
 * - 429 Too Many Requests
 *
 * Non-retryable:
 * - 2xx (success — shouldn't reach here)
 * - 4xx client errors (except 408, 429)
 */
export function isRetryableStatusCode(statusCode: number | null): boolean {
  // Network error — always retry
  if (statusCode === null) return true;

  // Specific retryable 4xx codes
  if (statusCode === 408 || statusCode === 429) return true;

  // All 5xx are retryable
  if (statusCode >= 500 && statusCode < 600) return true;

  return false;
}

// ═══════════════════════════════════════════════════════════════
// Retry Manager
// ═══════════════════════════════════════════════════════════════

/** Storage adapter for delivery log persistence. */
export interface DeliveryLogStorage {
  load(): Promise<DeliveryLogEntry[]>;
  save(entries: DeliveryLogEntry[]): Promise<void>;
}

/**
 * Manages the delivery lifecycle: tracking attempts, scheduling retries,
 * and maintaining the delivery log for frontend inspection.
 */
export class WebhookRetryManager {
  private deliveryLog: DeliveryLogEntry[] = [];
  private readonly maxLogEntries: number;
  private readonly storage: DeliveryLogStorage | null;
  private logDirty = false;

  constructor(
    storage: DeliveryLogStorage | null = null,
    maxLogEntries = 200,
  ) {
    this.storage = storage;
    this.maxLogEntries = maxLogEntries;
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /** Load delivery log from persistent storage. */
  async initialize(): Promise<void> {
    if (!this.storage) return;

    try {
      const stored = await this.storage.load();
      if (Array.isArray(stored)) {
        this.deliveryLog = stored.slice(-this.maxLogEntries);
      }
    } catch (err) {
      console.error("[WebhookRetryManager] Failed to load delivery log:", err);
      this.deliveryLog = [];
    }
  }

  /** Persist delivery log to storage. */
  async persist(): Promise<void> {
    if (!this.storage || !this.logDirty) return;

    try {
      await this.storage.save([...this.deliveryLog]);
      this.logDirty = false;
    } catch (err) {
      console.error("[WebhookRetryManager] Failed to persist delivery log:", err);
    }
  }

  /** Shutdown — persist and clear. */
  async shutdown(): Promise<void> {
    await this.persist();
    this.deliveryLog = [];
    this.logDirty = false;
  }

  // ─── Delivery Result Processing ─────────────────────────────

  /**
   * Process a successful delivery.
   * Logs the result and returns metadata for queue cleanup.
   */
  recordSuccess(
    delivery: QueuedDelivery,
    endpoint: WebhookEndpoint,
    statusCode: number,
    durationMs: number,
  ): DeliveryLogEntry {
    const entry: DeliveryLogEntry = {
      id: delivery.id,
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      event: delivery.payload.event,
      taskId: delivery.payload.task?.id ?? null,
      status: "delivered",
      statusCode,
      attempts: delivery.attempts + 1,
      timestamp: new Date().toISOString(),
      durationMs,
      error: null,
    };

    this.appendLog(entry);
    return entry;
  }

  /**
   * Process a failed delivery attempt.
   * Determines whether to retry or abandon, and logs the result.
   *
   * @returns `{ shouldRetry, nextRetryAt, logEntry }`
   */
  recordFailure(
    delivery: QueuedDelivery,
    endpoint: WebhookEndpoint,
    statusCode: number | null,
    error: string,
    durationMs: number,
    policy: WebhookRetryPolicy = DEFAULT_RETRY_POLICY,
  ): {
    shouldRetry: boolean;
    nextRetryAt: string | null;
    logEntry: DeliveryLogEntry;
  } {
    const nextAttempt = delivery.attempts + 1;
    const retryable = isRetryableStatusCode(statusCode);
    const shouldRetry = retryable && nextAttempt < policy.maxRetries;
    const nextRetryAt = shouldRetry
      ? computeNextRetryAt(nextAttempt, policy)
      : null;

    const status = shouldRetry ? "pending" as const : "failed" as const;

    const entry: DeliveryLogEntry = {
      id: delivery.id,
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      event: delivery.payload.event,
      taskId: delivery.payload.task?.id ?? null,
      status,
      statusCode,
      attempts: nextAttempt,
      timestamp: new Date().toISOString(),
      durationMs,
      error,
    };

    // Only log final failures (not interim retries) to keep the log useful
    if (!shouldRetry) {
      this.appendLog(entry);
    }

    return { shouldRetry, nextRetryAt, logEntry: entry };
  }

  // ─── Log Access ─────────────────────────────────────────────

  /** Get the full delivery log (most recent last). */
  getLog(): readonly DeliveryLogEntry[] {
    return this.deliveryLog;
  }

  /** Get log entries for a specific endpoint. */
  getLogForEndpoint(endpointId: string): DeliveryLogEntry[] {
    return this.deliveryLog.filter((entry) => entry.endpointId === endpointId);
  }

  /** Get the most recent N log entries. */
  getRecentLog(count: number): DeliveryLogEntry[] {
    return this.deliveryLog.slice(-count);
  }

  /** Clear the delivery log. */
  clearLog(): void {
    this.deliveryLog = [];
    this.logDirty = true;
  }

  /** Get delivery statistics. */
  getStats(): {
    total: number;
    delivered: number;
    failed: number;
    avgDurationMs: number;
  } {
    const total = this.deliveryLog.length;
    const delivered = this.deliveryLog.filter((e) => e.status === "delivered").length;
    const failed = this.deliveryLog.filter((e) => e.status === "failed" || e.status === "abandoned").length;
    const durations = this.deliveryLog.map((e) => e.durationMs).filter((d) => d > 0);
    const avgDurationMs = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    return { total, delivered, failed, avgDurationMs };
  }

  // ─── Internal ───────────────────────────────────────────────

  /** Append a log entry, trimming to max size. */
  private appendLog(entry: DeliveryLogEntry): void {
    this.deliveryLog.push(entry);

    // Trim oldest entries if over limit
    if (this.deliveryLog.length > this.maxLogEntries) {
      this.deliveryLog = this.deliveryLog.slice(-this.maxLogEntries);
    }

    this.logDirty = true;
  }
}

/**
 * Create a delivery log storage adapter using SiYuan plugin storage.
 */
export function createLogStorageAdapter(
  loadData: (key: string) => Promise<unknown>,
  saveData: (key: string, data: unknown) => Promise<void>,
): DeliveryLogStorage {
  return {
    async load(): Promise<DeliveryLogEntry[]> {
      const data = await loadData(WEBHOOK_LOG_KEY);
      if (Array.isArray(data)) return data as DeliveryLogEntry[];
      return [];
    },
    async save(entries: DeliveryLogEntry[]): Promise<void> {
      await saveData(WEBHOOK_LOG_KEY, entries);
    },
  };
}
