/**
 * ReminderDispatcher — Runtime-Safe Reminder Event Emitter
 *
 * Drains validated entries from ReminderQueue and fires the appropriate
 * events through EventService. Enforces the once-per-overdue-state-change
 * rule by delegating to ReminderPolicy.markReminded().
 *
 * Emitted events:
 *   task:reminder:due       — task is due and should be reminded
 *   task:reminder:overdue   — task is overdue (fires ONCE per state change)
 *   task:reminder:suppressed — reminder was suppressed (for frontend debug)
 *
 * Consumers:
 *   ReminderService    → fire() to dispatch next batch
 *   Frontend panels    → subscribe via EventService to task:reminder:* events
 *
 * FORBIDDEN:
 *   - Evaluate policy (caller must validate before enqueue)
 *   - Mutate task model
 *   - Access DOM / frontend
 *   - Send HTTP requests (delegate to IntegrationService via events)
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { EventService } from "@backend/services/EventService";
import type { ReminderQueue, ReminderQueueEntry } from "./ReminderQueue";
import type { ReminderPolicy } from "./ReminderPolicy";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ReminderDispatcherDeps {
  eventService: EventService;
  reminderQueue: ReminderQueue;
  reminderPolicy: ReminderPolicy;
}

export interface DispatchResult {
  /** Number of reminders dispatched */
  dispatched: number;
  /** Number of reminders suppressed (policy re-check failed) */
  suppressed: number;
  /** Task IDs that were dispatched */
  dispatchedTaskIds: string[];
}

export interface ReminderDispatcherStats {
  totalDispatched: number;
  totalSuppressed: number;
  totalBatchesFired: number;
  lastDispatchAt: string | null;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class ReminderDispatcher {
  private readonly eventService: EventService;
  private readonly queue: ReminderQueue;
  private readonly policy: ReminderPolicy;

  private active = false;

  // ── Stats ──
  private totalDispatched = 0;
  private totalSuppressed = 0;
  private totalBatchesFired = 0;
  private lastDispatchAt: string | null = null;

  constructor(deps: ReminderDispatcherDeps) {
    this.eventService = deps.eventService;
    this.queue = deps.reminderQueue;
    this.policy = deps.reminderPolicy;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[ReminderDispatcher] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    logger.info("[ReminderDispatcher] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Drain the queue and fire reminder events for all validated entries.
   *
   * Each entry is re-validated via policy before dispatch to handle
   * race conditions (task completed between enqueue and fire).
   */
  async fire(): Promise<DispatchResult> {
    if (!this.active) {
      return { dispatched: 0, suppressed: 0, dispatchedTaskIds: [] };
    }

    const entries = this.queue.drain();
    if (entries.length === 0) {
      return { dispatched: 0, suppressed: 0, dispatchedTaskIds: [] };
    }

    this.totalBatchesFired++;
    let dispatched = 0;
    let suppressed = 0;
    const dispatchedTaskIds: string[] = [];

    for (const entry of entries) {
      // Re-validate: task may have changed since enqueue
      const result = await this.policy.evaluate(entry.task);
      if (!result.allowed) {
        suppressed++;
        this.totalSuppressed++;
        this.emitSuppressed(entry, result.rejectionReason || "unknown");
        continue;
      }

      // Dispatch the appropriate event
      this.dispatchEntry(entry);
      dispatched++;
      this.totalDispatched++;
      dispatchedTaskIds.push(entry.task.id);

      // Mark as reminded so overdue dedup kicks in
      this.policy.markReminded(entry.task.id);
    }

    this.lastDispatchAt = new Date().toISOString();

    if (dispatched > 0 || suppressed > 0) {
      logger.debug("[ReminderDispatcher] Batch complete", {
        dispatched,
        suppressed,
        total: entries.length,
      });
    }

    return { dispatched, suppressed, dispatchedTaskIds };
  }

  /**
   * Dispatch a single validated entry immediately (for retry path).
   * Caller MUST have evaluated policy before calling this.
   */
  dispatchSingle(entry: ReminderQueueEntry): void {
    if (!this.active) return;
    this.dispatchEntry(entry);
    this.totalDispatched++;
    this.policy.markReminded(entry.task.id);
    this.lastDispatchAt = new Date().toISOString();
  }

  /**
   * Get dispatcher stats.
   */
  getStats(): ReminderDispatcherStats {
    return {
      totalDispatched: this.totalDispatched,
      totalSuppressed: this.totalSuppressed,
      totalBatchesFired: this.totalBatchesFired,
      lastDispatchAt: this.lastDispatchAt,
    };
  }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Emit the correct event based on priority:
   *   priority 1 → task:reminder:due
   *   priority 2+ → task:reminder:overdue
   */
  private dispatchEntry(entry: ReminderQueueEntry): void {
    const { task, priority, retryCount } = entry;
    const isOverdue = priority >= 2 || this.isOverdue(task);

    if (isOverdue) {
      this.eventService.emit("task:overdue", {
        taskId: task.id,
        task: task as any,
      });
    }

    // Always emit the runtime due event for frontend consumption
    this.eventService.emitRuntimeDue(task.id, task.dueAt, task as any);

    logger.debug("[ReminderDispatcher] Dispatched", {
      taskId: task.id,
      isOverdue,
      priority,
      retryCount,
    });
  }

  /**
   * Emit a suppression event for frontend debugging.
   */
  private emitSuppressed(entry: ReminderQueueEntry, reason: string): void {
    this.eventService.emit("task:attention:suppressed", {
      taskId: entry.task.id,
      task: entry.task as any,
      attentionScore: 0,
      reason,
      action: "suppress" as const,
    });

    logger.debug("[ReminderDispatcher] Suppressed", {
      taskId: entry.task.id,
      reason,
    });
  }

  /**
   * Check if a task is currently overdue based on dueAt.
   */
  private isOverdue(task: ReadonlyTask): boolean {
    if (!task.dueAt) return false;
    return new Date(task.dueAt).getTime() < Date.now();
  }
}
