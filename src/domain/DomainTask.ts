/**
 * DomainTask — Canonical Immutable Task Entity
 *
 * The single source of truth for what a "task" IS in the domain layer.
 * Every field is deeply readonly. No mutation is possible after construction.
 *
 * Construction ONLY via:
 *   - TaskFactory.create()
 *   - TaskFactory.fromBlockAttrs()
 *   - TaskFactory.fromStorage()
 *   - TaskFactory.fromLegacy()
 *
 * Mutation ONLY via:
 *   - TaskLifecycleState.transition()  → returns NEW DomainTask
 *   - TaskFactory.applyTransition()    → returns NEW DomainTask
 *
 * Never:
 *   - task.status = "done"
 *   - task.dueAt = newDate
 *   - task.dependsOn.push()
 *   - Object.assign(task, ...)
 *
 * FORBIDDEN imports:
 *   ❌ Scheduler, Storage, EventBus, SiYuan API, DOM, Integration, Service
 *
 * Used by:
 *   - TaskLifecycleState (state machine transitions)
 *   - RecurrenceInstance (cloned child instances)
 *   - DependencyLink (graph edges)
 *   - TaskAnalytics (read-only analysis)
 *   - DomainMapper (persistence serialization)
 *   - QueryService (→ DTO projection for frontend)
 */

import type { Recurrence } from "./models/Recurrence";
import type { DomainVersion } from "./DomainVersion";
import type { TaskLifecycleStateValue } from "./TaskLifecycleState";
import type { DependencyLink } from "./DependencyLink";
import type { TaskAnalyticsSnapshot } from "./TaskAnalytics";

// ──────────────────────────────────────────────────────────────
// Value Types
// ──────────────────────────────────────────────────────────────

/** Branded type for task IDs — prevents accidental string substitution */
export type TaskId = string & { readonly __brand: "TaskId" };

/** ISO 8601 datetime string — branded for type safety */
export type ISODateString = string & { readonly __brand: "ISODateString" };

/** Task priority levels (aligned with Obsidian Tasks) */
export type TaskPriority = "highest" | "high" | "medium" | "normal" | "low" | "lowest";

/** Task status values — controlled by lifecycle transitions only */
export type TaskStatus = "todo" | "done" | "cancelled";

/** Completion action to take after task is done */
export type CompletionAction = "keep" | "delete" | "archive";

/** Custom completion action with extended behavior */
export interface OnCompletionAction {
  readonly action: CompletionAction;
  readonly nextStatus?: TaskStatus | string;
  readonly customHandler?: string;
}

/** Smart recurrence ML configuration */
export interface SmartRecurrenceConfig {
  readonly enabled: boolean;
  readonly autoAdjust: boolean;
  readonly minDataPoints: number;
  readonly confidenceThreshold: number;
}

/** Escalation policy level */
export interface EscalationLevel {
  readonly missCount: number;
  readonly action: "notify" | "escalate" | "disable";
  readonly channels?: readonly string[];
}

/** Escalation policy for missed tasks */
export interface EscalationPolicy {
  readonly enabled: boolean;
  readonly levels: readonly EscalationLevel[];
}

// ──────────────────────────────────────────────────────────────
// Core Entity
// ──────────────────────────────────────────────────────────────

/**
 * Immutable task entity.
 *
 * ALL fields are deeply readonly. Object.freeze() is applied at construction
 * time by TaskFactory to enforce runtime immutability.
 *
 * The domain task is split into semantic groups:
 *   1. Identity (immutable after creation)
 *   2. Lifecycle (controlled by TaskLifecycleState)
 *   3. Scheduling (dates, recurrence, timezone)
 *   4. Dependencies (links to other tasks)
 *   5. Organization (priority, tags, ordering)
 *   6. SiYuan binding (block ID, root doc, workspace)
 *   7. Analytics (read-only snapshot)
 *   8. Metadata (description, channels, etc.)
 *   9. Domain version + schema
 */
export interface DomainTask {
  // ══════ 1. Identity (IMMUTABLE) ══════════════════════════════

  /** Unique task identifier */
  readonly id: TaskId;

  /** Human-readable task name */
  readonly name: string;

  /** Schema version for migration */
  readonly version: DomainVersion;

  /** Creation timestamp */
  readonly createdAt: ISODateString;

  /** Last modification timestamp */
  readonly updatedAt: ISODateString;

  // ══════ 2. Lifecycle ═════════════════════════════════════════

  /** Current task status */
  readonly status: TaskStatus;

  /** Runtime lifecycle state (tracked by TaskLifecycleState) */
  readonly lifecycleState: TaskLifecycleStateValue;

