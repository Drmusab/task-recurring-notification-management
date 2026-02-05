import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task, TaskPriority } from '@backend/core/models/Task';
import { normalizePriority } from '@backend/core/models/Task';

// Type for priorities as defined in Task model
export type Priority = TaskPriority;

// Type for spec-defined priority levels (for query language)
export type PriorityLevel = TaskPriority | 'none' | 'urgent';

// Priority weight mapping
const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  lowest: 0,
  low: 1,
  normal: 2,
  medium: 3,
  high: 4,
  highest: 5,
};

// Map Task priority to PriorityLevel
function mapToPriorityLevel(p: string | undefined): TaskPriority {
  return normalizePriority(p) ?? 'normal';
}

function normalizeLevel(level: PriorityLevel): TaskPriority {
  if (level === 'urgent') {
    return 'highest';
  }
  if (level === 'none') {
    return 'normal';
  }
  return level;
}

export class PriorityFilter extends Filter {
  constructor(
    private operator: 'is' | 'above' | 'below' | 'at-least' | 'at-most',
    private level: PriorityLevel
  ) {
    super();
  }

  matches(task: Task): boolean {
    const taskPriority = mapToPriorityLevel(task.priority);
    const taskWeight = PRIORITY_WEIGHTS[taskPriority];
    const targetWeight = PRIORITY_WEIGHTS[normalizeLevel(this.level)];

    switch (this.operator) {
      case 'is':
        return taskWeight === targetWeight;
      case 'above':
        return taskWeight > targetWeight;
      case 'below':
        return taskWeight < targetWeight;
      case 'at-least':
        return taskWeight >= targetWeight;
      case 'at-most':
        return taskWeight <= targetWeight;
      default:
        return false;
    }
  }
}
