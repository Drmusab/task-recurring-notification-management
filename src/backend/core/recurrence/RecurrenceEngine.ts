/**
 * RecurrenceEngine - RRule-based recurrence calculation engine
 * Phase 1: Dual-Engine Mode
 * 
 * This engine handles all RRule-based recurrence calculations.
 * It coexists with the legacy Frequency system during the migration period.
 */

import { RRule, RRuleSet, rrulestr, type Options } from 'rrule';
import type { Recurrence, RecurrenceResult, RecurrenceValidation } from '../../../domain/models/Recurrence';
import type { Frequency } from '../models/Frequency';

export class RecurrenceEngine {
  /**
   * Create recurrence from natural language text
   * 
   * @param text Natural language description (e.g., "every Monday", "every 3rd Tuesday")
   * @param referenceDate Reference date for calculations (defaults to today)
   * @returns Recurrence object or null if parsing fails
   * 
   * @example
   * const rec = RecurrenceEngine.fromText("every Monday and Friday");
   * const rec2 = RecurrenceEngine.fromText("every 3rd Tuesday when done");
   */
  static fromText(text: string, referenceDate?: Date): Recurrence | null {
    try {
      // Extract "when done" suffix
      const whenDoneMatch = text.match(/^(.+?)(\s+when\s+done)?$/i);
      if (!whenDoneMatch) return null;

      const ruleText = whenDoneMatch[1]?.trim();
      if (!ruleText) return null;
      
      const baseOnToday = !!whenDoneMatch[2];

      // Try parsing with RRule's natural language parser
      const options = RRule.parseText(ruleText);
      if (!options) return null;

      // Set reference date as start date
      const refDate = referenceDate || new Date();
      options.dtstart = this.toUTCMidnight(refDate);

      const rrule = new RRule(options);

      return {
        rrule: rrule.toString(),
        baseOnToday,
        humanReadable: rrule.toText(),
        referenceDate: refDate,
        originalInput: text,
      };
    } catch (error) {
      console.warn('Failed to parse recurrence text:', text, error);
      return null;
    }
  }

  /**
   * Create recurrence from legacy Frequency object
   * Phase 1: Auto-conversion utility
   * 
   * @param freq Legacy Frequency object
   * @param referenceDate Reference date for calculations
   * @returns Recurrence object
   */
  static fromFrequency(freq: Frequency, referenceDate?: Date): Recurrence {
    const refDate = referenceDate || new Date();
    const options: Partial<Options> = {
      dtstart: this.toUTCMidnight(refDate),
      interval: freq.interval || 1,
    };

    // Map frequency type to RRule frequency
    switch (freq.type) {
      case 'daily':
        options.freq = RRule.DAILY;
        break;

      case 'weekly':
        options.freq = RRule.WEEKLY;
        if ('weekdays' in freq && freq.weekdays && freq.weekdays.length > 0) {
          // Convert weekdays array to RRule format
          // Frequency uses 0=Mon, 6=Sun
          // RRule uses 0=Mon, 6=Sun (same)
          options.byweekday = freq.weekdays;
        }
        break;

      case 'monthly':
        options.freq = RRule.MONTHLY;
        if ('dayOfMonth' in freq && freq.dayOfMonth) {
          options.bymonthday = [freq.dayOfMonth];
        }
        break;

      case 'yearly':
        options.freq = RRule.YEARLY;
        if ('monthOfYear' in freq && typeof freq.monthOfYear === 'number') {
          options.bymonth = [freq.monthOfYear];
        }
        if ('dayOfMonth' in freq && typeof freq.dayOfMonth === 'number') {
          options.bymonthday = [freq.dayOfMonth];
        }
        break;

      default:
        // Default to daily for unknown types
        options.freq = RRule.DAILY;
        break;
    }

    const rrule = new RRule(options);

    return {
      rrule: rrule.toString(),
      baseOnToday: freq.whenDone || false,
      humanReadable: rrule.toText(),
      referenceDate: refDate,
      timezone: freq.timezone,
    };
  }

  /**
   * Calculate next occurrence from a given date
   * 
   * @param recurrence Recurrence configuration
   * @param fromDate Date to calculate from (defaults to now)
   * @returns Next occurrence result or null if no more occurrences
   */
  static calculateNext(
    recurrence: Recurrence,
    fromDate: Date = new Date()
  ): RecurrenceResult | null {
    try {
      const rrule = rrulestr(recurrence.rrule);

      if (recurrence.baseOnToday) {
        // "when done" mode - calculate from completion date
        return this.calculateNextFromToday(rrule, fromDate);
      } else {
        // Standard mode - calculate from reference date
        return this.calculateNextFromReference(rrule, recurrence.referenceDate, fromDate);
      }
    } catch (error) {
      console.error('Failed to calculate next occurrence:', error);
      return null;
    }
  }

