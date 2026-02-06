// @ts-nocheck
import { RRule } from 'rrule';
import type { Frequency } from '@backend/core/models/Frequency';
import { NaturalRecurrenceParser } from "@backend/core/parsers/NaturalRecurrenceParser";

/**
 * Enhanced Natural Language Parser with advanced pattern support
 * Supports ordinal days, compound frequencies, relative dates, and month-aware patterns
 */

export interface ParseResult {
  frequency?: Frequency;
  naturalLanguage?: string;
  confidence: number;
  alternatives?: Frequency[];
  errors?: string[];
}

export class NaturalLanguageParser {
  private baseParser: NaturalRecurrenceParser;
  
  constructor() {
    this.baseParser = new NaturalRecurrenceParser();
  }

  /**
   * Parse natural language text into Frequency with confidence scoring
   */
  parse(text: string): ParseResult {
    if (!text || typeof text !== 'string') {
      return { confidence: 0, errors: ['Empty input'] };
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return { confidence: 0, errors: ['Empty input'] };
    }

    // Try different parsing strategies in order of specificity
    const strategies = [
      this.parseOrdinalDay.bind(this),
      this.parseCompoundFrequency.bind(this),
      this.parseRelativeDate.bind(this),
      this.parseMonthAwarePattern.bind(this),
      this.parseWithBase.bind(this)
    ];

    const results: ParseResult[] = [];
    
    for (const strategy of strategies) {
      try {
        const result = strategy(trimmed);
        if (result && result.frequency) {
          results.push(result);
        }
      } catch (error) {
        // Continue to next strategy
      }
    }

    // Return best result (highest confidence)
    if (results.length === 0) {
      return { confidence: 0, errors: ['Could not parse recurrence pattern'] };
    }

    results.sort((a, b) => b.confidence - a.confidence);
    const best = results[0];
    
    // Add alternatives (other successful parses)
    if (results.length > 1) {
      best.alternatives = results.slice(1).map(r => r.frequency!);
    }

    return best;
  }

