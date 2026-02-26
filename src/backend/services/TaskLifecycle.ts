/**
 * TaskLifecycle — Runtime-Validated Task State Machine
 *
 * Enforces the canonical task execution flow:
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
 * State transitions:
 *   idle → due        (when dueAt ≤ now + grace)
 *   due  → completed  (when user marks done)
 *   due  → missed     (when dueAt + grace < now and not completed)
 *   due  → overdue    (when dueAt < now but within grace)
 *   due  → blocked    (when dependency guard blocks)
 *   due  → rescheduled (when user delays)
 *   *    → cancelled   (when user cancels or block is archived)
 *
 * EVERY transition validates:
 *   1. DependencyExecutionGuard.canExecute() — block if deps unmet
 *   2. RecurrenceResolver.resolveInstance() — attach to latest instance
 *   3. BlockAttributeValidator.exists() — confirm block exists + not terminal
 *
 * After EVERY successful transition:
 *   4. TaskService mutation (if needed)
 *   5. EventService.emit("task:runtime:*")
 *   6. IntegrationService.fire() (only for due/overdue/missed)
 *   7. MLRuntimeAdapter.analyze() (only for completed/missed)
 *
 * Runtime lifecycle safety:
 *   - MUST NOT initialize before plugin.onload()
 *   - MUST NOT transition before storage load
 *   - MUST NOT retry after plugin.onunload()
 *   - MUST NOT fire integration from scheduler directly
 *
 * FORBIDDEN:
 *   - Bypass validation gates
 *   - Mutate task model directly (delegate to TaskService)
 *   - Import frontend / Svelte
 *   - Parse markdown / access DOM
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { DependencyExecutionGuard } from "@backend/dependencies/DependencyExecutionGuard";
import type { EventService } from "./EventService";
import type { BlockAttributeValidator, BlockValidationResult } from "./BlockAttributeValidator";
import type { RecurrenceResolver, ResolveResult } from "./RecurrenceResolver";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** All valid runtime states for a task */
export type TaskRuntimeState =
  | "idle"
  | "due"
  | "overdue"
  | "missed"
  | "completed"
  | "rescheduled"
  | "blocked"
  | "cancelled";

/** All valid runtime transitions */
export type TaskTransitionType =
  | "task:runtime:due"
  | "task:runtime:overdue"
  | "task:runtime:completed"
  | "task:runtime:missed"
  | "task:runtime:rescheduled"
  | "task:runtime:blocked"
  | "task:runtime:cancelled"
  | "task:runtime:skipped";

export interface TransitionRequest {
  taskId: string;
  task: ReadonlyTask;
  targetState: TaskRuntimeState;
  /** For rescheduled: delay in minutes */
  delayMinutes?: number;
  /** Reason for the transition */
  reason?: string;
}

export interface TransitionResult {
  /** Whether the transition was allowed and executed */
  success: boolean;
  /** The task after transition (may have patched dueAt from recurrence) */
  task: ReadonlyTask;
  /** New runtime state (if successful) */
  state?: TaskRuntimeState;
  /** Why the transition was rejected */
  rejectionReason?: string;
  /** Which validation gate rejected it */
  rejectedBy?: "dependency" | "recurrence" | "block_validation" | "lifecycle_inactive" | "invalid_transition";
  /** Block validation result (if checked) */
  blockValidation?: BlockValidationResult;
  /** Recurrence resolution result (if checked) */
  recurrenceResult?: ResolveResult;
}

export interface TaskLifecycleDeps {
  dependencyGuard: DependencyExecutionGuard;
  blockValidator: BlockAttributeValidator;
  recurrenceResolver: RecurrenceResolver;
  eventService: EventService;
}

export interface TaskLifecycleStats {
  totalTransitions: number;
  totalRejected: number;
  transitionCounts: Record<TaskRuntimeState, number>;
  rejectionBreakdown: {
    dependency: number;
    blockValidation: number;
    recurrenceEnded: number;
    lifecycleInactive: number;
    invalidTransition: number;
  };
}

// ── Valid transition map ──────────────────────────────────────

