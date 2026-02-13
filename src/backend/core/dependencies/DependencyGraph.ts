import type { Task } from '@backend/core/models/Task';
import { BlockedStateEvaluator, type BlockedExplanation } from '@backend/core/dependencies/BlockedStateEvaluator';
import { DependencyIndex } from '@backend/core/dependencies/DependencyIndex';

export interface GraphNode {
  id: string;
  title: string;
  notePath?: string;
  status?: Task['status'];
  isCompleted: boolean;
  isBlocked: boolean;
  isBlocking: boolean;
  hasDependencies: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface DependencyGraphOptions {
  includeCompleted: boolean;
  onlyBlocked?: boolean;
  onlyActive?: boolean;
  noteFilter?: string;
  focusTaskId?: string;
  depthLimit?: number;
  collapseCompleted?: boolean;
  includeTaskIds?: Set<string>;
}

export interface DependencyGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  levels: Map<string, number>;
}

export class DependencyGraph {
  private index = new DependencyIndex();
  private evaluator = new BlockedStateEvaluator(this.index);

  build(tasks: Task[]): void {
    this.index.build(tasks);
  }

  getGraphData(options: DependencyGraphOptions): DependencyGraphData {
    const tasks = this.index.getTasks();
    const includeTaskIds = options.includeTaskIds ? new Set(options.includeTaskIds) : null;
    const depthLimit = options.depthLimit ?? Infinity;

    let filteredTasks = tasks;
    if (options.noteFilter) {
      filteredTasks = filteredTasks.filter((task) => task.path === options.noteFilter);
    }

    if (includeTaskIds) {
      filteredTasks = filteredTasks.filter((task) => includeTaskIds.has(task.id));
    }

    if (!options.includeCompleted) {
      filteredTasks = filteredTasks.filter((task) => !this.index.isCompleted(task.id));
    }

    if (options.onlyActive) {
      filteredTasks = filteredTasks.filter((task) => !this.index.isCompleted(task.id));
    }

    if (options.onlyBlocked) {
      filteredTasks = filteredTasks.filter((task) => this.evaluator.isBlocked(task.id));
    }

    const tasksById = new Map(filteredTasks.map((task) => [task.id, task]));

    if (options.collapseCompleted) {
      const activeSet = new Set(
        filteredTasks.filter((task) => !this.index.isCompleted(task.id)).map((task) => task.id)
      );
      for (const task of filteredTasks) {
        if (!this.index.isCompleted(task.id)) continue;
        const downstream = this.index.getDownstream(task.id, depthLimit);
        const hasActiveDownstream = Array.from(downstream).some((id) => activeSet.has(id));
        if (!hasActiveDownstream) {
          tasksById.delete(task.id);
        }
      }
    }

    let focusSet: Set<string> | null = null;
    if (options.focusTaskId) {
      focusSet = new Set<string>();
      focusSet.add(options.focusTaskId);
      for (const upstreamId of this.index.getUpstream(options.focusTaskId, depthLimit)) {
        focusSet.add(upstreamId);
      }
      for (const downstreamId of this.index.getDownstream(options.focusTaskId, depthLimit)) {
        focusSet.add(downstreamId);
      }
    }

    if (focusSet) {
      for (const taskId of tasksById.keys()) {
        if (!focusSet.has(taskId)) {
          tasksById.delete(taskId);
        }
      }
    }

    const nodes: GraphNode[] = [];
    for (const task of tasksById.values()) {
      const isCompleted = this.index.isCompleted(task.id);
      nodes.push({
        id: task.id,
        title: task.name,
        notePath: task.path,
        status: task.status,
        isCompleted,
        isBlocked: this.evaluator.isBlocked(task.id),
        isBlocking: this.evaluator.isBlocking(task.id),
        hasDependencies: this.index.getBlockers(task.id).length > 0,
      });
    }

    const edges: GraphEdge[] = [];
    for (const taskId of tasksById.keys()) {
      const deps = this.index.getBlockers(taskId);
      for (const depId of deps) {
        if (!tasksById.has(depId)) continue;
        edges.push({ from: depId, to: taskId });
      }
    }

    const levels = this.computeLevels(tasksById, edges);

    return { nodes, edges, levels };
  }

  isBlocked(taskId: string): boolean {
    return this.evaluator.isBlocked(taskId);
  }

  isBlocking(taskId: string): boolean {
    return this.evaluator.isBlocking(taskId);
  }

  explainBlocked(taskId: string, depthLimit = 5): BlockedExplanation {
    return this.evaluator.explainBlocked(taskId, depthLimit);
  }

  getIndex(): DependencyIndex {
    return this.index;
  }

  private computeLevels(tasksById: Map<string, Task>, edges: GraphEdge[]): Map<string, number> {
    const levels = new Map<string, number>();
    const inDegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const taskId of tasksById.keys()) {
      inDegree.set(taskId, 0);
      outgoing.set(taskId, []);
    }

    for (const edge of edges) {
      if (!tasksById.has(edge.from) || !tasksById.has(edge.to)) continue;
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      outgoing.get(edge.from)!.push(edge.to);
    }

    const queue: string[] = [];
    for (const [taskId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(taskId);
        levels.set(taskId, 0);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levels.get(current) ?? 0;
      for (const neighbor of outgoing.get(current) ?? []) {
        const nextLevel = Math.max(levels.get(neighbor) ?? 0, currentLevel + 1);
        levels.set(neighbor, nextLevel);
        inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    for (const taskId of tasksById.keys()) {
      if (!levels.has(taskId)) {
        levels.set(taskId, 0);
      }
    }

    return levels;
  }
}
