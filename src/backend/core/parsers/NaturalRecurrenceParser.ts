import { RRule, RRuleSet, rrulestr } from 'rrule';
import type { Frequency } from '@backend/core/models/Frequency';
import * as logger from '@backend/logging/logger';

/**
 * Parse natural language recurrence strings into Frequency objects
 * Examples:
 * - "every day"
 * - "every 2 weeks on Monday and Wednesday"
 * - "every month on the 15th"
 * - "every year"
 * - "every week when done"
 */
export class NaturalRecurrenceParser {
  private readonly WHEN_DONE_SUFFIX = /\s+when\s+done\s*$/i;
  
  /**
   * Parse natural language to Frequency
   * @param text Natural language recurrence rule (e.g., "every 2 weeks on Monday")
   * @returns Frequency object or null if parsing fails
   */
  parse(text: string): Frequency | null {
    if (!text || typeof text !== 'string') {
      return null;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    // Check for "when done" suffix
    const whenDone = this.WHEN_DONE_SUFFIX.test(trimmed);
    const cleanText = trimmed.replace(this.WHEN_DONE_SUFFIX, '').trim();

    try {
      // Try to parse with RRule.fromText()
      const rrule = RRule.fromText(cleanText);
      
      if (!rrule) {
        return null;
      }

      // Convert RRule to our Frequency type
      const frequency = this.rruleToFrequency(rrule);
      
      if (!frequency) {
        return null;
      }

      // Add whenDone flag if present
      if (whenDone) {
        frequency.whenDone = true;
      }

      // Store original natural language and rrule string
      frequency.naturalLanguage = trimmed;
      frequency.rruleString = rrule.toString();

      return frequency;
    } catch (error) {
      // RRule.fromText() failed, return null
      return null;
    }
  }

  /**
   * Convert Frequency object to natural language
   * @param frequency Frequency object
   * @returns Human-readable string (e.g., "Every 2 weeks on Monday, Wednesday")
   */
  toNaturalLanguage(frequency: Frequency): string {
    // If we have stored natural language, use it
    if (frequency.naturalLanguage) {
      return frequency.naturalLanguage;
    }

    // Otherwise construct from frequency properties
    const { type, interval } = frequency;
    const intervalStr = interval === 1 ? '' : `${interval} `;
    
    let result = `Every ${intervalStr}`;

    switch (type) {
      case 'daily':
        result += interval === 1 ? 'day' : 'days';
        break;
      
      case 'weekly':
        result += interval === 1 ? 'week' : 'weeks';
        if (frequency.weekdays && frequency.weekdays.length > 0) {
          const dayNames = frequency.weekdays.map(d => this.weekdayToName(d));
          result += ` on ${dayNames.join(', ')}`;
        }
        break;
      
      case 'monthly':
        result += interval === 1 ? 'month' : 'months';
        if (frequency.dayOfMonth) {
          result += ` on the ${this.ordinal(frequency.dayOfMonth)}`;
        }
        break;
      
      case 'yearly':
        result += interval === 1 ? 'year' : 'years';
        if (frequency.month !== undefined && frequency.dayOfMonth) {
          const monthName = this.monthToName(frequency.month);
          result += ` on ${monthName} ${this.ordinal(frequency.dayOfMonth)}`;
        }
        break;
    }

    if (frequency.time) {
      result += ` at ${frequency.time}`;
    }

    if (frequency.whenDone) {
      result += ' when done';
    }

    return result;
  }

  /**
   * Validate natural language recurrence string
   * @param text Natural language to validate
   * @returns { valid: boolean; error?: string }
   */
  validate(text: string): { valid: boolean; error?: string } {
    if (!text || typeof text !== 'string') {
      return { valid: false, error: 'Empty input' };
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return { valid: false, error: 'Empty input' };
    }

    // Remove "when done" suffix for validation
    const cleanText = trimmed.replace(this.WHEN_DONE_SUFFIX, '').trim();

    try {
      const rrule = RRule.fromText(cleanText);
      if (!rrule) {
        return { valid: false, error: 'Could not parse recurrence pattern' };
      }
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid recurrence pattern'
      };
    }
  }

  /**
   * Get suggestions based on partial input
   * @param partial Partial input string
   * @returns Array of suggested completions
   */
  getSuggestions(partial: string): string[] {
    const suggestions: string[] = [];
    const lowerPartial = partial.toLowerCase().trim();

    // Basic suggestions
    const basicSuggestions = [
      'every day',
      'every week',
      'every 2 weeks',
      'every month',
      'every year',
      'every weekday',
      'every Monday',
      'every Monday and Wednesday',
      'every month on the 15th',
      'every week when done',
    ];

    // Filter suggestions that start with the partial input
    for (const suggestion of basicSuggestions) {
      if (suggestion.toLowerCase().startsWith(lowerPartial)) {
        suggestions.push(suggestion);
      }
    }

    // If no matches, return all suggestions
    if (suggestions.length === 0 && lowerPartial.length < 3) {
      return basicSuggestions;
    }

    return suggestions;
  }

  /**
   * Convert RRule to our Frequency type
   */
  private rruleToFrequency(rrule: RRule): Frequency | null {
    const options = rrule.options;
    const interval = options.interval || 1;

    switch (options.freq) {
      case RRule.DAILY:
        return {
          type: 'daily',
          interval
        };

      case RRule.WEEKLY: {
        // Convert RRule weekday numbers (0=Monday) to our format (0=Monday, 6=Sunday)
        const weekdays = options.byweekday ? 
          (Array.isArray(options.byweekday) ? options.byweekday : [options.byweekday])
            .map((wd: number | { weekday: number }) => {
              // RRule weekdays can be numbers or Weekday objects
              if (typeof wd === 'number') {
                return wd; // 0=Monday, 1=Tuesday, etc.
              } else if (wd && typeof wd.weekday === 'number') {
                return wd.weekday;
              }
              // Log warning for unexpected weekday format
              logger.warn('Unexpected weekday format in rrule', { weekday: wd });
              return null;
            })
            .filter((wd: number | null) => wd !== null && wd >= 0 && wd <= 6) 
          : [new Date().getDay()]; // Default to today's weekday

        // Ensure we have at least one weekday
        if (weekdays.length === 0) {
          logger.warn('No valid weekdays found in rrule, defaulting to Monday');
          weekdays.push(0); // Default to Monday
        }

        return {
          type: 'weekly',
          interval,
          weekdays
        };
      }

      case RRule.MONTHLY: {
        // Get day of month from bymonthday or default to 1st
        const dayOfMonth = options.bymonthday && options.bymonthday.length > 0
          ? options.bymonthday[0]
          : 1;

        return {
          type: 'monthly',
          interval,
          dayOfMonth
        };
      }

      case RRule.YEARLY: {
        // Get month from bymonth (1-12) and convert to 0-11
        const month = options.bymonth && options.bymonth.length > 0
          ? options.bymonth[0] - 1
          : 0;

        // Get day of month from bymonthday or default to 1st
        const dayOfMonth = options.bymonthday && options.bymonthday.length > 0
          ? options.bymonthday[0]
          : 1;

        return {
          type: 'yearly',
          interval,
          month,
          dayOfMonth
        };
      }

      default:
        return null;
    }
  }

  /**
   * Convert weekday number to name
   */
  private weekdayToName(weekday: number): string {
    const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return names[weekday] || 'Monday';
  }

  /**
   * Convert month number to name
   */
  private monthToName(month: number): string {
    const names = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return names[month] || 'January';
  }

  /**
   * Convert number to ordinal (1 -> 1st, 2 -> 2nd, etc.)
   */
  private ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
}
