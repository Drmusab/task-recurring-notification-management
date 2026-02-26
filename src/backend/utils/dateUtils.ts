/**
 * dateUtils — Pure Runtime Date Normalization Functions
 *
 * ALL runtime date comparison in the plugin MUST flow through these
 * functions. They delegate to TimezoneHandler.normalize() for
 * UTC-anchored comparison and never use raw `new Date(task.due)`.
 *
 * Prevents:
 *   - Overdue loop (local vs UTC mismatch)
 *   - Recurrence drift (inconsistent base date)
 *   - Reminder delay (timezone offset ignored)
 *   - AI urgency misfire (stale/wrong timestamp)
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

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** Normalized date result from task.dueAt */
export interface NormalizedDate {
  /** UTC-anchored Date object (never null when valid) */
  readonly date: Date;
  /** Original raw value from task model */
  readonly raw: string | number | Date;
  /** Whether timezone conversion was applied */
  readonly timezoneApplied: boolean;
}

/** Overdue classification */
export type OverdueLevel = "not_overdue" | "due_today" | "overdue_1d" | "overdue_3d" | "overdue_7d" | "overdue_critical";

/** Time-until result */
export interface TimeUntil {
  readonly totalMs: number;
  readonly minutes: number;
  readonly hours: number;
  readonly days: number;
  readonly isPast: boolean;
}

// ──────────────────────────────────────────────────────────────
// Core Normalization
// ──────────────────────────────────────────────────────────────

/**
 * Normalize a raw due-date value to a UTC-anchored Date.
 *
 * This is the ONLY correct way to convert task.dueAt for comparison.
 * Mirrors TimezoneHandler.normalize() but as a pure function.
 *
 * @param dueAt  Raw value from task.dueAt (ISO string, epoch ms, or Date)
 * @param taskTimezone  Optional IANA timezone from task model
 * @returns Normalized Date or null if unparseable
 */
export function normalizeDueDate(
  dueAt: string | number | Date | undefined | null,
  taskTimezone?: string,
): Date | null {
  if (dueAt == null) return null;

  let date: Date;
  if (dueAt instanceof Date) {
    date = new Date(dueAt.getTime()); // clone — never mutate input
  } else if (typeof dueAt === "number") {
    date = new Date(dueAt);
  } else {
    date = new Date(dueAt);
  }

  if (isNaN(date.getTime())) return null;

  // If task carries its own timezone, shift to local-equivalent
  if (taskTimezone) {
    return shiftToTimezone(date, taskTimezone);
  }

  return date;
}

/**
 * Normalize task.dueAt with full metadata.
 */
export function normalizeDueDateFull(
  dueAt: string | number | Date | undefined | null,
  taskTimezone?: string,
): NormalizedDate | null {
  if (dueAt == null) return null;

  const date = normalizeDueDate(dueAt, taskTimezone);
  if (!date) return null;

  return {
    date,
    raw: dueAt,
    timezoneApplied: !!taskTimezone,
  };
}

/**
 * Extract and normalize the due date from a ReadonlyTask.
 * Convenience wrapper for the most common use case.
 */
export function getTaskDueDate(task: ReadonlyTask): Date | null {
  return normalizeDueDate(task.dueAt, (task as any).timezone);
}

// ──────────────────────────────────────────────────────────────
// Comparison (all use normalized dates)
// ──────────────────────────────────────────────────────────────

/**
 * Check if a normalized date is today (local time).
 * Uses day-level comparison to avoid off-by-one from timezone.
 */
export function isDueToday(dueAt: Date, now?: Date): boolean {
  const ref = now ?? new Date();
  return (
    dueAt.getFullYear() === ref.getFullYear() &&
    dueAt.getMonth() === ref.getMonth() &&
    dueAt.getDate() === ref.getDate()
  );
}

/**
 * Check if a normalized date is in the past.
 */
export function isDuePast(dueAt: Date, now?: Date): boolean {
  return dueAt.getTime() < (now ?? new Date()).getTime();
}

/**
 * Check if a normalized date is overdue (past AND not today).
 */
export function isDueOverdue(dueAt: Date, now?: Date): boolean {
  const ref = now ?? new Date();
  return isDuePast(dueAt, ref) && !isDueToday(dueAt, ref);
}

/**
 * Classify overdue severity.
 */
export function classifyOverdue(dueAt: Date, now?: Date): OverdueLevel {
  const ref = now ?? new Date();
  if (!isDuePast(dueAt, ref)) return "not_overdue";
  if (isDueToday(dueAt, ref)) return "due_today";

  const diffMs = ref.getTime() - dueAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 1) return "overdue_1d";
  if (diffDays <= 3) return "overdue_3d";
  if (diffDays <= 7) return "overdue_7d";
  return "overdue_critical";
}

/**
 * Compute time remaining until a due date.
 */
export function timeUntilDue(dueAt: Date, now?: Date): TimeUntil {
  const ref = now ?? new Date();
  const totalMs = dueAt.getTime() - ref.getTime();
  const absTotalMs = Math.abs(totalMs);

  return {
    totalMs,
    minutes: Math.floor(absTotalMs / (1000 * 60)),
    hours: Math.floor(absTotalMs / (1000 * 60 * 60)),
    days: Math.floor(absTotalMs / (1000 * 60 * 60 * 24)),
    isPast: totalMs < 0,
  };
}

/**
 * Compare two due dates for sort order.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 * Null dates sort last.
 */
export function compareDueDates(
  a: Date | null | undefined,
  b: Date | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;  // null sorts last
  if (b == null) return -1;
  return a.getTime() - b.getTime();
}

// ──────────────────────────────────────────────────────────────
// Day Boundaries (pure, timezone-safe)
// ──────────────────────────────────────────────────────────────

/**
 * Get start of local day (00:00:00.000).
 * Returns a NEW Date — never mutates input.
 */
export function startOfLocalDay(date?: Date): Date {
  const d = date ? new Date(date.getTime()) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of local day (23:59:59.999).
 * Returns a NEW Date — never mutates input.
 */
export function endOfLocalDay(date?: Date): Date {
  const d = date ? new Date(date.getTime()) : new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Check if two dates fall on the same calendar day (local time).
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ──────────────────────────────────────────────────────────────
// ISO String Helpers (pure)
// ──────────────────────────────────────────────────────────────

/**
 * Safe ISO string conversion. Returns null for invalid dates.
 */
export function safeToISOString(date: Date | string | number | null | undefined): string | null {
  if (date == null) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Parse an ISO string safely. Returns null for garbage input.
 */
export function safeParseISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}

// ──────────────────────────────────────────────────────────────
// Internal Helpers
// ──────────────────────────────────────────────────────────────

/**
 * Shift a Date into a target timezone using Intl.DateTimeFormat.
 * Mirrors TimezoneHandler.toTimezone() as a pure function.
 */
function shiftToTimezone(date: Date, timezone: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes): number =>
      parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
    return new Date(
      get("year"), get("month") - 1, get("day"),
      get("hour"), get("minute"), get("second"),
    );
  } catch {
    // Invalid timezone — return clone as-is
    return new Date(date.getTime());
  }
}
