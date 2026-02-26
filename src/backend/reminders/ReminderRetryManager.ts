/**
 * ReminderRetryManager — Retry-Safe Reminder Re-Dispatch
 *
 * Manages retry logic for reminders that failed to dispatch or
 * need re-notification (e.g., task still overdue after initial reminder).
 *
 * Before retry, validates:
 *   1. BlockAttributeValidator.exists(taskId) — block still valid
 *   2. ReminderPolicy.evaluate(task) — task still eligible
 *
 * Stops retrying when:
 *   - Task is completed
 *   - Task is deleted / archived / cancelled
 *   - Block no longer exists
 *   - Task is rescheduled
 *   - Max retries reached
 *   - Plugin is unloading
 *
 * Integration:
 *   ReminderService → scheduleRetry() when dispatch fails or overdue persists
 *   EventService    → emits task:reminder:retry event
 *
 * FORBIDDEN:
 *   - Fire reminders directly (delegate to ReminderDispatcher)
 *   - Mutate task model
 *   - Access DOM / frontend
 *   - Bypass ReminderPolicy
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { EventService } from "@backend/services/EventService";
import type { BlockAttributeValidator } from "@backend/services/BlockAttributeValidator";
import type { ReminderPolicy } from "./ReminderPolicy";
import type { ReminderQueue, ReminderQueueEntry } from "./ReminderQueue";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ReminderRetryManagerDeps {
  eventService: EventService;
  blockValidator: BlockAttributeValidator;
  reminderPolicy: ReminderPolicy;
  reminderQueue: ReminderQueue;
  /** Task lookup function */
  getTask: (taskId: string) => ReadonlyTask | undefined;
}

export interface RetryEntry {
  taskId: string;
  attemptCount: number;
  lastAttemptAt: string;
  nextRetryAt: string;
  source: string;
}

export interface ReminderRetryManagerStats {
  totalRetries: number;
  totalRetrySuccess: number;
  totalRetryAborted: number;
  activeRetries: number;
  retryAbortBreakdown: {
    taskCompleted: number;
    blockInvalid: number;
    policyRejected: number;
    maxRetriesReached: number;
    pluginUnloading: number;
  };
}

/** Maximum retry attempts per task before giving up */
const MAX_RETRIES = 5;

/** Base retry delay in milliseconds (exponential backoff: base * 2^attempt) */
const BASE_RETRY_DELAY_MS = 60_000; // 1 minute

