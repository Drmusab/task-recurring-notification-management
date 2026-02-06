import type { Task } from "@backend/core/models/Task";
import type { TaskStorage } from "@backend/core/storage/TaskStorage";
import { RecurrenceEngineRRULE as RecurrenceEngine } from "./recurrence/RecurrenceEngineRRULE";
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

/**
 * Scheduler manages task timing and emits semantic events.
 *
 * Architecture note (before → after):
 * - Before: Scheduler directly touched NotificationState and triggered side effects.
 * - After: Scheduler emits "task:due"/"task:overdue" and remains time-focused;
 *          EventService owns NotificationState and any reactions.
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

  /**
   * Subscribe to scheduler events.
   */
  on(eventType: SchedulerEventType, listener: SchedulerEventListener): () => void {
    this.listeners[eventType].add(listener);
    return () => this.listeners[eventType].delete(listener);
  }

  /**
   * Start the scheduler
   */
  start(): void {
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
   */
  async stop(): Promise<void> {
    this.timer.stop();
    // Clear any pending debounce timer to prevent writes after shutdown
    if (this.persistTimeoutId !== null) {
      globalThis.clearTimeout(this.persistTimeoutId);
      this.persistTimeoutId = null;
    }
    try {
      await this.persistEmittedState();
    } catch (err) {
      logger.error("Failed to persist emitted state during stop", err);
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
   * Check for tasks that are due and trigger notifications
   */
  private checkDueTasks(): void {
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
    // Use the due index for fast lookup of due + overdue tasks.
    const tasks = this.storage.getTasksDueOnOrBefore(now);

    try {
      for (const task of tasks) {
        if (!this.isActive(task)) {
          continue;
        }

        const dueDate = new Date(task.dueAt);
        const isDue = dueDate <= now;

        // Check if task is due
        if (isDue) {
          const taskKey = this.buildOccurrenceKey(task.id, dueDate, "hour");
          if (!this.emittedDue.has(taskKey)) {
            this.emitEvent("task:due", {
              taskId: task.id,
              dueAt: dueDate,
              context: "today",
              task,
            });
            this.registerEmittedKey("due", taskKey);
            logger.info(`Task due: ${task.name}`, { taskId: task.id, dueAt: task.dueAt });
          }
        }

        // Check if task is missed
        const lastCompletedAt = task.lastCompletedAt
          ? new Date(task.lastCompletedAt)
          : null;

        if (
          isDue &&
          now.getTime() - dueDate.getTime() >= MISSED_GRACE_PERIOD_MS &&
          (!lastCompletedAt || lastCompletedAt < dueDate)
        ) {
          const taskKey = this.buildOccurrenceKey(task.id, dueDate, "hour");
          if (!this.emittedMissed.has(taskKey)) {
            this.emitEvent("task:overdue", {
              taskId: task.id,
              dueAt: dueDate,
              context: "overdue",
              task,
            });
            this.registerEmittedKey("missed", taskKey);
            logger.warn(`Task missed: ${task.name}`, { taskId: task.id, dueAt: task.dueAt });
          }
        }
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
   * Mark a task as done and reschedule
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
      // Continue with rescheduling even if deletion failed
    }

    if (result.warnings) {
      for (const warning of result.warnings) {
        logger.warn(warning, { taskId: task.id });
      }
    }

    // Calculate next occurrence
    const currentDue = new Date(task.dueAt);
    const nextDue = this.recurrenceEngine.calculateNext(
      currentDue,
      task.frequency,
      {
        completionDate: now,
        whenDone: task.whenDone
      }
    );

    if (!nextDue) {
      // Recurrence series exhausted — disable the task
      task.enabled = false;
      await this.storage.saveTask(task);
      logger.info(`Task "${task.name}" recurrence series exhausted, disabled`);
      return;
    }

    // Update task
    task.dueAt = nextDue.toISOString();
    // Clear doneAt for next occurrence
    task.doneAt = undefined;
    await this.storage.saveTask(task);

    logger.info(`Task "${task.name}" completed and rescheduled to ${nextDue.toISOString()}`);
  }

  /**
   * Delay a task by specified minutes
   */
  async delayTask(taskId: string, delayMinutes: number): Promise<void> {
    const task = this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    this.assertSnoozeAvailable(task);

    const currentDue = new Date(task.dueAt);
    const delayed = new Date(currentDue.getTime() + delayMinutes * 60 * 1000);

    task.dueAt = delayed.toISOString();
    task.snoozeCount = (task.snoozeCount || 0) + 1;
    await this.storage.saveTask(task);

    logger.info(`Task "${task.name}" delayed by ${delayMinutes} minutes to ${delayed.toISOString()}`);
  }

  /**
   * Delay a task to tomorrow
   */
  async delayToTomorrow(taskId: string): Promise<void> {
    const task = this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    this.assertSnoozeAvailable(task);

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

    logger.info(`Task "${task.name}" delayed to tomorrow: ${tomorrow.toISOString()}`);
  }

  /**
   * Skip a task occurrence and reschedule to next recurrence
   */
  async skipOccurrence(taskId: string): Promise<void> {
    const task = this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Record as a miss
    recordMiss(task);

    const currentDue = new Date(task.dueAt);
    const nextDue = this.recurrenceEngine.calculateNext(
      currentDue,
      task.frequency
    );

    if (!nextDue) {
      task.enabled = false;
      await this.storage.saveTask(task);
      logger.info(`Task "${task.name}" recurrence series exhausted on skip, disabled`);
      return;
    }

    task.dueAt = nextDue.toISOString();
    await this.storage.saveTask(task);

    logger.info(`Task "${task.name}" skipped to ${nextDue.toISOString()}`);
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
   * Recover missed tasks from the last plugin session
   * Based on patterns from siyuan-dailynote-today (RoutineEventHandler)
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
      try {
        const missedOccurrences = this.recurrenceEngine.getMissedOccurrences(
          lastRunAt,
          now,
          task.frequency,
          new Date(task.createdAt)
        );
        
        // Backpressure: cap per-task emissions to avoid flooding after long downtime
        let emittedForTask = 0;
        if (missedOccurrences.length > Scheduler.MAX_MISSED_EMISSIONS_PER_TASK) {
          logger.warn(
            `Task "${task.name}" has ${missedOccurrences.length} missed occurrences, capping to ${Scheduler.MAX_MISSED_EMISSIONS_PER_TASK}`
          );
        }

        for (const missedAt of missedOccurrences) {
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
    logger.info(`Missed task recovery completed: ${totalEmitted} overdue events emitted`);
  }

  /**
   * Advance a task to the next occurrence in the future
   */
  private async advanceToNextFutureOccurrence(task: Task, now: Date): Promise<void> {
    const currentDue = new Date(task.dueAt);
    
    if (currentDue >= now) {
      // Task is already in the future
      return;
    }

    let nextDue = currentDue;
    let iterations = 0;

    // Keep advancing until we find a future occurrence, but cap iterations to
    // avoid infinite loops for corrupt timestamps or extreme downtime.
    while (nextDue < now && iterations < MAX_RECOVERY_ITERATIONS) {
      const computed = this.recurrenceEngine.calculateNext(nextDue, task.frequency);
      if (!computed) {
        // Series exhausted during recovery — disable task
        task.enabled = false;
        await this.storage.saveTask(task);
        logger.info(`Task "${task.name}" recurrence series exhausted during recovery, disabled`);
        return;
      }
      nextDue = computed;
      iterations++;
    }

    if (nextDue > currentDue) {
      task.dueAt = nextDue.toISOString();
      await this.storage.saveTask(task);
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

  private async restoreEmittedState(): Promise<void> {
    if (!this.plugin) {
      return;
    }

    try {
      const data = await this.plugin.loadData(EMITTED_OCCURRENCES_KEY);
      const due = Array.isArray(data?.due) ? data.due.filter((entry: unknown) => typeof entry === "string") : [];
      const missed = Array.isArray(data?.missed) ? data.missed.filter((entry: unknown) => typeof entry === "string") : [];
      this.emittedDue = new Set(due.slice(-this.MAX_EMITTED_ENTRIES));
      this.emittedMissed = new Set(missed.slice(-this.MAX_EMITTED_ENTRIES));
      logger.info("Restored scheduler emitted state", {
        due: this.emittedDue.size,
        missed: this.emittedMissed.size,
      });
    } catch (err) {
      logger.error("Failed to restore scheduler emitted state:", err);
    }
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
