/**
 * DateUtils - Timezone-Safe Date Calculations
 * Handles DST transitions, month boundaries, leap years
 * 
 * Uses native JavaScript Date with careful timezone handling
 */

/**
 * Date keywords mapping
 */
const DATE_KEYWORDS: Record<string, number> = {
  'today': 0,
  'tomorrow': 1,
  'yesterday': -1,
};

/**
 * Day of week names
 */
const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Get current date in user's timezone
 */
export function now(timezone?: string): Date {
  const date = new Date();
  
  if (timezone) {
    // Use Intl.DateTimeFormat for timezone conversion
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(date);
    const partsMap: Record<string, string> = {};
    parts.forEach(part => {
      if (part.type !== 'literal') {
        partsMap[part.type] = part.value;
      }
    });
    
    return new Date(
      `${partsMap.year}-${partsMap.month}-${partsMap.day}T${partsMap.hour}:${partsMap.minute}:${partsMap.second}`
    );
  }
  
  return date;
}

/**
 * Get today's date at midnight (start of day)
 */
export function today(timezone?: string): Date {
  const date = now(timezone);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Format date to ISO date string (YYYY-MM-DD)
 */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date to ISO datetime string (YYYY-MM-DDTHH:mm:ss)
 */
export function toISODateTime(date: Date): string {
  return date.toISOString().split('.')[0] || date.toISOString();
}

/**
 * Parse ISO date string to Date object
 */
export function parseISODate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Add days to a date (handles DST transitions)
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add weeks to a date
 */
export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/**
 * Add months to a date (handles month boundaries)
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  
  result.setMonth(result.getMonth() + months);
  
  // Handle month boundary issues (e.g., Jan 31 + 1 month = Mar 3, should be Feb 28/29)
  if (result.getDate() !== originalDay) {
    // Went past end of month, back up to last day of previous month
    result.setDate(0);
  }
  
  return result;
}

/**
 * Add years to a date (handles leap years)
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

/**
 * Get next occurrence of a specific weekday
 * @param date - Starting date
 * @param targetWeekday - 0=Sunday, 1=Monday, ..., 6=Saturday
 * @param inclusive - If true, return date if it's already the target weekday
 */
export function getNextWeekday(date: Date, targetWeekday: number, inclusive = false): Date {
  const result = new Date(date);
  const currentWeekday = result.getDay();
  
  let daysToAdd = targetWeekday - currentWeekday;
  
  if (daysToAdd < 0 || (!inclusive && daysToAdd === 0)) {
    daysToAdd += 7;
  }
  
  return addDays(result, daysToAdd);
}

/**
 * Get next occurrence of a specific day of month
 * @param date - Starting date
 * @param dayOfMonth - Target day (1-31)
 */
export function getNextDayOfMonth(date: Date, dayOfMonth: number): Date {
  const result = new Date(date);
  
  // Try current month
  result.setDate(dayOfMonth);
  
  if (result <= date) {
    // Already passed this month, go to next month
    result.setMonth(result.getMonth() + 1);
    result.setDate(dayOfMonth);
  }
  
  // Handle month boundaries (e.g., day 31 in February)
  if (result.getDate() !== dayOfMonth) {
    // Went past end of month, use last day of month
    result.setDate(0);
  }
  
  return result;
}

/**
 * Check if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get the last day of a month
 */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Parse natural language date expressions
 * @param expression - Natural language date (e.g., "tomorrow", "next Monday")
 * @param baseDate - Reference date (defaults to today)
 */
export function parseNaturalDate(expression: string, baseDate?: Date): Date | null {
  const normalized = expression.toLowerCase().trim();
  const base = baseDate || today();
  
  // Keywords: today, tomorrow, yesterday
  if (normalized in DATE_KEYWORDS) {
    const days = DATE_KEYWORDS[normalized];
    if (days !== undefined) {
      return addDays(base, days);
    }
  }
  
  // Next/last [weekday]
  const nextWeekdayMatch = normalized.match(/^next\s+(\w+)$/);
  if (nextWeekdayMatch && nextWeekdayMatch[1]) {
    const weekdayName = nextWeekdayMatch[1];
    const weekdayIndex = WEEKDAY_NAMES.indexOf(weekdayName);
    
    if (weekdayIndex !== -1) {
      return getNextWeekday(base, weekdayIndex, false);
    }
  }
  
  const lastWeekdayMatch = normalized.match(/^last\s+(\w+)$/);
  if (lastWeekdayMatch && lastWeekdayMatch[1]) {
    const weekdayName = lastWeekdayMatch[1];
    const weekdayIndex = WEEKDAY_NAMES.indexOf(weekdayName);
    
    if (weekdayIndex !== -1) {
      const next = getNextWeekday(base, weekdayIndex, false);
      return addWeeks(next, -2); // Go back 2 weeks
    }
  }
  
  // In [N] days/weeks/months/years
  const inMatch = normalized.match(/^in\s+(\d+)\s+(day|week|month|year)s?$/);
  if (inMatch && inMatch[1] && inMatch[2]) {
    const count = parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    
    switch (unit) {
      case 'day':
        return addDays(base, count);
      case 'week':
        return addWeeks(base, count);
      case 'month':
        return addMonths(base, count);
      case 'year':
        return addYears(base, count);
    }
  }
  
  // [N] days/weeks/months/years ago
  const agoMatch = normalized.match(/^(\d+)\s+(day|week|month|year)s?\s+ago$/);
  if (agoMatch && agoMatch[1] && agoMatch[2]) {
    const count = parseInt(agoMatch[1], 10);
    const unit = agoMatch[2];
    
    switch (unit) {
      case 'day':
        return addDays(base, -count);
      case 'week':
        return addWeeks(base, -count);
      case 'month':
        return addMonths(base, -count);
      case 'year':
        return addYears(base, -count);
    }
  }
  
  // Relative: +7d, -2w, +1m, +1y
  const relativeMatch = normalized.match(/^([+-])(\d+)([dwmy])$/);
  if (relativeMatch && relativeMatch[1] && relativeMatch[2] && relativeMatch[3]) {
    const sign = relativeMatch[1] === '+' ? 1 : -1;
    const count = parseInt(relativeMatch[2], 10) * sign;
    const unit = relativeMatch[3];
    
    switch (unit) {
      case 'd':
        return addDays(base, count);
      case 'w':
        return addWeeks(base, count);
      case 'm':
        return addMonths(base, count);
      case 'y':
        return addYears(base, count);
    }
  }
  
  // ISO date format: YYYY-MM-DD
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return parseISODate(normalized);
  }
  
  return null;
}

