/**
 * DependencyGraph - Task dependency management with cycle detection
 * Phase 4: Dependencies + Advanced Query
 */

import type { Task } from '../models/Task';
import { isTaskCompleted } from '../models/Task';

/**
 * Graph edge representing a dependency
 */
export interface DependencyEdge {
  from: string;  // Task ID that is blocked
  to: string;    // Task ID that must be completed first
}

/**
 * Dependency analysis result
 */
export interface DependencyAnalysis {
  /** Tasks that are currently blocked */
  blockedTasks: Set<string>;
  
  /** Tasks that are blocking others */
  blockingTasks: Set<string>;
  
  /** Circular dependency chains detected */
  cycles: string[][];
  
  /** Dependency depth for each task (max distance from root) */
  depths: Map<string, number>;
  
  /** Topological sort order (if no cycles) */
  topologicalOrder?: string[];
}

/**
 * DependencyGraph manages task dependencies and detects circular references
 */
export class DependencyGraph {
  private tasks: Map<string, Task>;
  private edges: Map<string, Set<string>>; // taskId -> Set of tasks it depends on
  private reverseEdges: Map<string, Set<string>>; // taskId -> Set of tasks that depend on it
  
  constructor(tasks: Map<string, Task> = new Map()) {
    this.tasks = tasks;
    this.edges = new Map();
    this.reverseEdges = new Map();
    this.buildGraph();
  }
  
  /**
   * Build dependency graph from tasks
   */
  private buildGraph(): void {
    this.edges.clear();
    this.reverseEdges.clear();
    
    for (const [taskId, task] of this.tasks) {
      const dependencyId = task.taskId || taskId;
      
      // Initialize edges
      if (!this.edges.has(dependencyId)) {
        this.edges.set(dependencyId, new Set());
      }
      if (!this.reverseEdges.has(dependencyId)) {
        this.reverseEdges.set(dependencyId, new Set());
      }
      
      // Add dependencies
      if (task.dependsOn && task.dependsOn.length > 0) {
        for (const depId of task.dependsOn) {
          this.edges.get(dependencyId)!.add(depId);
          
          if (!this.reverseEdges.has(depId)) {
            this.reverseEdges.set(depId, new Set());
          }
          this.reverseEdges.get(depId)!.add(dependencyId);
        }
      }
    }
  }
  
  /**
   * Detect circular dependencies using DFS
   * Returns array of cycles found
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];
    
    const dfs = (taskId: string): boolean => {
      visited.add(taskId);
      recStack.add(taskId);
      path.push(taskId);
      
      const dependencies = this.edges.get(taskId);
      if (dependencies) {
        for (const depId of dependencies) {
          if (!visited.has(depId)) {
            if (dfs(depId)) {
              return true; // Cycle found in recursion
            }
          } else if (recStack.has(depId)) {
            // Found a cycle - extract the cycle from path
            const cycleStart = path.indexOf(depId);
            const cycle = path.slice(cycleStart);
            cycle.push(depId); // Close the cycle
            cycles.push(cycle);
          }
        }
      }
      
      recStack.delete(taskId);
      path.pop();
      return false;
    };
    
    // Check all nodes (graph may be disconnected)
    for (const taskId of this.edges.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    }
    
    return cycles;
  }
  
  /**
   * Check if adding a dependency would create a cycle
   * Returns true if cycle would be created
   */
  wouldCreateCycle(fromTaskId: string, toTaskId: string): boolean {
    // Quick check: if fromTaskId === toTaskId, it's a self-loop
    if (fromTaskId === toTaskId) {
      return true;
    }
    
    // Check if there's already a path from toTaskId to fromTaskId
    // If yes, adding fromTaskId -> toTaskId would create a cycle
    return this.hasPath(toTaskId, fromTaskId);
  }
  
