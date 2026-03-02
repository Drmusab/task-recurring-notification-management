/**
 * Domain Error Hierarchy — Typed error classes for the task domain.
 *
 * All domain-level errors extend `DomainError` as the base.
 * Each error carries structured context (not just a message string)
 * for use in error boundaries, logging, and event emission.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Pure domain — no imports from backend, services, infrastructure
 *   ✔ Each error captures relevant IDs and context
 *   ✔ Serializable (no circular references in data)
 *   ✔ name property set for reliable instanceof checks across bundles
 */

// ──────────────────────────────────────────────────────────────
// Base Error
// ──────────────────────────────────────────────────────────────

/**
 * Base class for all domain errors.
 * Provides a `code` for programmatic matching and `context` for debugging.
 */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

// ──────────────────────────────────────────────────────────────
// Task Errors
// ──────────────────────────────────────────────────────────────

/**
 * Thrown when a task lookup fails (by ID, blockId, or seriesId).
 */
export class TaskNotFoundError extends DomainError {
  readonly taskId: string;

  constructor(taskId: string) {
    super("TASK_NOT_FOUND", `Task not found: ${taskId}`);
    this.name = "TaskNotFoundError";
    this.taskId = taskId;
  }
}

/**
 * Thrown when a task mutation is attempted on a task in an invalid state.
 * E.g. completing an already-cancelled task.
 */
export class InvalidTaskStateError extends DomainError {
  readonly taskId: string;
  readonly currentState: string;
  readonly attemptedAction: string;

  constructor(taskId: string, currentState: string, attemptedAction: string) {
    super(
      "INVALID_TASK_STATE",
      `Cannot ${attemptedAction} task ${taskId}: current state is ${currentState}`,
    );
    this.name = "InvalidTaskStateError";
    this.taskId = taskId;
    this.currentState = currentState;
    this.attemptedAction = attemptedAction;
  }
}

/**
 * Thrown when task creation parameters fail validation.
 */
export class TaskValidationError extends DomainError {
  readonly field: string;
  readonly reason: string;

  constructor(field: string, reason: string) {
    super("TASK_VALIDATION", `Task validation failed [${field}]: ${reason}`);
    this.name = "TaskValidationError";
    this.field = field;
    this.reason = reason;
  }
}

// ──────────────────────────────────────────────────────────────
// Dependency Errors
// ──────────────────────────────────────────────────────────────

/**
 * Thrown when adding a dependency would create a circular chain.
 */
export class CircularDependencyError extends DomainError {
  readonly fromTaskId: string;
  readonly toTaskId: string;
  readonly chain: readonly string[];

  constructor(fromTaskId: string, toTaskId: string, chain: readonly string[] = []) {
    super(
      "CIRCULAR_DEPENDENCY",
      `Circular dependency detected: ${fromTaskId} → ${toTaskId}` +
        (chain.length > 0 ? ` (chain: ${chain.join(" → ")})` : ""),
    );
    this.name = "CircularDependencyError";
    this.fromTaskId = fromTaskId;
    this.toTaskId = toTaskId;
    this.chain = chain;
  }
}

/**
 * Thrown when a dependency resolution fails (e.g. dep task doesn't exist).
 */
export class DependencyResolutionError extends DomainError {
  readonly taskId: string;
  readonly dependencyId: string;

  constructor(taskId: string, dependencyId: string) {
    super(
      "DEPENDENCY_RESOLUTION",
      `Cannot resolve dependency: task ${taskId} depends on non-existent task ${dependencyId}`,
    );
    this.name = "DependencyResolutionError";
    this.taskId = taskId;
    this.dependencyId = dependencyId;
  }
}

// ──────────────────────────────────────────────────────────────
// Block / Infrastructure Errors
// ──────────────────────────────────────────────────────────────

/**
 * Thrown when a SiYuan block fails validation (doesn't exist, wrong type, etc.).
 */
export class BlockValidationError extends DomainError {
  readonly blockId: string;
  readonly reason: string;

  constructor(blockId: string, reason: string) {
    super("BLOCK_VALIDATION", `Block validation failed for ${blockId}: ${reason}`);
    this.name = "BlockValidationError";
    this.blockId = blockId;
    this.reason = reason;
  }
}

/**
 * Thrown when a recurrence pattern is invalid or cannot be resolved.
 */
export class RecurrenceError extends DomainError {
  readonly taskId: string;
  readonly rrule?: string;

  constructor(taskId: string, message: string, rrule?: string) {
    super("RECURRENCE_ERROR", `Recurrence error for task ${taskId}: ${message}`);
    this.name = "RecurrenceError";
    this.taskId = taskId;
    this.rrule = rrule;
  }
}

// ──────────────────────────────────────────────────────────────
// Pipeline Errors
// ──────────────────────────────────────────────────────────────

/**
 * Thrown when the execution pipeline encounters a stage failure.
 */
export class PipelineStageError extends DomainError {
  readonly stage: string;
  readonly taskId?: string;
  readonly cause?: Error;

  constructor(stage: string, message: string, taskId?: string, cause?: Error) {
    super("PIPELINE_STAGE", `Pipeline stage [${stage}] failed: ${message}`);
    this.name = "PipelineStageError";
    this.stage = stage;
    this.taskId = taskId;
    this.cause = cause;
  }
}
