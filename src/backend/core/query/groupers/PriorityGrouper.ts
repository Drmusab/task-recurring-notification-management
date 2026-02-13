import { Grouper } from "@backend/core/query/groupers/GrouperBase";
import type { Task } from '@backend/core/models/Task';

export class PriorityGrouper extends Grouper {
  getGroupKey(task: Task): string {
    return (task.priority || 'normal').toLowerCase();
  }
}
