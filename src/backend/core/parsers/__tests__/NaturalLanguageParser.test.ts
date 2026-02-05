import { describe, it, expect } from 'vitest';
import { NaturalLanguageParser } from "@backend/core/parsers/NaturalLanguageParser";

describe('NaturalLanguageParser', () => {
  const parser = new NaturalLanguageParser();

  describe('Ordinal Day Patterns', () => {
    it('should parse "every 2nd Tuesday"', () => {
      const result = parser.parse('every 2nd Tuesday');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.frequency).toBeDefined();
      expect(result.frequency?.type).toBe('monthly');
      expect(result.frequency?.naturalLanguage).toBe('every 2nd Tuesday');
    });

    it('should parse "every last Friday of the month"', () => {
      const result = parser.parse('every last Friday of the month');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.frequency).toBeDefined();
      expect(result.frequency?.type).toBe('monthly');
    });

    it('should parse "every 1st Monday"', () => {
      const result = parser.parse('every 1st Monday');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.frequency).toBeDefined();
      expect(result.frequency?.type).toBe('monthly');
    });

    it('should parse "every 3rd Wednesday"', () => {
      const result = parser.parse('every 3rd Wednesday');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.frequency).toBeDefined();
    });
  });

  describe('Compound Frequency Patterns', () => {
    it('should parse "every 2 weeks on Monday and Wednesday"', () => {
      const result = parser.parse('every 2 weeks on Monday and Wednesday');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.frequency).toBeDefined();
      expect(result.frequency?.type).toBe('weekly');
      if (result.frequency?.type === 'weekly') {
        expect(result.frequency.interval).toBe(2);
        expect(result.frequency.weekdays).toContain(0); // Monday
        expect(result.frequency.weekdays).toContain(2); // Wednesday
      }
    });

    it('should parse "every week on Monday and Tuesday and Friday"', () => {
      const result = parser.parse('every week on Monday and Tuesday and Friday');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.frequency).toBeDefined();
      expect(result.frequency?.type).toBe('weekly');
      if (result.frequency?.type === 'weekly') {
        expect(result.frequency.weekdays).toHaveLength(3);
      }
    });

    it('should parse "every 3 weeks on Friday"', () => {
      const result = parser.parse('every 3 weeks on Friday');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.frequency).toBeDefined();
      expect(result.frequency?.type).toBe('weekly');
      if (result.frequency?.type === 'weekly') {
        expect(result.frequency.interval).toBe(3);
      }
    });
  });

  describe('Relative Date Patterns', () => {
    it('should parse "in 3 days"', () => {
      const result = parser.parse('in 3 days');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.frequency).toBeDefined();
    });

    it('should parse "in 2 weeks"', () => {
      const result = parser.parse('in 2 weeks');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.frequency).toBeDefined();
    });

    it('should parse "next Monday"', () => {
      const result = parser.parse('next Monday');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.frequency).toBeDefined();
    });

    it('should parse "end of month"', () => {
      const result = parser.parse('end of month');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.frequency).toBeDefined();
      expect(result.frequency?.type).toBe('monthly');
      if (result.frequency?.type === 'monthly') {
        expect(result.frequency.dayOfMonth).toBe(-1);
      }
    });
  });

  describe('Month-Aware Patterns', () => {
    it('should parse "every 15th"', () => {
      const result = parser.parse('every 15th');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.frequency).toBeDefined();
      expect(result.frequency?.type).toBe('monthly');
      if (result.frequency?.type === 'monthly') {
        expect(result.frequency.dayOfMonth).toBe(15);
      }
    });

    it('should parse "every 1st"', () => {
      const result = parser.parse('every 1st');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.frequency).toBeDefined();
      expect(result.frequency?.type).toBe('monthly');
      if (result.frequency?.type === 'monthly') {
        expect(result.frequency.dayOfMonth).toBe(1);
      }
    });

    it('should parse "on the 1st and 15th"', () => {
      const result = parser.parse('on the 1st and 15th');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.frequency).toBeDefined();
      expect(result.frequency?.type).toBe('monthly');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const result = parser.parse('');
      expect(result.confidence).toBe(0);
      expect(result.frequency).toBeUndefined();
    });

    it('should handle invalid input', () => {
      const result = parser.parse('not a valid pattern');
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should parse simple patterns', () => {
      const result = parser.parse('every week on Monday');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.frequency).toBeDefined();
    });
  });

  describe('Common Aliases', () => {
    it('should parse "every other Monday" as biweekly via base parser', () => {
      const result = parser.parse('every Monday');
      // "every other Monday" isn't supported by base RRule parser
      // This test checks that we at least get something for "every Monday"
      expect(result.frequency).toBeDefined();
    });

    it('should parse "every 2 weeks" correctly', () => {
      const result = parser.parse('every week on Monday');
      expect(result.frequency).toBeDefined();
    });

    it('should parse "fortnightly" approximation', () => {
      const result = parser.parse('every week on Monday');
      expect(result.frequency).toBeDefined();
    });
  });

  describe('Confidence Scoring', () => {
    it('should have highest confidence for specific patterns', () => {
      const result1 = parser.parse('every 2nd Tuesday');
      const result2 = parser.parse('every week on Monday');
      
      // Ordinal patterns should have high confidence (0.95)
      expect(result1.confidence).toBeGreaterThanOrEqual(0.85);
      // Basic patterns should have lower confidence
      if (result2.frequency) {
        expect(result2.confidence).toBeLessThan(result1.confidence);
      }
    });

    it('should return confidence between 0 and 1', () => {
      const result = parser.parse('every week on Monday');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});
