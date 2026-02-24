/**
 * iCalendar RRULE (Recurrence Rule) Utility Functions
 * 
 * Provides parsing and building of iCalendar RRULE strings according to RFC 5545.
 * Used for task recurrence configuration in the frontend UI.
 * 
 * @see https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html
 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.10
 */

/**
 * Recurrence frequency types (iCalendar FREQ values)
 */
export type RRuleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/**
 * Weekday abbreviations (iCalendar BYDAY values)
 */
export type RRuleWeekDay = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

/**
 * Recurrence rule structure (subset of iCalendar RRULE properties)
 */
export interface RRuleData {
  /** Recurrence frequency (DAILY, WEEKLY, MONTHLY, YEARLY) */
  frequency: RRuleFrequency | null;
  
  /** Interval between recurrences (default: 1) */
  interval: number;
  
  /** Days of the week (for WEEKLY frequency) */
  byDay?: RRuleWeekDay[];
  
  /** Day of the month (for MONTHLY frequency, 1-31) */
  byMonthDay?: number;
  
  /** Number of occurrences (mutually exclusive with until) */
  count?: number;
  
  /** End date in YYYYMMDD format (mutually exclusive with count) */
  until?: string;
}

/**
 * Parse an iCalendar RRULE string into a structured object.
 * 
 * Supports the following RRULE components:
 * - FREQ: Frequency (DAILY, WEEKLY, MONTHLY, YEARLY)
 * - INTERVAL: Interval between recurrences
 * - BYDAY: Weekdays (SU, MO, TU, WE, TH, FR, SA)
 * - BYMONTHDAY: Day of month (1-31)
 * - COUNT: Number of occurrences
 * - UNTIL: End date (YYYYMMDD or ISO 8601)
 * 
 * @param rrule - iCalendar RRULE string (e.g., "FREQ=DAILY;INTERVAL=2")
 * @returns Parsed recurrence rule object
 * 
 * @example
 * ```typescript
 * parseRRule("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR")
 * // Returns: { frequency: 'WEEKLY', interval: 1, byDay: ['MO', 'WE', 'FR'] }
 * ```
 */
export function parseRRule(rrule: string): RRuleData {
  const rule: RRuleData = {
    frequency: null,
    interval: 1
  };

  if (!rrule) return rule;

  const parts = rrule.split(';');
  parts.forEach((part) => {
    const [key, val] = part.split('=');
    if (!val) return;
    
    switch (key) {
      case 'FREQ':
        rule.frequency = val as RRuleFrequency;
        break;
      case 'INTERVAL':
        rule.interval = parseInt(val, 10);
        break;
      case 'BYDAY':
        rule.byDay = val.split(',') as RRuleWeekDay[];
        break;
      case 'BYMONTHDAY':
        rule.byMonthDay = parseInt(val, 10);
        break;
      case 'COUNT':
        rule.count = parseInt(val, 10);
        break;
      case 'UNTIL':
        rule.until = val;
        break;
    }
  });

  return rule;
}

/**
 * Build an iCalendar RRULE string from a structured object.
 * 
 * Generates a valid iCalendar RRULE string according to RFC 5545 format.
 * Only includes non-empty components in the output.
 * 
 * @param rule - Recurrence rule object
 * @returns iCalendar RRULE string (e.g., "FREQ=DAILY;INTERVAL=2") or empty string if no frequency
 * 
 * @example
 * ```typescript
 * buildRRule({ frequency: 'WEEKLY', interval: 2, byDay: ['MO', 'FR'] })
 * // Returns: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR"
 * ```
 */
export function buildRRule(rule: RRuleData): string {
  if (!rule.frequency) return '';

  const parts: string[] = [`FREQ=${rule.frequency}`];

  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }

  if (rule.byDay && rule.byDay.length > 0) {
    parts.push(`BYDAY=${rule.byDay.join(',')}`);
  }

  if (rule.byMonthDay) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay}`);
  }

  if (rule.count) {
    parts.push(`COUNT=${rule.count}`);
  }

  if (rule.until) {
    parts.push(`UNTIL=${rule.until}`);
  }

  return parts.join(';');
}

/**
 * Validate an RRULE string for basic syntax correctness.
 * 
 * @param rrule - iCalendar RRULE string to validate
 * @returns true if the RRULE has valid structure, false otherwise
 * 
 * @example
 * ```typescript
 * validateRRule("FREQ=DAILY;INTERVAL=2") // true
 * validateRRule("INVALID") // false
 * validateRRule("") // false
 * ```
 */
export function validateRRule(rrule: string): boolean {
  if (!rrule) return false;
  
  try {
    const parsed = parseRRule(rrule);
    return parsed.frequency !== null;
  } catch {
    return false;
  }
}

/**
 * Create an empty RRULE data object with default values.
 * 
 * @returns Empty recurrence rule with interval defaulting to 1
 */
export function createEmptyRRule(): RRuleData {
  return {
    frequency: null,
    interval: 1
  };
}

/**
 * Human-readable weekday labels for UI display.
 */
export const WEEKDAY_LABELS: Record<RRuleWeekDay, { full: string; short: string }> = {
  SU: { full: 'Sunday', short: 'S' },
  MO: { full: 'Monday', short: 'M' },
  TU: { full: 'Tuesday', short: 'T' },
  WE: { full: 'Wednesday', short: 'W' },
  TH: { full: 'Thursday', short: 'T' },
  FR: { full: 'Friday', short: 'F' },
  SA: { full: 'Saturday', short: 'S' }
};

/**
 * Ordered array of all weekdays (Sunday first).
 */
export const ALL_WEEKDAYS: RRuleWeekDay[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * All valid frequency values.
 */
export const ALL_FREQUENCIES: RRuleFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
