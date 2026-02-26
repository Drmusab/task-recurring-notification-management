/**
 * comparisonUtils — Immutable Model Comparison
 *
 * All task comparison MUST use deepClone() before diffing.
 * Never compare task references — always compare value snapshots.
 *
 * Prevents:
 *   - Cache believing task is unchanged (reference equality trap)
 *   - AI analyzing stale state
 *   - Scheduler comparing mutated in-memory objects
 *   - Dependency graph using object identity instead of value equality
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

import type { ReadonlyTask, Task } from "@backend/core/models/Task";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** Result of a task diff */
export interface TaskDiffResult {
  /** Whether any fields changed */
  readonly hasChanges: boolean;
  /** List of field paths that differ */
  readonly changedFields: readonly string[];
  /** Whether a schedule-critical field changed (dueAt, recurrence, enabled, status) */
  readonly scheduleCritical: boolean;
  /** Whether a dependency-critical field changed (dependencies, blockId) */
  readonly dependencyCritical: boolean;
}

/** Fields that affect scheduling when changed */
const SCHEDULE_CRITICAL_FIELDS = new Set([
  "dueAt", "recurrence", "enabled", "status", "frequency", "timezone",
]);

/** Fields that affect dependency resolution when changed */
const DEPENDENCY_CRITICAL_FIELDS = new Set([
  "dependsOn", "blockId", "crossNoteDependencies",
]);

// ──────────────────────────────────────────────────────────────
// Deep Clone
// ──────────────────────────────────────────────────────────────

/**
 * Deep clone a task object.
 *
 * Uses structuredClone where available, falling back to
 * JSON round-trip. The Task model uses only JSON-safe types
 * (strings, numbers, booleans, arrays, plain objects) so
 * JSON round-trip is safe.
 *
 * Returns a completely independent copy — mutations to the
 * clone never affect the original.
 */
export function deepCloneTask<T extends Task | ReadonlyTask>(task: T): T {
  // structuredClone is available in all modern runtimes (Node 17+, browsers 2022+)
  if (typeof structuredClone === "function") {
    return structuredClone(task);
  }
  // Fallback: JSON round-trip (safe for Task's JSON-only types)
  return JSON.parse(JSON.stringify(task)) as T;
}

/**
 * Deep clone any plain object (arrays, maps serialized as objects, etc.).
 * For use with non-Task data that also needs immutable comparison.
 */
export function deepClone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

// ──────────────────────────────────────────────────────────────
// Comparison
// ──────────────────────────────────────────────────────────────

/**
 * Compare two tasks by VALUE, not reference.
 *
 * Both inputs are deep-cloned internally before comparison
 * so the caller's objects are never read after clone.
 *
 * @returns true if the tasks are value-equal (all fields match)
 */
export function areTasksEqual(a: ReadonlyTask, b: ReadonlyTask): boolean {
  // Fast path: same reference
  if (a === b) return true;
  // Fast path: different IDs means definitely different
  if (a.id !== b.id) return false;

  // Value comparison via JSON (Task model is JSON-safe)
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compute a detailed diff between two task snapshots.
 *
 * Compares top-level fields only (sufficient for Task model).
 * Deep-clones both inputs internally.
 */
export function diffTasks(
  before: ReadonlyTask,
  after: ReadonlyTask,
): TaskDiffResult {
  const cloneA = deepCloneTask(before);
  const cloneB = deepCloneTask(after);
  const changedFields: string[] = [];

  // Collect all keys from both
  const allKeys = new Set([
    ...Object.keys(cloneA as Record<string, unknown>),
    ...Object.keys(cloneB as Record<string, unknown>),
  ]);

  for (const key of allKeys) {
    const valA = (cloneA as Record<string, unknown>)[key];
    const valB = (cloneB as Record<string, unknown>)[key];

    if (!valuesEqual(valA, valB)) {
      changedFields.push(key);
    }
  }

  return {
    hasChanges: changedFields.length > 0,
    changedFields,
    scheduleCritical: changedFields.some((f) => SCHEDULE_CRITICAL_FIELDS.has(f)),
    dependencyCritical: changedFields.some((f) => DEPENDENCY_CRITICAL_FIELDS.has(f)),
  };
}

/**
 * Check if a task has changed relative to a cached snapshot.
 * Quick check — only tests schedule-critical fields for performance.
 */
export function hasScheduleRelevantChanges(
  cached: ReadonlyTask,
  current: ReadonlyTask,
): boolean {
  for (const field of SCHEDULE_CRITICAL_FIELDS) {
    const a = (cached as Record<string, unknown>)[field];
    const b = (current as Record<string, unknown>)[field];
    if (!valuesEqual(a, b)) return true;
  }
  return false;
}

/**
 * Create an immutable snapshot of a task for cache comparison.
 * The snapshot is a deep clone frozen at creation time.
 */
export function createTaskSnapshot(task: ReadonlyTask): Readonly<Task> {
  return Object.freeze(deepCloneTask(task)) as Readonly<Task>;
}

// ──────────────────────────────────────────────────────────────
// Dependency Comparison
// ──────────────────────────────────────────────────────────────

/**
 * Compare two dependency arrays by VALUE.
 * Order-independent — sorts before comparing.
 */
export function areDependenciesEqual(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  const sortedA = [...a].sort();
  const sortedB = [...b].sort();

  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────
// Internal
// ──────────────────────────────────────────────────────────────

/**
 * Deep value equality for JSON-safe types.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return a === b;
}
