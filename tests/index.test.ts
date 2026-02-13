/**
 * Unit Tests for TaskIndex and QueryParser
 * Testing index performance and query execution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskIndex } from '../src/domain/index/TaskIndex';
import { QueryParser, QueryExecutor, QueryFilters } from '../src/domain/query/QueryParser';
import { createTask } from '../src/domain/models/Task';
import type { Task } from '../src/domain/models/Task';

describe('TaskIndex - Build and Lookup', () => {
  let index: TaskIndex;
  let tasks: Task[];
  
  beforeEach(() => {
    index = new TaskIndex();
    
    // Create test tasks
    tasks = [
      createTask({ 
        id: 'task-1', 
        name: 'Task 1', 
        status: 'todo',
        dueAt: '2026-02-10',
        tags: ['work'],
      }),
      createTask({ 
        id: 'task-2', 
        name: 'Task 2', 
        status: 'done',
        dueAt: '2026-02-15',
        tags: ['personal'],
      }),
      createTask({ 
        id: 'task-3', 
        name: 'Task 3', 
        status: 'todo',
        dueAt: '2026-02-20',
        tags: ['work', 'urgent'],
      }),
    ];
    
    index.buildIndex(tasks);
  });
  
  it('should build index from task array', () => {
    expect(index.getCount()).toBe(3);
  });
  
  it('should get task by ID', () => {
    const task = index.getById('task-1');
    
    expect(task).toBeDefined();
    expect(task?.name).toBe('Task 1');
  });
  
  it('should get tasks by status', () => {
    const todoTasks = index.getByStatus('todo');
    
    expect(todoTasks).toHaveLength(2);
    expect(todoTasks.every(t => t.status === 'todo')).toBe(true);
  });
  
  it('should get tasks by tag', () => {
    const workTasks = index.getByTag('work');
    
    expect(workTasks).toHaveLength(2);
    expect(workTasks.every(t => t.tags?.includes('work'))).toBe(true);
  });
  
  it('should get tasks due before date', () => {
    const tasksBeforeFeb15 = index.getDueBefore('2026-02-15');
    
    expect(tasksBeforeFeb15).toHaveLength(1);
    expect(tasksBeforeFeb15[0].id).toBe('task-1');
  });
  
  it('should get tasks due after date', () => {
    const tasksAfterFeb15 = index.getDueAfter('2026-02-15');
    
    expect(tasksAfterFeb15.length).toBeGreaterThanOrEqual(1);
    expect(tasksAfterFeb15.every(t => t.dueAt! >= '2026-02-15')).toBe(true);
  });
  
  it('should get all tasks', () => {
    const allTasks = index.getAll();
    
    expect(allTasks).toHaveLength(3);
  });
});

describe('TaskIndex - Incremental Updates', () => {
  let index: TaskIndex;
  
  beforeEach(() => {
    index = new TaskIndex();
  });
  
  it('should add task to index', () => {
    const task = createTask({ id: 'new-task', name: 'New Task', status: 'todo' });
    index.addToIndex(task);
    
    expect(index.getCount()).toBe(1);
    expect(index.getById('new-task')).toBeDefined();
  });
  
  it('should remove task from index', () => {
    const task = createTask({ id: 'task-1', name: 'Task 1', status: 'todo' });
    index.addToIndex(task);
    
    expect(index.getCount()).toBe(1);
    
    index.removeFromIndex('task-1');
    
    expect(index.getCount()).toBe(0);
    expect(index.getById('task-1')).toBeUndefined();
  });
  
  it('should update task in index', () => {
    const task = createTask({ id: 'task-1', name: 'Old Name', status: 'todo' });
    index.addToIndex(task);
    
    const updatedTask = { ...task, name: 'New Name' };
    index.updateInIndex(updatedTask);
    
    const retrieved = index.getById('task-1');
    expect(retrieved?.name).toBe('New Name');
  });
});

describe('TaskIndex - Dependencies', () => {
  let index: TaskIndex;
  
  beforeEach(() => {
    index = new TaskIndex();
    
    const tasks = [
      createTask({ 
        id: 'task-1', 
        taskId: 'dep-1',
        name: 'Independent Task', 
        status: 'todo',
      }),
      createTask({ 
        id: 'task-2', 
        taskId: 'dep-2',
        name: 'Dependent Task', 
        status: 'todo',
        dependsOn: ['dep-1'],
      }),
      createTask({ 
        id: 'task-3', 
        taskId: 'dep-3',
        name: 'Second Dependent', 
        status: 'todo',
        dependsOn: ['dep-1'],
      }),
    ];
    
    index.buildIndex(tasks);
  });
  
  it('should track dependent tasks', () => {
    const dependents = index.getDependents('dep-1');
    
    expect(dependents).toHaveLength(2);
    expect(dependents.map(t => t.id)).toContain('task-2');
    expect(dependents.map(t => t.id)).toContain('task-3');
  });
  
  it('should identify blocked tasks', () => {
    const blocked = index.getBlocked();
    
    expect(blocked.length).toBeGreaterThanOrEqual(2);
    expect(blocked.map(t => t.id)).toContain('task-2');
  });
});

describe('QueryFilters', () => {
  it('should filter by "not done"', () => {
    const tasks = [
      createTask({ status: 'todo' }),
      createTask({ status: 'done' }),
      createTask({ status: 'todo' }),
    ];
    
    const filtered = tasks.filter(QueryFilters.notDone());
    
    expect(filtered).toHaveLength(2);
  });
  
  it('should filter by "done"', () => {
    const tasks = [
      createTask({ status: 'todo' }),
      createTask({ status: 'done' }),
    ];
    
    const filtered = tasks.filter(QueryFilters.done());
    
    expect(filtered).toHaveLength(1);
  });
  
  it('should filter by "due before"', () => {
    const tasks = [
      createTask({ dueAt: '2026-02-10' }),
      createTask({ dueAt: '2026-02-20' }),
    ];
    
    const filtered = tasks.filter(QueryFilters.dueBefore('2026-02-15'));
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].dueAt).toBe('2026-02-10');
  });
  
  it('should filter by "tag includes"', () => {
    const tasks = [
      createTask({ tags: ['work'] }),
      createTask({ tags: ['personal'] }),
      createTask({ tags: ['work', 'urgent'] }),
    ];
    
    const filtered = tasks.filter(QueryFilters.tagIncludes('work'));
    
    expect(filtered).toHaveLength(2);
  });
  
  it('should filter by "priority is"', () => {
    const tasks = [
      createTask({ priority: 'high' }),
      createTask({ priority: 'low' }),
      createTask({ priority: 'high' }),
    ];
    
    const filtered = tasks.filter(QueryFilters.priorityIs('high'));
    
    expect(filtered).toHaveLength(2);
  });
});

describe('QueryParser', () => {
  it('should parse "not done" query', () => {
    const filter = QueryParser.parse('not done');
    const task = createTask({ status: 'todo' });
    
    expect(filter(task)).toBe(true);
  });
  
  it('should parse "done" query', () => {
    const filter = QueryParser.parse('done');
    const task = createTask({ status: 'done' });
    
    expect(filter(task)).toBe(true);
  });
  
  it('should parse "status is X" query', () => {
    const filter = QueryParser.parse('status is todo');
    const task = createTask({ status: 'todo' });
    
    expect(filter(task)).toBe(true);
  });
  
  it('should parse "due before X" query', () => {
    const filter = QueryParser.parse('due before 2026-02-15');
    const task = createTask({ dueAt: '2026-02-10' });
    
    expect(filter(task)).toBe(true);
  });
  
  it('should parse "tag includes X" query', () => {
    const filter = QueryParser.parse('tag includes work');
    const task = createTask({ tags: ['work', 'urgent'] });
    
    expect(filter(task)).toBe(true);
  });
  
  it('should handle date keywords', () => {
    const filter = QueryParser.parse('due before today');
    // Should parse 'today' keyword
    expect(filter).toBeDefined();
  });
});

describe('QueryExecutor', () => {
  let executor: QueryExecutor;
  let index: TaskIndex;
  
  beforeEach(() => {
    index = new TaskIndex();
    
    const tasks = [
      createTask({ 
        id: 'task-1',
        name: 'Task 1', 
        status: 'todo',
        dueAt: '2026-02-10',
        priority: 'high',
        tags: ['work'],
      }),
      createTask({ 
        id: 'task-2',
        name: 'Task 2', 
        status: 'done',
        dueAt: '2026-02-15',
        priority: 'low',
      }),
      createTask({ 
        id: 'task-3',
        name: 'Task 3', 
        status: 'todo',
        dueAt: '2026-02-20',
        priority: 'high',
        tags: ['work'],
      }),
    ];
    
    index.buildIndex(tasks);
    executor = new QueryExecutor(index);
  });
  
  it('should execute "not done" query', () => {
    const results = executor.execute('not done');
    
    expect(results).toHaveLength(2);
    expect(results.every(t => t.status !== 'done')).toBe(true);
  });
  
  it('should execute "tag includes work" query', () => {
    const results = executor.execute('tag includes work');
    
    expect(results).toHaveLength(2);
    expect(results.every(t => t.tags?.includes('work'))).toBe(true);
  });
  
  it('should execute query with sorting by due date', () => {
    const results = executor.executeWithSort('not done', 'due', 'asc');
    
    expect(results).toHaveLength(2);
    expect(results[0].dueAt).toBeLessThan(results[1].dueAt!);
  });
  
  it('should execute query with sorting by priority', () => {
    const results = executor.executeWithSort('not done', 'priority', 'asc');
    
    expect(results).toHaveLength(2);
    expect(results.every(t => t.priority === 'high')).toBe(true); // Both are high priority
  });
});

describe('Performance Tests', () => {
  it('should handle 1000+ tasks efficiently', () => {
    const index = new TaskIndex();
    const tasks: Task[] = [];
    
    // Generate 1000 tasks
    for (let i = 0; i < 1000; i++) {
      tasks.push(createTask({
        id: `task-${i}`,
        name: `Task ${i}`,
        status: i % 3 === 0 ? 'done' : 'todo',
        dueAt: `2026-${String(i % 12 + 1).padStart(2, '0')}-${String(i % 28 + 1).padStart(2, '0')}`,
        tags: [`tag-${i % 10}`],
      }));
    }
    
    const startTime = Date.now();
    index.buildIndex(tasks);
    const buildTime = Date.now() - startTime;
    
    expect(buildTime).toBeLessThan(100); // Should build in < 100ms
    expect(index.getCount()).toBe(1000);
    
    // Test lookup performance
    const lookupStart = Date.now();
    const task = index.getById('task-500');
    const lookupTime = Date.now() - lookupStart;
    
    expect(lookupTime).toBeLessThan(1); // O(1) lookup
    expect(task).toBeDefined();
    
    // Test filter performance
    const filterStart = Date.now();
    const todoTasks = index.getByStatus('todo');
    const filterTime = Date.now() - filterStart;
    
    expect(filterTime).toBeLessThan(10); // Fast filtering
    expect(todoTasks.length).toBeGreaterThan(0);
  });
});
