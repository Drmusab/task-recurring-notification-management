/**
 * Timezone-aware date and time handling
 */

import { parseTime } from "@shared/utils/misc/date";

export class TimezoneHandler {
  /**
   * Get current timezone (e.g., "America/New_York")
   */
  getTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Convert UTC date to local time
   * Note: This is a simplified implementation. For production use,
   * consider using a library like date-fns-tz for proper timezone conversion.
   */
  toLocal(utcDate: Date): Date {
    // Return the date as-is since JavaScript Date objects are already timezone-aware
    // and will display in the local timezone when formatted
    return new Date(utcDate);
  }

  /**
   * Create a local date-time from a date and time string
   */
  createLocalDateTime(date: Date, timeString: string): Date {
    const { hours, minutes } = parseTime(timeString);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return new Date(date);
    }
    const localDate = new Date(date);
    localDate.setHours(hours, minutes, 0, 0);
    return localDate;
  }

  /**
   * Check if two dates are on the same local day
   */
  isSameLocalDay(date1: Date, date2: Date): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  /**
   * Get start of local day
   */
  startOfLocalDay(date?: Date): Date {
    const d = date ? new Date(date) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get end of local day
   */
  endOfLocalDay(date?: Date): Date {
    const d = date ? new Date(date) : new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }

  /**
   * Format date in local timezone
   */
  formatLocal(date: Date): string {
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Format time only in local timezone
   */
  formatLocalTime(date: Date): string {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Format date only in local timezone
   */
  formatLocalDate(date: Date): string {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  /**
   * Get relative time string (e.g., "in 2 hours", "3 days ago")
   */
  getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMinutes = Math.trunc(diffMs / (1000 * 60));
    const diffHours = Math.trunc(diffMs / (1000 * 60 * 60));
    const diffDays = Math.trunc(diffMs / (1000 * 60 * 60 * 24));

    if (Math.abs(diffMs) < 1000 * 60) {
      return "now";
    } else if (Math.abs(diffMinutes) < 60) {
      return diffMinutes > 0 ? `in ${diffMinutes}m` : `${-diffMinutes}m ago`;
    } else if (Math.abs(diffHours) < 24) {
      return diffHours > 0 ? `in ${diffHours}h` : `${-diffHours}h ago`;
    } else {
      return diffDays > 0 ? `in ${diffDays}d` : `${-diffDays}d ago`;
    }
  }

  /**
   * Check if date is today
   */
  isToday(date: Date): boolean {
    return this.isSameLocalDay(date, new Date());
  }

  /**
   * Check if date is in the past
   */
  isPast(date: Date): boolean {
    return date < new Date();
  }

  /**
   * Check if date is overdue (past and not today)
   */
  isOverdue(date: Date): boolean {
    return this.isPast(date) && !this.isToday(date);
  }

  /**
   * Add days to a date
   */
  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Get tomorrow's date
   */
  tomorrow(): Date {
    return this.addDays(new Date(), 1);
  }

  /**
   * Get next week's date
   */
  nextWeek(): Date {
    return this.addDays(new Date(), 7);
  }
}
