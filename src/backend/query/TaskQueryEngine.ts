/**
 * TaskQueryEngine — Central Query Orchestrator
 *
 * The ONLY entry point for selecting tasks at runtime.
 * Composes all query-layer components into a single validated pipeline:
 *
 *   TaskQueryEngine.select()
 *     → TaskSelector           (cache read + optional block verification)
 *     → DependencyAwareSelector (exclude blocked tasks)
 *     → RecurrenceAwareSelector (resolve latest recurrence instance)
 *     → TaskFilterPipeline      (enabled, not-done, has-due, global filter)
 *     → Return ReadonlyTask[]
 *
 * Consumers:
 *   - Scheduler.checkDueTasks()     → selectDue(now)
 *   - Dashboard / Frontend queries  → selectAll() / selectInRange()
 *   - AI SmartSuggestionEngine      → selectAll({ validate: true })
 *   - ML AnalyticsQueryAdapter      → getAnalyticsAdapter()
 *
 * Events emitted:
 *   - query:tasks:selected    — after every successful selection
 *   - query:tasks:invalidated — on cache/dependency mutation
 *
 * Lifecycle:
 *   - Constructed (no side effects) → start() → stop()
 *   - MUST NOT be used before start(); MUST NOT survive after stop()
 *
 * FORBIDDEN:
 *   - mutate task model
 *   - import TaskStorage directly
 *   - parse markdown / access DOM
 *   - fire integration events
 *   - write to storage
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { TaskCache } from "@backend/cache/TaskCache";
import type { RecurrenceCache } from "@backend/cache/RecurrenceCache";
import type { AnalyticsCache } from "@backend/cache/AnalyticsCache";
import type { DependencyExecutionGuard } from "@backend/dependencies/DependencyExecutionGuard";
import type { BlockAttributeSync } from "@backend/blocks/BlockAttributeSync";
import type { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";

import { TaskSelector, type SelectionOptions } from "./TaskSelector";
import { DependencyAwareSelector, type DependencyFilterOptions } from "./DependencyAwareSelector";
import { RecurrenceAwareSelector, type RecurrenceResolveOptions } from "./RecurrenceAwareSelector";
import { TaskFilterPipeline, type FilterStage } from "./TaskFilterPipeline";
import { AnalyticsQueryAdapter } from "./AnalyticsQueryAdapter";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface TaskQueryEngineDeps {
  taskCache: TaskCache;
  recurrenceCache: RecurrenceCache;
  analyticsCache: AnalyticsCache;
  dependencyGuard: DependencyExecutionGuard;
  blockAttributeSync: BlockAttributeSync;
  recurrenceEngine: RecurrenceEngine;
  pluginEventBus: PluginEventBus;
}

export interface QueryOptions {
  /** Selection options (validate, verifyBlockExists, limit) */
  selection?: SelectionOptions;
  /** Dependency filter options (validated: true for async block check) */
  dependency?: DependencyFilterOptions;
  /** Recurrence resolve options (refDate, forceCompute) */
  recurrence?: RecurrenceResolveOptions;
  /** Skip dependency guard (e.g. for admin views). Default: false */
  skipDependencyCheck?: boolean;
  /** Skip recurrence resolution (e.g. for raw task list). Default: false */
  skipRecurrenceResolve?: boolean;
  /** Skip filter pipeline (e.g. for unfiltered count). Default: false */
  skipFilterPipeline?: boolean;
  /** Source label for telemetry. Default: "unknown" */
  source?: string;
}

