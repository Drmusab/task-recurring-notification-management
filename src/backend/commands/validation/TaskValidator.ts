import { WebhookError } from "@backend/webhook/types/Error";
import {
  CreateTaskData,
  UpdateTaskData,
  RecurrencePattern,
} from "@backend/commands/types/CommandTypes";
import { RecurrenceLimitsConfig } from "@backend/config/WebhookConfig";

/**
 * Task-specific validation logic
 */
export class TaskValidator {
  constructor(private recurrenceLimits: RecurrenceLimitsConfig) {}

  /**
   * Validate task creation data
   */
  validateCreateTask(data: CreateTaskData): void {
    // Title validation
    if (!data.title || typeof data.title !== 'string') {
      throw new WebhookError('VALIDATION_ERROR', 'Title is required and must be a string');
    }

    if (data.title.trim().length === 0) {
      throw new WebhookError('VALIDATION_ERROR', 'Title cannot be empty');
    }

    if (data.title.length > 500) {
      throw new WebhookError('VALIDATION_ERROR', 'Title cannot exceed 500 characters', {
        maxLength: 500,
        actualLength: data.title.length,
      });
    }

    // Description validation
    if (data.description !== undefined) {
      if (typeof data.description !== 'string') {
        throw new WebhookError('VALIDATION_ERROR', 'Description must be a string');
      }

      if (data.description.length > 10000) {
        throw new WebhookError(
          'VALIDATION_ERROR',
          'Description cannot exceed 10,000 characters',
          { maxLength: 10000, actualLength: data.description.length }
        );
      }
    }

    // Tags validation
    if (data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        throw new WebhookError('VALIDATION_ERROR', 'Tags must be an array');
      }

      if (data.tags.length > 50) {
        throw new WebhookError('VALIDATION_ERROR', 'Cannot exceed 50 tags', {
          maxTags: 50,
          actualTags: data.tags.length,
        });
      }

      for (const tag of data.tags) {
        if (typeof tag !== 'string') {
          throw new WebhookError('VALIDATION_ERROR', 'All tags must be strings');
        }

        if (tag.length > 100) {
          throw new WebhookError('VALIDATION_ERROR', 'Tag cannot exceed 100 characters', {
            tag,
          });
        }
      }
    }

    // Due date validation
    if (data.dueDate !== undefined) {
      this.validateDateString(data.dueDate, 'dueDate');
    }

    // Priority validation
    if (data.priority !== undefined) {
      if (!['low', 'medium', 'high'].includes(data.priority)) {
        throw new WebhookError(
          'VALIDATION_ERROR',
          'Priority must be one of: low, medium, high',
          { priority: data.priority }
        );
      }
    }

