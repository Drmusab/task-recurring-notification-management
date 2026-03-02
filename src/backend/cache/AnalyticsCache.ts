/**
 * AnalyticsCache — Task-Completion–Aware Analytics Cache
 *
 * Caches per-task and aggregate analytics data so that:
 *  - SmartSuggestionEngine reads fresh completion/miss patterns
 *  - Dashboard renders accurate streaks / hit-rates
 *  - AI analytics never learns stale behavior patterns
 *
 * Refresh triggers:
 *   task:complete, task:missed, task:reschedule, task:refresh
 *
 * FORBIDDEN:
 *  - mutate task model
 *  - import frontend
 *  - store DOM / markdown
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskStorage";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface TaskAnalyticsEntry {
  readonly taskId: string;
  readonly completionCount: number;
  readonly missCount: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly snoozeCount: number;
  /** Ratio: completionCount / (completionCount + missCount). 0-1, NaN → 0 */
  readonly completionRate: number;
  /** Most recent completion timestamps (ISO strings, max 10) */
  readonly recentCompletions: readonly string[];
  /** True if missCount > completionCount × 2 */
  readonly abandonmentRisk: boolean;
  /** Updated timestamp */
  readonly computedAt: string;
}

export interface AggregateAnalytics {
  readonly totalTasks: number;
  readonly enabledTasks: number;
  readonly recurringTasks: number;
  readonly avgCompletionRate: number;
  readonly totalCompletions: number;
  readonly totalMisses: number;
  readonly highRiskTasks: readonly string[]; // task IDs flagged for abandonment
  readonly computedAt: string;
}

export interface AnalyticsCacheStats {
  entries: number;
  refreshCount: number;
  lastRefreshAt: string | null;
}

export interface AnalyticsCacheDeps {
  repository: TaskRepositoryProvider;
  pluginEventBus: PluginEventBus;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class AnalyticsCache {
  private taskEntries: Map<string, TaskAnalyticsEntry> = new Map();
  private aggregate: AggregateAnalytics | null = null;
  private active = false;

  private readonly repository: TaskRepositoryProvider;
  private readonly eventBus: PluginEventBus;
  private readonly unsubscribes: Array<() => void> = [];

  // stats
  private refreshCount = 0;
  private lastRefreshAt: string | null = null;

  constructor(deps: AnalyticsCacheDeps) {
    this.repository = deps.repository;
    this.eventBus = deps.pluginEventBus;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    this.rebuild();
    this.subscribeEvents();
    logger.info("[AnalyticsCache] Started", { entries: this.taskEntries.size });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* noop */ }
    }
    this.unsubscribes.length = 0;
    this.taskEntries.clear();
    this.aggregate = null;
    logger.info("[AnalyticsCache] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Per-task analytics (fast, from memory).
   */
  getTaskAnalytics(taskId: string): TaskAnalyticsEntry | undefined {
    return this.taskEntries.get(taskId);
  }

  /**
   * Aggregate analytics across all tasks.
   * Computed lazily and cached until next invalidation.
   */
  getAggregate(): AggregateAnalytics {
    if (this.aggregate) return this.aggregate;
    this.aggregate = this.computeAggregate();
    return this.aggregate;
  }

  /**
   * Return task IDs flagged as abandonment risk.
   */
  getAbandonmentRisks(): string[] {
    const risks: string[] = [];
    for (const entry of this.taskEntries.values()) {
      if (entry.abandonmentRisk) risks.push(entry.taskId);
    }
    return risks;
  }

  /**
   * Get all entries for the AI suggestion engine.
   */
  getAllEntries(): TaskAnalyticsEntry[] {
    return Array.from(this.taskEntries.values());
  }

  // ── Rebuild / Invalidation ───────────────────────────────────

  rebuild(): void {
    this.taskEntries.clear();
    this.aggregate = null;
    for (const task of this.repository.getAllTasks()) {
      this.taskEntries.set(task.id, this.computeEntry(task));
    }
    this.refreshCount++;
    this.lastRefreshAt = new Date().toISOString();
    this.eventBus.emit("cache:analytics:updated", { scope: "full" });
  }

  /**
   * Refresh a single task's analytics entry.
   */
  refreshTask(taskId: string): void {
    this.aggregate = null; // invalidate aggregate
    const task = this.repository.getTask(taskId);
    if (task) {
      this.taskEntries.set(taskId, this.computeEntry(task));
    } else {
      this.taskEntries.delete(taskId);
    }
    this.refreshCount++;
    this.lastRefreshAt = new Date().toISOString();
    this.eventBus.emit("cache:analytics:updated", { scope: "task", taskId });
  }

  evict(taskId: string): void {
    this.taskEntries.delete(taskId);
    this.aggregate = null;
  }

  // ── Stats ────────────────────────────────────────────────────

  getStats(): AnalyticsCacheStats {
    return {
      entries: this.taskEntries.size,
      refreshCount: this.refreshCount,
      lastRefreshAt: this.lastRefreshAt,
    };
  }

  // ── Internals ────────────────────────────────────────────────

  private computeEntry(task: Task): TaskAnalyticsEntry {
    const cc = task.completionCount ?? 0;
    const mc = task.missCount ?? 0;
    const total = cc + mc;
    const rate = total > 0 ? cc / total : 0;

    return {
      taskId: task.id,
      completionCount: cc,
      missCount: mc,
      currentStreak: task.currentStreak ?? 0,
      bestStreak: task.bestStreak ?? 0,
      snoozeCount: task.snoozeCount ?? 0,
      completionRate: rate,
      recentCompletions: task.recentCompletions?.slice(0, 10) ?? [],
      abandonmentRisk: mc > cc * 2 && mc >= 3,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Compute aggregate from CACHED entries — never re-reads from repository.
   * This ensures the aggregate snapshot is consistent with per-task entries.
   */
  private computeAggregate(): AggregateAnalytics {
    let totalCompletions = 0;
    let totalMisses = 0;
    const highRisk: string[] = [];

    for (const entry of this.taskEntries.values()) {
      totalCompletions += entry.completionCount;
      totalMisses += entry.missCount;
      if (entry.abandonmentRisk) highRisk.push(entry.taskId);
    }

    // enabledTasks / recurringTasks require task model fields not in
    // TaskAnalyticsEntry — read from repository only for these counters.
    const all = this.repository.getAllTasks();
    let enabledCount = 0;
    let recurringCount = 0;
    for (const task of all) {
      if (task.enabled) enabledCount++;
      if (task.recurrence?.rrule) recurringCount++;
    }

    const total = totalCompletions + totalMisses;

    return {
      totalTasks: this.taskEntries.size,
      enabledTasks: enabledCount,
      recurringTasks: recurringCount,
      avgCompletionRate: total > 0 ? totalCompletions / total : 0,
      totalCompletions,
      totalMisses,
      highRiskTasks: highRisk,
      computedAt: new Date().toISOString(),
    };
  }

  private subscribeEvents(): void {
    const bus = this.eventBus;

    this.unsubscribes.push(
      bus.on("task:complete", (p) => this.refreshTask(p.taskId)),
      bus.on("task:missed", (p) => this.refreshTask(p.taskId)),
      bus.on("task:reschedule", (p) => this.refreshTask(p.taskId)),
      bus.on("task:updated", (p) => this.refreshTask(p.taskId)),
      bus.on("task:refresh", () => this.rebuild()),
    );
  }
}
