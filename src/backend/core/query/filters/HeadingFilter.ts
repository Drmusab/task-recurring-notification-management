import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';

/**
 * Filter tasks by document heading/section
 */
export class HeadingFilter extends Filter {
  constructor(
    private operator: 'includes' | 'does not include',
    private pattern: string
  ) {
    super();
  }

  matches(task: Task): boolean {
    const heading = task.heading || '';
    const result = heading.toLowerCase().includes(this.pattern.toLowerCase());
    return this.operator === 'includes' ? result : !result;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return `heading ${this.operator} "${this.pattern}"`;
  }

  explainMatch(task: Task): string {
    const heading = task.heading || '(no heading)';
    return `Task "${task.name}" has heading "${heading}" which ${this.operator} "${this.pattern}"`;
  }

  explainMismatch(task: Task): string {
    const heading = task.heading || '(no heading)';
    const invertedOp = this.operator === 'includes' ? 'does NOT include' : 'includes';
    return `Task "${task.name}" has heading "${heading}" which ${invertedOp} "${this.pattern}"`;
  }
}
