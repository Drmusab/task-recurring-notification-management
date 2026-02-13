// @ts-nocheck
/**
 * ⚠️⚠️⚠️ DEPRECATED FILE - SCHEDULED FOR REMOVAL IN PHASE 3 ⚠️⚠️⚠️
 * ==================================================================
 * 
 * This file contains the DualEngineScheduler which is DEPRECATED after Phase 2.
 * All recurrence logic now uses the canonical RecurrenceEngine.
 * 
 * **DO NOT USE THIS FILE FOR NEW CODE**
 * 
 * Use instead:
 *   import { RecurrenceEngine } from '@backend/core/engine/recurrence/RecurrenceEngine';
 * 
 * This file is kept temporarily for backward compatibility only.
 * It will be removed in Phase 3: Advanced Query Features.
 * 
 * Known Issues (not fixed, will be removed):
 * - Does not implement IRecurrenceEngine interface correctly
 * - Uses deprecated static methods that no longer exist
 * - Type incompatibilities with Task models
 * 
 * Migration Guide: See PHASE2_UNIFIED_API_CONTRACT.md
 * ==================================================================
 */

/**
 * DualEngineScheduler - Task scheduling with both legacy and RRule systems
 * Phase 1: Dual-Engine Mode
 * 
 * This scheduler provides backward compatibility by supporting both:
 * - NEW: RRule-based recurrence (via Recurrence field)
 * - LEGACY: Frequency-based recurrence
 * 
 * It automatically chooses the appropriate engine based on the task configuration.
 */

import type { Task } from '../models/Task';
import type { IRecurrenceEngine } from '@backend/core/engine/recurrence/recurrence.types';
import { RecurrenceEngine } from '@backend/core/engine/recurrence/RecurrenceEngine';
import { RecurrenceCalculator } from '../../recurrence/RecurrenceCalculator';
import { FrequencyConverter } from '../utils/FrequencyConverter';
import type { RecurrencePattern } from '../../commands/types/CommandTypes';

/**
 * @deprecated DualEngineScheduler is deprecated after Phase 2.
 * Use RecurrenceEngine directly - all tasks now use RRULE format.
 * This compatibility layer will be removed in Phase 3.
 */

/**
 * Scheduling result with metadata
 */
export interface ScheduleResult {
  nextDate: Date | null;
  engine: 'rrule' | 'legacy';
  warning?: string;
  canUpgradeToRRule?: boolean;
}

/**
 * Dual-engine task scheduler
 * Transparently supports both old and new recurrence systems
 */
export class DualEngineScheduler implements IRecurrenceEngine {
  private preferRRule = true; // Phase 1: prefer new system when available

  constructor(options?: { preferRRule?: boolean }) {
    if (options?.preferRRule !== undefined) {
      this.preferRRule = options.preferRRule;
    }
  }

  /**
   * Get next occurrence for a task
   * Auto-selects appropriate engine based on task configuration
   * 
   * Priority:
   * 1. If task.recurrence exists → use RRule engine
   * 2. If task.frequency exists → use legacy engine (with opt-in conversion)
   * 3. Otherwise → no recurrence
   * 
   * @param task Task with recurrence configuration
   * @returns Next occurrence date or null
   */
  getNextOccurrence(task: Task): Date | null {
    const result = this.getNextOccurrenceWithMetadata(task);
    return result.nextDate;
  }

