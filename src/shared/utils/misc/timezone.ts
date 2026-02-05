/**
 * Timezone conversion utilities for handling UTC storage and display
 * All dates are stored internally as UTC, but displayed in user's timezone
 */

/**
 * Convert a local date to UTC
 * @param date Local date to convert
 * @param timezone Target timezone (e.g., "America/New_York")
 * @returns Date object representing the same instant in UTC
 */
export function toUTC(date: Date, timezone: string): Date {
  // Get the date string in the specified timezone
  const dateStr = date.toLocaleString('en-US', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Parse the date string to get timezone-specific values
  const parts = dateStr.match(/(\d+)\/(\d+)\/(\d+),\s+(\d+):(\d+):(\d+)/);
  if (!parts) {
    // Fallback: return the date as-is
    return new Date(date);
  }
  
  const [, month, day, year, hour, minute, second] = parts;
  
  // Create UTC date from timezone-specific values
  return new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  ));
}

/**
 * Convert a UTC date to local timezone
 * @param date UTC date to convert
 * @param timezone Target timezone (e.g., "America/New_York")
 * @returns Date object representing the same instant in the target timezone
 */
export function fromUTC(date: Date, timezone: string): Date {
  // Get the UTC components
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();
  const ms = date.getUTCMilliseconds();
  
  // Create a date string in ISO format
  const isoString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(ms).padStart(3, '0')}Z`;
  
  // Parse in target timezone
  const utcDate = new Date(isoString);
  
  // Get the offset in the target timezone
  const tzDate = new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
  const offset = utcDate.getTime() - tzDate.getTime();
  
  // Apply the offset to get the local time
  return new Date(utcDate.getTime() - offset);
}

/**
 * Get the user's current timezone
 * @returns User's timezone (e.g., "America/New_York")
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Check if a date falls within a DST transition
 * @param date Date to check
 * @param timezone Timezone to check in
 * @returns Object with isDST flag and offset information
 */
export function getDSTInfo(date: Date, timezone: string): {
  isDST: boolean;
  offset: number;
} {
  // Create two dates: one in winter, one in summer
  const year = date.getFullYear();
  const winterDate = new Date(year, 0, 1); // January 1
  const summerDate = new Date(year, 6, 1); // July 1
  
  // Get timezone offsets
  const winterOffset = getTimezoneOffset(winterDate, timezone);
  const summerOffset = getTimezoneOffset(summerDate, timezone);
  const currentOffset = getTimezoneOffset(date, timezone);
  
  // DST is active if offset is different from standard time
  const standardOffset = Math.max(winterOffset, summerOffset);
  const isDST = currentOffset !== standardOffset;
  
  return {
    isDST,
    offset: currentOffset
  };
}

/**
 * Get timezone offset for a specific date and timezone
 * @param date Date to check
 * @param timezone Timezone to check in
 * @returns Offset in minutes
 */
function getTimezoneOffset(date: Date, timezone: string): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60);
}

/**
 * Normalize a date to UTC for storage
 * This ensures consistent storage regardless of user timezone
 * @param date Date to normalize
 * @param timezone Source timezone (defaults to user's timezone)
 * @returns ISO string in UTC
 */
export function normalizeToUTC(date: Date, timezone?: string): string {
  const tz = timezone || getUserTimezone();
  const utcDate = toUTC(date, tz);
  return utcDate.toISOString();
}

/**
 * Denormalize a UTC date for display
 * @param isoString ISO string in UTC
 * @param timezone Target timezone (defaults to user's timezone)
 * @returns Date object in target timezone
 */
export function denormalizeFromUTC(isoString: string, timezone?: string): Date {
  const tz = timezone || getUserTimezone();
  const utcDate = new Date(isoString);
  return fromUTC(utcDate, tz);
}
