/**
 * AdvancedQuery - Complex query parsing with grouping, sorting, and dependency operators
 * Phase 4: Dependencies + Advanced Query
 * 
 * Supports queries like:
 * - not done AND (is blocked OR tag includes #urgent)
 * - due before today sort by priority desc
 * - tag includes #work group by status
 */

import type { Task } from '../models/Task';
import { isTaskCompleted, isTaskOverdue } from '../models/Task';
import { DependencyGraph } from '../dependencies/DependencyGraph';

/**
 * Query token types
 */
export type TokenType =
  | 'IDENTIFIER'  // field names, values
  | 'OPERATOR'    // is, includes, before, after, etc.
  | 'LOGICAL'     // AND, OR, NOT
  | 'LPAREN'      // (
  | 'RPAREN'      // )
  | 'STRING'      // "quoted string" or 'quoted'
  | 'DATE'        // date literal
  | 'TAG'         // #tag
  | 'KEYWORD'     // sort, group, by, asc, desc
  | 'EOF';

/**
 * Token
 */
export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

/**
 * Query AST node types
 */
export type QueryNode =
  | ComparisonNode
  | LogicalNode
  | NotNode
  | FieldNode
  | ValueNode;

export interface ComparisonNode {
  type: 'comparison';
  field: string;
  operator: string;
  value: string | string[];
}

export interface LogicalNode {
  type: 'logical';
  operator: 'AND' | 'OR';
  left: QueryNode;
  right: QueryNode;
}

export interface NotNode {
  type: 'not';
  operand: QueryNode;
}

export interface FieldNode {
  type: 'field';
  name: string;
}

export interface ValueNode {
  type: 'value';
  value: string | string[];
}

/**
 * Sort configuration
 */
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Group configuration
 */
export interface GroupConfig {
  field: string;
}

/**
 * Parsed query
 */
export interface ParsedQuery {
  filter?: QueryNode;
  sort?: SortConfig[];
  group?: GroupConfig;
}

/**
 * Query parser
 */
export class QueryParser {
  private tokens: Token[] = [];
  private currentIndex: number = 0;
  
  /**
   * Parse query string into AST
   */
  parse(queryString: string): ParsedQuery {
    this.tokens = this.tokenize(queryString);
    this.currentIndex = 0;
    
    const result: ParsedQuery = {};
    
    // Parse filter expression
    if (this.currentIndex < this.tokens.length) {
      const filterNode = this.parseExpression();
      if (filterNode) {
        result.filter = filterNode;
      }
    }
    
    // Parse sort clause
    if (this.match('KEYWORD', 'sort')) {
      result.sort = this.parseSortClause();
    }
    
    // Parse group clause
    if (this.match('KEYWORD', 'group')) {
      result.group = this.parseGroupClause();
    }
    
    return result;
  }
  
