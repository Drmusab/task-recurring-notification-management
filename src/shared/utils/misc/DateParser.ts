/**
 * Date parsing utilities for inline task parser
 * This is a lightweight wrapper around the existing DateParser for Phase 1 requirements
 */

import { DateParser as CoreDateParser } from '@backend/core/parsers/DateParser';

export interface DateParseResult {
  date?: string; // ISO format (YYYY-MM-DD)
  error?: boolean;
  message?: string;
}

/**
 * Parse natural language date input to ISO date string
 * 
 * Supports:
 * - ISO dates: YYYY-MM-DD
 * - Natural language: today, tomorrow, yesterday, next week, next monday, etc.
 * - Relative dates: in 2 days, in 3 weeks
 * 
 * @param input - Date string to parse
 * @param referenceDate - Reference date for relative parsing (defaults to now)
 * @returns DateParseResult with ISO date string or error
 * 
 * @example
 * parseNaturalLanguageDate("tomorrow") // { date: "2026-01-24" }
 * parseNaturalLanguageDate("2026-01-25") // { date: "2026-01-25" }
 * parseNaturalLanguageDate("invalid") // { error: true, message: "..." }
 */
export function parseNaturalLanguageDate(
  input: string, 
  referenceDate: Date = new Date()
): DateParseResult {
  if (!input || typeof input !== 'string') {
    return { error: true, message: 'Empty or invalid date input' };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { error: true, message: 'Empty date string' };
  }

  // Use the existing CoreDateParser
  const result = CoreDateParser.parse(trimmed, referenceDate);
  
  if (result.isValid && result.date) {
    // Convert to ISO date string (YYYY-MM-DD)
    const isoDate = CoreDateParser.toISODateString(result.date);
    return { date: isoDate };
  }

  return { 
    error: true, 
    message: result.error || `Could not parse date: ${input}` 
  };
}

/**
 * Validate if a string is a valid date
 * 
 * @param input - Date string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDate(input: string): boolean {
  const result = parseNaturalLanguageDate(input);
  return !result.error && !!result.date;
}

/**
 * Format a Date object to ISO date string (YYYY-MM-DD)
 * 
 * @param date - Date to format
 * @returns ISO date string
 */
export function formatISO(date: Date): string {
  return CoreDateParser.toISODateString(date);
}

/**
 * Add days to a date
 * 
 * @param date - Starting date
 * @param days - Number of days to add (can be negative)
 * @returns New date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
