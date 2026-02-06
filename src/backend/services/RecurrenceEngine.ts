import type { Task } from "@backend/core/models/Task";

/**
 * Recurrence engine interface for command handlers.
 */
export interface IRecurrenceEngine {
  /** Calculate next occurrence for a task */
  getNextOccurrence(task: Task): Date | null;
  /** Validate a recurrence pattern */
  validateFrequency(frequency: unknown): boolean;
  /** Get human-readable description of recurrence */
  describeFrequency(task: Task): string;
}
