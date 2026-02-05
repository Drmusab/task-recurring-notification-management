import { RecurrencePattern } from "@backend/commands/types/CommandTypes";

/**
 * Pause recurrence data
 */
export interface PauseRecurrenceData {
  taskId: string;
  reason?: string; // Optional user note
}

/**
 * Resume recurrence data
 */
export interface ResumeRecurrenceData {
  taskId: string;
  resumeFromNow?: boolean; // If true, calculate next from now; if false, from original schedule
}

/**
 * Skip next occurrence data
 */
export interface SkipNextOccurrenceData {
  taskId: string;
  reason?: string; // Optional user note
  skipCount?: number; // Number of occurrences to skip (default: 1)
}

/**
 * Update recurrence pattern data
 */
export interface UpdateRecurrencePatternData {
  taskId: string;
  recurrencePattern: RecurrencePattern;
  applyToExisting?: boolean; // Recalculate existing due date immediately
}

/**
 * Preview occurrences data
 */
export interface PreviewOccurrencesData {
  taskId?: string; // If provided, use task's pattern
  recurrencePattern?: RecurrencePattern; // Or provide pattern directly
  startDate?: string; // ISO-8601, defaults to now
  limit?: number; // Max occurrences to preview (1-100)
  until?: string; // ISO-8601, show occurrences until this date
  horizonDays?: number; // Alternative to until
}

/**
 * Recalculate next occurrence data
 */
export interface RecalculateOccurrenceData {
  taskId: string;
  forceRecalculation?: boolean; // Force even if not needed
}
