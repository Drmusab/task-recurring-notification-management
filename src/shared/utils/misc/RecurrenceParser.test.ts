/**
 * Tests for RecurrenceParser utility
 */

import { describe, test, expect } from 'vitest';
import { 
  parseRecurrenceRule, 
  isValidRecurrenceRule, 
  rruleToText 
} from "@shared/utils/misc/RecurrenceParser";

describe('RecurrenceParser', () => {
  describe('parseRecurrenceRule', () => {
    test('parses "every day"', () => {
      const result = parseRecurrenceRule('every day');
      expect(result.error).toBeUndefined();
      expect(result.rule).toContain('FREQ=DAILY');
      expect(result.mode).toBe('scheduled');
    });

    test('parses "every week"', () => {
      const result = parseRecurrenceRule('every week');
      expect(result.error).toBeUndefined();
      expect(result.rule).toContain('FREQ=WEEKLY');
      expect(result.mode).toBe('scheduled');
    });

    test('parses "every 2 weeks"', () => {
      const result = parseRecurrenceRule('every 2 weeks');
      expect(result.error).toBeUndefined();
      expect(result.rule).toContain('FREQ=WEEKLY');
      expect(result.rule).toContain('INTERVAL=2');
    });

    test('parses "every month"', () => {
      const result = parseRecurrenceRule('every month');
      expect(result.error).toBeUndefined();
      expect(result.rule).toContain('FREQ=MONTHLY');
    });

    test('parses "every year"', () => {
      const result = parseRecurrenceRule('every year');
      expect(result.error).toBeUndefined();
      expect(result.rule).toContain('FREQ=YEARLY');
    });

    test('parses "every weekday"', () => {
      const result = parseRecurrenceRule('every weekday');
      expect(result.error).toBeUndefined();
      expect(result.rule).toBeDefined();
    });

    test('parses "every week when done"', () => {
      const result = parseRecurrenceRule('every week when done');
      expect(result.error).toBeUndefined();
      expect(result.rule).toContain('FREQ=WEEKLY');
      expect(result.mode).toBe('done');
    });

    test('parses "every 3 days"', () => {
      const result = parseRecurrenceRule('every 3 days');
      expect(result.error).toBeUndefined();
      expect(result.rule).toContain('FREQ=DAILY');
      expect(result.rule).toContain('INTERVAL=3');
    });

    test('parses "every 2 months"', () => {
      const result = parseRecurrenceRule('every 2 months');
      expect(result.error).toBeUndefined();
      expect(result.rule).toContain('FREQ=MONTHLY');
      expect(result.rule).toContain('INTERVAL=2');
    });

    test('returns error for invalid pattern', () => {
      const result = parseRecurrenceRule('invalid pattern');
      expect(result.error).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('returns error for empty string', () => {
      const result = parseRecurrenceRule('');
      expect(result.error).toBe(true);
    });

    test('handles case insensitivity', () => {
      const result = parseRecurrenceRule('EVERY WEEK');
      expect(result.error).toBeUndefined();
      expect(result.rule).toContain('FREQ=WEEKLY');
    });

    test('handles extra whitespace', () => {
      const result = parseRecurrenceRule('  every   week  ');
      expect(result.error).toBeUndefined();
      expect(result.rule).toContain('FREQ=WEEKLY');
    });

    test('parses "every 5 days when done"', () => {
      const result = parseRecurrenceRule('every 5 days when done');
      expect(result.error).toBeUndefined();
      expect(result.rule).toContain('FREQ=DAILY');
      expect(result.rule).toContain('INTERVAL=5');
      expect(result.mode).toBe('done');
    });

    test('defaults to scheduled mode when not specified', () => {
      const result = parseRecurrenceRule('every day');
      expect(result.mode).toBe('scheduled');
    });
  });

  describe('isValidRecurrenceRule', () => {
    test('returns true for valid "every day"', () => {
      expect(isValidRecurrenceRule('every day')).toBe(true);
    });

    test('returns true for valid "every week"', () => {
      expect(isValidRecurrenceRule('every week')).toBe(true);
    });

    test('returns true for valid "every 2 months"', () => {
      expect(isValidRecurrenceRule('every 2 months')).toBe(true);
    });

    test('returns false for invalid pattern', () => {
      expect(isValidRecurrenceRule('invalid')).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(isValidRecurrenceRule('')).toBe(false);
    });

    test('returns true for "every weekday"', () => {
      expect(isValidRecurrenceRule('every weekday')).toBe(true);
    });
  });

  describe('rruleToText', () => {
    test('converts RRULE to text', () => {
      const text = rruleToText('FREQ=DAILY;INTERVAL=1');
      expect(text.toLowerCase()).toContain('day');
    });

    test('handles RRULE with prefix', () => {
      const text = rruleToText('RRULE:FREQ=WEEKLY;INTERVAL=1');
      expect(text.toLowerCase()).toContain('week');
    });

    test('returns original string for invalid RRULE', () => {
      const invalid = 'invalid rrule';
      const text = rruleToText(invalid);
      expect(text).toBe(invalid);
    });

    test('converts complex RRULE', () => {
      const text = rruleToText('FREQ=WEEKLY;INTERVAL=2');
      expect(text.toLowerCase()).toContain('week');
    });
  });
});
