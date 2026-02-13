/**
 * Recurrence Engine - Next Instance Generator (LEGACY)
 * 
 * ⚠️ DEPRECATED: This is the legacy Frequency-based RecurrenceEngine
 * ========================================================================
 * 
 * **Phase 2 Migration Notice:**
 * This file and its functions are DEPRECATED and will be removed in Phase 3.
 * 
 * **Use instead:**
 * ```typescript
 * import { RecurrenceEngine } from '@backend/core/engine/recurrence/RecurrenceEngine';
 * 
 * const engine = new RecurrenceEngine();
 * const nextDate = engine.next(task, referenceDate);
 * ```
 * 
 * **Why deprecated:**
 * - Legacy Frequency-based system replaced by RFC 5545 RRULE standard
 * - Not as accurate for complex recurrence patterns
 * - No timezone support
 * - Performance issues with large date ranges
 * 
 * **Migration Guide:** See PHASE2_UNIFIED_API_CONTRACT.md
 * 
 * ========================================================================
 * 
 * Legacy implementation below - DO NOT USE IN NEW CODE
 * Calculates next due date based on recurrence rules
 * Handles DST transitions, month boundaries, leap years
 * 
 * @deprecated Use RecurrenceEngine from @backend/core/engine/recurrence/RecurrenceEngine
 */

import type { Task, Frequency } from '../models/Task';
import { createTask } from '../models/Task';
import * as DateUtils from '../utils/DateUtils';

// Emit deprecation warning in development
if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
  console.warn(
    '[DEPRECATED] domain/recurrence/RecurrenceEngine is deprecated.\n' +
    'Use @backend/core/engine/recurrence/RecurrenceEngine instead.\n' +
    'See PHASE2_UNIFIED_API_CONTRACT.md for migration guide.'
  );
}

/**
 * Calculate next due date for a recurring task
 * 
 * @deprecated Use RecurrenceEngine.next() instead
 * @param task - The completed task
 * @param fromCompletion - If true, calculate from completion date; if false, from due date
 * @param timezone - User's timezone for calculations
 * @returns Next due date
 */
export function calculateNextDueDate(
  task: Task,
  fromCompletion: boolean = false,
  timezone?: string
): Date | null {
  if (!task.frequency) return null;
  
  const baseDate = fromCompletion && task.doneAt
    ? DateUtils.parseISODate(task.doneAt)
    : task.dueAt
    ? DateUtils.parseISODate(task.dueAt)
    : DateUtils.today(timezone);
  
  const frequency = task.frequency;
  
  switch (frequency.type) {
    case 'daily':
      return calculateNextDaily(baseDate, frequency);
      
    case 'weekly':
      return calculateNextWeekly(baseDate, frequency);
      
    case 'monthly':
      return calculateNextMonthly(baseDate, frequency);
      
    case 'yearly':
      return calculateNextYearly(baseDate, frequency);
      
    case 'custom':
      // TODO: Implement RRule parsing
      return null;
      
    default:
      return null;
  }
}

/**
 * Calculate next daily recurrence
 */
function calculateNextDaily(baseDate: Date, frequency: Frequency): Date {
  const interval = frequency.interval || 1;
  return DateUtils.addDays(baseDate, interval);
}

/**
 * Calculate next weekly recurrence
 */
function calculateNextWeekly(baseDate: Date, frequency: Frequency): Date {
  const interval = frequency.interval || 1;
  
  // If specific days of week are specified
  if (frequency.daysOfWeek && frequency.daysOfWeek.length > 0) {
    // Find next occurrence of one of the specified weekdays
    const sortedDays = [...frequency.daysOfWeek].sort((a, b) => a - b);
    const currentWeekday = baseDate.getDay();
    
    // Try to find a day later in the current week
    const laterToday = sortedDays.find(day => day > currentWeekday);
    
    if (laterToday !== undefined) {
      // Found a later day this week
      return DateUtils.getNextWeekday(baseDate, laterToday, false);
    }
    
    // Otherwise, go to first specified day next week
    const firstDay = sortedDays[0];
    if (firstDay !== undefined) {
      const nextDate = DateUtils.addWeeks(baseDate, interval);
      return DateUtils.getNextWeekday(nextDate, firstDay, false);
    }
  }
  
  // No specific days, just add weeks
  return DateUtils.addWeeks(baseDate, interval);
}

/**
 * Calculate next monthly recurrence
 */
function calculateNextMonthly(baseDate: Date, frequency: Frequency): Date {
  const interval = frequency.interval || 1;
  
  // If specific day of month is specified
  if (frequency.dayOfMonth) {
    return DateUtils.getNextDayOfMonth(baseDate, frequency.dayOfMonth);
  }
  
  // If specific weekday in month (e.g., 2nd Monday)
  if (frequency.daysOfWeek && frequency.daysOfWeek.length > 0 && frequency.rrule) {
    // Parse rrule for nth occurrence
    const nthMatch = frequency.rrule.match(/BYDAY=(\d+)/);
    if (nthMatch && nthMatch[1]) {
      const nthOccurrence = parseInt(nthMatch[1], 10);
      const weekday = frequency.daysOfWeek[0];
      
      if (weekday !== undefined) {
        return calculateNthWeekdayOfMonth(baseDate, weekday, nthOccurrence, interval);
      }
    }
  }
  
  // Default: same day next month(s)
  return DateUtils.addMonths(baseDate, interval);
}

