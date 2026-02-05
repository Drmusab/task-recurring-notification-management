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
}
