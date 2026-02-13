/**
 * Integration Tests - Recurrence System
 * Tests for DateUtils, RuleParser, RecurrenceEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as DateUtils from '../src/domain/utils/DateUtils';
import { parseRecurrenceRule, serializeRecurrenceRule, validateRecurrenceRule } from '../src/domain/recurrence/RuleParser';
import { RecurrenceEngine } from '@backend/core/engine/recurrence/RecurrenceEngine';
import { createTask } from '../src/domain/models/Task';

/**
 * @deprecated Legacy functions - converting to RecurrenceEngine API
 */
const engine = new RecurrenceEngine();
function calculateNextDueDate(task: any, fromCompletion: boolean = false, timezone?: string) {
  const refDate = fromCompletion && task.doneAt ? new Date(task.doneAt) : new Date(task.dueAt);
  return engine.next(task, refDate);
}
function generateNextInstance(task: any, fromCompletion: boolean = false) {
  const nextDate = calculateNextDueDate(task, fromCompletion);
  if (!nextDate) return null;
  return { ...task, dueAt: nextDate.toISOString(), doneAt: undefined };
}
function shouldStopRecurrence(task: any) {
  return !task.frequency?.rruleString;
}
function previewNextOccurrences(task: any, count: number) {
  return engine.preview(task, new Date(), count);
}
import type { Task, Frequency } from '../src/domain/models/Task';

describe('DateUtils - Timezone-Safe Operations', () => {
  describe('Date arithmetic', () => {
    it('should add days correctly', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = DateUtils.addDays(date, 5);
      
      expect(result.toISOString()).toContain('2024-01-20');
    });
    
    it('should handle month boundaries when adding days', () => {
      const date = new Date('2024-01-30T10:00:00Z');
      const result = DateUtils.addDays(date, 5);
      
      expect(result.toISOString()).toContain('2024-02-04');
    });
    
    it('should handle leap years', () => {
      const date = new Date('2024-02-28T10:00:00Z');
      const result = DateUtils.addDays(date, 1);
      
      expect(result.toISOString()).toContain('2024-02-29');
    });
    
    it('should add weeks correctly', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = DateUtils.addWeeks(date, 2);
      
      expect(result.toISOString()).toContain('2024-01-29');
    });
    
    it('should add months correctly', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = DateUtils.addMonths(date, 3);
      
      expect(result.toISOString()).toContain('2024-04-15');
    });
    
    it('should handle month-end dates when adding months', () => {
      const date = new Date('2024-01-31T10:00:00Z');
      const result = DateUtils.addMonths(date, 1);
      
      // Feb doesn't have 31 days, should use last day of month
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBeLessThanOrEqual(29);
    });
    
    it('should add years correctly', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = DateUtils.addYears(date, 2);
      
      expect(result.toISOString()).toContain('2026-01-15');
    });
  });
  
  describe('Weekday calculations', () => {
    it('should get next Monday correctly', () => {
      const friday = new Date('2024-01-19T10:00:00Z'); // Friday
      const nextMonday = DateUtils.getNextWeekday(friday, 1, false); // 1 = Monday
      
      expect(nextMonday.getDay()).toBe(1);
      expect(nextMonday.toISOString()).toContain('2024-01-22');
    });
    
    it('should get next occurrence when today matches weekday', () => {
      const monday = new Date('2024-01-22T10:00:00Z'); // Monday
      const nextMonday = DateUtils.getNextWeekday(monday, 1, false);
      
      // Should be next Monday, not today
      expect(nextMonday.toISOString()).toContain('2024-01-29');
    });
    
    it('should include today if requested', () => {
      const monday = new Date('2024-01-22T10:00:00Z');
      const result = DateUtils.getNextWeekday(monday, 1, true);
      
      expect(result.toISOString()).toContain('2024-01-22');
    });
  });
  
  describe('Natural date parsing', () => {
    it('should parse "tomorrow"', () => {
      const result = DateUtils.parseNaturalDate('tomorrow');
      
      expect(result).toBeDefined();
      if (result) {
        const tomorrow = DateUtils.addDays(new Date(), 1);
        expect(result.toDateString()).toBe(tomorrow.toDateString());
      }
    });
    
    it('should parse "next Monday"', () => {
      const result = DateUtils.parseNaturalDate('next Monday');
      
      expect(result).toBeDefined();
      if (result) {
        expect(result.getDay()).toBe(1); // Monday
      }
    });
    
    it('should parse relative dates like "+7d"', () => {
      const result = DateUtils.parseNaturalDate('+7d');
      
      expect(result).toBeDefined();
      if (result) {
        const expected = DateUtils.addDays(new Date(), 7);
        expect(result.toDateString()).toBe(expected.toDateString());
      }
    });
  });
  
  describe('DST edge cases', () => {
    it('should handle DST transition correctly', () => {
      // March 10, 2024 - DST starts in US
      const beforeDST = new Date('2024-03-09T10:00:00-08:00');
      const afterDST = DateUtils.addDays(beforeDST, 2);
      
      // Should still be same time of day
      expect(afterDST.getHours()).toBe(beforeDST.getHours());
    });
  });
});

