/**
 * TaskLifecycleState — Pure Domain State Machine
 *
 * Defines the canonical task runtime state machine with:
 *   - All valid states
 *   - All valid transitions (source → target)
 *   - Transition validation (pure function, no side effects)
 *   - State derivation from task data
 *
 * This is a PURE DOMAIN module — no imports from backend, services, storage,
 * scheduler, event bus, or SiYuan API.
 *
 * The backend `TaskLifecycle` service USES these domain rules
 * but adds runtime validation gates (dependency guard, block validator, etc.).
 *
 * Usage:
 *   import { canTransition, applyTransition } from "@domain/TaskLifecycleState";
 *
 *   if (canTransition(currentState, "completed")) {
 *     const newTask = applyTransition(task, "completed", context);
 *   }
 *
 * FORBIDDEN:
 *   ❌ Import Scheduler, Storage, EventBus, SiYuan API, DOM, Integration, Service
 *   ❌ Emit events (that's the backend's job)
 *   ❌ Mutate any object (all functions return NEW objects)
 */

import type {
  DomainTask,
  ISODateString,
  TaskStatus,
} from "./DomainTask";
import type { TaskCompletionContext } from "./TaskCompletionContext";

// ──────────────────────────────────────────────────────────────
// State Values
// ──────────────────────────────────────────────────────────────

/**
 * All valid runtime lifecycle states for a task.
 *
 * State descriptions:
 *   idle        → Not yet due, waiting
 *   due         → dueAt ≤ now, ready for action
 *   overdue     → Past due + grace, still actionable
 *   missed      → Past due + max grace, counted as miss
 *   completed   → User marked done
 *   rescheduled → User delayed to new date
 *   blocked     → Dependency guard blocked execution
 *   cancelled   → Final state — no further transitions
 */
export type TaskLifecycleStateValue =
  | "idle"
  | "due"
  | "overdue"
  | "missed"
  | "completed"
  | "rescheduled"
  | "blocked"
  | "cancelled";

/**
 * All valid transition action names.
 *
 * These map 1:1 to the `task:runtime:*` events emitted by the backend.
 */
export type TransitionAction =
  | "activate"       // idle → due
  | "expire"         // due → overdue
  | "miss"           // due/overdue → missed
  | "complete"       // due/overdue/missed → completed
  | "reschedule"     // due/overdue/missed → rescheduled
  | "block"          // idle/due/overdue → blocked
  | "unblock"        // blocked → due/overdue
  | "cancel"         // * → cancelled
  | "reset";         // completed → idle (for next recurrence cycle)

// ──────────────────────────────────────────────────────────────
// Transition Table
// ──────────────────────────────────────────────────────────────

/**
 * Valid transitions: source state → set of allowed target states.
 *
 * This is the canonical, authoritative definition of the task state machine.
 * The backend `TaskLifecycle` service and `TaskFactory.applyTransition()`
 * both delegate to this table.
 */
export const VALID_TRANSITIONS: Readonly<Record<TaskLifecycleStateValue, ReadonlySet<TaskLifecycleStateValue>>> = {
  idle:        new Set(["due", "blocked", "cancelled"]),
  due:         new Set(["completed", "missed", "overdue", "blocked", "rescheduled", "cancelled"]),
  overdue:     new Set(["completed", "missed", "blocked", "rescheduled", "cancelled"]),
  missed:      new Set(["completed", "rescheduled", "cancelled"]),
  completed:   new Set(["idle"]),      // only back to idle for next recurrence cycle
  rescheduled: new Set(["due", "overdue", "blocked", "cancelled"]),
  blocked:     new Set(["due", "overdue", "cancelled"]),
  cancelled:   new Set([]),            // terminal — no further transitions
};

/**
 * Map from transition action → target state.
 */
export const ACTION_TARGET_MAP: Readonly<Record<TransitionAction, TaskLifecycleStateValue>> = {
  activate:   "due",
  expire:     "overdue",
  miss:       "missed",
  complete:   "completed",
  reschedule: "rescheduled",
  block:      "blocked",
  unblock:    "due",
  cancel:     "cancelled",
  reset:      "idle",
};

// ──────────────────────────────────────────────────────────────
// Terminal & Active Helpers
// ──────────────────────────────────────────────────────────────

/** Terminal states — no further transitions possible */
export const TERMINAL_STATES: ReadonlySet<TaskLifecycleStateValue> = new Set(["cancelled"]);

/** States that represent an active, actionable task */
export const ACTIVE_STATES: ReadonlySet<TaskLifecycleStateValue> = new Set([
  "idle", "due", "overdue", "rescheduled", "blocked",
]);

/** States that trigger analytics recording */
export const ANALYTICS_TRIGGER_STATES: ReadonlySet<TaskLifecycleStateValue> = new Set([
  "completed", "missed",
]);

/** States that must NOT trigger analytics (prevent false urgency) */
export const ANALYTICS_EXCLUDED_STATES: ReadonlySet<TaskLifecycleStateValue> = new Set([
  "rescheduled", "blocked",
]);

