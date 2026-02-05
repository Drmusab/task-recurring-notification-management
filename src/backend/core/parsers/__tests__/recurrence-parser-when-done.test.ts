import { describe, it, expect } from 'vitest';
import { RecurrenceParser } from "@backend/core/parsers/RecurrenceParser";

describe('RecurrenceParser - When Done Support', () => {
  describe('parsing "when done" suffix', () => {
    it('should parse "every day when done"', () => {
      const result = RecurrenceParser.parse('every day when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('daily');
      expect(result.frequency.interval).toBe(1);
      expect(result.frequency.whenDone).toBe(true);
    });

    it('should parse "every 3 days when done"', () => {
      const result = RecurrenceParser.parse('every 3 days when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('daily');
      expect(result.frequency.interval).toBe(3);
      expect(result.frequency.whenDone).toBe(true);
    });

    it('should parse "every week when done"', () => {
      const result = RecurrenceParser.parse('every week when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      expect(result.frequency.interval).toBe(1);
      expect(result.frequency.whenDone).toBe(true);
    });

    it('should parse "every week on Monday when done"', () => {
      const result = RecurrenceParser.parse('every week on Monday when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      expect(result.frequency.interval).toBe(1);
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toContain(0); // Monday
      }
      expect(result.frequency.whenDone).toBe(true);
    });

    it('should parse "every 2 weeks on Monday, Friday when done"', () => {
      const result = RecurrenceParser.parse('every 2 weeks on Monday, Friday when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      expect(result.frequency.interval).toBe(2);
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([0, 4]); // Monday, Friday
      }
      expect(result.frequency.whenDone).toBe(true);
    });

    it('should parse "every month when done"', () => {
      const result = RecurrenceParser.parse('every month when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('monthly');
      expect(result.frequency.interval).toBe(1);
      expect(result.frequency.whenDone).toBe(true);
    });

    it('should parse "every month on the 15th when done"', () => {
      const result = RecurrenceParser.parse('every month on the 15th when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('monthly');
      expect(result.frequency.interval).toBe(1);
      if (result.frequency.type === 'monthly') {
        expect(result.frequency.dayOfMonth).toBe(15);
      }
      expect(result.frequency.whenDone).toBe(true);
    });

    it('should parse "every 3 months on the 1st when done"', () => {
      const result = RecurrenceParser.parse('every 3 months on the 1st when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('monthly');
      expect(result.frequency.interval).toBe(3);
      if (result.frequency.type === 'monthly') {
        expect(result.frequency.dayOfMonth).toBe(1);
      }
      expect(result.frequency.whenDone).toBe(true);
    });

    it('should parse "every year when done"', () => {
      const result = RecurrenceParser.parse('every year when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('yearly');
      expect(result.frequency.interval).toBe(1);
      expect(result.frequency.whenDone).toBe(true);
    });

    it('should parse "every 2 years when done"', () => {
      const result = RecurrenceParser.parse('every 2 years when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('yearly');
      expect(result.frequency.interval).toBe(2);
      expect(result.frequency.whenDone).toBe(true);
    });

    it('should parse "every weekday when done"', () => {
      const result = RecurrenceParser.parse('every weekday when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([0, 1, 2, 3, 4]); // Mon-Fri
      }
      expect(result.frequency.whenDone).toBe(true);
    });

    it('should parse "every weekend when done"', () => {
      const result = RecurrenceParser.parse('every weekend when done');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([5, 6]); // Sat-Sun
      }
      expect(result.frequency.whenDone).toBe(true);
    });
  });

  describe('parsing "when due" suffix (explicit)', () => {
    it('should parse "every day when due"', () => {
      const result = RecurrenceParser.parse('every day when due');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('daily');
      expect(result.frequency.interval).toBe(1);
      expect(result.frequency.whenDone).toBe(false);
    });

    it('should parse "every week when due"', () => {
      const result = RecurrenceParser.parse('every week when due');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      expect(result.frequency.whenDone).toBe(false);
    });

    it('should parse "every month on the 10th when due"', () => {
      const result = RecurrenceParser.parse('every month on the 10th when due');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('monthly');
      if (result.frequency.type === 'monthly') {
        expect(result.frequency.dayOfMonth).toBe(10);
      }
      expect(result.frequency.whenDone).toBe(false);
    });
  });

  describe('default behavior (no suffix)', () => {
    it('should default to whenDone=undefined for "every day"', () => {
      const result = RecurrenceParser.parse('every day');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.whenDone).toBeUndefined();
    });

    it('should default to whenDone=undefined for "every 2 weeks"', () => {
      const result = RecurrenceParser.parse('every 2 weeks');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.whenDone).toBeUndefined();
    });

    it('should default to whenDone=undefined for "every month"', () => {
      const result = RecurrenceParser.parse('every month');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.whenDone).toBeUndefined();
    });
  });

  describe('stringify with whenDone', () => {
    it('should stringify daily frequency with whenDone', () => {
      const str = RecurrenceParser.stringify({ 
        type: 'daily', 
        interval: 1, 
        whenDone: true 
      });
      expect(str).toBe('every day when done');
    });

    it('should stringify daily frequency without whenDone', () => {
      const str = RecurrenceParser.stringify({ 
        type: 'daily', 
        interval: 1 
      });
      expect(str).toBe('every day');
    });

    it('should stringify weekly frequency with whenDone', () => {
      const str = RecurrenceParser.stringify({ 
        type: 'weekly', 
        interval: 1, 
        weekdays: [0, 4], 
        whenDone: true 
      });
      expect(str).toBe('every week on Monday, Friday when done');
    });

    it('should stringify monthly frequency with whenDone', () => {
      const str = RecurrenceParser.stringify({ 
        type: 'monthly', 
        interval: 1, 
        dayOfMonth: 15, 
        whenDone: true 
      });
      expect(str).toBe('every month on the 15th when done');
    });

    it('should stringify yearly frequency with whenDone', () => {
      const str = RecurrenceParser.stringify({ 
        type: 'yearly', 
        interval: 1, 
        month: 0, 
        dayOfMonth: 1, 
        whenDone: true 
      });
      expect(str).toBe('every year when done');
    });
  });
});
