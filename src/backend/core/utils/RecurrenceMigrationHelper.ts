/**
 * RecurrenceMigrationHelper - Runtime migration from Frequency to Recurrence
 * 
 * Provides transparent migration support for tasks still using the deprecated
 * Frequency model. Automatically converts to RRULE on-the-fly.
 * 
 * This helper ensures backward compatibility during the transition period.
 */

import type { Task } from '@domain/models/Task';
import type { Recurrence } from '@domain/models/Recurrence';
import { FrequencyConverter } from './FrequencyConverter';
import * as logger from '@backend/logging/logger';

/**
 * Ensure task has recurrence, auto-converting from frequency if needed
 * 
 * @param task Task to check and convert
 * @returns Task with recurrence field populated
 * @throws Error if task has neither frequency nor recurrence
 */
export function ensureRecurrence(task: Task): Task & { recurrence: Recurrence } {
  // Already has recurrence - return as-is
  if (task.recurrence) {
    return task as Task & { recurrence: Recurrence };
  }

  // Has legacy frequency - auto-convert
  if (task.frequency) {
    const result = FrequencyConverter.convertTask(task);
    
    if (result.success && result.recurrence) {
      // Add recurrence to task (non-mutating)
      const migratedTask = { ...task, recurrence: result.recurrence };
      
      logger.info('Auto-converted task from Frequency to Recurrence', {
        taskId: task.id,
        taskName: task.name,
        rrule: result.recurrence.rrule
      });
      
      return migratedTask as Task & { recurrence: Recurrence };
    } else {
      throw new Error(`Failed to convert frequency to recurrence: ${result.error}`);
    }
  }

  // No recurrence information available
  throw new Error(`Task ${task.id} has neither frequency nor recurrence configured`);
}

/**
 * Check if task has recurrence information (either new or legacy)
 * 
 * @param task Task to check
 * @returns True if task has recurrence or frequency
 */
export function hasRecurrence(task: Task): boolean {
  return !!(task.recurrence || task.frequency);
}

/**
 * Get recurrence from task, with auto-conversion if needed
 * Returns null if task has no recurrence information
 * 
 * @param task Task to extract recurrence from
 * @returns Recurrence object or null
 */
export function getRecurrence(task: Task): Recurrence | null {
  try {
    const taskWithRecurrence = ensureRecurrence(task);
    return taskWithRecurrence.recurrence;
  } catch {
    return null;
  }
}
