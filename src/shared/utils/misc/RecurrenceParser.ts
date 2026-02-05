/**
 * Recurrence text to RRULE converter for inline task parser
 * This is a wrapper around the existing RecurrenceParser for Phase 1 requirements
 */

import { RecurrenceParser as CoreRecurrenceParser } from '@backend/core/parsers/RecurrenceParser';
import { RRule } from 'rrule';

export interface RecurrenceParseResult {
  rule?: string; // RRULE string
  mode?: 'scheduled' | 'done';
  error?: boolean;
  message?: string;
}

/**
 * Parse human-readable recurrence text to RRULE string
 * 
 * Supported patterns:
 * - every day
 * - every week
 * - every 2 weeks
 * - every month
 * - every year
 * - every weekday
 * - every week when done
 * - monthly on the 15th
 * 
 * @param text - Human-readable recurrence text
 * @returns RecurrenceParseResult with RRULE string and mode
 * 
 * @example
 * parseRecurrenceRule("every week") // { rule: "FREQ=WEEKLY;INTERVAL=1", mode: "scheduled" }
 * parseRecurrenceRule("every week when done") // { rule: "FREQ=WEEKLY;INTERVAL=1", mode: "done" }
 * parseRecurrenceRule("invalid") // { error: true, message: "..." }
 */
export function parseRecurrenceRule(text: string): RecurrenceParseResult {
  if (!text || typeof text !== 'string') {
    return { error: true, message: 'Empty or invalid recurrence text' };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { error: true, message: 'Empty recurrence string' };
  }

  // Determine mode (scheduled vs done)
  let mode: 'scheduled' | 'done' = 'scheduled';
  let cleanText = trimmed.toLowerCase();
  
  if (cleanText.includes('when done')) {
    mode = 'done';
    cleanText = cleanText.replace(/\s*when\s+done\s*$/i, '').trim();
  } else if (cleanText.includes('when scheduled')) {
    mode = 'scheduled';
    cleanText = cleanText.replace(/\s*when\s+scheduled\s*$/i, '').trim();
  }

  // Use the existing CoreRecurrenceParser
  const result = CoreRecurrenceParser.parse(cleanText);
  
  if (!result.isValid) {
    return {
      error: true,
      message: result.error || `Could not parse recurrence: ${text}`
    };
  }

  if (!result.frequency.rruleString) {
    return {
      error: true,
      message: 'Failed to generate RRULE string'
    };
  }

  // Extract the RRULE string (remove "RRULE:" prefix if present)
  let rruleString = result.frequency.rruleString;
  if (rruleString.startsWith('RRULE:')) {
    rruleString = rruleString.substring(6);
  }

  return {
    rule: rruleString,
    mode
  };
}

/**
 * Validate a recurrence rule text
 * 
 * @param text - Recurrence text to validate
 * @returns true if valid, false otherwise
 */
export function isValidRecurrenceRule(text: string): boolean {
  const result = parseRecurrenceRule(text);
  return !result.error && !!result.rule;
}

/**
 * Convert RRULE string back to human-readable text
 * 
 * @param rrule - RRULE string
 * @returns Human-readable text
 */
export function rruleToText(rrule: string): string {
  try {
    const normalized = rrule.startsWith('RRULE:') ? rrule : `RRULE:${rrule}`;
    const rule = RRule.fromString(normalized);
    return rule.toText();
  } catch (error) {
    return rrule;
  }
}
