import { RecurrencePattern } from "@backend/commands/types/CommandTypes";
import { WebhookError } from "@backend/webhooks/types/Error";

/**
 * Safe recurrence calculation utilities
 * Used by RecurrenceEngine for next occurrence calculation
 */
export class RecurrenceCalculator {
  /**
   * Calculate next occurrence with safety checks
   */
  static calculateNext(
    pattern: RecurrencePattern,
    baseDate: Date,
    maxIterations: number = 1000
  ): Date | null {
    let iterations = 0;
    let candidate = new Date(baseDate);

    // Forward progress verification flag
    const originalTime = baseDate.getTime();

    while (iterations < maxIterations) {
      candidate = this.applyRecurrenceRule(candidate, pattern);

      // CRITICAL: Verify forward progress
      if (candidate.getTime() <= originalTime) {
        throw new WebhookError(
          'RECURRENCE_NO_PROGRESS',
          `RECURRENCE_NO_PROGRESS: Next occurrence (${candidate.toISOString()}) is not after base date (${baseDate.toISOString()})`,
          { baseDate: baseDate.toISOString(), calculated: candidate.toISOString() }
        );
      }

      // Check if candidate is valid (meets all constraints)
      if (this.meetsConstraints(candidate, pattern)) {
        // Check horizon
        if (this.isWithinHorizon(candidate, baseDate, pattern)) {
          return candidate;
        } else {
          return null; // Beyond horizon
        }
      }

      iterations++;
    }

    // Exceeded iteration limit
    throw new WebhookError(
      'RECURRENCE_ITERATION_LIMIT_EXCEEDED',
      `RECURRENCE_ITERATION_LIMIT_EXCEEDED: Exceeded ${maxIterations} iterations calculating next occurrence`,
      {
        maxIterations,
        pattern: pattern.type,
        suggestion: 'Simplify recurrence pattern or reduce constraints',
      }
    );
  }

  /**
   * Apply recurrence rule to get next candidate date
   */
  private static applyRecurrenceRule(date: Date, pattern: RecurrencePattern): Date {
    const next = new Date(date);

    switch (pattern.type) {
      case 'interval':
        return this.applyInterval(next, pattern);
      
      case 'daily':
        next.setDate(next.getDate() + 1);
        return next;
      
      case 'weekly':
        return this.applyWeekly(next, pattern);
      
      case 'monthly':
        return this.applyMonthly(next, pattern);
      
      case 'yearly':
        return this.applyYearly(next, pattern);
      
      default:
        throw new WebhookError('INVALID_RECURRENCE_PATTERN', `Unknown recurrence type: ${pattern.type}`);
    }
  }

  /**
   * Apply interval recurrence
   */
  private static applyInterval(date: Date, pattern: RecurrencePattern): Date {
    const next = new Date(date);
    const interval = pattern.interval !== undefined ? pattern.interval : 1;

    // Validate interval is non-zero (let forward progress check catch negative)
    if (interval === 0) {
      throw new WebhookError('INVALID_RECURRENCE_PATTERN', 'Interval must be positive');
    }

    switch (pattern.unit) {
      case 'minutes':
        next.setMinutes(next.getMinutes() + interval);
        break;
      case 'hours':
        next.setHours(next.getHours() + interval);
        break;
      case 'days':
        next.setDate(next.getDate() + interval);
        break;
      case 'weeks':
        next.setDate(next.getDate() + interval * 7);
        break;
      case 'months':
        next.setMonth(next.getMonth() + interval);
        break;
      case 'years':
        next.setFullYear(next.getFullYear() + interval);
        break;
      default:
        throw new WebhookError('INVALID_RECURRENCE_PATTERN', `Unknown interval unit: ${pattern.unit}`);
    }

    return next;
  }

  /**
   * Apply weekly recurrence
   */
  private static applyWeekly(date: Date, pattern: RecurrencePattern): Date {
    if (!pattern.daysOfWeek || pattern.daysOfWeek.length === 0) {
      throw new WebhookError('INVALID_RECURRENCE_PATTERN', 'Weekly recurrence requires daysOfWeek');
    }

    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const targetDays = pattern.daysOfWeek.map((day) => dayMap[day.toLowerCase()]);
    targetDays.sort((a, b) => a - b);

    const currentDay = date.getDay();
    const next = new Date(date);

    // Find next target day
    let found = false;
    for (const targetDay of targetDays) {
      if (targetDay > currentDay) {
        next.setDate(next.getDate() + (targetDay - currentDay));
        found = true;
        break;
      }
    }

    if (!found) {
      // Wrap to next week
      const firstTargetDay = targetDays[0];
      const daysUntilNext = (7 - currentDay) + firstTargetDay;
      next.setDate(next.getDate() + daysUntilNext);
    }

    return next;
  }

  /**
   * Apply monthly recurrence
   */
  private static applyMonthly(date: Date, pattern: RecurrencePattern): Date {
    if (pattern.dayOfMonth === undefined) {
      throw new WebhookError('INVALID_RECURRENCE_PATTERN', 'Monthly recurrence requires dayOfMonth');
    }

    const next = new Date(date);
    next.setMonth(next.getMonth() + 1);
    
    // Set day first to see if it overflows
    const targetMonth = next.getMonth();
    next.setDate(pattern.dayOfMonth);
    
    // If setting the day caused month to change (overflow), the target day doesn't exist
    // Keep the overflowed date so the constraint check can reject it
    return next;
  }

  /**
   * Apply yearly recurrence
   */
  private static applyYearly(date: Date, pattern: RecurrencePattern): Date {
    if (pattern.monthOfYear === undefined || pattern.dayOfMonth === undefined) {
      throw new WebhookError(
        'INVALID_RECURRENCE_PATTERN',
        'Yearly recurrence requires monthOfYear and dayOfMonth'
      );
    }

    const next = new Date(date);
    next.setFullYear(next.getFullYear() + 1);
    next.setMonth(pattern.monthOfYear - 1); // Month is 0-indexed
    
    // Handle day overflow
    const daysInMonth = new Date(next.getFullYear(), pattern.monthOfYear, 0).getDate();
    const targetDay = Math.min(pattern.dayOfMonth, daysInMonth);
    next.setDate(targetDay);

    return next;
  }

  /**
   * Check if candidate meets all constraints
   */
  private static meetsConstraints(candidate: Date, pattern: RecurrencePattern): boolean {
    // Check start date
    if (pattern.startDate) {
      const start = new Date(pattern.startDate);
      if (candidate < start) {
        return false;
      }
    }

    // Check end date
    if (pattern.endDate) {
      const end = new Date(pattern.endDate);
      if (candidate > end) {
        return false;
      }
    }
    
    // For monthly patterns, check if we got the exact day we wanted
    // (Important for edge cases like Feb 31 which doesn't exist)
    if (pattern.type === 'monthly' && pattern.dayOfMonth !== undefined) {
      if (candidate.getDate() !== pattern.dayOfMonth) {
        return false; // Month doesn't have this day (e.g., Feb 31)
      }
    }

    return true;
  }

  /**
   * Check if candidate is within horizon
   */
  private static isWithinHorizon(
    candidate: Date,
    baseDate: Date,
    pattern: RecurrencePattern
  ): boolean {
    const horizonDays = pattern.horizonDays || 365;
    const maxDate = new Date(baseDate);
    maxDate.setDate(maxDate.getDate() + horizonDays);

    return candidate <= maxDate;
  }
}