  /**
   * Tokenize query string
   */
  private tokenize(query: string): Token[] {
    const tokens: Token[] = [];
    let position = 0;
    
    // Keywords and operators
    const keywords = ['sort', 'group', 'by', 'asc', 'desc'];
    const logicals = ['AND', 'OR', 'NOT'];
    const operators = [
      'is', 'is not', 'includes', 'not includes', 
      'before', 'after', 'matches', 'not matches',
      'in', 'not in'
    ];
    
    while (position < query.length) {
      const char = query[position]!;
      
      // Skip whitespace
      if (/\s/.test(char)) {
        position++;
        continue;
      }
      
      // Parentheses
      if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(', position });
        position++;
        continue;
      }
      
      if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')', position });
        position++;
        continue;
      }
      
      // Tags (#tag)
      if (char === '#') {
        let value = '#';
        position++;
        while (position < query.length && /[a-zA-Z0-9_\/-]/.test(query[position]!)) {
          value += query[position]!;
          position++;
        }
        tokens.push({ type: 'TAG', value, position });
        continue;
      }
      
      // Quoted strings
      if (char === '"' || char === "'") {
        const quote = char;
        let value = '';
        position++;
        while (position < query.length && query[position]! !== quote) {
          value += query[position]!;
          position++;
        }
        position++; // Skip closing quote
        tokens.push({ type: 'STRING', value, position });
        continue;
      }
      
      // Identifiers, keywords, operators
      if (/[a-zA-Z]/.test(char)) {
        let value = '';
        const startPos = position;
        while (position < query.length && /[a-zA-Z0-9_.]/.test(query[position]!)) {
          value += query[position]!;
          position++;
        }
        
        // Check for multi-word operators (e.g., "is not")
        const nextToken = query.substring(position).trim().split(/\s+/)[0]!;
        const combined = `${value} ${nextToken}`;
        
        if (operators.includes(combined.toLowerCase())) {
          tokens.push({ type: 'OPERATOR', value: combined.toLowerCase(), position: startPos });
          position += nextToken.length + 1; // Skip the next word
          continue;
        }
        
        // Check token type
        if (logicals.includes(value.toUpperCase())) {
          tokens.push({ type: 'LOGICAL', value: value.toUpperCase(), position: startPos });
        } else if (keywords.includes(value.toLowerCase())) {
          tokens.push({ type: 'KEYWORD', value: value.toLowerCase(), position: startPos });
        } else if (operators.includes(value.toLowerCase())) {
          tokens.push({ type: 'OPERATOR', value: value.toLowerCase(), position: startPos });
        } else {
          tokens.push({ type: 'IDENTIFIER', value, position: startPos });
        }
        continue;
      }
      
      // Dates (YYYY-MM-DD)
      if (/\d/.test(char)) {
        let value = '';
        const startPos = position;
        while (position < query.length && /[0-9-]/.test(query[position]!)) {
          value += query[position]!;
          position++;
        }
        
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          tokens.push({ type: 'DATE', value, position: startPos });
        } else {
          tokens.push({ type: 'IDENTIFIER', value, position: startPos });
        }
        continue;
      }
      
      // Unknown character - skip
      position++;
    }
    
    tokens.push({ type: 'EOF', value: '', position });
    return tokens;
  }
  
  /**
   * Parse expression (handles AND, OR, NOT)
   */
  private parseExpression(): QueryNode | null {
    return this.parseOrExpression();
  }
  
  /**
   * Parse OR expression
   */
  private parseOrExpression(): QueryNode | null {
    let left = this.parseAndExpression();
    
    while (this.match('LOGICAL', 'OR')) {
      this.advance();
      const right = this.parseAndExpression();
      if (!right) break;
      
      left = {
        type: 'logical',
        operator: 'OR',
        left: left!,
        right,
      };
    }
    
    return left;
  }
  
  /**
   * Parse AND expression
   */
  private parseAndExpression(): QueryNode | null {
    let left = this.parseNotExpression();
    
    while (this.match('LOGICAL', 'AND')) {
      this.advance();
      const right = this.parseNotExpression();
      if (!right) break;
      
      left = {
        type: 'logical',
        operator: 'AND',
        left: left!,
        right,
      };
    }
    
    return left;
  }
  
  /**
   * Parse NOT expression
   */
  private parseNotExpression(): QueryNode | null {
    if (this.match('LOGICAL', 'NOT')) {
      this.advance();
      const operand = this.parsePrimaryExpression();
      if (!operand) return null;
      
      return {
        type: 'not',
        operand,
      };
    }
    
    return this.parsePrimaryExpression();
  }
  
  /**
   * Parse primary expression (comparisons, parentheses)
   */
  private parsePrimaryExpression(): QueryNode | null {
    // Parentheses
    if (this.match('LPAREN')) {
      this.advance();
      const expr = this.parseExpression();
      if (this.match('RPAREN')) {
        this.advance();
      }
      return expr;
    }
    
    // Comparison
    return this.parseComparison();
  }
  
  /**
   * Parse comparison (field operator value)
   */
  private parseComparison(): QueryNode | null {
    const current = this.current();
    
    // Field name
    let field = '';
    if (current.type === 'IDENTIFIER') {
      field = current.value;
      this.advance();
    } else {
      return null;
    }
    
    // Operator
    if (!this.match('OPERATOR')) {
      return null;
    }
    const operator = this.current().value;
    this.advance();
    
    // Value
    const valueToken = this.current();
    let value: string | string[];
    
    if (valueToken.type === 'STRING' || 
        valueToken.type === 'DATE' || 
        valueToken.type === 'TAG' || 
        valueToken.type === 'IDENTIFIER') {
      value = valueToken.value;
      this.advance();
    } else {
      return null;
    }
    
    return {
      type: 'comparison',
      field,
      operator,
      value,
    };
  }
  
  /**
   * Parse sort clause
   */
  private parseSortClause(): SortConfig[] {
    const sorts: SortConfig[] = [];
    
    // Expect "by"
    if (!this.match('KEYWORD', 'by')) {
      return sorts;
    }
    this.advance();
    
    // Parse sort fields
    while (this.current().type === 'IDENTIFIER') {
      const field = this.current().value;
      this.advance();
      
      let direction: 'asc' | 'desc' = 'asc';
      if (this.match('KEYWORD', 'asc') || this.match('KEYWORD', 'desc')) {
        direction = this.current().value as 'asc' | 'desc';
        this.advance();
      }
      
      sorts.push({ field, direction });
      
      // Check for comma (multiple sort fields)
      if (this.match('IDENTIFIER', ',')) {
        this.advance();
      } else {
        break;
      }
    }
    
    return sorts;
  }
  
  /**
   * Parse group clause
   */
  private parseGroupClause(): GroupConfig | undefined {
    // Expect "by"
    if (!this.match('KEYWORD', 'by')) {
      return undefined;
    }
    this.advance();
    
    // Parse group field
    if (this.current().type === 'IDENTIFIER') {
      const field = this.current().value;
      this.advance();
      return { field };
    }
    
    return undefined;
  }
  
  /**
   * Check if current token matches
   */
  private match(type: TokenType, value?: string): boolean {
    const current = this.current();
    if (current.type !== type) return false;
    if (value !== undefined && current.value !== value) return false;
    return true;
  }
  
  /**
   * Get current token
   */
  private current(): Token {
    return this.tokens[this.currentIndex] || { type: 'EOF', value: '', position: 0 };
  }
  
  /**
   * Advance to next token
   */
  private advance(): void {
    this.currentIndex++;
  }
}

