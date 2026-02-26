/**
 * DependencyAwareSelector — Dependency-Guard-Integrated Task Selector
 *
 * Wraps a TaskSelector selection and applies DependencyExecutionGuard
 * to exclude tasks whose upstream dependencies are not yet satisfied.
 *
 * Behaviour:
 *   1. Receives a ReadonlyTask[] from TaskSelector
 *   2. Checks canExecuteSync(taskId) for each task (fast, in-memory)
 *   3. Optionally uses async canExecute(taskId) for validated blocking
 *   4. Excluded tasks are tagged with blocking reason for diagnostics
 *
 * The guard ensures:
 *   - Blocked tasks never reach the Scheduler
 *   - Blocked tasks never appear in "due now" frontend lists
 *   - Blocked tasks are never suggested by AI
 *
 * FORBIDDEN:
 *   - mutate task model
 *   - import TaskStorage
 *   - parse markdown / access DOM
 *   - fire integration events
 *   - write to storage
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { DependencyExecutionGuard, CanExecuteResult } from "@backend/dependencies/DependencyExecutionGuard";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface DependencyFilterOptions {
  /**
   * If true, use async canExecute() (validates against block attrs).
   * If false (default), use canExecuteSync() — faster, in-memory only.
   */
  validated?: boolean;
}

export interface DependencyFilterResult {
  /** Tasks that passed the dependency guard */
  readonly allowed: ReadonlyTask[];
  /** Tasks blocked by unresolved dependencies */
  readonly blocked: ReadonlyTask[];
  /** taskId → reason (for diagnostics / UI) */
  readonly blockReasons: ReadonlyMap<string, string>;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class DependencyAwareSelector {
  private readonly guard: DependencyExecutionGuard;

  constructor(guard: DependencyExecutionGuard) {
    this.guard = guard;
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Filter tasks through the dependency guard.
   *
   * Default: uses synchronous (fast) check.
   * Pass `{ validated: true }` for block-attribute-validated check.
   */
  async filter(
    tasks: ReadonlyTask[],
    opts?: DependencyFilterOptions,
  ): Promise<DependencyFilterResult> {
    const allowed: ReadonlyTask[] = [];
    const blocked: ReadonlyTask[] = [];
    const blockReasons = new Map<string, string>();

    if (opts?.validated) {
      // Async validated path — one API call per blocked task
      for (const task of tasks) {
        const result: CanExecuteResult = await this.guard.canExecute(task.id);
        if (result.allowed) {
          allowed.push(task);
        } else {
          blocked.push(task);
          blockReasons.set(task.id, result.reason ?? "Blocked by dependency");
        }
      }
    } else {
      // Fast sync path — in-memory graph only
      for (const task of tasks) {
        if (this.guard.canExecuteSync(task.id)) {
          allowed.push(task);
        } else {
          blocked.push(task);
          const explanation = this.guard.explainBlocked(task.id);
          const reason = explanation.blockers.length > 0
            ? `Blocked by: ${explanation.blockers.join(", ")}`
            : "Blocked by dependency";
          blockReasons.set(task.id, reason);
        }
      }
    }

    if (blocked.length > 0) {
      logger.debug("[DependencyAwareSelector] Blocked tasks excluded", {
        allowed: allowed.length,
        blocked: blocked.length,
      });
    }

    return { allowed, blocked, blockReasons };
  }

  /**
   * Quick boolean check: is this specific task allowed to execute?
   * Uses synchronous (fast) guard.
   */
  isAllowed(taskId: string): boolean {
    return this.guard.canExecuteSync(taskId);
  }

  /**
   * Explain why a task is blocked (for UI / diagnostics).
   */
  explainBlocked(taskId: string): { blockers: string[]; chains: string[][] } {
    return this.guard.explainBlocked(taskId);
  }
}
