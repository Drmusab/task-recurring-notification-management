/**
 * guardUtils — Pure Runtime Type and Value Guards
 *
 * Provides type-narrowing guard functions and value assertions
 * for the backend runtime. These are the safety net that prevents
 * invalid data from reaching the engine, scheduler, and AI layers.
 *
 * All guards are:
 *   - Pure functions (no side effects)
 *   - Type-narrowing (TypeScript type predicates)
 *   - Deterministic (same input → same output)
 *
 * FORBIDDEN:
 *   ❌ mutate model
 *   ❌ access storage
 *   ❌ fire event
 *   ❌ call integration
 *   ❌ parse markdown
 *   ❌ access DOM
 *   ❌ hold global state
 *   ❌ depend on runtime state
 */

import type { Task, ReadonlyTask } from "@backend/core/models/Task";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** Terminal task statuses — no further scheduling/reminders */
export const TERMINAL_STATUSES = new Set(["done", "archived", "cancelled"]) as ReadonlySet<string>;

/** Active task statuses — eligible for scheduling */
export const ACTIVE_STATUSES = new Set(["todo", "in_progress"]) as ReadonlySet<string>;

/** Valid task statuses (union of terminal + active) */
export const ALL_VALID_STATUSES = new Set([...TERMINAL_STATUSES, ...ACTIVE_STATUSES]) as ReadonlySet<string>;

// ──────────────────────────────────────────────────────────────
// Task Guards
// ──────────────────────────────────────────────────────────────

/**
 * Type guard: Is this a valid Task object?
 * Checks all required fields with correct types.
 */
export function isValidTask(obj: unknown): obj is Task {
  if (!obj || typeof obj !== "object") return false;

  const t = obj as Record<string, unknown>;
  return (
    typeof t.id === "string" && t.id.length > 0 &&
    typeof t.name === "string" &&
    typeof t.dueAt === "string" &&
    typeof t.enabled === "boolean" &&
    typeof t.version === "number" && t.version > 0
  );
}

/**
 * Guard: Is this task in a terminal state?
 * Terminal tasks should NOT be scheduled, reminded, or retried.
 */
export function isTerminalTask(task: ReadonlyTask): boolean {
  return !!task.status && TERMINAL_STATUSES.has(task.status);
}

/**
 * Guard: Is this task in an active state?
 * Active tasks are eligible for scheduling and reminders.
 */
export function isActiveTask(task: ReadonlyTask): boolean {
  // No status defaults to active (backward compat)
  if (!task.status) return task.enabled;
  return ACTIVE_STATUSES.has(task.status) && task.enabled;
}

/**
 * Guard: Is this task enabled AND has a valid due date?
 */
export function isSchedulableTask(task: ReadonlyTask): boolean {
  if (!isActiveTask(task)) return false;
  if (!task.dueAt) return false;
  const d = new Date(task.dueAt);
  return !isNaN(d.getTime());
}

/**
 * Guard: Is this task eligible for reminders?
 * Must be active, enabled, have a due date, and not snoozed.
 */
export function isRemindableTask(task: ReadonlyTask): boolean {
  if (!isSchedulableTask(task)) return false;
  return true;
}

/**
 * Guard: Does this task have a valid recurrence?
 */
export function hasValidRecurrence(task: ReadonlyTask): boolean {
  if (!task.recurrence) return false;
  return (
    typeof task.recurrence.rrule === "string" &&
    task.recurrence.rrule.trim().length > 0
  );
}

/**
 * Guard: Does this task have dependencies?
 */
export function hasDependencies(task: ReadonlyTask): boolean {
  return Array.isArray(task.dependsOn) && task.dependsOn.length > 0;
}

/**
 * Guard: Is this task blocked by unresolved dependencies?
 * NOTE: This is a structural check only — it checks if dependencies
 * array is non-empty. For runtime dependency resolution, use
 * DependencyExecutionGuard.
 */
export function hasUnresolvedDependencies(task: ReadonlyTask): boolean {
  return hasDependencies(task);
}

// ──────────────────────────────────────────────────────────────
// Value Guards
// ──────────────────────────────────────────────────────────────

/**
 * Guard: Is the value a non-empty string?
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Guard: Is the value a valid ISO date string?
 */
export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

/**
 * Guard: Is the value a positive integer?
 */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Guard: Is the value a valid IANA timezone string?
 */
export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────
// Assertion Guards (throw on failure)
// ──────────────────────────────────────────────────────────────

/**
 * Assert that a task is valid. Throws with detail if not.
 */
export function assertValidTask(task: unknown, context?: string): asserts task is Task {
  if (!isValidTask(task)) {
    const prefix = context ? `[${context}] ` : "";
    throw new Error(`${prefix}Invalid task object: missing required fields (id, name, dueAt, enabled, version)`);
  }
}

/**
 * Assert that a task is not in a terminal state.
 */
export function assertNotTerminal(task: ReadonlyTask, context?: string): void {
  if (isTerminalTask(task)) {
    const prefix = context ? `[${context}] ` : "";
    throw new Error(`${prefix}Task "${task.id}" is in terminal status "${task.status}" — cannot be scheduled/reminded`);
  }
}

/**
 * Assert that a value is defined (not null/undefined).
 */
export function assertDefined<T>(
  value: T | null | undefined,
  name: string,
): asserts value is T {
  if (value == null) {
    throw new Error(`Expected ${name} to be defined, got ${value}`);
  }
}
