/**
 * FrequencyConverter - Utility for converting between Frequency and Recurrence
 * Phase 1: Dual-Engine Mode
 * 
 * This utility helps with the gradual migration from the legacy Frequency
 * system to the new RRule-based Recurrence system.
 */

import type { Task } from '../../../domain/models/Task';
import type { Recurrence } from '../../../domain/models/Recurrence';
import { RecurrenceEngine } from '@backend/core/engine/recurrence/RecurrenceEngine';
import { FrequencyToRecurrenceConverter, type LegacyFrequency } from '../migration/FrequencyToRecurrenceConverter';

// Type alias for backward compatibility
type Frequency = LegacyFrequency;

/**
 * Result of auto-conversion attempt
 */
export interface ConversionResult {
  success: boolean;
  recurrence?: Recurrence;
  error?: string;
}

/**
 * Statistics for batch conversion
 */
export interface ConversionStats {
  total: number;
  converted: number;
  skipped: number;
  failed: number;
  errors: Array<{ taskId: string; error: string }>;
}

export class FrequencyConverter {
  private static recurrenceEngine = new RecurrenceEngine();

  /**
   * Check if a task should be auto-converted to RRule
   * 
   * @param task Task to check
   * @returns True if task has legacy frequency but no recurrence
   */
  static shouldConvert(task: Task): boolean {
    return !!(task.frequency && !task.recurrence);
  }

  /**
   * Auto-convert a task from Frequency to Recurrence
   * Non-destructive: preserves original frequency field
   * 
   * @param task Task with legacy frequency
   * @returns Conversion result
   */
  static convertTask(task: Task): ConversionResult {
    try {
      // Already has recurrence
      if (task.recurrence) {
        return {
          success: false,
          error: 'Task already has recurrence',
        };
      }

      // No frequency to convert
      if (!task.frequency) {
        return {
          success: false,
          error: 'Task has no frequency to convert',
        };
      }

      // Determine reference date
      const referenceDate = task.dueAt 
        ? new Date(task.dueAt) 
        : task.createdAt 
        ? new Date(task.createdAt)
        : new Date();

      // Convert using FrequencyToRecurrenceConverter
      const conversionResult = FrequencyToRecurrenceConverter.convert(task.frequency, referenceDate);
      
      if (!conversionResult.success || !conversionResult.rruleString) {
        return {
          success: false,
          error: conversionResult.error || 'Conversion failed',
        };
      }

      // Build Recurrence object from conversion result
      const recurrence: Recurrence = {
        rrule: conversionResult.rruleString,
        baseOnToday: task.frequency.whenDone || false,
        humanReadable: this.recurrenceEngine.toNaturalLanguage(conversionResult.rruleString, referenceDate),
        referenceDate: referenceDate
      };

      return {
        success: true,
        recurrence,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert a task and update its recurrence field
   * Optionally preserves or removes legacy frequency field
   * 
   * @param task Task to update
   * @param preserveFrequency Whether to keep the frequency field (default: true for safety)
   * @returns Updated task or null if conversion failed
   */
  static updateTaskRecurrence(task: Task, preserveFrequency = true): Task | null {
    const result = this.convertTask(task);

    if (!result.success || !result.recurrence) {
      console.warn(`Failed to convert task ${task.id}:`, result.error);
      return null;
    }

    // Create updated task
    const updated: Task = {
      ...task,
      recurrence: result.recurrence,
      recurrenceText: this.recurrenceEngine.toNaturalLanguage(
        result.recurrence.rrule,
        result.recurrence.referenceDate ? new Date(result.recurrence.referenceDate) : undefined
      ),
      updatedAt: new Date().toISOString(),
    };

    // Optionally remove frequency (Phase 2+)
    if (!preserveFrequency) {
      delete updated.frequency;
    }

    return updated;
  }

  /**
   * Batch convert multiple tasks
   * 
   * @param tasks Tasks to convert
   * @param updateCallback Optional callback to persist each converted task
   * @returns Conversion statistics
   */
  static async convertBatch(
    tasks: Task[],
    updateCallback?: (task: Task) => Promise<void>
  ): Promise<ConversionStats> {
    const stats: ConversionStats = {
      total: tasks.length,
      converted: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const task of tasks) {
      try {
        // Skip if already has recurrence
        if (task.recurrence) {
          stats.skipped++;
          continue;
        }

        // Skip if no frequency
        if (!task.frequency) {
          stats.skipped++;
          continue;
        }

        // Convert
        const updated = this.updateTaskRecurrence(task, true);

        if (!updated) {
          stats.failed++;
          stats.errors.push({
            taskId: task.id,
            error: 'Conversion returned null',
          });
          continue;
        }

        // Persist if callback provided
        if (updateCallback) {
          await updateCallback(updated);
        }

        stats.converted++;
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          taskId: task.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return stats;
  }

  /**
   * Check if RRule system is available (rrule package installed and working)
   * 
   * @returns True if RRule can be used
   */
  static isRRuleAvailable(): boolean {
    try {
      // Try importing RRule
      const { RRule } = require('rrule');
      
      // Try creating a simple rule
      const testRule = new RRule({
        freq: RRule.DAILY,
        interval: 1,
      });

      return !!testRule;
    } catch {
      return false;
    }
  }

  /**
   * Get conversion preview (dry run)
   * Shows what would happen without making changes
   * 
   * @param task Task to preview
   * @returns Preview of conversion
   */
  static previewConversion(task: Task): {
    canConvert: boolean;
    current: string;
    converted?: string;
    warning?: string;
  } {
    if (task.recurrence) {
      return {
        canConvert: false,
        current: this.recurrenceEngine.toNaturalLanguage(
          task.recurrence.rrule,
          task.recurrence.referenceDate ? new Date(task.recurrence.referenceDate) : undefined
        ),
        warning: 'Task already uses RRule recurrence',
      };
    }

    if (!task.frequency) {
      return {
        canConvert: false,
        current: 'No recurrence',
        warning: 'Task has no frequency to convert',
      };
    }

    // Show current frequency
    const current = this.formatFrequency(task.frequency);

    // Try conversion
    const result = this.convertTask(task);

    if (!result.success || !result.recurrence) {
      return {
        canConvert: false,
        current,
        warning: result.error,
      };
    }

    return {
      canConvert: true,
      current,
      converted: this.recurrenceEngine.toNaturalLanguage(
        result.recurrence.rrule,
        result.recurrence.referenceDate ? new Date(result.recurrence.referenceDate) : undefined
      ),
    };
  }

  /**
   * Format legacy Frequency for display
   */
  private static formatFrequency(freq: any): string {
    const interval = freq.interval || 1;
    const type = freq.type;

    let text = interval === 1 ? `every ${type}` : `every ${interval} ${type}s`;

    if (type === 'weekly' && 'weekdays' in freq && freq.weekdays) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const selectedDays = freq.weekdays.map((d: number) => days[d]).join(', ');
      text += ` on ${selectedDays}`;
    }

    if (type === 'monthly' && 'dayOfMonth' in freq && freq.dayOfMonth) {
      text += ` on day ${freq.dayOfMonth}`;
    }

    if (freq.whenDone) {
      text += ' when done';
    }

    return text;
  }
}
