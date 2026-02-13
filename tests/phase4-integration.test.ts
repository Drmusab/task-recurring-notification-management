/**
 * Phase 4 Integration Tests - Dependencies + Advanced Query
 * Tests for DependencyGraph, AdvancedQuery, FilenameParser, TagHierarchy
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Task } from '../src/domain/models/Task';
import { createTask } from '../src/domain/models/Task';
import { DependencyGraph } from '../src/domain/dependencies/DependencyGraph';
import { QueryParser, QueryExecutor, executeQuery } from '../src/domain/query/AdvancedQuery';
import { FilenameParser, parseDateFromFilename } from '../src/domain/parser/FilenameParser';
import { TagHierarchy, extractTags, taskHasTag } from '../src/domain/tags/TagHierarchy';

describe('DependencyGraph', () => {
  let tasks: Map<string, Task>;
  let graph: DependencyGraph;
  
  beforeEach(() => {
    tasks = new Map();
    
    // Create test tasks
    const taskA = createTask({ 
      id: 'a', 
      taskId: 'task-a', 
      name: 'Task A', 
      status: 'todo' 
    });
    const taskB = createTask({ 
      id: 'b', 
      taskId: 'task-b', 
      name: 'Task B', 
      status: 'todo',
      dependsOn: ['task-a']
    });
    const taskC = createTask({ 
      id: 'c', 
      taskId: 'task-c', 
      name: 'Task C', 
      status: 'todo',
      dependsOn: ['task-b']
    });
    
    tasks.set('task-a', taskA);
    tasks.set('task-b', taskB);
    tasks.set('task-c', taskC);
    
    graph = new DependencyGraph(tasks);
  });
  
  it('should detect blocked tasks', () => {
    expect(graph.isTaskBlocked('task-a')).toBe(false);
    expect(graph.isTaskBlocked('task-b')).toBe(true); // Depends on task-a which is not done
    expect(graph.isTaskBlocked('task-c')).toBe(true); // Depends on task-b which is not done
  });
  
  it('should detect blocking tasks', () => {
    expect(graph.isTaskBlocking('task-a')).toBe(true); // Blocks task-b
    expect(graph.isTaskBlocking('task-b')).toBe(true); // Blocks task-c
    expect(graph.isTaskBlocking('task-c')).toBe(false); // Blocks nothing
  });
  
  it('should get all blocked tasks', () => {
    const blocked = graph.getBlockedTasks();
    expect(blocked.length).toBe(2);
    expect(blocked.map(t => t.taskId)).toContain('task-b');
    expect(blocked.map(t => t.taskId)).toContain('task-c');
  });
  
  it('should detect circular dependencies', () => {
    // Add circular dependency: task-a -> task-b -> task-c -> task-a
    const taskACycle = createTask({ 
      ...tasks.get('task-a'),
      dependsOn: ['task-c']
    });
    tasks.set('task-a', taskACycle);
    
    graph = new DependencyGraph(tasks);
    const cycles = graph.detectCycles();
    
    expect(cycles.length).toBeGreaterThan(0);
  });
  
  it('should detect if adding dependency would create cycle', () => {
    expect(graph.wouldCreateCycle('task-a', 'task-c')).toBe(true); // Would create cycle
    expect(graph.wouldCreateCycle('task-a', 'task-b')).toBe(false); // Already exists
    expect(graph.wouldCreateCycle('task-c', 'task-a')).toBe(false); // No cycle
  });
  
  it('should get transitive dependencies', () => {
    const deps = graph.getDependencies('task-c', false);
    expect(deps.size).toBe(2);
    expect(deps.has('task-b')).toBe(true);
    expect(deps.has('task-a')).toBe(true);
  });
  
  it('should validate dependencies', () => {
    const error1 = graph.validateDependency('task-a', 'task-a');
    expect(error1).toBeTruthy(); // Self-reference
    
    const error2 = graph.validateDependency('task-a', 'nonexistent');
    expect(error2).toBeTruthy(); // Task not found
    
    const error3 = graph.validateDependency('task-a', 'task-c');
    expect(error3).toBeTruthy(); // Would create cycle
  });
});

describe('AdvancedQuery', () => {
  let tasks: Task[];
  let graph: DependencyGraph;
  
  beforeEach(() => {
    tasks = [
      createTask({ 
        id: '1', 
        name: 'Task 1', 
        status: 'todo', 
        priority: 'high',
        tags: ['#work', '#urgent'],
        dueAt: '2026-02-10'
      }),
      createTask({ 
        id: '2', 
        name: 'Task 2', 
        status: 'done', 
        priority: 'medium',
        tags: ['#work'],
        doneAt: '2026-02-05'
      }),
      createTask({ 
        id: '3', 
        name: 'Task 3', 
        status: 'todo', 
        priority: 'low',
        tags: ['#home'],
        scheduledAt: '2026-02-08'
      }),
      createTask({ 
        id: '4', 
        name: 'Task 4', 
        status: 'todo',
        taskId: 'task-4',
        dependsOn: ['task-1']
      }),
    ];
    
    const taskMap = new Map(tasks.map(t => [t.taskId || t.id, t]));
    graph = new DependencyGraph(taskMap);
  });
  
  it('should parse simple query: not done', () => {
    const parser = new QueryParser();
    const parsed = parser.parse('not done');
    
    expect(parsed.filter).toBeDefined();
    expect(parsed.filter?.type).toBe('comparison');
  });
  
  it('should execute query: not done', () => {
    const results = executeQuery('not done', tasks, graph);
    expect(results.length).toBe(3); // 3 tasks are not done
  });
  
  it('should execute query: done', () => {
    const results = executeQuery('done', tasks, graph);
    expect(results.length).toBe(1); // 1 task is done
  });
  
  it('should execute query: tag includes #work', () => {
    const results = executeQuery('tag includes #work', tasks, graph);
    expect(results.length).toBe(2);
  });
  
  it('should execute query: priority is high', () => {
    const results = executeQuery('priority is high', tasks, graph);
    expect(results.length).toBe(1);
    expect(results[0].priority).toBe('high');
  });
  
  it('should execute query: due before 2026-02-11', () => {
    const results = executeQuery('due before 2026-02-11', tasks, graph);
    expect(results.length).toBe(1);
  });
  
  it('should execute complex query: not done AND tag includes #work', () => {
    const results = executeQuery('not done AND tag includes #work', tasks, graph);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('1');
  });
  
  it('should execute complex query with OR: priority is high OR tag includes #home', () => {
    const results = executeQuery('priority is high OR tag includes #home', tasks, graph);
    expect(results.length).toBe(2);
  });
  
  it('should execute complex query with parentheses: not done AND (priority is high OR tag includes #home)', () => {
    const results = executeQuery('not done AND (priority is high OR tag includes #home)', tasks, graph);
    expect(results.length).toBe(2);
  });
  
  it('should execute query: is blocked', () => {
    const results = executeQuery('is blocked', tasks, graph);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('4');
  });
  
  it('should execute query with sort: not done sort by priority desc', () => {
    const parser = new QueryParser();
    const parsed = parser.parse('not done sort by priority desc');
    
    expect(parsed.sort).toBeDefined();
    expect(parsed.sort![0].field).toBe('priority');
    expect(parsed.sort![0].direction).toBe('desc');
    
    const executor = new QueryExecutor(tasks, graph);
    const results = executor.execute(parsed);
    
    expect(results.length).toBe(3);
    expect(results[0].priority).toBe('high');
  });
  
  it('should execute query with grouping: tag includes #work group by status', () => {
    const parser = new QueryParser();
    const parsed = parser.parse('tag includes #work group by status');
    
    expect(parsed.group).toBeDefined();
    expect(parsed.group!.field).toBe('status');
    
    const executor = new QueryExecutor(tasks, graph);
    const grouped = executor.executeGrouped(parsed);
    
    expect(grouped.has('todo')).toBe(true);
    expect(grouped.has('done')).toBe(true);
  });
});

describe('FilenameParser', () => {
  let parser: FilenameParser;
  
  beforeEach(() => {
    parser = new FilenameParser();
  });
  
  it('should extract date from ISO format: 2026-02-06', () => {
    const date = parser.extractDate('2026-02-06 Meeting Notes.md');
    expect(date).toBe('2026-02-06');
  });
  
  it('should extract date from compact format: 20260206', () => {
    const date = parser.extractDate('20260206 Daily Log.md');
    expect(date).toBe('2026-02-06');
  });
  
  it('should extract date from European format: 06-02-2026', () => {
    const date = parser.extractDate('06-02-2026 Notes.md');
    expect(date).toBe('2026-02-06');
  });
  
  it('should extract date from US format: 02/06/2026', () => {
    const date = parser.extractDate('02/06/2026 Tasks.md');
    expect(date).toBe('2026-02-06');
  });
  
  it('should extract date from dotted format: 2026.02.06', () => {
    const date = parser.extractDate('2026.02.06 Journal.md');
    expect(date).toBe('2026-02-06');
  });
  
  it('should extract date from month name format: 2026-Feb-06', () => {
    const date = parser.extractDate('2026-Feb-06 Meeting.md');
    expect(date).toBe('2026-02-06');
  });
  
  it('should return null for invalid dates', () => {
    const date = parser.extractDate('Random File Name.md');
    expect(date).toBeNull();
  });
  
  it('should validate dates correctly', () => {
    expect(parser.extractDate('2026-13-01.md')).toBeNull(); // Invalid month
    expect(parser.extractDate('2026-02-32.md')).toBeNull(); // Invalid day
  });
  
  it('should use convenience function', () => {
    const date = parseDateFromFilename('2026-02-06 Notes.md');
    expect(date).toBe('2026-02-06');
  });
});

describe('TagHierarchy', () => {
  let hierarchy: TagHierarchy;
  
  beforeEach(() => {
    hierarchy = new TagHierarchy();
  });
  
  it('should add tags to hierarchy', () => {
    hierarchy.addTag('#project');
    hierarchy.addTag('#project/work');
    hierarchy.addTag('#project/work/client-a');
    
    expect(hierarchy.hasTag('#project')).toBe(true);
    expect(hierarchy.hasTag('#project/work')).toBe(true);
    expect(hierarchy.hasTag('#project/work/client-a')).toBe(true);
  });
  
  it('should get ancestors', () => {
    hierarchy.addTag('#project/work/client-a');
    
    const ancestors = hierarchy.getAncestors('project/work/client-a');
    expect(ancestors).toEqual(['#project', '#project/work']);
  });
  
  it('should get descendants', () => {
    hierarchy.addTag('#project/work/client-a');
    hierarchy.addTag('#project/work/client-b');
    hierarchy.addTag('#project/home');
    
    const descendants = hierarchy.getDescendants('project');
    expect(descendants).toContain('#project/work');
    expect(descendants).toContain('#project/home');
    expect(descendants).toContain('#project/work/client-a');
    expect(descendants).toContain('#project/work/client-b');
  });
  
  it('should match tags with hierarchy', () => {
    hierarchy.addTag('#project/work/client-a');
    
    expect(hierarchy.matchesTag('#project/work/client-a', '#project')).toBe(true);
    expect(hierarchy.matchesTag('#project/work/client-a', '#project/work')).toBe(true);
    expect(hierarchy.matchesTag('#project/work/client-a', '#project/work/client-a')).toBe(true);
    expect(hierarchy.matchesTag('#project', '#project/work')).toBe(false);
  });
  
  it('should extract tags from text', () => {
    const text = 'Task description #project/work #urgent #context/home some text #another';
    const tags = extractTags(text);
    
    expect(tags).toContain('#project/work');
    expect(tags).toContain('#urgent');
    expect(tags).toContain('#context/home');
    expect(tags).toContain('#another');
  });
  
  it('should check if task has tag (with hierarchy)', () => {
    hierarchy.buildFromTags(['#project/work', '#urgent']);
    
    const taskTags = ['#project/work/client-a'];
    
    expect(taskHasTag(taskTags, '#project', hierarchy)).toBe(true);
    expect(taskHasTag(taskTags, '#project/work', hierarchy)).toBe(true);
    expect(taskHasTag(taskTags, '#urgent', hierarchy)).toBe(false);
  });
  
  it('should get tag suggestions', () => {
    hierarchy.buildFromTags(['#project/work', '#project/home', '#personal']);
    
    const suggestions = hierarchy.getSuggestions('#proj');
    expect(suggestions).toContain('#project/work');
    expect(suggestions).toContain('#project/home');
    expect(suggestions.length).toBe(2);
  });
  
  it('should find common parent', () => {
    hierarchy.buildFromTags(['#project/work', '#project/home']);
    
    const common = hierarchy.findCommonParent('project/work', 'project/home');
    expect(common).toBe('#project');
  });
});

describe('Complex Integration: Dependencies + Queries', () => {
  it('should query blocked tasks with complex filters', () => {
    const tasks = [
      createTask({ 
        id: '1', 
        taskId: 'task-1',
        name: 'Task 1', 
        status: 'todo',
        tags: ['#work']
      }),
      createTask({ 
        id: '2', 
        taskId: 'task-2',
        name: 'Task 2', 
        status: 'todo',
        tags: ['#work', '#urgent'],
        dependsOn: ['task-1']
      }),
      createTask({ 
        id: '3', 
        taskId: 'task-3',
        name: 'Task 3', 
        status: 'todo',
        tags: ['#home'],
        dependsOn: ['task-1']
      }),
    ];
    
    const taskMap = new Map(tasks.map(t => [t.taskId!, t]));
    const graph = new DependencyGraph(taskMap);
    
    // Query: not done AND (is blocked OR tag includes #urgent)
    const results = executeQuery('not done AND (is blocked OR tag includes #urgent)', tasks, graph);
    
    expect(results.length).toBe(2);
    expect(results.map(t => t.id)).toContain('2');
    expect(results.map(t => t.id)).toContain('3');
  });
});
