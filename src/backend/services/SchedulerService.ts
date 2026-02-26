/**
 * SchedulerService — Runtime-Validated Scheduler Gateway
 *
 * Implements the canonical task execution flow:
 *
 *   SchedulerService.tick()
 *     → QueryService.selectDue()
 *     → DependencyExecutionGuard.canExecute()
 *     → RecurrenceResolver.resolveInstance()
 *     → BlockAttributeValidator.exists()
 *     → TaskLifecycle.transition()
 *     → EventBus.emit("task:runtime:*")
 *     → IntegrationService.fire()
 *     → MLRuntimeAdapter.analyze()
 *
 * This is the ONLY path for runtime task scheduling.
 * No service may bypass this flow.
 *
 * Reads task data ONLY from QueryService.selectDue() — NEVER from
 * TaskStorage directly.
 *
 * Lifecycle:
 *   - start() → mark active
 *   - stop()  → mark inactive
 *
 * FORBIDDEN:
 *   - Read from TaskStorage directly
 *   - Read from DueStateCache directly
 *   - Fire webhooks directly
 *   - Import frontend / Svelte
 *   - Parse markdown
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { Scheduler } from "@backend/core/engine/Scheduler";
import type { DependencyExecutionGuard } from "@backend/dependencies/DependencyExecutionGuard";
import type { EventService } from "./EventService";
import type { QueryService, DueTasksResult } from "./QueryService";
import type { TaskService } from "./TaskService";
import type { TaskLifecycle } from "./TaskLifecycle";
import type { RecurrenceResolver } from "./RecurrenceResolver";
import type { BlockAttributeValidator } from "./BlockAttributeValidator";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface SchedulerServiceDeps {
  scheduler: Scheduler;
  queryService: QueryService;
  taskService: TaskService;
  eventService: EventService;
  dependencyGuard: DependencyExecutionGuard;
  /** Runtime-validated lifecycle engine (Session 19) */
  taskLifecycle?: TaskLifecycle;
  /** Recurrence instance resolver (Session 19) */
  recurrenceResolver?: RecurrenceResolver;
  /** Block attribute validator (Session 19) */
  blockValidator?: BlockAttributeValidator;
}

export interface SchedulerServiceStats {
  pollCount: number;
  lastPollAt: string | null;
  lastPollDurationMs: number;
  lastPollDueCount: number;
  totalEmitted: number;
  totalBlocked: number;
  totalBlockValidationFailed: number;
  totalRecurrenceResolved: number;
  totalLifecycleRejected: number;
}

export interface TickResult extends DueTasksResult {
  emitted: number;
  blocked: number;
  blockValidationFailed: number;
  recurrenceResolved: number;
  lifecycleRejected: number;
}