/**
 * Query executor
 */
export class QueryExecutor {
  private tasks: Task[];
  private dependencyGraph: DependencyGraph;
  
  constructor(tasks: Task[], dependencyGraph: DependencyGraph) {
    this.tasks = tasks;
    this.dependencyGraph = dependencyGraph;
  }
  
  /**
   * Execute parsed query
   */
  execute(parsedQuery: ParsedQuery): Task[] {
    let results = [...this.tasks];
    
    // Apply filter
    if (parsedQuery.filter) {
      results = results.filter(task => this.evaluateNode(parsedQuery.filter!, task));
    }
    
    // Apply sort
    if (parsedQuery.sort && parsedQuery.sort.length > 0) {
      results = this.sortTasks(results, parsedQuery.sort);
    }
    
    // Group is handled separately (returns grouped structure)
    
    return results;
  }
  
  /**
   * Execute query and return grouped results
   */
  executeGrouped(parsedQuery: ParsedQuery): Map<string, Task[]> {
    const filtered = this.execute(parsedQuery);
    
    if (!parsedQuery.group) {
      return new Map([['all', filtered]]);
    }
    
    return this.groupTasks(filtered, parsedQuery.group.field);
  }
  
  /**
   * Evaluate AST node against task
   */
  private evaluateNode(node: QueryNode, task: Task): boolean {
    switch (node.type) {
      case 'comparison':
        return this.evaluateComparison(node, task);
      
      case 'logical':
        if (node.operator === 'AND') {
          return this.evaluateNode(node.left, task) && this.evaluateNode(node.right, task);
        } else {
          return this.evaluateNode(node.left, task) || this.evaluateNode(node.right, task);
        }
      
      case 'not':
        return !this.evaluateNode(node.operand, task);
      
      default:
        return false;
    }
  }
  