// ──────────────────────────────────────────────────────────────
// Pure Functions
// ──────────────────────────────────────────────────────────────

/**
 * Check if a transition from `source` to `target` is valid.
 *
 * Pure function — no side effects.
 */
export function canTransition(
  source: TaskLifecycleStateValue,
  target: TaskLifecycleStateValue,
): boolean {
  const allowed = VALID_TRANSITIONS[source];
  return allowed ? allowed.has(target) : false;
}

/**
 * Check if a transition action is valid from the given state.
 */
export function canApplyAction(
  source: TaskLifecycleStateValue,
  action: TransitionAction,
): boolean {
  const target = ACTION_TARGET_MAP[action];
  return canTransition(source, target);
}

/**
 * Derive the TaskStatus from a lifecycle state.
 *
 * Mapping:
 *   completed → "done"
 *   cancelled → "cancelled"
 *   everything else → "todo"
 */
export function deriveStatus(state: TaskLifecycleStateValue): TaskStatus {
  switch (state) {
    case "completed": return "done";
    case "cancelled": return "cancelled";
    default: return "todo";
  }
}

/**
 * Derive the lifecycle state from task data (for initialization).
 *
 * Used when loading from storage — the task has status/dates but no
 * runtime state yet. This function derives the initial state.
 */
export function deriveLifecycleState(
  status: TaskStatus,
  dueAt?: string,
  now: Date = new Date(),
): TaskLifecycleStateValue {
  if (status === "done") return "completed";
  if (status === "cancelled") return "cancelled";

  if (!dueAt) return "idle";

  const due = new Date(dueAt);
  if (due <= now) return "due";

  return "idle";
}

// ──────────────────────────────────────────────────────────────
// Transition Result
// ──────────────────────────────────────────────────────────────

export interface TransitionResult {
  /** Whether the transition was valid and applied */
  readonly success: boolean;
  /** The new immutable task (or the original if transition rejected) */
  readonly task: DomainTask;
  /** The new lifecycle state (if success) */
  readonly newState?: TaskLifecycleStateValue;
  /** Rejection reason (if !success) */
  readonly rejectionReason?: string;
}

/**
 * Apply a pure domain transition to a DomainTask.
 *
 * Returns a NEW DomainTask with updated state, status, and timestamps.
 * The original task is NEVER mutated.
 *
 * This function does NOT:
 *   - Check dependency guards (that's backend's job)
 *   - Validate block attributes (that's backend's job)
 *   - Emit events (that's backend's job)
 *   - Persist anything (that's storage's job)
 *
 * It ONLY checks the state machine transition table.
 */
export function applyTransition(
  task: DomainTask,
  action: TransitionAction,
  context?: {
    /** New due date for reschedule */
    newDueAt?: ISODateString;
    /** Completion context for analytics */
    completionContext?: TaskCompletionContext;
    /** Override timestamp */
    now?: Date;
  },
): TransitionResult {
  const currentState = task.lifecycleState;
  const targetState = ACTION_TARGET_MAP[action];

  // Validate transition
  if (!canTransition(currentState, targetState)) {
    return {
      success: false,
      task,
      rejectionReason: `Invalid transition: ${currentState} → ${targetState} (action: ${action})`,
    };
  }

  const now = context?.now ?? new Date();
  const nowISO = now.toISOString() as ISODateString;
  const newStatus = deriveStatus(targetState);

  // Build the new task (shallow clone with overrides)
  const base: DomainTask = {
    ...task,
    lifecycleState: targetState,
    status: newStatus,
    updatedAt: nowISO,
  };

  // Apply action-specific mutations
  let result: DomainTask;

  switch (action) {
    case "complete":
      result = {
        ...base,
        doneAt: nowISO,
        enabled: false,
        // Analytics snapshot will be updated by TaskFactory.withAnalytics()
      };
      break;

    case "cancel":
      result = {
        ...base,
        cancelledAt: nowISO,
        enabled: false,
      };
      break;

    case "reschedule":
      result = {
        ...base,
        dueAt: context?.newDueAt ?? task.dueAt,
        snoozeCount: (task.snoozeCount ?? 0) + 1,
      };
      break;

    case "reset":
      result = {
        ...base,
        doneAt: undefined,
        cancelledAt: undefined,
        enabled: true,
        snoozeCount: 0,
      };
      break;

    case "block":
      result = {
        ...base,
        enabled: true, // still enabled, just blocked
      };
      break;

    case "unblock":
      result = {
        ...base,
        enabled: true,
      };
      break;

    default:
      result = base;
      break;
  }

  // Object.freeze for runtime immutability enforcement
  return {
    success: true,
    task: Object.freeze(result),
    newState: targetState,
  };
}

/**
 * Get all valid transition actions from the current state.
 */
export function getAvailableActions(state: TaskLifecycleStateValue): readonly TransitionAction[] {
  const targets = VALID_TRANSITIONS[state];
  if (!targets || targets.size === 0) return [];

  return (Object.entries(ACTION_TARGET_MAP) as [TransitionAction, TaskLifecycleStateValue][])
    .filter(([, target]) => targets.has(target))
    .map(([action]) => action);
}
