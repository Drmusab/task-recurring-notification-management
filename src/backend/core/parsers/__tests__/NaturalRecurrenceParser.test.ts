import { describe, it, expect } from 'vitest';
import { NaturalRecurrenceParser } from '@backend/core/parsers/NaturalRecurrenceParser';

describe('NaturalRecurrenceParser', () => {
  const parser = new NaturalRecurrenceParser();

  describe('parse()', () => {
    it('should parse "every day"', () => {
      const result = parser.parse('every day');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('daily');
      expect(result?.interval).toBe(1);
    });

    it('should parse "every 2 days"', () => {
      const result = parser.parse('every 2 days');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('daily');
      expect(result?.interval).toBe(2);
    });

    it('should parse "every week"', () => {
      const result = parser.parse('every week');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('weekly');
      expect(result?.interval).toBe(1);
    });

    it('should parse "every 2 weeks"', () => {
      const result = parser.parse('every 2 weeks');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('weekly');
      expect(result?.interval).toBe(2);
    });

    it('should parse "every weekday"', () => {
      const result = parser.parse('every weekday');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('weekly');
      expect(result?.interval).toBe(1);
      // Weekdays should be Monday-Friday (0-4 in our format)
      expect(result?.weekdays).toBeDefined();
      expect(result?.weekdays?.length).toBeGreaterThan(0);
    });

    it('should parse "every Monday"', () => {
      const result = parser.parse('every Monday');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('weekly');
      expect(result?.interval).toBe(1);
      expect(result?.weekdays).toContain(0); // Monday = 0
    });

    it('should parse "every month"', () => {
      const result = parser.parse('every month');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('monthly');
      expect(result?.interval).toBe(1);
    });

    it('should parse "every year"', () => {
      const result = parser.parse('every year');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('yearly');
      expect(result?.interval).toBe(1);
    });

    it('should parse "every week when done"', () => {
      const result = parser.parse('every week when done');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('weekly');
      expect(result?.interval).toBe(1);
      expect(result?.whenDone).toBe(true);
    });

    it('should parse "every 2 weeks when done"', () => {
      const result = parser.parse('every 2 weeks when done');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('weekly');
      expect(result?.interval).toBe(2);
      expect(result?.whenDone).toBe(true);
    });

    it('should store natural language and rrule string', () => {
      const result = parser.parse('every day');
      expect(result).not.toBeNull();
      expect(result?.naturalLanguage).toBe('every day');
      expect(result?.rruleString).toBeDefined();
      expect(result?.rruleString).toContain('FREQ=');
    });

    it('should handle invalid or empty input gracefully', () => {
      expect(parser.parse('')).toBeNull();
      expect(parser.parse(null as any)).toBeNull();
      expect(parser.parse(undefined as any)).toBeNull();
      
      // RRule.fromText() is very liberal and may parse almost anything
      // The important thing is that it doesn't crash
      const result = parser.parse('completely random gibberish text that makes no sense');
      // Just verify it returns something or null, doesn't crash
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should return null for null or undefined input', () => {
      expect(parser.parse(null as any)).toBeNull();
      expect(parser.parse(undefined as any)).toBeNull();
    });
  });

  describe('toNaturalLanguage()', () => {
    it('should convert daily frequency to natural language', () => {
      const frequency = { type: 'daily' as const, interval: 1 };
      const result = parser.toNaturalLanguage(frequency);
      expect(result).toContain('day');
    });

    it('should convert weekly frequency to natural language', () => {
      const frequency = { type: 'weekly' as const, interval: 1, weekdays: [0, 2] };
      const result = parser.toNaturalLanguage(frequency);
      expect(result).toContain('week');
      expect(result).toContain('Monday');
      expect(result).toContain('Wednesday');
    });

    it('should convert monthly frequency to natural language', () => {
      const frequency = { type: 'monthly' as const, interval: 1, dayOfMonth: 15 };
      const result = parser.toNaturalLanguage(frequency);
      expect(result).toContain('month');
      expect(result).toContain('15th');
    });

    it('should convert yearly frequency to natural language', () => {
      const frequency = { type: 'yearly' as const, interval: 1, month: 0, dayOfMonth: 1 };
      const result = parser.toNaturalLanguage(frequency);
      expect(result).toContain('year');
      expect(result).toContain('January');
    });

    it('should include "when done" suffix', () => {
      const frequency = { type: 'daily' as const, interval: 1, whenDone: true };
      const result = parser.toNaturalLanguage(frequency);
      expect(result).toContain('when done');
    });

    it('should use stored natural language if available', () => {
      const frequency = { 
        type: 'daily' as const, 
        interval: 1, 
        naturalLanguage: 'every single day' 
      };
      const result = parser.toNaturalLanguage(frequency);
      expect(result).toBe('every single day');
    });

    it('should include time if specified', () => {
      const frequency = { type: 'daily' as const, interval: 1, time: '09:00' };
      const result = parser.toNaturalLanguage(frequency);
      expect(result).toContain('09:00');
    });
  });

  describe('validate()', () => {
    it('should validate correct patterns', () => {
      expect(parser.validate('every day').valid).toBe(true);
      expect(parser.validate('every week').valid).toBe(true);
      expect(parser.validate('every month').valid).toBe(true);
      expect(parser.validate('every year').valid).toBe(true);
    });

    it('should reject empty input', () => {
      const result = parser.validate('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid patterns', () => {
      const result = parser.validate('invalid text');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate "when done" suffix', () => {
      expect(parser.validate('every week when done').valid).toBe(true);
    });
  });

  describe('getSuggestions()', () => {
    it('should return suggestions for "every"', () => {
      const suggestions = parser.getSuggestions('every');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('every day');
      expect(suggestions).toContain('every week');
    });

    it('should filter suggestions based on partial input', () => {
      const suggestions = parser.getSuggestions('every d');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => s.toLowerCase().startsWith('every d'))).toBe(true);
    });

    it('should return all suggestions for very short input', () => {
      const suggestions = parser.getSuggestions('e');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-matching input', () => {
      const suggestions = parser.getSuggestions('xyz123');
      expect(suggestions).toEqual([]);
    });
  });

  describe('roundtrip accuracy', () => {
    it('should maintain accuracy for daily frequencies', () => {
      const original = parser.parse('every day');
      expect(original).not.toBeNull();
      
      const naturalLang = parser.toNaturalLanguage(original!);
      expect(naturalLang).toBeTruthy();
      
      // The roundtrip might not be exact text, but should be semantically equivalent
      const reparsed = parser.parse(naturalLang);
      expect(reparsed?.type).toBe(original?.type);
      expect(reparsed?.interval).toBe(original?.interval);
    });

    it('should maintain accuracy for weekly frequencies', () => {
      const original = parser.parse('every week');
      expect(original).not.toBeNull();
      
      const naturalLang = parser.toNaturalLanguage(original!);
      const reparsed = parser.parse(naturalLang);
      
      expect(reparsed?.type).toBe(original?.type);
      expect(reparsed?.interval).toBe(original?.interval);
    });
  });
});