describe('RuleParser - Natural Language Recurrence', () => {
  describe('Daily patterns', () => {
    it('should parse "every day"', () => {
      const freq = parseRecurrenceRule('every day');
      
      expect(freq).toBeDefined();
      expect(freq?.type).toBe('daily');
      expect(freq?.interval).toBe(1);
    });
    
    it('should parse "every 3 days"', () => {
      const freq = parseRecurrenceRule('every 3 days');
      
      expect(freq?.type).toBe('daily');
      expect(freq?.interval).toBe(3);
    });
  });
  
  describe('Weekly patterns', () => {
    it('should parse "every week"', () => {
      const freq = parseRecurrenceRule('every week');
      
      expect(freq?.type).toBe('weekly');
      expect(freq?.interval).toBe(1);
    });
    
    it('should parse "every Monday"', () => {
      const freq = parseRecurrenceRule('every Monday');
      
      expect(freq?.type).toBe('weekly');
      expect(freq?.daysOfWeek).toContain(1); // Monday
    });
    
    it('should parse "every weekday"', () => {
      const freq = parseRecurrenceRule('every weekday');
      
      expect(freq?.type).toBe('weekly');
      expect(freq?.daysOfWeek).toHaveLength(5); // Mon-Fri
    });
    
    it('should parse "biweekly"', () => {
      const freq = parseRecurrenceRule('biweekly');
      
      expect(freq?.type).toBe('weekly');
      expect(freq?.interval).toBe(2);
    });
  });
  
  describe('Monthly patterns', () => {
    it('should parse "every month"', () => {
      const freq = parseRecurrenceRule('every month');
      
      expect(freq?.type).toBe('monthly');
      expect(freq?.interval).toBe(1);
    });
    
    it('should parse "every 3rd Friday"', () => {
      const freq = parseRecurrenceRule('every 3rd Friday');
      
      expect(freq?.type).toBe('monthly');
      expect(freq?.daysOfWeek).toContain(5); // Friday
    });
    
    it('should parse "every month on the 15th"', () => {
      const freq = parseRecurrenceRule('every month on the 15th');
      
      expect(freq?.type).toBe('monthly');
      expect(freq?.dayOfMonth).toBe(15);
    });
  });
  
  describe('Yearly patterns', () => {
    it('should parse "every year"', () => {
      const freq = parseRecurrenceRule('every year');
      
      expect(freq?.type).toBe('yearly');
      expect(freq?.interval).toBe(1);
    });
  });
  
  describe('Serialization', () => {
    it('should serialize daily frequency', () => {
      const freq: Frequency = { type: 'daily', interval: 2 };
      const text = serializeRecurrenceRule(freq);
      
      expect(text).toBe('every 2 days');
    });
    
    it('should serialize weekly frequency with specific days', () => {
      const freq: Frequency = { type: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] };
      const text = serializeRecurrenceRule(freq);
      
      expect(text).toContain('Monday');
      expect(text).toContain('Wednesday');
      expect(text).toContain('Friday');
    });
  });
  
  describe('Validation', () => {
    it('should validate correct frequency', () => {
      const freq: Frequency = { type: 'daily', interval: 1 };
      const errors = validateRecurrenceRule(freq);
      
      expect(errors).toHaveLength(0); // Empty array = valid
    });
    
    it('should reject invalid interval', () => {
      const freq: Frequency = { type: 'daily', interval: 0 };
      const errors = validateRecurrenceRule(freq);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Interval must be positive');
    });
  });
});