/**
 * Calculate next yearly recurrence
 */
function calculateNextYearly(baseDate: Date, frequency: Frequency): Date {
  const interval = frequency.interval || 1;
  return DateUtils.addYears(baseDate, interval);
}

/**
 * Calculate nth occurrence of weekday in month
 * Example: 2nd Monday, 3rd Friday, etc.
 */
function calculateNthWeekdayOfMonth(
  baseDate: Date,
  weekday: number,
  nthOccurrence: number,
  monthInterval: number
): Date {
  // Start at the beginning of next month
  let targetMonth = new Date(baseDate);
  targetMonth = DateUtils.addMonths(targetMonth, monthInterval);
  targetMonth.setDate(1);
  
  // Find first occurrence of target weekday
  const firstOccurrence = DateUtils.getNextWeekday(targetMonth, weekday, true);
  
  // Add weeks to get to nth occurrence
  const result = DateUtils.addWeeks(firstOccurrence, nthOccurrence - 1);
  
  // Verify we're still in the same month
  if (result.getMonth() !== targetMonth.getMonth()) {
    // Overflowed to next month (e.g., asking for 5th Monday when only 4 exist)
    // Fall back to last occurrence
    return DateUtils.addWeeks(result, -1);
  }
  
  return result;
}

/**
 * Generate next task instance from a completed recurring task
 * 
 * @param completedTask - The task that was just completed
 * @param settings - User settings for recurrence behavior
 * @returns New task instance, or null if recurrence should stop
 */
export function generateNextInstance(
  completedTask: Task,
  settings: {
    recurrenceFromCompletion?: boolean;
    autoCreateNextTask?: boolean;
    keepCompletedRecurring?: boolean;
    timezone?: string;
  }
): Task | null {
  if (!completedTask.frequency) return null;
  if (!settings.autoCreateNextTask) return null;
  
  // Calculate next due date
  const nextDueDate = calculateNextDueDate(
    completedTask,
    settings.recurrenceFromCompletion || false,
    settings.timezone
  );
  
  if (!nextDueDate) return null;
  
  // Create new task instance
  const nextTask = createTask({
    ...completedTask,
    id: undefined, // Generate new ID
    status: 'todo',
    statusSymbol: ' ',
    dueAt: DateUtils.toISODate(nextDueDate),
    doneAt: undefined,
    cancelledAt: undefined,
    completionCount: 0,
    currentStreak: (completedTask.currentStreak || 0) + 1,
    // Increment occurrence index
    occurrenceIndex: (completedTask.occurrenceIndex || 0) + 1,
    // Preserve series ID
    seriesId: completedTask.seriesId || completedTask.id,
  });
  
  // Handle scheduled date
  if (completedTask.scheduledAt && settings.recurrenceFromCompletion) {
    // Remove scheduled date for next instance (user will reschedule as needed)
    nextTask.scheduledAt = undefined;
  } else if (completedTask.scheduledAt) {
    // Keep scheduled date relative to due date
    const scheduledOffset = DateUtils.daysBetween(
      DateUtils.parseISODate(completedTask.scheduledAt),
      DateUtils.parseISODate(completedTask.dueAt || completedTask.scheduledAt)
    );
    const nextScheduled = DateUtils.addDays(nextDueDate, scheduledOffset);
    nextTask.scheduledAt = DateUtils.toISODate(nextScheduled);
  }
  
  // Handle start date
  if (completedTask.startAt) {
    const startOffset = DateUtils.daysBetween(
      DateUtils.parseISODate(completedTask.startAt),
      DateUtils.parseISODate(completedTask.dueAt || completedTask.startAt)
    );
    const nextStart = DateUtils.addDays(nextDueDate, startOffset);
    nextTask.startAt = DateUtils.toISODate(nextStart);
  }
  
  return nextTask;
}

/**
 * Check if a recurring task should stop (based on completion count or end date)
 */
export function shouldStopRecurrence(task: Task): boolean {
  if (!task.frequency) return true;
  
  // Check if max occurrences reached
  if (task.frequency.rrule) {
    const countMatch = task.frequency.rrule.match(/COUNT=(\d+)/);
    if (countMatch && countMatch[1]) {
      const maxCount = parseInt(countMatch[1], 10);
      const currentCount = task.occurrenceIndex || 0;
      
      if (currentCount >= maxCount) {
        return true;
      }
    }
    
    // Check if end date reached
    const untilMatch = task.frequency.rrule.match(/UNTIL=([^;]+)/);
    if (untilMatch && untilMatch[1]) {
      const endDate = DateUtils.parseISODate(untilMatch[1]);
      const now = DateUtils.today();
      
      if (now >= endDate) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Preview next N occurrences of a recurring task
 * Useful for displaying upcoming instances to user
 */
export function previewNextOccurrences(
  task: Task,
  count: number,
  fromCompletion: boolean = false,
  timezone?: string
): Date[] {
  if (!task.frequency) return [];
  
  const occurrences: Date[] = [];
  let currentTask = { ...task };
  
  for (let i = 0; i < count; i++) {
    const nextDate = calculateNextDueDate(currentTask, fromCompletion, timezone);
    
    if (!nextDate) break;
    
    occurrences.push(nextDate);
    
    // Update for next iteration
    currentTask = {
      ...currentTask,
      dueAt: DateUtils.toISODate(nextDate),
    };
  }
  
  return occurrences;
}
