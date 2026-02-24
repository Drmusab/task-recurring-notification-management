/**
 * DependencyGraphAdapter - Adapts DependencyGraph to IDependencyChecker interface
 * 
 * Phase 2: Purity Fix - Provides backend implementation of domain interface
 * 
 * This adapter allows domain query logic to work with backend DependencyGraph
 * without creating a direct coupling.
 */

import type { IDependencyChecker } from '@domain/dependencies/IDependencyChecker';
import type { DependencyGraph } from './DependencyGraph';

/**
 * Adapter that implements domain IDependencyChecker using backend DependencyGraph
 */
export class DependencyGraphAdapter implements IDependencyChecker {
  constructor(private graph: DependencyGraph) {}
  
  /**
   * Check if a task is blocked by incomplete dependencies
   */
  isTaskBlocked(taskId: string): boolean {
    return this.graph.isBlocked(taskId);
  }
  
  /**
   * Check if a task is blocking other tasks
   */
  isTaskBlocking(taskId: string): boolean {
    return this.graph.isBlocking(taskId);
  }
  
  /**
   * Get all tasks that depend on this task
   */
  getDependents(taskId: string, recursive: boolean): Set<string> {
    const index = this.graph.getIndex();
    
    if (recursive) {
      // Get downstream tasks (all transitive dependents)
      return index.getDownstream(taskId, Infinity);
    } else {
      // Get direct dependents only
      const dependents = index.getBlocked(taskId);
      return new Set(dependents);
    }
  }
  
  /**
   * Check if taskA depends on taskB
   */
  hasDependency(taskId: string, dependsOnTaskId: string): boolean {
    const index = this.graph.getIndex();
    const task = index.getTask(taskId);
    if (!task) return false;
    
    return task.dependsOn?.includes(dependsOnTaskId) ?? false;
  }
}
