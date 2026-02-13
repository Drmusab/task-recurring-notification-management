/**
 * Frequency - Legacy recurrence model (DEPRECATED)
 * 
 * This is the Phase 1-2 frequency-based recurrence system.
 * Being migrated to RRule-based recurrence (Recurrence interface).
 * 
 * @deprecated Use Recurrence interface with RRule instead
 */

export interface Frequency {
  /** Recurrence type */
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  
  /** Interval between recurrences (e.g., every 2 weeks) */
  interval: number;
  
  /** Days of week for weekly recurrence (0=Sunday, 6=Saturday) */
  daysOfWeek?: number[];
  
  /** Day of month for monthly recurrence (1-31) */
  dayOfMonth?: number;
  
  /** Month of year for yearly recurrence (1-12) */
  monthOfYear?: number;
  
  /** Optional RRule string (migration path to Phase 3) */
  rrule?: string;
}

/**
 * Validate a frequency object
 * @param frequency - Frequency to validate
 * @returns true if frequency is valid
 */
export function isValidFrequency(frequency: any): frequency is Frequency {
  if (!frequency || typeof frequency !== 'object') {
    return false;
  }
  
  const validTypes = ['daily', 'weekly', 'monthly', 'yearly'];
  if (!validTypes.includes(frequency.type)) {
    return false;
  }
  
  if (typeof frequency.interval !== 'number' || frequency.interval < 1) {
    return false;
  }
  
  // Validate days of week if present
  if (frequency.daysOfWeek !== undefined) {
    if (!Array.isArray(frequency.daysOfWeek)) {
      return false;
    }
    for (const day of frequency.daysOfWeek) {
      if (typeof day !== 'number' || day < 0 || day > 6) {
        return false;
      }
    }
  }
  
  // Validate day of month if present
  if (frequency.dayOfMonth !== undefined) {
    if (typeof frequency.dayOfMonth !== 'number' || 
        frequency.dayOfMonth < 1 || 
        frequency.dayOfMonth > 31) {
      return false;
    }
  }
  
  // Validate month of year if present
  if (frequency.monthOfYear !== undefined) {
    if (typeof frequency.monthOfYear !== 'number' || 
        frequency.monthOfYear < 1 || 
        frequency.monthOfYear > 12) {
      return false;
    }
  }
  
  return true;
}

/**
 * Convert legacy Frequency to RRule string
 * @param frequency - Legacy frequency object
 * @returns RRule string
 */
export function frequencyToRRule(frequency: Frequency): string {
  const parts: string[] = [];
  
  // Frequency type
  switch (frequency.type) {
    case 'daily':
      parts.push('FREQ=DAILY');
      break;
    case 'weekly':
      parts.push('FREQ=WEEKLY');
      break;
    case 'monthly':
      parts.push('FREQ=MONTHLY');
      break;
    case 'yearly':
      parts.push('FREQ=YEARLY');
      break;
  }
  
  // Interval
  if (frequency.interval > 1) {
    parts.push(`INTERVAL=${frequency.interval}`);
  }
  
  // Days of week (for weekly)
  if (frequency.daysOfWeek && frequency.daysOfWeek.length > 0) {
    const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const days = frequency.daysOfWeek.map(d => dayMap[d]).join(',');
    parts.push(`BYDAY=${days}`);
  }
  
  // Day of month (for monthly)
  if (frequency.dayOfMonth !== undefined) {
    parts.push(`BYMONTHDAY=${frequency.dayOfMonth}`);
  }
  
  // Month of year (for yearly)
  if (frequency.monthOfYear !== undefined) {
    parts.push(`BYMONTH=${frequency.monthOfYear}`);
  }
  
  return parts.join(';');
}
