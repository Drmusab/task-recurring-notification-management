import { Grouper } from "@backend/core/query/groupers/GrouperBase";
import type { Task } from '@backend/core/models/Task';
import { StatusRegistry } from '@backend/core/models/StatusRegistry';

export class StatusTypeGrouper extends Grouper {
  getGroupKey(task: Task): string {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return status.type;
  }
}

export class StatusNameGrouper extends Grouper {
  getGroupKey(task: Task): string {
    const registry = StatusRegistry.getInstance();
    const statusSymbol = task.statusSymbol || ' ';
    const status = registry.get(statusSymbol);
    return status.name;
  }
}
