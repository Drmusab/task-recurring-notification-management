import { describe, it, expect } from 'vitest';
import { RecurrenceParser } from "@backend/core/parsers/RecurrenceParser";

describe('RecurrenceParser - Weekday Patterns', () => {
  describe('weekday pattern', () => {
    it('should parse "every weekday" to Monday-Friday', () => {
      const result = RecurrenceParser.parse('every weekday');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      expect(result.frequency.interval).toBe(1);
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([0, 1, 2, 3, 4]); // Mon-Fri
      }
    });

    it('should parse "every weekdays" to Monday-Friday', () => {
      const result = RecurrenceParser.parse('every weekdays');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([0, 1, 2, 3, 4]);
      }
    });
  });

  describe('weekend pattern', () => {
    it('should parse "every weekend" to Saturday-Sunday', () => {
      const result = RecurrenceParser.parse('every weekend');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      expect(result.frequency.interval).toBe(1);
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([5, 6]); // Sat-Sun
      }
    });

    it('should parse "every weekends" to Saturday-Sunday', () => {
      const result = RecurrenceParser.parse('every weekends');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([5, 6]);
      }
    });
  });

  describe('specific day names', () => {
    it('should parse "every week on Monday"', () => {
      const result = RecurrenceParser.parse('every week on Monday');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([0]); // Monday
      }
    });

    it('should parse "every week on Monday, Wednesday, Friday"', () => {
      const result = RecurrenceParser.parse('every week on Monday, Wednesday, Friday');
      
      expect(result.isValid).toBe(true);
      expect(result.frequency.type).toBe('weekly');
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([0, 2, 4]); // Mon, Wed, Fri
      }
    });

    it('should parse abbreviated day names', () => {
      const result = RecurrenceParser.parse('every week on Mon, Wed, Fri');
      
      expect(result.isValid).toBe(true);
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([0, 2, 4]);
      }
    });

    it('should parse mixed case day names', () => {
      const result = RecurrenceParser.parse('every week on MONDAY, wednesday, FRI');
      
      expect(result.isValid).toBe(true);
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([0, 2, 4]);
      }
    });
  });

  describe('stringify weekday patterns', () => {
    it('should stringify weekday pattern', () => {
      const frequency = {
        type: 'weekly' as const,
        interval: 1,
        weekdays: [0, 1, 2, 3, 4], // Mon-Fri
      };
      
      const result = RecurrenceParser.stringify(frequency);
      
      expect(result).toBe('every week on Monday, Tuesday, Wednesday, Thursday, Friday');
    });

    it('should stringify weekend pattern', () => {
      const frequency = {
        type: 'weekly' as const,
        interval: 1,
        weekdays: [5, 6], // Sat-Sun
      };
      
      const result = RecurrenceParser.stringify(frequency);
      
      expect(result).toBe('every week on Saturday, Sunday');
    });

    it('should stringify specific days', () => {
      const frequency = {
        type: 'weekly' as const,
        interval: 1,
        weekdays: [0, 2, 4], // Mon, Wed, Fri
      };
      
      const result = RecurrenceParser.stringify(frequency);
      
      expect(result).toBe('every week on Monday, Wednesday, Friday');
    });
  });

  describe('edge cases', () => {
    it('should handle weekend with capital letters', () => {
      const result = RecurrenceParser.parse('every WEEKEND');
      
      expect(result.isValid).toBe(true);
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([5, 6]);
      }
    });

    it('should handle weekday with extra spaces', () => {
      const result = RecurrenceParser.parse('every  weekday');
      
      expect(result.isValid).toBe(true);
      if (result.frequency.type === 'weekly') {
        expect(result.frequency.weekdays).toEqual([0, 1, 2, 3, 4]);
      }
    });
  });
});
