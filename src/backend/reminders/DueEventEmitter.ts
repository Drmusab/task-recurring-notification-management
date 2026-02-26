/**
 * DueEventEmitter — Runtime Event → Reminder Pipeline Bridge
 *
 * Subscribes to SchedulerService's runtime events and routes them
 * through the full Reminder Pipeline:
 *
 *   task:runtime:due
 *     → ReminderPolicy.evaluate()
 *     → ReminderQueue.enqueue()
 *     → (ReminderDispatcher.fire() called by ReminderService)
 *
 * Also listens for task lifecycle events to cancel/clear state:
 *   task:runtime:completed   → cancel retry, clear reminded state
 *   task:runtime:rescheduled → cancel retry, clear reminded state
 *   task:escalation:resolved → cancel retry, clear reminded state
 *
 * This is the ENTRY POINT from the scheduler pipeline into the
 * reminder subsystem. No other path should enqueue reminders.
 *
 * FORBIDDEN:
 *   - Dispatch reminders directly (delegate to ReminderDispatcher)
 *   - Bypass ReminderPolicy evaluation
 *   - Mutate task model
 *   - Access DOM / frontend
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { EventService } from "@backend/services/EventService";
import type { ReminderPolicy } from "./ReminderPolicy";
import type { ReminderQueue, ReminderQueueEntry } from "./ReminderQueue";
import type { ReminderRetryManager } from "./ReminderRetryManager";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface DueEventEmitterDeps {
  eventService: EventService;
  reminderPolicy: ReminderPolicy;
  reminderQueue: ReminderQueue;
  retryManager: ReminderRetryManager;
  /** Task lookup function */
  getTask: (taskId: string) => ReadonlyTask | undefined;
}

export interface DueEventEmitterStats {
  totalReceived: number;
  totalEnqueued: number;
  totalSuppressed: number;
  totalCancelled: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class DueEventEmitter {
  private readonly eventService: EventService;
  private readonly policy: ReminderPolicy;
  private readonly queue: ReminderQueue;
  private readonly retryManager: ReminderRetryManager;
  private readonly getTask: (taskId: string) => ReadonlyTask | undefined;

  private active = false;
  private readonly unsubscribes: Array<() => void> = [];

  // ── Stats ──
  private totalReceived = 0;
  private totalEnqueued = 0;
  private totalSuppressed = 0;
  private totalCancelled = 0;

  constructor(deps: DueEventEmitterDeps) {
    this.eventService = deps.eventService;
    this.policy = deps.reminderPolicy;
    this.queue = deps.reminderQueue;
    this.retryManager = deps.retryManager;
    this.getTask = deps.getTask;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;

    // ── Subscribe to runtime due events ──
    this.unsubscribes.push(
      this.eventService.on("task:runtime:due", (data) => {
        void this.handleDueEvent(data.taskId, data.task);
      }),
    );

    // ── Subscribe to overdue events (for retry scheduling) ──
    this.unsubscribes.push(
      this.eventService.on("task:overdue", (data) => {
        void this.handleOverdueEvent(data.taskId, data.task);
      }),
    );

    // ── Subscribe to lifecycle events that cancel reminders ──
    this.unsubscribes.push(
      this.eventService.on("task:runtime:completed", (data) => {
        this.handleTaskResolution(data.taskId, "completed");
      }),
    );

    this.unsubscribes.push(
      this.eventService.on("task:runtime:rescheduled", (data) => {
        this.handleTaskResolution(data.taskId, "rescheduled");
      }),
    );

    this.unsubscribes.push(
      this.eventService.on("task:escalation:resolved", (data) => {
        this.handleTaskResolution(data.taskId, data.resolvedBy);
      }),
    );

    // ── Subscribe to task missed (for immediate high-priority enqueue) ──
    this.unsubscribes.push(
      this.eventService.on("task:missed", (data) => {
        void this.handleMissedEvent(data.taskId, data.task);
      }),
    );

    logger.info("[DueEventEmitter] Started — subscribed to runtime events");
  }

  stop(): void {
    if (!this.active) return;

    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* already removed */ }
    }
    this.unsubscribes.length = 0;
    this.active = false;

