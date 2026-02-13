/**
 * TaskCreationService - Phase 3: RRule-Only Mode
 * 
 * This service enforces RRule-based task creation for all new tasks.
 * Legacy Frequency objects are automatically converted to Recurrence.
 */

import type { Task } from '../models/Task';
import type { Recurrence } from '../../../domain/models/Recurrence';
import type { PluginSettings } from '../settings/PluginSettings';
import { createTask as createTaskLegacy } from '../models/Task';
import { RecurrenceEngine } from '@backend/core/engine/recurrence/RecurrenceEngine';
import { FrequencyToRecurrenceConverter, type LegacyFrequency } from '../migration/FrequencyToRecurrenceConverter';

// Type alias for backward compatibility
type Frequency = LegacyFrequency;

export interface CreateTaskOptions {
  name: string;
  dueAt?: Date | string;
  
  // Exclusive: provide either frequency OR recurrence
  frequency?: Frequency;
  recurrence?: Recurrence;
  
  // Additional options
  priority?: string;
  tags?: string[];
  description?: string;
  notificationChannels?: string[];
  timezone?: string;
}

export class TaskCreationService {
  private recurrenceEngine: RecurrenceEngine;

  constructor(private settings: PluginSettings) {
    this.recurrenceEngine = new RecurrenceEngine();
  }

  /**
   * Create a new task with RRule-based recurrence
   * 
   * Phase 3 Logic:
   * - All tasks use RRule (Recurrence) by default
   * - Legacy Frequency is automatically converted to Recurrence
   * - Non-recurring tasks have no recurrence field
   * 
   * @param options Task creation options
   * @returns New task with RRule recurrence
   */
  createTask(options: CreateTaskOptions): Task {
    const dueDate = this.parseDueDate(options.dueAt);
    
    // Determine recurrence configuration
    const { frequency, recurrence } = this.determineRecurrence(options, dueDate);

    // Create base task (legacy method)
    // Note: Legacy createTask requires a frequency, we'll use a dummy one if needed
    const freq = frequency || this.getDefaultFrequency();
    const task = createTaskLegacy(options.name, freq, dueDate);

    // Add RRule recurrence if available
    if (recurrence) {
      task.recurrence = recurrence;
      task.recurrenceText = this.recurrenceEngine.toNaturalLanguage(recurrence.rrule, recurrence.referenceDate ? new Date(recurrence.referenceDate) : undefined);
    }

    // Apply additional options
    if (options.priority) {
      task.priority = options.priority as any;
    }

    if (options.tags) {
      task.tags = options.tags;
    }

    if (options.description) {
      task.description = options.description;
    }

    if (options.notificationChannels) {
      task.notificationChannels = options.notificationChannels;
    }

    if (options.timezone) {
      task.timezone = options.timezone;
    }

    return task;
  }

  /**
   * Create task from natural language recurrence
   * 
   * @deprecated Natural language parsing not yet implemented in canonical RecurrenceEngine
   * @todo Implement natural language parser or integrate with external library
   * 
   * @example
   * createFromText({
   *   name: 'Team meeting',
   *   recurrenceText: 'every Monday at 10am',
   *   dueAt: new Date()
   * })
   */
  createFromText(options: {
    name: string;
    recurrenceText: string;
    dueAt?: Date | string;
    priority?: string;
    tags?: string[];
  }): Task | null {
    // TODO: Phase 3 - Implement natural language parser
    // For now, throw an error to indicate this feature is not yet available
    throw new Error('Natural language recurrence parsing not yet implemented. Use RRULE strings or Frequency objects instead.');
    
    /* Future implementation:
    const dueDate = this.parseDueDate(options.dueAt);
    const rruleString = parseNaturalLanguageToRRule(options.recurrenceText);
    const recurrence: Recurrence = {
      rrule: rruleString,
      baseOnToday: false,
      humanReadable: options.recurrenceText,
      referenceDate: dueDate
    };
    return this.createTask({ ...options, recurrence });
    */
  }

  /**
   * Determine recurrence (Phase 3: Always use RRule)
   */
  private determineRecurrence(
    options: CreateTaskOptions,
    dueDate: Date
  ): { frequency?: Frequency; recurrence?: Recurrence } {
    // Priority 1: Explicit recurrence provided
    if (options.recurrence) {
      return { recurrence: options.recurrence };
    }

    // Priority 2: Convert frequency to recurrence (Phase 3: Always convert)
    if (options.frequency) {
      const conversionResult = FrequencyToRecurrenceConverter.convert(options.frequency, dueDate);
      
      if (!conversionResult.success || !conversionResult.rruleString) {
        console.error('Failed to convert frequency to RRULE:', conversionResult.error);
        return {}; // Return no recurrence if conversion fails
      }
      
      const recurrence: Recurrence = {
        rrule: conversionResult.rruleString,
        baseOnToday: options.frequency.whenDone || false,
        humanReadable: this.recurrenceEngine.toNaturalLanguage(conversionResult.rruleString, dueDate),
        referenceDate: dueDate
      };
      
      return { recurrence };
    }

    // No recurrence specified
    return {};
  }

  /**
   * Parse due date from various formats
   */
  private parseDueDate(dueAt?: Date | string): Date {
    if (!dueAt) {
      return new Date();
    }

    if (typeof dueAt === 'string') {
      return new Date(dueAt);
    }

    return dueAt;
  }

  /**
   * Get default frequency for legacy compatibility
   */
  private getDefaultFrequency(): Frequency {
    return {
      type: 'daily',
      interval: 1,
      time: undefined,
      timezone: undefined,
      whenDone: false,
    };
  }
}

/**
 * Helper: Create task creation service with settings
 */
export function createTaskCreationService(settings: PluginSettings): TaskCreationService {
  return new TaskCreationService(settings);
}
