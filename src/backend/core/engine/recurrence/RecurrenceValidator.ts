// @ts-nocheck
/**
 * RecurrenceValidator - RRULE validation layer
 * 
 * Validates RRULE strings for:
 * - Syntax errors
 * - Impossible rule combinations
 * - Timezone mismatches
 * - Date boundary violations
 */

import { RRule, rrulestr, RRuleSet } from 'rrule';
import type { ValidationResult } from './recurrence.types';
import { extractRRuleOptions } from './utils';
import * as logger from "@backend/logging/logger";

/**
 * RecurrenceValidator provides comprehensive RRULE validation
 */
export class RecurrenceValidator {
  /**
   * Validate an RRULE string with DTSTART
   * @param rruleString - RRULE string to validate
   * @param dtstart - Start date for the rule
   * @param timezone - Optional timezone for validation
   * @returns Validation result with errors and warnings
   */
  validate(rruleString: string, dtstart: Date, timezone?: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!rruleString || typeof rruleString !== 'string') {
      errors.push('RRULE string is required');
      return { valid: false, errors, warnings };
    }

    if (!dtstart || !(dtstart instanceof Date) || isNaN(dtstart.getTime())) {
      errors.push('Valid DTSTART date is required');
      return { valid: false, errors, warnings };
    }

    try {
      // Parse and extract options
      const options = extractRRuleOptions(rruleString);

      // Set dtstart for validation
      options.dtstart = dtstart;

      // Validate COUNT + UNTIL conflict
      if (options.count !== undefined && options.count !== null && 
          options.until !== undefined && options.until !== null) {
        errors.push('Cannot specify both COUNT and UNTIL in the same rule');
      }

      // Validate DTSTART after UNTIL
      if (options.until && dtstart > options.until) {
        errors.push(`DTSTART (${dtstart.toISOString()}) is after UNTIL (${options.until.toISOString()})`);
      }

      // Validate impossible BYMONTHDAY + BYMONTH combinations
      if (options.bymonthday && options.bymonth) {
        const invalids = this.validateMonthDayCombinations(options.bymonthday, options.bymonth);
        if (invalids.length > 0) {
          warnings.push(...invalids);
        }
      }

      // Validate COUNT is positive
      if (options.count !== undefined && options.count !== null && options.count < 1) {
        errors.push('COUNT must be at least 1');
      }

      // Validate INTERVAL is positive
      if (options.interval !== undefined && options.interval !== null && options.interval < 1) {
        errors.push('INTERVAL must be at least 1');
      }

      // Validate timezone consistency
      if (timezone && options.tzid && timezone !== options.tzid) {
        warnings.push(`Timezone mismatch: task timezone (${timezone}) differs from RRULE timezone (${options.tzid})`);
      }

      // Try to create RRule to ensure it's valid
      const rrule = new RRule(options);

      // Check if rule can generate at least one occurrence
      const testOccurrence = rrule.after(dtstart, true);
      
      if (!testOccurrence) {
        // Rule might be expired or invalid
        if (options.until && options.until < new Date()) {
          warnings.push('Rule has expired (UNTIL date is in the past)');
        } else if (options.count === 0) {
          errors.push('Rule with COUNT=0 will never generate occurrences');
        } else {
          warnings.push('Rule may not generate any valid occurrences');
        }
      }

      // Additional validation for specific patterns
      this.validateSpecificPatterns(options, warnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid RRULE format';
      errors.push(message);
      
      logger.error('RRULE validation failed', {
        rruleString,
        error: message
      });

      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Validate BYMONTHDAY + BYMONTH combinations for impossible dates
   * e.g., February 31st, April 31st
   */
  private validateMonthDayCombinations(
    monthdays: number | number[], 
    months: number | number[]
  ): string[] {
    const warnings: string[] = [];
    const daysArray = Array.isArray(monthdays) ? monthdays : [monthdays];
    const monthsArray = Array.isArray(months) ? months : [months];

    // Days in each month (non-leap year)
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    for (const month of monthsArray) {
      // Month is 1-indexed in RRULE (1=January)
      const monthIndex = month - 1;
      if (monthIndex < 0 || monthIndex > 11) continue;

      const maxDays = daysInMonth[monthIndex];
      
      for (const day of daysArray) {
        // Skip negative days (from end of month)
        if (day < 0) continue;
        
        if (day > maxDays) {
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                             'July', 'August', 'September', 'October', 'November', 'December'];
          warnings.push(`Day ${day} does not exist in ${monthNames[monthIndex]} (max ${maxDays} days)`);
        }
      }
    }

    return warnings;
  }

  /**
   * Validate specific RRULE patterns that may cause issues
   */
  private validateSpecificPatterns(options: any, warnings: string[]): void {
    // Warn about very high frequency
    if (options.freq === RRule.HOURLY || options.freq === RRule.MINUTELY || 
        options.freq === RRule.SECONDLY) {
      warnings.push('High-frequency rules (hourly/minutely/secondly) may cause performance issues');
    }

    // Warn about very large COUNT values
    if (options.count && options.count > 1000) {
      warnings.push(`High COUNT value (${options.count}) may cause performance issues`);
    }

    // Warn about BYDAY with MONTHLY frequency without BYSETPOS
    if (options.freq === RRule.MONTHLY && options.byweekday && !options.bysetpos) {
      warnings.push('MONTHLY with BYDAY but no BYSETPOS may produce unexpected results');
    }
  }

  /**
   * Quick validation for RRULE string syntax only
   * Does not check semantic validity
   */
  validateSyntax(rruleString: string): boolean {
    if (!rruleString || typeof rruleString !== 'string') {
      return false;
    }

    try {
      const normalized = rruleString.startsWith('RRULE:') 
        ? rruleString 
        : `RRULE:${rruleString}`;
      
      rrulestr(normalized);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if RRULE has expired (UNTIL in the past or COUNT exhausted)
   */
  isExpired(rruleString: string, dtstart: Date, now: Date = new Date()): boolean {
    try {
      const normalized = rruleString.startsWith('RRULE:') 
        ? rruleString 
        : `RRULE:${rruleString}`;
      
      const parsed = rrulestr(normalized);
      
      let options;
      if (parsed instanceof RRule) {
        options = { ...parsed.origOptions };
      } else if (parsed instanceof RRuleSet) {
        const rrules = parsed.rrules();
        if (rrules && rrules.length > 0) {
          options = { ...rrules[0].origOptions };
        } else {
          return true; // No rules means expired
        }
      } else {
        return false;
      }

      options.dtstart = dtstart;
      const rrule = new RRule(options);

      // Try to get next occurrence after now
      const next = rrule.after(now, false);
      return next === null;
      
    } catch {
      return false; // If we can't parse it, assume not expired
    }
  }
}
