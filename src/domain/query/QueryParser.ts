/**
 * Basic Query Parser and Executor
 * Phase 1: Simple filters and operators
 * 
 * Supported queries:
 * - not done
 * - done
 * - due before today
 * - due after 2026-02-10
 * - status is todo
 * - tag includes work
 * - path includes daily
 * 
 * Boolean operators: AND, OR, NOT
 */

import type { Task } from '../../domain/models/Task';
import { TaskIndex } from '../../domain/index/TaskIndex';
import { isTaskCompleted, isTaskOverdue } from '../../domain/models/Task';

/**
 * Query token types
 */
export enum QueryTokenType {
  KEYWORD = 'KEYWORD',           // not, done, due, status, tag, path
  OPERATOR = 'OPERATOR',         // is, includes, before, after
  BOOLEAN = 'BOOLEAN',           // AND, OR, NOT
  VALUE = 'VALUE',               // today, 2026-02-10, todo, work
  STRING = 'STRING',             // "quoted value"
}

/**
 * Query token
 */
export interface QueryToken {
  type: QueryTokenType;
  value: string;
  position: number;
}

/**
 * Query filter function
 */
export type FilterFunction = (task: Task) => boolean;

/**
 * Query filter registry
 */
export class QueryFilters {
  /**
   * Get filter for "not done" query
   */
  static notDone(): FilterFunction {
    return (task: Task) => task.status !== 'done';
  }
  
  /**
   * Get filter for "done" query
   */
  static done(): FilterFunction {
    return (task: Task) => task.status === 'done';
  }
  
  /**
   * Get filter for "cancelled" query
   */
  static cancelled(): FilterFunction {
    return (task: Task) => task.status === 'cancelled';
  }
  
  /**
   * Get filter for "status is X" query
   */
  static statusIs(status: string): FilterFunction {
    return (task: Task) => task.status === status;
  }
  
  /**
   * Get filter for "due before X" query
   */
  static dueBefore(date: string): FilterFunction {
    const targetDate = this.parseDate(date);
    
    return (task: Task) => {
      if (!task.dueAt) return false;
      return task.dueAt < targetDate;
    };
  }
  
  /**
   * Get filter for "due after X" query
   */
  static dueAfter(date: string): FilterFunction {
    const targetDate = this.parseDate(date);
    
    return (task: Task) => {
      if (!task.dueAt) return false;
      return task.dueAt > targetDate;
    };
  }
  
  /**
   * Get filter for "due on X" query
   */
  static dueOn(date: string): FilterFunction {
    const targetDate = this.parseDate(date).split('T')[0]; // Date only
    
    return (task: Task) => {
      if (!task.dueAt) return false;
      const taskDate = task.dueAt.split('T')[0];
      return taskDate === targetDate;
    };
  }
  
  /**
   * Get filter for "scheduled before X" query
   */
  static scheduledBefore(date: string): FilterFunction {
    const targetDate = this.parseDate(date);
    
    return (task: Task) => {
      if (!task.scheduledAt) return false;
      return task.scheduledAt < targetDate;
    };
  }
  
  /**
   * Get filter for "scheduled after X" query
   */
  static scheduledAfter(date: string): FilterFunction {
    const targetDate = this.parseDate(date);
    
    return (task: Task) => {
      if (!task.scheduledAt) return false;
      return task.scheduledAt > targetDate;
    };
  }
  
  /**
   * Get filter for "tag includes X" query
   */
  static tagIncludes(tag: string): FilterFunction {
    return (task: Task) => {
      if (!task.tags) return false;
      return task.tags.includes(tag);
    };
  }
  
  /**
   * Get filter for "path includes X" query
   */
  static pathIncludes(pathSegment: string): FilterFunction {
    return (task: Task) => {
      if (!task.path) return false;
      return task.path.includes(pathSegment);
    };
  }
  
  /**
   * Get filter for "priority is X" query
   */
  static priorityIs(priority: string): FilterFunction {
    return (task: Task) => task.priority === priority;
  }
  
  /**
   * Get filter for "overdue" query
   */
  static overdue(): FilterFunction {
    return (task: Task) => isTaskOverdue(task);
  }
  
  /**
   * Get filter for "recurring" query
   */
  static recurring(): FilterFunction {
    return (task: Task) => !!(task.frequency || task.recurrenceText);
  }
  
  /**
   * Get filter for "blocked" query (has incomplete dependencies)
   */
  static blocked(allTasks: Map<string, Task>): FilterFunction {
    return (task: Task) => {
      if (!task.dependsOn || task.dependsOn.length === 0) return false;
      
      return task.dependsOn.some(depId => {
        const depTask = allTasks.get(depId);
        return depTask && !isTaskCompleted(depTask);
      });
    };
  }
  
  /**
   * Parse date with special keywords
   */
  private static parseDate(dateStr: string): string {
    const lower = dateStr.toLowerCase().trim();
    const now = new Date();
    
    switch (lower) {
      case 'today':
        return now.toISOString();
        
      case 'tomorrow': {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString();
      }
      
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString();
      }
      
      case 'thisweek': {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return weekStart.toISOString();
      }
      
      case 'nextweek': {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek.toISOString();
      }
      
      default:
        // Assume ISO date
        return dateStr;
    }
  }
}

