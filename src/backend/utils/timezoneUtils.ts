/**
 * timezoneUtils — Pure Timezone Normalization Functions
 *
 * Thin pure-function wrappers over the Intl.DateTimeFormat API
 * for timezone conversion. These are the canonical timezone operations
 * for the backend utils layer.
 *
 * Relationship to existing code:
 *   - TimezoneHandler (class in engine/) — instance methods for Scheduler
 *   - shared/utils/date/timezone.ts  — frontend-oriented helpers
 *   - THIS FILE — pure functions for backend utils consumption
 *
 * All functions are idempotent and never mutate input.
 *
 * PURE FUNCTIONS — no state, no side effects, no DOM access.
 *
 * FORBIDDEN:
 *   ❌ mutate model
 *   ❌ access storage
 *   ❌ fire event
 *   ❌ call integration
 *   ❌ parse markdown
 *   ❌ access DOM
 *   ❌ hold global state
 */

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** DST information for a specific date+timezone */
export interface DSTInfo {
  readonly isDST: boolean;
  readonly offsetMinutes: number;
  readonly standardOffsetMinutes: number;
  readonly dstDeltaMinutes: number;
}

/** Timezone validation result */
export interface TimezoneValidation {
  readonly valid: boolean;
  readonly timezone: string;
  readonly error?: string;
}

// ──────────────────────────────────────────────────────────────
// Core Conversion
// ──────────────────────────────────────────────────────────────

/**
 * Get the user's local IANA timezone identifier.
 * Example: "America/New_York", "Europe/London", "Asia/Tokyo"
 */
export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Convert a Date to its representation in a target timezone.
 *
 * Uses Intl.DateTimeFormat.formatToParts() for accurate conversion
 * (handles DST transitions correctly).
 *
 * @param date  Input date (any timezone)
 * @param timezone  Target IANA timezone
 * @returns New Date representing the same instant in the target timezone
 */
export function toTimezone(date: Date, timezone: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes): number =>
      parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

    return new Date(
      get("year"), get("month") - 1, get("day"),
      get("hour"), get("minute"), get("second"),
    );
  } catch {
    // Invalid timezone — return clone
    return new Date(date.getTime());
  }
}

/**
 * Convert a local date to UTC.
 *
 * @param date  Date in the source timezone
 * @param sourceTimezone  IANA timezone of the input date
 * @returns Date object in UTC
 */
export function toUTC(date: Date, sourceTimezone: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: sourceTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes): number =>
      parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

    // Construct a UTC date from the timezone-local components
    return new Date(Date.UTC(
      get("year"), get("month") - 1, get("day"),
      get("hour"), get("minute"), get("second"),
    ));
  } catch {
    return new Date(date.getTime());
  }
}

/**
 * Normalize a date to an ISO string in UTC.
 *
 * @param date  Date to normalize
 * @param sourceTimezone  Optional source timezone (defaults to local)
 * @returns ISO string in UTC
 */
export function normalizeToISO(date: Date, sourceTimezone?: string): string {
  if (sourceTimezone) {
    return toUTC(date, sourceTimezone).toISOString();
  }
  return date.toISOString();
}

// ──────────────────────────────────────────────────────────────
// DST Detection
// ──────────────────────────────────────────────────────────────

/**
 * Get DST information for a specific date and timezone.
 */
export function getDSTInfo(date: Date, timezone: string): DSTInfo {
  const year = date.getFullYear();

  // Measure offset in January (winter) and July (summer)
  const winterOffset = getOffsetMinutes(new Date(year, 0, 1), timezone);
  const summerOffset = getOffsetMinutes(new Date(year, 6, 1), timezone);
  const currentOffset = getOffsetMinutes(date, timezone);

  // Standard time has the LARGER offset magnitude (more behind UTC)
  const standardOffset = Math.max(winterOffset, summerOffset);
  const isDST = currentOffset !== standardOffset;

  return {
    isDST,
    offsetMinutes: currentOffset,
    standardOffsetMinutes: standardOffset,
    dstDeltaMinutes: Math.abs(standardOffset - Math.min(winterOffset, summerOffset)),
  };
}

// ──────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────

/**
 * Validate an IANA timezone identifier.
 */
export function validateTimezone(timezone: string): TimezoneValidation {
  if (!timezone || typeof timezone !== "string") {
    return { valid: false, timezone, error: "Timezone must be a non-empty string" };
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return { valid: true, timezone };
  } catch {
    return { valid: false, timezone, error: `Invalid IANA timezone: "${timezone}"` };
  }
}

// ──────────────────────────────────────────────────────────────
// Formatting (pure, no DOM)
// ──────────────────────────────────────────────────────────────

/**
 * Format a date in a specific timezone.
 */
export function formatInTimezone(
  date: Date,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  try {
    return date.toLocaleString("en-US", {
      timeZone: timezone,
      ...options,
    });
  } catch {
    return date.toISOString();
  }
}

/**
 * Get relative time description (pure).
 */
export function getRelativeTime(date: Date, now?: Date): string {
  const ref = now ?? new Date();
  const diffMs = date.getTime() - ref.getTime();
  const absDiffMs = Math.abs(diffMs);
  const sign = diffMs >= 0 ? 1 : -1;

  const minutes = Math.floor(absDiffMs / (1000 * 60));
  const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
  const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));

  if (absDiffMs < 60_000) return "now";
  if (minutes < 60) return sign > 0 ? `in ${minutes}m` : `${minutes}m ago`;
  if (hours < 24) return sign > 0 ? `in ${hours}h` : `${hours}h ago`;
  return sign > 0 ? `in ${days}d` : `${days}d ago`;
}

// ──────────────────────────────────────────────────────────────
// Internal
// ──────────────────────────────────────────────────────────────

/**
 * Calculate the offset in minutes between UTC and a timezone for a given date.
 */
function getOffsetMinutes(date: Date, timezone: string): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60);
}
