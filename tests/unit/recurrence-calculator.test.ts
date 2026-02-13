import { describe, it, expect } from 'vitest';
import { RecurrenceCalculator } from '../../src/backend/recurrence/RecurrenceCalculator';
import { RecurrencePattern } from '../../src/backend/commands/types/CommandTypes';
import { WebhookError } from '../../src/backend/webhooks/types/Error';

describe('RecurrenceCalculator', () => {
  describe('Daily recurrence', () => {
    it('should calculate next day', () => {
      const pattern: RecurrencePattern = { type: 'daily' };
      const base = new Date('2026-01-24T09:00:00Z');

      const next = RecurrenceCalculator.calculateNext(pattern, base);

      expect(next).toEqual(new Date('2026-01-25T09:00:00Z'));
    });
  });

  describe('Interval recurrence', () => {
    it('should calculate next occurrence with days', () => {
      const pattern: RecurrencePattern = {
        type: 'interval',
        interval: 3,
        unit: 'days',
      };
      const base = new Date('2026-01-24T09:00:00Z');

      const next = RecurrenceCalculator.calculateNext(pattern, base);

      expect(next).toEqual(new Date('2026-01-27T09:00:00Z'));
    });

    it('should calculate next occurrence with hours', () => {
      const pattern: RecurrencePattern = {
        type: 'interval',
        interval: 6,
        unit: 'hours',
      };
      const base = new Date('2026-01-24T09:00:00Z');

      const next = RecurrenceCalculator.calculateNext(pattern, base);

      expect(next).toEqual(new Date('2026-01-24T15:00:00Z'));
    });

    it('should reject zero interval', () => {
      const pattern: RecurrencePattern = {
        type: 'interval',
        interval: 0,
        unit: 'days',
      };
      const base = new Date('2026-01-24T09:00:00Z');

      expect(() => RecurrenceCalculator.calculateNext(pattern, base)).toThrow(
        'Interval must be positive'
      );
    });
  });

  describe('Weekly recurrence', () => {
    it('should find next weekday in same week', () => {
      const pattern: RecurrencePattern = {
        type: 'weekly',
        daysOfWeek: ['friday'],
      };
      const base = new Date('2026-01-26T09:00:00Z'); // Monday

      const next = RecurrenceCalculator.calculateNext(pattern, base);

      expect(next?.getDay()).toBe(5); // Friday
      expect(next?.toISOString().startsWith('2026-01-30')).toBe(true);
    });

    it('should wrap to next week', () => {
      const pattern: RecurrencePattern = {
        type: 'weekly',
        daysOfWeek: ['monday'],
      };
      const base = new Date('2026-01-30T09:00:00Z'); // Friday

      const next = RecurrenceCalculator.calculateNext(pattern, base);

      expect(next?.getDay()).toBe(1); // Monday
      expect(next?.toISOString().startsWith('2026-02-02')).toBe(true);
    });
  });

  describe('Monthly recurrence', () => {
    it('should calculate next month same day', () => {
      const pattern: RecurrencePattern = {
        type: 'monthly',
        dayOfMonth: 15,
      };
      const base = new Date('2026-01-15T09:00:00Z');

      const next = RecurrenceCalculator.calculateNext(pattern, base);

      expect(next?.toISOString().startsWith('2026-02-15')).toBe(true);
    });

    it('should handle month-end overflow (Feb 31 -> Feb 28)', () => {
      const pattern: RecurrencePattern = {
        type: 'monthly',
        dayOfMonth: 31,
      };
      const base = new Date('2026-01-31T09:00:00Z');

      const next = RecurrenceCalculator.calculateNext(pattern, base);

      // Should skip to March 31 (Feb only has 28 days)
      expect(next?.toISOString().startsWith('2026-03-31')).toBe(true);
    });
  });

  describe('Forward progress validation', () => {
    it('should throw error if next date is not after base date', () => {
      // This is a pathological case that shouldn't happen,
      // but the calculator should detect it
      const pattern: RecurrencePattern = {
        type: 'interval',
        interval: -1, // Invalid negative interval
        unit: 'days',
      };
      const base = new Date('2026-01-24T09:00:00Z');

      expect(() => RecurrenceCalculator.calculateNext(pattern, base)).toThrow(
        'RECURRENCE_NO_PROGRESS'
      );
    });
  });

  describe('Iteration limit', () => {
    it.skip('should throw error after max iterations', () => {
      // NOTE: This test is flawed - the pattern WILL find March 31st before hitting limit
      // TODO: Fix test to use a truly impossible pattern
      const pattern: RecurrencePattern = {
        type: 'monthly',
        dayOfMonth: 31,
        startDate: '2026-02-01T00:00:00Z', // Feb has no 31st
        horizonDays: 365,
      };
      const base = new Date('2026-01-01T09:00:00Z');

      // This will iterate through months looking for day 31,
      // but with constraints that can't be satisfied
      expect(() => RecurrenceCalculator.calculateNext(pattern, base, 10)).toThrow(
        'RECURRENCE_ITERATION_LIMIT_EXCEEDED'
      );
    });
  });

  describe('Horizon enforcement', () => {
    it('should return null beyond horizon', () => {
      const pattern: RecurrencePattern = {
        type: 'daily',
        horizonDays: 7, // Only 7 days ahead
      };
      const base = new Date('2026-01-24T09:00:00Z');

      // Calculate 8 days ahead (beyond horizon)
      let current = base;
      for (let i = 0; i < 8; i++) {
        const next = RecurrenceCalculator.calculateNext(pattern, current);
        if (next === null) {
          expect(i).toBeGreaterThanOrEqual(7);
          return;
        }
        current = next;
      }
    });
  });
});
