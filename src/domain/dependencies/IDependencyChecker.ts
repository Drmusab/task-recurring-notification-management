/**
 * IDependencyChecker - Domain interface for dependency checking
 * 
 * Phase 2: Purity Fix - Extracts dependency checking contract to domain
 * Phase 7: Enhanced with cycle detection and advanced dependency operations
 * 
 * This allows domain query logic to check dependencies without coupling to backend implementation.
 * 
 * Implementation provided by backend (DependencyGraph adapter).
 */

/**
 * Dependency cycle information
 */
export interface DependencyCycleInfo {
  readonly hasCycle: boolean;
  readonly cyclePath?: readonly string[];
}

/**
 * Interface for checking task dependencies
 * 
 * This is a pure domain abstraction - no implementation details.
 * Backend provides concrete implementation via adapter pattern.
 */
export interface IDependencyChecker {
  /**
   * Check if a task is blocked by incomplete dependencies
   * @param taskId - Task identifier (taskId or id)
   * @returns true if task has incomplete dependencies blocking it
   */
  isTaskBlocked(taskId: string): boolean;
  
  /**
   * Check if a task is blocking other tasks
   * @param taskId - Task identifier (taskId or id)
   * @returns true if task has dependents waiting on it
   */
  isTaskBlocking(taskId: string): boolean;
  
  /**
   * Get all tasks that depend on this task (dependents)
   * @param taskId - Task identifier (taskId or id)
   * @param recursive - If true, get all downstream dependencies (transitive closure)
   * @returns Set of task IDs that depend on this task
   */
  getDependents(taskId: string, recursive: boolean): Set<string>;
  
  /**
   * Check if taskA depends on taskB
   * @param taskId - Task identifier (taskId or id)
   * @param dependsOnTaskId - Dependency task identifier
   * @returns true if taskA has taskB as a dependency
   */
  hasDependency(taskId: string, dependsOnTaskId: string): boolean;
  
  /**
   * Check if adding a dependency would create a cycle
   * Phase 7: New method for cycle prevention
   * 
   * @param fromTaskId - Task that would depend on toTaskId
   * @param toTaskId - Task that fromTaskId would depend on
   * @returns Cycle information (hasCycle and optional path)
   */
  wouldCreateCycle(fromTaskId: string, toTaskId: string): DependencyCycleInfo;
  
  /**
   * Get all dependencies of a task (tasks it depends on)
   * Phase 7: New method for complete dependency traversal
   * 
   * @param taskId - Task identifier (taskId or id)
   * @param recursive - If true, get all upstream dependencies (transitive closure)
   * @returns Set of task IDs this task depends on
   */
  getDependencies(taskId: string, recursive: boolean): Set<string>;
  
  /**
   * Get actionable tasks (not blocked by incomplete dependencies)
   * Phase 7: New method for finding tasks ready to work on
   * 
   * @param onlyIncomplete - If true, only return incomplete tasks
   * @returns Array of task IDs that are actionable
   */
  getActionableTasks(onlyIncomplete: boolean): readonly string[];
}

/**
 * Null implementation for testing or when dependencies are disabled
 */
export class NullDependencyChecker implements IDependencyChecker {
  isTaskBlocked(_taskId: string): boolean {
    return false;
  }
  
  isTaskBlocking(_taskId: string): boolean {
    return false;
  }
  
  getDependents(_taskId: string, _recursive: boolean): Set<string> {
    return new Set();
  }
  
  hasDependency(_taskId: string, _dependsOnTaskId: string): boolean {
    return false;
  }
  
  wouldCreateCycle(_fromTaskId: string, _toTaskId: string): DependencyCycleInfo {
    return { hasCycle: false };
  }
  
  getDependencies(_taskId: string, _recursive: boolean): Set<string> {
    return new Set();
  }
  
  getActionableTasks(_onlyIncomplete: boolean): readonly string[] {
    return [];
  }
}
