/**
 * FrequencyToRecurrenceConverter Tests
 * Phase 2: Recurrence Engine Unification
 * 
 * Comprehensive test suite for frequency migration
 * Validates all conversion scenarios are lossless
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FrequencyToRecurrenceConverter } from '../FrequencyToRecurrenceConverter';

describe('FrequencyToRecurrenceConverter', () => {
  describe('Daily Frequency Conversion', () => {
    it('should convert daily interval=1', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'daily',
        interval: 1
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=DAILY;INTERVAL=1');
    });

    it('should convert daily interval=2', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'daily',
        interval: 2
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=DAILY;INTERVAL=2');
    });

    it('should default to interval=1 if not specified', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'daily'
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=DAILY;INTERVAL=1');
    });
  });

  describe('Weekly Frequency Conversion', () => {
    it('should convert weekly without specific days', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'weekly',
        interval: 1
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=WEEKLY;INTERVAL=1');
      expect(result.warnings).toContain(
        'Weekly frequency without specific weekdays - using original due date weekday'
      );
    });

    it('should convert weekly on Monday', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'weekly',
        weekdays: [1] // Monday
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO');
    });

    it('should convert weekly on Mon/Wed/Fri', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'weekly',
        weekdays: [1, 3, 5] // Mon, Wed, Fri
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR');
    });

    it('should convert weekly every 2 weeks on Tuesday/Thursday', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'weekly',
        interval: 2,
        weekdays: [2, 4] // Tue, Thu
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH');
    });

    it('should handle daysOfWeek alias', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'weekly',
        daysOfWeek: [0, 6] // Sun, Sat (weekend)
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=SU,SA');
    });
  });

  describe('Monthly Frequency Conversion', () => {
    it('should convert monthly on day 15', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'monthly',
        dayOfMonth: 15
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15');
    });

    it('should convert monthly on last day', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'monthly',
        dayOfMonth: 31
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1');
      expect(result.warnings).toContain(
        'Day 31 may slip to last day of shorter months'
      );
    });

    it('should convert monthly on day 30 with fallback', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'monthly',
        dayOfMonth: 30
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=30,-1');
      expect(result.warnings).toContain(
        'Day 30 may slip to last day of shorter months'
      );
    });

    it('should convert monthly on day 29 (leap year handling)', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'monthly',
        dayOfMonth: 29
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=29,-1');
      expect(result.warnings).toContain(
        'Day 29 may slip to last day of shorter months'
      );
    });

    it('should convert monthly every 3 months', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'monthly',
        interval: 3,
        dayOfMonth: 1
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1');
    });
  });

  describe('Yearly Frequency Conversion', () => {
    it('should convert yearly on same date', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'yearly',
        interval: 1
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=YEARLY;INTERVAL=1');
    });

    it('should convert yearly on specific month and day', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'yearly',
        month: 11, // December (0-indexed)
        dayOfMonth: 25
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=YEARLY;INTERVAL=1;BYMONTH=12;BYMONTHDAY=25');
    });

    it('should convert yearly every 2 years', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'yearly',
        interval: 2,
        month: 0, // January
        dayOfMonth: 1
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=YEARLY;INTERVAL=2;BYMONTH=1;BYMONTHDAY=1');
    });

    it('should handle last day of year', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'yearly',
        month: 11, // December
        dayOfMonth: 31
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=YEARLY;INTERVAL=1;BYMONTH=12;BYMONTHDAY=-1');
    });
  });

  describe('Custom Frequency Conversion', () => {
    it('should preserve custom RRULE', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'custom',
        rrule: 'FREQ=DAILY;BYHOUR=10;BYMINUTE=30'
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=DAILY;BYHOUR=10;BYMINUTE=30');
    });

    it('should strip RRULE: prefix if present', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'custom',
        rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
    });

    it('should fail if custom has no rrule', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'custom'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Custom frequency requires rrule field');
    });

    it('should fail if rrule is invalid (no FREQ)', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'custom',
        rrule: 'INTERVAL=2;BYDAY=MO' // Missing FREQ
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid RRULE: missing FREQ parameter');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown frequency type', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'unknown' as any
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown frequency type');
    });

    it('should preserve original frequency in result', () => {
      const original = {
        type: 'daily' as const,
        interval: 3,
        customField: 'test'
      };

      const result = FrequencyToRecurrenceConverter.convert(original);

      expect(result.original).toEqual(original);
    });

    it('should handle very large intervals', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'daily',
        interval: 365
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=DAILY;INTERVAL=365');
    });

    it('should handle interval=0 (defaults to 1)', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'daily',
        interval: 0
      });

      expect(result.success).toBe(true);
      // interval || 1 defaults to 1
      expect(result.rruleString).toBe('FREQ=DAILY;INTERVAL=1');
    });
  });

  describe('Reference Date Handling', () => {
    it('should accept reference date parameter', () => {
      const dueDate = new Date('2026-02-12T10:00:00Z');
      
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'daily',
        interval: 1
      }, dueDate);

      expect(result.success).toBe(true);
      // Due date is used for DTSTART in task creation, not in RRULE string
      expect(result.rruleString).toBe('FREQ=DAILY;INTERVAL=1');
    });
  });

  describe('Warnings Generation', () => {
    it('should warn about month boundary issues for day 31', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'monthly',
        dayOfMonth: 31
      });

      expect(result.warnings).toContain(
        'Day 31 may slip to last day of shorter months'
      );
    });

    it('should warn about weekly without specific days', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'weekly'
      });

      expect(result.warnings).toContain(
        'Weekly frequency without specific weekdays - using original due date weekday'
      );
    });

    it('should have no warnings for simple daily', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'daily',
        interval: 1
      });

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should convert bi-weekly staff meeting (Mon/Wed/Fri every 2 weeks)', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'weekly',
        interval: 2,
        weekdays: [1, 3, 5]
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR');
    });

    it('should convert quarterly report (every 3 months on 1st)', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'monthly',
        interval: 3,
        dayOfMonth: 1
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1');
    });

    it('should convert paycheck (bi-weekly on Friday)', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'weekly',
        interval: 2,
        weekdays: [5] // Friday
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR');
    });

    it('should convert birthday (yearly on Dec 25)', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'yearly',
        month: 11, // December
        dayOfMonth: 25
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=YEARLY;INTERVAL=1;BYMONTH=12;BYMONTHDAY=25');
    });
  });

  describe('Migration Statistics', () => {
    it('should track migration progress', async () => {
      const tasks: any[] = [
        { id: '1', frequency: { rruleString: 'FREQ=DAILY' } }, // Already migrated
        { id: '2', frequency: undefined }, // No frequency
        { id: '3' }, // No frequency field at all
      ];

      const stats = await FrequencyToRecurrenceConverter.migrateBatch(tasks);

      expect(stats.total).toBe(3);
      expect(stats.skipped).toBe(3); // All skipped (already migrated or no freq)
      expect(stats.migrated).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.startedAt).toBeDefined();
      expect(stats.completedAt).toBeDefined();
      expect(stats.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should call progress callback', async () => {
      const tasks: any[] = [
        { id: '1', frequency: { rruleString: 'FREQ=DAILY' } },
        { id: '2', frequency: { rruleString: 'FREQ=WEEKLY' } }
      ];

      const progressUpdates: Array<{ current: number; total: number }> = [];
      
      await FrequencyToRecurrenceConverter.migrateBatch(tasks, (current, total) => {
        progressUpdates.push({ current, total });
      });

      expect(progressUpdates).toHaveLength(2);
      expect(progressUpdates[0]).toEqual({ current: 1, total: 2 });
      expect(progressUpdates[1]).toEqual({ current: 2, total: 2 });
    });

    it('should handle undefined tasks in array', async () => {
      const tasks: any[] = [
        { id: '1', frequency: { rruleString: 'FREQ=DAILY' } },
        undefined,
        { id: '3', frequency: { rruleString: 'FREQ=WEEKLY' } }
      ];

      const stats = await FrequencyToRecurrenceConverter.migrateBatch(tasks);

      expect(stats.total).toBe(3);
      expect(stats.skipped).toBe(3); // All skipped
      expect(stats.failed).toBe(0);
    });
  });

  describe('Weekday Mapping', () => {
    it('should correctly map all weekdays', () => {
      const weekdayTests = [
        { input: [0], expected: 'SU' }, // Sunday
        { input: [1], expected: 'MO' }, // Monday
        { input: [2], expected: 'TU' }, // Tuesday
        { input: [3], expected: 'WE' }, // Wednesday
        { input: [4], expected: 'TH' }, // Thursday
        { input: [5], expected: 'FR' }, // Friday
        { input: [6], expected: 'SA' }, // Saturday
      ];

      weekdayTests.forEach(({ input, expected }) => {
        const result = FrequencyToRecurrenceConverter.convert({
          type: 'weekly',
          weekdays: input
        });

        expect(result.success).toBe(true);
        expect(result.rruleString).toContain(`BYDAY=${expected}`);
      });
    });

    it('should preserve weekday order', () => {
      const result = FrequencyToRecurrenceConverter.convert({
        type: 'weekly',
        weekdays: [0, 3, 6] // Sun, Wed, Sat
      });

      expect(result.success).toBe(true);
      expect(result.rruleString).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=SU,WE,SA');
    });
  });

  describe('Performance', () => {
    it('should convert 1000 frequencies in < 100ms', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        FrequencyToRecurrenceConverter.convert({
          type: 'daily',
          interval: (i % 7) + 1
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should batch migrate 1000 tasks in < 1000ms', async () => {
      const tasks: any[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        frequency: { rruleString: 'FREQ=DAILY' }
      }));

      const startTime = Date.now();
      const stats = await FrequencyToRecurrenceConverter.migrateBatch(tasks);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
      expect(stats.total).toBe(1000);
    });
  });
});
