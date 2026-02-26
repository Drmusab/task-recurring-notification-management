/**
 * CacheManager — Lifecycle orchestrator for all runtime caches
 *
 * Creates, starts, stops, and exposes all five cache subsystems.
 * Designed for a single call site in index.ts:
 *
 *   this.cacheManager = new CacheManager({ ... });
 *   // onLayoutReady:
 *   this.cacheManager.start();
 *   // onunload:
 *   this.cacheManager.stop();
 *
 * FORBIDDEN:
 *  - initialize before plugin.onload()
 *  - survive plugin.onunload()
 *  - import frontend / Svelte
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskStorage";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import { TaskCache } from "./TaskCache";
import { RecurrenceCache } from "./RecurrenceCache";
import { AnalyticsCache } from "./AnalyticsCache";
import { DependencyCache } from "./DependencyCache";
import { DueStateCache } from "./DueStateCache";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface CacheManagerDeps {
  repository: TaskRepositoryProvider;
  pluginEventBus: PluginEventBus;
  /** Optional: computes next occurrence date for a task (from RecurrenceEngine). */
  computeNextOccurrence?: (task: Task) => string | null;
}

export interface CacheManagerStats {
  task: ReturnType<TaskCache["getStats"]>;
  recurrence: ReturnType<RecurrenceCache["getStats"]>;
  analytics: ReturnType<AnalyticsCache["getStats"]>;
  dependency: ReturnType<DependencyCache["getStats"]>;
  dueState: ReturnType<DueStateCache["getStats"]>;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class CacheManager {
  readonly taskCache: TaskCache;
  readonly recurrenceCache: RecurrenceCache;
  readonly analyticsCache: AnalyticsCache;
  readonly dependencyCache: DependencyCache;
  readonly dueStateCache: DueStateCache;

  private active = false;

  constructor(deps: CacheManagerDeps) {
    const { repository, pluginEventBus } = deps;

    this.taskCache = new TaskCache({ repository, pluginEventBus });
    this.recurrenceCache = new RecurrenceCache({
      repository,
      pluginEventBus,
      computeNext: deps.computeNextOccurrence,
    });
    this.analyticsCache = new AnalyticsCache({ repository, pluginEventBus });
    this.dependencyCache = new DependencyCache({ repository, pluginEventBus });
    this.dueStateCache = new DueStateCache({ repository, pluginEventBus });
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Start all caches in dependency order (task first, then derived caches).
   * MUST be called AFTER TaskStorage.init() completes.
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    this.taskCache.start();
    this.recurrenceCache.start();
    this.analyticsCache.start();
    this.dependencyCache.start();
    this.dueStateCache.start();

    logger.info("[CacheManager] All caches started");
  }

  /**
   * Stop all caches in reverse order.
   */
  stop(): void {
    if (!this.active) return;

    this.dueStateCache.stop();
    this.dependencyCache.stop();
    this.analyticsCache.stop();
    this.recurrenceCache.stop();
    this.taskCache.stop();

    this.active = false;
    logger.info("[CacheManager] All caches stopped");
  }

  /**
   * Full rebuild of all caches (e.g., after storage reload).
   */
  rebuildAll(): void {
    if (!this.active) return;
    this.taskCache.rebuild();
    this.recurrenceCache.rebuild();
    this.analyticsCache.rebuild();
    this.dependencyCache.rebuild();
    this.dueStateCache.rebuild();
    logger.info("[CacheManager] Full rebuild complete");
  }

  /** Whether the cache manager is running. */
  isActive(): boolean {
    return this.active;
  }

  // ── Stats ────────────────────────────────────────────────────

  getStats(): CacheManagerStats {
    return {
      task: this.taskCache.getStats(),
      recurrence: this.recurrenceCache.getStats(),
      analytics: this.analyticsCache.getStats(),
      dependency: this.dependencyCache.getStats(),
      dueState: this.dueStateCache.getStats(),
    };
  }
}
