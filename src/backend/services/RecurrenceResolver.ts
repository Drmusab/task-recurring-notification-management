/**
 * RecurrenceResolver — Runtime Recurrence Instance Resolver
 *
 * Ensures all runtime transitions target the LATEST RECURRENCE INSTANCE,
 * never the recurring parent template.
 *
 * Behaviour:
 *   1. Takes a task (potentially a parent template)
 *   2. If recurring: resolves to the next valid occurrence via RecurrenceEngine
 *   3. Returns the resolved task with patched dueAt (shallow copy)
 *   4. Non-recurring tasks pass through unchanged
 *
 * Why this is critical:
 *   - Scheduler must fire for the NEXT occurrence, not the original dueAt
 *   - Escalations must fire for the actual current instance, not the template
 *   - AI must analyze the real completion pattern
 *   - Integration webhooks must reference the correct due date
 *
 * Integration:
 *   SchedulerService.tick() → resolveInstance() before block validation
 *   TaskLifecycle            → resolveInstance() before state transition
 *   IntegrationService       → resolveInstance() before webhook dispatch
 *
 * FORBIDDEN:
 *   - Mutate original task (returns new shallow copies)
 *   - Import TaskStorage
 *   - Parse markdown / access DOM
 *   - Fire integration events
 *   - Write to storage
 */

import type { Task, ReadonlyTask } from "@backend/core/models/Task";
import type { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface RecurrenceResolverDeps {
  recurrenceEngine: RecurrenceEngine;
}

export interface ResolveResult {
  /** The resolved task (patched dueAt if recurring) */
  task: ReadonlyTask;
  /** Whether the task was resolved to a different instance */
  resolved: boolean;
  /** The new dueAt (if resolved) */
  resolvedDueAt?: string;
  /** Whether the series has ended (no more occurrences) */
  seriesEnded: boolean;
  /** Whether this is a parent template (vs. instance) */
  isParentTemplate: boolean;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class RecurrenceResolver {
  private readonly recurrenceEngine: RecurrenceEngine;
  private active = false;

  // ── Stats ──
  private totalResolved = 0;
  private totalPassthrough = 0;
  private totalSeriesEnded = 0;

  constructor(deps: RecurrenceResolverDeps) {
    this.recurrenceEngine = deps.recurrenceEngine;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[RecurrenceResolver] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    logger.info("[RecurrenceResolver] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Resolve a task to its latest recurrence instance.
   *
   * Non-recurring tasks pass through unchanged.
   * Recurring tasks:
   *   - Compute next occurrence after the current dueAt
   *   - If next exists: return patched task with new dueAt
   *   - If no next: return original + seriesEnded=true
   *
   * @param task — The task to resolve
   * @param refDate — Reference date for computing next occurrence (default: now)
   */
  resolveInstance(task: ReadonlyTask, refDate?: Date): ResolveResult {
    // Non-recurring: passthrough
    if (!this.isRecurring(task)) {
      this.totalPassthrough++;
      return {
        task,
        resolved: false,
        seriesEnded: false,
        isParentTemplate: false,
      };
    }

    const ref = refDate ?? new Date();
    const dueDate = new Date(task.dueAt);

    // If the task's dueAt is in the future, it's already resolved to the correct instance
    if (dueDate > ref) {
      this.totalPassthrough++;
      return {
        task,
        resolved: false,
        seriesEnded: false,
        isParentTemplate: false,
      };
    }

    // Task dueAt is in the past — this may be a stale parent template.
    // Resolve to the next valid occurrence.
    try {
      // RecurrenceEngine.next() accepts domain Task — use as never for the type bridge
      const nextDate = this.recurrenceEngine.next(task as never, ref);

      if (!nextDate) {
        this.totalSeriesEnded++;
        return {
          task,
          resolved: false,
          seriesEnded: true,
          isParentTemplate: true,
        };
      }

      const resolvedDueAt = nextDate.toISOString();

      // Create a shallow copy with patched dueAt (NEVER mutate original)
      const resolved: ReadonlyTask = {
        ...task,
        dueAt: resolvedDueAt,
      };

      this.totalResolved++;

      logger.debug("[RecurrenceResolver] Resolved to next instance", {
        taskId: task.id,
        originalDueAt: task.dueAt,
        resolvedDueAt,
      });

      return {
        task: resolved,
        resolved: true,
        resolvedDueAt,
        seriesEnded: false,
        isParentTemplate: true,
      };
    } catch (error) {
      logger.warn("[RecurrenceResolver] Failed to resolve recurrence", {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // On error, return the original task unchanged
      return {
        task,
        resolved: false,
        seriesEnded: false,
        isParentTemplate: this.isRecurring(task),
      };
    }
  }

  /**
   * Batch resolve: resolve an array of tasks.
   * Returns resolved tasks and statistics.
   */
  resolveAll(tasks: ReadonlyTask[], refDate?: Date): {
    tasks: ReadonlyTask[];
    resolved: number;
    seriesEnded: number;
  } {
    const ref = refDate ?? new Date();
    const results: ReadonlyTask[] = [];
    let resolved = 0;
    let seriesEnded = 0;

    for (const task of tasks) {
      const result = this.resolveInstance(task, ref);
      results.push(result.task);
      if (result.resolved) resolved++;
      if (result.seriesEnded) seriesEnded++;
    }

    return { tasks: results, resolved, seriesEnded };
  }

  /**
   * Check if a task is a recurring parent template (has rrule).
   */
  isRecurring(task: ReadonlyTask): boolean {
    return !!(task as Task).recurrence?.rrule;
  }

  /**
   * Get resolver stats for monitoring.
   */
  getStats() {
    return {
      totalResolved: this.totalResolved,
      totalPassthrough: this.totalPassthrough,
      totalSeriesEnded: this.totalSeriesEnded,
    };
  }
}
