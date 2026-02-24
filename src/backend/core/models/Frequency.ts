/**
 * Frequency - Legacy recurrence model (DEPRECATED)
 * 
 * RE-EXPORT FROM DOMAIN (Phase 2 refactoring - backward compatibility shim)
 * 
 * This file now re-exports from domain to maintain backward compatibility.
 * Original implementation moved to @domain/models/Frequency.ts for purity.
 * 
 * @deprecated Use Recurrence interface with RRule instead
 * @see domain/models/Frequency.ts for canonical implementation
 * 
 * **Migration Guide:**
 * 
 * 1. Replace Frequency with Recurrence type:
 * ```typescript
 * // Old:
 * import type { Frequency } from '@backend/core/models/Frequency';
 * const freq: Frequency = { type: 'daily', interval: 2 };
 * 
 * // New:
 * import type { Recurrence } from '@domain/models/Recurrence';
 * const rec: Recurrence = { 
 *   rrule: 'FREQ=DAILY;INTERVAL=2', 
 *   mode: 'fixed',
 *   referenceDate: new Date()
 * };
 * ```
 * 
 * 2. Use RecurrenceEngine for calculations:
 * ```typescript
 * // Old:
 * const next = engine.calculateNext(currentDue, frequency);
 * 
 * // New:
 * import { RecurrenceEngine } from '@backend/core/engine/recurrence';
 * const engine = new RecurrenceEngine();
 * const next = engine.next(task, ref);
 * ```
 * 
 * 3. Convert existing Frequency to RRULE:
 * ```typescript
 * import { frequencyToRRule } from '@domain/models/Frequency';
 * const rrule = frequencyToRRule(oldFrequency);
 * task.recurrence = { rrule, mode: 'fixed', referenceDate: task.createdAt };
 * delete task.frequency; // Remove deprecated field
 * ```
 * 
 * @see RecurrenceEngine for RRULE-based calculations
 * @see https://datatracker.ietf.org/doc/html/rfc5545 for RRULE specification
 */

export type {
  Frequency
} from '@domain/models/Frequency';

export {
  isValidFrequency,
  frequencyToRRule
} from '@domain/models/Frequency';
