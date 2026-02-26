/**
 * TaskCompletionContext — Immutable Completion Context
 *
 * Captures the full context of a task completion event for:
 *   - Analytics recording (TaskAnalytics.recordCompletion)
 *   - Pattern learning (SmartSuggestionEngine)
 *   - Audit trail
 *
 * Created by TaskService when a task transitions to "completed".
 * Passed to TaskFactory.withAnalytics() for snapshot update.
 *
 * FORBIDDEN:
 *   ❌ Import Scheduler, Storage, EventBus, SiYuan API, DOM, Integration, Service
 *   ❌ Mutate any field after construction
 */

import type { TaskId, ISODateString } from "./DomainTask";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/**
 * Immutable context object produced when a task completes.
 *
 * Captures:
 *   - When it was completed
 *   - When it was due
 *   - Whether it was overdue
 *   - How long it was delayed
 *   - Environmental context (day, hour, etc.)
 */
export interface TaskCompletionContext {
  /** Task that was completed */
  readonly taskId: TaskId;

  /** Completion timestamp */
  readonly completedAt: ISODateString;

  /** Original due date (if any) */
  readonly scheduledFor?: ISODateString;

  /** Whether the task was overdue at completion time */
  readonly wasOverdue: boolean;

  /** Delay in minutes (positive = late, negative = early) */
  readonly delayMinutes: number;

  /** Day of week (0=Sun, 6=Sat) */
  readonly dayOfWeek: number;

  /** Hour of day (0-23) */
  readonly hourOfDay: number;

  /** Duration in minutes (if tracked) */
  readonly durationMinutes?: number;

  /** Tags at completion time (snapshot) */
  readonly tags?: readonly string[];

  /** Related block IDs at completion time (snapshot) */
  readonly relatedBlocks?: readonly string[];

  /** Recurrence instance ID (if part of a series) */
  readonly recurrenceInstanceId?: string;

  /** Occurrence index in series */
  readonly occurrenceIndex?: number;

  /** How many times the task was snoozed before completion */
  readonly snoozeCount?: number;

  /** Who/what triggered the completion */
  readonly completedBy: CompletionTrigger;
}

/** What triggered the completion */
export type CompletionTrigger =
  | "user"           // User clicked checkbox / mark done
  | "inline_toggle"  // Inline checkbox toggle in editor
  | "command"        // CompleteTaskCommand via command palette
  | "api"            // External API call
  | "automation"     // Automated rule / webhook
  | "system";        // System-initiated (e.g., auto-complete on block delete)

// ──────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────

/**
 * Create an immutable TaskCompletionContext from task data.
 *
 * Call at the moment of completion — captures current time context.
 */
export function createCompletionContext(params: {
  taskId: TaskId;
  scheduledFor?: string;
  tags?: readonly string[];
  relatedBlocks?: readonly string[];
  recurrenceInstanceId?: string;
  occurrenceIndex?: number;
  snoozeCount?: number;
  completedBy?: CompletionTrigger;
  durationMinutes?: number;
  now?: Date;
}): TaskCompletionContext {
  const now = params.now ?? new Date();
  const nowISO = now.toISOString() as ISODateString;

  let delayMinutes = 0;
  let wasOverdue = false;

  if (params.scheduledFor) {
    const scheduledDate = new Date(params.scheduledFor);
    delayMinutes = Math.round(
      (now.getTime() - scheduledDate.getTime()) / (1000 * 60),
    );
    wasOverdue = delayMinutes > 0;
  }

  const ctx: TaskCompletionContext = {
    taskId: params.taskId,
    completedAt: nowISO,
    scheduledFor: params.scheduledFor as ISODateString | undefined,
    wasOverdue,
    delayMinutes,
    dayOfWeek: now.getDay(),
    hourOfDay: now.getHours(),
    durationMinutes: params.durationMinutes,
    tags: params.tags ? [...params.tags] : undefined,
    relatedBlocks: params.relatedBlocks ? [...params.relatedBlocks] : undefined,
    recurrenceInstanceId: params.recurrenceInstanceId,
    occurrenceIndex: params.occurrenceIndex,
    snoozeCount: params.snoozeCount,
    completedBy: params.completedBy ?? "user",
  };

  return Object.freeze(ctx);
}

// ──────────────────────────────────────────────────────────────
// Type Guard
// ──────────────────────────────────────────────────────────────

export function isCompletionContext(value: unknown): value is TaskCompletionContext {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.taskId === "string" &&
    typeof v.completedAt === "string" &&
    typeof v.wasOverdue === "boolean" &&
    typeof v.delayMinutes === "number" &&
    typeof v.dayOfWeek === "number" &&
    typeof v.hourOfDay === "number" &&
    typeof v.completedBy === "string"
  );
}
