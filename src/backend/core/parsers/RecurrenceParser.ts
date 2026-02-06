// @ts-nocheck
import type { Frequency } from "@backend/core/models/Frequency";
import { RRule, Frequency as RRuleFreq } from "rrule";

/**
 * Parsed recurrence result
 */
export interface ParsedRecurrence {
  frequency: Frequency;
  raw: string;
  isValid: boolean;
  error?: string;
}

/**
 * Natural language recurrence parser
 * Converts human-readable recurrence strings to Frequency objects
 */
export class RecurrenceParser {
  /**
   * Parse natural language recurrence string to Frequency object
   * 
   * Supported syntax:
   * - every day
   * - every 3 days
   * - every week
   * - every week on Monday
   * - every 2 weeks on Monday, Friday
   * - every month
   * - every month on the 15th
   * - every year
   * - every first Monday
   * - every 2nd Tuesday
   * - every last Friday of the month
   */
  static parse(input: string): ParsedRecurrence {
    const raw = input;
    const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");

    if (!normalized) {
      return {
        frequency: { type: "daily", interval: 1 },
        raw,
        isValid: false,
        error: "Recurrence string cannot be empty",
      };
    }

    // Match "every" pattern
    const everyMatch = normalized.match(/^every\s+(.+)$/);
    if (!everyMatch) {
      return {
        frequency: { type: "daily", interval: 1 },
        raw,
        isValid: false,
        error: "Recurrence must start with 'every'",
      };
    }

    let rest = everyMatch[1];
    
    // Check for "when done" or "when due" suffix
    let whenDone: boolean | undefined = undefined;
    const whenDoneMatch = rest.match(/^(.+?)\s+when\s+done$/);
    const whenDueMatch = rest.match(/^(.+?)\s+when\s+due$/);
    
    if (whenDoneMatch) {
      rest = whenDoneMatch[1];
      whenDone = true;
    } else if (whenDueMatch) {
      rest = whenDueMatch[1];
      whenDone = false;
    }

    // Try to parse "weekday" or "weekend" pattern
    if (rest === 'weekday' || rest === 'weekdays') {
      // Monday=0 to Friday=4
      const weekdays = [0, 1, 2, 3, 4];
      return {
        frequency: { 
          type: "weekly", 
          interval: 1, 
          weekdays, 
          whenDone,
          rruleString: this.buildWeeklyRRuleString(1, weekdays),
          naturalLanguage: raw,
        },
        raw,
        isValid: true,
      };
    }

    if (rest === 'weekend' || rest === 'weekends') {
      // Saturday=5, Sunday=6
      const weekdays = [5, 6];
      return {
        frequency: { 
          type: "weekly", 
          interval: 1, 
          weekdays, 
          whenDone,
          rruleString: this.buildWeeklyRRuleString(1, weekdays),
          naturalLanguage: raw,
        },
        raw,
        isValid: true,
      };
    }

    // Ordinal weekday pattern (monthly)
    // Grammar:
    //   every <ordinal> <weekday> [of the month]
    //   <ordinal> := first | second | third | fourth | last | 1st | 2nd | 3rd | 4th
    //   <weekday> := monday|tuesday|wednesday|thursday|friday|saturday|sunday (or abbreviations)
    const ordinalWeekday = this.parseOrdinalWeekdayPattern(rest);
    if (ordinalWeekday.matched) {
      if (ordinalWeekday.error || ordinalWeekday.ordinal === undefined || ordinalWeekday.weekday === undefined) {
        return {
          frequency: { type: "daily", interval: 1, whenDone },
          raw,
          isValid: false,
          error: ordinalWeekday.error || "Invalid ordinal weekday pattern",
        };
      }

      return {
        frequency: {
          type: "monthly",
          interval: 1,
          dayOfMonth: 1,
          whenDone,
          rruleString: this.buildOrdinalRRuleString(ordinalWeekday.weekday, ordinalWeekday.ordinal),
          naturalLanguage: raw,
        },
        raw,
        isValid: true,
      };
    }

    // Try to parse daily pattern: "every [N] day[s]"
    const dailyMatch = rest.match(/^(\d+\s+)?days?$/);
    if (dailyMatch) {
      const interval = dailyMatch[1] ? parseInt(dailyMatch[1]) : 1;
      return {
        frequency: { 
          type: "daily", 
          interval, 
          whenDone,
          rruleString: this.buildDailyRRuleString(interval),
          naturalLanguage: raw,
        },
        raw,
        isValid: true,
      };
    }

    // Try to parse weekly pattern: "every [N] week[s] [on <days>]"
    const weeklyMatch = rest.match(/^(\d+\s+)?weeks?(?:\s+on\s+(.+))?$/);
    if (weeklyMatch) {
      const interval = weeklyMatch[1] ? parseInt(weeklyMatch[1]) : 1;
      const daysStr = weeklyMatch[2];

      if (!daysStr) {
        // No specific days, default to current day of week
        const weekdays = [1]; // Default to Monday
        return {
          frequency: { 
            type: "weekly", 
            interval, 
            weekdays, 
            whenDone,
            rruleString: this.buildWeeklyRRuleString(interval, weekdays),
            naturalLanguage: raw,
          },
          raw,
          isValid: true,
        };
      }

      // Parse day names
      const weekdays = this.parseDayNames(daysStr);
      if (weekdays.length === 0) {
        return {
          frequency: { type: "weekly", interval, weekdays: [1], whenDone },
          raw,
          isValid: false,
          error: "Invalid day names",
        };
      }

      return {
        frequency: { 
          type: "weekly", 
          interval, 
          weekdays, 
          whenDone,
          rruleString: this.buildWeeklyRRuleString(interval, weekdays),
          naturalLanguage: raw,
        },
        raw,
        isValid: true,
      };
    }

    // Try to parse monthly pattern: "every [N] month[s] [on the <day>]"
    const monthlyMatch = rest.match(/^(\d+\s+)?months?(?:\s+on\s+the\s+(\d+)(?:st|nd|rd|th)?)?$/);
    if (monthlyMatch) {
      const interval = monthlyMatch[1] ? parseInt(monthlyMatch[1]) : 1;
      const dayOfMonth = monthlyMatch[2] ? parseInt(monthlyMatch[2]) : 1;

      if (dayOfMonth < 1 || dayOfMonth > 31) {
        return {
          frequency: { type: "monthly", interval, dayOfMonth: 1, whenDone },
          raw,
          isValid: false,
          error: "Day of month must be between 1 and 31",
        };
      }

      return {
        frequency: { 
          type: "monthly", 
          interval, 
          dayOfMonth, 
          whenDone,
          rruleString: this.buildMonthlyRRuleString(interval, dayOfMonth),
          naturalLanguage: raw,
        },
        raw,
        isValid: true,
      };
    }

    // Try to parse yearly pattern: "every [N] year[s]"
    const yearlyMatch = rest.match(/^(\d+\s+)?years?$/);
    if (yearlyMatch) {
      const interval = yearlyMatch[1] ? parseInt(yearlyMatch[1]) : 1;
      return {
        frequency: { 
          type: "yearly", 
          interval, 
          month: 0, 
          dayOfMonth: 1, 
          whenDone,
          rruleString: this.buildYearlyRRuleString(interval),
          naturalLanguage: raw,
        },
        raw,
        isValid: true,
      };
    }

    return {
      frequency: { type: "daily", interval: 1, whenDone },
      raw,
      isValid: false,
      error: "Unrecognized recurrence pattern",
    };
  }