export interface QueryResult {
  /** Final tasks after all pipeline stages */
  readonly tasks: ReadonlyTask[];
  /** Number of tasks from initial cache read */
  readonly fromCache: number;
  /** Number excluded by dependency guard */
  readonly blockedByDependency: number;
  /** Number of recurring tasks whose dueAt was resolved to next instance */
  readonly recurrenceResolved: number;
  /** Number excluded by filter pipeline */
  readonly filteredOut: number;
  /** Total pipeline duration in milliseconds */
  readonly durationMs: number;
  /** Which pipeline stages actually ran */
  readonly stages: string[];
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class TaskQueryEngine {
  // ── Composed components ──────────────────────────────────────
  private selector!: TaskSelector;
  private dependencySelector!: DependencyAwareSelector;
  private recurrenceSelector!: RecurrenceAwareSelector;
  private filterPipeline!: TaskFilterPipeline;
  private analyticsAdapter!: AnalyticsQueryAdapter;

  // ── Deps & state ─────────────────────────────────────────────
  private readonly deps: TaskQueryEngineDeps;
  private readonly eventBus: PluginEventBus;
  private readonly unsubscribes: Array<() => void> = [];
  private active = false;

  constructor(deps: TaskQueryEngineDeps) {
    this.deps = deps;
    this.eventBus = deps.pluginEventBus;
    // No side effects in constructor — defer to start()
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Initialize all internal components and subscribe to invalidation
   * events. MUST be called after all caches and guards are started.
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    // Build internal components
    this.selector = new TaskSelector({
      taskCache: this.deps.taskCache,
      blockAttributeSync: this.deps.blockAttributeSync,
      pluginEventBus: this.eventBus,
    });

    this.dependencySelector = new DependencyAwareSelector(
      this.deps.dependencyGuard,
    );

    this.recurrenceSelector = new RecurrenceAwareSelector({
      recurrenceCache: this.deps.recurrenceCache,
      recurrenceEngine: this.deps.recurrenceEngine,
    });

    this.filterPipeline = new TaskFilterPipeline(this.eventBus);

    this.analyticsAdapter = new AnalyticsQueryAdapter({
      analyticsCache: this.deps.analyticsCache,
      taskCache: this.deps.taskCache,
    });

    // Subscribe to invalidation triggers
    this.subscribeInvalidation();

    logger.info("[TaskQueryEngine] Started");
  }

  /**
   * Tear down: unsubscribe events, discard internal state.
   */
  stop(): void {
    if (!this.active) return;
    this.active = false;

    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* already removed */ }
    }
    this.unsubscribes.length = 0;

