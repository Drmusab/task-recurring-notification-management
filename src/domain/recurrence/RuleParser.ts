/**
 * Recurrence Rule Parser
 * Parses human-readable recurrence rules into Frequency objects
 * 
 * Supported formats:
 * - every day / daily
 * - every week / weekly
 * - every 2 weeks / biweekly
 * - every month / monthly
 * - every year / yearly
 * - every Monday
 * - every weekday
 * - every 3rd Friday
 * - every month on the 15th
 */

import type { Frequency } from '../models/Task';

/**
 * Weekday name to number mapping (0=Sunday, 6=Saturday)
 */
const WEEKDAY_MAP: Record<string, number> = {
  'sunday': 0,
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6,
  'sun': 0,
  'mon': 1,
  'tue': 2,
  'wed': 3,
  'thu': 4,
  'fri': 5,
  'sat': 6,
};

/**
 * Parse recurrence rule text into Frequency object
 */
export function parseRecurrenceRule(ruleText: string): Frequency | null {
  if (!ruleText) return null;
  
  const normalized = ruleText.toLowerCase().trim();
  
  // Daily patterns
  if (normalized === 'daily' || normalized === 'every day') {
    return {
      type: 'daily',
      interval: 1,
    };
  }
  
  // Every N days
  const everyNDays = normalized.match(/^every\s+(\d+)\s+days?$/);
  if (everyNDays && everyNDays[1]) {
    return {
      type: 'daily',
      interval: parseInt(everyNDays[1], 10),
    };
  }
  
  // Weekly patterns
  if (normalized === 'weekly' || normalized === 'every week') {
    return {
      type: 'weekly',
      interval: 1,
    };
  }
  
  // Every N weeks
  const everyNWeeks = normalized.match(/^every\s+(\d+)\s+weeks?$/);
  if (everyNWeeks && everyNWeeks[1]) {
    return {
      type: 'weekly',
      interval: parseInt(everyNWeeks[1], 10),
    };
  }
  
  // Biweekly
  if (normalized === 'biweekly' || normalized === 'every 2 weeks') {
    return {
      type: 'weekly',
      interval: 2,
    };
  }
  
  // Every [weekday]
  const everyWeekday = normalized.match(/^every\s+(\w+)$/);
  if (everyWeekday && everyWeekday[1]) {
    const weekdayName = everyWeekday[1];
    
    // Check if it's a weekday name
    if (weekdayName && weekdayName in WEEKDAY_MAP) {
      const weekdayNum = WEEKDAY_MAP[weekdayName];
      if (weekdayNum !== undefined) {
        return {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [weekdayNum],
        };
      }
    }
    
    // Special: "every weekday" = Monday-Friday
    if (weekdayName === 'weekday') {
      return {
        type: 'weekly',
        interval: 1,
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      };
    }
    
    // Special: "every weekend" = Saturday, Sunday
    if (weekdayName === 'weekend') {
      return {
        type: 'weekly',
        interval: 1,
        daysOfWeek: [0, 6], // Sun, Sat
      };
    }
  }
  
  // Every Nth [weekday]
  const everyNthWeekday = normalized.match(/^every\s+(\d+)(?:st|nd|rd|th)?\s+(\w+)$/);
  if (everyNthWeekday && everyNthWeekday[1] && everyNthWeekday[2]) {
    const nthOccurrence = parseInt(everyNthWeekday[1], 10);
    const weekdayName = everyNthWeekday[2];
    
    if (weekdayName && weekdayName in WEEKDAY_MAP) {
      const weekdayNum = WEEKDAY_MAP[weekdayName];
      if (weekdayNum !== undefined) {
        return {
          type: 'monthly',
          interval: 1,
          daysOfWeek: [weekdayNum],
          // Store nth occurrence info in rrule for now
          rrule: `FREQ=MONTHLY;BYDAY=${nthOccurrence}${getWeekdayAbbrev(weekdayNum)}`,
        };
      }
    }
  }
  
  // Monthly patterns
  if (normalized === 'monthly' || normalized === 'every month') {
    return {
      type: 'monthly',
      interval: 1,
    };
  }
  
  // Every N months
  const everyNMonths = normalized.match(/^every\s+(\d+)\s+months?$/);
  if (everyNMonths && everyNMonths[1]) {
    return {
      type: 'monthly',
      interval: parseInt(everyNMonths[1], 10),
    };
  }
  
  // Every month on the [day]
  const everyMonthOnDay = normalized.match(/^every\s+month\s+on\s+(?:the\s+)?(\d+)(?:st|nd|rd|th)?$/);
  if (everyMonthOnDay && everyMonthOnDay[1]) {
    return {
      type: 'monthly',
      interval: 1,
      dayOfMonth: parseInt(everyMonthOnDay[1], 10),
    };
  }
  
  // Yearly patterns
  if (normalized === 'yearly' || normalized === 'every year') {
    return {
      type: 'yearly',
      interval: 1,
    };
  }
  
  // Every N years
  const everyNYears = normalized.match(/^every\s+(\d+)\s+years?$/);
  if (everyNYears && everyNYears[1]) {
    return {
      type: 'yearly',
      interval: parseInt(everyNYears[1], 10),
    };
  }
  
  // Custom RRule format (RFC 5545)
  if (normalized.startsWith('rrule:')) {
    return {
      type: 'custom',
      interval: 1,
      rrule: normalized.substring(6).trim(),
    };
  }
  
  // Unable to parse
  return null;
}

