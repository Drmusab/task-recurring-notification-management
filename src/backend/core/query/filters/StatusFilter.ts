import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';
import { StatusType } from '@backend/core/models/Status';
import { StatusRegistry } from '@backend/core/models/StatusRegistry';

export class StatusTypeFilter extends Filter {
  constructor(private statusType: StatusType, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    const result = status.type === this.statusType;
    return this.negate ? !result : result;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? `status type is NOT ${this.statusType}` : `status type is ${this.statusType}`;
  }

  explainMatch(task: Task): string {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return `Task "${task.name}" has status type ${status.type} ${this.negate ? '(not ' + this.statusType + ')' : '(= ' + this.statusType + ')'}`;
  }

  explainMismatch(task: Task): string {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return `Task "${task.name}" has status type ${status.type} ${this.negate ? '(same as ' + this.statusType + ')' : '(!= ' + this.statusType + ')'}`;
  }
}

export class StatusNameFilter extends Filter {
  constructor(private name: string, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    const result = status.name.toLowerCase().includes(this.name.toLowerCase());
    return this.negate ? !result : result;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? `status name does NOT contain "${this.name}"` : `status name contains "${this.name}"`;
  }

  explainMatch(task: Task): string {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return `Task "${task.name}" has status name "${status.name}" which ${this.negate ? 'does NOT contain' : 'contains'} "${this.name}"`;
  }

  explainMismatch(task: Task): string {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return `Task "${task.name}" has status name "${status.name}" which ${this.negate ? 'contains' : 'does NOT contain'} "${this.name}"`;
  }
}

export class StatusSymbolFilter extends Filter {
  constructor(private symbol: string, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    const statusSymbol = task.statusSymbol || ' ';
    const result = statusSymbol === this.symbol;
    return this.negate ? !result : result;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? `status symbol is NOT '${this.symbol}'` : `status symbol is '${this.symbol}'`;
  }

  explainMatch(task: Task): string {
    const statusSymbol = task.statusSymbol || ' ';
    return `Task "${task.name}" has status symbol '${statusSymbol}' ${this.negate ? '(!= ' + this.symbol + ')' : '(= ' + this.symbol + ')'}`;
  }

  explainMismatch(task: Task): string {
    const statusSymbol = task.statusSymbol || ' ';
    return `Task "${task.name}" has status symbol '${statusSymbol}' ${this.negate ? '(= ' + this.symbol + ')' : '(!= ' + this.symbol + ')'}`;
  }
}

// Convenience filters for common queries
export class DoneFilter extends Filter {
  matches(task: Task): boolean {
    if (task.status) {
      return task.status === 'done';
    }
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return status.type === StatusType.DONE;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return 'task is done';
  }

  explainMatch(task: Task): string {
    return `Task "${task.name}" is marked as done`;
  }

  explainMismatch(task: Task): string {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return `Task "${task.name}" has status ${status.type} (not done)`;
  }
}

export class NotDoneFilter extends Filter {
  matches(task: Task): boolean {
    if (task.status) {
      return task.status !== 'done';
    }
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return status.type !== StatusType.DONE;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return 'task is not done';
  }

  explainMatch(task: Task): string {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return `Task "${task.name}" has status ${status.type} (not done)`;
  }

  explainMismatch(task: Task): string {
    return `Task "${task.name}" is marked as done`;
  }
}