  /**
   * Convert Frequency object to human-readable string
   */
  static stringify(frequency: Frequency): string {
    const ordinalWeekday = this.stringifyOrdinalWeekday(frequency.rruleString);
    if (ordinalWeekday) {
      return frequency.whenDone ? `${ordinalWeekday} when done` : ordinalWeekday;
    }

    const interval = frequency.interval;
    let baseStr: string;

    switch (frequency.type) {
      case "daily":
        baseStr = interval === 1 ? "every day" : `every ${interval} days`;
        break;

      case "weekly": {
        const weekStr = interval === 1 ? "week" : `${interval} weeks`;
        if (frequency.weekdays.length === 0) {
          baseStr = `every ${weekStr}`;
        } else {
          const dayNames = frequency.weekdays.map(d => this.getDayName(d)).join(", ");
          baseStr = `every ${weekStr} on ${dayNames}`;
        }
        break;
      }

      case "monthly": {
        const monthStr = interval === 1 ? "month" : `${interval} months`;
        const daySuffix = this.getDaySuffix(frequency.dayOfMonth);
        baseStr = `every ${monthStr} on the ${frequency.dayOfMonth}${daySuffix}`;
        break;
      }

      case "yearly": {
        const yearStr = interval === 1 ? "year" : `${interval} years`;
        baseStr = `every ${yearStr}`;
        break;
      }

      default:
        baseStr = "every day";
    }
    
    // Append "when done" if present
    if (frequency.whenDone) {
      return `${baseStr} when done`;
    }
    
    return baseStr;
  }