  /** Whether task is active/enabled */
  readonly enabled: boolean;

  /** Completion timestamp */
  readonly doneAt?: ISODateString;

  /** Cancellation timestamp */
  readonly cancelledAt?: ISODateString;

  /** Checkbox symbol (for line-based tasks) */
  readonly statusSymbol?: string;

  /** Action to take when task is completed */
  readonly onCompletion?: CompletionAction | OnCompletionAction;

  // ══════ 3. Scheduling ════════════════════════════════════════

  /** Due date & time */
  readonly dueAt?: ISODateString;

  /** Scheduled date (when to work on it) */
  readonly scheduledAt?: ISODateString;

  /** Earliest date task can begin */
  readonly startAt?: ISODateString;

  /** IANA timezone for scheduling */
  readonly timezone?: string;

  /** RRule-based recurrence */
  readonly recurrence?: Recurrence;

  /** Human-readable recurrence text */
  readonly recurrenceText?: string;

  /** Calculate next recurrence from completion date */
  readonly whenDone?: boolean;

  /** Links recurring task instances in a series */
  readonly seriesId?: string;

  /** Which instance in recurring series (0-based) */
  readonly occurrenceIndex?: number;

  /** Smart recurrence config */
  readonly smartRecurrence?: SmartRecurrenceConfig;

  // ══════ 4. Dependencies ══════════════════════════════════════

  /** Task IDs this task depends on */
  readonly dependsOn?: readonly string[];

  /** Resolved dependency links (carries recurrence instance context) */
  readonly dependencyLinks?: readonly DependencyLink[];

  // ══════ 5. Organization ══════════════════════════════════════

  /** Task priority */
  readonly priority?: TaskPriority;

  /** Tags for categorization */
  readonly tags?: readonly string[];

  /** Category for grouping */
  readonly category?: string;

  /** Display order for manual ordering */
  readonly order?: number;

  // ══════ 6. SiYuan Binding ════════════════════════════════════

  /** Canonical SiYuan block ID */
  readonly blockId?: string;

  /** Root document ID containing this task's block */
  readonly rootId?: string;

  /** SiYuan workspace identifier */
  readonly workspaceId?: string;

  /** Timestamp of last block mutation (epoch ms) */
  readonly lastMutationTime?: number;

  /** File path (for path-based filtering) */
  readonly path?: string;

  /** Document heading/section where task is located */
  readonly heading?: string;

  // ══════ 7. Analytics (read-only snapshot) ════════════════════

  /** Analytics snapshot — never mutated, replaced wholesale */
  readonly analytics?: TaskAnalyticsSnapshot;

  // ══════ 8. Metadata ══════════════════════════════════════════

  /** Description/notes */
  readonly description?: string;

  /** Notification channels */
  readonly notificationChannels?: readonly string[];

  /** Escalation policy */
  readonly escalationPolicy?: EscalationPolicy;

  /** Snooze count for this occurrence */
  readonly snoozeCount?: number;

  /** Maximum allowed snoozes */
  readonly maxSnoozes?: number;

  // ══════ 9. Lossless Parsing ══════════════════════════════════

  /** Unrecognized line metadata preserved for lossless serialization */
  readonly unknownFields?: readonly string[];
}

// ──────────────────────────────────────────────────────────────
// Type Guards
// ──────────────────────────────────────────────────────────────

/** Type guard: is the value a valid DomainTask? */
export function isDomainTask(value: unknown): value is DomainTask {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.name === "string" &&
    typeof v.version === "number" &&
    typeof v.createdAt === "string" &&
    typeof v.updatedAt === "string" &&
    typeof v.status === "string" &&
    (v.status === "todo" || v.status === "done" || v.status === "cancelled") &&
    typeof v.lifecycleState === "string" &&
    typeof v.enabled === "boolean"
  );
}

/** Check if a DomainTask is in a terminal state (no further actions) */
export function isTerminal(task: DomainTask): boolean {
  return task.status === "done" || task.status === "cancelled";
}

/** Check if a DomainTask has recurrence */
export function isRecurring(task: DomainTask): boolean {
  return !!task.recurrence || !!task.recurrenceText;
}

/** Check if a DomainTask is overdue relative to a reference date */
export function isOverdue(task: DomainTask, now: Date = new Date()): boolean {
  if (!task.dueAt || isTerminal(task)) return false;
  return new Date(task.dueAt) < now;
}

/** Check if a DomainTask is blocked by dependencies */
export function isDependencyBlocked(task: DomainTask): boolean {
  return task.lifecycleState === "blocked";
}
