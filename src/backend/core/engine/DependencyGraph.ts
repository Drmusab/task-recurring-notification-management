import type { Task } from '@backend/core/models/Task';
import { warn } from "@backend/logging/logger";

/**
 * DependencyGraph manages task dependencies and blocking relationships
 * Uses adjacency list for efficient lookups and DFS for cycle detection
 */
export class DependencyGraph {
  // Adjacency list: taskId -> array of task IDs it depends on
  private dependencies: Map<string, Set<string>>;
  
  // Reverse lookup: taskId -> array of task IDs that depend on it
  private dependents: Map<string, Set<string>>;
  
  // Status lookup: taskId -> is completed
  private completedTasks: Set<string>;

  constructor() {
    this.dependencies = new Map();
    this.dependents = new Map();
    this.completedTasks = new Set();
  }

  /**
   * Build or rebuild the dependency graph from all tasks
   * @param tasks Array of all tasks
   */
  buildGraph(tasks: Task[]): void {
    // Clear existing graph
    this.dependencies.clear();
    this.dependents.clear();
    this.completedTasks.clear();

    // Track completed tasks
    for (const task of tasks) {
      if (this.isTaskCompleted(task)) {
        this.completedTasks.add(task.id);
      }
    }

    // Build adjacency lists
    for (const task of tasks) {
      const taskId = task.id;
      
      // Initialize empty sets
      if (!this.dependencies.has(taskId)) {
        this.dependencies.set(taskId, new Set());
      }
      if (!this.dependents.has(taskId)) {
        this.dependents.set(taskId, new Set());
      }

      // Process dependencies
      const deps = task.dependsOn || [];
      for (const depId of deps) {
        // Check if dependency exists
        const depExists = tasks.some(t => t.id === depId);
        if (!depExists) {
          warn(`Task "${task.name}" depends on non-existent task ${depId}`, {
            taskId: task.id,
            missingDependency: depId
          });
          continue;
        }

        // Add to dependency graph
        this.dependencies.get(taskId)!.add(depId);
        
        // Add to reverse lookup
        if (!this.dependents.has(depId)) {
          this.dependents.set(depId, new Set());
        }
        this.dependents.get(depId)!.add(taskId);
      }
    }
  }

  /**
   * Check if a task is blocked by incomplete dependencies
   * @param taskId The task to check
   * @returns true if any dependency is incomplete
   */
  isBlocked(taskId: string): boolean {
    const deps = this.dependencies.get(taskId);
    if (!deps || deps.size === 0) {
      return false;
    }

    // Check if any dependency is incomplete
    for (const depId of deps) {
      if (!this.completedTasks.has(depId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all tasks that this task is blocking
   * @param taskId The task to check
   * @returns Array of task IDs that depend on this task
   */
  getBlockingTasks(taskId: string): string[] {
    const dependents = this.dependents.get(taskId);
    if (!dependents) {
      return [];
    }
    
    // Only return tasks that are incomplete (actually blocked)
    return Array.from(dependents).filter(depTaskId => {
      return !this.completedTasks.has(depTaskId);
    });
  }

  /**
   * Check if this task is blocking any other incomplete tasks
   * @param taskId The task to check
   * @returns true if any incomplete tasks depend on this task
   */
  isBlocking(taskId: string): boolean {
    return this.getBlockingTasks(taskId).length > 0;
  }

  /**
   * Detect circular dependencies starting from a task
   * @param taskId Starting task
   * @returns Array of task IDs forming the cycle, or empty if no cycle
   */
  detectCycle(taskId: string): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (currentId: string): boolean => {
      visited.add(currentId);
      recursionStack.add(currentId);
      path.push(currentId);

      const deps = this.dependencies.get(currentId);
      if (deps) {
        for (const depId of deps) {
          if (!visited.has(depId)) {
            if (dfs(depId)) {
              return true;
            }
          } else if (recursionStack.has(depId)) {
            // Found a cycle — include the closing node to show the loop
            path.push(depId);
            return true;
          }
        }
      }

      path.pop();
      recursionStack.delete(currentId);
      return false;
    };

    if (dfs(taskId)) {
      // Extract only the cycle portion from the path
      const cycleNode = path[path.length - 1];
      const cycleStart = path.indexOf(cycleNode);
      return path.slice(cycleStart);
    }

    return [];
  }

  /**
   * Validate that adding a dependency won't create a cycle
   * @param fromTaskId Task that will depend on toTaskId
   * @param toTaskId Task that fromTaskId will depend on
   * @returns true if safe to add, false if would create cycle
   */
  canAddDependency(fromTaskId: string, toTaskId: string): boolean {
    // Self-dependency check
    if (fromTaskId === toTaskId) {
      return false;
    }

    // Create a temporary graph with the new dependency
    const tempDeps = new Map(this.dependencies);
    if (!tempDeps.has(fromTaskId)) {
      tempDeps.set(fromTaskId, new Set());
    }
    
    const deps = new Set(tempDeps.get(fromTaskId)!);
    deps.add(toTaskId);
    tempDeps.set(fromTaskId, deps);

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (currentId: string): boolean => {
      visited.add(currentId);
      recursionStack.add(currentId);

      const currentDeps = tempDeps.get(currentId);
      if (currentDeps) {
        for (const depId of currentDeps) {
          if (!visited.has(depId)) {
            if (dfs(depId)) {
              return true;
            }
          } else if (recursionStack.has(depId)) {
            // Found a cycle
            return true;
          }
        }
      }

      recursionStack.delete(currentId);
      return false;
    };

    return !dfs(fromTaskId);
  }

  /**
   * Helper to check if task is completed
   */
  private isTaskCompleted(task: Task): boolean {
    // Check new status field first, fallback to enabled for backward compatibility
    if (task.status) {
      return task.status === 'done' || task.status === 'cancelled';
    }
    return !task.enabled;
  }
}
