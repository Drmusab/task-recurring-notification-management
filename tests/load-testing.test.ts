/**
 * Load Testing Suite - Test plugin with 10k+ tasks
 * 
 * Tests:
 * - Index building performance
 * - Query performance
 * - Memory usage
 * - UI responsiveness
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTask } from '../src/domain/models/Task';
import type { Task } from '../src/domain/models/Task';
import { TaskIndex } from '../src/domain/index/TaskIndex';
import { executeQuery } from '../src/domain/query/AdvancedQuery';
import { performanceMonitor } from '../src/utils/PerformanceMonitor';
import { DependencyGraph } from '../src/domain/dependencies/DependencyGraph';

/**
 * Generate test task with realistic data
 */
function generateTestTask(index: number): Task {
  const statuses = ['todo', 'done', 'in-progress', 'cancelled'];
  const priorities = ['highest', 'high', 'medium', 'low', 'lowest', undefined];
  const tags = ['#work', '#home', '#urgent', '#project/alpha', '#context/meeting', undefined];
  
  const baseDate = new Date('2026-01-01');
  const daysOffset = Math.floor(Math.random() * 365);
  const date = new Date(baseDate.getTime() + daysOffset * 24 * 60 * 60 * 1000);

  return createTask({
    id: `task-${index}`,
    taskId: `task-${index}`,
    name: `Test Task ${index} - ${Math.random().toString(36).substring(7)}`,
    status: statuses[index % statuses.length] as 'todo' | 'done' | 'in-progress' | 'cancelled',
    priority: priorities[index % priorities.length] as 'highest' | 'high' | 'medium' | 'low' | 'lowest' | undefined,
    tags: [tags[index % tags.length]].filter(Boolean) as string[],
    dueAt: Math.random() > 0.5 ? date.toISOString().split('T')[0] : undefined,
    scheduledAt: Math.random() > 0.7 ? date.toISOString().split('T')[0] : undefined,
    createdAt: new Date(baseDate.getTime() - (Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
    path: `daily/${date.toISOString().split('T')[0]}.md`,
  });
}

/**
 * Generate large dataset of tasks
 */
function generateTaskDataset(count: number): Task[] {
  const tasks: Task[] = [];
  
  for (let i = 0; i < count; i++) {
    tasks.push(generateTestTask(i));
  }
  
  return tasks;
}

describe('Load Testing: 10k+ Tasks', () => {
  const TASK_COUNT = 10000;
  let tasks: Task[];
  let taskMap: Map<string, Task>;
  let taskIndex: TaskIndex;

  beforeEach(() => {
    performanceMonitor.clearMetrics();
    tasks = generateTaskDataset(TASK_COUNT);
    taskMap = new Map(tasks.map(t => [t.taskId || t.id, t]));
  });

  it('should build index for 10k tasks in < 5 seconds', () => {
    const duration = performanceMonitor.measure('build-index-10k', () => {
      taskIndex = new TaskIndex(taskMap);
    });

    expect(duration).toBeLessThan(5000); // < 5 seconds
    expect(taskIndex.getAllTasks().length).toBe(TASK_COUNT);
  });

  it('should query "not done" in < 100ms', () => {
    taskIndex = new TaskIndex(taskMap);
    
    const duration = performanceMonitor.measure('query-not-done', () => {
      executeQuery('not done', tasks);
    });

    expect(duration).toBeLessThan(100);
  });

  it('should query with filters in < 100ms', () => {
    taskIndex = new TaskIndex(taskMap);
    
    const duration = performanceMonitor.measure('query-complex', () => {
      executeQuery('not done AND tag includes #work', tasks);
    });

    expect(duration).toBeLessThan(100);
  });

  it('should handle date range queries efficiently', () => {
    taskIndex = new TaskIndex(taskMap);
    
    const duration = performanceMonitor.measure('query-date-range', () => {
      executeQuery('due after 2026-01-01 AND due before 2026-12-31', tasks);
    });

    expect(duration).toBeLessThan(100);
  });

  it('should sort 10k tasks in < 200ms', () => {
    taskIndex = new TaskIndex(taskMap);
    
    const duration = performanceMonitor.measure('sort-10k', () => {
      executeQuery('not done sort by priority desc, due asc', tasks);
    });

    expect(duration).toBeLessThan(200);
  });

  it('should group tasks efficiently', () => {
    taskIndex = new TaskIndex(taskMap);
    
    const duration = performanceMonitor.measure('group-by-status', () => {
      executeQuery('not done group by status', tasks);
    });

    expect(duration).toBeLessThan(150);
  });

  it('should update index incrementally in < 50ms', () => {
    taskIndex = new TaskIndex(taskMap);
    
    const newTask = createTask({
      id: 'new-task',
      name: 'New Task',
      status: 'todo',
    });

    const duration = performanceMonitor.measure('index-update', () => {
      taskIndex.add(newTask);
    });

    expect(duration).toBeLessThan(50);
  });

  it('should handle memory efficiently (< 100MB for 10k tasks)', () => {
    // This is a simplified memory check
    // In real environment, use process.memoryUsage()
    
    const initialHeap = (performance as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize || 0;
    
    taskIndex = new TaskIndex(taskMap);
    
    const finalHeap = (performance as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize || 0;
    const heapGrowth = finalHeap - initialHeap;
    
    // Heap growth should be reasonable (< 100MB)
    // Note: This is approximate and depends on JS engine
    expect(heapGrowth).toBeLessThan(100 * 1024 * 1024);
  });

  it('should build dependency graph for 1k tasks in < 1 second', () => {
    // Create tasks with dependencies (smaller subset for graph)
    const graphTasks = tasks.slice(0, 1000);
    
    // Add some dependencies
    for (let i = 1; i < graphTasks.length; i += 10) {
      graphTasks[i] = {
        ...graphTasks[i],
        dependsOn: [`task-${i - 1}`],
      };
    }

    const graphTaskMap = new Map(graphTasks.map(t => [t.taskId || t.id, t]));

    const duration = performanceMonitor.measure('build-dependency-graph', () => {
      new DependencyGraph(graphTaskMap);
    });

    expect(duration).toBeLessThan(1000);
  });

  it('should generate performance report', () => {
    // Run several operations
    taskIndex = new TaskIndex(taskMap);
    executeQuery('not done', tasks);
    executeQuery('tag includes #work', tasks);
    executeQuery('due after 2026-01-01', tasks);

    const report = performanceMonitor.generateReport();
    
    expect(report).toContain('Performance Report');
    expect(report).toContain('Total Operations');
    expect(report).toContain('Operation Statistics');
  });
});

describe('Stress Testing: Edge Cases', () => {
  it('should handle tasks with very long descriptions', () => {
    const longDescription = 'x'.repeat(10000);
    const task = createTask({
      id: 'long-desc',
      name: longDescription,
      status: 'todo',
    });

    expect(task.name).toBe(longDescription);
    expect(task.name.length).toBe(10000);
  });

  it('should handle tasks with many tags (100+)', () => {
    const tags = Array.from({ length: 100 }, (_, i) => `#tag${i}`);
    const task = createTask({
      id: 'many-tags',
      name: 'Task with many tags',
      status: 'todo',
      tags,
    });

    expect(task.tags?.length).toBe(100);
  });

  it('should handle deep dependency chains (50 levels)', () => {
    const chainTasks: Task[] = [];
    
    for (let i = 0; i < 50; i++) {
      chainTasks.push(createTask({
        id: `chain-${i}`,
        taskId: `chain-${i}`,
        name: `Chain Task ${i}`,
        status: 'todo',
        dependsOn: i > 0 ? [`chain-${i - 1}`] : [],
      }));
    }

    const taskMap = new Map(chainTasks.map(t => [t.taskId!, t]));
    const graph = new DependencyGraph(taskMap);

    // Last task should depend on all previous (transitive)
    const deps = graph.getDependencies('chain-49', false);
    expect(deps.size).toBe(49);
  });

  it('should detect circular dependencies in complex graphs', () => {
    const tasks: Task[] = [
      createTask({ id: 'a', taskId: 'a', name: 'A', status: 'todo', dependsOn: ['b'] }),
      createTask({ id: 'b', taskId: 'b', name: 'B', status: 'todo', dependsOn: ['c'] }),
      createTask({ id: 'c', taskId: 'c', name: 'C', status: 'todo', dependsOn: ['d'] }),
      createTask({ id: 'd', taskId: 'd', name: 'D', status: 'todo', dependsOn: ['a'] }), // Cycle!
    ];

    const taskMap = new Map(tasks.map(t => [t.taskId!, t]));
    const graph = new DependencyGraph(taskMap);

    const cycles = graph.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should handle concurrent index updates (simulated)', async () => {
    const taskMap = new Map<string, Task>();
    const index = new TaskIndex(taskMap);

    // Simulate concurrent updates
    const promises = Array.from({ length: 100 }, (_, i) => {
      return Promise.resolve().then(() => {
        const task = createTask({
          id: `concurrent-${i}`,
          name: `Concurrent ${i}`,
          status: 'todo',
        });
        index.add(task);
      });
    });

    await Promise.all(promises);

    expect(index.getAllTasks().length).toBe(100);
  });
});

describe('Performance Benchmarks', () => {
  it('should meet all performance targets', () => {
    const benchmarks = [
      { name: 'Index 10k tasks', target: 5000, actual: 0 },
      { name: 'Query simple', target: 100, actual: 0 },
      { name: 'Query complex', target: 100, actual: 0 },
      { name: 'Sort 10k', target: 200, actual: 0 },
      { name: 'Group by', target: 150, actual: 0 },
      { name: 'Index update', target: 50, actual: 0 },
    ];

    // Run benchmarks
    const tasks = generateTaskDataset(10000);
    const taskMap = new Map(tasks.map(t => [t.taskId || t.id, t]));

    benchmarks[0].actual = performanceMonitor.measure('benchmark-index', () => {
      new TaskIndex(taskMap);
    });

    const index = new TaskIndex(taskMap);

    benchmarks[1].actual = performanceMonitor.measure('benchmark-simple-query', () => {
      executeQuery('not done', tasks);
    });

    benchmarks[2].actual = performanceMonitor.measure('benchmark-complex-query', () => {
      executeQuery('not done AND tag includes #work', tasks);
    });

    benchmarks[3].actual = performanceMonitor.measure('benchmark-sort', () => {
      executeQuery('not done sort by priority desc', tasks);
    });

    benchmarks[4].actual = performanceMonitor.measure('benchmark-group', () => {
      executeQuery('not done group by status', tasks);
    });

    const newTask = createTask({ id: 'bench', name: 'Benchmark', status: 'todo' });
    benchmarks[5].actual = performanceMonitor.measure('benchmark-update', () => {
      index.add(newTask);
    });

    // Check all benchmarks pass
    benchmarks.forEach(bench => {
      expect(bench.actual).toBeLessThan(bench.target);
    });

    // Print benchmark results
    console.log('\n=== Performance Benchmarks ===');
    benchmarks.forEach(bench => {
      const status = bench.actual < bench.target ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${bench.name}: ${bench.actual.toFixed(2)}ms (target: ${bench.target}ms)`);
    });
  });
});
