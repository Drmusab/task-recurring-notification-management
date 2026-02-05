/**
 * RecurrenceExplainer - Debug and explanation layer for RRULE calculations
 * 
 * Provides detailed explanations of:
 * - How a date was calculated
 * - Which RRULE components were applied
 * - Why certain dates were skipped
 * - What the reference point was
 */

import { RRule, rrulestr, RRuleSet } from 'rrule';
import type { Task } from '@backend/core/models/Task';
import type { RecurrenceExplanation, ExplanationStep, RecurrenceMode } from './types';
import { getUserTimezone } from '@shared/utils/misc/timezone';
import * as logger from '@shared/utils/misc/logger';

/**
 * RecurrenceExplainer generates human-readable explanations
 * of recurrence calculations for debugging and auditability
 */
export class RecurrenceExplainer {
  /**
   * Generate detailed explanation of next occurrence calculation
   * @param task - Task with RRULE configuration
   * @param ref - Reference date
   * @param rrule - Parsed RRule object
   * @param resultDate - Calculated result date (or null)
   * @returns Detailed explanation
   */
  explain(
    task: Task,
    ref: Date,
    rrule: RRule,
    resultDate: Date | null
  ): RecurrenceExplanation {
    const steps: ExplanationStep[] = [];
    const warnings: string[] = [];
    let stepNum = 1;

    // Step 1: Determine recurrence mode
    const mode: RecurrenceMode = this.getRecurrenceMode(task);
    steps.push({
      step: stepNum++,
      description: `Recurrence mode: ${mode}`,
      value: mode === 'whenDone' 
        ? 'Schedule slides based on completion date'
        : 'Schedule is fixed to DTSTART + rule'
    });

    // Step 2: Identify reference date
    steps.push({
      step: stepNum++,
      description: 'Reference date',
      value: ref.toISOString()
    });

    // Step 3: Extract RRULE details
    const options = rrule.origOptions;
    const ruleString = task.frequency?.rruleString || '';
    
    steps.push({
      step: stepNum++,
      description: 'RRULE string',
      value: ruleString
    });

    // Step 4: DTSTART
    if (options.dtstart) {
      steps.push({
        step: stepNum++,
        description: 'DTSTART (series start date)',
        value: options.dtstart.toISOString()
      });
    }

    // Step 5: Frequency
    const freqName = this.getFrequencyName(options.freq);
    steps.push({
      step: stepNum++,
      description: 'Frequency',
      value: `${freqName}${options.interval && options.interval > 1 ? ` (every ${options.interval})` : ''}`
    });

    // Step 6: Additional constraints
    if (options.byweekday) {
      const weekdays = this.formatWeekdays(options.byweekday);
      steps.push({
        step: stepNum++,
        description: 'By weekday',
        value: weekdays
      });
    }

    if (options.bymonthday) {
      steps.push({
        step: stepNum++,
        description: 'By month day',
        value: Array.isArray(options.bymonthday) 
          ? options.bymonthday.join(', ') 
          : String(options.bymonthday)
      });
    }

    if (options.bymonth) {
      const months = this.formatMonths(options.bymonth);
      steps.push({
        step: stepNum++,
        description: 'By month',
        value: months
      });
    }

    // Step 7: Termination conditions
    if (options.until) {
      steps.push({
        step: stepNum++,
        description: 'UNTIL (series ends)',
        value: options.until.toISOString()
      });
      
      if (options.until < ref) {
        warnings.push('Series has ended (UNTIL date is before reference date)');
      }
    }

    if (options.count) {
      steps.push({
        step: stepNum++,
        description: 'COUNT (max occurrences)',
        value: String(options.count)
      });
    }

    // Step 8: Timezone
    const timezone = options.tzid || task.frequency?.timezone || task.timezone || getUserTimezone();
    steps.push({
      step: stepNum++,
      description: 'Timezone',
      value: timezone
    });

    // Step 9: Calculate next occurrence
    steps.push({
      step: stepNum++,
      description: 'Calculate next occurrence after reference date',
      value: resultDate 
        ? `Next occurrence: ${resultDate.toISOString()}`
        : 'No next occurrence (series ended or invalid)'
    });

    // Step 10: Apply fixed time if specified
    if (task.frequency?.time && resultDate) {
      steps.push({
        step: stepNum++,
        description: 'Apply fixed time',
        value: `Time set to ${task.frequency.time}`
      });
    }

    // Step 11: Result
    if (resultDate === null) {
      steps.push({
        step: stepNum++,
        description: 'Result',
        value: 'Series has ended or no valid occurrence found'
      });
      
      if (!warnings.some(w => w.includes('ended'))) {
        warnings.push('No future occurrences available');
      }
    } else {
      steps.push({
        step: stepNum++,
        description: 'Result',
        value: `Next due date: ${resultDate.toISOString()}`
      });
    }

    return {
      taskId: task.id,
      referenceDate: ref.toISOString(),
      rule: ruleString,
      mode,
      resultDate: resultDate ? resultDate.toISOString() : null,
      evaluationSteps: steps,
      timezone,
      warnings
    };
  }

