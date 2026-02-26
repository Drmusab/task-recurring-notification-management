/**
 * TaskFilterPipeline — Stateless, Composable Task Filter Chain
 *
 * Applies an ordered sequence of filter predicates to a task list.
 * Each predicate is named (for telemetry) and returns boolean.
 *
 * Design principles:
 *   - Stateless: no internal cache, no subscriptions, no lifecycle
 *   - Composable: filters are a reusable array of { name, predicate }
 *   - Observable: emits 'query:tasks:filtered' via PluginEventBus
 *   - Uses ReadonlyTask: never mutates the task model
 *
 * Built-in filter stages (applied in order):
 *   1. enabled      — task.enabled === true
 *   2. not-done     — status ∉ { "done", "cancelled" }
 *   3. has-due      — dueAt is a non-empty string
 *   4. global-filter — delegated to GlobalFilter (when FilterContext is active)
 *
 * Consumers can extend with custom predicates via addFilter().
 *
 * FORBIDDEN:
 *   - mutate task model
 *   - parse markdown / access DOM
 *   - fire integration events
 *   - write to storage
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/**
 * A single named filter predicate.
 * Return `true` to INCLUDE the task, `false` to EXCLUDE.
 */
export interface FilterStage {
  /** Human-readable name for telemetry / explanation */
  readonly name: string;
  /** The predicate function — MUST be pure (no side effects). */
  readonly predicate: (task: ReadonlyTask) => boolean;
}

/**
 * Result of a pipeline run, including per-stage counts for diagnostics.
 */
export interface FilterPipelineResult {
  /** Tasks that survived all filter stages */
  readonly tasks: ReadonlyTask[];
  /** Number of tasks before filtering */
  readonly before: number;
  /** Number of tasks after filtering */
  readonly after: number;
  /** Names of stages that removed at least one task */
  readonly activeFilters: string[];
  /** Per-stage: how many tasks were removed */
  readonly removedByStage: Record<string, number>;
}

// ──────────────────────────────────────────────────────────────
// Built-In Predicates
// ──────────────────────────────────────────────────────────────

const BUILTIN_ENABLED: FilterStage = {
  name: "enabled",
  predicate: (t) => t.enabled === true,
};

const BUILTIN_NOT_DONE: FilterStage = {
  name: "not-done",
  predicate: (t) => t.status !== "done" && t.status !== "cancelled",
};

const BUILTIN_HAS_DUE: FilterStage = {
  name: "has-due",
  predicate: (t) => typeof t.dueAt === "string" && t.dueAt.length > 0,
};

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class TaskFilterPipeline {
  private readonly stages: FilterStage[] = [];
  private readonly eventBus: PluginEventBus | null;

  /**
   * @param eventBus — Optional. When provided, emits `query:tasks:filtered`.
   * @param includeBuiltins — When true (default), adds the standard stages.
   */
  constructor(eventBus?: PluginEventBus, includeBuiltins = true) {
    this.eventBus = eventBus ?? null;
    if (includeBuiltins) {
      this.stages.push(BUILTIN_ENABLED, BUILTIN_NOT_DONE, BUILTIN_HAS_DUE);
    }
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Append a custom filter stage to the pipeline.
   * Stages run in insertion order; earlier stages reduce the working set
   * for later stages.
   */
  addFilter(stage: FilterStage): this {
    this.stages.push(stage);
    return this;
  }

  /**
   * Run the full pipeline over `tasks`.
   * Returns a new array (never mutates the input).
   */
  apply(tasks: ReadonlyTask[]): FilterPipelineResult {
    const before = tasks.length;
    let current = tasks;
    const removedByStage: Record<string, number> = {};
    const activeFilters: string[] = [];

    for (const stage of this.stages) {
      const next = current.filter(stage.predicate);
      const removed = current.length - next.length;
      if (removed > 0) {
        removedByStage[stage.name] = removed;
        activeFilters.push(stage.name);
      }
      current = next;
    }

    const result: FilterPipelineResult = {
      tasks: current,
      before,
      after: current.length,
      activeFilters,
      removedByStage,
    };

    // Emit telemetry event
    if (this.eventBus && before !== current.length) {
      this.eventBus.emit("query:tasks:filtered", {
        before,
        after: current.length,
        filters: activeFilters,
      });
    }

    if (activeFilters.length > 0) {
      logger.debug("[TaskFilterPipeline] Filtered", {
        before,
        after: current.length,
        removed: removedByStage,
      });
    }

    return result;
  }

  /**
   * Run a single stage by name (for debugging / explain mode).
   */
  applyStage(name: string, tasks: ReadonlyTask[]): ReadonlyTask[] {
    const stage = this.stages.find((s) => s.name === name);
    if (!stage) {
      logger.warn(`[TaskFilterPipeline] Stage "${name}" not found`);
      return tasks;
    }
    return tasks.filter(stage.predicate);
  }

  /**
   * Return the names of all registered stages (for diagnostics).
   */
  getStageNames(): string[] {
    return this.stages.map((s) => s.name);
  }

  /**
   * Number of registered stages.
   */
  get stageCount(): number {
    return this.stages.length;
  }
}
