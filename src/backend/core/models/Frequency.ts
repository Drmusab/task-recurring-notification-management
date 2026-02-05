/**
 * Frequency types for recurring tasks
 */
export type FrequencyType = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Frequency/Recurrence rule definition
 * 
 * NOTE: Migration to RRULE format in progress. New tasks should use rruleString.
 * Legacy fields (type, interval, etc.) are kept for backward compatibility.
 */
export type Frequency =
  | {
      /** Type of recurrence */
      type: "daily";
      /** Interval multiplier (e.g., every 2 days) */
      interval: number;
      /** Optional fixed time in HH:mm format (e.g., "09:00") */
      time?: string;
      /** Optional anchor date (ISO string) for future recurrence alignment */
      anchorDate?: string;
      /** Optional IANA timezone identifier */
      timezone?: string;
      /** Calculate next occurrence from completion date instead of due date */
      whenDone?: boolean;
      /** RFC 5545 rrule string for complex patterns */
      rruleString?: string;
      /** DTSTART in ISO format (UTC) - required for RRULE */
      dtstart?: string;
      /** Original natural language input */
      naturalLanguage?: string;
    }
  | {
      /** Type of recurrence */
      type: "weekly";
      /** Interval multiplier (e.g., every 2 weeks) */
      interval: number;
      /** For weekly rules: days of week (0-6, Monday-Sunday) */
      weekdays: number[];
      /** Optional fixed time in HH:mm format (e.g., "09:00") */
      time?: string;
      /** Optional anchor date (ISO string) for future recurrence alignment */
      anchorDate?: string;
      /** Optional IANA timezone identifier */
      timezone?: string;
      /** Calculate next occurrence from completion date instead of due date */
      whenDone?: boolean;
      /** RFC 5545 rrule string for complex patterns */
      rruleString?: string;
      /** DTSTART in ISO format (UTC) - required for RRULE */
      dtstart?: string;
      /** Original natural language input */
      naturalLanguage?: string;
    }
  | {
      /** Type of recurrence */
      type: "monthly";
      /** Interval multiplier (e.g., every 2 months) */
      interval: number;
      /** Day of month (1-31) */
      dayOfMonth: number;
      /** Optional fixed time in HH:mm format (e.g., "09:00") */
      time?: string;
      /** Optional anchor date (ISO string) for future recurrence alignment */
      anchorDate?: string;
      /** Optional IANA timezone identifier */
      timezone?: string;
      /** Calculate next occurrence from completion date instead of due date */
      whenDone?: boolean;
      /** RFC 5545 rrule string for complex patterns */
      rruleString?: string;
      /** DTSTART in ISO format (UTC) - required for RRULE */
      dtstart?: string;
      /** Original natural language input */
      naturalLanguage?: string;
    }
  | {
      /** Type of recurrence */
      type: "yearly";
      /** Interval multiplier (e.g., every 2 years) */
      interval: number;
      /** Month of year (0-11, January=0) */
      month: number;
      /** Day of month (1-31) */
      dayOfMonth: number;
      /** Optional fixed time in HH:mm format (e.g., "09:00") */
      time?: string;
      /** Optional anchor date (ISO string) for future recurrence alignment */
      anchorDate?: string;
      /** Optional IANA timezone identifier */
      timezone?: string;
      /** Calculate next occurrence from completion date instead of due date */
      whenDone?: boolean;
      /** RFC 5545 rrule string for complex patterns */
      rruleString?: string;
      /** DTSTART in ISO format (UTC) - required for RRULE */
      dtstart?: string;
      /** Original natural language input */
      naturalLanguage?: string;
    };

/**
 * Creates a default daily frequency
 */
export function createDefaultFrequency(): Frequency {
  return {
    type: "daily",
    interval: 1,
    time: "09:00",
  };
}

/**
 * Validates a frequency object
 */
export function isValidFrequency(frequency: Frequency): boolean {
  if (!frequency || !frequency.type || !frequency.interval) {
    return false;
  }
  
  if (frequency.interval < 1) {
    return false;
  }
  
  if (frequency.type === "weekly") {
    return (
      Array.isArray(frequency.weekdays) &&
      frequency.weekdays.length > 0 &&
      frequency.weekdays.every((day) => day >= 0 && day <= 6)
    );
  }

  if (frequency.type === "monthly") {
    return frequency.dayOfMonth >= 1 && frequency.dayOfMonth <= 31;
  }

  if (frequency.type === "yearly") {
    return (
      frequency.month >= 0 &&
      frequency.month <= 11 &&
      frequency.dayOfMonth >= 1 &&
      frequency.dayOfMonth <= 31
    );
  }
  
  return true;
}
