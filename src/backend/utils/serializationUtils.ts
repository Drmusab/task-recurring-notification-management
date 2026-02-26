/**
 * serializationUtils — Schema-Safe Task Serialization Guard
 *
 * Validates schema BEFORE TaskStorage.save(). Rejects:
 *   - Invalid recurrence (missing rrule when recurrence present)
 *   - Missing required fields (id, name, dueAt, enabled, version)
 *   - Outdated version (below minimum)
 *   - Invalid dependency references
 *   - Invalid status values
 *   - Corrupt ISO dates
 *
 * Prevents:
 *   - Migration corruption from saving malformed tasks
 *   - Storage pollution from invalid data
 *   - Scheduler crash from deserializing garbage
 *   - Version rollback from overwriting newer schema
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

import type { Task, ReadonlyTask } from "@backend/core/models/Task";
import { CURRENT_SCHEMA_VERSION } from "@shared/constants/misc-constants";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** Validation result */
export interface SerializationValidation {
  readonly valid: boolean;
  readonly errors: readonly SerializationError[];
  /** Task can be saved (valid || all errors are warnings) */
  readonly canSave: boolean;
}

/** Individual validation error */
export interface SerializationError {
  readonly field: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

/** Serialization options */
export interface SerializeOptions {
  /** Validate before serializing (default: true) */
  readonly validate?: boolean;
  /** Reject tasks with version below this (default: 1) */
  readonly minVersion?: number;
  /** Strip undefined fields from output (default: true) */
  readonly stripUndefined?: boolean;
}

// ──────────────────────────────────────────────────────────────
// Valid Values
// ──────────────────────────────────────────────────────────────

const VALID_STATUSES = new Set(["todo", "done", "cancelled", "in_progress"]);

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// ──────────────────────────────────────────────────────────────
// Schema Validation
// ──────────────────────────────────────────────────────────────

/**
 * Validate a task against the schema before saving.
 *
 * This is the pre-save gate. Call it before TaskStorage.save().
 *
 * @param task  Task to validate
 * @param options  Validation options
 * @returns Validation result with error details
 */
export function validateForSave(
  task: ReadonlyTask | Task,
  options?: SerializeOptions,
): SerializationValidation {
  const errors: SerializationError[] = [];
  const minVersion = options?.minVersion ?? 1;

  // ── Required fields ──
  if (!task.id || typeof task.id !== "string" || task.id.length === 0) {
    errors.push({ field: "id", message: "Task ID is required and must be a non-empty string", severity: "error" });
  }

  if (!task.name || typeof task.name !== "string") {
    errors.push({ field: "name", message: "Task name is required and must be a string", severity: "error" });
  }

  if (typeof task.dueAt !== "string") {
    errors.push({ field: "dueAt", message: "dueAt must be an ISO date string", severity: "error" });
  } else if (!isValidISODate(task.dueAt)) {
    errors.push({ field: "dueAt", message: `dueAt is not a valid ISO date: "${task.dueAt}"`, severity: "error" });
  }

  if (typeof task.enabled !== "boolean") {
    errors.push({ field: "enabled", message: "enabled must be a boolean", severity: "error" });
  }

  // ── Version ──
  if (typeof task.version !== "number" || task.version < minVersion) {
    errors.push({
      field: "version",
      message: `version must be ≥ ${minVersion}, got: ${task.version}`,
      severity: "error",
    });
  }

  // ── Status (optional but must be valid when present) ──
  if (task.status !== undefined && !VALID_STATUSES.has(task.status)) {
    errors.push({
      field: "status",
      message: `Invalid status: "${task.status}". Must be one of: ${[...VALID_STATUSES].join(", ")}`,
      severity: "error",
    });
  }

  // ── Recurrence (if present, must have valid rrule) ──
  if (task.recurrence) {
    if (!task.recurrence.rrule || typeof task.recurrence.rrule !== "string" || task.recurrence.rrule.trim().length === 0) {
      errors.push({
        field: "recurrence.rrule",
        message: "Recurrence object must have a non-empty rrule string",
        severity: "error",
      });
    }
    if (typeof task.recurrence.baseOnToday !== "boolean") {
      errors.push({
        field: "recurrence.baseOnToday",
        message: "Recurrence must have a boolean baseOnToday field",
        severity: "warning",
      });
    }
  }

  // ── Dependencies (if present, must be array of strings) ──
  if (task.dependsOn !== undefined) {
    if (!Array.isArray(task.dependsOn)) {
      errors.push({
        field: "dependsOn",
        message: "dependsOn must be an array",
        severity: "error",
      });
    } else {
      for (let i = 0; i < task.dependsOn.length; i++) {
        const dep = task.dependsOn[i];
        if (typeof dep !== "string" || dep.length === 0) {
          errors.push({
            field: `dependsOn[${i}]`,
            message: `dependency at index ${i} must be a non-empty string`,
            severity: "error",
          });
        }
      }
    }
  }

  // ── ISO date fields (optional but must be valid when present) ──
  const optionalDateFields = [
    "lastCompletedAt", "createdAt", "updatedAt",
    "doneAt",
  ] as const;
  for (const field of optionalDateFields) {
    const value = (task as Record<string, unknown>)[field];
    if (value !== undefined && value !== null && typeof value === "string") {
      if (!isValidISODate(value)) {
        errors.push({
          field,
          message: `${field} is not a valid ISO date: "${value}"`,
          severity: "warning",
        });
      }
    }
  }

  // ── Version freshness warning ──
  if (typeof task.version === "number" && task.version < CURRENT_SCHEMA_VERSION) {
    errors.push({
      field: "version",
      message: `Task version ${task.version} is below current schema ${CURRENT_SCHEMA_VERSION} — may need migration`,
      severity: "warning",
    });
  }

  const fatalErrors = errors.filter((e) => e.severity === "error");

  return {
    valid: fatalErrors.length === 0,
    errors,
    canSave: fatalErrors.length === 0,
  };
}

// ──────────────────────────────────────────────────────────────
// Safe Serialization
// ──────────────────────────────────────────────────────────────

/**
 * Serialize a task to a JSON string with optional validation.
 *
 * This is safer than raw JSON.stringify because it:
 *   1. Validates schema first (optional)
 *   2. Strips undefined values
 *   3. Catches serialization errors
 *
 * @returns JSON string, or null if validation failed
 */
export function serializeTask(
  task: ReadonlyTask | Task,
  options?: SerializeOptions,
): string | null {
  const shouldValidate = options?.validate !== false;

  if (shouldValidate) {
    const validation = validateForSave(task, options);
    if (!validation.canSave) return null;
  }

  try {
    if (options?.stripUndefined !== false) {
      return JSON.stringify(task, undefinedReplacer);
    }
    return JSON.stringify(task);
  } catch {
    return null;
  }
}

/**
 * Deserialize a JSON string to a Task with validation.
 *
 * @returns Parsed Task, or null if invalid
 */
export function deserializeTask(json: string): Task | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;

    const validation = validateForSave(parsed as Task);
    if (!validation.canSave) return null;

    return parsed as Task;
  } catch {
    return null;
  }
}

/**
 * Batch validate an array of tasks.
 * Returns tasks grouped by validity.
 */
export function validateBatch(
  tasks: readonly (ReadonlyTask | Task)[],
  options?: SerializeOptions,
): { valid: ReadonlyTask[]; invalid: Array<{ task: ReadonlyTask; errors: readonly SerializationError[] }> } {
  const valid: ReadonlyTask[] = [];
  const invalid: Array<{ task: ReadonlyTask; errors: readonly SerializationError[] }> = [];

  for (const task of tasks) {
    const result = validateForSave(task, options);
    if (result.canSave) {
      valid.push(task);
    } else {
      invalid.push({ task, errors: result.errors });
    }
  }

  return { valid, invalid };
}

// ──────────────────────────────────────────────────────────────
// Internal
// ──────────────────────────────────────────────────────────────

/**
 * JSON replacer that strips undefined values.
 */
function undefinedReplacer(_key: string, value: unknown): unknown {
  return value === undefined ? undefined : value;
}

/**
 * Validate an ISO date string.
 */
function isValidISODate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}
