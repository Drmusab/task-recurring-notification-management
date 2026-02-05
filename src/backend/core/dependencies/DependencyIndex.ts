import type { Task } from '@backend/core/models/Task';
import { isTaskActive } from '@backend/core/models/Task';

export interface DependencySnapshot {
  tasksById: Map<string, Task>;
  dependencies: Map<string, Set<string>>;
  dependents: Map<string, Set<string>>;
  completed: Set<string>;
}

export class DependencyIndex {
  private tasksById = new Map<string, Task>();
  private dependencies = new Map<string, Set<string>>();
  private dependents = new Map<string, Set<string>>();
  private completed = new Set<string>();

  build(tasks: Task[]): void {
    this.tasksById.clear();
    this.dependencies.clear();
    this.dependents.clear();
    this.completed.clear();

    for (const task of tasks) {
      this.tasksById.set(task.id, task);
      if (!isTaskActive(task)) {
        this.completed.add(task.id);
      }
    }

    for (const task of tasks) {
      this.ensureTask(task.id);
      const deps = task.dependsOn ?? [];
      if (deps.length === 0) continue;

      for (const depId of deps) {
        if (!this.tasksById.has(depId)) {
          continue;
        }
        this.addDependency(task.id, depId);
      }
    }
  }

  updateTask(task: Task): void {
    this.removeTask(task.id, { preserveDependents: true });
    this.tasksById.set(task.id, task);
    if (!isTaskActive(task)) {
      this.completed.add(task.id);
    }
    this.ensureTask(task.id);
    for (const depId of task.dependsOn ?? []) {
      if (!this.tasksById.has(depId)) continue;
      this.addDependency(task.id, depId);
    }
  }

  removeTask(taskId: string, options: { preserveDependents?: boolean } = {}): void {
    this.tasksById.delete(taskId);
    this.completed.delete(taskId);

    const deps = this.dependencies.get(taskId);
    if (deps) {
      for (const depId of deps) {
        this.dependents.get(depId)?.delete(taskId);
      }
    }
    this.dependencies.delete(taskId);

    if (options.preserveDependents) {
      return;
    }

    const dependents = this.dependents.get(taskId);
    if (dependents) {
      for (const dependentId of dependents) {
        this.dependencies.get(dependentId)?.delete(taskId);
      }
    }
    this.dependents.delete(taskId);
  }

  addDependency(fromTaskId: string, toTaskId: string): void {
    if (!this.dependencies.has(fromTaskId)) {
      this.dependencies.set(fromTaskId, new Set());
    }
    if (!this.dependents.has(toTaskId)) {
      this.dependents.set(toTaskId, new Set());
    }
    this.dependencies.get(fromTaskId)!.add(toTaskId);
    this.dependents.get(toTaskId)!.add(fromTaskId);
  }

  removeDependency(fromTaskId: string, toTaskId: string): void {
    this.dependencies.get(fromTaskId)?.delete(toTaskId);
    this.dependents.get(toTaskId)?.delete(fromTaskId);
  }

  getTask(taskId: string): Task | undefined {
    return this.tasksById.get(taskId);
  }

  getTasks(): Task[] {
    return Array.from(this.tasksById.values());
  }

  getBlockers(taskId: string): string[] {
    return Array.from(this.dependencies.get(taskId) ?? []);
  }

  getBlocked(taskId: string): string[] {
    return Array.from(this.dependents.get(taskId) ?? []);
  }

  getDependenciesMap(): Map<string, Set<string>> {
    return this.dependencies;
  }

  getDependentsMap(): Map<string, Set<string>> {
    return this.dependents;
  }

  getUpstream(taskId: string, depthLimit = Infinity): Set<string> {
    return this.traverse(taskId, this.dependencies, depthLimit);
  }

  getDownstream(taskId: string, depthLimit = Infinity): Set<string> {
    return this.traverse(taskId, this.dependents, depthLimit);
  }

  isCompleted(taskId: string): boolean {
    return this.completed.has(taskId);
  }

  private traverse(
    startId: string,
    graph: Map<string, Set<string>>,
    depthLimit: number
  ): Set<string> {
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];
    queue.push({ id: startId, depth: 0 });

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (depth >= depthLimit) continue;
      const neighbors = graph.get(id);
      if (!neighbors) continue;

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push({ id: neighbor, depth: depth + 1 });
      }
    }

    return visited;
  }

  private ensureTask(taskId: string): void {
    if (!this.dependencies.has(taskId)) {
      this.dependencies.set(taskId, new Set());
    }
    if (!this.dependents.has(taskId)) {
      this.dependents.set(taskId, new Set());
    }
  }
}
