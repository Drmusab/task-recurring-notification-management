import { Grouper } from "@backend/core/query/groupers/GrouperBase";
import type { Task } from '@backend/core/models/Task';

export class DueDateGrouper extends Grouper {
  getGroupKey(task: Task): string {
    if (!task.dueAt) {
      return 'No due date';
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(task.dueAt);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'Overdue';
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays <= 7) {
      return 'This Week';
    } else {
      return 'Later';
    }
  }
}

export class ScheduledDateGrouper extends Grouper {
  getGroupKey(task: Task): string {
    if (!task.scheduledAt) {
      return 'No scheduled date';
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const scheduledDate = new Date(task.scheduledAt);
    scheduledDate.setHours(0, 0, 0, 0);

    const diffTime = scheduledDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'Past';
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays <= 7) {
      return 'This Week';
    } else {
      return 'Later';
    }
  }
}