/**
 * Simple query parser
 */
export class QueryParser {
  /**
   * Parse query string into filter function
   * Phase 1: Support basic queries only
   */
  static parse(query: string, index?: TaskIndex): FilterFunction {
    const normalized = query.toLowerCase().trim();
    
    // Handle empty query (return all)
    if (!normalized) {
      return () => true;
    }
    
    // Single-word queries
    if (normalized === 'done') {
      return QueryFilters.done();
    }
    
    if (normalized === 'cancelled') {
      return QueryFilters.cancelled();
    }
    
    if (normalized === 'overdue') {
      return QueryFilters.overdue();
    }
    
    if (normalized === 'recurring') {
      return QueryFilters.recurring();
    }
    
    // "not done" query
    if (normalized === 'not done') {
      return QueryFilters.notDone();
    }
    
    // "status is X" query
    const statusMatch = normalized.match(/^status\s+is\s+(\w+)$/);
    if (statusMatch) {
      return QueryFilters.statusIs(statusMatch[1]!);
    }
    
    // "due before X" query
    const dueBeforeMatch = normalized.match(/^due\s+before\s+(.+)$/);
    if (dueBeforeMatch) {
      return QueryFilters.dueBefore(dueBeforeMatch[1]!);
    }
    
    // "due after X" query
    const dueAfterMatch = normalized.match(/^due\s+after\s+(.+)$/);
    if (dueAfterMatch) {
      return QueryFilters.dueAfter(dueAfterMatch[1]!);
    }
    
    // "due on X" query
    const dueOnMatch = normalized.match(/^due\s+on\s+(.+)$/);
    if (dueOnMatch) {
      return QueryFilters.dueOn(dueOnMatch[1]!);
    }
    
    // "scheduled before X" query
    const schedBeforeMatch = normalized.match(/^scheduled\s+before\s+(.+)$/);
    if (schedBeforeMatch) {
      return QueryFilters.scheduledBefore(schedBeforeMatch[1]!);
    }
    
    // "scheduled after X" query
    const schedAfterMatch = normalized.match(/^scheduled\s+after\s+(.+)$/);
    if (schedAfterMatch) {
      return QueryFilters.scheduledAfter(schedAfterMatch[1]!);
    }
    
    // "tag includes X" query
    const tagMatch = normalized.match(/^tag\s+includes\s+(.+)$/);
    if (tagMatch) {
      return QueryFilters.tagIncludes(tagMatch[1]!);
    }
    
    // "path includes X" query
    const pathMatch = normalized.match(/^path\s+includes\s+(.+)$/);
    if (pathMatch) {
      return QueryFilters.pathIncludes(pathMatch[1]!);
    }
    
    // "priority is X" query
    const priorityMatch = normalized.match(/^priority\s+is\s+(\w+)$/);
    if (priorityMatch) {
      return QueryFilters.priorityIs(priorityMatch[1]!);
    }
    
    // "blocked" query
    if (normalized === 'blocked' && index) {
      const allTasks = new Map(index.getAll().map(t => [t.id, t]));
      return QueryFilters.blocked(allTasks);
    }
    
    // Default: no match (return all)
    console.warn(`Query not recognized: ${query}`);
    return () => true;
  }
}

/**
 * Query executor - runs filter against task list
 */
export class QueryExecutor {
  private index: TaskIndex;
  
  constructor(index: TaskIndex) {
    this.index = index;
  }
  
  /**
   * Execute query and return matching tasks
   */
  execute(query: string): Task[] {
    const filter = QueryParser.parse(query, this.index);
    const allTasks = this.index.getAll();
    
    return allTasks.filter(filter);
  }
  
  /**
   * Execute query with sorting
   */
  executeWithSort(
    query: string, 
    sortBy: 'due' | 'priority' | 'created' | 'updated' | 'status' | 'name' = 'due',
    direction: 'asc' | 'desc' = 'asc'
  ): Task[] {
    const results = this.execute(query);
    
    return this.sortTasks(results, sortBy, direction);
  }
  
  /**
   * Sort tasks by field
   */
  private sortTasks(
    tasks: Task[], 
    sortBy: 'due' | 'priority' | 'created' | 'updated' | 'status' | 'name',
    direction: 'asc' | 'desc'
  ): Task[] {
    const sorted = [...tasks];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'due':
          comparison = (a.dueAt || '9999').localeCompare(b.dueAt || '9999');
          break;
          
        case 'priority': {
          const priorityOrder: Record<string, number> = {
            'highest': 1, 'high': 2, 'medium': 3, 'none': 4, 'low': 5, 'lowest': 6
          };
          const aPriority = priorityOrder[a.priority || 'none'] ?? 4;
          const bPriority = priorityOrder[b.priority || 'none'] ?? 4;
          comparison = aPriority - bPriority;
          break;
        }
        
        case 'created':
          comparison = a.createdAt.localeCompare(b.createdAt);
          break;
          
        case 'updated':
          comparison = a.updatedAt.localeCompare(b.updatedAt);
          break;
          
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
          
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }
}
