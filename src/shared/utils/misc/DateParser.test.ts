/**
 * Tests for DateParser utility
 */

import { describe, test, expect } from 'vitest';
import { 
  parseNaturalLanguageDate, 
  isValidDate, 
  formatISO, 
  addDays 
} from "@shared/utils/misc/DateParser";

describe('DateParser', () => {
  describe('parseNaturalLanguageDate', () => {
    test('parses ISO date format', () => {
      const result = parseNaturalLanguageDate('2026-01-25');
      expect(result.error).toBeUndefined();
      expect(result.date).toBe('2026-01-25');
    });

    test('parses "today"', () => {
      const today = new Date();
      const isoToday = today.toISOString().split('T')[0];
      const result = parseNaturalLanguageDate('today');
      expect(result.error).toBeUndefined();
      expect(result.date).toBe(isoToday);
    });

    test('parses "tomorrow"', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isoTomorrow = tomorrow.toISOString().split('T')[0];
      const result = parseNaturalLanguageDate('tomorrow');
      expect(result.error).toBeUndefined();
      expect(result.date).toBe(isoTomorrow);
    });

    test('parses "yesterday"', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isoYesterday = yesterday.toISOString().split('T')[0];
      const result = parseNaturalLanguageDate('yesterday');
      expect(result.error).toBeUndefined();
      expect(result.date).toBe(isoYesterday);
    });

    test('parses "next week"', () => {
      const result = parseNaturalLanguageDate('next week');
      expect(result.error).toBeUndefined();
      expect(result.date).toBeDefined();
    });

    test('parses "next monday"', () => {
      const result = parseNaturalLanguageDate('next monday');
      expect(result.error).toBeUndefined();
      expect(result.date).toBeDefined();
    });

    test('returns error for invalid date', () => {
      const result = parseNaturalLanguageDate('notadate');
      expect(result.error).toBe(true);
      expect(result.message).toBeDefined();
    });

    test('returns error for empty string', () => {
      const result = parseNaturalLanguageDate('');
      expect(result.error).toBe(true);
    });

    test('returns error for malformed ISO date', () => {
      const result = parseNaturalLanguageDate('2026-13-99');
      expect(result.error).toBe(true);
    });

    test('handles whitespace correctly', () => {
      const result = parseNaturalLanguageDate('  today  ');
      expect(result.error).toBeUndefined();
      expect(result.date).toBeDefined();
    });

    test('uses reference date correctly', () => {
      const refDate = new Date('2026-06-15');
      const result = parseNaturalLanguageDate('today', refDate);
      expect(result.date).toBe('2026-06-15');
    });

    test('parses relative dates like "in 2 days"', () => {
      const result = parseNaturalLanguageDate('in 2 days');
      expect(result.error).toBeUndefined();
      expect(result.date).toBeDefined();
    });
  });

  describe('isValidDate', () => {
    test('returns true for valid ISO date', () => {
      expect(isValidDate('2026-01-25')).toBe(true);
    });

    test('returns true for "today"', () => {
      expect(isValidDate('today')).toBe(true);
    });

    test('returns true for "tomorrow"', () => {
      expect(isValidDate('tomorrow')).toBe(true);
    });

    test('returns false for invalid date', () => {
      expect(isValidDate('notadate')).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(isValidDate('')).toBe(false);
    });

    test('returns false for malformed ISO date', () => {
      expect(isValidDate('2026-99-99')).toBe(false);
    });
  });

  describe('formatISO', () => {
    test('formats date to ISO string', () => {
      const date = new Date('2026-01-25T15:30:00Z');
      const iso = formatISO(date);
      expect(iso).toBe('2026-01-25');
    });

    test('formats current date', () => {
      const date = new Date();
      const iso = formatISO(date);
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('addDays', () => {
    test('adds positive days', () => {
      const date = new Date('2026-01-25');
      const result = addDays(date, 5);
      expect(formatISO(result)).toBe('2026-01-30');
    });

    test('adds negative days', () => {
      const date = new Date('2026-01-25');
      const result = addDays(date, -5);
      expect(formatISO(result)).toBe('2026-01-20');
    });

    test('handles month boundary', () => {
      const date = new Date('2026-01-30');
      const result = addDays(date, 5);
      expect(formatISO(result)).toBe('2026-02-04');
    });

    test('does not modify original date', () => {
      const date = new Date('2026-01-25');
      const originalISO = formatISO(date);
      addDays(date, 5);
      expect(formatISO(date)).toBe(originalISO);
    });
  });
});
