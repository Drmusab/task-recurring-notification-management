/**
 * Core types for RRULE-based recurrence engine
 * RFC 5545 compliant scheduling types
 */

import type { Task } from "@backend/core/models/Task";

/**
 * Scheduling mode for recurrence calculation
 * - fixed: Next occurrence is calculated from dtstart + rule (completion doesn't shift schedule)
 * - whenDone: Next occurrence is calculated from completion date (schedule slides forward)
 */
export type RecurrenceMode = 'fixed' | 'whenDone';

/**
 * Policy for handling missed occurrences
 * - skip: Skip all missed occurrences, jump to next future occurrence
 * - catch-up: Generate all missed occurrences for catch-up
 * - count-only: Track missed count but don't generate occurrences
 */
export type MissPolicy = 'skip' | 'catch-up' | 'count-only';

/**
 * RRULE validation result with structured errors and warnings
 */
export interface ValidationResult {
  /** Whether the RRULE is valid */
  valid: boolean;
  /** Critical errors that prevent rule execution */
  errors: string[];
  /** Non-critical warnings about rule behavior */
  warnings: string[];
}

/**
 * Detailed explanation of how a recurrence date was calculated
 * For debugging and auditability
 */
export interface RecurrenceExplanation {
  /** Task identifier */
  taskId: string;
  /** Reference date used for calculation (ISO string) */
  referenceDate: string;
  /** RRULE string that was evaluated */
  rule: string;
  /** Scheduling mode used */
  mode: RecurrenceMode;
  /** Calculated result date (ISO string) or null if series ended */
  resultDate: string | null;
  /** Step-by-step evaluation trace */
  evaluationSteps: ExplanationStep[];
  /** Timezone used for calculation */
  timezone: string;
  /** Any warnings generated during calculation */
  warnings: string[];
}

/**
 * Single step in the recurrence calculation process
 */
export interface ExplanationStep {
  /** Step sequence number */
  step: number;
  /** Human-readable description of this step */
  description: string;
  /** Optional value/result from this step */
  value?: string;
}

/**
 * Result of missed occurrence calculation
 */
export interface MissedOccurrencesResult {
  /** Array of missed occurrence dates */
  missedDates: Date[];
  /** Number of missed occurrences */
  count: number;
  /** Whether the maximum limit was reached */
  limitReached: boolean;
  /** Warnings about the calculation */
  warnings: string[];
}

/**
 * Options for missed occurrence calculation
 */
export interface MissedOccurrenceOptions {
  /** Policy for handling missed occurrences */
  policy?: MissPolicy;
  /** Maximum number of missed occurrences to return */
  maxMissed?: number;
  /** Callback invoked for each missed occurrence */
  onMissedOccurrence?: (taskId: string, expectedDate: Date) => void;
}

/**
 * Cache entry for parsed RRule objects
 */
export interface CacheEntry {
  /** Cached RRule instance */
  rrule: import('rrule').RRule;
  /** Cache key */
  key: string;
  /** Number of cache hits */
  hits: number;
  /** Last access timestamp */
  lastAccess: number;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /** Current cache size */
  size: number;
  /** Maximum cache size */
  maxSize: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Total number of cache hits */
  totalHits: number;
  /** Total number of cache misses */
  totalMisses: number;
}

/**
 * Core interface that the RecurrenceEngine must implement
 * This is the frozen API contract - do not modify without versioning
 */
export interface IRecurrenceEngine {
  /**
   * Calculate next occurrence after a reference date
   * @param task - Task with RRULE configuration
   * @param ref - Reference date (completion date for whenDone, last occurrence otherwise)
   * @returns Next occurrence date or null if series ended
   */
  next(task: Task, ref: Date): Date | null;

  /**
   * Generate preview of upcoming occurrences
   * @param task - Task with RRULE configuration
   * @param from - Start date for preview
   * @param limit - Maximum number of occurrences to generate (capped at 500)
   * @returns Array of upcoming occurrence dates
   */
  preview(task: Task, from: Date, limit: number): Date[];

  /**
   * Get all occurrences within a date range
   * @param task - Task with RRULE configuration
   * @param from - Start of range (inclusive)
   * @param to - End of range (inclusive)
   * @returns Array of occurrence dates in range
   */
  between(task: Task, from: Date, to: Date): Date[];

  /**
   * Validate an RRULE string with a DTSTART date
   * @param rrule - RRULE string to validate
   * @param dtstart - Start date for the rule
   * @returns Validation result with errors and warnings
   */
  isValid(rrule: string, dtstart: Date): ValidationResult;

  /**
   * Generate detailed explanation of next occurrence calculation
   * @param task - Task with RRULE configuration
   * @param ref - Reference date for calculation
   * @returns Detailed explanation of the calculation
   */
  explain(task: Task, ref: Date): RecurrenceExplanation;
}
