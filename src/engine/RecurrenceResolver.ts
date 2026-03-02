/**
 * RecurrenceResolver — Recurrence Instance Resolution (§3.4, Stage 4)
 *
 * Resolves the latest recurrence instance for a task before execution.
 * Ensures the scheduler operates on the correct occurrence.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Pure resolution — no side effects
 *   ✔ Returns the resolved task (or original if not recurring)
 *   ✔ Indicates if a series has ended
 *   ❌ No direct SiYuan API calls
 *   ❌ No direct cache writes
 */

import type { DomainTask } from "@domain/DomainTask";
import { isRecurring } from "@domain/DomainTask";
import type { TaskCache } from "@cache/TaskCache";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** Result of resolving a recurrence instance. */
export interface RecurrenceResolveResult {
  /** The resolved task (may be the original or a resolved instance). */
  readonly task: DomainTask;
  /** Whether a resolution was applied. */
  readonly resolved: boolean;
  /** Whether the recurrence series has ended. */
  readonly seriesEnded: boolean;
  /** The resolved occurrence index (if applicable). */
  readonly occurrenceIndex?: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

/**
 * Resolves recurrence instances from the cache.
 *
 * For recurring tasks, this finds the latest (most recent) active
 * instance in the series. If no active instance exists and the series
 * hasn't reached its recurrence limit, it indicates a new instance
 * should be generated.
 */
export class RecurrenceResolver {
  constructor(private readonly cache: TaskCache) {}

  /**
   * Resolve the latest recurrence instance for a task.
   *
   * If the task is not recurring, returns the original task unchanged.
   * If recurring, finds the latest active instance in the series.
   */
  resolveInstance(task: DomainTask): RecurrenceResolveResult {
    // Non-recurring: return as-is
    if (!isRecurring(task)) {
      return { task, resolved: false, seriesEnded: false };
    }

    // If this task is a series template, find latest active child
    if (task.seriesId && task.seriesId === (task.id as string)) {
      return this.resolveSeriesTemplate(task);
    }

    // If this task IS a child occurrence, return it
    if (task.seriesId && task.seriesId !== (task.id as string)) {
      return {
        task,
        resolved: true,
        seriesEnded: false,
        occurrenceIndex: task.occurrenceIndex,
      };
    }

    // Standalone recurring task (no series tracking)
    return { task, resolved: false, seriesEnded: false };
  }

  /**
   * Resolve the latest active instance in a recurrence series.
   *
   * If the series has a COUNT limit (from RRule) and all instances
   * are complete, marks the series as ended.
   */
  resolveLatest(task: DomainTask): DomainTask {
    const result = this.resolveInstance(task);
    return result.task;
  }

  /**
   * Check if a task has any active (non-completed) instances.
   */
  hasActiveInstances(seriesId: string): boolean {
    const allTasks = this.cache.getAll();
    return allTasks.some(
      (t) =>
        t.seriesId === seriesId &&
        t.status === "todo" &&
        t.enabled,
    );
  }

  // ──────────────────────────────────────────────────────────
  // Internal
  // ──────────────────────────────────────────────────────────

  private resolveSeriesTemplate(template: DomainTask): RecurrenceResolveResult {
    const seriesId = template.seriesId!;
    const allTasks = this.cache.getAll();

    // Find all active instances in this series
    const activeInstances = allTasks
      .filter(
        (t) =>
          t.seriesId === seriesId &&
          (t.id as string) !== (template.id as string) &&
          t.status === "todo" &&
          t.enabled,
      )
      .sort((a, b) => {
        // Sort by occurrence index (descending) — latest first
        const aIdx = a.occurrenceIndex ?? 0;
        const bIdx = b.occurrenceIndex ?? 0;
        return bIdx - aIdx;
      });

    if (activeInstances.length > 0) {
      const latest = activeInstances[0]!;
      return {
        task: latest,
        resolved: true,
        seriesEnded: false,
        occurrenceIndex: latest.occurrenceIndex,
      };
    }

    // No active instances — check if series should end
    // Parse COUNT from the RRule string (e.g., "FREQ=DAILY;COUNT=10")
    const rruleCount = this.extractRRuleCount(template.recurrence?.rrule);
    if (rruleCount !== undefined) {
      const totalInstances = allTasks.filter(
        (t) => t.seriesId === seriesId && (t.id as string) !== (template.id as string),
      ).length;

      if (totalInstances >= rruleCount) {
        return {
          task: template,
          resolved: false,
          seriesEnded: true,
        };
      }
    }

    // No active instances but series hasn't ended — return template
    return { task: template, resolved: false, seriesEnded: false };
  }

  /**
   * Extract COUNT value from an RRule string.
   * E.g., "FREQ=DAILY;COUNT=10" → 10
   */
  private extractRRuleCount(rrule?: string): number | undefined {
    if (!rrule) return undefined;
    const match = rrule.match(/COUNT=(\d+)/i);
    return match ? parseInt(match[1]!, 10) : undefined;
  }
}