  /**
   * Parse ordinal day patterns like "every 2nd Tuesday" or "every last Friday of the month"
   */
  private parseOrdinalDay(text: string): ParseResult | null {
    // Pattern: "every last [weekday] of the month"
    const lastOfMonthPattern = /every\s+last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+of\s+(the\s+)?month/i;
    
    let match = text.match(lastOfMonthPattern);
    if (match) {
      const weekdayKey = this.weekdayNameToRRuleKey(match[1]);
      try {
        const frequency: Frequency = {
          type: 'monthly',
          interval: 1,
          dayOfMonth: 1, // Default, actual date calculated via rruleString
          naturalLanguage: text,
          rruleString: new RRule({
            freq: RRule.MONTHLY,
            byweekday: [RRule[weekdayKey as keyof typeof RRule].nth(-1)]
          }).toString()
        };
        return { frequency, naturalLanguage: text, confidence: 0.95 };
      } catch (error) {
        return null;
      }
    }

    // Pattern: "every [ordinal] [weekday]"
    const ordinalPattern = /every\s+(1st|2nd|3rd|4th)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*$/i;
    match = text.match(ordinalPattern);
    if (match) {
      const ordinal = this.parseOrdinal(match[1]);
      const weekdayKey = this.weekdayNameToRRuleKey(match[2]);
      try {
        const frequency: Frequency = {
          type: 'monthly',
          interval: 1,
          dayOfMonth: 1, // Default, actual date calculated via rruleString
          naturalLanguage: text,
          rruleString: new RRule({
            freq: RRule.MONTHLY,
            byweekday: [RRule[weekdayKey as keyof typeof RRule].nth(ordinal)]
          }).toString()
        };
        return { frequency, naturalLanguage: text, confidence: 0.95 };
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  /**
   * Parse compound frequency patterns like "every 2 weeks on Monday and Wednesday"
   */
  private parseCompoundFrequency(text: string): ParseResult | null {
    // Pattern: "every [n] weeks on [weekday] and [weekday]"
    const pattern = /every\s+(\d+)?\s*(weeks?|days?)\s+on\s+((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+and\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*)/i;
    
    const match = text.match(pattern);
    if (!match) return null;

    const interval = match[1] ? parseInt(match[1]) : 1;
    const unit = match[2].toLowerCase();
    const weekdaysStr = match[3];

    if (unit.startsWith('week')) {
      // Extract all weekdays
      const weekdayMatches = weekdaysStr.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/gi);
      if (!weekdayMatches) return null;

      const weekdays = weekdayMatches.map(day => this.weekdayNameToNumber(day));
      
      const frequency: Frequency = {
        type: 'weekly',
        interval,
        weekdays,
        naturalLanguage: text,
        rruleString: new RRule({
          freq: RRule.WEEKLY,
          interval,
          byweekday: weekdays
        }).toString()
      };
      
      return { frequency, naturalLanguage: text, confidence: 0.9 };
    }

    return null;
  }

  /**
   * Parse relative date patterns like "in 3 days", "next Monday", "end of month"
   */
  private parseRelativeDate(text: string): ParseResult | null {
    // Pattern: "in [n] [days|weeks|months]"
    const inPattern = /in\s+(\d+)\s+(days?|weeks?|months?)/i;
    let match = text.match(inPattern);
    
    if (match) {
      const count = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      const now = new Date();
      let dueDate: Date;
      
      if (unit.startsWith('day')) {
        dueDate = new Date(now.getTime() + count * 24 * 60 * 60 * 1000);
      } else if (unit.startsWith('week')) {
        dueDate = new Date(now.getTime() + count * 7 * 24 * 60 * 60 * 1000);
      } else if (unit.startsWith('month')) {
        dueDate = new Date(now.getFullYear(), now.getMonth() + count, now.getDate());
      } else {
        return null;
      }
      
      // This is a one-time date, not a recurrence, but we can represent it
      // as a non-recurring task with a due date
      const frequency: Frequency = {
        type: 'daily',
        interval: 0, // 0 interval indicates one-time
        naturalLanguage: text
      };
      
      return { 
        frequency, 
        naturalLanguage: text, 
        confidence: 0.85,
        errors: ['This is a one-time date, not a recurrence pattern']
      };
    }

    // Pattern: "next [weekday]"
    const nextPattern = /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;
    match = text.match(nextPattern);
    
    if (match) {
      const targetWeekday = this.weekdayNameToNumber(match[1]);
      const now = new Date();
      const currentWeekday = (now.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
      const daysUntil = (targetWeekday - currentWeekday + 7) % 7 || 7; // At least 7 if today
      
      // One-time occurrence
      const frequency: Frequency = {
        type: 'weekly',
        interval: 0,
        weekdays: [targetWeekday],
        naturalLanguage: text
      };
      
      return { 
        frequency, 
        naturalLanguage: text, 
        confidence: 0.8,
        errors: ['This is a one-time date, not a recurrence pattern']
      };
    }

    // Pattern: "end of month"
    if (/end\s+of\s+(the\s+)?month/i.test(text)) {
      const frequency: Frequency = {
        type: 'monthly',
        interval: 1,
        dayOfMonth: -1, // last day of month
        naturalLanguage: text,
        rruleString: new RRule({
          freq: RRule.MONTHLY,
          bymonthday: [-1]
        }).toString()
      };
      
      return { frequency, naturalLanguage: text, confidence: 0.9 };
    }

    return null;
  }

  /**
   * Parse month-aware patterns like "every 15th" or "on the 1st and 15th"
   */
  private parseMonthAwarePattern(text: string): ParseResult | null {
    // Pattern: "every [ordinal]" (implies monthly) - but not "every 2nd Tuesday"
    const singlePattern = /^every\s+(1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|13th|14th|15th|16th|17th|18th|19th|20th|21st|22nd|23rd|24th|25th|26th|27th|28th|29th|30th|31st)\s*$/i;
    let match = text.match(singlePattern);
    
    if (match) {
      const day = this.parseOrdinalNumber(match[1]);
      const frequency: Frequency = {
        type: 'monthly',
        interval: 1,
        dayOfMonth: day,
        naturalLanguage: text,
        rruleString: new RRule({
          freq: RRule.MONTHLY,
          bymonthday: [day]
        }).toString()
      };
      
      return { frequency, naturalLanguage: text, confidence: 0.85 };
    }

    // Pattern: "on the [ordinal] and [ordinal]" (implies monthly)
    const multiplePattern = /^on\s+the\s+(\d+(?:st|nd|rd|th))(?:\s+and\s+(\d+(?:st|nd|rd|th)))+\s*$/i;
    match = text.match(multiplePattern);
    
    if (match) {
      const dayMatches = text.match(/\d+(?:st|nd|rd|th)/gi);
      if (!dayMatches) return null;
      
      const days = dayMatches.map(d => this.parseOrdinalNumber(d));
      
      // RRule supports multiple days of month
      const frequency: Frequency = {
        type: 'monthly',
        interval: 1,
        dayOfMonth: days[0], // Store first one in main field
        naturalLanguage: text,
        rruleString: new RRule({
          freq: RRule.MONTHLY,
          bymonthday: days
        }).toString()
      };
      
      return { frequency, naturalLanguage: text, confidence: 0.85 };
    }

    return null;
  }

  /**
   * Fallback to base parser
   */
  private parseWithBase(text: string): ParseResult | null {
    const frequency = this.baseParser.parse(text);
    if (frequency) {
      return { frequency, naturalLanguage: text, confidence: 0.7 };
    }
    return null;
  }

  // Helper methods

  private weekdayNameToNumber(name: string): number {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return days.indexOf(name.toLowerCase());
  }

  private weekdayNameToRRuleKey(name: string): string {
    const map: Record<string, string> = {
      'monday': 'MO',
      'tuesday': 'TU',
      'wednesday': 'WE',
      'thursday': 'TH',
      'friday': 'FR',
      'saturday': 'SA',
      'sunday': 'SU'
    };
    return map[name.toLowerCase()];
  }

  private parseOrdinal(ordinal: string): number {
    const map: Record<string, number> = {
      '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, 'last': -1
    };
    return map[ordinal.toLowerCase()] || 1;
  }

  private parseOrdinalNumber(ordinal: string): number {
    return parseInt(ordinal.replace(/\D/g, ''));
  }
}