    // Recurrence pattern validation
    if (data.recurrencePattern !== undefined) {
      this.validateRecurrencePattern(data.recurrencePattern);
    }
  }

  /**
   * Validate task update data
   */
  validateUpdateTask(data: UpdateTaskData): void {
    // Task ID required
    if (!data.taskId || typeof data.taskId !== 'string') {
      throw new WebhookError('VALIDATION_ERROR', 'taskId is required and must be a string');
    }

    // At least one field to update
    const updateFields = ['title', 'description', 'tags', 'notificationSettings', 'dueDate', 'priority'];
    const hasUpdate = updateFields.some((field) => data[field as keyof UpdateTaskData] !== undefined);

    if (!hasUpdate) {
      throw new WebhookError(
        'VALIDATION_ERROR',
        'At least one field must be provided for update',
        { allowedFields: updateFields }
      );
    }

    // Validate individual fields if present (reuse create validation logic)
    if (data.title !== undefined) {
      if (typeof data.title !== 'string' || data.title.trim().length === 0) {
        throw new WebhookError('VALIDATION_ERROR', 'Title must be a non-empty string');
      }
    }

    if (data.dueDate !== undefined) {
      this.validateDateString(data.dueDate, 'dueDate');
    }

    if (data.priority !== undefined) {
      if (!['low', 'medium', 'high'].includes(data.priority)) {
        throw new WebhookError('VALIDATION_ERROR', 'Priority must be one of: low, medium, high');
      }
    }
  }

  /**
   * Validate recurrence pattern
   */
  validateRecurrencePattern(pattern: RecurrencePattern): void {
    // Type validation
    const validTypes = ['interval', 'daily', 'weekly', 'monthly', 'yearly'];
    if (!validTypes.includes(pattern.type)) {
      throw new WebhookError(
        'INVALID_RECURRENCE_PATTERN',
        `Recurrence type must be one of: ${validTypes.join(', ')}`,
        { type: pattern.type }
      );
    }

    // Interval-specific validation
    if (pattern.type === 'interval') {
      if (!pattern.interval || !pattern.unit) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          'Interval recurrence requires "interval" and "unit" fields'
        );
      }

      if (!Number.isInteger(pattern.interval) || pattern.interval <= 0) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          'Interval must be a positive integer',
          { interval: pattern.interval }
        );
      }

      const validUnits = ['minutes', 'hours', 'days', 'weeks', 'months', 'years'];
      if (!validUnits.includes(pattern.unit)) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          `Unit must be one of: ${validUnits.join(', ')}`,
          { unit: pattern.unit }
        );
      }

      // Check minimum interval
      if (pattern.unit === 'minutes' && pattern.interval < this.recurrenceLimits.minimumInterval.minutes) {
        if (this.recurrenceLimits.minimumInterval.requiresConfirmation) {
          throw new WebhookError(
            'HIGH_FREQUENCY_WARNING',
            `Interval must be at least ${this.recurrenceLimits.minimumInterval.minutes} minute(s)`,
            {
              minimumMinutes: this.recurrenceLimits.minimumInterval.minutes,
              actualMinutes: pattern.interval,
            }
          );
        }
      }
    }

    // Weekly-specific validation
    if (pattern.type === 'weekly') {
      if (!pattern.daysOfWeek || !Array.isArray(pattern.daysOfWeek)) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          'Weekly recurrence requires "daysOfWeek" array'
        );
      }

      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (const day of pattern.daysOfWeek) {
        if (!validDays.includes(day.toLowerCase())) {
          throw new WebhookError(
            'INVALID_RECURRENCE_PATTERN',
            `Invalid day of week: ${day}. Must be one of: ${validDays.join(', ')}`
          );
        }
      }

      if (pattern.daysOfWeek.length === 0) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          'daysOfWeek must contain at least one day'
        );
      }
    }

    // Monthly-specific validation
    if (pattern.type === 'monthly') {
      if (pattern.dayOfMonth === undefined) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          'Monthly recurrence requires "dayOfMonth" field'
        );
      }

      if (!Number.isInteger(pattern.dayOfMonth) || pattern.dayOfMonth < 1 || pattern.dayOfMonth > 31) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          'dayOfMonth must be an integer between 1 and 31',
          { dayOfMonth: pattern.dayOfMonth }
        );
      }
    }

    // Yearly-specific validation
    if (pattern.type === 'yearly') {
      if (pattern.monthOfYear === undefined || pattern.dayOfMonth === undefined) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          'Yearly recurrence requires "monthOfYear" and "dayOfMonth" fields'
        );
      }

      if (!Number.isInteger(pattern.monthOfYear) || pattern.monthOfYear < 1 || pattern.monthOfYear > 12) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          'monthOfYear must be an integer between 1 and 12',
          { monthOfYear: pattern.monthOfYear }
        );
      }
    }

    // Start/end date validation
    if (pattern.startDate !== undefined) {
      this.validateDateString(pattern.startDate, 'startDate');
    }

    if (pattern.endDate !== undefined) {
      this.validateDateString(pattern.endDate, 'endDate');

      if (pattern.startDate) {
        const start = new Date(pattern.startDate);
        const end = new Date(pattern.endDate);
        if (end <= start) {
          throw new WebhookError(
            'INVALID_RECURRENCE_PATTERN',
            'endDate must be after startDate',
            { startDate: pattern.startDate, endDate: pattern.endDate }
          );
        }
      }
    }

    // Horizon validation
    if (pattern.horizonDays !== undefined) {
      if (!Number.isInteger(pattern.horizonDays) || pattern.horizonDays < 1) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          'horizonDays must be a positive integer'
        );
      }

      if (pattern.horizonDays > this.recurrenceLimits.horizonDays.maximum) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          `horizonDays cannot exceed ${this.recurrenceLimits.horizonDays.maximum}`,
          {
            maximum: this.recurrenceLimits.horizonDays.maximum,
            requested: pattern.horizonDays,
          }
        );
      }
    }

    // Estimate annual tasks (explosion prevention)
    const estimatedAnnualTasks = this.estimateAnnualTasks(pattern);
    if (estimatedAnnualTasks > this.recurrenceLimits.maxAnnualTasks) {
      throw new WebhookError(
        'HIGH_FREQUENCY_EXPLOSION',
        `Pattern would generate ${estimatedAnnualTasks} tasks/year (max: ${this.recurrenceLimits.maxAnnualTasks})`,
        {
          estimatedTasksPerYear: estimatedAnnualTasks,
          maxAllowed: this.recurrenceLimits.maxAnnualTasks,
          recommendation: 'Increase interval or reduce frequency',
        }
      );
    }
  }

  /**
   * Estimate annual tasks for recurrence pattern
   */
  private estimateAnnualTasks(pattern: RecurrencePattern): number {
    switch (pattern.type) {
      case 'interval':
        if (!pattern.interval || !pattern.unit) return 0;
        const intervalMinutes = this.convertToMinutes(pattern.interval, pattern.unit);
        return Math.floor((365 * 24 * 60) / intervalMinutes);

      case 'daily':
        return 365;

      case 'weekly':
        return (pattern.daysOfWeek?.length || 1) * 52;

      case 'monthly':
        return 12;

      case 'yearly':
        return 1;

      default:
        return 0;
    }
  }

  /**
   * Convert interval to minutes
   */
  private convertToMinutes(interval: number, unit: string): number {
    const multipliers: Record<string, number> = {
      minutes: 1,
      hours: 60,
      days: 1440,
      weeks: 10080,
      months: 43200, // Approximate
      years: 525600, // Approximate
    };

    return interval * (multipliers[unit] || 1);
  }

  /**
   * Validate date string
   */
  private validateDateString(dateString: string, fieldName: string): void {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new WebhookError('VALIDATION_ERROR', `${fieldName} must be a valid ISO-8601 date`, {
        field: fieldName,
        value: dateString,
      });
    }

    if (date.toISOString() !== dateString) {
      throw new WebhookError(
        'VALIDATION_ERROR',
        `${fieldName} must be in strict ISO-8601 format`,
        {
          field: fieldName,
          value: dateString,
          expected: date.toISOString(),
        }
      );
    }
  }
}
