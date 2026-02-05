/**
 * Bulk Operations Utility
 * Provides bulk operations for multiple tasks
 */

import type { Task } from '@backend/core/models/Task';
import type { TaskPriority } from '@backend/core/models/Task';

export interface BulkOperationResult {
  success: boolean;
  updatedTasks: Task[];
  error?: string;
}

/**
 * Mark multiple tasks as completed
 */
export function bulkComplete(tasks: Task[]): BulkOperationResult {
  try {
    const updatedTasks = tasks.map(task => ({
      ...task,
      status: 'done' as const,
      enabled: false,
      doneAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    return {
      success: true,
      updatedTasks
    };
  } catch (error) {
    return {
      success: false,
      updatedTasks: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Set priority for multiple tasks
 */
export function bulkSetPriority(tasks: Task[], priority: TaskPriority): BulkOperationResult {
  try {
    const updatedTasks = tasks.map(task => ({
      ...task,
      priority,
      updatedAt: new Date().toISOString()
    }));
    
    return {
      success: true,
      updatedTasks
    };
  } catch (error) {
    return {
      success: false,
      updatedTasks: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Reschedule multiple tasks to a new due date
 */
export function bulkReschedule(tasks: Task[], newDueDate: Date): BulkOperationResult {
  try {
    const updatedTasks = tasks.map(task => ({
      ...task,
      dueAt: newDueDate.toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    return {
      success: true,
      updatedTasks
    };
  } catch (error) {
    return {
      success: false,
      updatedTasks: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete multiple tasks
 * Returns task IDs to be deleted
 */
export function bulkDelete(taskIds: string[]): { success: boolean; taskIds: string[]; error?: string } {
  try {
    return {
      success: true,
      taskIds
    };
  } catch (error) {
    return {
      success: false,
      taskIds: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Cancel/deactivate multiple tasks
 */
export function bulkCancel(tasks: Task[]): BulkOperationResult {
  try {
    const updatedTasks = tasks.map(task => ({
      ...task,
      status: 'cancelled' as const,
      enabled: false,
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    return {
      success: true,
      updatedTasks
    };
  } catch (error) {
    return {
      success: false,
      updatedTasks: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
