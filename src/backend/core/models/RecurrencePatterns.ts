import { RRule, Weekday } from 'rrule';
import type { Frequency } from './Frequency';

/**
 * Helper functions for creating common recurrence patterns
 */

// RRule weekday constants mapped to our 0=Monday system
const RRULE_WEEKDAYS = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Create a weekday-only (Monday-Friday) recurrence pattern
 */
export function createWeekdayPattern(time?: string): Frequency {
  // Every weekday = Monday through Friday
  const rrule = new RRule({
    freq: RRule.WEEKLY,
    interval: 1,
    byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR]
  });

  return {
    type: 'weekly',
    interval: 1,
    weekdays: [0, 1, 2, 3, 4], // Monday=0 through Friday=4 in our system
    time: time || '09:00',
    rruleString: rrule.toString(),
    naturalLanguage: 'every weekday'
  };
}

/**
 * Create a weekend-only (Saturday-Sunday) recurrence pattern
 */
export function createWeekendPattern(time?: string): Frequency {
  // Every weekend = Saturday and Sunday
  const rrule = new RRule({
    freq: RRule.WEEKLY,
    interval: 1,
    byweekday: [RRule.SA, RRule.SU]
  });

  return {
    type: 'weekly',
    interval: 1,
    weekdays: [5, 6], // Saturday=5, Sunday=6 in our system
    time: time || '09:00',
    rruleString: rrule.toString(),
    naturalLanguage: 'every weekend'
  };
}

/**
 * Create a "first [weekday] of month" recurrence pattern
 * @param weekday Day of week (0=Monday, 6=Sunday)
 * @param time Optional time in HH:mm format
 */
export function createFirstWeekdayOfMonthPattern(weekday: number, time?: string): Frequency {
  if (weekday < 0 || weekday > 6) {
    throw new Error(`Invalid weekday: ${weekday}. Must be 0-6.`);
  }
  
  // Map weekday number to RRule constant
  let rruleDay;
  switch (weekday) {
    case 0: rruleDay = RRule.MO; break;
    case 1: rruleDay = RRule.TU; break;
    case 2: rruleDay = RRule.WE; break;
    case 3: rruleDay = RRule.TH; break;
    case 4: rruleDay = RRule.FR; break;
    case 5: rruleDay = RRule.SA; break;
    case 6: rruleDay = RRule.SU; break;
    default: throw new Error(`Invalid weekday: ${weekday}`);
  }
  
  const rrule = new RRule({
    freq: RRule.MONTHLY,
    interval: 1,
    byweekday: [rruleDay.nth(1)] // 1st occurrence
  });
  
  return {
    type: 'monthly',
    interval: 1,
    dayOfMonth: 1, // Placeholder, actual day determined by rrule
    time: time || '09:00',
    rruleString: rrule.toString(),
    naturalLanguage: `first ${WEEKDAY_NAMES[weekday]} of month`
  };
}

/**
 * Create a "last [weekday] of month" recurrence pattern
 * @param weekday Day of week (0=Monday, 6=Sunday)
 * @param time Optional time in HH:mm format
 */
export function createLastWeekdayOfMonthPattern(weekday: number, time?: string): Frequency {
  if (weekday < 0 || weekday > 6) {
    throw new Error(`Invalid weekday: ${weekday}. Must be 0-6.`);
  }
  
  // Map weekday number to RRule constant
  let rruleDay;
  switch (weekday) {
    case 0: rruleDay = RRule.MO; break;
    case 1: rruleDay = RRule.TU; break;
    case 2: rruleDay = RRule.WE; break;
    case 3: rruleDay = RRule.TH; break;
    case 4: rruleDay = RRule.FR; break;
    case 5: rruleDay = RRule.SA; break;
    case 6: rruleDay = RRule.SU; break;
    default: throw new Error(`Invalid weekday: ${weekday}`);
  }
  
  const rrule = new RRule({
    freq: RRule.MONTHLY,
    interval: 1,
    byweekday: [rruleDay.nth(-1)] // -1 = last occurrence
  });
  
  return {
    type: 'monthly',
    interval: 1,
    dayOfMonth: 1, // Placeholder, actual day determined by rrule
    time: time || '09:00',
    rruleString: rrule.toString(),
    naturalLanguage: `last ${WEEKDAY_NAMES[weekday]} of month`
  };
}