  /**
   * Check if there's a path from source to target using BFS
   */
  private hasPath(source: string, target: string): boolean {
    if (source === target) return true;
    
    const queue: string[] = [source];
    const visited = new Set<string>([source]);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependencies = this.edges.get(current);
      
      if (dependencies) {
        for (const depId of dependencies) {
          if (depId === target) {
            return true;
          }
          
          if (!visited.has(depId)) {
            visited.add(depId);
            queue.push(depId);
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Get all tasks that the given task depends on (direct + transitive)
   */
  getDependencies(taskId: string, direct: boolean = false): Set<string> {
    const dependencies = new Set<string>();
    
    if (direct) {
      // Only direct dependencies
      const deps = this.edges.get(taskId);
      if (deps) {
        return new Set(deps);
      }
      return dependencies;
    }
    
    // Transitive dependencies (BFS)
    const queue: string[] = [taskId];
    const visited = new Set<string>([taskId]);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const deps = this.edges.get(current);
      
      if (deps) {
        for (const depId of deps) {
          if (!visited.has(depId)) {
            visited.add(depId);
            dependencies.add(depId);
            queue.push(depId);
          }
        }
      }
    }
    
    return dependencies;
  }
  
  /**
   * Get all tasks that depend on the given task (direct + transitive)
   */
  getDependents(taskId: string, direct: boolean = false): Set<string> {
    const dependents = new Set<string>();
    
    if (direct) {
      // Only direct dependents
      const deps = this.reverseEdges.get(taskId);
      if (deps) {
        return new Set(deps);
      }
      return dependents;
    }
    
    // Transitive dependents (BFS)
    const queue: string[] = [taskId];
    const visited = new Set<string>([taskId]);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const deps = this.reverseEdges.get(current);
      
      if (deps) {
        for (const depId of deps) {
          if (!visited.has(depId)) {
            visited.add(depId);
            dependents.add(depId);
            queue.push(depId);
          }
        }
      }
    }
    
    return dependents;
  }
  
  /**
   * Check if a task is currently blocked (has incomplete dependencies)
   */
  isTaskBlocked(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || !task.dependsOn || task.dependsOn.length === 0) {
      return false;
    }
    
    // Check if any dependency is incomplete
    return task.dependsOn.some(depId => {
      const depTask = this.tasks.get(depId);
      return depTask && !isTaskCompleted(depTask);
    });
  }
  
  /**
   * Check if a task is blocking others (has incomplete dependents)
   */
  isTaskBlocking(taskId: string): boolean {
    const dependents = this.reverseEdges.get(taskId);
    if (!dependents || dependents.size === 0) {
      return false;
    }
    
    const task = this.tasks.get(taskId);
    if (!task || isTaskCompleted(task)) {
      return false; // Completed tasks don't block
    }
    
    // Check if any dependent is waiting on this task
    return Array.from(dependents).some(depId => {
      const depTask = this.tasks.get(depId);
      return depTask && !isTaskCompleted(depTask);
    });
  }
  
  /**
   * Get all tasks that are currently blocked
   */
  getBlockedTasks(): Task[] {
    const blocked: Task[] = [];
    
    for (const [taskId, task] of this.tasks) {
      if (this.isTaskBlocked(taskId)) {
        blocked.push(task);
      }
    }
    
    return blocked;
  }
  
  /**
   * Get all tasks that are blocking others
   */
  getBlockingTasks(): Task[] {
    const blocking: Task[] = [];
    
    for (const [taskId, task] of this.tasks) {
      if (this.isTaskBlocking(taskId)) {
        blocking.push(task);
      }
    }
    
    return blocking;
  }
  
  /**
   * Perform comprehensive dependency analysis
   */
  analyze(): DependencyAnalysis {
    const blockedTasks = new Set<string>();
    const blockingTasks = new Set<string>();
    const depths = new Map<string, number>();
    
    // Find blocked and blocking tasks
    for (const [taskId, task] of this.tasks) {
      if (this.isTaskBlocked(taskId)) {
        blockedTasks.add(taskId);
      }
      if (this.isTaskBlocking(taskId)) {
        blockingTasks.add(taskId);
      }
    }
    
    // Detect cycles
    const cycles = this.detectCycles();
    
    // Calculate depths (distance from root tasks)
    this.calculateDepths(depths);
    
    // Topological sort (if no cycles)
    let topologicalOrder: string[] | undefined;
    if (cycles.length === 0) {
      topologicalOrder = this.topologicalSort();
    }
    
    return {
      blockedTasks,
      blockingTasks,
      cycles,
      depths,
      topologicalOrder,
    };
  }
  
  /**
   * Calculate dependency depth for each task
   * Depth = max distance from a root task (task with no dependencies)
   */
  private calculateDepths(depths: Map<string, number>): void {
    const visited = new Set<string>();
    
    const dfs = (taskId: string): number => {
      if (depths.has(taskId)) {
        return depths.get(taskId)!;
      }
      
      if (visited.has(taskId)) {
        return 0; // Cycle detected, return 0
      }
      
      visited.add(taskId);
      
      const dependencies = this.edges.get(taskId);
      let maxDepth = 0;
      
      if (dependencies && dependencies.size > 0) {
        for (const depId of dependencies) {
          const depDepth = dfs(depId);
          maxDepth = Math.max(maxDepth, depDepth + 1);
        }
      }
      
      depths.set(taskId, maxDepth);
      visited.delete(taskId);
      
      return maxDepth;
    };
    
    for (const taskId of this.edges.keys()) {
      if (!depths.has(taskId)) {
        dfs(taskId);
      }
    }
  }
  
  /**
   * Topological sort using Kahn's algorithm
   * Returns task IDs in dependency order (roots first)
   */
  topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    const result: string[] = [];
    const queue: string[] = [];
    
    // Calculate in-degree for each node
    for (const taskId of this.edges.keys()) {
      inDegree.set(taskId, 0);
    }
    
    for (const [taskId, dependencies] of this.edges) {
      for (const depId of dependencies) {
        inDegree.set(depId, (inDegree.get(depId) || 0) + 1);
      }
    }
    
    // Find all nodes with in-degree 0 (roots)
    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }
    
