/**
 * Recurrence Model - RRule-based recurrence system
 * Phase 1: Dual-Engine Mode
 * 
 * This is the new RRule-based recurrence system that will eventually
 * replace the legacy Frequency model. During Phase 1, both systems
 * coexist to allow gradual migration.
 */

/**
 * RRule-based recurrence configuration
 * Follows RFC 5545 (iCalendar) standard
 */
export interface Recurrence {
  /**
   * RFC 5545 recurrence rule string
   * Examples:
   * - "FREQ=DAILY;INTERVAL=2" (every 2 days)
   * - "FREQ=WEEKLY;BYDAY=MO,WE,FR" (every Mon, Wed, Fri)
   * - "FREQ=MONTHLY;BYMONTHDAY=15" (15th of every month)
   * - "FREQ=MONTHLY;BYDAY=3TU" (3rd Tuesday of every month)
   */
  rrule: string;

  /**
   * Calculate next occurrence from completion date instead of due date
   * When true, next occurrence = completion date + interval
   * When false, next occurrence = due date + interval
   */
  baseOnToday: boolean;

  /**
   * Human-readable description of the recurrence
   * Generated from the RRule for display purposes
   * Example: "every Monday, Wednesday, and Friday"
   */
  humanReadable: string;

  /**
   * Reference date for recurrence calculations
   * Usually the original due date or start date
   */
  referenceDate?: Date | string;

  /**
   * Optional timezone for recurrence calculations
   * Uses IANA timezone format (e.g., "America/New_York")
   */
  timezone?: string;

  /**
   * Optional fixed time for occurrences (HH:MM format)
   * Example: "09:00", "14:30"
   */
  time?: string;

  /**
   * Original natural language input (if created from text)
   * Example: "every 3rd Tuesday"
   */
  originalInput?: string;
}

/**
 * Result of recurrence calculation
 */
export interface RecurrenceResult {
  /**
   * Next occurrence date
   */
  nextDate: Date;

  /**
   * Whether this is a valid occurrence
   * (e.g., monthly on 31st might skip months without 31 days)
   */
  isValid: boolean;

  /**
   * Warning message if occurrence was adjusted
   * (e.g., "Feb 31st adjusted to Mar 31st")
   */
  warning?: string;
}

/**
 * Validation result for RRule strings
 */
export interface RecurrenceValidation {
  valid: boolean;
  error?: string;
  warnings?: string[];
}