  /**
   * Parse comma-separated day names to weekday numbers
   * Monday=0, Sunday=6
   */
  private static parseDayNames(daysStr: string): number[] {
    const dayMap: Record<string, number> = {
      monday: 0,
      mon: 0,
      tuesday: 1,
      tue: 1,
      wednesday: 2,
      wed: 2,
      thursday: 3,
      thu: 3,
      friday: 4,
      fri: 4,
      saturday: 5,
      sat: 5,
      sunday: 6,
      sun: 6,
    };

    const days = daysStr.split(",").map(d => d.trim().toLowerCase());
    const weekdays: number[] = [];

    for (const day of days) {
      if (day in dayMap) {
        weekdays.push(dayMap[day]);
      }
    }

    return weekdays;
  }

  private static parseOrdinalWeekdayPattern(rest: string): {
    matched: boolean;
    ordinal?: number;
    weekday?: number;
    error?: string;
  } {
    const tokens = rest.split(" ");
    if (tokens.length < 2) {
      return { matched: false };
    }

    const ordinalResult = this.parseOrdinalToken(tokens[0]);
    if (!ordinalResult.matched) {
      return { matched: false };
    }

    if (ordinalResult.error) {
      return { matched: true, error: ordinalResult.error };
    }

    const weekday = this.parseSingleDay(tokens[1]);
    if (weekday === null) {
      return { matched: true, error: "Invalid weekday name" };
    }

    if (tokens.length === 2) {
      return { matched: true, ordinal: ordinalResult.value, weekday };
    }

    if (tokens.length === 5 && tokens[2] === "of" && tokens[3] === "the" && tokens[4] === "month") {
      return { matched: true, ordinal: ordinalResult.value, weekday };
    }

    return {
      matched: true,
      error: "Ordinal weekday pattern must be 'every <ordinal> <weekday>' optionally followed by 'of the month'",
    };
  }

  private static parseOrdinalToken(token: string): {
    matched: boolean;
    value?: number;
    error?: string;
  } {
    const ordinalWords: Record<string, number> = {
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
      last: -1,
    };

    if (token in ordinalWords) {
      return { matched: true, value: ordinalWords[token] };
    }

    const numericMatch = token.match(/^(\d+)(st|nd|rd|th)$/);
    if (!numericMatch) {
      return { matched: false };
    }

    const value = parseInt(numericMatch[1], 10);
    if (value >= 1 && value <= 4) {
      return { matched: true, value };
    }

    return {
      matched: true,
      error: "Ordinal weekday must be first, second, third, fourth, or last",
    };
  }

  private static parseSingleDay(day: string): number | null {
    const dayMap: Record<string, number> = {
      monday: 0,
      mon: 0,
      tuesday: 1,
      tue: 1,
      wednesday: 2,
      wed: 2,
      thursday: 3,
      thu: 3,
      friday: 4,
      fri: 4,
      saturday: 5,
      sat: 5,
      sunday: 6,
      sun: 6,
    };

    if (day in dayMap) {
      return dayMap[day];
    }

    return null;
  }

  private static stringifyOrdinalWeekday(rruleString?: string): string | null {
    if (!rruleString) {
      return null;
    }

    const parts = this.parseRRuleString(rruleString);
    if (!parts || parts.FREQ !== "MONTHLY" || !parts.BYDAY || !parts.BYSETPOS) {
      return null;
    }

    const weekday = this.fromRRuleWeekday(parts.BYDAY);
    if (weekday === null) {
      return null;
    }

    const ordinal = Number.parseInt(parts.BYSETPOS, 10);
    if (!Number.isFinite(ordinal)) {
      return null;
    }

    const ordinalWord = this.ordinalWord(ordinal);
    if (!ordinalWord) {
      return null;
    }

    return `every ${ordinalWord} ${this.getDayName(weekday)}`;
  }

