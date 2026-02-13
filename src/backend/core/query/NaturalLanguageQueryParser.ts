import { QueryParser, type QueryAST } from '@backend/core/query/QueryParser';
import { QuerySyntaxError } from '@backend/core/query/QueryError';
import { DateParser } from '@backend/core/parsers/DateParser';
import { StatusType } from '@backend/core/models/Status';

/**
 * NaturalLanguageQueryParser - Natural language overlay on AST parser
 * Translates user-friendly query syntax to AST format
 * 
 * Phase 1: Query Enhancement
 * 
 * Supported natural language patterns:
 * - "due before today" -> date filter
 * - "priority is high" -> priority filter  
 * - "status is todo" -> status filter
 * - "tags include #urgent" -> tag filter
 * - "sort by urgency" -> sort clause
 * - "group by status" -> group clause
 * - "limit 10" -> limit clause
 * - "explain" -> explanation flag
 */

export interface NaturalLanguagePattern {
  pattern: RegExp;
  transform: (match: RegExpMatchArray) => string;
  examples: string[];
}

export class NaturalLanguageQueryParser {
  private astParser: QueryParser;
  private dateParser: DateParser;
  
  // Natural language patterns (order matters - more specific first)
  private patterns: NaturalLanguagePattern[] = [
    // Date filters
    {
      pattern: /\b(due|scheduled|start|created|done|cancelled)\s+(before|after|on|is)\s+(.+?)(?:\s+(?:and|or|limit|sort|group|$))/i,
      transform: (match) => {
        const field = match[1]?.toLowerCase() || 'due';
        const operator = match[2]?.toLowerCase() || 'before';
        const dateStr = match[3]?.trim() || 'today';
        return `${field} ${operator} ${dateStr}`;
      },
      examples: ['due before today', 'scheduled after tomorrow', 'created on 2024-01-15']
    },
    
    // Priority filters
    {
      pattern: /\bpriority\s+(is|>=|>|<=|<|=)\s+(lowest|low|medium|high|highest|\d+)/i,
      transform: (match) => {
        const operator = match[1] || 'is';
        const value = match[2]?.toLowerCase() || 'medium';
        return `priority ${operator} ${value}`;
      },
      examples: ['priority is high', 'priority >= medium', 'priority > 2']
    },
    
    // Status filters
    {
      pattern: /\bstatus\s+(is|=)\s+(todo|done|cancelled|in-?progress)/i,
      transform: (match) => {
        const value = match[2]?.toLowerCase().replace('-', '') || 'todo';
        return `status is ${value}`;
      },
      examples: ['status is todo', 'status is done']
    },
    
    // Tag filters
    {
      pattern: /\btags?\s+(include|has|contains?)\s+(#?\w+)/i,
      transform: (match) => {
        const tagValue = match[2] || 'tag';
        const tag = tagValue.startsWith('#') ? tagValue : `#${tagValue}`;
        return `tag includes ${tag}`;
      },
      examples: ['tags include #urgent', 'tag has work']
    },
    
    // Path filters
    {
      pattern: /\bpath\s+(includes?|contains?)\s+["'](.+?)["']/i,
      transform: (match) => {
        return `path includes "${match[2] || ''}"`;
      },
      examples: ['path includes "work"', 'path contains "personal"']
    },
    
    // Description filters
    {
      pattern: /\bdescription\s+(includes?|contains?)\s+["'](.+?)["']/i,
      transform: (match) => {
        return `description includes "${match[2] || ''}"`;
      },
      examples: ['description includes "meeting"']
    },
    
    // Heading filters
    {
      pattern: /\bheading\s+(includes?|contains?)\s+["'](.+?)["']/i,
      transform: (match) => {
        return `heading includes "${match[2] || ''}"`;
      },
      examples: ['heading includes "Projects"']
    },
    
    // Recurrence filters
    {
      pattern: /\b(has|is|with)\s+recurrence/i,
      transform: (match) => 'recurrence exists',
      examples: ['has recurrence', 'is recurring']
    },
    
    {
      pattern: /\b(no|without)\s+recurrence/i,
      transform: (match) => 'NOT recurrence exists',
      examples: ['no recurrence', 'without recurrence']
    },
    
    // Dependency filters
    {
      pattern: /\b(is\s+)?blocked/i,
      transform: (match) => 'is blocked',
      examples: ['is blocked', 'blocked']
    },
    
    {
      pattern: /\b(is\s+)?blocking/i,
      transform: (match) => 'is blocking',
      examples: ['is blocking', 'blocking']
    },
    
    // Done/not done shortcuts
    {
      pattern: /\bnot\s+done/i,
      transform: (match) => 'NOT done',
      examples: ['not done']
    },
    
    {
      pattern: /\bis\s+done/i,
      transform: (match) => 'done',
      examples: ['is done']
    },
    
    // Sort clause
    {
      pattern: /\bsort\s+by\s+(\w+)(\s+(asc|desc|ascending|descending))?/i,
      transform: (match) => {
        const field = match[1] || 'priority';
        const order = match[3]?.toLowerCase();
        const reverse = order === 'desc' || order === 'descending';
        return `sort ${field}${reverse ? ' desc' : ''}`;
      },
      examples: ['sort by urgency', 'sort by due desc', 'sort by priority ascending']
    },
    
    // Group clause
    {
      pattern: /\bgroup\s+by\s+(\w+)/i,
      transform: (match) => `group ${match[1] || 'status'}`,
      examples: ['group by status', 'group by priority']
    },
    
    // Limit clause
    {
      pattern: /\blimit\s+(to\s+)?(\d+)(\s+tasks?)?/i,
      transform: (match) => `limit ${match[2] || '10'}`,
      examples: ['limit 10', 'limit to 20 tasks']
    },
    
    // Explain flag
    {
      pattern: /\bexplain/i,
      transform: (match) => 'explain',
      examples: ['explain']
    }
  ];

  constructor() {
    this.astParser = new QueryParser();
    this.dateParser = new DateParser();
  }

  /**
   * Parse natural language query to AST
   * Falls back to standard AST parser if no natural language patterns match
   * 
   * @param queryString Natural language or standard query string
   * @param referenceDate Reference date for relative dates (defaults to now)
   * @returns Parsed QueryAST
   */
  parse(queryString: string, referenceDate: Date = new Date()): QueryAST {
    try {
      // First, try to transform natural language to standard syntax
      const transformed = this.transformNaturalLanguage(queryString);
      
      // If transformation occurred, indicate it in AST metadata
      if (transformed !== queryString) {
        console.debug(`Natural language transformed: "${queryString}" -> "${transformed}"`);
      }
      
      // Parse with standard AST parser
      return this.astParser.parse(transformed, referenceDate);
    } catch (error) {
      // If parsing fails, provide helpful error with natural language hints
      if (error instanceof QuerySyntaxError) {
        throw new QuerySyntaxError(
          `${error.message}\n\nTip: You can use natural language like:\n${this.getExampleHints()}`,
          0,
          0
        );
      }
      throw error;
    }
  }

  /**
   * Transform natural language query to standard syntax
   */
  private transformNaturalLanguage(queryString: string): string {
    let result = queryString;
    
    // Apply each pattern transformation
    for (const pattern of this.patterns) {
      const match = result.match(pattern.pattern);
      if (match) {
        const transformed = pattern.transform(match);
        result = result.replace(pattern.pattern, transformed);
      }
    }
    
    // Handle common conjunctions
    result = result.replace(/\b(and)\b/gi, 'AND');
    result = result.replace(/\b(or)\b/gi, 'OR');
    result = result.replace(/\b(not)\b/gi, 'NOT');
    
    // Handle date shortcuts
    result = this.expandDateShortcuts(result);
    
    return result.trim();
  }

  /**
   * Expand common date shortcuts
   */
  private expandDateShortcuts(queryString: string): string {
    const shortcuts: Record<string, string> = {
      'today': new Date().toISOString().split('T')[0]!,
      'tomorrow': this.getDateOffset(1),
      'yesterday': this.getDateOffset(-1),
      'this week': this.getWeekStart(),
      'next week': this.getWeekStart(7),
      'last week': this.getWeekStart(-7),
      'this month': this.getMonthStart(),
      'next month': this.getMonthStart(1),
      'last month': this.getMonthStart(-1)
    };
    
    let result = queryString;
    
    for (const [shortcut, date] of Object.entries(shortcuts)) {
      const regex = new RegExp(`\\b${shortcut}\\b`, 'gi');
      result = result.replace(regex, date);
    }
    
    return result;
  }

  /**
   * Get date offset by days
   */
  private getDateOffset(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Get start of week (offset by weeks)
   */
  private getWeekStart(weekOffset: number = 0): string {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (weekOffset * 7);
    date.setDate(diff);
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Get start of month (offset by months)
   */
  private getMonthStart(monthOffset: number = 0): string {
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    date.setDate(1);
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Get example hints for error messages
   */
  private getExampleHints(): string {
    const hints = [
      '  - "due before today"',
      '  - "priority is high"',
      '  - "tags include #urgent"',
      '  - "status is todo"',
      '  - "sort by urgency"',
      '  - "limit 10"'
    ];
    return hints.join('\n');
  }

  /**
   * Validate natural language query without parsing
   * Returns suggestions for corrections
   */
  validate(queryString: string): {
    valid: boolean;
    suggestions: string[];
    transformed: string;
  } {
    const transformed = this.transformNaturalLanguage(queryString);
    const suggestions: string[] = [];
    
    // Check for common mistakes
    if (queryString.includes('is due')) {
      suggestions.push('Use "due before/after" instead of "is due"');
    }
    
    if (queryString.includes('tag is')) {
      suggestions.push('Use "tags include" instead of "tag is"');
    }
    
    if (/priority\s+high/i.test(queryString) && !/priority\s+(is|>=|>|<=|<|=)\s+high/i.test(queryString)) {
      suggestions.push('Use "priority is high" instead of just "priority high"');
    }
    
    try {
      this.astParser.parse(transformed);
      return { valid: true, suggestions, transformed };
    } catch (error) {
      if (error instanceof QuerySyntaxError) {
        suggestions.push(error.message);
      }
      return { valid: false, suggestions, transformed };
    }
  }

  /**
   * Get all supported patterns with examples
   */
  getPatterns(): NaturalLanguagePattern[] {
    return [...this.patterns];
  }

  /**
   * Get autocomplete suggestions for partial query
   */
  getSuggestions(partialQuery: string): string[] {
    const suggestions: string[] = [];
    const lower = partialQuery.toLowerCase();
    
    // Suggest completions based on patterns
    if (lower.includes('due ') && !lower.includes('due before') && !lower.includes('due after')) {
      suggestions.push('due before today', 'due after tomorrow');
    }
    
    if (lower.includes('priority') && !lower.includes('priority is')) {
      suggestions.push('priority is high', 'priority >= medium');
    }
    
    if (lower.includes('status') && !lower.includes('status is')) {
      suggestions.push('status is todo', 'status is done');
    }
    
    if (lower.includes('tag') && !lower.includes('tags include')) {
      suggestions.push('tags include #urgent');
    }
    
    if (!lower.includes('sort') && !lower.includes('group')) {
      suggestions.push('sort by urgency', 'group by status');
    }
    
    if (!lower.includes('limit')) {
      suggestions.push('limit 10', 'limit 20');
    }
    
    if (!lower.includes('explain')) {
      suggestions.push('explain');
    }
    
    return suggestions;
  }
}

/**
 * Singleton instance for convenience
 */
export const naturalLanguageParser = new NaturalLanguageQueryParser();