    logger.info("[DueEventEmitter] Stopped");
  }

  /**
   * Get emitter stats.
   */
  getStats(): DueEventEmitterStats {
    return {
      totalReceived: this.totalReceived,
      totalEnqueued: this.totalEnqueued,
      totalSuppressed: this.totalSuppressed,
      totalCancelled: this.totalCancelled,
    };
  }

  // ── Private Event Handlers ───────────────────────────────────

  /**
   * Handle task:runtime:due — evaluate + enqueue.
   */
  private async handleDueEvent(
    taskId: string,
    taskPayload?: ReadonlyTask,
  ): Promise<void> {
    this.totalReceived++;

    // Resolve the full task
    const task = taskPayload ?? this.getTask(taskId);
    if (!task) {
      logger.debug("[DueEventEmitter] Task not found for due event", { taskId });
      this.totalSuppressed++;
      return;
    }

    // Evaluate through policy pipeline
    const result = await this.policy.evaluate(task);
    if (!result.allowed) {
      this.totalSuppressed++;
      logger.debug("[DueEventEmitter] Due event suppressed by policy", {
        taskId,
        reason: result.rejectionReason,
      });
      return;
    }

    // Enqueue the validated reminder
    const entry: ReminderQueueEntry = {
      task: result.resolvedTask,
      enqueuedAt: new Date().toISOString(),
      retryCount: 0,
      priority: 1, // Normal due
      source: "due_event",
    };

    const enqueued = this.queue.enqueue(entry);
    if (enqueued) {
      this.totalEnqueued++;
    }
  }

  /**
   * Handle task:overdue — if not already reminded, schedule retry.
   */
  private async handleOverdueEvent(
    taskId: string,
    taskPayload?: ReadonlyTask,
  ): Promise<void> {
    this.totalReceived++;

    const task = taskPayload ?? this.getTask(taskId);
    if (!task) {
      this.totalSuppressed++;
      return;
    }

    // If already in queue, skip — the dispatcher will handle it
    if (this.queue.has(taskId)) return;

    // Evaluate policy
    const result = await this.policy.evaluate(task);
    if (!result.allowed) {
      this.totalSuppressed++;
      return;
    }

    // Enqueue with overdue priority
    const entry: ReminderQueueEntry = {
      task: result.resolvedTask,
      enqueuedAt: new Date().toISOString(),
      retryCount: 0,
      priority: 2, // Overdue
      source: "overdue_event",
    };

    const enqueued = this.queue.enqueue(entry);
    if (enqueued) {
      this.totalEnqueued++;
    }

    // Also schedule a retry in case the overdue persists
    this.retryManager.scheduleRetry(taskId, "overdue_persist");
  }

  /**
   * Handle task:missed — high-priority enqueue.
   */
  private async handleMissedEvent(
    taskId: string,
    taskPayload?: ReadonlyTask,
  ): Promise<void> {
    this.totalReceived++;

    const task = taskPayload ?? this.getTask(taskId);
    if (!task) {
      this.totalSuppressed++;
      return;
    }

    const result = await this.policy.evaluate(task);
    if (!result.allowed) {
      this.totalSuppressed++;
      return;
    }

    const entry: ReminderQueueEntry = {
      task: result.resolvedTask,
      enqueuedAt: new Date().toISOString(),
      retryCount: 0,
      priority: 3, // Urgent (missed)
      source: "missed_event",
    };

    const enqueued = this.queue.enqueue(entry);
    if (enqueued) {
      this.totalEnqueued++;
    }
  }

  /**
   * Handle task resolution (completed, rescheduled, deleted).
   * Cancels pending retries and clears reminded state.
   */
  private handleTaskResolution(taskId: string, resolvedBy: string): void {
    this.totalCancelled++;

    // Remove from queue if pending
    this.queue.remove(taskId);

    // Cancel pending retries
    this.retryManager.cancelRetry(taskId);

    // Clear policy overdue state
    this.policy.clearRemindedState(taskId);

    logger.debug("[DueEventEmitter] Task resolved — reminder cancelled", {
      taskId,
      resolvedBy,
    });
  }
}
