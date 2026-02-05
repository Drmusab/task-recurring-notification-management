import { QuerySyntaxError } from "@backend/core/query/QueryError";
import { StatusType } from '@backend/core/models/Status';
import type { DateField, DateComparator } from "@backend/core/query/filters/DateFilter";
import type { PriorityLevel } from "@backend/core/query/filters/PriorityFilter";
import { DateParser } from '@backend/core/parsers/DateParser';
import { RegexMatcher, type RegexSpec } from "@backend/core/query/utils/RegexMatcher";
import { placeholderResolver, type QueryContext } from '@shared/utils/misc/PlaceholderResolver';

/**
 * Parse query string to Abstract Syntax Tree (AST)
 */
export interface QueryAST {
  filters: FilterNode[];
  sort?: SortNode;
  group?: GroupNode;
  limit?: number;
  explain?: boolean;
  
  // NEW: Override directives
  overrideGlobalFilter?: boolean;
  useProfile?: string;
}

export interface FilterNode {
  type: 'status' | 'date' | 'priority' | 'urgency' | 'escalation' | 'attention' | 'attention-lane' | 'tag' | 'path' | 'dependency' | 'recurrence' | 'boolean' | 'done' | 'description' | 'heading' | 'description-regex' | 'path-regex' | 'tag-regex';
  operator: string;
  value: any;
  negate?: boolean;
  left?: FilterNode;
  right?: FilterNode;
  inner?: FilterNode;
}

export interface SortNode {
  field: string;
  reverse?: boolean;
}

export interface GroupNode {
  field: string;
}

export class QueryParser {
  private input: string = '';
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private referenceDate: Date = new Date();

  /**
   * Parse query string to AST
   * @param queryString The query string to parse
   * @param referenceDate Reference date for relative date parsing (defaults to now)
   * @param context Query context for placeholder resolution (optional)
   * @throws QuerySyntaxError with helpful error message
   */
  parse(queryString: string, referenceDate: Date = new Date(), context?: QueryContext): QueryAST {
    // Resolve placeholders first if context is provided
    if (context && placeholderResolver.hasPlaceholders(queryString)) {
      queryString = placeholderResolver.resolve(queryString, context);
    }
    
    // Extract directives first
    let text = queryString.trim();
    const directives: { overrideGlobalFilter?: boolean; useProfile?: string } = {};
    
    // Extract directives (special prefix syntax)
    const lines = text.split('\n');
    const filteredLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // @ignoreGlobalFilter directive
      if (trimmed === '@ignoreGlobalFilter') {
        directives.overrideGlobalFilter = true;
        continue;
      }
      
      // @profile <name> directive
      const profileMatch = trimmed.match(/^@profile\s+(.+)$/);
      if (profileMatch) {
        directives.useProfile = profileMatch[1].trim();
        continue;
      }
      
      filteredLines.push(line);
    }
    
    // Continue with existing parsing logic on filtered text
    this.input = filteredLines.join('\n').trim();
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.referenceDate = referenceDate;

    const ast: QueryAST = {
      filters: [],
    };

    // Parse line by line
    const astLines = this.input.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    for (let i = 0; i < astLines.length; i++) {
      this.line = i + 1;
      this.column = 1;
      const line = astLines[i];

      if (line.startsWith('sort by ')) {
        ast.sort = this.parseSortInstruction(line);
      } else if (line.startsWith('group by ')) {
        ast.group = this.parseGroupInstruction(line);
      } else if (line.startsWith('limit ') || line.startsWith('limit to ')) {
        ast.limit = this.parseLimitInstruction(line);
      } else if (/^explain$/i.test(line)) {
        ast.explain = true;
      } else {
        // It's a filter instruction
        const filter = this.parseFilterInstruction(line);
        if (filter) {
          ast.filters.push(filter);
        }
      }
    }

