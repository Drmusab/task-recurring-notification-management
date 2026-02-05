import type { Frequency } from "@backend/core/models/Frequency";
import type { Task } from "@backend/core/models/Task";
import { RRule, Weekday } from "rrule";
import { getUserTimezone } from "@shared/utils/date/timezone";
import * as logger from "@backend/logging/logger";

/**
 * Migration utilities for converting legacy Frequency to RRULE format
 */
export class RRuleMigration {
  /**
   * Convert old Frequency to RRULE-based Frequency
   * MUST preserve exact semantics
   */
  static migrateFrequency(oldFreq: Frequency, dtstart?: Date): Frequency {
    // If already has rruleString, validate and return
    if (oldFreq.rruleString) {
      return oldFreq;
    }

    // Generate RRULE from legacy fields
    const rrule = this.legacyToRRule(oldFreq);
    const dtstartISO = dtstart ? dtstart.toISOString() : new Date().toISOString();
    
    return {
      ...oldFreq,
      rruleString: rrule.toString(),
      dtstart: dtstartISO,
      naturalLanguage: rrule.toText(),
      timezone: oldFreq.timezone || getUserTimezone(),
    };
  }

  /**
   * Convert legacy frequency to RRule object
   */
  private static legacyToRRule(freq: Frequency): RRule {
    const options: Partial<Parameters<typeof RRule>[0]> = {
      freq: this.mapFreqType(freq.type),
      interval: freq.interval || 1,
    };

    // Map weekdays for weekly recurrence
    if (freq.type === 'weekly' && freq.weekdays && freq.weekdays.length > 0) {
      options.byweekday = freq.weekdays.map(this.mapWeekday);
    }

    // Monthly: handle dayOfMonth
    if (freq.type === 'monthly' && freq.dayOfMonth) {
      if (freq.dayOfMonth === 31) {
        // Last day of month
        options.bymonthday = -1;
      } else {
        options.bymonthday = freq.dayOfMonth;
      }
    }

    // Yearly: handle month + dayOfMonth
    if (freq.type === 'yearly') {
      if (freq.month !== undefined) {
        options.bymonth = freq.month + 1; // 0-indexed → 1-indexed
      }
      if (freq.dayOfMonth) {
        if (freq.dayOfMonth === 31) {
          options.bymonthday = -1;
        } else {
          options.bymonthday = freq.dayOfMonth;
        }
      }
    }

    return new RRule(options);
  }

  /**
   * Map legacy frequency type to RRule frequency constant
   */
  static mapFreqType(type?: string): number {
    switch (type) {
      case 'daily':
        return RRule.DAILY;
      case 'weekly':
        return RRule.WEEKLY;
      case 'monthly':
        return RRule.MONTHLY;
      case 'yearly':
        return RRule.YEARLY;
      default:
        return RRule.DAILY;
    }
  }

  /**
   * Map our weekday format (0=Monday, 6=Sunday) to RRule weekday
   */
  static mapWeekday(day: number): Weekday {
    // Our format: 0=Monday, 6=Sunday
    // RRule: MO, TU, WE, TH, FR, SA, SU
    const map = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];
    return map[day] || RRule.MO;
  }

  /**
   * Migrate a single task to RRULE format
   * Idempotent - safe to call multiple times
   */
  static migrateTask(task: Task): Task {
    // Skip if already migrated
    if (task.frequency?.rruleString) {
      return task;
    }

    // Skip if no frequency
    if (!task.frequency) {
      return task;
    }

    try {
      // Use task's dueAt as dtstart
      const dtstart = new Date(task.dueAt);
      
      // Migrate frequency
      const newFrequency = this.migrateFrequency(task.frequency, dtstart);
      
      // Store legacy snapshot for rollback
      const legacySnapshot = {
        type: task.frequency.type!,
        interval: task.frequency.interval!,
        weekdays: 'weekdays' in task.frequency ? task.frequency.weekdays : undefined,
        dayOfMonth: 'dayOfMonth' in task.frequency ? task.frequency.dayOfMonth : undefined,
        month: 'month' in task.frequency ? task.frequency.month : undefined,
        migratedAt: new Date().toISOString(),
      };

      return {
        ...task,
        frequency: newFrequency,
        legacyRecurrenceSnapshot: legacySnapshot,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Failed to migrate task ${task.id}:`, error);
      throw error;
    }
  }
}

/**
 * Migrate all tasks to RRULE format
 * Idempotent - safe to run multiple times
 */
export async function migrateAllTasksToRRule(
  tasks: Task[]
): Promise<{ migrated: number; skipped: number; errors: number; migratedTasks: Task[] }> {
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  const migratedTasks: Task[] = [];

  for (const task of tasks) {
    try {
      // Skip if no frequency
      if (!task.frequency) {
        skipped++;
        migratedTasks.push(task);
        continue;
      }

      // Skip if already has rruleString
      if (task.frequency.rruleString) {
        skipped++;
        migratedTasks.push(task);
        continue;
      }

      const migratedTask = RRuleMigration.migrateTask(task);
      migratedTasks.push(migratedTask);
      migrated++;
      
      logger.info(`Migrated task ${task.id} to RRULE format`);
    } catch (error) {
      logger.error(`Failed to migrate task ${task.id}:`, error);
      errors++;
      migratedTasks.push(task); // Keep original task
    }
  }

  logger.info(`RRULE Migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
  return { migrated, skipped, errors, migratedTasks };
}