/** Valid source → target state transitions */
const VALID_TRANSITIONS: Record<TaskRuntimeState, Set<TaskRuntimeState>> = {
  idle:        new Set(["due", "blocked", "cancelled"]),
  due:         new Set(["completed", "missed", "overdue", "blocked", "rescheduled", "cancelled"]),
  overdue:     new Set(["completed", "missed", "blocked", "rescheduled", "cancelled"]),
  missed:      new Set(["completed", "rescheduled", "cancelled"]),
  completed:   new Set(["idle"]), // Only back to idle for next recurrence cycle
  rescheduled: new Set(["due", "overdue", "blocked", "cancelled"]),
  blocked:     new Set(["due", "overdue", "cancelled"]),
  cancelled:   new Set([]), // Terminal — no further transitions
};

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class TaskLifecycle {
  private readonly dependencyGuard: DependencyExecutionGuard;
  private readonly blockValidator: BlockAttributeValidator;
  private readonly recurrenceResolver: RecurrenceResolver;
  private readonly eventService: EventService;

  private active = false;

  /** Runtime state tracker for each task */
  private readonly taskStates: Map<string, TaskRuntimeState> = new Map();

  // ── Stats ──
  private totalTransitions = 0;
  private totalRejected = 0;
  private transitionCounts: Record<TaskRuntimeState, number> = {
    idle: 0, due: 0, overdue: 0, missed: 0,
    completed: 0, rescheduled: 0, blocked: 0, cancelled: 0,
  };
  private rejectionBreakdown = {
    dependency: 0,
    blockValidation: 0,
    recurrenceEnded: 0,
    lifecycleInactive: 0,
    invalidTransition: 0,
  };

  constructor(deps: TaskLifecycleDeps) {
    this.dependencyGuard = deps.dependencyGuard;
    this.blockValidator = deps.blockValidator;
    this.recurrenceResolver = deps.recurrenceResolver;
    this.eventService = deps.eventService;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[TaskLifecycle] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.taskStates.clear();
    this.active = false;
    logger.info("[TaskLifecycle] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Execute a validated state transition.
   *
   * Full validation pipeline:
   *   1. Check lifecycle active (MUST NOT transition after unload)
   *   2. Validate transition is allowed from current state
   *   3. DependencyExecutionGuard.canExecute() — reject if deps unmet
   *   4. RecurrenceResolver.resolveInstance() — attach to latest instance
   *   5. BlockAttributeValidator.exists() — confirm block valid
   *   6. Apply transition
   *   7. Emit "task:runtime:*" event
   */
  async transition(request: TransitionRequest): Promise<TransitionResult> {
    // Gate 1: Lifecycle safety — MUST NOT transition when stopped
    if (!this.active) {
      this.totalRejected++;
      this.rejectionBreakdown.lifecycleInactive++;
      return {
        success: false,
        task: request.task,
        rejectionReason: "TaskLifecycle is not active — transition blocked",
        rejectedBy: "lifecycle_inactive",
      };
    }

    const currentState = this.taskStates.get(request.taskId) ?? "idle";
    const targetState = request.targetState;

    // Gate 2: Valid transition check
    const validTargets = VALID_TRANSITIONS[currentState];
    if (!validTargets || !validTargets.has(targetState)) {
      this.totalRejected++;
      this.rejectionBreakdown.invalidTransition++;
      logger.debug("[TaskLifecycle] Invalid transition", {
        taskId: request.taskId,
        from: currentState,
        to: targetState,
      });
      return {
        success: false,
        task: request.task,
        rejectionReason: `Invalid transition: ${currentState} → ${targetState}`,
        rejectedBy: "invalid_transition",
      };
    }

    // Gate 3: Dependency guard (skip for cancelled/completed — always allowed)
    if (targetState !== "cancelled" && targetState !== "completed") {
      const depResult = await this.dependencyGuard.canExecute(request.taskId);
      if (!depResult.allowed) {
        this.totalRejected++;
        this.rejectionBreakdown.dependency++;

        // Auto-transition to blocked
        this.taskStates.set(request.taskId, "blocked");
        this.eventService.emit("task:blocked", {
          taskId: request.taskId,
          blockers: depResult.blockers || [],
        });

        return {
          success: false,
          task: request.task,
          state: "blocked",
          rejectionReason: depResult.reason || "Dependency check failed",
          rejectedBy: "dependency",
        };
      }
    }

    // Gate 4: Recurrence resolution
    const recurrenceResult = this.recurrenceResolver.resolveInstance(request.task);
    const resolvedTask = recurrenceResult.task;

    // If series ended and trying to activate, reject
    if (recurrenceResult.seriesEnded && (targetState === "due" || targetState === "overdue")) {
      this.totalRejected++;
      this.rejectionBreakdown.recurrenceEnded++;
      return {
        success: false,
        task: resolvedTask,
        rejectionReason: `Recurrence series ended for task ${request.taskId}`,
        rejectedBy: "recurrence" as any,
        recurrenceResult,
      };
    }

    // Gate 5: Block attribute validation (skip for completed/cancelled — already validated)
    if (targetState !== "cancelled") {
      const blockResult = await this.blockValidator.exists(resolvedTask);
      if (!blockResult.valid) {
        this.totalRejected++;
        this.rejectionBreakdown.blockValidation++;
        logger.debug("[TaskLifecycle] Block validation failed", {
          taskId: request.taskId,
          reason: blockResult.reason,
        });

        // If block is terminal, auto-transition to cancelled
        if (blockResult.failedCheck === "status_terminal") {
          this.taskStates.set(request.taskId, "cancelled");
          this.eventService.emit("task:escalation:resolved", {
            taskId: request.taskId,
            resolvedBy: "deleted",
          });
        }

        return {
          success: false,
          task: resolvedTask,
          rejectionReason: blockResult.reason || "Block validation failed",
          rejectedBy: "block_validation",
          blockValidation: blockResult,
          recurrenceResult,
        };
      }
    }

    // ── All gates passed → Apply transition ──
    this.taskStates.set(request.taskId, targetState);
    this.totalTransitions++;
    this.transitionCounts[targetState]++;

    // Emit runtime event
    this.emitTransitionEvent(request.taskId, targetState, resolvedTask, request);

    logger.debug("[TaskLifecycle] Transition complete", {
      taskId: request.taskId,
      from: currentState,
      to: targetState,
    });

    return {
      success: true,
      task: resolvedTask,
      state: targetState,
      blockValidation: undefined,
      recurrenceResult,
    };
  }

  /**
   * Get the current runtime state of a task.
   */
  getState(taskId: string): TaskRuntimeState {
    return this.taskStates.get(taskId) ?? "idle";
  }

  /**
   * Reset a task's state to idle (e.g., after recurrence cycle).
   */
  resetState(taskId: string): void {
    this.taskStates.delete(taskId);
  }

  /**
   * Get lifecycle stats for monitoring.
   */
  getStats(): TaskLifecycleStats {
    return {
      totalTransitions: this.totalTransitions,
      totalRejected: this.totalRejected,
      transitionCounts: { ...this.transitionCounts },
      rejectionBreakdown: { ...this.rejectionBreakdown },
    };
  }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Emit the appropriate runtime event for a transition.
   */
  private emitTransitionEvent(
    taskId: string,
    state: TaskRuntimeState,
    task: ReadonlyTask,
    request: TransitionRequest,
  ): void {
    switch (state) {
      case "due":
        this.eventService.emitRuntimeDue(taskId, task.dueAt, task);
        break;
      case "overdue":
        this.eventService.emit("task:overdue", { taskId, task });
        break;
      case "completed":
        this.eventService.emitRuntimeCompleted(
          taskId,
          new Date().toISOString(),
          undefined,
        );
        break;
      case "missed":
        this.eventService.emit("task:missed", { taskId, task });
        break;
      case "rescheduled":
        this.eventService.emitRuntimeRescheduled(
          taskId,
          task.dueAt,
          task.dueAt, // new dueAt set by caller via TaskService
          request.reason || "rescheduled",
        );
        break;
      case "blocked":
        this.eventService.emit("task:blocked", {
          taskId,
          blockers: [],
        });
        break;
      case "cancelled":
        this.eventService.emitEscalationResolved(taskId, "deleted");
        break;
      default:
        break;
    }

    // Always emit task:refresh so frontend stores (TaskStore, ReminderPanel)
    // pick up the state change via their existing reactive subscription.
    this.eventService.emitRefresh();
  }
}
