/**
 * DependencyExecutionGuard — Execution Gate for Blocked Tasks (§3.4, Stage 3)
 *
 * Checks if a task's dependencies are satisfied before allowing
 * execution in the pipeline. Blocked tasks are skipped silently.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Reads from DependencyGraph and Cache
 *   ✔ Returns structured result with blocking reason
 *   ❌ No mutations
 *   ❌ No SiYuan API calls
 */

import type { DependencyGraph } from "@dependencies/DependencyGraph";
import type { TaskCache } from "@cache/TaskCache";
import { isTerminal } from "@domain/DomainTask";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface CanExecuteResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly blockers?: readonly string[];
}

export interface ExecutionGuardDeps {
  readonly dependencyGraph: DependencyGraph;
  readonly cache: TaskCache;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

/**
 * Guards task execution by checking dependency status.
 *
 * A task is blocked if ANY of its dependencies are:
 *   - Not yet completed (status !== "done")
 *   - Not yet cancelled
 *
 * Usage:
 * ```ts
 * const guard = new DependencyExecutionGuard({ dependencyGraph, cache });
 * const result = await guard.canExecute("task-123");
 * if (!result.allowed) {
 *   console.log("Blocked by:", result.blockers);
 * }
 * ```
 */
export class DependencyExecutionGuard {
  private readonly graph: DependencyGraph;
  private readonly cache: TaskCache;

  constructor(deps: ExecutionGuardDeps) {
    this.graph = deps.dependencyGraph;
    this.cache = deps.cache;
  }

  /**
   * Check if a task can be executed (all dependencies satisfied).
   */
  async canExecute(taskId: string): Promise<CanExecuteResult> {
    // Build the set of completed task IDs from cache
    const completedIds = this.buildCompletedSet();

    // Check the dependency graph
    const result = this.graph.checkBlocked(taskId, completedIds);

    if (result.blocked) {
      return {
        allowed: false,
        reason: `Blocked by ${result.blockers.length} incomplete dependencies`,
        blockers: result.blockers,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if a task is currently blocked (synchronous version).
   */
  isBlocked(taskId: string): boolean {
    const completedIds = this.buildCompletedSet();
    return this.graph.isBlocked(taskId, completedIds);
  }

  // ──────────────────────────────────────────────────────────
  // Internal
  // ──────────────────────────────────────────────────────────

  /**
   * Build a set of all completed (terminal) task IDs from cache.
   */
  private buildCompletedSet(): Set<string> {
    const completedIds = new Set<string>();
    for (const task of this.cache.getAll()) {
      if (isTerminal(task)) {
        completedIds.add(task.id as string);
      }
    }
    return completedIds;
  }
}
