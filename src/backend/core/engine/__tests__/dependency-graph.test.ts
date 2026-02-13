import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../DependencyGraph';
import { createTask } from '@backend/core/models/Task';
import type { Task } from '@backend/core/models/Task';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;
  let tasks: Task[];

  beforeEach(() => {
    graph = new DependencyGraph();
    tasks = [];
  });

  describe('buildGraph', () => {
    it('should build graph from tasks with dependencies', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a'],
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      expect(graph.isBlocked('b')).toBe(true);
      expect(graph.isBlocked('a')).toBe(false);
    });

    it('should handle tasks with no dependencies', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      
      tasks = [taskA];
      graph.buildGraph(tasks);
      
      expect(graph.isBlocked('a')).toBe(false);
    });

    it('should handle missing dependencies gracefully', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        dependsOn: ['missing-task'],
        status: 'todo' as const
      };
      
      tasks = [taskA];
      graph.buildGraph(tasks);
      
      // Should not be blocked since dependency doesn't exist
      expect(graph.isBlocked('a')).toBe(false);
    });

    it('should rebuild graph when called multiple times', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a'],
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      expect(graph.isBlocked('b')).toBe(true);
      
      // Mark taskA as complete
      taskA.status = 'done';
      graph.buildGraph(tasks);
      expect(graph.isBlocked('b')).toBe(false);
    });
  });

  describe('isBlocked', () => {
    it('should return true when dependency is incomplete', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a'],
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      expect(graph.isBlocked('b')).toBe(true);
    });

    it('should return false when all dependencies are complete', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'done' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a'],
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      expect(graph.isBlocked('b')).toBe(false);
    });

    it('should return false for unknown task IDs', () => {
      graph.buildGraph([]);
      expect(graph.isBlocked('unknown')).toBe(false);
    });

    it('should handle multiple dependencies', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'done' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        status: 'todo' as const
      };
      const taskC = { 
        ...createTask('Task C', { type: 'daily', interval: 1 }),
        id: 'c',
        dependsOn: ['a', 'b'],
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB, taskC];
      graph.buildGraph(tasks);
      
      // C is blocked because B is incomplete
      expect(graph.isBlocked('c')).toBe(true);
      
      // Complete B
      taskB.status = 'done';
      graph.buildGraph(tasks);
      expect(graph.isBlocked('c')).toBe(false);
    });

    it('should treat cancelled tasks as complete', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'cancelled' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a'],
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      expect(graph.isBlocked('b')).toBe(false);
    });
  });

  describe('getBlockingTasks', () => {
    it('should return tasks that depend on this task', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a'],
        status: 'todo' as const
      };
      const taskC = { 
        ...createTask('Task C', { type: 'daily', interval: 1 }),
        id: 'c',
        dependsOn: ['a'],
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB, taskC];
      graph.buildGraph(tasks);
      
      const blocking = graph.getBlockingTasks('a');
      expect(blocking).toHaveLength(2);
      expect(blocking).toContain('b');
      expect(blocking).toContain('c');
    });

    it('should return empty array for tasks with no dependents', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      
      tasks = [taskA];
      graph.buildGraph(tasks);
      
      expect(graph.getBlockingTasks('a')).toEqual([]);
    });

    it('should return empty array for unknown task IDs', () => {
      graph.buildGraph([]);
      expect(graph.getBlockingTasks('unknown')).toEqual([]);
    });

    it('should not include completed dependent tasks', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a'],
        status: 'done' as const
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      // B is complete, so A is not blocking anything
      expect(graph.getBlockingTasks('a')).toEqual([]);
    });
  });

  describe('isBlocking', () => {
    it('should return true when task is blocking other tasks', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a'],
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      expect(graph.isBlocking('a')).toBe(true);
      expect(graph.isBlocking('b')).toBe(false);
    });

    it('should return false when task has no dependents', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      
      tasks = [taskA];
      graph.buildGraph(tasks);
      
      expect(graph.isBlocking('a')).toBe(false);
    });
  });

  describe('detectCycle', () => {
    it('should detect simple cycle (A → B → A)', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        dependsOn: ['b'],
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a'],
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      const cycle = graph.detectCycle('a');
      expect(cycle.length).toBeGreaterThan(0);
      expect(cycle).toContain('a');
      expect(cycle).toContain('b');
    });

    it('should detect complex cycle (A → B → C → D → B)', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        dependsOn: ['b'],
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['c'],
        status: 'todo' as const
      };
      const taskC = { 
        ...createTask('Task C', { type: 'daily', interval: 1 }),
        id: 'c',
        dependsOn: ['d'],
        status: 'todo' as const
      };
      const taskD = { 
        ...createTask('Task D', { type: 'daily', interval: 1 }),
        id: 'd',
        dependsOn: ['b'],
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB, taskC, taskD];
      graph.buildGraph(tasks);
      
      const cycle = graph.detectCycle('b');
      expect(cycle.length).toBeGreaterThan(0);
    });

    it('should return empty array when no cycle exists', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a'],
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      expect(graph.detectCycle('a')).toEqual([]);
      expect(graph.detectCycle('b')).toEqual([]);
    });
  });

  describe('canAddDependency', () => {
    it('should allow adding dependency when no cycle would be created', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      expect(graph.canAddDependency('b', 'a')).toBe(true);
    });

    it('should prevent adding dependency that would create cycle', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        dependsOn: ['b'],
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      // Would create A → B → A
      expect(graph.canAddDependency('b', 'a')).toBe(false);
    });

    it('should reject self-dependencies', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        status: 'todo' as const
      };
      
      tasks = [taskA];
      graph.buildGraph(tasks);
      
      expect(graph.canAddDependency('a', 'a')).toBe(false);
    });

    it('should prevent creating complex cycles', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        dependsOn: ['b'],
        status: 'todo' as const
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['c'],
        status: 'todo' as const
      };
      const taskC = { 
        ...createTask('Task C', { type: 'daily', interval: 1 }),
        id: 'c',
        status: 'todo' as const
      };
      
      tasks = [taskA, taskB, taskC];
      graph.buildGraph(tasks);
      
      // Would create A → B → C → A
      expect(graph.canAddDependency('c', 'a')).toBe(false);
    });
  });

  describe('backward compatibility with enabled field', () => {
    it('should treat enabled=false as complete', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        enabled: false
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a']
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      expect(graph.isBlocked('b')).toBe(false);
    });

    it('should treat enabled=true as incomplete', () => {
      const taskA = { 
        ...createTask('Task A', { type: 'daily', interval: 1 }),
        id: 'a',
        enabled: true
      };
      const taskB = { 
        ...createTask('Task B', { type: 'daily', interval: 1 }),
        id: 'b',
        dependsOn: ['a']
      };
      
      tasks = [taskA, taskB];
      graph.buildGraph(tasks);
      
      expect(graph.isBlocked('b')).toBe(true);
    });
  });
});
