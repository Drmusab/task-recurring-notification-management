/**
 * DependencyResolver — Topological Ordering & Readiness Resolution
 *
 * Provides:
 *   - Topological sort of tasks respecting dependency order
 *   - Execution order computation (which tasks can run next)
 *   - Graph data for visualization (nodes, edges, levels)
 *   - Recurrence inheritance binding
 *
 * This is the "read model" for the dependency graph — it computes
 * derived data structures without mutating the graph itself.
 *
 * FORBIDDEN:
 *  - mutate DependencyGraph state
 *  - import frontend components
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskStorage";
import type { DependencyGraph, DependencyNode } from "./DependencyGraph";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface VisualizationNode {
  id: string;
  title: string;
  notePath?: string;
  status?: Task["status"];
  isCompleted: boolean;
  isBlocked: boolean;
  isBlocking: boolean;
  hasDependencies: boolean;
  level: number;
}

export interface VisualizationEdge {
  from: string;
  to: string;
}

export interface GraphVisualizationData {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
}

export interface VisualizationOptions {
  includeCompleted?: boolean;
  onlyBlocked?: boolean;
  onlyActive?: boolean;
  noteFilter?: string;
  focusTaskId?: string;
  depthLimit?: number;
  collapseCompleted?: boolean;
  includeTaskIds?: Set<string>;
}

export interface DependencyResolverDeps {
  repository: TaskRepositoryProvider;
  graph: DependencyGraph;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class DependencyResolver {
  private readonly repository: TaskRepositoryProvider;
  private readonly graph: DependencyGraph;

  constructor(deps: DependencyResolverDeps) {
    this.repository = deps.repository;
    this.graph = deps.graph;
  }

  /**
   * Topological sort of all tasks in the graph.
   * Returns task IDs in execution order (dependencies first).
   * Tasks in cycles are omitted (they can't be ordered).
   */
  getExecutionOrder(): string[] {
    const nodes = this.graph.getAllNodes();
    const inDegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.taskId, 0);
      outgoing.set(node.taskId, []);
    }

    for (const node of nodes) {
      for (const depId of node.dependsOn) {
        if (inDegree.has(depId)) {
          inDegree.set(node.taskId, (inDegree.get(node.taskId) ?? 0) + 1);
          outgoing.get(depId)!.push(node.taskId);
        }
      }
    }

    const queue: string[] = [];
    for (const [taskId, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(taskId);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);
      for (const neighbor of outgoing.get(current) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    return order;
  }

  /**
   * Get tasks that are ready to execute now (all deps met, not completed).
   */
  getNextExecutable(): string[] {
    return this.graph.getReadyTasks().filter((tid) => {
      const task = this.repository.getTask(tid);
      return task && task.status !== "done" && task.enabled;
    });
  }

  /**
   * Get graph data formatted for frontend visualization.
   */
  getVisualizationData(options: VisualizationOptions = {}): GraphVisualizationData {
    const allNodes = this.graph.getAllNodes();
    const depthLimit = options.depthLimit ?? Infinity;

    // Step 1: Filter nodes
    let filtered = allNodes;

    if (options.noteFilter) {
      const filter = options.noteFilter;
      filtered = filtered.filter((n) => {
        const task = this.repository.getTask(n.taskId);
        return task?.path === filter;
      });
    }

    if (options.includeTaskIds) {
      const ids = options.includeTaskIds;
      filtered = filtered.filter((n) => ids.has(n.taskId));
    }

    if (!options.includeCompleted) {
      filtered = filtered.filter((n) => {
        const task = this.repository.getTask(n.taskId);
        return task?.status !== "done";
      });
    }

    if (options.onlyActive) {
      filtered = filtered.filter((n) => {
        const task = this.repository.getTask(n.taskId);
        return task?.status !== "done" && task?.enabled;
      });
    }

    if (options.onlyBlocked) {
      filtered = filtered.filter((n) => !n.ready && n.dependsOn.size > 0);
    }

    // Step 2: Focus on a specific task + neighborhood
    if (options.focusTaskId) {
      const focusSet = new Set<string>();
      focusSet.add(options.focusTaskId);
      this.collectNeighborhood(options.focusTaskId, "up", depthLimit, focusSet);
      this.collectNeighborhood(options.focusTaskId, "down", depthLimit, focusSet);
      filtered = filtered.filter((n) => focusSet.has(n.taskId));
    }

    // Step 3: Collapse completed (keep only if they have active downstream)
    if (options.collapseCompleted) {
      const activeSet = new Set(
        filtered
          .filter((n) => {
            const t = this.repository.getTask(n.taskId);
            return t?.status !== "done";
          })
          .map((n) => n.taskId)
      );
      filtered = filtered.filter((n) => {
        const t = this.repository.getTask(n.taskId);
        if (t?.status !== "done") return true;
        // Keep if any dependent is active
        for (const depId of n.dependents) {
          if (activeSet.has(depId)) return true;
        }
        return false;
      });
    }

    const nodeMap = new Map(filtered.map((n) => [n.taskId, n]));

    // Step 4: Compute levels via topological sort
    const levels = this.computeLevels(nodeMap);

    // Step 5: Build visualization nodes
    const vizNodes: VisualizationNode[] = [];
    for (const node of filtered) {
      const task = this.repository.getTask(node.taskId);
      vizNodes.push({
        id: node.taskId,
        title: task?.name ?? node.taskId,
        notePath: task?.path,
        status: task?.status,
        isCompleted: task?.status === "done",
        isBlocked: !node.ready && node.dependsOn.size > 0,
        isBlocking: this.graph.isBlocking(node.taskId),
        hasDependencies: node.dependsOn.size > 0,
        level: levels.get(node.taskId) ?? 0,
      });
    }

    // Step 6: Build edges (only between visible nodes)
    const edges: VisualizationEdge[] = [];
    for (const node of filtered) {
      for (const depId of node.dependsOn) {
        if (nodeMap.has(depId)) {
          edges.push({ from: depId, to: node.taskId });
        }
      }
    }

    return { nodes: vizNodes, edges };
  }

  // ── Private ──────────────────────────────────────────────────

  private collectNeighborhood(
    taskId: string,
    direction: "up" | "down",
    limit: number,
    result: Set<string>
  ): void {
    const queue: Array<{ id: string; depth: number }> = [{ id: taskId, depth: 0 }];
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (depth >= limit) continue;
      const node = this.graph.getNode(id);
      if (!node) continue;
      const neighbors = direction === "up"
        ? Array.from(node.dependsOn)
        : Array.from(node.dependents);
      for (const nid of neighbors) {
        if (result.has(nid)) continue;
        result.add(nid);
        queue.push({ id: nid, depth: depth + 1 });
      }
    }
  }

  private computeLevels(nodeMap: Map<string, DependencyNode>): Map<string, number> {
    const levels = new Map<string, number>();
    const inDegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const id of nodeMap.keys()) {
      inDegree.set(id, 0);
      outgoing.set(id, []);
    }

    for (const [id, node] of nodeMap) {
      for (const depId of node.dependsOn) {
        if (!nodeMap.has(depId)) continue;
        inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
        outgoing.get(depId)!.push(id);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
        levels.set(id, 0);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const lvl = levels.get(current) ?? 0;
      for (const neighbor of outgoing.get(current) ?? []) {
        const nextLvl = Math.max(levels.get(neighbor) ?? 0, lvl + 1);
        levels.set(neighbor, nextLvl);
        inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) - 1);
        if (inDegree.get(neighbor) === 0) queue.push(neighbor);
      }
    }

    // Assign level 0 to nodes in cycles (not reached by topo sort)
    for (const id of nodeMap.keys()) {
      if (!levels.has(id)) levels.set(id, 0);
    }

    return levels;
  }
}