/**
 * Create a "nth [weekday] of month" recurrence pattern
 * @param weekday Day of week (0=Monday, 6=Sunday)
 * @param nth Which occurrence (1-5, or -1 for last)
 * @param time Optional time in HH:mm format
 */
export function createNthWeekdayOfMonthPattern(weekday: number, nth: number, time?: string): Frequency {
  if (weekday < 0 || weekday > 6) {
    throw new Error(`Invalid weekday: ${weekday}. Must be 0-6.`);
  }
  
  // Map weekday number to RRule constant
  let rruleDay;
  switch (weekday) {
    case 0: rruleDay = RRule.MO; break;
    case 1: rruleDay = RRule.TU; break;
    case 2: rruleDay = RRule.WE; break;
    case 3: rruleDay = RRule.TH; break;
    case 4: rruleDay = RRule.FR; break;
    case 5: rruleDay = RRule.SA; break;
    case 6: rruleDay = RRule.SU; break;
    default: throw new Error(`Invalid weekday: ${weekday}`);
  }
  
  const rrule = new RRule({
    freq: RRule.MONTHLY,
    interval: 1,
    byweekday: [rruleDay.nth(nth)]
  });

  const ordinals = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
  const ordinalStr = nth === -1 ? 'last' : ordinals[nth];
  
  return {
    type: 'monthly',
    interval: 1,
    dayOfMonth: 1, // Placeholder, actual day determined by rrule
    time: time || '09:00',
    rruleString: rrule.toString(),
    naturalLanguage: `${ordinalStr} ${WEEKDAY_NAMES[weekday]} of month`
  };
}

/**
 * Create a "last day of month" recurrence pattern
 */
export function createLastDayOfMonthPattern(time?: string): Frequency {
  const rrule = new RRule({
    freq: RRule.MONTHLY,
    interval: 1,
    bymonthday: -1 // Last day of month
  });

  return {
    type: 'monthly',
    interval: 1,
    dayOfMonth: 31, // Will be adjusted by the engine
    time: time || '09:00',
    rruleString: rrule.toString(),
    naturalLanguage: 'last day of month'
  };
}

/**
 * Parse a natural language recurrence pattern into a Frequency
 * Supports common patterns like:
 * - "every weekday"
 * - "every weekend"
 * - "first Monday of month"
 * - "last Friday of month"
 * - "2nd Tuesday of month"
 * - "last day of month"
 */
export function parseRecurrencePattern(input: string, time?: string): Frequency | null {
  const trimmed = input.trim().toLowerCase();

  // Every weekday pattern
  if (trimmed === 'every weekday' || trimmed === 'weekdays' || trimmed === 'every workday') {
    return createWeekdayPattern(time);
  }

  // Every weekend pattern
  if (trimmed === 'every weekend' || trimmed === 'weekends') {
    return createWeekendPattern(time);
  }

  // Last day of month
  if (trimmed === 'last day of month' || trimmed === 'last day of the month') {
    return createLastDayOfMonthPattern(time);
  }

  // First/Last [weekday] of month patterns
  const weekdayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  // "first Monday of month", "last Friday of month", etc.
  const firstLastMatch = trimmed.match(/^(first|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+of\s+(the\s+)?month$/);
  if (firstLastMatch) {
    const position = firstLastMatch[1];
    const weekdayStr = firstLastMatch[2];
    const weekday = weekdayNames.indexOf(weekdayStr);
    
    if (weekday >= 0) {
      if (position === 'first') {
        return createFirstWeekdayOfMonthPattern(weekday, time);
      } else {
        return createLastWeekdayOfMonthPattern(weekday, time);
      }
    }
  }

  // "2nd Tuesday of month", "3rd Friday of month", etc.
  const nthMatch = trimmed.match(/^(1st|2nd|3rd|4th|5th)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+of\s+(the\s+)?month$/);
  if (nthMatch) {
    const nthStr = nthMatch[1];
    const weekdayStr = nthMatch[2];
    const weekday = weekdayNames.indexOf(weekdayStr);
    
    const nthMap: Record<string, number> = {
      '1st': 1,
      '2nd': 2,
      '3rd': 3,
      '4th': 4,
      '5th': 5
    };
    const nth = nthMap[nthStr];
    
    if (weekday >= 0 && nth) {
      return createNthWeekdayOfMonthPattern(weekday, nth, time);
    }
  }

  return null;
}
