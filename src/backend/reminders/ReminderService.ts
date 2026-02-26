/**
 * ReminderService — Runtime-Validated Reminder Pipeline Orchestrator
 *
 * Top-level service that wires together the entire reminder subsystem:
 *
 *   DueEventEmitter     — subscribes to task:runtime:due → enqueues
 *   ReminderPolicy      — evaluates all validation gates
 *   ReminderQueue       — priority-sorted queue with dedup
 *   ReminderDispatcher  — fires events through EventService
 *   ReminderRetryManager — retry with block validation + policy re-check
 *
 * Canonical flow:
 *   SchedulerService.tick()
 *     → EventBus.emit("task:runtime:due")
 *     → DueEventEmitter.handleDueEvent()
 *       → ReminderPolicy.evaluate()
 *         → DependencyExecutionGuard.isBlocked()
 *         → RecurrenceResolver.resolveInstance()
 *         → BlockAttributeValidator.exists()
 *       → ReminderQueue.enqueue()
 *     → ReminderService.flush()
 *       → ReminderDispatcher.fire()
 *         → EventBus.emit("task:runtime:due") for frontend
 *
 * Lifecycle:
 *   - Constructed in onLayoutReady (NOT onload)
 *   - start() → starts all sub-services
 *   - flush() → dispatches queued reminders
 *   - stop()  → stops all sub-services (plugin.onunload)
 *
 * Lifecycle rules:
 *   - MUST NOT initialize before plugin.onload()
 *   - MUST NOT remind before storage load
 *   - MUST NOT retry after plugin.onunload()
 *   - MUST NOT fire from scheduler directly
 *
 * FORBIDDEN:
 *   - Bypass the pipeline (all reminders must flow through evaluate → enqueue → fire)
 *   - Mutate task model
 *   - Access DOM / frontend
 *   - Parse markdown
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { EventService } from "@backend/services/EventService";
import type { DependencyExecutionGuard } from "@backend/dependencies/DependencyExecutionGuard";
import type { BlockAttributeValidator } from "@backend/services/BlockAttributeValidator";
import type { RecurrenceResolver } from "@backend/services/RecurrenceResolver";
import { ReminderPolicy } from "./ReminderPolicy";
import { ReminderQueue } from "./ReminderQueue";
import { ReminderDispatcher } from "./ReminderDispatcher";
import { ReminderRetryManager } from "./ReminderRetryManager";
import { DueEventEmitter } from "./DueEventEmitter";
import type { ReminderPolicyStats } from "./ReminderPolicy";
import type { ReminderQueueStats } from "./ReminderQueue";
import type { ReminderDispatcherStats } from "./ReminderDispatcher";
import type { ReminderRetryManagerStats } from "./ReminderRetryManager";
import type { DueEventEmitterStats } from "./DueEventEmitter";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ReminderServiceDeps {
  eventService: EventService;
  dependencyGuard: DependencyExecutionGuard;
  blockValidator: BlockAttributeValidator;
  recurrenceResolver: RecurrenceResolver;
  /** Task lookup function (from TaskStorage) */
  getTask: (taskId: string) => ReadonlyTask | undefined;
}

