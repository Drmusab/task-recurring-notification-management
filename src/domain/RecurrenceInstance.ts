/**
 * RecurrenceInstance — Immutable Recurring Task Instance
 *
 * When a recurring task template produces a new occurrence, the scheduler
 * MUST NOT mutate the parent template. Instead it creates a new
 * RecurrenceInstance that:
 *
 *   1. Carries the resolved dueAt for this specific occurrence
 *   2. Preserves the seriesId linking back to the template
 *   3. Has its own occurrenceIndex
 *   4. Is fully immutable (Object.freeze)
 *   5. Can be promoted to a DomainTask via TaskFactory
 *
 * Lifecycle:
 *   RecurrenceResolver.resolveInstance(parentTask)
 *     → RecurrenceInstance.fromTemplate(parent, nextDate, index)
 *     → TaskFactory.fromRecurrenceInstance(instance)
 *     → DomainTask (frozen, independent lifecycle)
 *
 * RULES:
 *   ✔ Clone from RecurringTemplate — never mutate parent
 *   ✔ Produce new Immutable RecurrenceInstance
 *   ✔ Prevent parent mutation by Scheduler
 *   ✔ Prevent recurring children inheriting template dependency state
 *
 * FORBIDDEN:
 *   ❌ Import Scheduler, Storage, EventBus, SiYuan API, DOM, Integration, Service
 *   ❌ Mutate any field after construction
 *   ❌ Share mutable state with parent template
 */

import type { Recurrence } from "./models/Recurrence";
import type { DomainTask, TaskId, ISODateString, TaskPriority } from "./DomainTask";
import type { DomainVersion } from "./DomainVersion";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/**
 * Immutable instance produced from a recurring task template.
 *
 * The instance is a snapshot — it does NOT share any mutable references
 * with the parent template. Arrays are shallow-copied and frozen.
 */
export interface RecurrenceInstance {
  // ── Identity ──
  /** Unique instance ID (distinct from template ID) */
  readonly instanceId: TaskId;

  /** The template task ID this instance was produced from */
  readonly templateId: TaskId;

  /** Series ID linking all instances of this recurrence */
  readonly seriesId: string;

  /** 0-based index of this instance in the series */
  readonly occurrenceIndex: number;

  // ── Resolved Scheduling ──
  /** The resolved due date for THIS specific occurrence */
  readonly resolvedDueAt: ISODateString;

  /** The original template's dueAt (for reference/audit) */
  readonly templateDueAt?: ISODateString;

  /** Whether this was calculated from completion date (whenDone mode) */
  readonly basedOnCompletion: boolean;

  // ── Inherited (snapshot from template at creation time) ──
  /** Task name (inherited from template) */
  readonly name: string;

  /** Recurrence rule (inherited, frozen) */
  readonly recurrence: Recurrence;

  /** Human-readable recurrence text */
  readonly recurrenceText?: string;

  /** Priority (inherited from template) */
  readonly priority?: TaskPriority;

  /** Tags (shallow-copied, frozen) */
  readonly tags?: readonly string[];

  /** Category (inherited) */
  readonly category?: string;

  /** Block ID (inherited — same block) */
  readonly blockId?: string;

  /** Root document ID (inherited) */
  readonly rootId?: string;

  /** Workspace ID (inherited) */
  readonly workspaceId?: string;

  /** Timezone (inherited) */
  readonly timezone?: string;

  /** Smart recurrence config (inherited, frozen) */
  readonly smartRecurrence?: DomainTask["smartRecurrence"];

  /** Escalation policy (inherited, frozen) */
  readonly escalationPolicy?: DomainTask["escalationPolicy"];

  /** Notification channels (inherited, frozen) */
  readonly notificationChannels?: readonly string[];

  // ── Instance Metadata ──
  /** When this instance was created */
  readonly createdAt: ISODateString;

  /** Schema version */
  readonly version: DomainVersion;

  /** Whether the recurrence series has ended (no more instances) */
  readonly seriesEnded: boolean;

  /** Whether this instance is from the parent template itself */
  readonly isParentTemplate: boolean;
}

// ──────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────

/**
 * Create a new RecurrenceInstance from a parent template task.
 *
 * This function:
 *   1. Deep-copies all inherited fields (no shared refs)
 *   2. Assigns a new instanceId
 *   3. Sets resolvedDueAt
 *   4. Freezes the result
 *
 * The parent task is NEVER mutated.
 */
export function createRecurrenceInstance(params: {
  instanceId: TaskId;
  template: DomainTask;
  resolvedDueAt: ISODateString;
  occurrenceIndex: number;
  seriesEnded: boolean;
  basedOnCompletion: boolean;
}): RecurrenceInstance {
  const { instanceId, template, resolvedDueAt, occurrenceIndex, seriesEnded, basedOnCompletion } = params;

  const instance: RecurrenceInstance = {
    // Identity
    instanceId,
    templateId: template.id,
    seriesId: template.seriesId ?? template.id as string,
    occurrenceIndex,

    // Resolved scheduling
    resolvedDueAt,
    templateDueAt: template.dueAt,
    basedOnCompletion,

    // Inherited (snapshot — arrays are shallow-copied)
    name: template.name,
    recurrence: template.recurrence!,
    recurrenceText: template.recurrenceText,
    priority: template.priority,
    tags: template.tags ? [...template.tags] : undefined,
    category: template.category,
    blockId: template.blockId,
    rootId: template.rootId,
    workspaceId: template.workspaceId,
    timezone: template.timezone,
    smartRecurrence: template.smartRecurrence,
    escalationPolicy: template.escalationPolicy,
    notificationChannels: template.notificationChannels
      ? [...template.notificationChannels]
      : undefined,

    // Instance metadata
    createdAt: new Date().toISOString() as ISODateString,
    version: template.version,
    seriesEnded,
    isParentTemplate: false,
  };

  return Object.freeze(instance);
}

/**
 * Check whether a DomainTask is a recurring template (has recurrence, no parent).
 */
export function isRecurringTemplate(task: DomainTask): boolean {
  return !!task.recurrence && task.occurrenceIndex === undefined;
}

/**
 * Check whether a DomainTask is a produced instance (has seriesId + occurrenceIndex).
 */
export function isRecurrenceChild(task: DomainTask): boolean {
  return task.seriesId !== undefined && task.occurrenceIndex !== undefined;
}

// ──────────────────────────────────────────────────────────────
// Type Guard
// ──────────────────────────────────────────────────────────────

export function isRecurrenceInstance(value: unknown): value is RecurrenceInstance {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.instanceId === "string" &&
    typeof v.templateId === "string" &&
    typeof v.seriesId === "string" &&
    typeof v.occurrenceIndex === "number" &&
    typeof v.resolvedDueAt === "string" &&
    typeof v.name === "string" &&
    typeof v.createdAt === "string" &&
    typeof v.seriesEnded === "boolean"
  );
}
