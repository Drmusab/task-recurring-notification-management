import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';
import { RegexMatcher, type RegexSpec } from "@backend/core/query/utils/RegexMatcher";

/**
 * Filter tasks by description using regex
 * Searches both task.name and task.description fields
 */
export class DescriptionRegexFilter extends Filter {
  private re: RegExp;

  constructor(spec: RegexSpec, private negate = false) {
    super();
    this.re = RegexMatcher.compile(spec);
  }

  matches(task: Task): boolean {
    // Combine name and description for searching
    const description = `${task.name || ''} ${task.description || ''}`.trim();
    const result = RegexMatcher.test(this.re, description);
    return this.negate ? !result : result;
  }
}