export interface ReminderServiceStats {
  active: boolean;
  flushCount: number;
  lastFlushAt: string | null;
  policy: ReminderPolicyStats;
  queue: ReminderQueueStats;
  dispatcher: ReminderDispatcherStats;
  retryManager: ReminderRetryManagerStats;
  emitter: DueEventEmitterStats;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class ReminderService {
  private readonly eventService: EventService;

  // ── Sub-services (composed internally) ──
  private readonly policy: ReminderPolicy;
  private readonly queue: ReminderQueue;
  private readonly dispatcher: ReminderDispatcher;
  private readonly retryManager: ReminderRetryManager;
  private readonly emitter: DueEventEmitter;

  private active = false;
  private flushCount = 0;
  private lastFlushAt: string | null = null;

  /** Periodic flush interval handle */
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  /** Default flush interval in milliseconds */
  private static readonly FLUSH_INTERVAL_MS = 5_000; // 5 seconds

  constructor(deps: ReminderServiceDeps) {
    this.eventService = deps.eventService;

    // ── Build the pipeline ──

    // 1. Policy — the validation gate
    this.policy = new ReminderPolicy({
      dependencyGuard: deps.dependencyGuard,
      blockValidator: deps.blockValidator,
      recurrenceResolver: deps.recurrenceResolver,
    });

    // 2. Queue — priority-sorted with dedup
    this.queue = new ReminderQueue();

    // 3. Dispatcher — fires events through EventService
    this.dispatcher = new ReminderDispatcher({
      eventService: deps.eventService,
      reminderQueue: this.queue,
      reminderPolicy: this.policy,
    });

    // 4. Retry manager — retry with validation
    this.retryManager = new ReminderRetryManager({
      eventService: deps.eventService,
      blockValidator: deps.blockValidator,
      reminderPolicy: this.policy,
      reminderQueue: this.queue,
      getTask: deps.getTask,
    });

    // 5. Due event emitter — bridges scheduler → reminder pipeline
    this.emitter = new DueEventEmitter({
      eventService: deps.eventService,
      reminderPolicy: this.policy,
      reminderQueue: this.queue,
      retryManager: this.retryManager,
      getTask: deps.getTask,
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Start the entire reminder pipeline.
   * Must be called from onLayoutReady — AFTER storage load + service init.
   */
  start(): void {
    if (this.active) return;

    // Start sub-services in dependency order
    this.policy.start();
    this.queue.start();
    this.dispatcher.start();
    this.retryManager.start();
    this.emitter.start();

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, ReminderService.FLUSH_INTERVAL_MS);

    this.active = true;
    logger.info("[ReminderService] Started — full reminder pipeline active");
  }

  /**
   * Stop the entire reminder pipeline.
   * Must be called from onunload — cancels all timers and retries.
   */
  stop(): void {
    if (!this.active) return;

    // Clear periodic flush
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Stop sub-services in reverse order
    this.emitter.stop();
    this.retryManager.stop();
    this.dispatcher.stop();
    this.queue.stop();
    this.policy.stop();

    this.active = false;
    logger.info("[ReminderService] Stopped — all reminder activity halted");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Flush the reminder queue — dispatch all queued reminders.
   *
   * Called:
   *   1. Periodically by internal timer (every 5s)
   *   2. Manually after tick() completes
   *   3. On demand by frontend
   */
  async flush(): Promise<{ dispatched: number; suppressed: number }> {
    if (!this.active) return { dispatched: 0, suppressed: 0 };

    const result = await this.dispatcher.fire();
    this.flushCount++;
    this.lastFlushAt = new Date().toISOString();

    return { dispatched: result.dispatched, suppressed: result.suppressed };
  }

  /**
   * Dismiss a reminder for a task.
   * Prevents re-firing within the current cycle.
   */
  dismissReminder(taskId: string): void {
    if (!this.active) return;

    this.policy.markDismissed(taskId);
    this.queue.remove(taskId);
    this.retryManager.cancelRetry(taskId);

    logger.debug("[ReminderService] Reminder dismissed", { taskId });
  }

  /**
   * Reset the overdue cycle (e.g., at the start of a new day).
   */
  resetCycle(): void {
    if (!this.active) return;
    this.policy.resetCycle();
    logger.debug("[ReminderService] Overdue cycle reset");
  }

  /**
   * Check if a task has a pending reminder in the queue.
   */
  hasPendingReminder(taskId: string): boolean {
    return this.queue.has(taskId) || this.retryManager.hasPendingRetry(taskId);
  }

  /**
   * Get comprehensive stats for the entire reminder pipeline.
   */
  getStats(): ReminderServiceStats {
    return {
      active: this.active,
      flushCount: this.flushCount,
      lastFlushAt: this.lastFlushAt,
      policy: this.policy.getStats(),
      queue: this.queue.getStats(),
      dispatcher: this.dispatcher.getStats(),
      retryManager: this.retryManager.getStats(),
      emitter: this.emitter.getStats(),
    };
  }

  // ── Sub-service Access (for testing/monitoring) ──────────────

  /** Get the policy instance (for direct testing) */
  getPolicy(): ReminderPolicy { return this.policy; }

  /** Get the queue instance (for direct testing) */
  getQueue(): ReminderQueue { return this.queue; }

  /** Get the dispatcher instance (for direct testing) */
  getDispatcher(): ReminderDispatcher { return this.dispatcher; }

  /** Get the retry manager instance (for direct testing) */
  getRetryManager(): ReminderRetryManager { return this.retryManager; }

  /** Get the emitter instance (for direct testing) */
  getEmitter(): DueEventEmitter { return this.emitter; }
}
