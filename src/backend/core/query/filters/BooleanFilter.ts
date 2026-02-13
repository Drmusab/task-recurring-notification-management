import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';

export class AndFilter extends Filter {
  constructor(private left: Filter, private right: Filter) {
    super();
  }

  matches(task: Task): boolean {
    return this.left.matches(task) && this.right.matches(task);
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return `(${this.left.explain()}) AND (${this.right.explain()})`;
  }

  explainMatch(task: Task): string {
    return `Task "${task.name}" matches both: (${this.left.explainMatch(task)}) AND (${this.right.explainMatch(task)})`;
  }

  explainMismatch(task: Task): string {
    const leftMatches = this.left.matches(task);
    const rightMatches = this.right.matches(task);
    
    if (!leftMatches && !rightMatches) {
      return `Task "${task.name}" matches NEITHER: (${this.left.explainMismatch(task)}) NOR (${this.right.explainMismatch(task)})`;
    } else if (!leftMatches) {
      return `Task "${task.name}" fails first condition: ${this.left.explainMismatch(task)}`;
    } else {
      return `Task "${task.name}" fails second condition: ${this.right.explainMismatch(task)}`;
    }
  }
}

export class OrFilter extends Filter {
  constructor(private left: Filter, private right: Filter) {
    super();
  }

  matches(task: Task): boolean {
    return this.left.matches(task) || this.right.matches(task);
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return `(${this.left.explain()}) OR (${this.right.explain()})`;
  }

  explainMatch(task: Task): string {
    const leftMatches = this.left.matches(task);
    const rightMatches = this.right.matches(task);
    
    if (leftMatches && rightMatches) {
      return `Task "${task.name}" matches BOTH: (${this.left.explainMatch(task)}) AND (${this.right.explainMatch(task)})`;
    } else if (leftMatches) {
      return `Task "${task.name}" matches first condition: ${this.left.explainMatch(task)}`;
    } else {
      return `Task "${task.name}" matches second condition: ${this.right.explainMatch(task)}`;
    }
  }

  explainMismatch(task: Task): string {
    return `Task "${task.name}" matches NEITHER: (${this.left.explainMismatch(task)}) NOR (${this.right.explainMismatch(task)})`;
  }
}

export class NotFilter extends Filter {
  constructor(private inner: Filter) {
    super();
  }

  matches(task: Task): boolean {
    return !this.inner.matches(task);
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return `NOT (${this.inner.explain()})`;
  }

  explainMatch(task: Task): string {
    return `Task "${task.name}" does NOT match: ${this.inner.explainMismatch(task)}`;
  }

  explainMismatch(task: Task): string {
    return `Task "${task.name}" unexpectedly matches: ${this.inner.explainMatch(task)}`;
  }
}