  /**
   * Evaluate comparison node
   */
  private evaluateComparison(node: ComparisonNode, task: Task): boolean {
    const { field, operator, value } = node;
    
    // Special query shortcuts
    if (field === 'done') {
      return task.status === 'done';
    }
    if (field === 'not' && value === 'done') {
      return task.status !== 'done';
    }
    if (field === 'has' && value === 'due date') {
      return !!task.dueAt;
    }
    if (field === 'no' && value === 'due date') {
      return !task.dueAt;
    }
    if (field === 'has' && value === 'recurrence') {
      return !!(task.frequency || task.recurrenceText);
    }
    if (field === 'is' && value === 'blocked') {
      return this.dependencyGraph.isTaskBlocked(task.taskId || task.id);
    }
    if (field === 'is' && value === 'not blocked') {
      return !this.dependencyGraph.isTaskBlocked(task.taskId || task.id);
    }
    if (field === 'is' && value === 'blocking') {
      return this.dependencyGraph.isTaskBlocking(task.taskId || task.id);
    }
    if (field === 'depends' && operator === 'on') {
      return task.dependsOn?.includes(String(value)) || false;
    }
    if (field === 'blocks') {
      const dependents = this.dependencyGraph.getDependents(task.taskId || task.id, true);
      return dependents.has(String(value));
    }
    
    // Field-based comparisons
    const fieldValue = this.getFieldValue(task, field);
    
    switch (operator) {
      case 'is':
        return this.compareEqual(fieldValue, value);
      
      case 'is not':
        return !this.compareEqual(fieldValue, value);
      
      case 'includes':
        return this.compareIncludes(fieldValue, value);
      
      case 'not includes':
        return !this.compareIncludes(fieldValue, value);
      
      case 'before':
        return this.compareBefore(fieldValue, value);
      
      case 'after':
        return this.compareAfter(fieldValue, value);
      
      case 'matches':
        return this.compareMatches(fieldValue, value);
      
      case 'not matches':
        return !this.compareMatches(fieldValue, value);
      
      default:
        return false;
    }
  }
  
  /**
   * Get field value from task
   */
  private getFieldValue(task: Task, field: string): any {
    // Nested field access (e.g., status.type)
    if (field.includes('.')) {
      const parts = field.split('.');
      let value: any = task;
      for (const part of parts) {
        value = value?.[part];
      }
      return value;
    }
    
    // Direct field access
    switch (field) {
      case 'status':
        return task.status;
      case 'priority':
        return task.priority || 'none';
      case 'due':
        return task.dueAt;
      case 'scheduled':
        return task.scheduledAt;
      case 'start':
        return task.startAt;
      case 'tag':
      case 'tags':
        return task.tags || [];
      case 'path':
        return task.path || '';
      case 'description':
        return task.name;
      default:
        return (task as any)[field];
    }
  }
  
  /**
   * Compare equality
   */
  private compareEqual(fieldValue: any, value: any): boolean {
    if (Array.isArray(fieldValue)) {
      return fieldValue.includes(value);
    }
    return String(fieldValue).toLowerCase() === String(value).toLowerCase();
  }
  
  /**
   * Compare includes
   */
  private compareIncludes(fieldValue: any, value: any): boolean {
    if (Array.isArray(fieldValue)) {
      return fieldValue.some(v => String(v).includes(String(value)));
    }
    return String(fieldValue).includes(String(value));
  }
  
