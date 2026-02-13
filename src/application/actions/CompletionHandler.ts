/**
 * Completion Handler - Task Lifecycle Actions
 * Handles status toggle, date auto-population, onCompletion actions
 */

import type { Task, CompletionAction, OnCompletionAction } from '../../domain/models/Task';
import { createTask, isTaskCompleted } from '../../domain/models/Task';
import { StatusRegistry, StatusType } from '../../domain/models/TaskStatus';
import { RecurrenceEngine } from '@backend/core/engine/recurrence/RecurrenceEngine';
import * as DateUtils from '../../domain/utils/DateUtils';

/**
 * @deprecated Legacy function - use RecurrenceEngine.next() instead
 */
function generateNextInstance(task: Task, fromCompletion: boolean = false): Task | null {
  const engine = new RecurrenceEngine();
  const refDate = fromCompletion && task.doneAt 
    ? new Date(task.doneAt) 
    : new Date(task.dueAt || task.createdAt);
  const nextDate = engine.next(task, refDate);
  
  if (!nextDate) return null;
  
  return {
    ...task,
    dueAt: nextDate.toISOString(),
    doneAt: undefined,
    lastCompletedAt: undefined
  };
}

/**
 * Result of toggling a task status
 */
export interface ToggleResult {
  updatedTask: Task;
  nextInstance?: Task;
  shouldDelete: boolean;
  warnings: string[];
}

/**
 * Toggle task status (cycle to next status in registry)
 * 
 * @param task - Task to toggle
 * @param settings - User settings
 * @returns Updated task and any generated recurrence instances
 */
export function toggleTaskStatus(
  task: Task,
  settings: {
    recurrenceFromCompletion?: boolean;
    autoCreateNextTask?: boolean;
    timezone?: string;
  }
): ToggleResult {
  const registry = StatusRegistry.getInstance();
  const currentSymbol = task.statusSymbol || ' ';
  
  // Get next status in toggle cycle
  const nextStatus = registry.getNext(currentSymbol);
  const nextStatusType = nextStatus.type;
  
  // Create updated task
  const updatedTask: Task = {
    ...task,
    statusSymbol: nextStatus.symbol,
    status: registry.mapTypeToStatus(nextStatusType),
    updatedAt: DateUtils.toISODateTime(DateUtils.now(settings.timezone)),
  };
  
  const warnings: string[] = [];
  let nextInstance: Task | undefined;
  let shouldDelete = false;
  
  // Auto-populate dates based on new status
  if (nextStatusType === StatusType.DONE) {
    // Add done date
    updatedTask.doneAt = DateUtils.toISODateTime(DateUtils.now(settings.timezone));
    
    // Update completion metrics
    updatedTask.completionCount = (task.completionCount || 0) + 1;
    
    // Add to completion history
    if (!updatedTask.recentCompletions) {
      updatedTask.recentCompletions = [];
    }
    updatedTask.recentCompletions.push(updatedTask.doneAt);
    
    // Keep only last 10 completions
    if (updatedTask.recentCompletions.length > 10) {
      updatedTask.recentCompletions = updatedTask.recentCompletions.slice(-10);
    }
    
    // Calculate completion delay if task had due date
    if (task.dueAt) {
      const dueDate = DateUtils.parseISODate(task.dueAt);
      const completionDate = DateUtils.now(settings.timezone);
      const delayDays = DateUtils.daysBetween(dueDate, completionDate);
      const delayMinutes = delayDays * 24 * 60;
      
      // Add to detailed history
      if (!updatedTask.completionHistory) {
        updatedTask.completionHistory = [];
      }
      
      updatedTask.completionHistory.push({
        completedAt: updatedTask.doneAt,
        delayMinutes: delayMinutes > 0 ? delayMinutes : undefined,
        context: {
          dayOfWeek: completionDate.getDay(),
          hourOfDay: completionDate.getHours(),
          wasOverdue: delayMinutes > 0,
        },
      });
    }
    
    // Update streak
    if (task.currentStreak === undefined) {
      updatedTask.currentStreak = 1;
    } else {
      updatedTask.currentStreak = task.currentStreak + 1;
    }
    
    if ((updatedTask.currentStreak || 0) > (task.bestStreak || 0)) {
      updatedTask.bestStreak = updatedTask.currentStreak;
    }
    
    // Handle recurring tasks
    if (task.frequency) {
      const next = generateNextInstance(updatedTask, settings?.recurrenceFromCompletion || false);
      nextInstance = next !== null ? next : undefined;
      
      if (!nextInstance) {
        warnings.push('Unable to generate next recurrence instance');
      }
    }
    
    // Handle onCompletion action
    if (task.onCompletion) {
      const action = typeof task.onCompletion === 'string'
        ? task.onCompletion
        : task.onCompletion.action;
      
      if (action === 'delete') {
        shouldDelete = true;
      }
    }
  } else if (nextStatusType === StatusType.CANCELLED) {
    // Add cancelled date
    updatedTask.cancelledAt = DateUtils.toISODateTime(DateUtils.now(settings.timezone));
    
    // Reset streak
    updatedTask.currentStreak = 0;
    
    // Increment miss count
    updatedTask.missCount = (task.missCount || 0) + 1;
    
    // Do NOT generate next recurrence instance for cancelled tasks (by default)
  } else if (nextStatusType === StatusType.TODO || nextStatusType === StatusType.IN_PROGRESS) {
    // Uncompleting a task - clear completion dates
    if (task.doneAt) {
      updatedTask.doneAt = undefined;
    }
    if (task.cancelledAt) {
      updatedTask.cancelledAt = undefined;
    }
  }
  
  return {
    updatedTask,
    nextInstance,
    shouldDelete,
    warnings,
  };
}