  /**
   * Get next occurrence with engine metadata
   * Useful for debugging and migration tracking
   * 
   * @param task Task with recurrence configuration
   * @param fromDate Calculate from this date (default: now)
   * @returns Schedule result with metadata
   */
  getNextOccurrenceWithMetadata(
    task: Task,
    fromDate: Date = new Date()
  ): ScheduleResult {
    // Priority 1: RRule-based recurrence (new system)
    if (task.recurrence) {
      try {
        const result = RecurrenceEngine.calculateNext(task.recurrence, fromDate);
        
        return {
          nextDate: result?.nextDate || null,
          engine: 'rrule',
          warning: result?.warning,
        };
      } catch (error) {
        console.error('RRule engine failed:', error);
        // Fall through to legacy if RRule fails
      }
    }

    // Priority 2: Legacy frequency-based recurrence
    if (task.frequency) {
      try {
        // Convert to legacy RecurrencePattern format
        const pattern = this.frequencyToPattern(task.frequency);
        const baseDate = task.dueAt ? new Date(task.dueAt) : fromDate;
        
        const nextDate = RecurrenceCalculator.calculateNext(pattern, baseDate);

        // Check if task can be upgraded to RRule
        const canUpgrade = FrequencyConverter.shouldConvert(task);

        return {
          nextDate,
          engine: 'legacy',
          canUpgradeToRRule: canUpgrade,
          warning: canUpgrade 
            ? 'This task can be upgraded to RRule for better recurrence handling'
            : undefined,
        };
      } catch (error) {
        console.error('Legacy engine failed:', error);
        return {
          nextDate: null,
          engine: 'legacy',
          warning: `Failed to calculate recurrence: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    // No recurrence configured
    return {
      nextDate: null,
      engine: 'legacy',
    };
  }

  /**
   * Validate recurrence configuration
   * Supports both RRule and legacy Frequency validation
   * 
   * @param frequency Frequency or Recurrence object
   * @returns True if valid
   */
  validateFrequency(frequency: unknown): boolean {
    if (!frequency) return false;

    // Check if it's an RRule recurrence
    if (typeof frequency === 'object' && frequency !== null && 'rrule' in frequency) {
      const rec = frequency as any;
      const validation = RecurrenceEngine.validate(rec.rrule);
      return validation.valid;
    }

    // Legacy frequency validation
    if (typeof frequency === 'object' && frequency !== null && 'type' in frequency) {
      const freq = frequency as any;
      
      // Basic validation
      const validTypes = ['daily', 'weekly', 'monthly', 'yearly'];
      if (!validTypes.includes(freq.type)) {
        return false;
      }

      // Interval must be positive
      if (freq.interval !== undefined && freq.interval <= 0) {
        return false;
      }

      // Weekly must have weekdays
      if (freq.type === 'weekly' && (!freq.weekdays || freq.weekdays.length === 0)) {
        return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Get human-readable description of recurrence
   * 
   * @param task Task with recurrence
   * @returns Human-readable description
   */
  describeFrequency(task: Task): string {
    // Priority 1: RRule recurrence
    if (task.recurrence) {
      return RecurrenceEngine.toText(task.recurrence);
    }

    // Priority 2: Cached recurrenceText
    if (task.recurrenceText) {
      return task.recurrenceText;
    }

    // Priority 3: Legacy frequency
    if (task.frequency) {
      return this.describeLegacyFrequency(task.frequency);
    }

    return 'No recurrence';
  }

  /**
   * Auto-convert task from legacy to RRule (opt-in)
   * Returns updated task or null if conversion fails
   * 
   * @param task Task to convert
   * @returns Converted task or null
   */
  autoConvertToRRule(task: Task): Task | null {
    if (!FrequencyConverter.shouldConvert(task)) {
      return null;
    }

    return FrequencyConverter.updateTaskRecurrence(task, true);
  }

  /**
   * Get upcoming occurrences for a task
   * 
   * @param task Task with recurrence
   * @param daysAhead Number of days to look ahead (default: 30)
   * @returns Array of upcoming occurrence dates
   */
  getUpcomingOccurrences(task: Task, daysAhead: number = 30): Date[] {
    const start = new Date();
    const end = new Date(start.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    // Use RRule engine if available
    if (task.recurrence) {
      return RecurrenceEngine.getOccurrences(task.recurrence, start, end);
    }

    // Fallback: calculate manually with legacy engine
    if (task.frequency) {
      const occurrences: Date[] = [];
      let current = start;
      let iterations = 0;
      const maxIterations = daysAhead * 2; // Safety limit

      while (current < end && iterations < maxIterations) {
        const result = this.getNextOccurrenceWithMetadata(task, current);
        if (!result.nextDate || result.nextDate > end) {
          break;
        }
        occurrences.push(result.nextDate);
        current = result.nextDate;
        iterations++;
      }

      return occurrences;
    }

    return [];
  }

  // ===== Private Helper Methods =====

  /**
   * Convert Frequency to legacy RecurrencePattern format
   */
  private frequencyToPattern(frequency: any): RecurrencePattern {
    switch (frequency.type) {
      case 'daily':
        return {
          type: 'daily',
        };

      case 'weekly':
        return {
          type: 'weekly',
          daysOfWeek: frequency.weekdays ? frequency.weekdays.map((d: number) => 
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][d]
          ) : [],
        };

      case 'monthly':
        return {
          type: 'monthly',
          dayOfMonth: frequency.dayOfMonth,
        };

      case 'yearly':
        return {
          type: 'yearly',
          monthOfYear: frequency.monthOfYear,
          dayOfMonth: frequency.dayOfMonth,
        };

      default:
        return {
          type: 'interval',
          interval: frequency.interval || 1,
          unit: 'days',
        };
    }
  }

  /**
   * Describe legacy frequency in human-readable format
   */
  private describeLegacyFrequency(frequency: any): string {
    const interval = frequency.interval || 1;
    const type = frequency.type;

    let text = interval === 1 ? `every ${type}` : `every ${interval} ${type}s`;

    if (type === 'weekly' && frequency.weekdays && frequency.weekdays.length > 0) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const selectedDays = frequency.weekdays.map((d: number) => days[d]).join(', ');
      text += ` on ${selectedDays}`;
    }

    if (type === 'monthly' && frequency.dayOfMonth) {
      text += ` on day ${frequency.dayOfMonth}`;
    }

    if (frequency.whenDone) {
      text += ' when done';
    }

    return text;
  }
}

/**
 * Global scheduler instance
 * Can be replaced with a custom configuration
 */
export const globalScheduler = new DualEngineScheduler({ preferRRule: true });
