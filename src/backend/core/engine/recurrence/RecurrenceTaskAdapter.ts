/**
 * Recurrence Task Adapter
 * Maps between Task model and RecurrenceEngine expectations
 * 
 * This adapter bridges the gap between:
 * - The Recurrence interface (domain model)
 * - RecurrenceEngine's expectations
 */

import type { Task } from '../../../../domain/models/Task';
import type { Recurrence } from '../../../../domain/models/Recurrence';

/**
 * Extended frequency interface that RecurrenceEngine uses internally
 * This is what the engine expects
 */
export interface RecurrenceEngineInput {
  rruleString: string;
  dtstart: Date;
  whenDone: boolean;
  timezone?: string;
  time?: { hour: number; minute: number };
}

/**
 * Convert Task's recurrence to RecurrenceEngine input format
 */
export function taskToRecurrenceInput(task: Task): RecurrenceEngineInput | null {
  // Use new recurrence interface if available
  if (task.recurrence) {
    return recurrenceToEngineInput(task.recurrence, task.dueAt || task.createdAt);
  }
  
  // Fall back to legacy frequency if present
  if (task.frequency) {
    // Legacy frequency conversion would go here
    // For now, return null to force migration to new system
    return null;
  }
  
  return null;
}

/**
 * Convert Recurrence interface to RecurrenceEngine input
 */
export function recurrenceToEngineInput(
  recurrence: Recurrence,
  fallbackDate: string
): RecurrenceEngineInput {
  // Parse reference date or fall back to provided date
  let dtstart: Date;
  if (recurrence.referenceDate) {
    dtstart = typeof recurrence.referenceDate === 'string'
      ? new Date(recurrence.referenceDate)
      : recurrence.referenceDate;
  } else {
    dtstart = new Date(fallbackDate);
  }
  
  // Parse time from dtstart if it includes time
  let time: { hour: number; minute: number } | undefined;
  if (dtstart.getHours() !== 0 || dtstart.getMinutes() !== 0) {
    time = {
      hour: dtstart.getHours(),
      minute: dtstart.getMinutes()
    };
  }
  
  return {
    rruleString: recurrence.rrule,
    dtstart,
    whenDone: recurrence.baseOnToday,
    timezone: recurrence.timezone,
    time
  };
}

/**
 * Check if task has valid recurrence
 */
export function hasRecurrence(task: Task): boolean {
  return !!(task.recurrence?.rrule || task.frequency);
}

/**
 * Get RRule string from task (new or legacy)
 */
export function getRRuleString(task: Task): string | null {
  if (task.recurrence?.rrule) {
    return task.recurrence.rrule;
  }
  
  if (task.frequency) {
    // Convert legacy frequency to RRule (basic implementation)
    // This would need to be more sophisticated in production
    return null;
  }
  
  return null;
}

/**
 * Check if recurrence is "when done" mode
 */
export function isWhenDone(task: Task): boolean {
  if (task.recurrence) {
    return task.recurrence.baseOnToday;
  }
  
  if (task.whenDone !== undefined) {
    return task.whenDone;
  }
  
  return false;
}

/**
 * Get timezone from task
 */
export function getTimezone(task: Task): string | undefined {
  return task.recurrence?.timezone || task.timezone;
}

/**
 * Create a standardized Recurrence object from task
 */
export function getTaskRecurrence(task: Task): Recurrence | null {
  if (task.recurrence) {
    return task.recurrence;
  }
  
  // Could convert legacy frequency here if needed
  return null;
}
