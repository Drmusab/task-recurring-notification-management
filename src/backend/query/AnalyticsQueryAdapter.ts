/**
 * AnalyticsQueryAdapter — ML-Safe Query Adapter
 *
 * Provides a read-only analytics view of task data for the ML layer.
 * Ensures the pattern learning system only sees VALID completion signals:
 *   ✅ task:runtime:completed  — genuine completion
 *   ✅ task:runtime:missed     — genuine miss
 *   ✅ task:runtime:recurrence — recurrence generation
 *   ❌ rescheduled / postponed / snoozed — NOT learning signals
 *   ❌ deleted / archived — NOT completion signals
 *
 * Data flow:
 *   AnalyticsCache → AnalyticsQueryAdapter.query() → ML layer
 *
 * Guarantees:
 *   - Only tasks with valid completion/miss history are returned
 *   - Tasks whose blocks no longer exist are excluded
 *   - Trigger validation via MLTriggerEvent guards
 *   - Returns ReadonlyTask — never mutable
 *
 * FORBIDDEN:
 *   - mutate task model
 *   - import TaskStorage
 *   - parse markdown / access DOM
 *   - fire integration events
 *   - write to storage
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { AnalyticsCache, TaskAnalyticsEntry } from "@backend/cache/AnalyticsCache";
import type { TaskCache } from "@backend/cache/TaskCache";
import { isValidMLTrigger } from "@backend/core/ml/PatternLearnerStore";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface AnalyticsQueryDeps {
  analyticsCache: AnalyticsCache;
  taskCache: TaskCache;
}

/** A task enriched with its analytics entry — for ML consumption. */
export interface AnalyticsTaskView {
  readonly task: ReadonlyTask;
  readonly analytics: TaskAnalyticsEntry;
}

export interface AnalyticsQueryOptions {
  /** Minimum completionCount + missCount to include. Default: 1 */
  minEvents?: number;
  /** If true, exclude tasks flagged as abandonment risk. Default: false */
  excludeAbandoned?: boolean;
  /** Filter by trigger type (only these triggers are valid for ML). Default: all valid */
  triggerFilter?: string[];
}

export interface AnalyticsQueryResult {
  /** Tasks with analytics that passed all ML-safety filters */
  readonly entries: AnalyticsTaskView[];
  /** Number excluded because task not found in TaskCache */
  readonly missingTasks: number;
  /** Number excluded because analytics had insufficient events */
  readonly insufficientEvents: number;
  /** Number excluded because of abandonment risk filter */
  readonly abandonedExcluded: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class AnalyticsQueryAdapter {
  private readonly analyticsCache: AnalyticsCache;
  private readonly taskCache: TaskCache;

  constructor(deps: AnalyticsQueryDeps) {
    this.analyticsCache = deps.analyticsCache;
    this.taskCache = deps.taskCache;
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Query tasks with their analytics for ML consumption.
   *
   * Guarantees:
   *   - Every returned entry has both a valid task AND an analytics entry
   *   - Minimum event threshold respects caller's intent
   *   - Abandonment-risk tasks can be filtered out
   */
  query(opts?: AnalyticsQueryOptions): AnalyticsQueryResult {
    const minEvents = opts?.minEvents ?? 1;
    const excludeAbandoned = opts?.excludeAbandoned ?? false;

    // Validate triggerFilter if provided
    if (opts?.triggerFilter) {
      for (const trigger of opts.triggerFilter) {
        if (!isValidMLTrigger(trigger)) {
          logger.warn(
            `[AnalyticsQueryAdapter] Invalid ML trigger "${trigger}" in filter — ` +
            `only task:runtime:completed, task:runtime:missed, task:runtime:recurrence are allowed`,
          );
        }
      }
    }

    const entries: AnalyticsTaskView[] = [];
    let missingTasks = 0;
    let insufficientEvents = 0;
    let abandonedExcluded = 0;

    const allAnalytics = this.analyticsCache.getAllEntries();

    for (const analytics of allAnalytics) {
      // 1. Task must still exist in cache
      const task = this.taskCache.getTask(analytics.taskId);
      if (!task) {
        missingTasks++;
        continue;
      }

      // 2. Minimum event threshold: completionCount + missCount
      const totalEvents = analytics.completionCount + analytics.missCount;
      if (totalEvents < minEvents) {
        insufficientEvents++;
        continue;
      }

      // 3. Abandonment filter
      if (excludeAbandoned && analytics.abandonmentRisk) {
        abandonedExcluded++;
        continue;
      }

      entries.push({
        task: task as ReadonlyTask,
        analytics,
      });
    }

    logger.debug("[AnalyticsQueryAdapter] Query complete", {
      returned: entries.length,
      missingTasks,
      insufficientEvents,
      abandonedExcluded,
    });

    return { entries, missingTasks, insufficientEvents, abandonedExcluded };
  }

  /**
   * Get analytics for a single task (ML-safe read).
   * Returns null if the task doesn't exist or has no analytics.
   */
  getTaskAnalytics(taskId: string): AnalyticsTaskView | null {
    const task = this.taskCache.getTask(taskId);
    if (!task) return null;

    const analytics = this.analyticsCache.getTaskAnalytics(taskId);
    if (!analytics) return null;

    return { task: task as ReadonlyTask, analytics };
  }

  /**
   * Get aggregate analytics (completion rates, risk counts, etc.).
   * Delegates directly to AnalyticsCache — no additional filtering.
   */
  getAggregate() {
    return this.analyticsCache.getAggregate();
  }

  /**
   * Get task IDs flagged as abandonment risk.
   */
  getAbandonmentRisks(): string[] {
    return this.analyticsCache.getAbandonmentRisks();
  }
}
