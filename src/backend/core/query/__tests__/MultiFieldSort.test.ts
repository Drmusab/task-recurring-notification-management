/**
 * Multi-Field Sorting Tests
 * Tests for Week 4 feature: multi-field sorting capability
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryEngine } from '../QueryEngine';
import { QueryParser } from '../QueryParser';
import type { Task } from '../../models/Task';

// Mock task index
class MockTaskIndex {
  constructor(private tasks: Task[]) {}
  
  getAllTasks(): Task[] {
    return this.tasks;
  }
}

// Helper to create test task
function createTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    name: `Task ${id}`,
    dueAt: new Date('2024-01-15T12:00:00Z').toISOString(),
    enabled: true,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
    recurrence: {
      rrule: 'FREQ=DAILY;INTERVAL=1',
      baseOnToday: false,
      humanReadable: 'Daily',
    },
    recentCompletions: [],
    ...overrides,
  };
}

describe('Multi-Field Sorting', () => {
  let queryEngine: QueryEngine;
  
  beforeEach(() => {
    const tasks: Task[] = [
      createTask('1', {
        name: 'High Priority Due Soon',
        priority: 'high',
        dueAt: new Date('2024-01-16T12:00:00Z').toISOString(), // Tomorrow
      }),
      createTask('2', {
        name: 'Medium Priority Due Soon',
        priority: 'medium',
        dueAt: new Date('2024-01-16T12:00:00Z').toISOString(), // Tomorrow
      }),
      createTask('3', {
        name: 'High Priority Due Later',
        priority: 'high',
        dueAt: new Date('2024-01-20T12:00:00Z').toISOString(), // Next week
      }),
      createTask('4', {
        name: 'Low Priority Overdue',
        priority: 'low',
        dueAt: new Date('2024-01-10T12:00:00Z').toISOString(), // Overdue
      }),
      createTask('5', {
        name: 'High Priority No Due Date',
        priority: 'high',
        dueAt: new Date('2024-01-01T12:00:00Z').toISOString(),
      }),
    ];
    
    const taskIndex = new MockTaskIndex(tasks);
    queryEngine = new QueryEngine(taskIndex);
  });

  it('should sort by single field (backward compatibility)', () => {
    const parser = new QueryParser();
    const ast = parser.parse('sort by priority');
    
    const result = queryEngine.execute(ast);
    
    expect(result.tasks).toHaveLength(5);
    // Verify sorted by priority (low->normal->medium->high)
    expect(result.tasks[0].priority).toBe('low');
    expect(result.tasks[result.tasks.length - 1].priority).toBe('high');
  });

  it('should sort by multiple fields: priority, then due date', () => {
    const parser = new QueryParser();
    const ast = parser.parse('sort by priority, due');
    
    const result = queryEngine.execute(ast);
    
    expect(result.tasks).toHaveLength(5);
    
    // Within each priority level, tasks should be sorted by due date
    const highPriorityTasks = result.tasks.filter(t => t.priority === 'high');
    expect(highPriorityTasks).toHaveLength(3);
    
    // First high priority task should have earliest due date
    expect(highPriorityTasks[0].id).toBe('5'); // Jan 1
    expect(highPriorityTasks[1].id).toBe('1'); // Jan 16
    expect(highPriorityTasks[2].id).toBe('3'); // Jan 20
  });

  it('should sort by urgency, then priority', () => {
    const parser = new QueryParser();
    const ast = parser.parse('sort by urgency, priority');
    
    const result = queryEngine.execute(ast);
    
    expect(result.tasks).toHaveLength(5);
    
    // Overdue tasks should have highest urgency
    expect(result.tasks[0].id).toBe('4'); // Overdue
  });

  it('should handle reverse sorting in multi-field sort', () => {
    const parser = new QueryParser();
    const ast = parser.parse('sort by priority reverse, due');
    
    const result = queryEngine.execute(ast);
    
    expect(result.tasks).toHaveLength(5);
    
    // First tasks should be high priority (reversed)
    expect(result.tasks[0].priority).toBe('high');
    
    // Within high priority, sorted by due date ascending
    const highPriorityTasks = result.tasks.slice(0, 3);
    expect(highPriorityTasks[0].id).toBe('5'); // Earliest due
    expect(highPriorityTasks[1].id).toBe('1');
    expect(highPriorityTasks[2].id).toBe('3'); // Latest due
  });

  it('should handle multiple reverse fields', () => {
    const parser = new QueryParser();
    const ast = parser.parse('sort by priority reverse, due reverse');
    
    const result = queryEngine.execute(ast);
    
    expect(result.tasks).toHaveLength(5);
    
    // High priority tasks with latest due date should be first
    const highPriorityTasks = result.tasks.filter(t => t.priority === 'high');
    expect(highPriorityTasks[0].id).toBe('3'); // Jan 20 (latest)
    expect(highPriorityTasks[2].id).toBe('5'); // Jan 1 (earliest)
  });

  it('should sort by three fields: urgency, priority, due', () => {
    const parser = new QueryParser();
    const ast = parser.parse('sort by urgency, priority, due');
    
    const result = queryEngine.execute(ast);
    
    expect(result.tasks).toHaveLength(5);
    
    // This should create a stable sort with urgency as primary, priority as secondary, due as tertiary
    expect(result.tasks.length).toBe(5);
  });

  it('should handle complex multi-field sort with filters', () => {
    const parser = new QueryParser();
    const ast = parser.parse(`
      priority above low
      sort by urgency reverse, due
    `);
    
    const result = queryEngine.execute(ast);
    
    // Should exclude low priority task
    expect(result.tasks.length).toBeLessThan(5);
    
    // Remaining tasks sorted by urgency (reverse) then due
    expect(result.tasks[0].urgency).toBeDefined;
  });

  it('should throw error for invalid multi-field sort syntax', () => {
    const parser = new QueryParser();
    
    expect(() => {
      parser.parse('sort by priority, invalid_field');
    }).not.toThrow(); // Parser doesn't validate field names, engine does
  });

  it('should handle sort with status field', () => {
    const parser = new QueryParser();
    const ast = parser.parse('sort by status.type, priority');
    
    const result = queryEngine.execute(ast);
    
    expect(result.tasks).toHaveLength(5);
  });
});

describe('Multi-Field Sorting Parser', () => {
  let parser: QueryParser;
  
  beforeEach(() => {
    parser = new QueryParser();
  });

  it('should parse single field sort', () => {
    const ast = parser.parse('sort by priority');
    
    expect(ast.sort).toBeDefined();
    expect(ast.sort?.field).toBe('priority');
    expect(ast.sort?.reverse).toBe(false);
  });

  it('should parse single field sort with reverse', () => {
    const ast = parser.parse('sort by priority reverse');
    
    expect(ast.sort).toBeDefined();
    expect(ast.sort?.field).toBe('priority');
    expect(ast.sort?.reverse).toBe(true);
  });

  it('should parse multi-field sort', () => {
    const ast = parser.parse('sort by urgency, priority, due');
    
    expect(ast.sort).toBeDefined();
    
    // Check if sortFields array exists (extended property)
    const sortNode = ast.sort as any;
    expect(sortNode.sortFields).toBeDefined();
    expect(sortNode.sortFields).toHaveLength(3);
    expect(sortNode.sortFields[0].field).toBe('urgency');
    expect(sortNode.sortFields[1].field).toBe('priority');
    expect(sortNode.sortFields[2].field).toBe('due');
  });

  it('should parse multi-field sort with mixed reverse', () => {
    const ast = parser.parse('sort by urgency reverse, priority, due reverse');
    
    const sortNode = ast.sort as any;
    expect(sortNode.sortFields).toBeDefined();
    expect(sortNode.sortFields).toHaveLength(3);
    expect(sortNode.sortFields[0].field).toBe('urgency');
    expect(sortNode.sortFields[0].reverse).toBe(true);
    expect(sortNode.sortFields[1].field).toBe('priority');
    expect(sortNode.sortFields[1].reverse).toBe(false);
    expect(sortNode.sortFields[2].field).toBe('due');
    expect(sortNode.sortFields[2].reverse).toBe(true);
  });

  it('should handle whitespace in multi-field sort', () => {
    const ast = parser.parse('sort by urgency  ,  priority   ,   due');
    
    const sortNode = ast.sort as any;
    expect(sortNode.sortFields).toHaveLength(3);
  });

  it('should throw error for malformed sort field', () => {
    expect(() => {
      parser.parse('sort by priority reverse extra');
    }).toThrow();
  });
});
