import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';

/**
 * Simple dependency graph for checking task blocking relationships
 */
export interface DependencyGraph {
  isBlocked(taskId: string): boolean;
  isBlocking(taskId: string): boolean;
}

export class IsBlockedFilter extends Filter {
  constructor(private dependencyGraph: DependencyGraph | null, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    if (!this.dependencyGraph) {
      // If no dependency graph, check blockedBy field
      const isBlocked = task.blockedBy && task.blockedBy.length > 0;
      return this.negate ? !isBlocked : !!isBlocked;
    }
    
    const result = this.dependencyGraph.isBlocked(task.id);
    return this.negate ? !result : result;
  }
}

export class IsBlockingFilter extends Filter {
  constructor(private dependencyGraph: DependencyGraph | null, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    if (!this.dependencyGraph) {
      // If no dependency graph, check if this task has any dependsOn relationships
      // by checking if other tasks reference this task (would need reverse lookup)
      // For now, return false as we can't determine without full graph
      return this.negate ? true : false;
    }
    
    const result = this.dependencyGraph.isBlocking(task.id);
    return this.negate ? !result : result;
  }
}

/**
 * Filter: "dependsOn includes <taskId>"
 * Returns tasks that depend on a specific task
 */
export class DependsOnFilter extends Filter {
  constructor(private targetTaskId: string, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    const hasDependency = task.dependsOn && task.dependsOn.includes(this.targetTaskId);
    return this.negate ? !hasDependency : !!hasDependency;
  }
}