    logger.info("[TaskQueryEngine] Stopped");
  }

  // ── Primary Query API ────────────────────────────────────────

  /**
   * Select all valid tasks through the full pipeline.
   *
   * This is the CANONICAL read path for task data.
   * Flow: Cache → Dependency Gate → Recurrence Resolve → Filter Pipeline
   */
  async selectAll(opts?: QueryOptions): Promise<QueryResult> {
    this.requireActive("selectAll");
    return this.runPipeline(
      () => this.selector.selectAll(opts?.selection),
      opts,
    );
  }

  /**
   * Select tasks due on or before `date` through the full pipeline.
   *
   * This is the entry point the SCHEDULER should use instead of
   * reading from DueStateCache / TaskStorage directly.
   */
  async selectDue(date?: Date, opts?: QueryOptions): Promise<QueryResult> {
    this.requireActive("selectDue");
    const dueDate = date ?? new Date();
    return this.runPipeline(
      () => this.selector.selectDue(dueDate, opts?.selection),
      { ...opts, source: opts?.source ?? "scheduler" },
    );
  }

  /**
   * Select tasks in a date range through the full pipeline.
   */
  async selectInRange(
    start: Date,
    end: Date,
    opts?: QueryOptions,
  ): Promise<QueryResult> {
    this.requireActive("selectInRange");
    return this.runPipeline(
      () => this.selector.selectInRange(start, end, opts?.selection),
      opts,
    );
  }

  /**
   * Select a single task by ID (validated, dependency-checked).
   */
  async selectById(
    taskId: string,
    opts?: QueryOptions,
  ): Promise<ReadonlyTask | undefined> {
    this.requireActive("selectById");

    const task = await this.selector.selectById(taskId, opts?.selection);
    if (!task) return undefined;

    // Dependency check
    if (!opts?.skipDependencyCheck) {
      const { allowed } = await this.dependencySelector.filter(
        [task],
        opts?.dependency,
      );
      if (allowed.length === 0) return undefined;
    }

    return task;
  }

  // ── Specialized Accessors ────────────────────────────────────

  /**
   * Access the ML-safe analytics query adapter.
   * Use this instead of reading AnalyticsCache directly.
   */
  getAnalyticsAdapter(): AnalyticsQueryAdapter {
    this.requireActive("getAnalyticsAdapter");
    return this.analyticsAdapter;
  }

  /**
   * Access the filter pipeline to add custom filter stages.
   */
  getFilterPipeline(): TaskFilterPipeline {
    this.requireActive("getFilterPipeline");
    return this.filterPipeline;
  }

  /**
   * Add a custom filter stage dynamically.
   */
  addFilter(stage: FilterStage): void {
    this.requireActive("addFilter");
    this.filterPipeline.addFilter(stage);
  }

  /**
   * Check if the engine is active (started and not stopped).
   */
  isActive(): boolean {
    return this.active;
  }

  // ── Core Pipeline ────────────────────────────────────────────

  /**
   * Run the full query pipeline:
   *   1. Select (from cache, optionally validated)
   *   2. Dependency gate (exclude blocked tasks)
   *   3. Recurrence resolve (patch dueAt to latest instance)
   *   4. Filter pipeline (enabled, not-done, has-due)
   *   5. Emit telemetry event
   */
  private async runPipeline(
    selectFn: () => Promise<{ tasks: ReadonlyTask[]; fromCache: number }>,
    opts?: QueryOptions,
  ): Promise<QueryResult> {
    const startMs = performance.now();
    const stages: string[] = [];
    const source = opts?.source ?? "unknown";

    // Stage 1: Select from cache
    stages.push("select");
    const selection = await selectFn();
    let current: ReadonlyTask[] = selection.tasks;
    const fromCache = selection.fromCache;

    // Stage 2: Dependency gate
    let blockedByDependency = 0;
    if (!opts?.skipDependencyCheck) {
      stages.push("dependency");
      const depResult = await this.dependencySelector.filter(
        current,
        opts?.dependency,
      );
      blockedByDependency = depResult.blocked.length;
      current = depResult.allowed;
    }

    // Stage 3: Recurrence resolve
    let recurrenceResolved = 0;
    if (!opts?.skipRecurrenceResolve) {
      stages.push("recurrence");
      const recResult = this.recurrenceSelector.resolve(
        current,
        opts?.recurrence,
      );
      recurrenceResolved = recResult.resolved;
      current = recResult.tasks;
    }

    // Stage 4: Filter pipeline
    let filteredOut = 0;
    if (!opts?.skipFilterPipeline) {
      stages.push("filter");
      const filterResult = this.filterPipeline.apply(current);
      filteredOut = filterResult.before - filterResult.after;
      current = filterResult.tasks;
    }

    const durationMs = performance.now() - startMs;

    // Emit telemetry
    this.eventBus.emit("query:tasks:selected", {
      count: current.length,
      source,
      durationMs: Math.round(durationMs),
    });

    logger.debug("[TaskQueryEngine] Pipeline complete", {
      source,
      fromCache,
      blockedByDependency,
      recurrenceResolved,
      filteredOut,
      returned: current.length,
      stages,
      durationMs: Math.round(durationMs),
    });

    return {
      tasks: current,
      fromCache,
      blockedByDependency,
      recurrenceResolved,
      filteredOut,
      durationMs,
      stages,
    };
  }

  // ── Invalidation ─────────────────────────────────────────────

  /**
   * Subscribe to events that should trigger query-result invalidation.
   * Emits `query:tasks:invalidated` so frontend / callers can re-query.
   */
  private subscribeInvalidation(): void {
    const bus = this.eventBus;

    // Cache mutations → invalidate
    this.unsubscribes.push(
      bus.on("cache:task:updated", (p) => {
        bus.emit("query:tasks:invalidated", {
          scope: "single",
          taskId: p.taskId,
          reason: "cache:task:updated",
        });
      }),
    );

    this.unsubscribes.push(
      bus.on("cache:task:invalidated", (p) => {
        bus.emit("query:tasks:invalidated", {
          scope: p.scope === "full" ? "full" : "single",
          taskId: p.taskId,
          reason: "cache:task:invalidated",
        });
      }),
    );

    // Dependency changes → invalidate
    this.unsubscribes.push(
      bus.on("task:blocked", () => {
        bus.emit("query:tasks:invalidated", {
          scope: "full",
          reason: "dependency:blocked",
        });
      }),
    );

    this.unsubscribes.push(
      bus.on("task:unblocked", () => {
        bus.emit("query:tasks:invalidated", {
          scope: "full",
          reason: "dependency:unblocked",
        });
      }),
    );

    // Block mutations → invalidate
    this.unsubscribes.push(
      bus.on("block:deleted", (p) => {
        bus.emit("query:tasks:invalidated", {
          scope: "single",
          taskId: p.blockId, // blockId as reference
          reason: "block:deleted",
        });
      }),
    );
  }

  // ── Guards ───────────────────────────────────────────────────

  private requireActive(method: string): void {
    if (!this.active) {
      throw new Error(
        `[TaskQueryEngine] ${method}() called before start() or after stop(). ` +
        `Lifecycle violation — ensure TaskQueryEngine.start() is called after all caches are ready.`,
      );
    }
  }
}
