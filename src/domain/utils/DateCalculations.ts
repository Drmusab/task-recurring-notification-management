/**
 * DateCalculations — Pure domain date utilities
 *
 * Provides natural language date parsing (via chrono-node) and ISO date helpers.
 * No backend or framework dependencies.
 */
import * as chrono from "chrono-node";

/**
 * Parse a natural language date string into a Date object.
 */
export function parseNaturalDate(
  input: string,
  referenceDate?: Date,
): Date | null {
  if (!input?.trim()) return null;
  const results = chrono.parse(input, referenceDate ?? new Date());
  if (results.length === 0 || !results[0]) return null;
  return results[0].start.date();
}

/**
 * Format a Date (or ISO string) as an ISO date string (YYYY-MM-DD).
 */
export function toISODate(
  date: Date | string | null | undefined,
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date as an ISO date-time string (YYYY-MM-DDTHH:mm:ss).
 */
export function toISODateTime(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return "";
  return date.toISOString();
}

/**
 * Parse an ISO date string (YYYY-MM-DD) into a Date.
 * Returns null on invalid input.
 */
export function parseISODate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

/** Add days to a date. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Add weeks to a date. */
export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/** Add months to a date, clamping to end-of-month if needed. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // Clamp: if we overshot (e.g. Jan 31 + 1 month → Mar 3), go back to last day of target
  if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(0); // last day of previous month
  }
  return result;
}

/** Add years to a date. */
export function addYears(date: Date, years: number): Date {
  return addMonths(date, years * 12);
}

/** Get the next occurrence of a specific weekday (0=Sun, 6=Sat) on or after `date`. */
export function getNextWeekday(date: Date, weekday: number): Date {
  const result = new Date(date);
  const diff = ((weekday - result.getDay()) + 7) % 7 || 7;
  result.setDate(result.getDate() + diff);
  return result;
}

/** Get the next occurrence of a specific day-of-month on or after `date`. */
export function getNextDayOfMonth(date: Date, day: number): Date {
  const result = new Date(date);
  if (result.getDate() >= day) {
    result.setMonth(result.getMonth() + 1);
  }
  result.setDate(Math.min(day, getLastDayOfMonth(result.getFullYear(), result.getMonth() + 1)));
  return result;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Get the last day number (28-31) for a given year/month (1-indexed month). */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Compare two dates: -1 if a < b, 0 if equal, 1 if a > b. */
export function compareDates(a: Date, b: Date): -1 | 0 | 1 {
  const at = a.getTime();
  const bt = b.getTime();
  return at < bt ? -1 : at > bt ? 1 : 0;
}

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

export function isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Return the number of calendar days between two dates (absolute value). */
export function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round(Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY);
}

export function isPastRelativeTo(date: Date, reference: Date): boolean {
  return toISODate(date) < toISODate(reference);
}

export function isFutureRelativeTo(date: Date, reference: Date): boolean {
  return toISODate(date) > toISODate(reference);
}

export function isTodayRelativeTo(date: Date, reference: Date): boolean {
  return isSameDay(date, reference);
}

/** Return the timezone offset in minutes. */
export function getTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

/** Set time to 00:00:00.000 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Set time to 23:59:59.999 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}
