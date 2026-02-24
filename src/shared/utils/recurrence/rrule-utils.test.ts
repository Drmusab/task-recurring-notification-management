/**
 * Unit tests for RRULE utility functions
 * 
 * Tests parsing and building of iCalendar RRULE strings.
 */

import { describe, it, expect } from 'vitest';
import {
  parseRRule,
  buildRRule,
  validateRRule,
  createEmptyRRule,
  ALL_WEEKDAYS,
  ALL_FREQUENCIES,
  WEEKDAY_LABELS,
  type RRuleData,
  type RRuleFrequency,
  type RRuleWeekDay
} from './rrule-utils';

describe('parseRRule', () => {
  it('should parse empty string to default rule', () => {
    const result = parseRRule('');
    expect(result.frequency).toBeNull();
    expect(result.interval).toBe(1);
  });

  it('should parse simple DAILY rule', () => {
    const result = parseRRule('FREQ=DAILY');
    expect(result.frequency).toBe('DAILY');
    expect(result.interval).toBe(1);
  });

  it('should parse DAILY with interval', () => {
    const result = parseRRule('FREQ=DAILY;INTERVAL=3');
    expect(result.frequency).toBe('DAILY');
    expect(result.interval).toBe(3);
  });

  it('should parse WEEKLY with days', () => {
    const result = parseRRule('FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR');
    expect(result.frequency).toBe('WEEKLY');
    expect(result.interval).toBe(1);
    expect(result.byDay).toEqual(['MO', 'WE', 'FR']);
  });

  it('should parse MONTHLY with monthday', () => {
    const result = parseRRule('FREQ=MONTHLY;BYMONTHDAY=15');
    expect(result.frequency).toBe('MONTHLY');
    expect(result.byMonthDay).toBe(15);
  });

  it('should parse YEARLY with count', () => {
    const result = parseRRule('FREQ=YEARLY;COUNT=5');
    expect(result.frequency).toBe('YEARLY');
    expect(result.count).toBe(5);
  });

  it('should parse rule with until date', () => {
    const result = parseRRule('FREQ=DAILY;UNTIL=20261231');
    expect(result.frequency).toBe('DAILY');
    expect(result.until).toBe('20261231');
  });

  it('should parse complex rule with multiple components', () => {
    const result = parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,WE,TH,FR;COUNT=10');
    expect(result.frequency).toBe('WEEKLY');
    expect(result.interval).toBe(2);
    expect(result.byDay).toEqual(['MO', 'TU', 'WE', 'TH', 'FR']);
    expect(result.count).toBe(10);
  });

  it('should ignore invalid parts', () => {
    const result = parseRRule('FREQ=DAILY;INVALID=value;INTERVAL=2');
    expect(result.frequency).toBe('DAILY');
    expect(result.interval).toBe(2);
  });

  it('should handle malformed parts gracefully', () => {
    const result = parseRRule('FREQ=DAILY;;INTERVAL=');
    expect(result.frequency).toBe('DAILY');
    expect(result.interval).toBe(1); // Default interval
  });
});

describe('buildRRule', () => {
  it('should return empty string for null frequency', () => {
    const rule: RRuleData = { frequency: null, interval: 1 };
    expect(buildRRule(rule)).toBe('');
  });

  it('should build simple DAILY rule', () => {
    const rule: RRuleData = { frequency: 'DAILY', interval: 1 };
    expect(buildRRule(rule)).toBe('FREQ=DAILY');
  });

  it('should build DAILY with interval > 1', () => {
    const rule: RRuleData = { frequency: 'DAILY', interval: 3 };
    expect(buildRRule(rule)).toBe('FREQ=DAILY;INTERVAL=3');
  });

  it('should omit interval=1 (default value)', () => {
    const rule: RRuleData = { frequency: 'WEEKLY', interval: 1 };
    expect(buildRRule(rule)).toBe('FREQ=WEEKLY');
  });

  it('should build WEEKLY with days', () => {
    const rule: RRuleData = {
      frequency: 'WEEKLY',
      interval: 1,
      byDay: ['MO', 'WE', 'FR']
    };
    expect(buildRRule(rule)).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
  });

  it('should build MONTHLY with monthday', () => {
    const rule: RRuleData = {
      frequency: 'MONTHLY',
      interval: 1,
      byMonthDay: 15
    };
    expect(buildRRule(rule)).toBe('FREQ=MONTHLY;BYMONTHDAY=15');
  });

  it('should build rule with count', () => {
    const rule: RRuleData = {
      frequency: 'YEARLY',
      interval: 1,
      count: 5
    };
    expect(buildRRule(rule)).toBe('FREQ=YEARLY;COUNT=5');
  });

  it('should build rule with until', () => {
    const rule: RRuleData = {
      frequency: 'DAILY',
      interval: 1,
      until: '20261231'
    };
    expect(buildRRule(rule)).toBe('FREQ=DAILY;UNTIL=20261231');
  });

  it('should build complex rule with all components', () => {
    const rule: RRuleData = {
      frequency: 'WEEKLY',
      interval: 2,
      byDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
      count: 10
    };
    expect(buildRRule(rule)).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,WE,TH,FR;COUNT=10');
  });

  it('should ignore empty byDay array', () => {
    const rule: RRuleData = {
      frequency: 'WEEKLY',
      interval: 1,
      byDay: []
    };
    expect(buildRRule(rule)).toBe('FREQ=WEEKLY');
  });
});