  private static ordinalWord(value: number): string | null {
    switch (value) {
      case 1:
        return "first";
      case 2:
        return "second";
      case 3:
        return "third";
      case 4:
        return "fourth";
      case -1:
        return "last";
      default:
        return null;
    }
  }

  private static buildOrdinalRRuleString(weekday: number, ordinal: number): string {
    return `RRULE:FREQ=MONTHLY;BYDAY=${this.toRRuleWeekday(weekday)};BYSETPOS=${ordinal}`;
  }

  private static toRRuleWeekday(weekday: number): string {
    const weekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
    return weekdays[weekday] || "MO";
  }

  private static fromRRuleWeekday(value: string): number | null {
    const weekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
    const index = weekdays.indexOf(value);
    return index >= 0 ? index : null;
  }

  private static parseRRuleString(rruleString: string): Record<string, string> | null {
    const normalized = rruleString.trim().toUpperCase();
    const rule = normalized.startsWith("RRULE:") ? normalized.slice(6) : normalized;
    if (!rule) {
      return null;
    }

    const entries = rule.split(";");
    const parts: Record<string, string> = {};

    for (const entry of entries) {
      if (!entry) {
        continue;
      }
      const [key, value] = entry.split("=");
      if (!key || !value) {
        return null;
      }
      parts[key] = value;
    }

    return parts;
  }

  /**
   * Get day name from weekday number (0=Monday, 6=Sunday)
   */
  private static getDayName(weekday: number): string {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return days[weekday] || "Monday";
  }

  /**
   * Get ordinal suffix for day of month (1st, 2nd, 3rd, 4th, etc.)
   */
  private static getDaySuffix(day: number): string {
    if (day >= 11 && day <= 13) {
      return "th";
    }
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  }

  /**
   * Build RRULE string for daily recurrence
   */
  private static buildDailyRRuleString(interval: number): string {
    return `FREQ=DAILY;INTERVAL=${interval}`;
  }

  /**
   * Build RRULE string for weekly recurrence
   */
  private static buildWeeklyRRuleString(interval: number, weekdays: number[]): string {
    const byDay = weekdays.map(d => this.toRRuleWeekday(d)).join(',');
    return `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`;
  }

  /**
   * Build RRULE string for monthly recurrence
   */
  private static buildMonthlyRRuleString(interval: number, dayOfMonth: number): string {
    // Use BYMONTHDAY=-1 for last day of month (day 31)
    const byMonthDay = dayOfMonth === 31 ? -1 : dayOfMonth;
    return `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${byMonthDay}`;
  }

  /**
   * Build RRULE string for yearly recurrence
   */
  private static buildYearlyRRuleString(interval: number): string {
    return `FREQ=YEARLY;INTERVAL=${interval}`;
  }
}

/**
 * Backward compatibility wrapper for parseRecurrenceRule
 * Used by InlineTaskParser
 */
export function parseRecurrenceRule(input: string): { error: boolean; message?: string; rule?: string; mode?: string } {
  // Check for "when done" suffix
  const whenDoneMatch = input.match(/^(.+?)\s+when\s+done$/i);
  const cleanInput = whenDoneMatch ? whenDoneMatch[1] : input;
  const mode = whenDoneMatch ? 'done' : 'schedule';
  
  const result = RecurrenceParser.parse(cleanInput);
  
  if (!result.isValid) {
    return {
      error: true,
      message: result.error || 'Invalid recurrence pattern'
    };
  }
  
  return {
    error: false,
    rule: result.frequency.rruleString || '',
    mode: mode
  };
}

/**
 * Backward compatibility wrapper for rruleToText
 * Converts RRULE string to human-readable text
 */
export function rruleToText(rruleString: string): string {
  try {
    // Use RRule library's built-in toText() method
    const rrule = RRule.fromString(rruleString.replace(/^RRULE:/, ''));
    return rrule.toText();
  } catch (error) {
    return rruleString; // Fallback to raw string if parsing fails
  }
}
