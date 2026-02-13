import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';

export class PathFilter extends Filter {
  constructor(private pattern: string, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    const path = task.path || '';
    const result = path.toLowerCase().includes(this.pattern.toLowerCase());
    return this.negate ? !result : result;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? `path does NOT include "${this.pattern}"` : `path includes "${this.pattern}"`;
  }

  explainMatch(task: Task): string {
    const path = task.path || '(no path)';
    if (this.negate) {
      return `Task "${task.name}" has path "${path}" which does NOT include "${this.pattern}"`;
    }
    return `Task "${task.name}" has path "${path}" which includes "${this.pattern}"`;
  }

  explainMismatch(task: Task): string {
    const path = task.path || '(no path)';
    if (this.negate) {
      return `Task "${task.name}" has path "${path}" which includes "${this.pattern}" (expected no match)`;
    }
    return `Task "${task.name}" has path "${path}" which does NOT include "${this.pattern}"`;
  }
}