describe('parseRRule and buildRRule roundtrip', () => {
  const testCases = [
    'FREQ=DAILY',
    'FREQ=DAILY;INTERVAL=2',
    'FREQ=WEEKLY;BYDAY=MO,FR',
    'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,WE,TH,FR',
    'FREQ=MONTHLY;BYMONTHDAY=15',
    'FREQ=YEARLY;COUNT=5',
    'FREQ=DAILY;UNTIL=20261231',
    'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=10'
  ];

  testCases.forEach((rrule) => {
    it(`should roundtrip: ${rrule}`, () => {
      const parsed = parseRRule(rrule);
      const rebuilt = buildRRule(parsed);
      expect(rebuilt).toBe(rrule);
    });
  });
});

describe('validateRRule', () => {
  it('should return false for empty string', () => {
    expect(validateRRule('')).toBe(false);
  });

  it('should return true for valid DAILY rule', () => {
    expect(validateRRule('FREQ=DAILY')).toBe(true);
  });

  it('should return true for complex valid rule', () => {
    expect(validateRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR')).toBe(true);
  });

  it('should return false for rule without frequency', () => {
    expect(validateRRule('INTERVAL=2')).toBe(false);
  });

  it('should return false for malformed rule', () => {
    expect(validateRRule('INVALID')).toBe(false);
  });
});

describe('createEmptyRRule', () => {
  it('should create empty rule with default values', () => {
    const rule = createEmptyRRule();
    expect(rule.frequency).toBeNull();
    expect(rule.interval).toBe(1);
    expect(rule.byDay).toBeUndefined();
    expect(rule.byMonthDay).toBeUndefined();
    expect(rule.count).toBeUndefined();
    expect(rule.until).toBeUndefined();
  });
});

describe('Constants', () => {
  it('should have all weekdays', () => {
    expect(ALL_WEEKDAYS).toEqual(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']);
  });

  it('should have all frequencies', () => {
    expect(ALL_FREQUENCIES).toEqual(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
  });

  it('should have weekday labels', () => {
    expect(WEEKDAY_LABELS.MO).toEqual({ full: 'Monday', short: 'M' });
    expect(WEEKDAY_LABELS.SU).toEqual({ full: 'Sunday', short: 'S' });
    expect(WEEKDAY_LABELS.SA).toEqual({ full: 'Saturday', short: 'S' });
  });

  it('should have all 7 weekday labels', () => {
    const keys = Object.keys(WEEKDAY_LABELS);
    expect(keys).toHaveLength(7);
    expect(keys).toEqual(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']);
  });
});

describe('Edge cases', () => {
  it('should handle INTERVAL=0', () => {
    const result = parseRRule('FREQ=DAILY;INTERVAL=0');
    expect(result.interval).toBe(0);
  });

  it('should handle negative interval', () => {
    const result = parseRRule('FREQ=DAILY;INTERVAL=-5');
    expect(result.interval).toBe(-5);
  });

  it('should handle BYMONTHDAY=0', () => {
    const result = parseRRule('FREQ=MONTHLY;BYMONTHDAY=0');
    expect(result.byMonthDay).toBe(0);
  });

  it('should handle single weekday', () => {
    const result = parseRRule('FREQ=WEEKLY;BYDAY=MO');
    expect(result.byDay).toEqual(['MO']);
  });

  it('should preserve whitespace in UNTIL', () => {
    const result = parseRRule('FREQ=DAILY;UNTIL=2026-12-31T23:59:59Z');
    expect(result.until).toBe('2026-12-31T23:59:59Z');
  });

  it('should handle COUNT=0', () => {
    const result = parseRRule('FREQ=DAILY;COUNT=0');
    expect(result.count).toBe(0);
  });

  it('should parse case-sensitive frequency', () => {
    const result = parseRRule('FREQ=daily'); // lowercase
    expect(result.frequency).toBe('daily' as RRuleFrequency);
  });
});
