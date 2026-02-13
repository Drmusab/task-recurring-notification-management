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

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? 'is NOT blocked' : 'is blocked';
  }

  explainMatch(task: Task): string {
    if (this.negate) {
      return `Task "${task.name}" is not blocked by any other tasks`;
    }
    const blockers = task.blockedBy || [];
    return `Task "${task.name}" is blocked by ${blockers.length} task(s): ${blockers.join(', ')}`;
  }

  explainMismatch(task: Task): string {
    if (this.negate) {
      const blockers = task.blockedBy || [];
      return `Task "${task.name}" is blocked by ${blockers.length} task(s) (expected unblocked)`;
    }
    return `Task "${task.name}" is not blocked (expected blocked)`;
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

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? 'is NOT blocking other tasks' : 'is blocking other tasks';
  }

  explainMatch(task: Task): string {
    if (this.negate) {
      return `Task "${task.name}" is not blocking any other tasks`;
    }
    return `Task "${task.name}" is blocking other tasks`;
  }

  explainMismatch(task: Task): string {
    if (this.negate) {
      return `Task "${task.name}" is blocking other tasks (expected non-blocking)`;
    }
    return `Task "${task.name}" is not blocking any tasks (expected blocking)`;
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

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? `does NOT depend on task ${this.targetTaskId}` : `depends on task ${this.targetTaskId}`;
  }

  explainMatch(task: Task): string {
    if (this.negate) {
      return `Task "${task.name}" does not depend on task ${this.targetTaskId}`;
    }
    return `Task "${task.name}" depends on task ${this.targetTaskId}`;
  }

  explainMismatch(task: Task): string {
    if (this.negate) {
      return `Task "${task.name}" depends on task ${this.targetTaskId} (expected no dependency)`;
    }
    return `Task "${task.name}" does not depend on task ${this.targetTaskId} (expected dependency)`;
  }
}
