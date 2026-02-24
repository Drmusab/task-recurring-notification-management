import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';

export class RecurrenceFilter extends Filter {
  constructor(private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    // A task is recurring if it has an RRule recurrence or a legacy frequency
    const isRecurring = !!(task.recurrence?.rrule) || !!(task.frequency?.type);
    return this.negate ? !isRecurring : isRecurring;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? 'is NOT recurring' : 'is recurring';
  }

  explainMatch(task: Task): string {
    const rrule = task.recurrence?.rrule;
    const freq = task.frequency?.type;
    const detail = rrule ? `rrule: ${rrule}` : `frequency: ${freq || 'none'}`;
    if (this.negate) {
      return `Task "${task.name}" is not recurring (${detail})`;
    }
    return `Task "${task.name}" is recurring (${detail})`;
  }

  explainMismatch(task: Task): string {
    const rrule = task.recurrence?.rrule;
    const freq = task.frequency?.type;
    const detail = rrule ? `rrule: ${rrule}` : `frequency: ${freq || 'none'}`;
    if (this.negate) {
      return `Task "${task.name}" is recurring (${detail}) - expected non-recurring`;
    }
    return `Task "${task.name}" is not recurring (${detail}) - expected recurring`;
  }
}
