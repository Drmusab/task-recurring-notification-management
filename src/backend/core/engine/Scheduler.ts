import type { Task } from "@backend/core/models/Task";
import type { TaskStorage } from "@backend/core/storage/TaskStorage";
import { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import { ensureRecurrence, hasRecurrence } from "@backend/core/utils/RecurrenceMigrationHelper";
import { TimezoneHandler } from "./TimezoneHandler";
import { OnCompletionHandler } from "./OnCompletion";
import type { SchedulerEventListener, SchedulerEventType, TaskDueEvent } from "./SchedulerEvents";
import { recordCompletion, recordMiss } from "@backend/core/models/Task";
import {
  DEFAULT_MAX_SNOOZES,
  EMITTED_OCCURRENCES_KEY,
  LAST_RUN_TIMESTAMP_KEY,
  MAX_RECOVERY_ITERATIONS,
  MISSED_GRACE_PERIOD_MS,
  SCHEDULER_INTERVAL_MS,
} from "@shared/constants/misc-constants";
import * as logger from "@backend/logging/logger";
import type { Plugin } from "siyuan";
import { SchedulerTimer } from "@backend/core/engine/SchedulerTimer";
import type { DueStateCache, DueStateEntry } from "@backend/cache/DueStateCache";
import type { DependencyExecutionGuard } from "@backend/dependencies/DependencyExecutionGuard";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { EventQueue } from "./EventQueue";

/**
 * Scheduler — Event-Driven Task Execution Runtime
 *
 * Architecture (Session 14):
 * - READS task state from DueStateCache (block-validated, TTL-refreshed)
 * - CHECKS dependency gate via DependencyExecutionGuard before emission
 * - EMITS events through EventQueue → PluginEventBus (ordered, deduped)
 * - NORMALIZES time via TimezoneHandler.normalize()
 * - WRITES (complete, delay, skip) still go through TaskStorage
 *
 * Fallback: If DueStateCache/DependencyExecutionGuard are not injected
 * (e.g., in tests), falls back to direct TaskStorage reads with no guard.
 *
 * Event flow:
 *   DueStateCache.getTasksDueOnOrBefore() → DependencyGuard.canExecuteSync()
 *   → EventQueue.enqueue("task:due"/"task:overdue")
 *   → EventQueue.flush() → PluginEventBus.emit()
 *   → Scheduler.on() listeners (legacy) also fire
 */
export class Scheduler {
  private storage: TaskStorage;
  private recurrenceEngine: RecurrenceEngine;
  private onCompletionHandler: OnCompletionHandler;
  private emittedDue: Set<string> = new Set();
  private emittedMissed: Set<string> = new Set();
  private timezoneHandler: TimezoneHandler;
  private isChecking = false;
  private lastCheckStartTime: number = 0;
  private plugin: Plugin | null = null;
  private listeners: Record<SchedulerEventType, Set<SchedulerEventListener>> = {
    "task:due": new Set(),
    "task:overdue": new Set(),
  };
  private readonly MAX_EMITTED_ENTRIES = 1000;
  private readonly EMITTED_RETENTION_DAYS = 30;
  private readonly EMITTED_SAVE_DEBOUNCE_MS = 1500;
  private persistTimeoutId: number | null = null;
  private emittedStateReady: Promise<void> | null = null;
  private timer: SchedulerTimer;

  // ─── Cache + Guard (injected by EngineController) ──────────
  private dueStateCache: DueStateCache | null = null;
  private dependencyGuard: DependencyExecutionGuard | null = null;
  private eventQueue: EventQueue | null = null;
  private pluginEventBus: PluginEventBus | null = null;

  // ─── Workspace-Aware Lifecycle (CQRS Phase) ─────────────────
  private isPaused = false;
  private currentWorkspaceId: string | null = null;
  private pauseReason: string | null = null;

  // ─── Overdue state-change tracking ──────────────────────────
  /** Tasks that are currently in overdue state (prevents re-emission per tick) */
  private overdueStateSet: Set<string> = new Set();

  constructor(
    storage: TaskStorage,
    intervalMs: number = SCHEDULER_INTERVAL_MS,
    plugin?: Plugin
  ) {
    this.storage = storage;
    this.recurrenceEngine = new RecurrenceEngine();
    this.onCompletionHandler = new OnCompletionHandler(plugin as never);
    this.timezoneHandler = new TimezoneHandler();
    this.plugin = plugin || null;
    this.timer = new SchedulerTimer(intervalMs, () => {
      this.checkDueTasks();
    });
  }

  // ── Dependency Injection (called by EngineController) ────────

  /**
   * Inject runtime dependencies after construction.
   * Called by EngineController.start() BEFORE scheduler.start().
   */
  injectDependencies(deps: {
    dueStateCache?: DueStateCache;
    dependencyGuard?: DependencyExecutionGuard;
    eventQueue?: EventQueue;
    pluginEventBus?: PluginEventBus;
  }): void {
    if (deps.dueStateCache) this.dueStateCache = deps.dueStateCache;
    if (deps.dependencyGuard) this.dependencyGuard = deps.dependencyGuard;
    if (deps.eventQueue) this.eventQueue = deps.eventQueue;
    if (deps.pluginEventBus) this.pluginEventBus = deps.pluginEventBus;
    logger.info("[Scheduler] Dependencies injected", {
      hasDueStateCache: !!this.dueStateCache,
      hasDependencyGuard: !!this.dependencyGuard,
      hasEventQueue: !!this.eventQueue,
      hasPluginEventBus: !!this.pluginEventBus,
    });
  }

  /**
   * Subscribe to scheduler events.
   */
  on(eventType: SchedulerEventType, listener: SchedulerEventListener): () => void {
    this.listeners[eventType].add(listener);
    return () => this.listeners[eventType].delete(listener);
  }

  /**
   * Start the scheduler.
   * Guarded against double-start — calling start() while already running is a no-op.
   */
  start(): void {
    if (this.timer.isActive()) {
      logger.warn("Scheduler.start() called while already running — ignoring");
      return;
    }

    void this.ensureEmittedStateLoaded().then(
      () => {
        this.checkDueTasks(); // Check immediately
        this.timer.start();
        logger.info("Scheduler started");
      },
      (err) => {
        logger.error("Failed to load emitted state; starting scheduler with empty state", err);
        this.checkDueTasks();
        this.timer.start();
        logger.info("Scheduler started (with empty emitted state)");
      }
    );
  }

  /**
   * Stop the scheduler and persist emitted state.
   * Returns a promise so callers can await final persistence before teardown.
   * 
   * FIX [CRITICAL-003]: Added retry logic with exponential backoff and backup persistence
   * to prevent data loss on shutdown.
   */
  async stop(): Promise<void> {
    this.timer.stop();
    // Clear any pending debounce timer to prevent writes after shutdown
    if (this.persistTimeoutId !== null) {
      globalThis.clearTimeout(this.persistTimeoutId);
      this.persistTimeoutId = null;
    }

    // ✅ FIX [CRITICAL-003]: Retry persistence with exponential backoff
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.persistEmittedState();
        logger.info("Scheduler stopped, emitted state persisted successfully");
        return; // Success
      } catch (err) {
        lastError = err as Error;
        logger.warn(
          `Failed to persist emitted state (attempt ${attempt}/${maxRetries})`,
          {
            error: err instanceof Error ? err.message : String(err),
            attempt,
            maxRetries
          }
        );

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff: 100ms, 200ms, 400ms)
          const delayMs = 100 * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries failed - try backup location
    logger.error(
      "CRITICAL: Failed to persist emitted state after all retries",
      {
        error: lastError?.message || 'Unknown error',
        retries: maxRetries,
        emittedDueCount: this.emittedDue.size,
        emittedMissedCount: this.emittedMissed.size
      }
    );
    
    // Last resort: save to alternative location
    try {
      await this.saveEmittedStateBackup();
      logger.info("Saved emitted state to backup location as fallback");
    } catch (backupError) {
      logger.error(
        "CRITICAL: Failed to save emitted state backup - data may be lost",
        {
          error: backupError instanceof Error ? backupError.message : String(backupError)
        }
      );
    }

    logger.info("Scheduler stopped");
  }

  /**
   * Run the scheduler check once (useful for tests)
   */
  runOnce(): void {
    this.checkDueTasks();
  }

  /**
   * Check if a task is active
   */
  isActive(task: Task): boolean {
    return task.enabled === true;
  }

  /**
   * Public event-driven trigger for an immediate due-task check.
   * Call this when external events occur (task created, document saved, etc.)
   * instead of waiting for the next timer tick.
   */
  triggerCheck(): void {
    if (!this.timer.isActive()) return;
    if (this.isPaused) return; // Respect pause state
    this.checkDueTasks();
  }

  // ═══════════════════════════════════════════════════════════
  // WORKSPACE-AWARE LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  /**
   * Pause the scheduler (workspace switched, plugin disabled, layout closed).
   * Timer keeps running but checkDueTasks() becomes a no-op.
   * Prevents ghost notifications, orphan recurrence, and memory waste.
   */
  pause(reason: string = "manual"): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.pauseReason = reason;
    logger.info(`Scheduler paused: ${reason}`);
  }

  /**
   * Resume the scheduler (workspace opened, plugin re-enabled).
   * Triggers an immediate check to catch anything missed while paused.
   */
  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    logger.info(`Scheduler resumed (was paused for: ${this.pauseReason})`);
    this.pauseReason = null;
    // Immediate check on resume to catch up
    if (this.timer.isActive()) {
      this.checkDueTasks();
    }
  }

  /**
   * Set the active workspace ID.
   * Tasks with a different workspaceId will be skipped during checks.
   */
  setWorkspace(workspaceId: string): void {
    const changed = this.currentWorkspaceId !== workspaceId;
    this.currentWorkspaceId = workspaceId;
    if (changed) {
      logger.info(`Scheduler workspace set: ${workspaceId}`);
    }
  }

  /**
   * Get the current workspace ID.
   */
  getWorkspaceId(): string | null {
    return this.currentWorkspaceId;
  }

  /**
   * Check if the scheduler is currently paused.
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Check for tasks that are due and trigger notifications
   *
   * Session 14 — Event-Driven Runtime:
   * 1. Reads from DueStateCache (block-validated) instead of TaskStorage
   * 2. Checks DependencyExecutionGuard before emitting
   * 3. Uses TimezoneHandler.normalize() for all time comparisons
   * 4. Emits through EventQueue → PluginEventBus (+ legacy listeners)
   * 5. Overdue emits once per state change (not per tick)
   * 6. Emits engine:tick:complete heartbeat
   *
   * Fallback: If DueStateCache is not injected, reads from TaskStorage directly.
   */
  private checkDueTasks(): void {
    // Respect pause state — no-op when paused
    if (this.isPaused) return;

    // Add timeout recovery - if isChecking has been true for > 30 seconds, force reset
    if (this.isChecking) {
      const checkingDuration = Date.now() - (this.lastCheckStartTime || 0);
      if (checkingDuration > 30000) {
        logger.warn("Scheduler check timeout detected, forcing reset");
        this.isChecking = false;
      } else {
        return;
      }
    }
    
    this.isChecking = true;
    this.lastCheckStartTime = Date.now();
    const now = new Date();

    // ── Read path: DueStateCache (preferred) or TaskStorage (fallback) ──
    let tasks: Task[];
    if (this.dueStateCache) {
      // Cache path: read block-validated entries, resolve to Task objects
      const entries: DueStateEntry[] = this.dueStateCache.getTasksDueOnOrBefore(now);
      tasks = [];
      for (const entry of entries) {
        const task = this.storage.getTask(entry.taskId);
        if (task) tasks.push(task);
      }
    } else {
      // Fallback: direct storage read (tests, pre-injection startup)
      tasks = this.storage.getTasksDueOnOrBefore(now);
    }

    // CQRS Phase: Filter by workspace if set
    if (this.currentWorkspaceId) {
      tasks = tasks.filter(
        (t) => !t.workspaceId || t.workspaceId === this.currentWorkspaceId
      );
    }

    try {
      let successCount = 0;
      let errorCount = 0;
      // Track which tasks are still overdue this tick (for state-change detection)
      const overdueThisTick = new Set<string>();

      for (const task of tasks) {
        try {
          if (!this.isActive(task)) {
            continue;
          }

          // ── Normalize time via TimezoneHandler ──
          const normalizedDue = this.timezoneHandler.normalize(task.dueAt, task.timezone);
          if (!normalizedDue) {
            logger.warn("Scheduler: unparseable dueAt, skipping", { taskId: task.id, dueAt: task.dueAt });
            continue;
          }

          const isDue = normalizedDue <= now;

          // ── Dependency gate (sync fast-path) ──
          if (this.dependencyGuard && !this.dependencyGuard.canExecuteSync(task.id)) {
            // Task is blocked — emit blocked event via EventQueue, skip due/overdue
            if (this.eventQueue && this.pluginEventBus) {
              this.eventQueue.enqueue("task:blocked", {
                taskId: task.id,
                blockers: this.dependencyGuard.explainBlocked(task.id).blockers,
              });
            }
            continue;
          }

          // ── Emit task:due ──
          if (isDue) {
            const taskKey = this.buildOccurrenceKey(task.id, normalizedDue, "hour");
            if (!this.emittedDue.has(taskKey)) {
              const payload: TaskDueEvent = {
                taskId: task.id,
                dueAt: normalizedDue,
                context: "today",
                task,
              };
              this.emitEvent("task:due", payload);
              this.registerEmittedKey("due", taskKey);

              // Runtime event — for AI/analytics
              if (this.eventQueue) {
                this.eventQueue.enqueue("task:runtime:due", {
                  taskId: task.id,
                  dueAt: normalizedDue.toISOString(),
                  task,
                });
              }
              logger.info(`Task due: ${task.name}`, { taskId: task.id, dueAt: task.dueAt });
            }
          }

          // ── Emit task:overdue (state-change only) ──
          const lastCompletedAt = task.lastCompletedAt
            ? new Date(task.lastCompletedAt)
            : null;

          if (
            isDue &&
            now.getTime() - normalizedDue.getTime() >= MISSED_GRACE_PERIOD_MS &&
            (!lastCompletedAt || lastCompletedAt < normalizedDue)
          ) {
            overdueThisTick.add(task.id);
            const taskKey = this.buildOccurrenceKey(task.id, normalizedDue, "hour");

            // State-change guard: only emit on transition INTO overdue
            const wasAlreadyOverdue = this.overdueStateSet.has(task.id);
            if (!this.emittedMissed.has(taskKey) && !wasAlreadyOverdue) {
              this.emitEvent("task:overdue", {
                taskId: task.id,
                dueAt: normalizedDue,
                context: "overdue",
                task,
              });
              this.registerEmittedKey("missed", taskKey);
              logger.warn(`Task missed: ${task.name}`, { taskId: task.id, dueAt: task.dueAt });
            }
          }

          successCount++;

        } catch (taskError) {
          // Log error but continue processing other tasks
          errorCount++;
          logger.error(
            `Failed to process task: ${task.name}`,
            {
              taskId: task.id,
              error: taskError instanceof Error ? taskError.message : String(taskError),
              stack: taskError instanceof Error ? taskError.stack : undefined
            }
          );
          // Continue to next task
        }
      }

      // ── Update overdue state set (state-change tracking) ──
      // Tasks that left overdue state → clear from set
      for (const id of this.overdueStateSet) {
        if (!overdueThisTick.has(id)) {
          this.overdueStateSet.delete(id);
        }
      }
      // Tasks that entered overdue state → add to set
      for (const id of overdueThisTick) {
        this.overdueStateSet.add(id);
      }

      // ── Flush EventQueue (batch emit to PluginEventBus) ──
      if (this.eventQueue) {
        // Emit tick heartbeat
        const durationMs = Date.now() - this.lastCheckStartTime;
        this.eventQueue.enqueue("engine:tick:complete", {
          processed: successCount,
          errors: errorCount,
          durationMs,
        }, "tick");
        this.eventQueue.flush();
      }

      // Log summary if there were errors
      if (errorCount > 0) {
        logger.warn(
          `Scheduler check completed with errors: ${successCount} succeeded, ${errorCount} failed`
        );
      }
      
      // Cleanup emitted sets periodically
      this.cleanupEmittedSets();
    } finally {
      this.isChecking = false;
    }
  }

  private cleanupEmittedSets(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.EMITTED_RETENTION_DAYS);

    const dueResult = this.pruneEmittedSet("due", this.emittedDue, cutoff);
    const missedResult = this.pruneEmittedSet("missed", this.emittedMissed, cutoff);
    this.emittedDue = dueResult.set;
    this.emittedMissed = missedResult.set;

    if (dueResult.didTrim || missedResult.didTrim) {
      this.schedulePersistEmittedState();
    }
  }

  private pruneEmittedSet(
    kind: "due" | "missed",
    entries: Set<string>,
    cutoff: Date
  ): { set: Set<string>; didTrim: boolean } {
    const cutoffTime = cutoff.getTime();
    const mapped = Array.from(entries).map((entry) => ({
      entry,
      time: this.parseOccurrenceKeyTimestamp(entry),
    }));

    let filtered = mapped.filter(({ time }) => time === null || time >= cutoffTime);
    let didTrim = filtered.length !== mapped.length;

    if (filtered.length > this.MAX_EMITTED_ENTRIES) {
      filtered = filtered
        .sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
        .slice(-this.MAX_EMITTED_ENTRIES);
      didTrim = true;
    }

    const nextSet = new Set(filtered.map(({ entry }) => entry));
    if (didTrim) {
      logger.info(`Cleaned up emitted${kind === "due" ? "Due" : "Missed"} set: ${entries.size} -> ${nextSet.size}`);
    }

    return { set: nextSet, didTrim };
  }

  private parseOccurrenceKeyTimestamp(entry: string): number | null {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex === -1) {
      return null;
    }
    const timestamp = entry.slice(separatorIndex + 1);
    if (!timestamp) {
      return null;
    }
    const normalized = timestamp.length === 13 ? `${timestamp}:00:00.000Z` : timestamp;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }

  /**
   * Mark a task as done and reschedule.
   * Emits task:runtime:completed and task:runtime:recurrence via EventQueue.
   */
  async markTaskDone(taskId: string): Promise<void> {
    const original = this.storage.getTask(taskId);
    if (!original) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Work on a deep copy to prevent in-memory state corruption if save fails
    const task: Task = JSON.parse(JSON.stringify(original));
    const now = new Date();
    
    // Set doneAt date
    task.doneAt = now.toISOString();
    
    // Record completion (updates analytics)
    recordCompletion(task);

    const completionSnapshot = JSON.parse(JSON.stringify(task));
    try {
      await this.storage.archiveTask(completionSnapshot);
    } catch (archiveErr) {
      // Archive is non-critical — log and continue with rescheduling
      logger.error(`Failed to archive task "${task.name}"`, {
        taskId: task.id,
        error: archiveErr instanceof Error ? archiveErr.message : String(archiveErr),
      });
    }

    // Execute onCompletion action if specified
    const onCompletionAction = task.onCompletion || 'keep';
    const result = await this.onCompletionHandler.execute(task, onCompletionAction);
    
    if (!result.success) {
      logger.error(`OnCompletion action failed for task "${task.name}"`, {
        taskId: task.id,
        action: onCompletionAction,
        error: result.error
      });
    }

    if (result.warnings) {
      for (const warning of result.warnings) {
        logger.warn(warning, { taskId: task.id });
      }
    }

    // Clear overdue state for this task
    this.overdueStateSet.delete(taskId);

    // Calculate next occurrence
    if (!hasRecurrence(task)) {
      logger.warn('Task has no recurrence configured', { taskId: task.id });
      // Emit completed event (no recurrence)
      if (this.eventQueue) {
        this.eventQueue.enqueue("task:runtime:completed", {
          taskId: task.id,
          completedAt: now.toISOString(),
        });
        this.eventQueue.flush();
      }
      return;
    }
    
    try {
      const taskWithRecurrence = ensureRecurrence(task);
      const referenceDate = task.whenDone ? now : new Date(task.dueAt);
      const nextDue = this.recurrenceEngine.next(taskWithRecurrence, referenceDate);

      if (!nextDue) {
        task.enabled = false;
        await this.storage.saveTask(task);
        logger.info(`Task "${task.name}" recurrence series exhausted, disabled`);
        // Emit completed + no next
        if (this.eventQueue) {
          this.eventQueue.enqueue("task:runtime:completed", {
            taskId: task.id,
            completedAt: now.toISOString(),
          });
          this.eventQueue.flush();
        }
        return;
      }
      
      if (!task.recurrence && taskWithRecurrence.recurrence) {
        task.recurrence = taskWithRecurrence.recurrence;
      }

      const previousDueAt = task.dueAt;
      task.dueAt = nextDue.toISOString();
      task.doneAt = undefined;
      await this.storage.saveTask(task);

      // Emit runtime events
      if (this.eventQueue) {
        this.eventQueue.enqueue("task:runtime:completed", {
          taskId: task.id,
          completedAt: now.toISOString(),
          nextDueAt: nextDue.toISOString(),
        });
        this.eventQueue.enqueue("task:runtime:recurrence", {
          taskId: task.id,
          nextDueAt: nextDue.toISOString(),
          rrule: task.recurrence?.rrule || "",
        });
        this.eventQueue.flush();
      }

      logger.info(`Task "${task.name}" completed and rescheduled to ${nextDue.toISOString()}`);
    } catch (error) {
      logger.error('Failed to reschedule task after completion', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Delay a task by specified minutes.
   * Emits task:runtime:rescheduled via EventQueue.
   */
  async delayTask(taskId: string, delayMinutes: number): Promise<void> {
    const original = this.storage.getTask(taskId);
    if (!original) {
      throw new Error(`Task not found: ${taskId}`);
    }

    this.assertSnoozeAvailable(original);

    const task = { ...original };
    const previousDueAt = task.dueAt;
    const currentDue = new Date(task.dueAt);
    const delayed = new Date(currentDue.getTime() + delayMinutes * 60 * 1000);

    task.dueAt = delayed.toISOString();
    task.snoozeCount = (task.snoozeCount || 0) + 1;
    await this.storage.saveTask(task);

    // Emit runtime event
    if (this.eventQueue) {
      this.eventQueue.enqueue("task:runtime:rescheduled", {
        taskId: task.id,
        previousDueAt,
        newDueAt: task.dueAt,
        reason: `delayed ${delayMinutes}m`,
      });
      this.eventQueue.flush();
    }

    logger.info(`Task "${task.name}" delayed by ${delayMinutes} minutes to ${delayed.toISOString()}`);
  }

  /**
   * Delay a task to tomorrow.
   * Emits task:runtime:rescheduled via EventQueue.
   */
  async delayToTomorrow(taskId: string): Promise<void> {
    const original = this.storage.getTask(taskId);
    if (!original) {
      throw new Error(`Task not found: ${taskId}`);
    }

    this.assertSnoozeAvailable(original);

    const task = { ...original };
    const previousDueAt = task.dueAt;
    const currentDue = new Date(task.dueAt);
    const tomorrow = this.timezoneHandler.tomorrow();
    
    // Preserve the time from the current due date
    tomorrow.setHours(
      currentDue.getHours(),
      currentDue.getMinutes(),
      0,
      0
    );

    task.dueAt = tomorrow.toISOString();
    task.snoozeCount = (task.snoozeCount || 0) + 1;
    await this.storage.saveTask(task);

    // Emit runtime event
    if (this.eventQueue) {
      this.eventQueue.enqueue("task:runtime:rescheduled", {
        taskId: task.id,
        previousDueAt,
        newDueAt: task.dueAt,
        reason: "delayed to tomorrow",
      });
      this.eventQueue.flush();
    }

    logger.info(`Task "${task.name}" delayed to tomorrow: ${tomorrow.toISOString()}`);
  }

  /**
   * Skip a task occurrence and reschedule to next recurrence.
   * Emits task:runtime:skipped via EventQueue.
   */
  async skipOccurrence(taskId: string): Promise<void> {
    const task = this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Record as a miss
    recordMiss(task);

    // Clear overdue state for this task
    this.overdueStateSet.delete(taskId);

    if (!hasRecurrence(task)) {
      logger.warn('Task has no recurrence configured for skip', { taskId: task.id });
      return;
    }

    try {
      const taskWithRecurrence = ensureRecurrence(task);
      
      const currentDue = new Date(task.dueAt);
      const skippedDueAt = task.dueAt;
      const nextDue = this.recurrenceEngine.next(taskWithRecurrence, currentDue);

      if (!nextDue) {
        task.enabled = false;
        await this.storage.saveTask(task);
        // Emit skip with no next
        if (this.eventQueue) {
          this.eventQueue.enqueue("task:runtime:skipped", {
            taskId: task.id,
            skippedDueAt,
          });
          this.eventQueue.flush();
        }
        logger.info(`Task "${task.name}" recurrence series exhausted on skip, disabled`);
        return;
      }
      
      if (!task.recurrence && taskWithRecurrence.recurrence) {
        task.recurrence = taskWithRecurrence.recurrence;
      }

      task.dueAt = nextDue.toISOString();
      await this.storage.saveTask(task);

      // Emit runtime event
      if (this.eventQueue) {
        this.eventQueue.enqueue("task:runtime:skipped", {
          taskId: task.id,
          skippedDueAt,
          nextDueAt: nextDue.toISOString(),
        });
        this.eventQueue.flush();
      }

      logger.info(`Task "${task.name}" skipped to ${nextDue.toISOString()}`);
    } catch (error) {
      logger.error('Failed to skip task occurrence', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Legacy method - kept for backward compatibility
   */
  async delayTaskToTomorrow(taskId: string): Promise<void> {
    return this.delayToTomorrow(taskId);
  }

  /**
   * Legacy method - kept for backward compatibility
   */
  async skipTaskOccurrence(taskId: string): Promise<void> {
    return this.skipOccurrence(taskId);
  }

  /**
   * Maximum number of missed event emissions per task during recovery.
   * Prevents flooding downstream listeners after long downtime.
   */
  private static readonly MAX_MISSED_EMISSIONS_PER_TASK = 50;

  /**
   * Recover missed tasks from the last plugin session.
   * Uses the RRule-based RecurrenceEngine API (Phase 3).
   *
   * Flow:
   * 1. Load lastRunAt timestamp from storage
   * 2. For each enabled task with an RRULE, get missed occurrences
   * 3. Emit "task:overdue" for each (capped per-task to prevent flooding)
   * 4. Advance overdue tasks to next future occurrence
   */
  async recoverMissedTasks(): Promise<void> {
    await this.ensureEmittedStateLoaded();
    const lastRunAt = await this.loadLastRunTimestamp();
    const now = new Date();
    
    if (!lastRunAt) {
      // First run, save timestamp and exit
      await this.saveLastRunTimestamp(now);
      logger.info("First run detected, no recovery needed");
      return;
    }

    logger.info(`Recovering missed tasks since ${lastRunAt.toISOString()}`);
    
    let totalEmitted = 0;
    for (const task of this.storage.getEnabledTasks()) {
      // Phase 3: Use RRULE-based recurrence, skip tasks without it
      if (!task.recurrence?.rrule) {
        continue;
      }
      
      try {
        // Use the new RecurrenceEngine.getMissedOccurrences(task, lastChecked, now, options) API
        const result = this.recurrenceEngine.getMissedOccurrences(
          task,
          lastRunAt,
          now,
          { policy: "catchUp", maxMissed: Scheduler.MAX_MISSED_EMISSIONS_PER_TASK }
        );
        
        // Backpressure: cap per-task emissions to avoid flooding after long downtime
        let emittedForTask = 0;
        if (result.count > Scheduler.MAX_MISSED_EMISSIONS_PER_TASK) {
          logger.warn(
            `Task "${task.name}" has ${result.count} missed occurrences, capping to ${Scheduler.MAX_MISSED_EMISSIONS_PER_TASK}`
          );
        }

        for (const missedAt of result.missedDates) {
          if (emittedForTask >= Scheduler.MAX_MISSED_EMISSIONS_PER_TASK) {
            break;
          }
          const taskKey = this.buildOccurrenceKey(task.id, missedAt, "exact");
          if (!this.emittedMissed.has(taskKey)) {
            this.emitEvent("task:overdue", {
              taskId: task.id,
              dueAt: missedAt,
              context: "overdue",
              task,
            });
            this.registerEmittedKey("missed", taskKey);
            emittedForTask++;
            totalEmitted++;
          }
        }
        
        // Advance task to next future occurrence if it's in the past
        await this.advanceToNextFutureOccurrence(task, now);
      } catch (err) {
        logger.error(`Failed to recover task ${task.id}:`, err);
      }
    }
    
    await this.saveLastRunTimestamp(now);
    this.cleanupEmittedSets();
    // Flush any runtime events enqueued during recovery
    if (this.eventQueue) {
      this.eventQueue.flush();
    }
    logger.info(`Missed task recovery completed: ${totalEmitted} overdue events emitted`);
  }

  /**
   * Advance a task to the next occurrence in the future.
   * Uses the RRule-based RecurrenceEngine.next(task, ref) API (Phase 3).
   */
  private async advanceToNextFutureOccurrence(task: Task, now: Date): Promise<void> {
    const currentDue = new Date(task.dueAt);
    
    if (currentDue >= now) {
      // Task is already in the future
      return;
    }

    // Phase 3: Use RRULE-based recurrence
    if (!task.recurrence?.rrule) {
      logger.warn('Task has no RRULE configured for advance', { taskId: task.id });
      return;
    }

    // Use RecurrenceEngine.next() which finds the next occurrence after a given date.
    // We pass `now` as reference so it returns the next future occurrence directly.
    const nextDue = this.recurrenceEngine.next(task, now);
    
    if (!nextDue) {
      // Series exhausted during recovery — disable task
      task.enabled = false;
      await this.storage.saveTask(task);
      logger.info(`Task "${task.name}" recurrence series exhausted during recovery, disabled`);
      return;
    }

    if (nextDue > currentDue) {
      const previousDueAt = task.dueAt;
      task.dueAt = nextDue.toISOString();
      await this.storage.saveTask(task);

      // Emit runtime rescheduled event
      if (this.eventQueue) {
        this.eventQueue.enqueue("task:runtime:rescheduled", {
          taskId: task.id,
          previousDueAt,
          newDueAt: task.dueAt,
          reason: "recovery advance",
        });
      }

      logger.info(`Advanced task "${task.name}" to ${nextDue.toISOString()}`);
    }
  }

  /**
   * Load last run timestamp from storage
   */
  private async loadLastRunTimestamp(): Promise<Date | null> {
    if (!this.plugin) {
      return null;
    }

    try {
      const data = await this.plugin.loadData(LAST_RUN_TIMESTAMP_KEY);
      if (data && data.timestamp) {
        return new Date(data.timestamp);
      }
    } catch (err) {
      logger.error("Failed to load last run timestamp:", err);
    }
    
    return null;
  }

  /**
   * Save last run timestamp to storage
   */
  private async saveLastRunTimestamp(timestamp: Date): Promise<void> {
    if (!this.plugin) {
      return;
    }

    try {
      await this.plugin.saveData(LAST_RUN_TIMESTAMP_KEY, {
        timestamp: timestamp.toISOString(),
      });
    } catch (err) {
      logger.error("Failed to save last run timestamp:", err);
    }
  }

  /**
   * Get recurrence engine for external use
   */
  getRecurrenceEngine(): RecurrenceEngine {
    return this.recurrenceEngine;
  }

  /**
   * Get timezone handler for external use
   */
  getTimezoneHandler(): TimezoneHandler {
    return this.timezoneHandler;
  }

  private emitEvent(eventType: SchedulerEventType, payload: TaskDueEvent): void {
    const listeners = this.listeners[eventType];
    for (const listener of listeners) {
      try {
        const result = listener(payload);
        if (result instanceof Promise) {
          result.catch((err) => {
            logger.error(`Scheduler listener error for ${eventType}:`, err);
          });
        }
      } catch (err) {
        logger.error(`Scheduler listener error for ${eventType}:`, err);
      }
    }
  }

  private assertSnoozeAvailable(task: Task): void {
    const maxSnoozes = task.maxSnoozes ?? DEFAULT_MAX_SNOOZES;
    const snoozeCount = task.snoozeCount ?? 0;

    if (maxSnoozes <= 0) {
      throw new Error("Snoozing is disabled for this task.");
    }

    if (snoozeCount >= maxSnoozes) {
      throw new Error(`Snooze limit reached (${maxSnoozes}).`);
    }
  }

  private registerEmittedKey(kind: "due" | "missed", key: string): void {
    if (kind === "due") {
      this.emittedDue.add(key);
    } else {
      this.emittedMissed.add(key);
    }
    this.schedulePersistEmittedState();
  }

  private ensureEmittedStateLoaded(): Promise<void> {
    if (!this.emittedStateReady) {
      this.emittedStateReady = this.restoreEmittedState();
    }
    return this.emittedStateReady;
  }

  /**
   * Restore emitted state from storage
   * 
   * FIX [HIGH-002]: Load from backup if primary fails (persistent duplicate detection)
   */
  private async restoreEmittedState(): Promise<void> {
    if (!this.plugin) {
      return;
    }

    try {
      // Try to load from primary key
      const data = await this.plugin.loadData(EMITTED_OCCURRENCES_KEY);
      
      if (data && Array.isArray(data.due) && data.due.length > 0) {
        // Primary key has valid data
        const due = data.due.filter((entry: unknown) => typeof entry === "string");
        const missed = Array.isArray(data.missed) ? data.missed.filter((entry: unknown) => typeof entry === "string") : [];
        this.emittedDue = new Set(due.slice(-this.MAX_EMITTED_ENTRIES));
        this.emittedMissed = new Set(missed.slice(-this.MAX_EMITTED_ENTRIES));
        logger.info("Restored scheduler emitted state from primary key", {
          due: this.emittedDue.size,
          missed: this.emittedMissed.size,
        });
        return;
      }

      // ✅ FIX: Primary key failed or empty, try loading from most recent backup
      logger.warn("Primary emitted state empty or invalid, attempting backup restore");
      await this.restoreFromBackup();
      
    } catch (err) {
      logger.error("Failed to restore scheduler emitted state from primary key:", err);
      
      // ✅ FIX: Try backup on error
      try {
        await this.restoreFromBackup();
      } catch (backupErr) {
        logger.error("Failed to restore from backup, starting with empty state:", backupErr);
        // Start with empty sets if all restore attempts fail
        this.emittedDue = new Set();
        this.emittedMissed = new Set();
      }
    }
  }

  /**
   * Restore emitted state from most recent backup
   * 
   * FIX [HIGH-002]: Backup restoration mechanism
   */
  private async restoreFromBackup(): Promise<void> {
    if (!this.plugin) {
      throw new Error('Plugin not available for backup restore');
    }

    const backupKey = `${EMITTED_OCCURRENCES_KEY}_backup`;
    
    try {
      const backupData = await this.plugin.loadData(backupKey);
      
      if (backupData && Array.isArray(backupData.due)) {
        const due = backupData.due.filter((entry: unknown) => typeof entry === "string");
        const missed = Array.isArray(backupData.missed) ? backupData.missed.filter((entry: unknown) => typeof entry === "string") : [];
        this.emittedDue = new Set(due.slice(-this.MAX_EMITTED_ENTRIES));
        this.emittedMissed = new Set(missed.slice(-this.MAX_EMITTED_ENTRIES));
        
        logger.info(`Restored scheduler emitted state from backup`, {
          due: this.emittedDue.size,
          missed: this.emittedMissed.size,
          timestamp: backupData.timestamp,
          reason: backupData.reason
        });
        return;
      }
    } catch (err) {
      // Backup key doesn't exist or failed to load
    }

    throw new Error('No valid backup found');
  }

  private schedulePersistEmittedState(): void {
    if (!this.plugin) {
      return;
    }

    if (this.persistTimeoutId !== null) {
      return;
    }

    // Cast to number for cross-environment compatibility (NodeJS.Timeout vs number)
    this.persistTimeoutId = globalThis.setTimeout(() => {
      this.persistTimeoutId = null;
      void this.persistEmittedState();
    }, this.EMITTED_SAVE_DEBOUNCE_MS) as unknown as number;
  }

  private async persistEmittedState(): Promise<void> {
    if (!this.plugin) {
      return;
    }

    try {
      await this.plugin.saveData(EMITTED_OCCURRENCES_KEY, {
        due: Array.from(this.emittedDue),
        missed: Array.from(this.emittedMissed),
      });
    } catch (err) {
      logger.error("Failed to persist scheduler emitted state:", err);
    }
  }

  /**
   * Save emitted state to backup location (fallback for failures)
   * 
   * FIX [CRITICAL-003]: Backup persistence to prevent data loss
   */
  private async saveEmittedStateBackup(): Promise<void> {
    if (!this.plugin) {
      throw new Error('Plugin not available for backup');
    }

    const backupKey = `${EMITTED_OCCURRENCES_KEY}_backup`;
    const data = {
      due: Array.from(this.emittedDue),
      missed: Array.from(this.emittedMissed),
      timestamp: new Date().toISOString(),
      reason: 'primary_persistence_failed'
    };

    await this.plugin.saveData(backupKey, data);
    logger.info(`Emitted state saved to backup: ${backupKey}`);
  }

  private buildOccurrenceKey(
    taskId: string,
    dueAt: Date,
    precision: "hour" | "exact"
  ): string {
    if (precision === "exact") {
      return `${taskId}:${dueAt.toISOString()}`;
    }

    return `${taskId}:${dueAt.toISOString().slice(0, 13)}`;
  }
}
