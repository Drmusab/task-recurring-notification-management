import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';

export type DateComparator = 'before' | 'after' | 'on' | 'on or before' | 'on or after' | 'between';
export type DateField = 'due' | 'scheduled' | 'start' | 'created' | 'done' | 'cancelled';

export class DateComparisonFilter extends Filter {
  constructor(
    private field: DateField,
    private comparator: DateComparator,
    private targetDate: Date,
    private endDate?: Date // For "between" operator
  ) {
    super();
  }

  matches(task: Task): boolean {
    const taskDate = this.getTaskDate(task);
    if (!taskDate) {
      return false;
    }

    // Normalize dates to midnight for comparison
    const target = new Date(this.targetDate);
    target.setHours(0, 0, 0, 0);
    
    const actual = new Date(taskDate);
    actual.setHours(0, 0, 0, 0);

    switch (this.comparator) {
      case 'before':
        return actual < target;
      case 'after':
        return actual > target;
      case 'on':
        return actual.getTime() === target.getTime();
      case 'on or before':
        return actual <= target;
      case 'on or after':
        return actual >= target;
      case 'between':
        if (!this.endDate) {
          return false;
        }
        const end = new Date(this.endDate);
        end.setHours(0, 0, 0, 0);
        return actual >= target && actual <= end;
      default:
        return false;
    }
  }

  private getTaskDate(task: Task): Date | null {
    let dateStr: string | undefined;
    
    switch (this.field) {
      case 'due':
        dateStr = task.dueAt;
        break;
      case 'scheduled':
        dateStr = task.scheduledAt;
        break;
      case 'start':
        dateStr = task.startAt;
        break;
      case 'created':
        dateStr = task.createdAt;
        break;
      case 'done':
        dateStr = task.doneAt;
        break;
      case 'cancelled':
        dateStr = task.cancelledAt;
        break;
    }

    return dateStr ? new Date(dateStr) : null;
  }

  // Phase 1: Query Enhancement - Explanation Support
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]!;
  }

  explain(): string {
    const targetStr = this.formatDate(this.targetDate);
    if (this.comparator === 'between' && this.endDate) {
      const endStr = this.formatDate(this.endDate);
      return `${this.field} between ${targetStr} and ${endStr}`;
    }
    return `${this.field} ${this.comparator} ${targetStr}`;
  }

  explainMatch(task: Task): string {
    const taskDate = this.getTaskDate(task);
    if (!taskDate) {
      return `Task "${task.name}" unexpectedly has no ${this.field} date`;
    }
    const taskDateStr = this.formatDate(taskDate);
    const targetStr = this.formatDate(this.targetDate);
    
    if (this.comparator === 'between' && this.endDate) {
      const endStr = this.formatDate(this.endDate);
      return `Task "${task.name}" has ${this.field} date ${taskDateStr} which is between ${targetStr} and ${endStr}`;
    }
    return `Task "${task.name}" has ${this.field} date ${taskDateStr} which is ${this.comparator} ${targetStr}`;
  }

  explainMismatch(task: Task): string {
    const taskDate = this.getTaskDate(task);
    if (!taskDate) {
      return `Task "${task.name}" has no ${this.field} date`;
    }
    const taskDateStr = this.formatDate(taskDate);
    const targetStr = this.formatDate(this.targetDate);
    
    if (this.comparator === 'between' && this.endDate) {
      const endStr = this.formatDate(this.endDate);
      return `Task "${task.name}" has ${this.field} date ${taskDateStr} which is NOT between ${targetStr} and ${endStr}`;
    }
    return `Task "${task.name}" has ${this.field} date ${taskDateStr} which is NOT ${this.comparator} ${targetStr}`;
  }
}

export class HasDateFilter extends Filter {
  constructor(private field: DateField, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    let hasDate = false;
    
    switch (this.field) {
      case 'due':
        hasDate = !!task.dueAt;
        break;
      case 'scheduled':
        hasDate = !!task.scheduledAt;
        break;
      case 'start':
        hasDate = !!task.startAt;
        break;
      case 'created':
        hasDate = !!task.createdAt;
        break;
      case 'done':
        hasDate = !!task.doneAt;
        break;
      case 'cancelled':
        hasDate = !!task.cancelledAt;
        break;
    }

    return this.negate ? !hasDate : hasDate;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? `does NOT have ${this.field} date` : `has ${this.field} date`;
  }

  explainMatch(task: Task): string {
    if (this.negate) {
      return `Task "${task.name}" does not have a ${this.field} date`;
    }
    return `Task "${task.name}" has a ${this.field} date`;
  }

  explainMismatch(task: Task): string {
    if (this.negate) {
      return `Task "${task.name}" has a ${this.field} date (expected no date)`;
    }
    return `Task "${task.name}" does not have a ${this.field} date (expected to have one)`;
  }
}
