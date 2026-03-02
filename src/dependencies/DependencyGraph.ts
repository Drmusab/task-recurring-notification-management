/**
 * DependencyGraph — Execution Guard (§4.3)
 *
 * Manages task dependency relationships and prevents execution of
 * blocked tasks. Detects circular dependencies, handles recurrence
 * inheritance, and suppresses execution appropriately.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Prevent circular dependency chains
 *   ✔ Inherit recurrence patterns safely from parent tasks
 *   ✔ Suppress execution if any dependency is incomplete
 *   ✔ Scheduler must NOT emit due events for blocked tasks
 *   ❌ No direct SiYuan API calls
 *   ❌ No mutations — dependency state flows through services/
 */

import { CircularDependencyError } from "@domain/errors";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** Directed edge in the dependency graph. */
export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly type: "blocks" | "inherits";
}

/** Dependency resolution result. */
export interface DependencyCheckResult {
  readonly blocked: boolean;
  readonly blockers: readonly string[];
  readonly reason?: string;
}

export interface DependencyGraphStats {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly cyclesDetected: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

/**
 * Directed acyclic graph (DAG) of task dependencies.
 *
 * A task is "blocked" if ANY of its dependencies are incomplete.
 * Adding an edge that would create a cycle throws CircularDependencyError.
 *
 * Usage:
 * ```ts
 * const graph = new DependencyGraph();
 * graph.addDependency("task-B", "task-A"); // B depends on A
 *
 * const completedIds = new Set(["task-A"]);
 * console.log(graph.isBlocked("task-B", completedIds)); // false
 * ```
 */
export class DependencyGraph {
  /** Map: taskId → set of taskIds it depends on (upstream). */
  private dependsOn: Map<string, Set<string>> = new Map();

  /** Map: taskId → set of taskIds that depend on it (downstream). */
  private dependedBy: Map<string, Set<string>> = new Map();

  /** Number of cycle detection rejections. */
  private cyclesDetected = 0;

  // ──────────────────────────────────────────────────────────
  // Graph Mutations
  // ──────────────────────────────────────────────────────────

  /**
   * Add a dependency: `taskId` depends on `dependsOnId`.
   *
   * @throws CircularDependencyError if adding this edge would create a cycle.
   */
  addDependency(taskId: string, dependsOnId: string): void {
    // Self-dependency
    if (taskId === dependsOnId) {
      throw new CircularDependencyError(taskId, dependsOnId, [taskId]);
    }

    // Check for circular dependency
    if (this.wouldCreateCycle(taskId, dependsOnId)) {
      this.cyclesDetected++;
      const chain = this.findChain(dependsOnId, taskId);
      throw new CircularDependencyError(taskId, dependsOnId, chain);
    }

    // Add forward edge: taskId depends on dependsOnId
    if (!this.dependsOn.has(taskId)) {
      this.dependsOn.set(taskId, new Set());
    }
    this.dependsOn.get(taskId)!.add(dependsOnId);

    // Add reverse edge: dependsOnId is depended by taskId
    if (!this.dependedBy.has(dependsOnId)) {
      this.dependedBy.set(dependsOnId, new Set());
    }
    this.dependedBy.get(dependsOnId)!.add(taskId);
  }

  /**
   * Remove a dependency edge.
   */
  removeDependency(taskId: string, dependsOnId: string): void {
    this.dependsOn.get(taskId)?.delete(dependsOnId);
    this.dependedBy.get(dependsOnId)?.delete(taskId);
  }