    // Merge directives into the AST
    return { ...ast, ...directives };
  }

  /**
   * Validate query syntax without full parsing
   */
  validate(queryString: string): { valid: boolean; error?: string } {
    try {
      this.parse(queryString);
      return { valid: true };
    } catch (error) {
      if (error instanceof QuerySyntaxError) {
        return { valid: false, error: error.message };
      }
      return { valid: false, error: String(error) };
    }
  }

  /**
   * Normalize operator aliases to canonical forms
   * Supports: &&->AND, ||->OR, !->NOT, -prefix->NOT, except->AND NOT
   */
  private normalizeOperatorAliases(line: string): string {
    // Handle '-' prefix for negation (e.g., '-done' -> 'not done')
    // Must be careful not to affect dates or other uses of '-'
    // Only apply at the start of the line or after boolean operators
    line = line.replace(/^-(\w+)/, 'not $1');
    line = line.replace(/(\s+(?:and|AND|or|OR))\s+-(\w+)/gi, '$1 not $2');
    
    // Handle '!' prefix for negation (e.g., '!done' -> 'not done')
    line = line.replace(/^!(\w+)/, 'not $1');
    line = line.replace(/(\s+(?:and|AND|or|OR))\s+!(\w+)/gi, '$1 not $2');
    
    // Handle 'except' as 'AND NOT' (e.g., 'urgent except done' -> 'urgent AND NOT done')
    line = line.replace(/\s+except\s+/gi, ' AND NOT ');
    
    // Handle '&&' as 'AND'
    line = line.replace(/\s*&&\s*/g, ' AND ');
    
    // Handle '||' as 'OR'
    line = line.replace(/\s*\|\|\s*/g, ' OR ');
    
    return line;
  }

  private parseFilterInstruction(line: string): FilterNode | null {
    // Normalize operator aliases first
    line = this.normalizeOperatorAliases(line);
    
    // Handle special simple keywords before boolean parsing
    if (line === 'done') {
      return { type: 'done', operator: 'is', value: true };
    }
    if (line === 'not done') {
      return { type: 'done', operator: 'is', value: false };
    }
    
    // Use precedence-aware parser for expressions with boolean operators or parentheses
    if (this.hasBooleanOperators(line) || line.includes('(')) {
      return this.parseBooleanExpression(line);
    }
    
    // Check for "between" date filters first (before boolean operators)
    // to avoid "and" in "between X and Y" being parsed as boolean AND
    const betweenMatch = line.match(/^(due|scheduled|start|created|done|cancelled)\s+between\s+/i);
    if (betweenMatch) {
      const dateFilter = this.parseDateFilter(line);
      if (dateFilter) {
        return dateFilter;
      }
    }

    // Status filters
    if (line.startsWith('status.type is ')) {
      const typeStr = line.substring('status.type is '.length).trim();
      const statusType = this.parseStatusType(typeStr);
      return { type: 'status', operator: 'type-is', value: statusType };
    }
    if (line.startsWith('status.name includes ')) {
      const name = line.substring('status.name includes '.length).trim();
      return { type: 'status', operator: 'name-includes', value: this.unquote(name) };
    }
    if (line.startsWith('status.symbol is ')) {
      const symbol = line.substring('status.symbol is '.length).trim();
      return { type: 'status', operator: 'symbol-is', value: this.unquote(symbol) };
    }

    // Date filters
    const dateFilterMatch = this.parseDateFilter(line);
    if (dateFilterMatch) {
      return dateFilterMatch;
    }

    const priorityFilter = this.parsePriorityFilter(line);
    if (priorityFilter) {
      return priorityFilter;
    }

    // Urgency filters
    if (line.startsWith('urgency is ')) {
      const value = line.substring('urgency is '.length).trim();
      return { type: 'urgency', operator: 'is', value: this.parseNumericValue(value, 'urgency') };
    }
    if (line.startsWith('urgency above ')) {
      const value = line.substring('urgency above '.length).trim();
      return { type: 'urgency', operator: 'above', value: this.parseNumericValue(value, 'urgency') };
    }
    if (line.startsWith('urgency below ')) {
      const value = line.substring('urgency below '.length).trim();
      return { type: 'urgency', operator: 'below', value: this.parseNumericValue(value, 'urgency') };
    }

    const escalationFilterMatch = this.parseEscalationFilter(line);
    if (escalationFilterMatch) {
      return escalationFilterMatch;
    }

    const attentionFilterMatch = this.parseAttentionFilter(line);
    if (attentionFilterMatch) {
      return attentionFilterMatch;
    }

    const laneFilterMatch = this.parseAttentionLaneFilter(line);
    if (laneFilterMatch) {
      return laneFilterMatch;
    }

    // Tag filters
    if (line.startsWith('tag includes ')) {
      const tag = line.substring('tag includes '.length).trim();
      return { type: 'tag', operator: 'includes', value: this.unquote(tag) };
    }
    if (line.startsWith('tag does not include ')) {
      const tag = line.substring('tag does not include '.length).trim();
      return { type: 'tag', operator: 'includes', value: this.unquote(tag), negate: true };
    }
    if (line.startsWith('tags include ')) {
      const tag = line.substring('tags include '.length).trim();
      return { type: 'tag', operator: 'includes', value: this.unquote(tag) };
    }
    if (line === 'has tags') {
      return { type: 'tag', operator: 'has', value: true };
    }
    if (line === 'no tags') {
      return { type: 'tag', operator: 'has', value: false };
    }

    // Tag regex filters
    if (line.startsWith('tag regex ') || line.startsWith('tags regex ')) {
      const patternStr = line.startsWith('tag regex ') 
        ? line.substring('tag regex '.length).trim()
        : line.substring('tags regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'tag-regex', operator: 'regex', value: regexSpec };
    }
    if (line.startsWith('not tag regex ') || line.startsWith('not tags regex ')) {
      const patternStr = line.startsWith('not tag regex ')
        ? line.substring('not tag regex '.length).trim()
        : line.substring('not tags regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'tag-regex', operator: 'regex', value: regexSpec, negate: true };
    }

    // Path filters
    if (line.startsWith('path includes ')) {
      const pattern = line.substring('path includes '.length).trim();
      return { type: 'path', operator: 'includes', value: this.unquote(pattern) };
    }
    if (line.startsWith('path does not include ')) {
      const pattern = line.substring('path does not include '.length).trim();
      return { type: 'path', operator: 'includes', value: this.unquote(pattern), negate: true };
    }

    // Path regex filters
    if (line.startsWith('path regex ')) {
      const patternStr = line.substring('path regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'path-regex', operator: 'regex', value: regexSpec };
    }
    if (line.startsWith('not path regex ')) {
      const patternStr = line.substring('not path regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'path-regex', operator: 'regex', value: regexSpec, negate: true };
    }

    // Dependency filters
    if (line === 'is blocked') {
      return { type: 'dependency', operator: 'is-blocked', value: true };
    }
    if (line === 'is not blocked') {
      return { type: 'dependency', operator: 'is-blocked', value: false };
    }
    if (line === 'is blocking') {
      return { type: 'dependency', operator: 'is-blocking', value: true };
    }
    if (line === 'is not blocking') {
      return { type: 'dependency', operator: 'is-blocking', value: false };
    }

    // Recurrence filters
    if (line === 'is recurring') {
      return { type: 'recurrence', operator: 'is', value: true };
    }
    if (line === 'is not recurring') {
      return { type: 'recurrence', operator: 'is', value: false };
    }

    // Description filters
    if (line.startsWith('description includes ')) {
      const pattern = line.substring('description includes '.length).trim();
      return { type: 'description', operator: 'includes', value: this.unquote(pattern) };
    }
    if (line.startsWith('description does not include ')) {
      const pattern = line.substring('description does not include '.length).trim();
      return { type: 'description', operator: 'does not include', value: this.unquote(pattern) };
    }
    // Description regex filter (new format with regex literals)
    if (line.startsWith('description regex ')) {
      const patternStr = line.substring('description regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'description-regex', operator: 'regex', value: regexSpec };
    }
    if (line.startsWith('not description regex ')) {
      const patternStr = line.substring('not description regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'description-regex', operator: 'regex', value: regexSpec, negate: true };
    }

    // Heading filters
    if (line.startsWith('heading includes ')) {
      const pattern = line.substring('heading includes '.length).trim();
      return { type: 'heading', operator: 'includes', value: this.unquote(pattern) };
    }
    if (line.startsWith('heading does not include ')) {
      const pattern = line.substring('heading does not include '.length).trim();
      return { type: 'heading', operator: 'does not include', value: this.unquote(pattern) };
    }

    // If we can't parse it, throw error
    throw new QuerySyntaxError(
      `Unknown filter instruction: "${line}"`,
      this.line,
      this.column,
      'Check the query syntax documentation for valid filter instructions'
    );
  }

  private parseDateFilter(line: string): FilterNode | null {
    const dateFields: DateField[] = ['due', 'scheduled', 'start', 'created', 'done', 'cancelled'];
    
    for (const field of dateFields) {
      // "has X date" pattern
      if (line === `has ${field} date`) {
        return { type: 'date', operator: 'has', value: { field } };
      }
      
      // "no X date" pattern
      if (line === `no ${field} date`) {
        return { type: 'date', operator: 'has', value: { field }, negate: true };
      }

      // "X between DATE1 and DATE2" pattern
      const betweenMatch = line.match(new RegExp(`^${field}\\s+between\\s+(.+?)\\s+and\\s+(.+)$`, 'i'));
      if (betweenMatch) {
        const startDateStr = betweenMatch[1].trim();
        const endDateStr = betweenMatch[2].trim();
        
        const parsedStart = DateParser.parse(startDateStr, this.referenceDate);
        const parsedEnd = DateParser.parse(endDateStr, this.referenceDate);
        
        if (!parsedStart.isValid || !parsedStart.date) {
          throw new QuerySyntaxError(
            `Invalid start date: "${startDateStr}"`,
            this.line,
            this.column,
            'Use formats like: today, tomorrow, YYYY-MM-DD, "in 3 days", "next Monday"'
          );
        }
        
        if (!parsedEnd.isValid || !parsedEnd.date) {
          throw new QuerySyntaxError(
            `Invalid end date: "${endDateStr}"`,
            this.line,
            this.column,
            'Use formats like: today, tomorrow, YYYY-MM-DD, "in 3 days", "next Monday"'
          );
        }
        
        return {
          type: 'date',
          operator: 'between',
          value: { field, date: parsedStart.date, endDate: parsedEnd.date }
        };
      }

      // "X before/after/on VALUE" patterns
      const comparators: DateComparator[] = ['before', 'after', 'on', 'on or before', 'on or after'];
      
      for (const comparator of comparators) {
        const prefix = `${field} ${comparator} `;
        if (line.startsWith(prefix)) {
          const dateStr = line.substring(prefix.length).trim();
          const parsedDate = DateParser.parse(dateStr, this.referenceDate);
          
          if (!parsedDate.isValid || !parsedDate.date) {
            throw new QuerySyntaxError(
              `Invalid date value: "${dateStr}"`,
              this.line,
              this.column,
              'Use formats like: today, tomorrow, YYYY-MM-DD, "in 3 days", "next Monday"'
            );
          }
          
          return {
            type: 'date',
            operator: comparator,
            value: { field, date: parsedDate.date }
          };
        }
      }
    }

    return null;
  }

  private parseSortInstruction(line: string): SortNode {
    const match = line.match(/^sort by ([a-z.]+)(\s+reverse)?$/i);
    if (!match) {
      throw new QuerySyntaxError(
        `Invalid sort instruction: "${line}"`,
        this.line,
        this.column,
        'Use format: "sort by FIELD" or "sort by FIELD reverse"'
      );
    }

    return {
      field: match[1],
      reverse: !!match[2],
    };
  }

  private parseGroupInstruction(line: string): GroupNode {
    const match = line.match(/^group by ([a-z.]+)$/i);
    if (!match) {
      throw new QuerySyntaxError(
        `Invalid group instruction: "${line}"`,
        this.line,
        this.column,
        'Use format: "group by FIELD"'
      );
    }

    return {
      field: match[1],
    };
  }

  private parseLimitInstruction(line: string): number {
    let match = line.match(/^limit (\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }

    match = line.match(/^limit to (\d+) tasks?$/);
    if (match) {
      return parseInt(match[1], 10);
    }

    throw new QuerySyntaxError(
      `Invalid limit instruction: "${line}"`,
      this.line,
      this.column,
      'Use format: "limit 10" or "limit to 10 tasks"'
    );
  }

  private parseStatusType(typeStr: string): StatusType {
    const normalized = typeStr.toUpperCase().replace(/\s+/g, '_');
    
    switch (normalized) {
      case 'TODO':
        return StatusType.TODO;
      case 'IN_PROGRESS':
        return StatusType.IN_PROGRESS;
      case 'DONE':
        return StatusType.DONE;
      case 'CANCELLED':
        return StatusType.CANCELLED;
      case 'NON_TASK':
        return StatusType.NON_TASK;
      default:
        throw new QuerySyntaxError(
          `Invalid status type: "${typeStr}"`,
          this.line,
          this.column,
          'Valid types: TODO, IN_PROGRESS, DONE, CANCELLED, NON_TASK'
        );
    }
  }

  private parseNumericValue(value: string, field: string): number {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new QuerySyntaxError(
        `Invalid ${field} value: "${value}"`,
        this.line,
        this.column,
        `Use a numeric ${field} value (e.g., "${field} above 75")`
      );
    }
    return parsed;
  }

  private unquote(str: string): string {
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1);
    }
    return str;
  }
  
  /**
   * Check if line contains boolean operators (AND, OR, NOT)
   * Excludes 'between X and Y' pattern
   */
  private hasBooleanOperators(line: string): boolean {
    // Check for NOT at the beginning
    if (/^(not|NOT)\s+/i.test(line)) {
      return true;
    }
    
    // Check for AND or OR
    // But exclude "between ... and ..." pattern
    const betweenPattern = /\s+between\s+.+?\s+and\s+/i;
    if (betweenPattern.test(line)) {
      // Has "between...and" - remove it and check the rest
      const withoutBetween = line.replace(betweenPattern, ' ');
      return /\s+(and|AND|or|OR)\s+/i.test(withoutBetween);
    }
    
    return /\s+(and|AND|or|OR)\s+/i.test(line);
  }

  /**
   * Parse boolean expression with proper operator precedence
   * Precedence (highest to lowest): NOT, AND, OR
   * Supports parentheses for explicit grouping
   */
  private parseBooleanExpression(line: string): FilterNode {
    return this.parseOrExpression(line);
  }

  /**
   * Parse OR expression (lowest precedence)
   * Format: AND_EXPR (OR AND_EXPR)*
   */
  private parseOrExpression(line: string): FilterNode {
    // Split by OR that's not inside parentheses
    const parts = this.splitByOperator(line, /\s+(or|OR)\s+/i);
    
    if (parts.length === 1) {
      return this.parseAndExpression(parts[0]);
    }
    
    // Build left-associative tree: (a OR b) OR c
    let result = this.parseAndExpression(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      result = {
        type: 'boolean',
        operator: 'OR',
        value: null,
        left: result,
        right: this.parseAndExpression(parts[i]),
      };
    }
    
    return result;
  }

  /**
   * Parse AND expression (middle precedence)
   * Format: NOT_EXPR (AND NOT_EXPR)*
   */
  private parseAndExpression(line: string): FilterNode {
    // Split by AND that's not inside parentheses or "between...and"
    const parts = this.splitByOperator(line, /\s+(and|AND)\s+/i, true);
    
    if (parts.length === 1) {
      return this.parseNotExpression(parts[0]);
    }
    
    // Build left-associative tree: (a AND b) AND c
    let result = this.parseNotExpression(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      result = {
        type: 'boolean',
        operator: 'AND',
        value: null,
        left: result,
        right: this.parseNotExpression(parts[i]),
      };
    }
    
    return result;
  }

  /**
   * Parse NOT expression (highest precedence)
   * Format: NOT PRIMARY | PRIMARY
   */
  private parseNotExpression(line: string): FilterNode {
    const trimmed = line.trim();
    
    // Special case: "not done" should be parsed as {type: 'done', value: false}
    // Check this before general NOT parsing
    if (trimmed.toLowerCase() === 'not done') {
      return { type: 'done', operator: 'is', value: false };
    }
    
    // Special case: "not X regex" patterns should be handled by atomic filter parsing
    // Check these before general NOT parsing
    const regexPatterns = ['not description regex ', 'not path regex ', 'not tag regex ', 'not tags regex '];
    if (regexPatterns.some(pattern => trimmed.startsWith(pattern))) {
      return this.parsePrimaryExpression(trimmed);
    }
    
    // Check for NOT prefix
    if (/^(not|NOT)\s+/i.test(trimmed)) {
      const cleanLine = trimmed.replace(/^(not|NOT)\s+/i, '').trim();
      const inner = this.parsePrimaryExpression(cleanLine);
      
      return {
        type: 'boolean',
        operator: 'NOT',
        value: null,
        inner,
      };
    }
    
    return this.parsePrimaryExpression(trimmed);
  }

  /**
   * Parse primary expression (parentheses or atomic filter)
   * Format: (BOOLEAN_EXPR) | ATOMIC_FILTER
   */
  private parsePrimaryExpression(line: string): FilterNode {
    const trimmed = line.trim();
    
    // Check for parentheses - verify they're balanced and wrap the entire expression
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      // Verify this is a proper wrapping, not something like "(a) OR (b)"
      let depth = 0;
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '(') depth++;
        if (trimmed[i] === ')') depth--;
        // If depth reaches 0 before the end, the outer parens don't wrap everything
        if (depth === 0 && i < trimmed.length - 1) {
          break;
        }
      }
      
      // If depth is 0 and we made it to the end, remove outer parentheses and parse inner expression
      if (depth === 0) {
        const inner = trimmed.slice(1, -1).trim();
        return this.parseBooleanExpression(inner);
      }
    }
    
    // Parse as atomic filter
    return this.parseAtomicFilter(trimmed);
  }

  /**
   * Split line by operator, respecting parentheses and "between...and"
   */
  private splitByOperator(line: string, operatorRegex: RegExp, excludeBetween: boolean = false): string[] {
    const parts: string[] = [];
    let currentPart = '';
    let parenDepth = 0;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (char === '(') {
        parenDepth++;
        currentPart += char;
        i++;
      } else if (char === ')') {
        parenDepth--;
        currentPart += char;
        i++;
      } else if (parenDepth === 0) {
        // Check if we're at an operator
        const remaining = line.slice(i);
        const match = remaining.match(operatorRegex);
        
        if (match && match.index === 0) {
          // Special handling for AND in "between...and"
          if (excludeBetween && /\s+(and|AND)\s+/i.test(match[0])) {
            // Check if this is part of "between...and"
            const beforeContext = currentPart.toLowerCase();
            if (beforeContext.match(/\s+between\s+[^)]*$/)) {
              // This AND is part of "between...and", don't split
              currentPart += match[0];
              i += match[0].length;
              continue;
            }
          }
          
          // Found operator at top level - split here
          if (currentPart.trim()) {
            parts.push(currentPart.trim());
          }
          currentPart = '';
          i += match[0].length;
        } else {
          currentPart += char;
          i++;
        }
      } else {
        currentPart += char;
        i++;
      }
    }
    
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }
    
    return parts.length > 0 ? parts : [line];
  }

  /**
   * Parse atomic filter (non-boolean filter)
   */
  private parseAtomicFilter(line: string): FilterNode {
    // Normalize aliases again for the atomic filter part
    // (they may have been introduced by splitting)
    const trimmed = this.normalizeOperatorAliases(line.trim());
    
    // Handle simple keywords
    if (trimmed === 'done') {
      return { type: 'done', operator: 'is', value: true };
    }
    if (trimmed === 'not done') {
      return { type: 'done', operator: 'is', value: false };
    }
    
    // Check for "between" date filters
    const betweenMatch = trimmed.match(/^(due|scheduled|start|created|done|cancelled)\s+between\s+/i);
    if (betweenMatch) {
      const dateFilter = this.parseDateFilter(trimmed);
      if (dateFilter) {
        return dateFilter;
      }
    }

    // Status filters
    if (trimmed.startsWith('status.type is ')) {
      const typeStr = trimmed.substring('status.type is '.length).trim();
      const statusType = this.parseStatusType(typeStr);
      return { type: 'status', operator: 'type-is', value: statusType };
    }
    if (trimmed.startsWith('status.name includes ')) {
      const name = trimmed.substring('status.name includes '.length).trim();
      return { type: 'status', operator: 'name-includes', value: this.unquote(name) };
    }
    if (trimmed.startsWith('status.symbol is ')) {
      const symbol = trimmed.substring('status.symbol is '.length).trim();
      return { type: 'status', operator: 'symbol-is', value: this.unquote(symbol) };
    }

    // Date filters
    const dateFilterMatch = this.parseDateFilter(trimmed);
    if (dateFilterMatch) {
      return dateFilterMatch;
    }

    const priorityFilter = this.parsePriorityFilter(trimmed);
    if (priorityFilter) {
      return priorityFilter;
    }

    // Urgency filters
    if (trimmed.startsWith('urgency is ')) {
      const value = trimmed.substring('urgency is '.length).trim();
      return { type: 'urgency', operator: 'is', value: this.parseNumericValue(value, 'urgency') };
    }
    if (trimmed.startsWith('urgency above ')) {
      const value = trimmed.substring('urgency above '.length).trim();
      return { type: 'urgency', operator: 'above', value: this.parseNumericValue(value, 'urgency') };
    }
    if (trimmed.startsWith('urgency below ')) {
      const value = trimmed.substring('urgency below '.length).trim();
      return { type: 'urgency', operator: 'below', value: this.parseNumericValue(value, 'urgency') };
    }

    const escalationFilterMatch = this.parseEscalationFilter(trimmed);
    if (escalationFilterMatch) {
      return escalationFilterMatch;
    }

    const attentionFilterMatch = this.parseAttentionFilter(trimmed);
    if (attentionFilterMatch) {
      return attentionFilterMatch;
    }

    const laneFilterMatch = this.parseAttentionLaneFilter(trimmed);
    if (laneFilterMatch) {
      return laneFilterMatch;
    }

    // Tag filters
    if (trimmed.startsWith('tag includes ')) {
      const tag = trimmed.substring('tag includes '.length).trim();
      return { type: 'tag', operator: 'includes', value: this.unquote(tag) };
    }
    if (trimmed.startsWith('tag does not include ')) {
      const tag = trimmed.substring('tag does not include '.length).trim();
      return { type: 'tag', operator: 'includes', value: this.unquote(tag), negate: true };
    }
    if (trimmed.startsWith('tags include ')) {
      const tag = trimmed.substring('tags include '.length).trim();
      return { type: 'tag', operator: 'includes', value: this.unquote(tag) };
    }
    if (trimmed === 'has tags') {
      return { type: 'tag', operator: 'has', value: true };
    }
    if (trimmed === 'no tags') {
      return { type: 'tag', operator: 'has', value: false };
    }

    // Tag regex filters
    if (trimmed.startsWith('tag regex ') || trimmed.startsWith('tags regex ')) {
      const patternStr = trimmed.startsWith('tag regex ') 
        ? trimmed.substring('tag regex '.length).trim()
        : trimmed.substring('tags regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'tag-regex', operator: 'regex', value: regexSpec };
    }
    if (trimmed.startsWith('not tag regex ') || trimmed.startsWith('not tags regex ')) {
      const patternStr = trimmed.startsWith('not tag regex ')
        ? trimmed.substring('not tag regex '.length).trim()
        : trimmed.substring('not tags regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'tag-regex', operator: 'regex', value: regexSpec, negate: true };
    }

    // Path filters
    if (trimmed.startsWith('path includes ')) {
      const pattern = trimmed.substring('path includes '.length).trim();
      return { type: 'path', operator: 'includes', value: this.unquote(pattern) };
    }
    if (trimmed.startsWith('path does not include ')) {
      const pattern = trimmed.substring('path does not include '.length).trim();
      return { type: 'path', operator: 'includes', value: this.unquote(pattern), negate: true };
    }

    // Path regex filters
    if (trimmed.startsWith('path regex ')) {
      const patternStr = trimmed.substring('path regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'path-regex', operator: 'regex', value: regexSpec };
    }
    if (trimmed.startsWith('not path regex ')) {
      const patternStr = trimmed.substring('not path regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'path-regex', operator: 'regex', value: regexSpec, negate: true };
    }

    // Dependency filters
    if (trimmed === 'is blocked') {
      return { type: 'dependency', operator: 'is-blocked', value: true };
    }
    if (trimmed === 'is not blocked') {
      return { type: 'dependency', operator: 'is-blocked', value: false };
    }
    if (trimmed === 'is blocking') {
      return { type: 'dependency', operator: 'is-blocking', value: true };
    }

    // Recurrence filters
    if (trimmed === 'is recurring') {
      return { type: 'recurrence', operator: 'is', value: true };
    }
    if (trimmed === 'is not recurring') {
      return { type: 'recurrence', operator: 'is', value: false };
    }

    // Description filters
    if (trimmed.startsWith('description includes ')) {
      const pattern = trimmed.substring('description includes '.length).trim();
      return { type: 'description', operator: 'includes', value: this.unquote(pattern) };
    }
    if (trimmed.startsWith('description does not include ')) {
      const pattern = trimmed.substring('description does not include '.length).trim();
      return { type: 'description', operator: 'does not include', value: this.unquote(pattern) };
    }
    // Description regex filter (new format with regex literals)
    if (trimmed.startsWith('description regex ')) {
      const patternStr = trimmed.substring('description regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'description-regex', operator: 'regex', value: regexSpec };
    }
    if (trimmed.startsWith('not description regex ')) {
      const patternStr = trimmed.substring('not description regex '.length).trim();
      const regexSpec = this.parseRegexPattern(patternStr);
      return { type: 'description-regex', operator: 'regex', value: regexSpec, negate: true };
    }

    // Heading filters
    if (trimmed.startsWith('heading includes ')) {
      const pattern = trimmed.substring('heading includes '.length).trim();
      return { type: 'heading', operator: 'includes', value: this.unquote(pattern) };
    }
    if (trimmed.startsWith('heading does not include ')) {
      const pattern = trimmed.substring('heading does not include '.length).trim();
      return { type: 'heading', operator: 'does not include', value: this.unquote(pattern) };
    }

    // If we can't parse it, throw error
    throw new QuerySyntaxError(
      `Unknown filter instruction: "${trimmed}"`,
      this.line,
      this.column,
      'Check the query syntax documentation for valid filter instructions'
    );
  }

  /**
   * Parse regex pattern from a string
   * Supports both regex literal format /pattern/flags and string format
   */
  private parseRegexPattern(patternStr: string): RegexSpec {
    // Try to parse as regex literal first
    const regexSpec = RegexMatcher.parseRegexLiteral(patternStr);
    if (regexSpec) {
      // Validate at parse time
      const patternValidation = RegexMatcher.validatePattern(regexSpec.pattern);
      if (!patternValidation.valid) {
        throw new QuerySyntaxError(
          `Invalid regex pattern: ${patternValidation.error}`,
          this.line,
          this.column,
          'Check your regex syntax'
        );
      }
      
      const flagsValidation = RegexMatcher.validateFlags(regexSpec.flags || '');
      if (!flagsValidation.valid) {
        throw new QuerySyntaxError(
          `Invalid regex flags: ${flagsValidation.error}`,
          this.line,
          this.column,
          'Only i, m, s, u flags are supported'
        );
      }
      
      return regexSpec;
    }
    
    // If not a regex literal, treat as plain string pattern (backward compatibility)
    // Remove quotes if present
    const pattern = this.unquote(patternStr);
    
    // Validate the pattern
    const validation = RegexMatcher.validatePattern(pattern);
    if (!validation.valid) {
      throw new QuerySyntaxError(
        `Invalid regex pattern: ${validation.error}`,
        this.line,
        this.column,
        'Check your regex syntax'
      );
    }
    
    return { pattern, flags: '' };
  }

  private parseEscalationFilter(line: string): FilterNode | null {
    const normalized = line.trim();
    if (!normalized.toLowerCase().startsWith("escalation")) {
      return null;
    }

    const comparisonMatch = normalized.match(/^escalation\s*(>=|<=|>|<|=)\s*(.+)$/i);
    if (comparisonMatch) {
      const operatorMap: Record<string, string> = {
        ">": "above",
        "<": "below",
        ">=": "at-least",
        "<=": "at-most",
        "=": "is",
      };
      const operator = operatorMap[comparisonMatch[1]] ?? "is";
      const level = this.parseEscalationLevel(comparisonMatch[2]);
      return { type: "escalation", operator, value: level };
    }

    const namedMatch = normalized.match(/^escalation\s+(is|above|below|at\s+least|at\s+most)\s+(.+)$/i);
    if (namedMatch) {
      const rawOperator = namedMatch[1].toLowerCase();
      const operator =
        rawOperator === "at least"
          ? "at-least"
          : rawOperator === "at most"
          ? "at-most"
          : rawOperator;
      const level = this.parseEscalationLevel(namedMatch[2]);
      return { type: "escalation", operator, value: level };
    }

    return null;
  }

  private parsePriorityFilter(line: string): FilterNode | null {
    const normalized = line.trim();
    if (!normalized.toLowerCase().startsWith("priority")) {
      return null;
    }

    const comparisonMatch = normalized.match(/^priority\s*(>=|<=|>|<|=)\s*(.+)$/i);
    if (comparisonMatch) {
      const operatorMap: Record<string, string> = {
        ">": "above",
        "<": "below",
        ">=": "at-least",
        "<=": "at-most",
        "=": "is",
      };
      const operator = operatorMap[comparisonMatch[1]] ?? "is";
      return { type: "priority", operator, value: this.unquote(comparisonMatch[2].trim()) as PriorityLevel };
    }

    const namedMatch = normalized.match(/^priority\s+(is|above|below|at\s+least|at\s+most)\s+(.+)$/i);
    if (namedMatch) {
      const rawOperator = namedMatch[1].toLowerCase();
      const operator =
        rawOperator === "at least"
          ? "at-least"
          : rawOperator === "at most"
          ? "at-most"
          : rawOperator;
      return { type: "priority", operator, value: this.unquote(namedMatch[2].trim()) as PriorityLevel };
    }

    return null;
  }

  private parseAttentionFilter(line: string): FilterNode | null {
    const normalized = line.trim();
    if (!normalized.toLowerCase().startsWith("attention")) {
      return null;
    }

    const comparisonMatch = normalized.match(/^attention\s*(>=|<=|>|<|=)\s*(\d+)$/i);
    if (comparisonMatch) {
      const operatorMap: Record<string, string> = {
        ">": "above",
        "<": "below",
        ">=": "at-least",
        "<=": "at-most",
        "=": "is",
      };
      const operator = operatorMap[comparisonMatch[1]] ?? "is";
      return { type: "attention", operator, value: this.parseNumericValue(comparisonMatch[2], "attention") };
    }

    const namedMatch = normalized.match(/^attention\s+(is|above|below|at\s+least|at\s+most)\s+(\d+)$/i);
    if (namedMatch) {
      const rawOperator = namedMatch[1].toLowerCase();
      const operator =
        rawOperator === "at least"
          ? "at-least"
          : rawOperator === "at most"
          ? "at-most"
          : rawOperator;
      return { type: "attention", operator, value: this.parseNumericValue(namedMatch[2], "attention") };
    }

    return null;
  }

  private parseAttentionLaneFilter(line: string): FilterNode | null {
    const normalized = line.trim();
    const match = normalized.match(/^lane\s+is\s+(.+)$/i);
    if (!match) {
      return null;
    }
    const lane = match[1].trim().toUpperCase().replace(/\s+/g, "_");
    const allowed = new Set(["DO_NOW", "UNBLOCK_FIRST", "BLOCKED", "WATCHLIST"]);
    if (!allowed.has(lane)) {
      throw new QuerySyntaxError(
        `Invalid lane value: "${match[1].trim()}"`,
        this.line,
        this.column,
        "Valid lanes: DO_NOW, UNBLOCK_FIRST, BLOCKED, WATCHLIST"
      );
    }
    return { type: "attention-lane", operator: "is", value: lane };
  }

  private parseEscalationLevel(value: string): number {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, "-");
    switch (normalized) {
      case "on-time":
      case "ontime":
        return 0;
      case "warning":
        return 1;
      case "critical":
        return 2;
      case "severe":
        return 3;
      default:
        throw new QuerySyntaxError(
          `Invalid escalation level: "${value}"`,
          this.line,
          this.column,
          'Valid levels: on-time, warning, critical, severe'
        );
    }
  }

}