/**
 * Mark task as done (shortcut for toggling to done status)
 */
export function markTaskDone(
  task: Task,
  settings: {
    recurrenceFromCompletion?: boolean;
    autoCreateNextTask?: boolean;
    timezone?: string;
  }
): ToggleResult {
  const registry = StatusRegistry.getInstance();
  
  // Find done status
  const doneStatuses = registry.getAll().filter((s) => s.type === StatusType.DONE);
  const doneStatus = doneStatuses[0] || registry.get('x');
  
  // Temporarily override status symbol to force "done"
  const taskWithDoneSymbol = {
    ...task,
    statusSymbol: doneStatus.symbol,
  };
  
  return toggleTaskStatus(taskWithDoneSymbol, settings);
}

/**
 * Execute onCompletion delete action with safety checks
 * 
 * @param task - Task to potentially delete
 * @param hasNestedContent - Whether task has nested content
 * @returns Action result
 */
export interface DeleteActionResult {
  shouldProceed: boolean;
  warning?: string;
  requiresConfirmation: boolean;
}

export function checkDeleteAction(
  task: Task,
  hasNestedContent: boolean
): DeleteActionResult {
  // Safety check: don't delete if has nested content (unless user confirms)
  if (hasNestedContent) {
    return {
      shouldProceed: false,
      warning: `Task "${task.name}" has nested content. Deleting will remove all nested items.`,
      requiresConfirmation: true,
    };
  }
  
  return {
    shouldProceed: true,
    requiresConfirmation: false,
  };
}

/**
 * Apply custom onCompletion action
 */
export function applyOnCompletionAction(
  task: Task,
  onCompletion: CompletionAction | OnCompletionAction,
  hasNestedContent: boolean
): DeleteActionResult {
  const action: CompletionAction = typeof onCompletion === 'string' 
    ? onCompletion 
    : (onCompletion as OnCompletionAction).action;
  
  if (action === 'delete') {
    return checkDeleteAction(task, hasNestedContent);
  }
  
  if (action === 'archive') {
    // Archive action - move to archive storage
    return {
      shouldProceed: true,
      requiresConfirmation: false,
    };
  }
  
  // Default: keep
  return {
    shouldProceed: false,
    requiresConfirmation: false,
  };
}

/**
 * Bulk complete multiple tasks
 * Useful for completing all tasks in a group
 */
export function bulkCompleteTasks(
  tasks: Task[],
  settings: {
    recurrenceFromCompletion?: boolean;
    autoCreateNextTask?: boolean;
    timezone?: string;
  }
): {
  completed: Task[];
  nextInstances: Task[];
  errors: Array<{ taskId: string; error: string }>;
} {
  const completed: Task[] = [];
  const nextInstances: Task[] = [];
  const errors: Array<{ taskId: string; error: string }> = [];
  
  for (const task of tasks) {
    try {
      const result = markTaskDone(task, settings);
      
      completed.push(result.updatedTask);
      
      if (result.nextInstance) {
        nextInstances.push(result.nextInstance);
      }
      
      if (result.warnings.length > 0) {
        errors.push({
          taskId: task.id,
          error: result.warnings.join('; '),
        });
      }
    } catch (error) {
      errors.push({
        taskId: task.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  return {
    completed,
    nextInstances,
    errors,
  };
}
