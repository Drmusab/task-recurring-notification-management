import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';
import { RegexMatcher, type RegexSpec } from "@backend/core/query/utils/RegexMatcher";

/**
 * Filter tasks by path using regex
 */
export class PathRegexFilter extends Filter {
  private re: RegExp;

  constructor(spec: RegexSpec, private negate = false) {
    super();
    this.re = RegexMatcher.compile(spec);
  }

  matches(task: Task): boolean {
    const path = task.path || '';
    const result = RegexMatcher.test(this.re, path);
    return this.negate ? !result : result;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? `path does NOT match regex /${this.re.source}/` : `path matches regex /${this.re.source}/`;
  }

  explainMatch(task: Task): string {
    const path = task.path || '(no path)';
    if (this.negate) {
      return `Task "${task.name}" path "${path}" does NOT match regex /${this.re.source}/`;
    }
    return `Task "${task.name}" path "${path}" matches regex /${this.re.source}/`;
  }

  explainMismatch(task: Task): string {
    const path = task.path || '(no path)';
    if (this.negate) {
      return `Task "${task.name}" path "${path}" matches regex /${this.re.source}/ (expected no match)`;
    }
    return `Task "${task.name}" path "${path}" does NOT match regex /${this.re.source}/`;
  }
}
