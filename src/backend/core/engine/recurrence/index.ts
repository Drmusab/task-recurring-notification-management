/**
 * RRULE-based Recurrence Engine - Clean Exports
 * 
 * This is the single entry point for the RRULE recurrence system.
 * No other module should import 'rrule' directly - all recurrence
 * operations must go through this engine.
 * 
 * @module recurrence
 */

// Main engine (implements IRecurrenceEngine)
export { RecurrenceEngine } from './RecurrenceEngine';

// Supporting components
export { RRuleCache } from './RRuleCache';
export { RecurrenceValidator } from './RecurrenceValidator';
export { RecurrenceExplainer } from './RecurrenceExplainer';

// Utilities
export { extractRRuleOptions, generateCacheKey } from './utils';

// Types and interfaces
export type {
  IRecurrenceEngine,
  RecurrenceMode,
  MissPolicy,
  ValidationResult,
  RecurrenceExplanation,
  ExplanationStep,
  MissedOccurrencesResult,
  MissedOccurrenceOptions,
  CacheEntry,
  CacheStats
} from './recurrence.types';