  /**
   * Get all occurrences in a date range
   * 
   * @param recurrence Recurrence configuration
   * @param startDate Range start date
   * @param endDate Range end date
   * @returns Array of occurrence dates
   */
  static getOccurrences(
    recurrence: Recurrence,
    startDate: Date,
    endDate: Date
  ): Date[] {
    try {
      const rrule = rrulestr(recurrence.rrule);
      return rrule.between(startDate, endDate, true);
    } catch (error) {
      console.error('Failed to get occurrences:', error);
      return [];
    }
  }

  /**
   * Convert recurrence to human-readable text
   * 
   * @param recurrence Recurrence configuration
   * @returns Human-readable description
   */
  static toText(recurrence: Recurrence): string {
    let text = recurrence.humanReadable;
    if (recurrence.baseOnToday) {
      text += ' when done';
    }
    return text;
  }

  /**
   * Validate RRule string
   * 
   * @param rruleString RRule string to validate
   * @returns Validation result
   */
  static validate(rruleString: string): RecurrenceValidation {
    try {
      const rrule = rrulestr(rruleString);
      
      // Additional validation checks
      const warnings: string[] = [];
      
      // Check for potentially problematic patterns
      const options = rrule.origOptions;
      if (options.bymonthday) {
        const monthDays = Array.isArray(options.bymonthday) ? options.bymonthday : [options.bymonthday];
        if (monthDays.some((d: number) => d > 28)) {
          warnings.push('Monthly occurrence on day > 28 may skip some months');
        }
      }

      return {
        valid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid RRule',
      };
    }
  }

  /**
   * Check if a date matches the recurrence pattern
   * 
   * @param recurrence Recurrence configuration
   * @param date Date to check
   * @returns True if date is a valid occurrence
   */
  static isOccurrence(recurrence: Recurrence, date: Date): boolean {
    try {
      const rrule = rrulestr(recurrence.rrule);
      
      // Get occurrences for the date's day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const occurrences = rrule.between(startOfDay, endOfDay, true);
      return occurrences.length > 0;
    } catch (error) {
      console.error('Failed to check occurrence:', error);
      return false;
    }
  }

  // ===== Private Helper Methods =====

  /**
   * Calculate next occurrence in "when done" mode
   */
  private static calculateNextFromToday(rrule: RRule, today: Date): RecurrenceResult | null {
    // Create new rule based on today as the start date
    const todayRule = new RRule({
      ...rrule.origOptions,
      dtstart: this.toUTCMidnight(today),
    });

    // Get next occurrence after end of today
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const next = todayRule.after(endOfToday, false);
    
    if (!next) return null;

    return {
      nextDate: next,
      isValid: this.isValidOccurrence(next, todayRule),
    };
  }

  /**
   * Calculate next occurrence from reference date
   */
  private static calculateNextFromReference(
    rrule: RRule,
    referenceDate: Date | string | undefined,
    currentDate: Date
  ): RecurrenceResult | null {
    // Get next occurrence after current date
    const endOfCurrent = new Date(currentDate);
    endOfCurrent.setHours(23, 59, 59, 999);

    const next = rrule.after(endOfCurrent, false);
    
    if (!next) return null;

    return {
      nextDate: next,
      isValid: this.isValidOccurrence(next, rrule),
    };
  }

  /**
   * Validate if occurrence is valid (handles edge cases like Feb 31st)
   */
  private static isValidOccurrence(date: Date, rrule: RRule): boolean {
    const options = rrule.origOptions;

    // Check for month day edge cases
    if (options.bymonthday) {
      const monthDays = Array.isArray(options.bymonthday) ? options.bymonthday : [options.bymonthday];
      if (monthDays.length > 0 && monthDays[0] !== undefined) {
        const expectedDay = Math.abs(monthDays[0]);
        const actualDay = date.getDate();

        // If we expect day 31 but got day 3 (overflow), it's invalid
        if (expectedDay > 28 && actualDay < expectedDay) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Convert date to UTC midnight for consistent calculations
   */
  private static toUTCMidnight(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Date(Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      0, 0, 0, 0
    ));
  }
}
