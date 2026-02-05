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
}
