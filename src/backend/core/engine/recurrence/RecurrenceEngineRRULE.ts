import type { Task } from "@backend/core/models/Task";
import type { Frequency } from "@backend/core/models/Frequency";
import { RRule, RRuleSet, rrulestr } from "rrule";
import { getUserTimezone } from "@shared/utils/misc/timezone";
import * as logger from "@shared/utils/misc/logger";
import { MAX_RECOVERY_ITERATIONS } from "@shared/utils/misc/constants";

/**
 * RecurrenceEngine using RFC 5545-compliant RRULE as single source of truth
 * 
 * This is the ONLY module that should import 'rrule' library directly.
 * All other modules must use this adapter to ensure consistent behavior.
 */
export class RecurrenceEngineRRULE {
  // Cache parsed RRule objects for performance
  private rruleCache = new Map<string, RRule>();
  private legacyTaskCounter = 0;

  /**
   * Get next occurrence after a reference date
   * @param task - Task with RRULE
   * @param from - Reference date (completion date for whenDone, dueAt otherwise)
   * @returns Next occurrence or null if series ended
   */
  getNextOccurrence(task: Task, from: Date): Date | null {
    if (!task.frequency?.rruleString) {
      logger.warn("Task has no RRULE string", { taskId: task.id });
      return null;
    }

    try {
      const rrule = this.getRRule(task);
      const baseDate = this.getBaseDate(task, from);
      
      // Get next occurrence after baseDate (false = non-inclusive)
      const next = rrule.after(baseDate, false);
      
      if (!next) {
        return null;
      }

      // Apply fixed time if specified
      return this.applyFixedTime(next, task.frequency);
    } catch (error) {
      logger.error("Failed to get next occurrence", {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get all occurrences in a date range (for calendar views)
   * @param task - Task with RRULE
   * @param from - Start of range
   * @param to - End of range
   * @returns Array of occurrence dates
   */
  getOccurrencesBetween(task: Task, from: Date, to: Date): Date[] {
    if (!task.frequency?.rruleString) {
      logger.warn("Task has no RRULE string", { taskId: task.id });
      return [];
    }

    try {
      const rrule = this.getRRule(task);
      
      // Get all occurrences in range (inclusive)
      const occurrences = rrule.between(from, to, true);
      
      // Apply fixed time if specified
      return occurrences.map(date => this.applyFixedTime(date, task.frequency));
    } catch (error) {
      logger.error("Failed to get occurrences between dates", {
        taskId: task.id,
        from: from.toISOString(),
        to: to.toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Check if a specific date is a valid occurrence
   * @param task - Task with RRULE
   * @param date - Date to check
   * @returns true if date matches RRULE
   */
  isOccurrenceOn(task: Task, date: Date): boolean {
    if (!task.frequency?.rruleString) {
      return false;
    }

    try {
      const rrule = this.getRRule(task);
      
      // Get occurrences on the same day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const occurrences = rrule.between(startOfDay, endOfDay, true);
      return occurrences.length > 0;
    } catch (error) {
      logger.error("Failed to check if date is occurrence", {
        taskId: task.id,
        date: date.toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Validate RRULE string and provide human-readable errors
   * @param rruleString - RRULE to validate
   * @returns { valid: boolean, error?: string }
   */
  validateRRule(rruleString: string): { valid: boolean; error?: string } {
    if (!rruleString || typeof rruleString !== 'string') {
      return { valid: false, error: 'RRULE string is required' };
    }

    try {
      // Normalize RRULE string
      const normalized = rruleString.startsWith('RRULE:') ? rruleString : `RRULE:${rruleString}`;
      
      // Try to parse the RRULE - can return RRule or RRuleSet
      const parsed = rrulestr(normalized);
      
      // Extract options from parsed rule
      let options;
      if (parsed instanceof RRule) {
        options = { ...parsed.origOptions };
      } else if (parsed instanceof RRuleSet) {
        const rrules = parsed.rrules();
        if (rrules && rrules.length > 0) {
          options = { ...rrules[0].origOptions };
        } else {
          return { valid: false, error: 'RRuleSet has no rrules' };
        }
      } else {
        return { valid: false, error: 'Unexpected parsed rule type' };
      }
      
      // Add dtstart if missing for validation
      if (!options.dtstart) {
        options.dtstart = new Date();
      }
      
      const rrule = new RRule(options);
      
      // Basic validation: ensure it can generate at least one occurrence
      const now = new Date();
      const next = rrule.after(now, true);
      
      if (!next) {
        // Check if it's a terminated series (UNTIL or COUNT)
        if (options.until && options.until < now) {
          return { valid: false, error: 'RRULE has expired (UNTIL date is in the past)' };
        }
        if (options.count && options.count === 0) {
          return { valid: false, error: 'RRULE COUNT is 0' };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid RRULE format'
      };
    }
  }

  /**
   * Convert RRULE to human-readable text
   * @param rruleString - RRULE to convert
   * @returns "Every weekday", "Monthly on the 15th", etc.
   */
  toNaturalLanguage(rruleString: string): string {
    if (!rruleString) {
      return '';
    }

    try {
      // Parse the RRULE - rrulestr expects "RRULE:" prefix or just the rule part
      const normalized = rruleString.startsWith('RRULE:') ? rruleString : `RRULE:${rruleString}`;
      const parsed = rrulestr(normalized);
      
      // Extract options from parsed rule
      let options;
      if (parsed instanceof RRule) {
        options = parsed.origOptions;
      } else if (parsed instanceof RRuleSet) {
        // It's an RRuleSet, get the first rrule
        const rrules = parsed.rrules();
        if (rrules && rrules.length > 0) {
          options = rrules[0].origOptions;
        } else {
          return rruleString;
        }
      } else {
        return rruleString;
      }
      
      // Create a new RRule with dtstart to get proper text output
      if (!options.dtstart) {
        options = {...options, dtstart: new Date()}; // Use current date as default
      }
      
      const rrule = new RRule(options);
      return rrule.toText();
    } catch (error) {
      logger.error("Failed to convert RRULE to natural language", {
        rruleString,
        error: error instanceof Error ? error.message : String(error)
      });
      return rruleString;
    }
  }

  /**
   * Get or create cached RRule instance
   */
  private getRRule(task: Task): RRule {
    const cacheKey = `${task.id}:${task.frequency.rruleString}`;
    
    let rrule = this.rruleCache.get(cacheKey);
    if (rrule) {
      return rrule;
    }

    // Normalize RRULE string - rrulestr expects "RRULE:" prefix
    const rruleString = task.frequency.rruleString!;
    const normalized = rruleString.startsWith('RRULE:') ? rruleString : `RRULE:${rruleString}`;
    
    // Parse the RRULE string - rrulestr can return RRule or RRuleSet
    const parsed = rrulestr(normalized);
    
    // Extract options from parsed rule
    let options;
    if (parsed instanceof RRule) {
      options = { ...parsed.origOptions };
    } else if (parsed instanceof RRuleSet) {
      // Extract first rrule from the set
      const rrules = parsed.rrules();
      if (rrules && rrules.length > 0) {
        options = { ...rrules[0].origOptions };
      } else {
        throw new Error('RRuleSet has no rrules');
      }
    } else {
      throw new Error('Unexpected parsed rule type');
    }
    
    // Set dtstart from frequency if available, otherwise use task's dueAt
    if (task.frequency.dtstart) {
      options.dtstart = new Date(task.frequency.dtstart);
    } else if (task.dueAt) {
      options.dtstart = new Date(task.dueAt);
    }
    
    // Set timezone
    const timezone = task.frequency.timezone || task.timezone || getUserTimezone();
    options.tzid = timezone;
    
    // Create new RRule with updated options
    rrule = new RRule(options);
    
    this.rruleCache.set(cacheKey, rrule);
    return rrule;
  }

  /**
   * Determine base date for next occurrence calculation
   * For whenDone tasks, use completion date; otherwise use due date
   */
  private getBaseDate(task: Task, from: Date): Date {
    const whenDone = task.frequency.whenDone ?? task.whenDone ?? false;
    
    if (whenDone) {
      // For whenDone, calculate from the reference date (completion date)
      return from;
    }
    
    // For fixed schedule, calculate from the reference date but maintain original schedule
    return from;
  }

  /**
   * Apply fixed time to a date if specified in frequency
   */
  private applyFixedTime(date: Date, frequency: Frequency): Date {
    if (!frequency.time) {
      return date;
    }

    try {
      const [hours, minutes] = frequency.time.split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return date;
      }

      const result = new Date(date);
      result.setHours(hours, minutes, 0, 0);
      return result;
    } catch (error) {
      logger.warn("Failed to apply fixed time", {
        time: frequency.time,
        error: error instanceof Error ? error.message : String(error)
      });
      return date;
    }
  }

  /**
   * Clear the RRule cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.rruleCache.clear();
  }

  /**
   * Get cache size (useful for monitoring)
   */
  getCacheSize(): number {
    return this.rruleCache.size;
  }

  /**
   * Convert legacy Frequency to RRULE string
   * @private
   */
  private legacyFrequencyToRRule(frequency: Frequency, dtstart: Date): string {
    // Validate frequency type
    const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validFrequencies.includes(frequency.type.toLowerCase())) {
      throw new Error(`Invalid frequency type: ${frequency.type}. Must be one of: ${validFrequencies.join(', ')}`);
    }
    
    const freq = frequency.type.toUpperCase();
    const interval = frequency.interval || 1;
    const parts = [`FREQ=${freq}`, `INTERVAL=${interval}`];

    if (frequency.type === 'weekly' && frequency.weekdays && frequency.weekdays.length > 0) {
      // Map weekdays from Monday=0 to RRule format (MO, TU, WE, etc.)
      const dayMap = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
      const byDay = frequency.weekdays.map(d => dayMap[d]).join(',');
      parts.push(`BYDAY=${byDay}`);
    }

    if (frequency.type === 'monthly' && frequency.dayOfMonth) {
      // If day is 29, 30, or 31, use BYMONTHDAY=-1 for last day of month
      // to match the old RecurrenceEngine behavior of clamping to month end
      if (frequency.dayOfMonth >= 29) {
        parts.push(`BYMONTHDAY=-1`);
      } else {
        parts.push(`BYMONTHDAY=${frequency.dayOfMonth}`);
      }
    }

    if (frequency.type === 'yearly') {
      if (frequency.month !== undefined) {
        parts.push(`BYMONTH=${frequency.month + 1}`); // RRule months are 1-indexed
      }
      if (frequency.dayOfMonth) {
        // Same logic for yearly - use last day of month for 29-31
        if (frequency.dayOfMonth >= 29) {
          parts.push(`BYMONTHDAY=-1`);
        } else {
          parts.push(`BYMONTHDAY=${frequency.dayOfMonth}`);
        }
      }
    }

    return `RRULE:${parts.join(';')}`;
  }

  /**
   * Create a temporary task object for legacy API compatibility
   * @private
   */
  private createLegacyTask(frequency: Frequency, dueAt: Date, options?: { whenDone?: boolean; timezone?: string }): Task {
    return {
      id: this.nextLegacyId(),
      name: `legacy-frequency-${frequency.type}`,
      frequency,
      dueAt: dueAt.toISOString(),
      createdAt: dueAt.toISOString(),
      enabled: true,
      whenDone: options?.whenDone ?? frequency.whenDone ?? false,
      timezone: options?.timezone || frequency.timezone || undefined,
    } as Task;
  }

  /**
   * Legacy API: Calculate the next occurrence date based on frequency
   * @deprecated Use getNextOccurrence with a Task object instead
   * @param currentDue Current due date
   * @param frequency Recurrence rule
   * @param options Optional configuration (completionDate for "when done", whenDone flag override, timezone)
   * @returns Next occurrence date
   */
  calculateNext(
    currentDue: Date, 
    frequency: Frequency,
    options?: { completionDate?: Date; whenDone?: boolean; timezone?: string }
  ): Date {
    // Ensure frequency has rruleString
    const freq = { ...frequency };
    if (!freq.rruleString) {
      freq.rruleString = this.legacyFrequencyToRRule(freq, currentDue);
      freq.dtstart = currentDue.toISOString();
    }

    // Create a minimal task object for the new API
    const tempTask = this.createLegacyTask(freq, currentDue, options);

    // Determine the reference date
    const whenDone = options?.whenDone ?? frequency.whenDone ?? false;
    const from = (whenDone && options?.completionDate) ? options.completionDate : currentDue;

    const next = this.getNextOccurrence(tempTask, from);
    if (!next) {
      // Fallback to adding one day if RRULE returns null
      logger.warn("RecurrenceEngineRRULE.calculateNext: getNextOccurrence returned null, falling back");
      const result = new Date(currentDue);
      result.setDate(result.getDate() + 1);
      return result;
    }

    return next;
  }

  /**
   * Legacy API: Get all occurrences within a date range
   * @deprecated Use getOccurrencesBetween with a Task object instead
   * @param startDate Start of range
   * @param endDate End of range
   * @param frequency Recurrence rule
   * @param firstOccurrence First occurrence date
   * @returns Array of occurrence dates
   */
  getOccurrencesInRange(
    startDate: Date,
    endDate: Date,
    frequency: Frequency,
    firstOccurrence: Date
  ): Date[] {
    // Ensure frequency has rruleString
    const freq = { ...frequency };
    if (!freq.rruleString) {
      freq.rruleString = this.legacyFrequencyToRRule(freq, firstOccurrence);
      freq.dtstart = firstOccurrence.toISOString();
    }

    // Create a minimal task object for the new API
    const tempTask = this.createLegacyTask(freq, firstOccurrence);

    return this.getOccurrencesBetween(tempTask, startDate, endDate);
  }

  /**
   * Legacy API: Get all missed occurrences between two dates
   * @deprecated Use getOccurrencesBetween with a Task object instead
   * @param lastCheckedAt Last time tasks were checked
   * @param now Current time
   * @param frequency Recurrence rule
   * @param firstOccurrence First occurrence date (task creation date)
   * @returns Array of missed occurrence dates
   */
  getMissedOccurrences(
    lastCheckedAt: Date,
    now: Date,
    frequency: Frequency,
    firstOccurrence: Date
  ): Date[] {
    if (lastCheckedAt >= now) {
      return [];
    }

    // Ensure frequency has rruleString
    const freq = { ...frequency };
    if (!freq.rruleString) {
      freq.rruleString = this.legacyFrequencyToRRule(freq, firstOccurrence);
      freq.dtstart = firstOccurrence.toISOString();
    }

    // Create a minimal task object for the new API
    const tempTask = this.createLegacyTask(freq, firstOccurrence);

    // Get all occurrences between lastCheckedAt and now
    const occurrences = this.getOccurrencesBetween(tempTask, lastCheckedAt, now)
      .filter(date => date > lastCheckedAt && date < now);
    if (occurrences.length > MAX_RECOVERY_ITERATIONS) {
      return occurrences.slice(0, MAX_RECOVERY_ITERATIONS);
    }
    return occurrences;
  }

  private nextLegacyId(): string {
    this.legacyTaskCounter += 1;
    return `legacy-${Date.now()}-${this.legacyTaskCounter}`;
  }
}
