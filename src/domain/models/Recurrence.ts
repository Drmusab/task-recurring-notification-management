/**
 * Recurrence Model - RRule-based recurrence system
 * Phase 3: Hardened with validation
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
  readonly rrule: string;

  /**
   * Calculate next occurrence from completion date instead of due date
   * When true, next occurrence = completion date + interval
   * When false, next occurrence = due date + interval
   */
  readonly baseOnToday: boolean;

  /**
   * Human-readable description of the recurrence
   * Generated from the RRule for display purposes
   * Example: "every Monday, Wednesday, and Friday"
   */
  readonly humanReadable: string;

  /**
   * Reference date for recurrence calculations
   * Usually the original due date or start date
   */
  readonly referenceDate?: Date | string;

  /**
   * Optional timezone for recurrence calculations
   * Uses IANA timezone format (e.g., "America/New_York")
   */
  readonly timezone?: string;

  /**
   * Optional fixed time for occurrences (HH:MM format)
   * Example: "09:00", "14:30"
   */
  readonly time?: string;

  /**
   * Original natural language input (if created from text)
   * Example: "every 3rd Tuesday"
   */
  readonly originalInput?: string;
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
  readonly valid: boolean;
  readonly error?: string;
  readonly warnings?: readonly string[];
}

/**
 * Create a validated Recurrence object
 * @throws ValidationError if rrule is invalid
 */
export function createRecurrence(config: {
  rrule: string;
  baseOnToday?: boolean;
  humanReadable?: string;
  referenceDate?: Date | string;
  timezone?: string;
  time?: string;
  originalInput?: string;
}): Recurrence {
  // Validate RRule format (basic check)
  if (!config.rrule || config.rrule.trim().length === 0) {
    throw new Error('RRule cannot be empty');
  }
  
  // RRule must start with FREQ=
  if (!config.rrule.toUpperCase().startsWith('FREQ=')) {
    throw new Error('RRule must start with FREQ=');
  }
  
  // Validate time format if provided
  if (config.time && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(config.time)) {
    throw new Error(`Invalid time format: ${config.time}. Expected HH:MM`);
  }
  
  return Object.freeze({
    rrule: config.rrule,
    baseOnToday: config.baseOnToday ?? false,
    humanReadable: config.humanReadable || config.rrule,
    referenceDate: config.referenceDate,
    timezone: config.timezone,
    time: config.time,
    originalInput: config.originalInput,
  });
}

/**
 * Check if an object is a valid Recurrence
 */
export function isRecurrence(obj: unknown): obj is Recurrence {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Partial<Recurrence>;
  return (
    typeof r.rrule === 'string' &&
    r.rrule.length > 0 &&
    typeof r.baseOnToday === 'boolean' &&
    typeof r.humanReadable === 'string'
  );
}

/**
 * Validate an RRule string (basic validation)
 * @deprecated Use RecurrenceValidator.validate() from domain/recurrence/RecurrenceValidator for comprehensive validation
 */
export function validateRRule(rrule: string): RecurrenceValidation {
  const warnings: string[] = [];
  
  if (!rrule || rrule.trim().length === 0) {
    return { valid: false, error: 'RRule cannot be empty' };
  }
  
  const upper = rrule.toUpperCase();
  
  if (!upper.startsWith('FREQ=')) {
    return { valid: false, error: 'RRule must start with FREQ=' };
  }
  
  // Check for valid FREQ values
  const freqMatch = upper.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/);
  if (!freqMatch) {
    return { valid: false, error: 'Invalid FREQ value. Must be DAILY, WEEKLY, MONTHLY, or YEARLY' };
  }
  
  // Warn about potentially problematic rules
  if (upper.includes('BYMONTHDAY=31')) {
    warnings.push('BYMONTHDAY=31 will skip months with fewer than 31 days');
  }
  
  if (upper.includes('BYMONTHDAY=30') && upper.includes('BYMONTH=2')) {
    warnings.push('February never has 30 days');
  }
  
  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// NOTE: Duplicate isRecurrence() removed (Session 25) — the canonical
// definition is above (line ~137). The second copy was identical dead code.

/**
 * Clone a Recurrence object with optional overrides
 */
export function cloneRecurrence(
  recurrence: Recurrence,
  overrides?: Partial<Recurrence>
): Recurrence {
  return Object.freeze({
    rrule: overrides?.rrule ?? recurrence.rrule,
    baseOnToday: overrides?.baseOnToday ?? recurrence.baseOnToday,
    humanReadable: overrides?.humanReadable ?? recurrence.humanReadable,
    referenceDate: overrides?.referenceDate ?? recurrence.referenceDate,
    timezone: overrides?.timezone ?? recurrence.timezone,
    time: overrides?.time ?? recurrence.time,
    originalInput: overrides?.originalInput ?? recurrence.originalInput,
  });
}

/**
 * Merge two recurrence objects (second overrides first)
 */
export function mergeRecurrence(
  base: Recurrence,
  overrides: Partial<Recurrence>
): Recurrence {
  return cloneRecurrence(base, overrides);
}