    // Process queue
    while (queue.length > 0) {
      const taskId = queue.shift()!;
      result.push(taskId);
      
      const dependencies = this.edges.get(taskId);
      if (dependencies) {
        for (const depId of dependencies) {
          const newDegree = (inDegree.get(depId) || 0) - 1;
          inDegree.set(depId, newDegree);
          
          if (newDegree === 0) {
            queue.push(depId);
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Update graph with new tasks
   */
  updateTasks(tasks: Map<string, Task>): void {
    this.tasks = tasks;
    this.buildGraph();
  }
  
  /**
   * Add a single task to the graph
   */
  addTask(task: Task): void {
    const taskId = task.taskId || task.id;
    this.tasks.set(taskId, task);
    this.buildGraph(); // Rebuild for simplicity (optimize later if needed)
  }
  
  /**
   * Remove a task from the graph
   */
  removeTask(taskId: string): void {
    this.tasks.delete(taskId);
    this.buildGraph();
  }
  
  /**
   * Validate a new dependency before adding
   * Returns error message if invalid, null if valid
   */
  validateDependency(fromTaskId: string, toTaskId: string): string | null {
    // Check self-reference
    if (fromTaskId === toTaskId) {
      return 'A task cannot depend on itself';
    }
    
    // Check if target task exists
    if (!this.tasks.has(toTaskId)) {
      return `Dependency task ${toTaskId} not found`;
    }
    
    // Check for circular dependency
    if (this.wouldCreateCycle(fromTaskId, toTaskId)) {
      const path = this.findCyclePath(fromTaskId, toTaskId);
      return `Circular dependency detected: ${path.join(' → ')}`;
    }
    
    return null; // Valid
  }
  
  /**
   * Find the path that would create a cycle
   */
  private findCyclePath(fromTaskId: string, toTaskId: string): string[] {
    const path: string[] = [];
    const visited = new Set<string>();
    
    const dfs = (current: string, target: string): boolean => {
      if (current === target) {
        path.push(current);
        return true;
      }
      
      visited.add(current);
      path.push(current);
      
      const dependencies = this.edges.get(current);
      if (dependencies) {
        for (const depId of dependencies) {
          if (!visited.has(depId)) {
            if (dfs(depId, target)) {
              return true;
            }
          }
        }
      }
      
      path.pop();
      return false;
    };
    
    dfs(toTaskId, fromTaskId);
    path.push(toTaskId); // Close the cycle
    
    return path;
  }
  
  /**
   * Get dependency chain for a task (path to root)
   */
  getDependencyChain(taskId: string): string[][] {
    const chains: string[][] = [];
    const visited = new Set<string>();
    
    const dfs = (current: string, path: string[]): void => {
      if (visited.has(current)) {
        return; // Avoid cycles
      }
      
      visited.add(current);
      const newPath = [...path, current];
      
      const dependencies = this.edges.get(current);
      if (!dependencies || dependencies.size === 0) {
        // Reached a root, save the chain
        chains.push(newPath);
      } else {
        for (const depId of dependencies) {
          dfs(depId, newPath);
        }
      }
      
      visited.delete(current);
    };
    
    dfs(taskId, []);
    
    return chains;
  }
}
