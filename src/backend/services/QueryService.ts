/**
 * QueryService — Query Selector Facade
 *
 * Thin service-layer facade over TaskQueryEngine (backend/query/).
 * Provides a simplified, lifecycle-safe API for service consumers.
 *
 * Consumers:
 *   - SchedulerService   → selectDue(now) for due-task polling
 *   - Frontend dashboard → selectAll() for task listing
 *   - AI Layer           → selectAll({ validate: true }) for suggestion input
 *   - AnalyticsService   → getAnalytics() for dashboard charts
 *
 * Pipeline flow (delegated to TaskQueryEngine):
 *   Cache → DependencyGate → RecurrenceResolve → FilterPipeline → Result
 *
 * Lifecycle:
 *   - Constructed (no side effects)
 *   - start() → delegates to TaskQueryEngine.start()
 *   - stop()  → delegates to TaskQueryEngine.stop()
 *
 * FORBIDDEN:
 *   - Access TaskStorage directly (go through query pipeline)
 *   - Mutate task model (delegate to TaskService)
 *   - Import frontend / Svelte
 *   - Parse markdown
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type {
  TaskQueryEngine,
  QueryOptions,
  QueryResult,
} from "@backend/query/TaskQueryEngine";
import type { AnalyticsQueryAdapter } from "@backend/query/AnalyticsQueryAdapter";
import type { EventService } from "./EventService";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface QueryServiceDeps {
  taskQueryEngine: TaskQueryEngine;
  eventService: EventService;
}

export interface DueTasksResult {
  tasks: ReadonlyTask[];
  count: number;
  durationMs: number;
}

export interface AnalyticsSummary {
  totalTasks: number;
  activeTasks: number;
  completedToday: number;
  overdueTasks: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class QueryService {
  private readonly queryEngine: TaskQueryEngine;
  private readonly eventService: EventService;
  private active = false;

  constructor(deps: QueryServiceDeps) {
    this.queryEngine = deps.taskQueryEngine;
    this.eventService = deps.eventService;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.queryEngine.start();
    this.active = true;
    logger.info("[QueryService] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.queryEngine.stop();
    this.active = false;
    logger.info("[QueryService] Stopped");
  }

  // ── Query API ────────────────────────────────────────────────

  /**
   * Select tasks due on or before the given date.
   * This is the CANONICAL entry point for the Scheduler.
   *
   * Pipeline: Cache → DependencyGuard → RecurrenceResolve → Filter → Result
   */
  async selectDue(date?: Date): Promise<DueTasksResult> {
    this.requireActive("selectDue");

    const result = await this.queryEngine.selectDue(date, {
      source: "QueryService.selectDue",
    });

    return {
      tasks: result.tasks,
      count: result.tasks.length,
      durationMs: result.durationMs,
    };
  }

  /**
   * Select all valid tasks through the full pipeline.
   * Used by dashboard, frontend list views, and AI suggestion input.
   */
  async selectAll(opts?: QueryOptions): Promise<QueryResult> {
    this.requireActive("selectAll");
    return this.queryEngine.selectAll({
      ...opts,
      source: opts?.source || "QueryService.selectAll",
    });
  }

  /**
   * Select tasks within a date range.
   * Used by calendar views and analytics range queries.
   */
  async selectInRange(start: Date, end: Date): Promise<QueryResult> {
    this.requireActive("selectInRange");
    return this.queryEngine.selectInRange(start, end, {
      source: "QueryService.selectInRange",
    });
  }

  /**
   * Select a single task by ID through the validation pipeline.
   * Returns undefined if task doesn't pass pipeline validation.
   */
  async selectById(taskId: string): Promise<ReadonlyTask | undefined> {
    this.requireActive("selectById");
    return this.queryEngine.selectById(taskId, {
      source: "QueryService.selectById",
    });
  }

  /**
   * Get the analytics query adapter.
   * Used by AnalyticsService for chart data computation.
   */
  getAnalyticsAdapter(): AnalyticsQueryAdapter {
    this.requireActive("getAnalyticsAdapter");
    return this.queryEngine.getAnalyticsAdapter();
  }

  /**
   * Force cache invalidation and query re-evaluation.
   * Use after bulk mutations or external storage changes.
   */
  invalidate(scope: "full" | "single", reason: string, taskId?: string): void {
    this.eventService.emitQueryInvalidation(scope, reason, taskId);
  }

  // ── Private ──────────────────────────────────────────────────

  private requireActive(method: string): void {
    if (!this.active) {
      throw new Error(`[QueryService] Not started — cannot call ${method}()`);
    }
  }
}