  /**
   * Compare before (dates)
   */
  private compareBefore(fieldValue: any, value: any): boolean {
    if (!fieldValue) return false;
    
    // Handle "today"
    let compareDate = value;
    if (value === 'today') {
      compareDate = new Date().toISOString().split('T')[0];
    }
    
    return new Date(fieldValue) < new Date(compareDate);
  }
  
  /**
   * Compare after (dates)
   */
  private compareAfter(fieldValue: any, value: any): boolean {
    if (!fieldValue) return false;
    
    // Handle "today"
    let compareDate = value;
    if (value === 'today') {
      compareDate = new Date().toISOString().split('T')[0];
    }
    
    return new Date(fieldValue) > new Date(compareDate);
  }
  
  /**
   * Compare matches (regex)
   */
  private compareMatches(fieldValue: any, pattern: any): boolean {
    try {
      const regex = new RegExp(String(pattern), 'i');
      return regex.test(String(fieldValue));
    } catch {
      return false;
    }
  }
  
  /**
   * Sort tasks
   */
  private sortTasks(tasks: Task[], sortConfigs: SortConfig[]): Task[] {
    return tasks.sort((a, b) => {
      for (const { field, direction } of sortConfigs) {
        const aValue = this.getFieldValue(a, field);
        const bValue = this.getFieldValue(b, field);
        
        let comparison = 0;
        
        // Handle null/undefined
        if (aValue == null && bValue == null) continue;
        if (aValue == null) return direction === 'asc' ? 1 : -1;
        if (bValue == null) return direction === 'asc' ? -1 : 1;
        
        // Date comparison
        if (field === 'due' || field === 'scheduled' || field === 'start') {
          comparison = new Date(aValue).getTime() - new Date(bValue).getTime();
        }
        // Priority comparison
        else if (field === 'priority') {
          const priorityWeights: Record<string, number> = {
            highest: 1, high: 2, medium: 3, none: 4, low: 5, lowest: 6
          };
          comparison = (priorityWeights[aValue] || 4) - (priorityWeights[bValue] || 4);
        }
        // String comparison
        else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        
        if (comparison !== 0) {
          return direction === 'asc' ? comparison : -comparison;
        }
      }
      
      return 0;
    });
  }
  
  /**
   * Group tasks by field
   */
  private groupTasks(tasks: Task[], field: string): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();
    
    for (const task of tasks) {
      const value = this.getFieldValue(task, field);
      let groupKey: string;
      
      if (Array.isArray(value)) {
        // For arrays (like tags), add to multiple groups
        if (value.length === 0) {
          groupKey = '(none)';
        } else {
          for (const v of value) {
            groupKey = String(v);
            if (!groups.has(groupKey)) {
              groups.set(groupKey, []);
            }
            groups.get(groupKey)!.push(task);
          }
          continue;
        }
      } else {
        groupKey = value ? String(value) : '(none)';
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(task);
    }
    
    return groups;
  }
}

/**
 * Convenience function to parse and execute query
 */
export function executeQuery(
  queryString: string,
  tasks: Task[],
  dependencyGraph: DependencyGraph
): Task[] {
  const parser = new QueryParser();
  const parsedQuery = parser.parse(queryString);
  
  const executor = new QueryExecutor(tasks, dependencyGraph);
  return executor.execute(parsedQuery);
}

/**
 * Parse and execute query with grouping
 */
export function executeGroupedQuery(
  queryString: string,
  tasks: Task[],
  dependencyGraph: DependencyGraph
): Map<string, Task[]> {
  const parser = new QueryParser();
  const parsedQuery = parser.parse(queryString);
  
  const executor = new QueryExecutor(tasks, dependencyGraph);
  return executor.executeGrouped(parsedQuery);
}