/** Legacy interface preserved for backward compatibility */
export interface ISchedulerService {
  scheduleTask(task: ReadonlyTask): Promise<void>;
  unscheduleTask(taskId: string): Promise<void>;
  rescheduleTask(task: ReadonlyTask): Promise<void>;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class SchedulerService {
  private readonly scheduler: Scheduler;
  private readonly queryService: QueryService;
  private readonly taskService: TaskService;
  private readonly eventService: EventService;
  private readonly dependencyGuard: DependencyExecutionGuard;
  private readonly taskLifecycle: TaskLifecycle | null;
  private readonly recurrenceResolver: RecurrenceResolver | null;
  private readonly blockValidator: BlockAttributeValidator | null;

  private active = false;

  // ── Stats ──────────────────────────────────────────────────
  private pollCount = 0;
  private lastPollAt: string | null = null;
  private lastPollDurationMs = 0;
  private lastPollDueCount = 0;
  private totalEmitted = 0;
  private totalBlocked = 0;
  private totalBlockValidationFailed = 0;
  private totalRecurrenceResolved = 0;
  private totalLifecycleRejected = 0;

  constructor(deps: SchedulerServiceDeps) {
    this.scheduler = deps.scheduler;
    this.queryService = deps.queryService;
    this.taskService = deps.taskService;
    this.eventService = deps.eventService;
    this.dependencyGuard = deps.dependencyGuard;
    this.taskLifecycle = deps.taskLifecycle ?? null;
    this.recurrenceResolver = deps.recurrenceResolver ?? null;
    this.blockValidator = deps.blockValidator ?? null;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[SchedulerService] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    logger.info("[SchedulerService] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * CANONICAL EXECUTION FLOW — The tick() method.
   *
   * Implements the full runtime-validated pipeline:
   *   1. QueryService.selectDue()                → get due tasks
   *   2. DependencyExecutionGuard.canExecute()   → filter blocked tasks
   *   3. RecurrenceResolver.resolveInstance()     → attach to latest instance
   *   4. BlockAttributeValidator.exists()         → confirm block valid
   *   5. TaskLifecycle.transition()               → validated state machine
   *   6. EventBus.emit("task:runtime:due")        → notify consumers
   *
   * Called by EngineController on each scheduler tick.
   */
  async tick(): Promise<TickResult> {
    this.requireActive("tick");

    const start = performance.now();
    const now = new Date();

    let emitted = 0;
    let blocked = 0;
    let blockValidationFailed = 0;
    let recurrenceResolved = 0;
    let lifecycleRejected = 0;

    try {
      // ── Step 1: QueryService.selectDue() ──
      const result = await this.queryService.selectDue(now);

      for (const task of result.tasks) {
        // ── Step 2: DependencyExecutionGuard ──
        if (!this.dependencyGuard.canExecuteSync(task.id)) {
          blocked++;
          continue;
        }

        // ── Step 3: RecurrenceResolver ──
        let resolvedTask: ReadonlyTask = task;
        if (this.recurrenceResolver) {
          const resolveResult = this.recurrenceResolver.resolveInstance(task);
          resolvedTask = resolveResult.task;
          if (resolveResult.resolved) recurrenceResolved++;
          if (resolveResult.seriesEnded) {
            // Series ended — skip this task
            continue;
          }
        }

        // ── Step 4: BlockAttributeValidator ──
        if (this.blockValidator) {
          const blockResult = await this.blockValidator.exists(resolvedTask);
          if (!blockResult.valid) {
            blockValidationFailed++;
            continue;
          }
        }

        // ── Step 5: TaskLifecycle.transition() (if available) ──
        if (this.taskLifecycle) {
          const transitionResult = await this.taskLifecycle.transition({
            taskId: resolvedTask.id,
            task: resolvedTask,
            targetState: "due",
            reason: "scheduler_tick",
          });

          if (!transitionResult.success) {
            lifecycleRejected++;
            continue;
          }
          // Event emission handled by TaskLifecycle
          emitted++;
        } else {
          // ── Fallback: direct emission (backward compat) ──
          this.eventService.emitRuntimeDue(
            resolvedTask.id,
            resolvedTask.dueAt,
            resolvedTask,
          );
          emitted++;
        }
      }

      const durationMs = performance.now() - start;

      // Update stats
      this.pollCount++;
      this.lastPollAt = now.toISOString();
      this.lastPollDurationMs = durationMs;
      this.lastPollDueCount = result.count;
      this.totalEmitted += emitted;
      this.totalBlocked += blocked;
      this.totalBlockValidationFailed += blockValidationFailed;
      this.totalRecurrenceResolved += recurrenceResolved;
      this.totalLifecycleRejected += lifecycleRejected;

      if (emitted > 0 || blocked > 0 || blockValidationFailed > 0) {
        logger.debug("[SchedulerService] tick() complete", {
          due: result.count,
          emitted,
          blocked,
          blockValidationFailed,
          recurrenceResolved,
          lifecycleRejected,
          durationMs: Math.round(durationMs),
        });
      }

      return {
        tasks: result.tasks,
        count: result.count,
        durationMs,
        emitted,
        blocked,
        blockValidationFailed,
        recurrenceResolved,
        lifecycleRejected,
      };
    } catch (error) {
      logger.error("[SchedulerService] tick() failed", { error });
      const durationMs = performance.now() - start;
      return {
        tasks: [],
        count: 0,
        durationMs,
        emitted: 0,
        blocked: 0,
        blockValidationFailed: 0,
        recurrenceResolved: 0,
        lifecycleRejected: 0,
      };
    }
  }

  /**
   * Legacy poll method — delegates to tick().
   * Preserved for backward compatibility.
   */
  async pollDueTasks(): Promise<DueTasksResult> {
    const result = await this.tick();
    return {
      tasks: result.tasks,
      count: result.count,
      durationMs: result.durationMs,
    };
  }

  /**
   * Complete a task through TaskService.
   * Delegates to TaskService to ensure proper mutation flow.
   */
  async completeTask(taskId: string): Promise<void> {
    this.requireActive("completeTask");
    await this.taskService.completeTask(taskId);
  }

  /**
   * Reschedule a task through TaskService.
   */
  async rescheduleTask(taskId: string, delayMinutes: number): Promise<void> {
    this.requireActive("rescheduleTask");
    await this.taskService.rescheduleTask(taskId, delayMinutes, "scheduler_reschedule");
  }

  /**
   * Skip a task occurrence through TaskService.
   */
  async skipOccurrence(taskId: string): Promise<void> {
    this.requireActive("skipOccurrence");
    await this.taskService.generateRecurrence(taskId);
  }

  /**
   * Get the underlying Scheduler instance for legacy compatibility.
   * Used only during migration — prefer service methods instead.
   */
  getScheduler(): Scheduler {
    return this.scheduler;
  }

  /**
   * Get current scheduler service stats.
   */
  getStats(): SchedulerServiceStats {
    return {
      pollCount: this.pollCount,
      lastPollAt: this.lastPollAt,
      lastPollDurationMs: this.lastPollDurationMs,
      lastPollDueCount: this.lastPollDueCount,
      totalEmitted: this.totalEmitted,
      totalBlocked: this.totalBlocked,
      totalBlockValidationFailed: this.totalBlockValidationFailed,
      totalRecurrenceResolved: this.totalRecurrenceResolved,
      totalLifecycleRejected: this.totalLifecycleRejected,
    };
  }

  // ── Private ──────────────────────────────────────────────────

  private requireActive(method: string): void {
    if (!this.active) {
      throw new Error(`[SchedulerService] Not started — cannot call ${method}()`);
    }
  }
}