  /**
   * Explain why a specific date was or was not an occurrence
   */
  explainDate(task: Task, date: Date, rrule: RRule): string {
    const steps: string[] = [];
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const occurrences = rrule.between(startOfDay, endOfDay, true);
    
    if (occurrences.length > 0) {
      steps.push(`✓ ${date.toISOString()} IS a valid occurrence`);
      steps.push(`  Matched ${occurrences.length} time(s) on this date`);
      occurrences.forEach((occ, idx) => {
        steps.push(`  [${idx + 1}] ${occ.toISOString()}`);
      });
    } else {
      steps.push(`✗ ${date.toISOString()} is NOT a valid occurrence`);
      
      const options = rrule.origOptions;
      
      // Explain why it wasn't matched
      if (options.dtstart && date < options.dtstart) {
        steps.push(`  Reason: Date is before DTSTART (${options.dtstart.toISOString()})`);
      } else if (options.until && date > options.until) {
        steps.push(`  Reason: Date is after UNTIL (${options.until.toISOString()})`);
      } else if (options.byweekday) {
        const dayOfWeek = date.getDay();
        steps.push(`  Reason: Day of week (${this.getDayName(dayOfWeek)}) not in BYDAY constraint`);
      } else {
        steps.push(`  Reason: Date does not match the RRULE pattern`);
      }
    }
    
    return steps.join('\n');
  }

  /**
   * Generate a human-readable summary of an RRULE
   */
  summarize(rruleString: string, dtstart?: Date): string {
    try {
      const normalized = rruleString.startsWith('RRULE:') 
        ? rruleString 
        : `RRULE:${rruleString}`;
      
      const parsed = rrulestr(normalized);
      
      let rrule: RRule;
      if (parsed instanceof RRule) {
        rrule = parsed;
      } else if (parsed instanceof RRuleSet) {
        const rrules = parsed.rrules();
        if (rrules && rrules.length > 0) {
          rrule = rrules[0];
        } else {
          return 'Invalid RRuleSet';
        }
      } else {
        return 'Unknown rule type';
      }

      // Use RRule's built-in text conversion
      const options = { ...rrule.origOptions };
      if (dtstart && !options.dtstart) {
        options.dtstart = dtstart;
      }
      
      const ruleWithDtstart = new RRule(options);
      return ruleWithDtstart.toText();
      
    } catch (error) {
      logger.error('Failed to summarize RRULE', {
        rruleString,
        error: error instanceof Error ? error.message : String(error)
      });
      return rruleString;
    }
  }

  /**
   * Get recurrence mode from task
   */
  private getRecurrenceMode(task: Task): RecurrenceMode {
    const whenDone = task.frequency?.whenDone ?? task.whenDone ?? false;
    return whenDone ? 'whenDone' : 'fixed';
  }

  /**
   * Convert frequency constant to name
   */
  private getFrequencyName(freq: number): string {
    const names: Record<number, string> = {
      [RRule.YEARLY]: 'YEARLY',
      [RRule.MONTHLY]: 'MONTHLY',
      [RRule.WEEKLY]: 'WEEKLY',
      [RRule.DAILY]: 'DAILY',
      [RRule.HOURLY]: 'HOURLY',
      [RRule.MINUTELY]: 'MINUTELY',
      [RRule.SECONDLY]: 'SECONDLY'
    };
    return names[freq] || `Unknown(${freq})`;
  }

  /**
   * Format weekday constraints
   */
  private formatWeekdays(byweekday: any): string {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    if (Array.isArray(byweekday)) {
      return byweekday.map(wd => {
        if (typeof wd === 'number') {
          return dayNames[wd] || `Day ${wd}`;
        }
        // Handle RRule.Weekday objects
        if (wd && typeof wd === 'object' && 'weekday' in wd) {
          const name = dayNames[wd.weekday] || `Day ${wd.weekday}`;
          if (wd.n) {
            return `${wd.n > 0 ? '+' : ''}${wd.n} ${name}`;
          }
          return name;
        }
        return String(wd);
      }).join(', ');
    }
    
    return String(byweekday);
  }

  /**
   * Format month constraints
   */
  private formatMonths(bymonth: any): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    if (Array.isArray(bymonth)) {
      return bymonth.map(m => monthNames[m - 1] || `Month ${m}`).join(', ');
    }
    
    return monthNames[bymonth - 1] || `Month ${bymonth}`;
  }

  /**
   * Get day name from day number
   */
  private getDayName(day: number): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[day] || `Day ${day}`;
  }
}