/** Maximum retry delay cap */
const MAX_RETRY_DELAY_MS = 15 * 60_000; // 15 minutes

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class ReminderRetryManager {
  private readonly eventService: EventService;
  private readonly blockValidator: BlockAttributeValidator;
  private readonly policy: ReminderPolicy;
  private readonly queue: ReminderQueue;
  private readonly getTask: (taskId: string) => ReadonlyTask | undefined;

  private active = false;

  /** Active retry timers: taskId → timeout handle */
  private readonly retryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** Retry state: taskId → retry entry */
  private readonly retryState: Map<string, RetryEntry> = new Map();

  // ── Stats ──
  private totalRetries = 0;
  private totalRetrySuccess = 0;
  private totalRetryAborted = 0;
  private retryAbortBreakdown = {
    taskCompleted: 0,
    blockInvalid: 0,
    policyRejected: 0,
    maxRetriesReached: 0,
    pluginUnloading: 0,
  };

  constructor(deps: ReminderRetryManagerDeps) {
    this.eventService = deps.eventService;
    this.blockValidator = deps.blockValidator;
    this.policy = deps.reminderPolicy;
    this.queue = deps.reminderQueue;
    this.getTask = deps.getTask;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[ReminderRetryManager] Started");
  }

  stop(): void {
    if (!this.active) return;

    // Cancel all pending retries
    for (const [taskId, timer] of this.retryTimers) {
      clearTimeout(timer);
      this.retryAbortBreakdown.pluginUnloading++;
      this.totalRetryAborted++;
    }
    this.retryTimers.clear();
    this.retryState.clear();
    this.active = false;
    logger.info("[ReminderRetryManager] Stopped — all pending retries cancelled");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Schedule a retry for a task's reminder.
   * Uses exponential backoff with jitter.
   *
   * @param taskId — The task that needs retry
   * @param source — Why the retry was scheduled
   */
  scheduleRetry(taskId: string, source: string = "overdue_persist"): void {
    if (!this.active) return;

    // Check if already at max retries
    const existing = this.retryState.get(taskId);
    const attemptCount = existing ? existing.attemptCount + 1 : 1;

    if (attemptCount > MAX_RETRIES) {
      this.totalRetryAborted++;
      this.retryAbortBreakdown.maxRetriesReached++;
      logger.debug("[ReminderRetryManager] Max retries reached", { taskId, attempts: attemptCount });
      this.cancelRetry(taskId);
      return;
    }

    // Cancel existing timer if any
    this.cancelRetryTimer(taskId);

    // Calculate delay with exponential backoff + jitter
    const delay = Math.min(
      BASE_RETRY_DELAY_MS * Math.pow(2, attemptCount - 1) + Math.random() * 5000,
      MAX_RETRY_DELAY_MS,
    );

    const nextRetryAt = new Date(Date.now() + delay).toISOString();

    // Update state
    this.retryState.set(taskId, {
      taskId,
      attemptCount,
      lastAttemptAt: new Date().toISOString(),
      nextRetryAt,
      source,
    });

    // Schedule the retry
    const timer = setTimeout(() => {
      void this.executeRetry(taskId);
    }, delay);

    this.retryTimers.set(taskId, timer);

    // Emit retry event for frontend
    this.eventService.emit("task:escalation:retry", {
      taskId,
      attempt: attemptCount,
      nextRetryAt,
    });

    logger.debug("[ReminderRetryManager] Retry scheduled", {
      taskId,
      attempt: attemptCount,
      delayMs: Math.round(delay),
    });
  }

  /**
   * Cancel a pending retry for a task.
   * Called when task is completed, rescheduled, or deleted.
   */
  cancelRetry(taskId: string): void {
    this.cancelRetryTimer(taskId);
    this.retryState.delete(taskId);
  }

  /**
   * Check if a task has a pending retry.
   */
  hasPendingRetry(taskId: string): boolean {
    return this.retryTimers.has(taskId);
  }

  /**
   * Get retry state for a task.
   */
  getRetryState(taskId: string): RetryEntry | undefined {
    return this.retryState.get(taskId);
  }

  /**
   * Get retry manager stats.
   */
  getStats(): ReminderRetryManagerStats {
    return {
      totalRetries: this.totalRetries,
      totalRetrySuccess: this.totalRetrySuccess,
      totalRetryAborted: this.totalRetryAborted,
      activeRetries: this.retryTimers.size,
      retryAbortBreakdown: { ...this.retryAbortBreakdown },
    };
  }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Execute a retry: re-validate and re-enqueue if still valid.
   */
  private async executeRetry(taskId: string): Promise<void> {
    if (!this.active) return;

    this.totalRetries++;
    this.retryTimers.delete(taskId);

    // Resolve fresh task state
    const task = this.getTask(taskId);
    if (!task) {
      this.totalRetryAborted++;
      this.retryAbortBreakdown.taskCompleted++;
      this.retryState.delete(taskId);
      logger.debug("[ReminderRetryManager] Retry aborted — task not found", { taskId });
      return;
    }

    // Gate 1: Block attribute validation
    const blockResult = await this.blockValidator.exists(task);
    if (!blockResult.valid) {
      this.totalRetryAborted++;
      this.retryAbortBreakdown.blockInvalid++;
      this.retryState.delete(taskId);
      logger.debug("[ReminderRetryManager] Retry aborted — block invalid", { taskId });
      return;
    }

    // Gate 2: Full policy evaluation
    const policyResult = await this.policy.evaluate(task);
    if (!policyResult.allowed) {
      this.totalRetryAborted++;
      this.retryAbortBreakdown.policyRejected++;
      this.retryState.delete(taskId);
      logger.debug("[ReminderRetryManager] Retry aborted — policy rejected", {
        taskId,
        reason: policyResult.rejectionReason,
      });
      return;
    }

    // All gates passed — re-enqueue
    const retryEntry = this.retryState.get(taskId);
    const attemptCount = retryEntry?.attemptCount ?? 1;

    const enqueued = this.queue.enqueue({
      task: policyResult.resolvedTask,
      enqueuedAt: new Date().toISOString(),
      retryCount: attemptCount,
      priority: 2, // Retries are always overdue-priority
      source: `retry_${attemptCount}`,
    });

    if (enqueued) {
      this.totalRetrySuccess++;
      logger.debug("[ReminderRetryManager] Retry enqueued", { taskId, attempt: attemptCount });
    }

    // Clean up retry state — the queue/dispatcher will handle it now
    this.retryState.delete(taskId);
  }

  /**
   * Cancel just the timer for a task without clearing state.
   */
  private cancelRetryTimer(taskId: string): void {
    const timer = this.retryTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(taskId);
    }
  }
}
