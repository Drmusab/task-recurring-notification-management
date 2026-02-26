import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';
import { RegexMatcher, type RegexSpec } from "@backend/core/query/utils/RegexMatcher";

/**
 * Filter tasks by description using regex
 * Searches both task.name and task.description fields
 */
export class DescriptionRegexFilter extends Filter {
  private re: RegExp | undefined;

  constructor(spec: RegexSpec, private negate = false) {
    super();
    try {
      this.re = RegexMatcher.compile(spec);
    } catch {
      this.re = undefined;
    }
  }

  matches(task: Task): boolean {
    if (!this.re) {
      return this.negate ? true : false;
    }
    // Combine name and description for searching
    const description = `${task.name || ''} ${task.description || ''}`.trim();
    const result = RegexMatcher.test(this.re, description);
    return this.negate ? !result : result;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    const source = this.re?.source ?? '(invalid)';
    return this.negate ? `description does NOT match regex /${source}/` : `description matches regex /${source}/`;
  }

  explainMatch(task: Task): string {
    const description = `${task.name || ''} ${task.description || ''}`.trim();
    const preview = description.length > 50 ? description.substring(0, 50) + '...' : description;
    const source = this.re?.source ?? '(invalid)';
    if (this.negate) {
      return `Task "${task.name}" text "${preview}" does NOT match regex /${source}/`;
    }
    return `Task "${task.name}" text "${preview}" matches regex /${source}/`;
  }

  explainMismatch(task: Task): string {
    const description = `${task.name || ''} ${task.description || ''}`.trim();
    const preview = description.length > 50 ? description.substring(0, 50) + '...' : description;
    const source = this.re?.source ?? '(invalid)';
    if (this.negate) {
      return `Task "${task.name}" text "${preview}" matches regex /${source}/ (expected no match)`;
    }
    return `Task "${task.name}" text "${preview}" does NOT match regex /${source}/`;
  }
}