/**
 * Compare two dates (ignoring time)
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDates(date1: Date, date2: Date): number {
  const d1 = toISODate(date1);
  const d2 = toISODate(date2);
  
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date, timezone?: string): boolean {
  const nowDate = now(timezone);
  return compareDates(date, nowDate) < 0;
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date, timezone?: string): boolean {
  const nowDate = now(timezone);
  return compareDates(date, nowDate) > 0;
}

/**
 * Check if a date is today
 */
export function isToday(date: Date, timezone?: string): boolean {
  const nowDate = now(timezone);
  return compareDates(date, nowDate) === 0;
}

/**
 * Get difference in days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const ms1 = date1.getTime();
  const ms2 = date2.getTime();
  const diffMs = ms2 - ms1;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Format date for display based on user preference
 */
export function formatDate(date: Date, format: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'relative' = 'YYYY-MM-DD'): string {
  switch (format) {
    case 'YYYY-MM-DD':
      return toISODate(date);
      
    case 'MM/DD/YYYY':
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
      
    case 'DD/MM/YYYY':
      return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
      
    case 'relative':
      return formatRelativeDate(date);
      
    default:
      return toISODate(date);
  }
}

/**
 * Format date as relative string (e.g., "today", "tomorrow", "in 3 days")
 */
export function formatRelativeDate(date: Date, baseDate?: Date): string {
  const base = baseDate || today();
  const days = daysBetween(base, date);
  
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 1 && days <= 7) return `in ${days} days`;
  if (days < -1 && days >= -7) return `${Math.abs(days)} days ago`;
  
  return toISODate(date);
}

/**
 * Test DST transition handling
 * This is a helper for testing timezone edge cases
 */
export function testDSTTransition(timezone: string): { spring: Date; fall: Date } {
  // Find DST transitions for current year
  const year = new Date().getFullYear();
  
  // Spring forward (March, usually 2nd Sunday)
  const marchFirst = new Date(year, 2, 1);
  const spring = getNextWeekday(marchFirst, 0, true); // First Sunday
  const springForward = addWeeks(spring, 1); // Second Sunday
  
  // Fall back (November, usually 1st Sunday)
  const novFirst = new Date(year, 10, 1);
  const fallBack = getNextWeekday(novFirst, 0, true); // First Sunday
  
  return {
    spring: springForward,
    fall: fallBack,
  };
}
