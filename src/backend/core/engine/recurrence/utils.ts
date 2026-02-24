/**
 * Shared utilities for RRULE parsing
 */

import { RRule, rrulestr, RRuleSet } from 'rrule';

/**
 * Parse an RRULE string and extract options
 * Shared utility to avoid code duplication across validator, cache, etc.
 * 
 * @param rruleString - RRULE string (with or without "RRULE:" prefix)
 * @returns Extracted RRule options
 * @throws Error if parsing fails
 */
export function extractRRuleOptions(rruleString: string): any {
  // Normalize RRULE string
  const normalized = rruleString.startsWith('RRULE:') 
    ? rruleString 
    : `RRULE:${rruleString}`;
  
  // Parse the RRULE
  const parsed = rrulestr(normalized);
  
  // Extract options based on parsed type
  if (parsed instanceof RRule) {
    return { ...parsed.origOptions };
  } else if (parsed instanceof RRuleSet) {
    const rrules = parsed.rrules();
    if (rrules && rrules.length > 0) {
      return { ...rrules[0].origOptions };
    } else {
      throw new Error('RRuleSet has no rrules');
    }
  } else {
    throw new Error('Unexpected parsed rule type');
  }
}

/**
 * Generate a cache key for a task's RRULE
 * Uses a hash-like approach to avoid collisions
 * 
 * @param taskId - Task identifier
 * @param rruleString - RRULE string
 * @returns Cache key
 */
export function generateCacheKey(taskId: string, rruleString: string): string {
  // Use a separator that's unlikely to appear in task IDs or RRULEs
  // and encode the components to avoid collisions
  const encoded = `${encodeURIComponent(taskId)}::${encodeURIComponent(rruleString)}`;
  return encoded;
}
