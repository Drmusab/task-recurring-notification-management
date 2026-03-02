/**
 * RecurrenceEngine - Complete RRULE-based recurrence engine
 * 
 * Single source of truth for recurrence calculations based on RFC 5545 RRULE.
 * This is the ONLY module that should import 'rrule' directly.
 * 
 * Core principles:
 * 1. RRULE is the only recurrence authority
 * 2. Deterministic behavior - same input always yields same output
 * 3. Every occurrence is auditable via explain()
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc5545
 */

import { RRule, rrulestr, RRuleSet } from 'rrule';
import type { Task } from '@backend/core/models/Task';
import type { Frequency } from '@backend/core/models/Frequency';
import { frequencyToRRule } from '@backend/core/models/Frequency';
import type { 
  IRecurrenceEngine, 
  RecurrenceExplanation, 
  ValidationResult,
  MissedOccurrencesResult,
  MissedOccurrenceOptions,
  MissPolicy
} from './recurrence.types';
import { RRuleCache } from './RRuleCache';
import { RecurrenceValidator } from './RecurrenceValidator';
import { RecurrenceExplainer } from './RecurrenceExplainer';
import { generateCacheKey } from './utils';
import { getUserTimezone } from "@shared/utils/date/timezone";
import * as logger from "@backend/logging/logger";

/**
 * Options for calculateNext convenience method
 */
export interface CalculateNextOptions {
  /** Completion date (used as base when whenDone=true) */
  completionDate?: Date;
  /** If true, calculate from completion date instead of due date */
  whenDone?: boolean;
}

/**
 * Maximum number of occurrences to generate in preview mode
 * Hard cap to prevent performance issues
 */
const MAX_PREVIEW_LIMIT = 500;

/**
 * Hard cap on between() results to prevent OOM for high-frequency rules
 */
const MAX_BETWEEN_RESULTS = 10000;

/**
 * Maximum loop iterations for forward-progress safety
 */
const MAX_LOOP_ITERATIONS = 1100;

/**
 * Maximum number of missed occurrences to return by default
 */
const DEFAULT_MAX_MISSED = 100;

/**
 * RecurrenceEngine - RFC 5545 compliant scheduling engine
 * 
 * Implements the frozen API contract defined in IRecurrenceEngine.
 * All recurrence calculations must go through this engine.
 */
export class RecurrenceEngine implements IRecurrenceEngine {
  private cache: RRuleCache;
  private validator: RecurrenceValidator;
  private explainer: RecurrenceExplainer;

  /**
   * Create a new RecurrenceEngine
   * @param cacheSize - Maximum cache size (default: 1000)
   */
  constructor(cacheSize: number = 1000) {
    this.cache = new RRuleCache(cacheSize);
    this.validator = new RecurrenceValidator();
    this.explainer = new RecurrenceExplainer();
  }

