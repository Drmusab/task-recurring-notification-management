/**
 * recurrenceUtils — Pure Recurrence Instance Comparison
 *
 * Compares recurrence using RESOLVED INSTANCE TIMESTAMPS only.
 * Never compares parent recurrence templates directly.
 *
 * Prevents:
 *   - Recurring parent triggering again after instance resolve
 *   - Scheduler double-scheduling same instance
 *   - Cache believing two instances are the same
 *   - AI analyzing parent instead of instance
 *
 * PURE FUNCTIONS — no state, no side effects, no DOM access.
 *
 * FORBIDDEN:
 *   ❌ mutate model
 *   ❌ access storage
 *   ❌ fire event
 *   ❌ call integration
 *   ❌ parse markdown
 *   ❌ access DOM
 *   ❌ hold global state
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import { normalizeDueDate } from "./dateUtils";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** Unique key for a specific recurrence instance */
export type RecurrenceInstanceKey = string & { readonly __brand: "RecurrenceInstanceKey" };

/** Result of recurrence instance comparison */
export interface RecurrenceComparison {
  /** Whether the two instances represent the same occurrence */
  readonly isSameInstance: boolean;
  /** The instance key for task A (null if non-recurring) */
  readonly keyA: RecurrenceInstanceKey | null;
  /** The instance key for task B (null if non-recurring) */
  readonly keyB: RecurrenceInstanceKey | null;
}

/** Recurrence series identity */
export interface SeriesIdentity {
  /** Block ID of the recurrence parent */
  readonly blockId: string;
  /** Recurrence rule string (RRule/CronExpression) */
  readonly rule: string;
  /** Unique series key for dedup */
  readonly seriesKey: string;
}

// ──────────────────────────────────────────────────────────────
// Instance Key Generation
// ──────────────────────────────────────────────────────────────

/**
 * Generate a deterministic key for a specific recurrence instance.
 *
 * Key formula:  `{blockId}::{resolvedDueISO}`
 *
 * The KEY uses the resolved instance timestamp (task.dueAt after
 * RecurrenceResolver.resolveInstance()), NOT the parent template's
 * recurrence rule. This ensures each occurrence is uniquely identified.
 *
 * @param task  Task with resolved dueAt (post-RecurrenceResolver)
 * @returns Instance key, or null if task has no block or due date
 */
export function getRecurrenceInstanceKey(task: ReadonlyTask): RecurrenceInstanceKey | null {
  if (!task.blockId || !task.dueAt) return null;

  const normalizedDue = normalizeDueDate(task.dueAt, (task as any).timezone);
  if (!normalizedDue) return null;

  // Truncate to minute precision — sub-minute differences are noise
  const truncated = new Date(normalizedDue.getTime());
  truncated.setSeconds(0, 0);

  return `${task.blockId}::${truncated.toISOString()}` as RecurrenceInstanceKey;
}

/**
 * Generate instance key from raw components (for pre-computation).
 */
export function buildInstanceKey(
  blockId: string,
  dueAt: string | Date,
): RecurrenceInstanceKey | null {
  const normalized = normalizeDueDate(dueAt);
  if (!normalized) return null;

  const truncated = new Date(normalized.getTime());
  truncated.setSeconds(0, 0);

  return `${blockId}::${truncated.toISOString()}` as RecurrenceInstanceKey;
}

// ──────────────────────────────────────────────────────────────
// Instance Comparison
// ──────────────────────────────────────────────────────────────

/**
 * Compare two tasks to determine if they represent the same recurrence instance.
 *
 * Uses ONLY resolved instance timestamps. Never compares recurrence rules.
 */
export function compareRecurrenceInstances(
  taskA: ReadonlyTask,
  taskB: ReadonlyTask,
): RecurrenceComparison {
  const keyA = getRecurrenceInstanceKey(taskA);
  const keyB = getRecurrenceInstanceKey(taskB);

  return {
    isSameInstance: keyA !== null && keyB !== null && keyA === keyB,
    keyA,
    keyB,
  };
}

/**
 * Check if a task is a recurring task (has recurrence rule).
 */
export function isRecurringTask(task: ReadonlyTask): boolean {
  return !!(task.recurrence && task.recurrence.rrule && task.recurrence.rrule.trim().length > 0);
}

/**
 * Check if a task is a specific instance of a recurring series
 * (has both recurrence rule AND a resolved dueAt).
 */
export function isRecurrenceInstance(task: ReadonlyTask): boolean {
  return isRecurringTask(task) && !!task.dueAt;
}

// ──────────────────────────────────────────────────────────────
// Series Identity
// ──────────────────────────────────────────────────────────────

/**
 * Extract the recurrence series identity from a task.
 * The series key groups all instances of the same recurring task.
 *
 * Series key formula: `{blockId}::{recurrenceRule}`
 */
export function getSeriesIdentity(task: ReadonlyTask): SeriesIdentity | null {
  if (!task.blockId || !task.recurrence?.rrule) return null;

  const rule = task.recurrence.rrule.trim();
  if (rule.length === 0) return null;

  return {
    blockId: task.blockId,
    rule,
    seriesKey: `${task.blockId}::${rule}`,
  };
}

/**
 * Check if two tasks belong to the same recurrence series.
 */
export function isSameSeries(taskA: ReadonlyTask, taskB: ReadonlyTask): boolean {
  const seriesA = getSeriesIdentity(taskA);
  const seriesB = getSeriesIdentity(taskB);
  if (!seriesA || !seriesB) return false;
  return seriesA.seriesKey === seriesB.seriesKey;
}

// ──────────────────────────────────────────────────────────────
// Dedup Helpers
// ──────────────────────────────────────────────────────────────

/**
 * Deduplicate a list of tasks by recurrence instance key.
 * Non-recurring tasks pass through unchanged.
 * For recurring tasks with the same instance key, keeps the first occurrence.
 *
 * Returns a NEW array — never mutates input.
 */
export function deduplicateByInstance(tasks: readonly ReadonlyTask[]): ReadonlyTask[] {
  const seen = new Set<string>();
  const result: ReadonlyTask[] = [];

  for (const task of tasks) {
    const key = getRecurrenceInstanceKey(task);
    if (key === null) {
      // Non-recurring or no block — always include
      result.push(task);
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      result.push(task);
    }
  }

  return result;
}

/**
 * Deduplicate tasks by series (keeps only the latest instance per series).
 *
 * Returns a NEW array — never mutates input.
 */
export function deduplicateBySeries(tasks: readonly ReadonlyTask[]): ReadonlyTask[] {
  const seriesMap = new Map<string, ReadonlyTask>();
  const nonRecurring: ReadonlyTask[] = [];

  for (const task of tasks) {
    const series = getSeriesIdentity(task);
    if (!series) {
      nonRecurring.push(task);
      continue;
    }

    const existing = seriesMap.get(series.seriesKey);
    if (!existing) {
      seriesMap.set(series.seriesKey, task);
    } else {
      // Keep the one with the later dueAt
      const existingDue = normalizeDueDate(existing.dueAt);
      const candidateDue = normalizeDueDate(task.dueAt);
      if (candidateDue && (!existingDue || candidateDue.getTime() > existingDue.getTime())) {
        seriesMap.set(series.seriesKey, task);
      }
    }
  }

  return [...nonRecurring, ...seriesMap.values()];
}
