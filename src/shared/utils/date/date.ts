/**
 * Date utility functions for task scheduling
 */

/**
 * Parse time string (HH:mm) and return hours and minutes
 * @throws {Error} If the time string is invalid
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } {
  if (!timeStr || typeof timeStr !== 'string') {
    throw new Error('Time string is required and must be a string');
  }

  const parts = timeStr.split(":");
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm`);
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time values in: ${timeStr}`);
  }

  if (hours < 0 || hours > 23) {
    throw new Error(`Hours must be between 0 and 23, got: ${hours}`);
  }

  if (minutes < 0 || minutes > 59) {
    throw new Error(`Minutes must be between 0 and 59, got: ${minutes}`);
  }

  return { hours, minutes };
}

/**
 * Format a date to HH:mm string
 */
export function formatTime(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date object provided to formatTime');
  }

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Format a date to a readable string
 */
export function formatDate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date object provided to formatDate');
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date to a readable string with time
 */
export function formatDateTime(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date object provided to formatDateTime');
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return false; // Invalid dates are not today
  }

  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return false; // Invalid dates are not in the past
  }

  return date < new Date();
}

/**
 * Check if a date is overdue (past and not today)
 */
export function isOverdue(date: Date): boolean {
  return isPast(date) && !isToday(date);
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date object provided to addDays');
  }

  if (typeof days !== 'number' || isNaN(days)) {
    throw new Error('Days must be a valid number');
  }

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
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Set time on a date
 */
export function setTime(date: Date, hours: number, minutes: number): Date {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Set time on a date while detecting DST shifts.
 * Returns the adjusted date and whether the time was shifted by DST rules.
 */
export function setTimeWithFallback(
  date: Date,
  hours: number,
  minutes: number
): { date: Date; shifted: boolean } {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  const shifted = result.getHours() !== hours || result.getMinutes() !== minutes;
  return { date: result, shifted };
}

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get the number of days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / oneDay);
}

/**
 * Get a date range for the next N days
 */
export function getDateRange(startDate: Date, days: number): Date[] {
  const range: Date[] = [];
  for (let i = 0; i < days; i++) {
    range.push(addDays(startDate, i));
  }
  return range;
}