  /**
   * Calculate next occurrence after a reference date
   * 
   * Behavior:
   * - For "fixed" mode: calculates from task.dtstart + rule
   * - For "whenDone" mode: calculates from completion date
   * 
   * @param task - Task with RRULE configuration
   * @param ref - Reference date (completion date for whenDone, last occurrence otherwise)
   * @returns Next occurrence date or null if series ended
   */
  next(task: Task, ref: Date): Date | null {
    if (!task.recurrence?.rrule) {
      logger.warn('Task has no RRULE string', { taskId: task.id });
      return null;
    }

    try {
      const rrule = this.getRRule(task);
      const baseDate = this.getBaseDate(task, ref);
      
      // Get next occurrence after baseDate (false = non-inclusive)
      const next = rrule.after(baseDate, false);
      
      if (!next) {
        logger.debug('No next occurrence found', {
          taskId: task.id,
          baseDate: baseDate.toISOString()
        });
        return null;
      }

      // Apply fixed time if specified in task recurrence
      const withTime = this.applyFixedTime(next, task);
      
      // In whenDone mode, if no explicit fixed time, preserve the reference time
      const baseOnToday = task.recurrence?.baseOnToday ?? false;
      if (baseOnToday && !task.recurrence?.time) {
        const result = new Date(withTime);
        result.setUTCHours(ref.getUTCHours(), ref.getUTCMinutes(), ref.getUTCSeconds(), ref.getUTCMilliseconds());
        return result;
      }
      
      return withTime;
      
    } catch (error) {
      logger.error('Failed to calculate next occurrence', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Generate preview of upcoming occurrences
   * 
   * @param task - Task with RRULE configuration
   * @param from - Start date for preview
   * @param limit - Maximum number of occurrences (capped at 500)
   * @returns Array of upcoming occurrence dates
   */
  preview(task: Task, from: Date, limit: number): Date[] {
    if (!task.recurrence?.rrule) {
      logger.warn('Task has no RRULE string', { taskId: task.id });
      return [];
    }

    // Enforce hard cap
    const cappedLimit = Math.min(limit, MAX_PREVIEW_LIMIT);
    
    if (limit > MAX_PREVIEW_LIMIT) {
      logger.warn('Preview limit capped', {
        taskId: task.id,
        requested: limit,
        capped: cappedLimit
      });
    }

    try {
      const rrule = this.getRRule(task);
      
      // Use iterator approach to avoid materializing unbounded arrays.
      // For high-frequency rules (e.g., MINUTELY), between() with a 10-year
      // window could generate millions of Date objects before slicing.
      const results: Date[] = [];
      let current = rrule.after(from, false);
      let prev: Date | null = null;
      const farFuture = new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000 * 10); // 10 years
      let iterations = 0;
      
      while (current && current <= farFuture && results.length < cappedLimit) {
        // Forward-progress guard: if current didn't advance past prev, break
        if (prev && current.getTime() <= prev.getTime()) {
          logger.warn('Preview aborted: no forward progress detected', {
            taskId: task.id,
            stuckAt: current.toISOString()
          });
          break;
        }
        if (++iterations > MAX_LOOP_ITERATIONS) {
          logger.warn('Preview aborted: iteration limit reached', { taskId: task.id });
          break;
        }
        results.push(this.applyFixedTime(current, task));
        prev = current;
        current = rrule.after(current, false);
      }
      
      return results;
      
    } catch (error) {
      logger.error('Failed to generate preview', {
        taskId: task.id,
        from: from.toISOString(),
        limit: cappedLimit,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get all occurrences within a date range
   * 
   * @param task - Task with RRULE configuration
   * @param from - Start of range (inclusive)
   * @param to - End of range (inclusive)
   * @returns Array of occurrence dates in range
   */
  between(task: Task, from: Date, to: Date): Date[] {
    if (!task.recurrence?.rrule) {
      logger.warn('Task has no RRULE string', { taskId: task.id });
      return [];
    }

    try {
      const rrule = this.getRRule(task);
      
      // Use iterator approach with hard cap to prevent OOM
      // for high-frequency rules (e.g., MINUTELY over a large range)
      const results: Date[] = [];
      let current = rrule.after(from, true); // inclusive
      let prev: Date | null = null;
      let iterations = 0;
      
      while (current && current <= to && results.length < MAX_BETWEEN_RESULTS) {
        // Forward-progress guard
        if (prev && current.getTime() <= prev.getTime()) {
          logger.warn('Between aborted: no forward progress', {
            taskId: task.id,
            stuckAt: current.toISOString()
          });
          break;
        }
        if (++iterations > MAX_BETWEEN_RESULTS + 100) {
          logger.warn('Between aborted: iteration limit reached', { taskId: task.id });
          break;
        }
        results.push(this.applyFixedTime(current, task));
        prev = current;
        current = rrule.after(current, false); // next after current (non-inclusive)
      }
      
      if (results.length >= MAX_BETWEEN_RESULTS) {
        logger.warn('Between results capped', {
          taskId: task.id,
          cap: MAX_BETWEEN_RESULTS
        });
      }
      
      return results;
      
    } catch (error) {
      logger.error('Failed to get occurrences between dates', {
        taskId: task.id,
        from: from.toISOString(),
        to: to.toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Validate an RRULE string with a DTSTART date
   * 
   * @param rrule - RRULE string to validate
   * @param dtstart - Start date for the rule
   * @returns Validation result with errors and warnings
   */
  isValid(rrule: string, dtstart: Date): ValidationResult {
    return this.validator.validate(rrule, dtstart);
  }

  /**
   * Generate detailed explanation of next occurrence calculation
   * 
   * @param task - Task with RRULE configuration
   * @param ref - Reference date for calculation
   * @returns Detailed explanation of the calculation
   */
  explain(task: Task, ref: Date): RecurrenceExplanation {
    if (!task.recurrence?.rrule) {
      return {
        taskId: task.id,
        referenceDate: ref.toISOString(),
        rule: '',
        mode: 'fixed',
        resultDate: null,
        evaluationSteps: [{
          step: 1,
          description: 'Task has no RRULE string',
          value: 'Cannot calculate recurrence'
        }],
        timezone: task.timezone || getUserTimezone(),
        warnings: ['Task has no RRULE configured']
      };
    }

    try {
      const rrule = this.getRRule(task);
      const baseDate = this.getBaseDate(task, ref);
      const next = rrule.after(baseDate, false);
      const resultDate = next ? this.applyFixedTime(next, task) : null;
      
      return this.explainer.explain(task, ref, rrule, resultDate);
      
    } catch (error) {
      logger.error('Failed to generate explanation', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        taskId: task.id,
        referenceDate: ref.toISOString(),
        rule: task.recurrence.rrule || '',
        mode: 'fixed',
        resultDate: null,
        evaluationSteps: [{
          step: 1,
          description: 'Error occurred',
          value: error instanceof Error ? error.message : 'Unknown error'
        }],
        timezone: task.timezone || getUserTimezone(),
        warnings: ['Failed to calculate recurrence']
      };
    }
  }

  /**
   * Get missed occurrences between two dates
   * 
   * @param task - Task with RRULE configuration
   * @param lastCheckedAt - Last time the task was checked
   * @param now - Current time
   * @param options - Options for handling missed occurrences
   * @returns Result with missed occurrence dates and metadata
   */
  getMissedOccurrences(
    task: Task,
    lastCheckedAt: Date,
    now: Date,
    options?: MissedOccurrenceOptions
  ): MissedOccurrencesResult {
    const policy = options?.policy || 'skip';
    const maxMissed = options?.maxMissed || DEFAULT_MAX_MISSED;
    const warnings: string[] = [];

    // For 'skip' policy, return empty result
    if (policy === 'skip') {
      return {
        missedDates: [],
        count: 0,
        limitReached: false,
        warnings: ['Skip policy: missed occurrences are not tracked']
      };
    }

    if (!task.recurrence?.rrule) {
      return {
        missedDates: [],
        count: 0,
        limitReached: false,
        warnings: ['Task has no RRULE configured']
      };
    }

    try {
      // Use iterator approach to avoid materializing unbounded arrays.
      // For high-frequency rules (e.g., MINUTELY) with a large gap since
      // lastCheckedAt, between() would generate millions of dates.
      const rrule = this.getRRule(task);
      const missedDates: Date[] = [];
      let current = rrule.after(lastCheckedAt, false);
      let prev: Date | null = null;
      // Collect at most maxMissed+1 to detect if limit was reached
      const collectLimit = maxMissed + 1;
      let iterations = 0;
      
      while (current && current < now && missedDates.length < collectLimit) {
        // Forward-progress guard
        if (prev && current.getTime() <= prev.getTime()) {
          logger.warn('getMissedOccurrences aborted: no forward progress', {
            taskId: task.id,
            stuckAt: current.toISOString()
          });
          break;
        }
        if (++iterations > MAX_LOOP_ITERATIONS) {
          logger.warn('getMissedOccurrences aborted: iteration limit', { taskId: task.id });
          break;
        }
        missedDates.push(this.applyFixedTime(current, task));
        prev = current;
        current = rrule.after(current, false);
      }
      
      // Apply limit
      let limitReached = false;
      let result = missedDates;
      
      if (missedDates.length > maxMissed) {
        limitReached = true;
        result = missedDates.slice(0, maxMissed);
        warnings.push(`Limit reached: more than ${maxMissed} missed, returning first ${maxMissed}`);
      }

      // Invoke callback for each missed occurrence
      if (options?.onMissedOccurrence) {
        for (const date of result) {
          try {
            options.onMissedOccurrence(task.id, date);
          } catch (error) {
            logger.error('Error in onMissedOccurrence callback', {
              taskId: task.id,
              date: date.toISOString(),
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      return {
        missedDates: result,
        count: missedDates.length,
        limitReached,
        warnings
      };
      
    } catch (error) {
      logger.error('Failed to calculate missed occurrences', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        missedDates: [],
        count: 0,
        limitReached: false,
        warnings: ['Failed to calculate missed occurrences']
      };
    }
  }

  /**
   * Get or create cached RRule instance for a task
   * 
   * @param task - Task with RRULE configuration
   * @returns Parsed RRule object
   */
  private getRRule(task: Task): RRule {
    // Generate robust cache key
    const cacheKey = generateCacheKey(task.id, task.recurrence!.rrule!);
    
    // Get dtstart - prefer recurrence.referenceDate, fallback to task.dueAt or createdAt
    let dtstart = task.recurrence?.referenceDate 
      ? new Date(task.recurrence.referenceDate)
      : (task.dueAt ? new Date(task.dueAt) : new Date(task.createdAt));
    
    // Validate dtstart: guard against NaN dates
    if (isNaN(dtstart.getTime())) {
      logger.warn('getRRule: invalid dtstart, falling back to now', {
        taskId: task.id,
        referenceDate: task.recurrence?.referenceDate,
        dueAt: task.dueAt,
      });
      dtstart = new Date();
    }
    
    // Get timezone
    const timezone = task.recurrence?.timezone || task.timezone || getUserTimezone();
    
    // Get or parse from cache
    return this.cache.getOrParse(
      cacheKey,
      task.recurrence!.rrule!,
      dtstart,
      timezone
    );
  }

  /**
   * Determine base date for next occurrence calculation.
   * 
   * For "baseOnToday" tasks (whenDone mode), use the reference date
   * (typically the completion date) so the interval counts from now.
   * For "fixed" tasks, use the original dtstart from the recurrence rule
   * so the schedule stays anchored to its original start date.
   * 
   * @param task - Task with recurrence configuration
   * @param ref - Reference date (usually now or completion date)
   * @returns Base date for calculation
   */
  private getBaseDate(task: Task, ref: Date): Date {
    const baseOnToday = task.recurrence?.baseOnToday ?? false;
    
    if (baseOnToday) {
      // "whenDone" mode: calculate from completion/reference date
      return ref;
    }
    
    // Fixed mode: anchor to the original referenceDate so the schedule doesn't drift
    const refDate = task.recurrence?.referenceDate;
    if (refDate) {
      const parsed = new Date(refDate);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    // Fallback: use dueAt as the original anchor
    if (task.dueAt) {
      const parsed = new Date(task.dueAt);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    // Last resort: use reference date
    return ref;
  }

  /**
   * Apply fixed time to a date if specified in task frequency
   * 
   * @param date - Date to apply time to
   * @param task - Task with frequency configuration
   * @returns Date with applied time
   */
  private applyFixedTime(date: Date, task: Task): Date {
    // Get time from recurrence or extract from dueAt if available
    const time = task.recurrence?.time;
    if (!time) {
      return date;
    }

    try {
      const parts = time.split(':').map(Number);
      const hours = parts[0];
      const minutes = parts[1];
      if (hours === undefined || minutes === undefined || !Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return date;
      }

      const result = new Date(date);
      result.setHours(hours, minutes, 0, 0);
      return result;
      
    } catch (error) {
      logger.warn('Failed to apply fixed time', {
        taskId: task.id,
        time: time,
        error: error instanceof Error ? error.message : String(error)
      });
      return date;
    }
  }

  /**
   * Convenience method: calculate next occurrence from a legacy Frequency object.
   * 
   * Bridges the legacy Frequency-based API to the RRULE engine.
   * Supports `whenDone` mode: when true, calculates the next occurrence
   * relative to the completion date instead of the original due date.
   * 
   * @param dueDate - Original/current due date
   * @param frequency - Legacy Frequency object (or extended with weekdays/time/whenDone)
   * @param options - Optional: completionDate and whenDone flag
   * @returns Next occurrence date
   */
  calculateNext(
    dueDate: Date,
    frequency: Frequency & { weekdays?: number[]; time?: string; whenDone?: boolean },
    options?: CalculateNextOptions
  ): Date {
    // Resolve whenDone: options overrides frequency-level whenDone
    const whenDone = options?.whenDone ?? frequency.whenDone ?? false;
    const completionDate = options?.completionDate;
    
    // Determine base date for calculation
    const baseDate = whenDone && completionDate ? completionDate : dueDate;
    
    // Guard: interval must be >= 1 to guarantee forward progress
    const safeInterval = Math.max(1, frequency.interval || 1);
    if (frequency.interval !== undefined && frequency.interval < 1) {
      logger.warn('calculateNext: invalid interval clamped to 1', {
        original: frequency.interval,
        type: frequency.type,
      });
    }
    
    // Normalize weekdays: tests use `weekdays` (0=Mon..6=Sun) but Frequency uses `daysOfWeek` (0=Sun..6=Sat)
    const rawWeekdays = frequency.daysOfWeek ?? frequency.weekdays;
    const normalizedFreq: Frequency = {
      ...frequency,
      interval: safeInterval,
      daysOfWeek: rawWeekdays
        ? rawWeekdays.map((d: number) => (d + 1) % 7)  // Convert Mon=0 to Sun=0 convention
        : undefined,
    };
    
    // Convert to RRule string
    const rruleString = frequencyToRRule(normalizedFreq);
    
    // Parse RRule with DTSTART anchored at baseDate
    const rule = RRule.fromString(rruleString);
    const fullRule = new RRule({
      ...rule.origOptions,
      dtstart: baseDate,
    });
    
    // Get next occurrence strictly after baseDate
    const next = fullRule.after(baseDate, false);
    
    if (!next) {
      // Fallback: advance by interval (guaranteed >= 1)
      const result = new Date(baseDate);
      result.setDate(result.getDate() + safeInterval);
      return this.applyFrequencyTime(result, frequency);
    }
    
    // Safety: ensure the result is strictly after baseDate
    if (next.getTime() <= baseDate.getTime()) {
      logger.warn('calculateNext: RRULE returned non-advancing date, forcing +1 day', {
        baseDate: baseDate.toISOString(),
        rruleResult: next.toISOString(),
      });
      const forced = new Date(baseDate);
      forced.setDate(forced.getDate() + 1);
      return this.applyFrequencyTime(forced, frequency);
    }
    
    return this.applyFrequencyTime(next, frequency);
  }

  /**
   * Apply fixed time from frequency's `time` field
   */
  private applyFrequencyTime(
    date: Date,
    frequency: { time?: string }
  ): Date {
    if (!frequency.time) return date;
    
    try {
      const parts = frequency.time.split(':').map(Number);
      const hours = parts[0]!;
      const minutes = parts[1] ?? 0;
      if (!Number.isFinite(hours)) return date;
      
      const result = new Date(date);
      result.setUTCHours(hours, minutes, 0, 0);
      return result;
    } catch {
      return date;
    }
  }

  /**
   * Clear the RRule cache
   * Useful for testing or memory management
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * Useful for monitoring performance
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Invalidate cache for a specific task
   * Should be called when a task's recurrence rule changes
   * 
   * @param taskId - Task ID to invalidate
   * @returns Number of cache entries removed
   */
  invalidateTask(taskId: string): number {
    return this.cache.invalidateTask(taskId);
  }

  /**
   * Check if a specific date is a valid occurrence
   * 
   * @param task - Task with RRULE configuration
   * @param date - Date to check
   * @returns true if date matches RRULE
   */
  isOccurrenceOn(task: Task, date: Date): boolean {
    if (!task.recurrence?.rrule) {
      return false;
    }

    try {
      const rrule = this.getRRule(task);
      
      // Get occurrences on the same day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const occurrences = rrule.between(startOfDay, endOfDay, true);
      return occurrences.length > 0;
      
    } catch (error) {
      logger.error('Failed to check if date is occurrence', {
        taskId: task.id,
        date: date.toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Convert RRULE to human-readable text
   * 
   * @param rruleString - RRULE to convert
   * @param dtstart - Optional DTSTART date
   * @returns Natural language description
   */
  toNaturalLanguage(rruleString: string, dtstart?: Date): string {
    return this.explainer.summarize(rruleString, dtstart);
  }
}