  /**
   * Remove all edges for a task (when it is deleted).
   */
  removeTask(taskId: string): void {
    // Remove all "depends on" edges
    const deps = this.dependsOn.get(taskId);
    if (deps) {
      for (const depId of deps) {
        this.dependedBy.get(depId)?.delete(taskId);
      }
      this.dependsOn.delete(taskId);
    }

    // Remove all "depended by" edges
    const dependents = this.dependedBy.get(taskId);
    if (dependents) {
      for (const depId of dependents) {
        this.dependsOn.get(depId)?.delete(taskId);
      }
      this.dependedBy.delete(taskId);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Query Operations
  // ──────────────────────────────────────────────────────────

  /**
   * Check if a task is blocked (any dependency incomplete).
   *
   * @param taskId        The task to check.
   * @param completedIds  Set of completed task IDs.
   * @returns             true if the task has any incomplete dependencies.
   */
  isBlocked(taskId: string, completedIds: Set<string>): boolean {
    const deps = this.dependsOn.get(taskId);
    if (!deps || deps.size === 0) return false;

    for (const depId of deps) {
      if (!completedIds.has(depId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get detailed check result for a task.
   */
  checkBlocked(taskId: string, completedIds: Set<string>): DependencyCheckResult {
    const deps = this.dependsOn.get(taskId);
    if (!deps || deps.size === 0) {
      return { blocked: false, blockers: [] };
    }

    const blockers: string[] = [];
    for (const depId of deps) {
      if (!completedIds.has(depId)) {
        blockers.push(depId);
      }
    }

    return {
      blocked: blockers.length > 0,
      blockers,
      reason: blockers.length > 0
        ? `Blocked by ${blockers.length} incomplete dependencies`
        : undefined,
    };
  }

  /**
   * Get the IDs of tasks that `taskId` depends on.
   */
  getDependencies(taskId: string): readonly string[] {
    const deps = this.dependsOn.get(taskId);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get the IDs of tasks that depend on `taskId`.
   */
  getDependents(taskId: string): readonly string[] {
    const deps = this.dependedBy.get(taskId);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Check if a dependency edge exists.
   */
  hasDependency(taskId: string, dependsOnId: string): boolean {
    return this.dependsOn.get(taskId)?.has(dependsOnId) ?? false;
  }

  // ──────────────────────────────────────────────────────────
  // Cycle Detection
  // ──────────────────────────────────────────────────────────

  /**
   * Check if adding a dependency edge would create a cycle.
   *
   * Uses DFS: starting from `dependsOnId`, check if we can reach
   * `taskId` by following existing "depends on" edges.
   */
  wouldCreateCycle(taskId: string, dependsOnId: string): boolean {
    const visited = new Set<string>();
    const stack = [dependsOnId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === taskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = this.dependsOn.get(current);
      if (deps) {
        for (const dep of deps) {
          stack.push(dep);
        }
      }
    }

    return false;
  }

  /**
   * Find the chain of dependencies from `start` to `end`.
   * Used for error reporting in CircularDependencyError.
   */
  private findChain(start: string, end: string): string[] {
    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const stack = [start];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === end) {
        // Reconstruct path
        const chain: string[] = [end];
        let node: string | undefined = end;
        while (node && node !== start) {
          node = parent.get(node);
          if (node) chain.unshift(node);
        }
        return chain;
      }
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = this.dependsOn.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            parent.set(dep, current);
            stack.push(dep);
          }
        }
      }
    }

    return [start, end]; // Fallback
  }

  // ──────────────────────────────────────────────────────────
  // Bulk Operations
  // ──────────────────────────────────────────────────────────

  /**
   * Clear the entire graph.
   */
  clear(): void {
    this.dependsOn.clear();
    this.dependedBy.clear();
  }

  /**
   * Rebuild the graph from a set of tasks.
   */
  rebuild(tasks: readonly { id: string; dependsOn?: readonly string[] }[]): void {
    this.clear();
    for (const task of tasks) {
      if (task.dependsOn && task.dependsOn.length > 0) {
        for (const depId of task.dependsOn) {
          try {
            this.addDependency(task.id, depId);
          } catch {
            // Skip circular dependencies during rebuild
            console.warn(
              `[DependencyGraph] Skipping circular dependency: ${task.id} → ${depId}`,
            );
          }
        }
      }
    }
  }

  /**
   * Get all edges in the graph.
   */
  getAllEdges(): readonly GraphEdge[] {
    const edges: GraphEdge[] = [];
    for (const [taskId, deps] of this.dependsOn) {
      for (const depId of deps) {
        edges.push({ from: taskId, to: depId, type: "blocks" });
      }
    }
    return edges;
  }

  // ──────────────────────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────────────────────

  getStats(): DependencyGraphStats {
    let edgeCount = 0;
    for (const deps of this.dependsOn.values()) {
      edgeCount += deps.size;
    }

    // Nodes = union of all task IDs seen in either map
    const nodes = new Set<string>();
    for (const id of this.dependsOn.keys()) nodes.add(id);
    for (const id of this.dependedBy.keys()) nodes.add(id);

    return {
      nodeCount: nodes.size,
      edgeCount,
      cyclesDetected: this.cyclesDetected,
    };
  }
}
