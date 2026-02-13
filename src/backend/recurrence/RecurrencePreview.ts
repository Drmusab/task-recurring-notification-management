// @ts-nocheck
import { RecurrencePattern } from "@backend/commands/types/CommandTypes";
import { RecurrenceCalculator } from "@backend/recurrence/RecurrenceCalculator";
import { WebhookError } from "@backend/webhooks/types/Error";

/**
 * Preview future occurrences without generating tasks
 */
export class RecurrencePreview {
  /**
   * Generate preview of future occurrences
   */
  static previewOccurrences(
    pattern: RecurrencePattern,
    startDate: Date,
    options: {
      limit?: number;
      until?: Date;
      horizonDays?: number;
      maxIterations?: number;
    }
  ): {
    occurrences: Date[];
    truncated: boolean;
    nextOccurrenceAfterLimit: Date | null;
  } {
    const limit = Math.min(options.limit || 50, 100); // Max 100
    const maxIterations = options.maxIterations || 1000;

    const occurrences: Date[] = [];
    let current = new Date(startDate);
    let iterations = 0;
    let truncated = false;

    // Determine cutoff date
    let cutoffDate: Date | null = null;
    if (options.until) {
      cutoffDate = options.until;
    } else if (options.horizonDays) {
      cutoffDate = new Date(startDate);
      cutoffDate.setDate(cutoffDate.getDate() + options.horizonDays);
    }

    while (occurrences.length < limit && iterations < maxIterations) {
      try {
        const next = RecurrenceCalculator.calculateNext(pattern, current, maxIterations);

        if (!next) {
          break; // No more occurrences (beyond horizon or ended)
        }

        // Check cutoff
        if (cutoffDate && next > cutoffDate) {
          truncated = true;
          break;
        }

        occurrences.push(next);
        current = next;
        iterations++;
      } catch (error) {
        // Stop on calculation error
        break;
      }
    }

    // Check if we hit the limit
    if (occurrences.length === limit && iterations < maxIterations) {
      truncated = true;
    }

    // Calculate next occurrence after limit
    let nextOccurrenceAfterLimit: Date | null = null;
    if (truncated && occurrences.length > 0) {
      try {
        nextOccurrenceAfterLimit = RecurrenceCalculator.calculateNext(
          pattern,
          occurrences[occurrences.length - 1],
          maxIterations
        );
      } catch {
        // Ignore errors
      }
    }

    return {
      occurrences,
      truncated,
      nextOccurrenceAfterLimit,
    };
  }

  /**
   * Estimate total occurrences (approximate)
   */
  static estimateTotalOccurrences(
    pattern: RecurrencePattern,
    startDate: Date,
    horizonDays: number
  ): number {
    switch (pattern.type) {
      case 'interval':
        if (!pattern.interval || !pattern.unit) return 0;
        const intervalMinutes = this.convertToMinutes(pattern.interval, pattern.unit);
        const totalMinutes = horizonDays * 24 * 60;
        return Math.floor(totalMinutes / intervalMinutes);

      case 'daily':
        return horizonDays;

      case 'weekly':
        const weeksInHorizon = Math.floor(horizonDays / 7);
        return weeksInHorizon * (pattern.daysOfWeek?.length || 1);

      case 'monthly':
        const monthsInHorizon = Math.floor(horizonDays / 30);
        return monthsInHorizon;

      case 'yearly':
        const yearsInHorizon = Math.floor(horizonDays / 365);
        return yearsInHorizon;

      default:
        return 0;
    }
  }

  /**
   * Convert interval to minutes
   */
  private static convertToMinutes(interval: number, unit: string): number {
    const multipliers: Record<string, number> = {
      minutes: 1,
      hours: 60,
      days: 1440,
      weeks: 10080,
      months: 43200,
      years: 525600,
    };

    return interval * (multipliers[unit] || 1);
  }
}