/**
 * Get weekday abbreviation for RRule format
 */
function getWeekdayAbbrev(weekday: number): string {
  const abbrevs = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  return abbrevs[weekday] || 'MO';
}

/**
 * Serialize Frequency object back to human-readable text
 */
export function serializeRecurrenceRule(frequency: Frequency): string {
  if (!frequency) return '';
  
  const { type, interval, daysOfWeek, dayOfMonth, rrule } = frequency;
  
  // Custom RRule
  if (type === 'custom' && rrule) {
    return `rrule: ${rrule}`;
  }
  
  // Daily
  if (type === 'daily') {
    if (interval === 1) {
      return 'every day';
    }
    return `every ${interval} days`;
  }
  
  // Weekly
  if (type === 'weekly') {
    if (daysOfWeek && daysOfWeek.length > 0) {
      // Specific weekdays
      if (daysOfWeek.length === 5 && daysOfWeek.every(d => d >= 1 && d <= 5)) {
        return 'every weekday';
      }
      
      if (daysOfWeek.length === 1) {
        const weekdayName = Object.keys(WEEKDAY_MAP).find(
          key => WEEKDAY_MAP[key] === daysOfWeek[0] && key.length > 3
        );
        return `every ${weekdayName}`;
      }
    }
    
    if (interval === 1) {
      return 'every week';
    }
    if (interval === 2) {
      return 'every 2 weeks';
    }
    return `every ${interval} weeks`;
  }
  
  // Monthly
  if (type === 'monthly') {
    if (dayOfMonth) {
      return `every month on the ${dayOfMonth}`;
    }
    
    if (interval === 1) {
      return 'every month';
    }
    return `every ${interval} months`;
  }
  
  // Yearly
  if (type === 'yearly') {
    if (interval === 1) {
      return 'every year';
    }
    return `every ${interval} years`;
  }
  
  return '';
}

/**
 * Validate recurrence rule
 */
export function validateRecurrenceRule(frequency: Frequency): string[] {
  const errors: string[] = [];
  
  if (!frequency) {
    errors.push('Frequency is required');
    return errors;
  }
  
  if (frequency.interval < 1) {
    errors.push('Interval must be at least 1');
  }
  
  if (frequency.daysOfWeek) {
    if (frequency.daysOfWeek.some(d => d < 0 || d > 6)) {
      errors.push('Days of week must be 0-6 (Sunday-Saturday)');
    }
  }
  
  if (frequency.dayOfMonth) {
    if (frequency.dayOfMonth < 1 || frequency.dayOfMonth > 31) {
      errors.push('Day of month must be 1-31');
    }
  }
  
  if (frequency.monthOfYear) {
    if (frequency.monthOfYear < 1 || frequency.monthOfYear > 12) {
      errors.push('Month of year must be 1-12');
    }
  }
  
  return errors;
}

/**
 * Get recurrence rule examples for autocomplete
 */
export function getRecurrenceExamples(): string[] {
  return [
    'every day',
    'every 2 days',
    'every week',
    'every 2 weeks',
    'every month',
    'every year',
    'every Monday',
    'every Tuesday',
    'every Wednesday',
    'every Thursday',
    'every Friday',
    'every weekday',
    'every weekend',
    'every 3rd Friday',
    'every month on the 15th',
  ];
}
