/**
 * RecurrenceAwareSelector — Recurrence Instance Resolver
 *
 * Ensures the query pipeline returns the LATEST OCCURRENCE of a
 * recurring task — not the parent template or a stale snapshot.
 *
 * Behaviour:
 *   1. Receives ReadonlyTask[] from upstream selector
 *   2. For each recurring task, resolves the current instance via
 *      RecurrenceCache (fast) or RecurrenceEngine.next() (computed)
 *   3. Patches the returned ReadonlyTask with the resolved dueAt
 *      WITHOUT mutating the original (creates a shallow copy)
 *   4. Non-recurring tasks pass through unmodified
 *
 * Why this matters:
 *   - Scheduler must fire for the NEXT occurrence, not the original dueAt
 *   - Dashboard must display the current recurrence window
 *   - AI must analyse the actual completion pattern, not the template
 *
 * FORBIDDEN:
 *   - mutate original task model (returns new objects)
 *   - import TaskStorage
 *   - parse markdown / access DOM
 *   - fire integration events
 *   - write to storage
 */

import type { Task, ReadonlyTask } from "@backend/core/models/Task";
import type { RecurrenceCache, RecurrenceCacheEntry } from "@backend/cache/RecurrenceCache";
import type { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface RecurrenceResolveDeps {
  recurrenceCache: RecurrenceCache;
  recurrenceEngine: RecurrenceEngine;
}

export interface RecurrenceResolveOptions {
  /** Reference date for computing next occurrence. Default: now */
  refDate?: Date;
  /** If true, skip cache and always compute via RecurrenceEngine. Default: false */
  forceCompute?: boolean;
}

export interface RecurrenceResolveResult {
  /** Tasks with recurrence-resolved dueAt values */
  readonly tasks: ReadonlyTask[];
  /** Number of recurring tasks whose dueAt was updated */
  readonly resolved: number;
  /** Number of tasks where recurrence series has ended (no next) */
  readonly seriesEnded: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class RecurrenceAwareSelector {
  private readonly cache: RecurrenceCache;
  private readonly engine: RecurrenceEngine;

  constructor(deps: RecurrenceResolveDeps) {
    this.cache = deps.recurrenceCache;
    this.engine = deps.recurrenceEngine;
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Resolve recurrence for each task.
   *
   * - Non-recurring tasks: pass through unchanged.
   * - Recurring tasks: dueAt is patched to the NEXT occurrence after refDate.
   * - If the series has ended (no next occurrence), the task is still returned
   *   with its original dueAt (to allow "final occurrence" handling).
   */
  resolve(
    tasks: ReadonlyTask[],
    opts?: RecurrenceResolveOptions,
  ): RecurrenceResolveResult {
    const refDate = opts?.refDate ?? new Date();
    const forceCompute = opts?.forceCompute ?? false;
    let resolved = 0;
    let seriesEnded = 0;

    const result: ReadonlyTask[] = [];

    for (const task of tasks) {
      if (!this.isRecurring(task)) {
        result.push(task);
        continue;
      }

      const nextDue = forceCompute
        ? this.computeNext(task, refDate)
        : this.resolveFromCacheOrCompute(task, refDate);

      if (nextDue) {
        // Patch dueAt WITHOUT mutating the original
        const patched: ReadonlyTask = { ...task, dueAt: nextDue };
        result.push(patched);
        resolved++;
      } else {
        // Series ended — return with original dueAt
        result.push(task);
        seriesEnded++;
      }
    }

    if (resolved > 0 || seriesEnded > 0) {
      logger.debug("[RecurrenceAwareSelector] Recurrence resolved", {
        total: tasks.length,
        resolved,
        seriesEnded,
      });
    }

    return { tasks: result, resolved, seriesEnded };
  }

  /**
   * Check if a single task has a next occurrence after `refDate`.
   * Returns the ISO string or null if series has ended.
   */
  peekNext(task: ReadonlyTask, refDate?: Date): string | null {
    if (!this.isRecurring(task)) return null;
    return this.resolveFromCacheOrCompute(task, refDate ?? new Date());
  }

  // ── Internal ─────────────────────────────────────────────────

  private isRecurring(task: ReadonlyTask): boolean {
    return !!(task.recurrence?.rrule);
  }

  /**
   * Try cache first (fast sync read), fall back to engine computation.
   */
  private resolveFromCacheOrCompute(
    task: ReadonlyTask,
    refDate: Date,
  ): string | null {
    // Attempt cache read
    const entry: RecurrenceCacheEntry | undefined = this.cache.getEntry(task.id);
    if (entry?.nextDue) {
      // Cache hit — but verify it's actually in the future relative to refDate
      const cachedMs = new Date(entry.nextDue).getTime();
      if (cachedMs >= refDate.getTime()) {
        return entry.nextDue;
      }
      // Cached value is in the past → recompute
    }

    return this.computeNext(task, refDate);
  }

  /**
   * Use RecurrenceEngine.next() to find the next occurrence after refDate.
   */
  private computeNext(task: ReadonlyTask, refDate: Date): string | null {
    try {
      // RecurrenceEngine.next() expects a mutable Task from @domain/models/Task —
      // we cast via `unknown` to bridge the dual-Task-type gap safely since
      // the engine only reads from the task (it's a PURE function).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextDate = this.engine.next(task as any, refDate);
      return nextDate ? nextDate.toISOString() : null;
    } catch (err) {
      logger.warn("[RecurrenceAwareSelector] Engine.next() failed", {
        taskId: task.id,
        rrule: task.recurrence?.rrule,
        err,
      });
      return null;
    }
  }
}
