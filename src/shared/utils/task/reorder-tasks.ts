// @ts-nocheck
/**
 * Reorder Tasks Utility
 * Helper functions for task reordering
 */

import type { Task } from '@backend/core/models/Task';

/**
 * Update task order after a drag-and-drop operation
 * @param tasks Current task list
 * @param oldIndex Original index of dragged task
 * @param newIndex New index where task was dropped
 * @returns Updated task list with new order
 */
export function updateTaskOrder(
  tasks: Task[],
  oldIndex: number,
  newIndex: number
): Task[] {
  const result = [...tasks];
  const [removed] = result.splice(oldIndex, 1);
  result.splice(newIndex, 0, removed);
  
  // Update order field for all tasks
  return result.map((task, index) => ({
    ...task,
    order: index
  }));
}

/**
 * Ensure all tasks have an order field
 * @param tasks Task list
 * @returns Tasks with order field initialized
 */
export function ensureTaskOrder(tasks: Task[]): Task[] {
  return tasks.map((task, index) => ({
    ...task,
    order: task.order !== undefined ? task.order : index
  }));
}

/**
 * Sort tasks by order, with fallback to creation date
 * @param tasks Task list
 * @returns Sorted task list
 */
export function sortByOrder(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Use order if both have it
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    
    // Fallback to creation date
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
