import * as chrono from 'chrono-node';
import { setTime, addDays } from "@shared/utils/date/date";

export interface ParsedDate {
  date: Date | null;
  isValid: boolean;
  error?: string;
  original: string;
}

export interface DateSuggestion {
  text: string;           // Display text (e.g., "Tomorrow")
  value: string;          // Parsed ISO date
  description: string;    // Human-readable (e.g., "Fri, Jan 26, 2024")
  category: 'relative' | 'named' | 'specific' | 'shortcut';
  icon?: string;          // Optional emoji/icon
}

export class DateParser {
  /**
   * Parse a date string (natural language or ISO format)
   */
  static parse(input: string, referenceDate: Date = new Date()): ParsedDate {
    const trimmed = input.trim();
    const original = input;

    if (!trimmed) {
      return { date: null, isValid: false, error: 'Empty date string', original };
    }

    // Try ISO format first (YYYY-MM-DD)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return { date, isValid: true, original };
      }
    }

    // Try chrono-node for comprehensive natural language parsing
    try {
      const parsed = chrono.parseDate(trimmed, referenceDate);
      if (parsed) {
        // Normalize to midnight for consistency with existing behavior
        const normalized = new Date(parsed);
        normalized.setHours(0, 0, 0, 0);
        return { date: normalized, isValid: true, original };
      }
    } catch (error) {
      // Fall through to legacy parsing if chrono fails
    }

    // Legacy natural language parsing (fallback if chrono didn't parse)
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);
    const trimmedLower = trimmed.toLowerCase();

    // Simple keywords
    if (trimmedLower === 'today') {
      return { date: today, isValid: true, original };
    }
    if (trimmedLower === 'tomorrow') {
      const date = new Date(today);
      date.setDate(date.getDate() + 1);
      return { date, isValid: true, original };
    }
    if (trimmedLower === 'yesterday') {
      const date = new Date(today);
      date.setDate(date.getDate() - 1);
      return { date, isValid: true, original };
    }

    // "in X days/weeks/months"
    const inMatch = trimmedLower.match(/^in\s+(\d+)\s+(day|days|week|weeks|month|months)$/);
    if (inMatch) {
      const amount = parseInt(inMatch[1]);
      const unit = inMatch[2];
      const date = new Date(today);
      if (unit.startsWith('day')) {
        date.setDate(date.getDate() + amount);
      } else if (unit.startsWith('week')) {
        date.setDate(date.getDate() + amount * 7);
      } else if (unit.startsWith('month')) {
        date.setMonth(date.getMonth() + amount);
      }
      return { date, isValid: true, original };
    }

    // "X days/weeks ago"
    const agoMatch = trimmedLower.match(/^(\d+)\s+(day|days|week|weeks|month|months)\s+ago$/);
    if (agoMatch) {
      const amount = parseInt(agoMatch[1]);
      const unit = agoMatch[2];
      const date = new Date(today);
      if (unit.startsWith('day')) {
        date.setDate(date.getDate() - amount);
      } else if (unit.startsWith('week')) {
        date.setDate(date.getDate() - amount * 7);
      } else if (unit.startsWith('month')) {
        date.setMonth(date.getMonth() - amount);
      }
      return { date, isValid: true, original };
    }

    // "next/last Monday/Tuesday/etc"
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const nextLastMatch = trimmedLower.match(/^(next|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
    if (nextLastMatch) {
      const direction = nextLastMatch[1];
      const targetDay = dayNames.indexOf(nextLastMatch[2]);
      const currentDay = today.getDay();
      let daysToAdd = targetDay - currentDay;
      
      if (direction === 'next') {
        if (daysToAdd <= 0) daysToAdd += 7;
      } else {
        if (daysToAdd >= 0) daysToAdd -= 7;
      }
      
      const date = new Date(today);
      date.setDate(date.getDate() + daysToAdd);
      return { date, isValid: true, original };
    }

    // "Monday/Tuesday/etc" (next occurrence, including today)
    const dayOnlyMatch = trimmedLower.match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
    if (dayOnlyMatch) {
      const targetDay = dayNames.indexOf(dayOnlyMatch[1]);
      const currentDay = today.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd < 0) daysToAdd += 7;

      const date = new Date(today);
      date.setDate(date.getDate() + daysToAdd);
      return { date, isValid: true, original };
    }

    // "this/next/last week/month"
    const periodMatch = trimmedLower.match(/^(this|next|last)\s+(week|month)$/);
    if (periodMatch) {
      const period = periodMatch[1];
      const unit = periodMatch[2];
      const date = new Date(today);
      
      if (unit === 'week') {
        const dayOfWeek = date.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        date.setDate(date.getDate() + daysToMonday);
        
        if (period === 'next') date.setDate(date.getDate() + 7);
        else if (period === 'last') date.setDate(date.getDate() - 7);
      } else if (unit === 'month') {
        date.setDate(1);
        if (period === 'next') date.setMonth(date.getMonth() + 1);
        else if (period === 'last') date.setMonth(date.getMonth() - 1);
      }
      
      return { date, isValid: true, original };
    }

    return { date: null, isValid: false, error: `Could not parse date: ${input}`, original };
  }

  /**
   * Format a date to ISO string (YYYY-MM-DD)
   * Uses local time to avoid timezone issues
   */
  static toISODateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse natural language date input to Date object
   * Supports all common expressions and shortcuts
   */
  static parseNaturalLanguageDate(input: string, referenceDate: Date = new Date()): Date | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Handle shortcuts first
    const shortcuts = DateParser.handleShortcuts(trimmed, referenceDate);
    if (shortcuts) return shortcuts;

    // Try chrono-node for comprehensive parsing
    try {
      const parsed = chrono.parseDate(trimmed, referenceDate, { forwardDate: true });
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      // Fall through to legacy parsing
    }

    // Use legacy parser as fallback
    const result = DateParser.parse(trimmed, referenceDate);
    return result.date;
  }

  /**
   * Parse natural language date to ISO string for storage
   */
  static parseToISO(input: string, referenceDate: Date = new Date()): string | null {
    const date = DateParser.parseNaturalLanguageDate(input, referenceDate);
    return date ? date.toISOString() : null;
  }

  /**
   * Check if a string appears to be a date expression
   */
  static isDateExpression(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return false;

    // Common date keywords
    const keywords = [
      'today', 'tomorrow', 'yesterday',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      'next', 'last', 'this',
      'week', 'month', 'year',
      'day', 'days', 'ago',
      'eod', 'eow', 'eom',
      'in ', 'at '
    ];

    if (keywords.some(kw => trimmed.includes(kw))) {
      return true;
    }

    // Check if chrono can parse it
    try {
      const parsed = chrono.parseDate(trimmed, new Date());
      return parsed !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get date suggestions for autocomplete
   */
  static getDateSuggestions(partialInput: string, referenceDate: Date = new Date()): DateSuggestion[] {
    const suggestions: DateSuggestion[] = [];
    const input = partialInput.trim().toLowerCase();
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);

    // Relative dates
    const relativeDates = [
      { text: 'Today', offset: 0, icon: '📅' },
      { text: 'Tomorrow', offset: 1, icon: '➡️' },
      { text: 'In 2 days', offset: 2, icon: '📆' },
      { text: 'In 3 days', offset: 3, icon: '📆' },
      { text: 'In 1 week', offset: 7, icon: '📆' },
      { text: 'In 2 weeks', offset: 14, icon: '📆' },
    ];

    for (const rel of relativeDates) {
      if (!input || rel.text.toLowerCase().includes(input)) {
        const date = addDays(today, rel.offset);
        suggestions.push({
          text: rel.text,
          value: date.toISOString(),
          description: DateParser.formatDateForDisplay(date, false),
          category: 'relative',
          icon: rel.icon
        });
      }
    }

    // Named days (next occurrence)
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (let i = 0; i < dayNames.length; i++) {
      const dayName = dayNames[i];
      if (!input || dayName.toLowerCase().includes(input) || `next ${dayName}`.toLowerCase().includes(input)) {
        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        // Convert our array index (0=Monday, 1=Tuesday, ..., 6=Sunday) to Date.getDay() format
        const targetDay = i === 6 ? 0 : i + 1; // Map: 0->1(Mon), 1->2(Tue), ..., 5->6(Sat), 6->0(Sun)
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        
        const date = addDays(today, daysToAdd);
        suggestions.push({
          text: dayName,
          value: date.toISOString(),
          description: DateParser.formatDateForDisplay(date, false),
          category: 'named',
          icon: '📅'
        });
      }
    }

    // Shortcuts
    const shortcuts = [
      { text: 'EOD (end of day)', keyword: 'eod', icon: '🌆' },
      { text: 'EOW (end of week)', keyword: 'eow', icon: '🏁' },
      { text: 'EOM (end of month)', keyword: 'eom', icon: '📊' },
    ];

    for (const shortcut of shortcuts) {
      if (!input || shortcut.text.toLowerCase().includes(input) || shortcut.keyword.includes(input)) {
        const date = DateParser.handleShortcuts(shortcut.keyword, referenceDate);
        if (date) {
          suggestions.push({
            text: shortcut.text,
            value: date.toISOString(),
            description: DateParser.formatDateForDisplay(date, true),
            category: 'shortcut',
            icon: shortcut.icon
          });
        }
      }
    }

    // Next month
    if (!input || 'next month'.includes(input)) {
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      suggestions.push({
        text: 'Next month',
        value: nextMonth.toISOString(),
        description: DateParser.formatDateForDisplay(nextMonth, false),
        category: 'relative',
        icon: '📆'
      });
    }

    return suggestions.slice(0, 8); // Return top 8 suggestions
  }

  /**
   * Format date for human-readable display
   */
  static formatDateForDisplay(date: Date, includeTime: boolean = false): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    return date.toLocaleString(undefined, options);
  }

  /**
   * Parse time from natural language (e.g., "9am", "2:30pm", "14:00")
   */
  static parseTime(input: string): { hours: number; minutes: number } | null {
    const trimmed = input.trim().toLowerCase();
    
    // 24-hour format (14:00, 09:30)
    const time24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (time24Match) {
      const hours = parseInt(time24Match[1]);
      const minutes = parseInt(time24Match[2]);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return { hours, minutes };
      }
    }

    // 12-hour format with am/pm (9am, 2:30pm, 3:45 pm)
    const time12Match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (time12Match) {
      let hours = parseInt(time12Match[1]);
      const minutes = time12Match[2] ? parseInt(time12Match[2]) : 0;
      const period = time12Match[3];

      if (period === 'pm' && hours !== 12) {
        hours += 12;
      } else if (period === 'am' && hours === 12) {
        hours = 0;
      }

      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return { hours, minutes };
      }
    }

    // Try chrono for more complex time expressions
    try {
      const parsed = chrono.parseDate(trimmed, new Date());
      if (parsed) {
        return { hours: parsed.getHours(), minutes: parsed.getMinutes() };
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Handle shortcut keywords (eod, eow, eom)
   */
  private static handleShortcuts(input: string, referenceDate: Date): Date | null {
    const trimmed = input.trim().toLowerCase();
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);

    switch (trimmed) {
      case 'eod':
        // End of day - 5:00 PM today
        return setTime(today, 17, 0);
      
      case 'eow': {
        // End of week - Friday 5:00 PM
        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
        let daysUntilFriday;
        
        if (currentDay === 0) {
          // Sunday -> 5 days to Friday
          daysUntilFriday = 5;
        } else if (currentDay <= 5) {
          // Monday to Friday -> days until Friday (0 if already Friday)
          daysUntilFriday = 5 - currentDay;
        } else {
          // Saturday -> 6 days to next Friday
          daysUntilFriday = 6;
        }
        
        const friday = addDays(today, daysUntilFriday);
        return setTime(friday, 17, 0);
      }
      
      case 'eom': {
        // End of month - last day at 5:00 PM
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return setTime(lastDay, 17, 0);
      }
      
      default:
        return null;
    }
  }
}