describe('RecurrenceEngine - Next Instance Generation', () => {
  let baseTask: Task;
  
  beforeEach(() => {
    baseTask = createTask({
      name: 'Test recurring task',
      dueAt: '2024-01-15T10:00:00Z',
    });
  });
  
  describe('Daily recurrence', () => {
    it('should calculate next due date for daily task', () => {
      const task: Task = {
        ...baseTask,
        frequency: { type: 'daily', interval: 1 },
        dueAt: '2024-01-15T10:00:00Z',
      };
      
      const nextDate = calculateNextDueDate(task, false);
      
      expect(nextDate).toBeDefined();
      expect(nextDate?.toISOString()).toContain('2024-01-16');
    });
    
    it('should respect interval for daily tasks', () => {
      const task: Task = {
        ...baseTask,
        frequency: { type: 'daily', interval: 3 },
        dueAt: '2024-01-15T10:00:00Z',
      };
      
      const nextDate = calculateNextDueDate(task, false);
      
      expect(nextDate).toBeDefined();
      expect(nextDate?.toISOString()).toContain('2024-01-18');
    });
  });
  
  describe('Weekly recurrence', () => {
    it('should calculate next week for weekly task', () => {
      const task: Task = {
        ...baseTask,
        frequency: { type: 'weekly', interval: 1 },
        dueAt: '2024-01-15T10:00:00Z', // Monday
      };
      
      const nextDate = calculateNextDueDate(task, false);
      
      expect(nextDate).toBeDefined();
      expect(nextDate?.toISOString()).toContain('2024-01-22');
    });
    
    it('should jump to specific weekday', () => {
      const task: Task = {
        ...baseTask,
        frequency: { type: 'weekly', interval: 1, daysOfWeek: [5] }, // Friday
        dueAt: '2024-01-15T10:00:00Z', // Monday
      };
      
      const nextDate = calculateNextDueDate(task, false);
      
      expect(nextDate).toBeDefined();
      expect(nextDate?.getDay()).toBe(5); // Friday
      expect(nextDate?.toISOString()).toContain('2024-01-19');
    });
  });
  
  describe('Monthly recurrence', () => {
    it('should calculate next month', () => {
      const task: Task = {
        ...baseTask,
        frequency: { type: 'monthly', interval: 1 },
        dueAt: '2024-01-15T10:00:00Z',
      };
      
      const nextDate = calculateNextDueDate(task, false);
      
      expect(nextDate).toBeDefined();
      expect(nextDate?.toISOString()).toContain('2024-02-15');
    });
    
    it('should handle month boundaries', () => {
      const task: Task = {
        ...baseTask,
        frequency: { type: 'monthly', interval: 1 },
        dueAt: '2024-01-31T10:00:00Z',
      };
      
      const nextDate = calculateNextDueDate(task, false);
      
      expect(nextDate).toBeDefined();
      // Feb doesn't have 31 days
      expect(nextDate?.getMonth()).toBe(1); // February
      expect(nextDate?.getDate()).toBeLessThanOrEqual(29);
    });
  });
  
  describe('Yearly recurrence', () => {
    it('should calculate next year', () => {
      const task: Task = {
        ...baseTask,
        frequency: { type: 'yearly', interval: 1 },
        dueAt: '2024-01-15T10:00:00Z',
      };
      
      const nextDate = calculateNextDueDate(task, false);
      
      expect(nextDate).toBeDefined();
      expect(nextDate?.toISOString()).toContain('2025-01-15');
    });
  });
  
  describe('Next instance generation', () => {
    it('should create new task with updated due date', () => {
      const task: Task = {
        ...baseTask,
        frequency: { type: 'daily', interval: 1 },
        dueAt: '2024-01-15T10:00:00Z',
      };
      
      const nextTask = generateNextInstance(task, { recurrenceFromCompletion: false });
      
      expect(nextTask).toBeDefined();
      expect(nextTask?.dueAt).toContain('2024-01-16');
      expect(nextTask?.name).toBe(task.name);
    });
    
    it('should preserve series ID', () => {
      const task: Task = {
        ...baseTask,
        frequency: { type: 'daily', interval: 1 },
        seriesId: 'series-123',
        occurrenceIndex: 5,
      };
      
      const nextTask = generateNextInstance(task, {});
      
      expect(nextTask?.seriesId).toBe('series-123');
      expect(nextTask?.occurrenceIndex).toBe(6);
    });
    
    it('should calculate from completion date when whenDone is true', () => {
      const task: Task = {
        ...baseTask,
        frequency: { type: 'daily', interval: 1 },
        dueAt: '2024-01-15T10:00:00Z',
        doneAt: '2024-01-20T10:00:00Z', // Completed 5 days late
        whenDone: true,
      };
      
      const nextTask = generateNextInstance(task, { recurrenceFromCompletion: true });
      
      // Should be 1 day after completion date (2024-01-21), not due date
      expect(nextTask?.dueAt).toContain('2024-01-21');
    });
  });
  
  describe('End conditions', () => {
    it('should stop after max occurrences', () => {
      const task: Task = {
        ...baseTask,
        frequency: { 
          type: 'daily', 
          interval: 1,
          rrule: 'FREQ=DAILY;COUNT=10',
        },
        occurrenceIndex: 10,
      };
      
      const shouldStop = shouldStopRecurrence(task);
      
      expect(shouldStop).toBe(true);
    });
    
    it('should continue before max occurrences', () => {
      const task: Task = {
        ...baseTask,
        frequency: { 
          type: 'daily', 
          interval: 1,
          rrule: 'FREQ=DAILY;COUNT=10',
        },
        occurrenceIndex: 5,
      };
      
      const shouldStop = shouldStopRecurrence(task);
      
      expect(shouldStop).toBe(false);
    });
  });
  
  describe('Preview occurrences', () => {
    it('should preview next 5 occurrences', () => {
      const task: Task = {
        ...baseTask,
        frequency: { type: 'daily', interval: 1 },
        dueAt: '2024-01-15T10:00:00Z',
      };
      
      const previews = previewNextOccurrences(task, 5, false);
      
      expect(previews).toHaveLength(5);
      expect(previews[0]).toContain('2024-01-16');
      expect(previews[1]).toContain('2024-01-17');
      expect(previews[4]).toContain('2024-01-20');
    });
  });
});
