import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';

export class RecurrenceFilter extends Filter {
  constructor(private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    // A task is recurring if it has a frequency defined
    const isRecurring = task.frequency && task.frequency.type !== 'once';
    return this.negate ? !isRecurring : !!isRecurring;
  }
}
