import { describe, it, expect, beforeEach } from 'vitest';
import { RecurrenceEngineRRULE as RecurrenceEngine } from '../recurrence/RecurrenceEngineRRULE';
import type { Frequency } from '@backend/core/models/Frequency';

describe('RecurrenceEngine - Enhanced Features', () => {
  let engine: RecurrenceEngine;

  beforeEach(() => {
    engine = new RecurrenceEngine();
  });

  describe('whenDone recurrence', () => {
    it('should calculate next occurrence from completion date when whenDone is true', () => {
      const frequency: Frequency = { type: 'daily', interval: 1 };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      const completionDate = new Date('2025-01-22T15:00:00.000Z'); // 2 days late
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate,
        whenDone: true,
      });

      // Should be 1 day after completion date, not due date
      expect(nextDue.toISOString()).toBe('2025-01-23T15:00:00.000Z');
    });

    it('should calculate next occurrence from due date when whenDone is false', () => {
      const frequency: Frequency = { type: 'daily', interval: 1 };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      const completionDate = new Date('2025-01-22T15:00:00.000Z'); // 2 days late
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate,
        whenDone: false,
      });

      // Should be 1 day after due date
      expect(nextDue.toISOString()).toBe('2025-01-21T09:00:00.000Z');
    });

    it('should calculate next occurrence from due date when no options provided', () => {
      const frequency: Frequency = { type: 'daily', interval: 1 };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      
      const nextDue = engine.calculateNext(dueDate, frequency);

      expect(nextDue.toISOString()).toBe('2025-01-21T09:00:00.000Z');
    });

    it('should work with weekly frequency and whenDone', () => {
      const frequency: Frequency = { 
        type: 'weekly', 
        interval: 1,
        weekdays: [0] // Monday
      };
      const dueDate = new Date('2025-01-20T09:00:00.000Z'); // Monday
      const completionDate = new Date('2025-01-23T15:00:00.000Z'); // Thursday
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate,
        whenDone: true,
      });

      // Should be next Monday after completion date (Jan 27)
      expect(nextDue.getDay()).toBe(1); // Monday
      expect(nextDue.getDate()).toBe(27);
    });

    it('should work with monthly frequency and whenDone', () => {
      const frequency: Frequency = { 
        type: 'monthly', 
        interval: 1,
        dayOfMonth: 15
      };
      const dueDate = new Date('2025-01-15T09:00:00.000Z');
      const completionDate = new Date('2025-01-20T15:00:00.000Z'); // 5 days late
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate,
        whenDone: true,
      });

      // Should be Feb 15 (1 month from completion, but preserving day of month)
      expect(nextDue.getMonth()).toBe(1); // February
      expect(nextDue.getDate()).toBe(15); // Preserves the original day of month
    });

    it('should apply fixed time when specified with whenDone', () => {
      const frequency: Frequency = { 
        type: 'daily', 
        interval: 1,
        time: '09:00'
      };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      const completionDate = new Date('2025-01-20T15:30:00.000Z'); // Same day, late
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate,
        whenDone: true,
      });

      // Should be next day at 09:00
      expect(nextDue.toISOString()).toBe('2025-01-21T09:00:00.000Z');
    });
  });

  describe('backwards compatibility', () => {
    it('should work with old signature (no options)', () => {
      const frequency: Frequency = { type: 'daily', interval: 2 };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      
      const nextDue = engine.calculateNext(dueDate, frequency);

      expect(nextDue.toISOString()).toBe('2025-01-22T09:00:00.000Z');
    });

    it('should work with weekly pattern', () => {
      const frequency: Frequency = { 
        type: 'weekly', 
        interval: 1,
        weekdays: [0, 2, 4] // Monday, Wednesday, Friday
      };
      const dueDate = new Date('2025-01-20T09:00:00.000Z'); // Monday
      
      const nextDue = engine.calculateNext(dueDate, frequency);

      // Should be Wednesday (Jan 22)
      expect(nextDue.getDay()).toBe(3); // Wednesday in JS (0=Sunday)
      expect(nextDue.getDate()).toBe(22);
    });
  });

  describe('edge cases', () => {
    it('should handle completion on same day as due date', () => {
      const frequency: Frequency = { type: 'daily', interval: 1 };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      const completionDate = new Date('2025-01-20T10:00:00.000Z'); // 1 hour after due
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate,
        whenDone: true,
      });

      expect(nextDue.toISOString()).toBe('2025-01-21T10:00:00.000Z');
    });

    it('should handle completion before due date', () => {
      const frequency: Frequency = { type: 'daily', interval: 1 };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      const completionDate = new Date('2025-01-19T15:00:00.000Z'); // 1 day early
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate,
        whenDone: true,
      });

      expect(nextDue.toISOString()).toBe('2025-01-20T15:00:00.000Z');
    });

    it('should handle very late completion', () => {
      const frequency: Frequency = { type: 'weekly', interval: 1, weekdays: [0] };
      const dueDate = new Date('2025-01-20T09:00:00.000Z'); // Monday
      const completionDate = new Date('2025-02-15T15:00:00.000Z'); // Almost a month late
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate,
        whenDone: true,
      });

      // Should be next Monday after Feb 15 (Feb 17)
      expect(nextDue.getDay()).toBe(1); // Monday
      expect(nextDue.getDate()).toBe(17);
      expect(nextDue.getMonth()).toBe(1); // February
    });
  });

  describe('whenDone from Frequency object', () => {
    it('should use whenDone from Frequency object when no options provided', () => {
      const frequency: Frequency = { 
        type: 'daily', 
        interval: 1,
        whenDone: true
      };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      const completionDate = new Date('2025-01-22T15:00:00.000Z');
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate
      });

      // Should use completion date since whenDone is true in frequency
      expect(nextDue.toISOString()).toBe('2025-01-23T15:00:00.000Z');
    });

    it('should use whenDone=false from Frequency object', () => {
      const frequency: Frequency = { 
        type: 'daily', 
        interval: 1,
        whenDone: false
      };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      const completionDate = new Date('2025-01-22T15:00:00.000Z');
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate
      });

      // Should use due date since whenDone is false
      expect(nextDue.toISOString()).toBe('2025-01-21T09:00:00.000Z');
    });

    it('should allow options.whenDone to override Frequency.whenDone', () => {
      const frequency: Frequency = { 
        type: 'daily', 
        interval: 1,
        whenDone: false // Default in frequency
      };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      const completionDate = new Date('2025-01-22T15:00:00.000Z');
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate,
        whenDone: true // Override with options
      });

      // Should use completion date from options override
      expect(nextDue.toISOString()).toBe('2025-01-23T15:00:00.000Z');
    });

    it('should work with weekly frequency when whenDone in Frequency', () => {
      const frequency: Frequency = { 
        type: 'weekly', 
        interval: 1,
        weekdays: [1], // Tuesday
        whenDone: true
      };
      const dueDate = new Date('2025-01-21T09:00:00.000Z'); // Tuesday
      const completionDate = new Date('2025-01-24T15:00:00.000Z'); // Friday
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate
      });

      // Should be next Tuesday after Friday (Jan 28)
      expect(nextDue.getDay()).toBe(2); // Tuesday in JS (0=Sunday)
      expect(nextDue.getDate()).toBe(28);
    });

    it('should work with monthly frequency when whenDone in Frequency', () => {
      const frequency: Frequency = { 
        type: 'monthly', 
        interval: 1,
        dayOfMonth: 15,
        whenDone: true
      };
      const dueDate = new Date('2025-01-15T09:00:00.000Z');
      const completionDate = new Date('2025-01-25T15:00:00.000Z'); // 10 days late
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate
      });

      // Should be Feb 15 (preserving day of month, 1 month from completion base)
      expect(nextDue.getMonth()).toBe(1); // February
      expect(nextDue.getDate()).toBe(15);
    });

    it('should default to whenDone=false when not specified in Frequency or options', () => {
      const frequency: Frequency = { 
        type: 'daily', 
        interval: 1
        // No whenDone specified
      };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      const completionDate = new Date('2025-01-22T15:00:00.000Z');
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate
      });

      // Should use due date (default behavior)
      expect(nextDue.toISOString()).toBe('2025-01-21T09:00:00.000Z');
    });

    it('should apply fixed time when whenDone is in Frequency', () => {
      const frequency: Frequency = { 
        type: 'daily', 
        interval: 1,
        time: '09:00',
        whenDone: true
      };
      const dueDate = new Date('2025-01-20T09:00:00.000Z');
      const completionDate = new Date('2025-01-21T15:30:00.000Z');
      
      const nextDue = engine.calculateNext(dueDate, frequency, {
        completionDate
      });

      // Should be next day from completion at 09:00
      expect(nextDue.toISOString()).toBe('2025-01-22T09:00:00.000Z');
    });
  });
});
