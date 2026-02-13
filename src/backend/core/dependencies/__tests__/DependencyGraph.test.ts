import { describe, it, expect } from 'vitest';
import { DependencyGraph, type DependencyGraphOptions } from '../DependencyGraph';
import { CycleDetector } from '../CycleDetector';
import { DependencyIndex } from '../DependencyIndex';
import type { Task } from '../../models/Task';

describe('DependencyGraph', () => {
  function createTask(id: string, name: string, dependsOn: string[] = []): Task {
    return {
      id,
      name,
      status: 'todo',
      dependsOn,
      dueAt: new Date().toISOString(),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    } as Task;
  }

  describe('Graph Building', () => {
    it('should build graph with no dependencies', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2'),
        createTask('3', 'Task 3')
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true
      };
      const data = graph.getGraphData(options);

      expect(data.nodes.length).toBe(3);
      expect(data.edges.length).toBe(0);
    });

    it('should build graph with linear dependencies', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['2'])
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true
      };
      const data = graph.getGraphData(options);

      expect(data.nodes.length).toBe(3);
      expect(data.edges.length).toBe(2);
      expect(data.edges).toContainEqual({ from: '1', to: '2' });
      expect(data.edges).toContainEqual({ from: '2', to: '3' });
    });

    it('should build graph with multiple dependencies', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2'),
        createTask('3', 'Task 3', ['1', '2'])
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true
      };
      const data = graph.getGraphData(options);

      expect(data.nodes.length).toBe(3);
      expect(data.edges.length).toBe(2);
      expect(data.edges).toContainEqual({ from: '1', to: '3' });
      expect(data.edges).toContainEqual({ from: '2', to: '3' });
    });

    it('should ignore non-existent dependencies', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['non-existent'])
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true
      };
      const data = graph.getGraphData(options);

      expect(data.nodes.length).toBe(2);
      expect(data.edges.length).toBe(0);
    });
  });

  describe('Level Computation', () => {
    it('should assign level 0 to tasks with no dependencies', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2')
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true
      };
      const data = graph.getGraphData(options);

      expect(data.levels.get('1')).toBe(0);
      expect(data.levels.get('2')).toBe(0);
    });

    it('should assign correct levels for linear dependencies', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['2'])
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true
      };
      const data = graph.getGraphData(options);

      expect(data.levels.get('1')).toBe(0);
      expect(data.levels.get('2')).toBe(1);
      expect(data.levels.get('3')).toBe(2);
    });

    it('should handle diamond dependencies correctly', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['1']),
        createTask('4', 'Task 4', ['2', '3'])
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true
      };
      const data = graph.getGraphData(options);

      expect(data.levels.get('1')).toBe(0);
      expect(data.levels.get('2')).toBe(1);
      expect(data.levels.get('3')).toBe(1);
      expect(data.levels.get('4')).toBe(2);
    });
  });

  describe('Filtering', () => {
    it('should filter out completed tasks when includeCompleted is false', () => {
      const graph = new DependencyGraph();
      const taskCompleted = createTask('1', 'Task 1');
      taskCompleted.status = 'done';
      taskCompleted.doneAt = new Date().toISOString();
      
      const tasks = [
        taskCompleted,
        createTask('2', 'Task 2')
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: false
      };
      const data = graph.getGraphData(options);

      expect(data.nodes.length).toBe(1);
      expect(data.nodes[0].id).toBe('2');
    });

    it('should include only blocked tasks when onlyBlocked is true', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3')
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true,
        onlyBlocked: true
      };
      const data = graph.getGraphData(options);

      expect(data.nodes.length).toBe(1);
      expect(data.nodes[0].id).toBe('2');
    });

    it('should focus on task and its dependencies when focusTaskId is set', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3'),
        createTask('4', 'Task 4', ['2'])
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true,
        focusTaskId: '2'
      };
      const data = graph.getGraphData(options);

      expect(data.nodes.length).toBe(3); // 1, 2, 4
      const nodeIds = data.nodes.map(n => n.id).sort();
      expect(nodeIds).toEqual(['1', '2', '4']);
    });

    it('should respect depth limit', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['2']),
        createTask('4', 'Task 4', ['3'])
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true,
        focusTaskId: '4',
        depthLimit: 2
      };
      const data = graph.getGraphData(options);

      // Should include 4, 3, 2 (depth 0, 1, 2) but not 1 (depth 3)
      expect(data.nodes.length).toBe(3);
      const nodeIds = data.nodes.map(n => n.id).sort();
      expect(nodeIds).toEqual(['2', '3', '4']);
    });
  });

  describe('Node Properties', () => {
    it('should mark completed tasks correctly', () => {
      const graph = new DependencyGraph();
      const taskCompleted = createTask('1', 'Task 1');
      taskCompleted.status = 'done';
      taskCompleted.doneAt = new Date().toISOString();
      
      const tasks = [
        taskCompleted,
        createTask('2', 'Task 2')
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true
      };
      const data = graph.getGraphData(options);

      const node1 = data.nodes.find(n => n.id === '1');
      const node2 = data.nodes.find(n => n.id === '2');

      expect(node1?.isCompleted).toBe(true);
      expect(node2?.isCompleted).toBe(false);
    });

    it('should mark blocked tasks correctly', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1'])
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true
      };
      const data = graph.getGraphData(options);

      const node1 = data.nodes.find(n => n.id === '1');
      const node2 = data.nodes.find(n => n.id === '2');

      expect(node1?.isBlocked).toBe(false);
      expect(node2?.isBlocked).toBe(true);
    });

    it('should mark blocking tasks correctly', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1'])
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true
      };
      const data = graph.getGraphData(options);

      const node1 = data.nodes.find(n => n.id === '1');
      const node2 = data.nodes.find(n => n.id === '2');

      expect(node1?.isBlocking).toBe(true);
      expect(node2?.isBlocking).toBe(false);
    });

    it('should mark tasks with dependencies correctly', () => {
      const graph = new DependencyGraph();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1'])
      ];

      graph.build(tasks);

      const options: DependencyGraphOptions = {
        includeCompleted: true
      };
      const data = graph.getGraphData(options);

      const node1 = data.nodes.find(n => n.id === '1');
      const node2 = data.nodes.find(n => n.id === '2');

      expect(node1?.hasDependencies).toBe(false);
      expect(node2?.hasDependencies).toBe(true);
    });
  });
});

describe('CycleDetector', () => {
  function createTask(id: string, name: string, dependsOn: string[] = []): Task {
    return {
      id,
      name,
      status: 'todo',
      dependsOn,
      dueAt: new Date().toISOString(),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    } as Task;
  }

  describe('Cycle Detection', () => {
    it('should detect no cycle in acyclic graph', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['2'])
      ];

      index.build(tasks);
      const detector = new CycleDetector(index);

      const cycle = detector.findCycleFrom('3');
      expect(cycle.length).toBe(0);
    });

    it('should detect simple self-cycle', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1', ['1'])
      ];

      index.build(tasks);
      const detector = new CycleDetector(index);

      const cycle = detector.findCycleFrom('1');
      expect(cycle.length).toBeGreaterThan(0);
      expect(cycle).toContain('1');
    });

    it('should detect two-task cycle', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1', ['2']),
        createTask('2', 'Task 2', ['1'])
      ];

      index.build(tasks);
      const detector = new CycleDetector(index);

      const cycle1 = detector.findCycleFrom('1');
      expect(cycle1.length).toBeGreaterThan(0);
      expect(cycle1).toContain('1');
      expect(cycle1).toContain('2');

      const cycle2 = detector.findCycleFrom('2');
      expect(cycle2.length).toBeGreaterThan(0);
      expect(cycle2).toContain('1');
      expect(cycle2).toContain('2');
    });

    it('should detect three-task cycle', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1', ['2']),
        createTask('2', 'Task 2', ['3']),
        createTask('3', 'Task 3', ['1'])
      ];

      index.build(tasks);
      const detector = new CycleDetector(index);

      const cycle = detector.findCycleFrom('1');
      expect(cycle.length).toBe(3);
      expect(cycle).toContain('1');
      expect(cycle).toContain('2');
      expect(cycle).toContain('3');
    });

    it('should detect cycle in complex graph', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['2']),
        createTask('4', 'Task 4', ['3']),
        createTask('5', 'Task 5', ['4', '2']) // Creates cycle: 2->3->4->5->2
      ];

      index.build(tasks);
      const detector = new CycleDetector(index);

      const cycle = detector.findCycleFrom('2');
      expect(cycle.length).toBeGreaterThan(0);
      expect(cycle).toContain('2');
    });
  });

  describe('Cycle Detection for New Edge', () => {
    it('should detect cycle when adding edge', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1', ['2']),
        createTask('2', 'Task 2', ['3']),
        createTask('3', 'Task 3')
      ];

      index.build(tasks);
      const detector = new CycleDetector(index);

      // Trying to add edge 3->1 would create cycle: 1->2->3->1
      const cycle = detector.findCycleForEdge('3', '1');
      expect(cycle.length).toBeGreaterThan(0);
      expect(cycle).toContain('1');
      expect(cycle).toContain('2');
      expect(cycle).toContain('3');
    });

    it('should return empty for safe edge', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2'),
        createTask('3', 'Task 3')
      ];

      index.build(tasks);
      const detector = new CycleDetector(index);

      const cycle = detector.findCycleForEdge('1', '2');
      expect(cycle.length).toBe(0);
    });

    it('should detect self-loop edge', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1')
      ];

      index.build(tasks);
      const detector = new CycleDetector(index);

      const cycle = detector.findCycleForEdge('1', '1');
      expect(cycle.length).toBeGreaterThan(0);
      expect(cycle).toContain('1');
    });
  });
});

describe('DependencyIndex', () => {
  function createTask(id: string, name: string, dependsOn: string[] = []): Task {
    return {
      id,
      name,
      status: 'todo',
      dependsOn,
      dueAt: new Date().toISOString(),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    } as Task;
  }

  describe('Basic Operations', () => {
    it('should build index from tasks', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['1', '2'])
      ];

      index.build(tasks);

      expect(index.getTask('1')).toBeDefined();
      expect(index.getTask('2')).toBeDefined();
      expect(index.getTask('3')).toBeDefined();
    });

    it('should get correct blockers', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['1', '2'])
      ];

      index.build(tasks);

      expect(index.getBlockers('1')).toEqual([]);
      expect(index.getBlockers('2')).toEqual(['1']);
      expect(index.getBlockers('3').sort()).toEqual(['1', '2']);
    });

    it('should get correct blocked tasks', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['1', '2'])
      ];

      index.build(tasks);

      const blockedBy1 = index.getBlocked('1').sort();
      expect(blockedBy1).toEqual(['2', '3']);
      expect(index.getBlocked('2')).toEqual(['3']);
      expect(index.getBlocked('3')).toEqual([]);
    });
  });

  describe('Task Updates', () => {
    it('should update task dependencies', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1'])
      ];

      index.build(tasks);

      expect(index.getBlockers('2')).toEqual(['1']);

      // Update task 2 to not depend on task 1
      const updatedTask2 = createTask('2', 'Task 2', []);
      index.updateTask(updatedTask2);

      expect(index.getBlockers('2')).toEqual([]);
    });

    it('should remove task and update dependencies', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['2'])
      ];

      index.build(tasks);

      index.removeTask('2');

      expect(index.getTask('2')).toBeUndefined();
      expect(index.getBlocked('1')).toEqual([]);
      expect(index.getBlockers('3')).toEqual([]);
    });
  });

  describe('Upstream/Downstream', () => {
    it('should get all upstream dependencies', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['2']),
        createTask('4', 'Task 4', ['3'])
      ];

      index.build(tasks);

      const upstream = Array.from(index.getUpstream('4', 10)).sort();
      expect(upstream).toEqual(['1', '2', '3']);
    });

    it('should get all downstream dependents', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['2']),
        createTask('4', 'Task 4', ['3'])
      ];

      index.build(tasks);

      const downstream = Array.from(index.getDownstream('1', 10)).sort();
      expect(downstream).toEqual(['2', '3', '4']);
    });

    it('should respect depth limit for upstream', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['2']),
        createTask('4', 'Task 4', ['3'])
      ];

      index.build(tasks);

      const upstream = Array.from(index.getUpstream('4', 2)).sort();
      expect(upstream).toEqual(['2', '3']);
    });

    it('should respect depth limit for downstream', () => {
      const index = new DependencyIndex();
      const tasks = [
        createTask('1', 'Task 1'),
        createTask('2', 'Task 2', ['1']),
        createTask('3', 'Task 3', ['2']),
        createTask('4', 'Task 4', ['3'])
      ];

      index.build(tasks);

      const downstream = Array.from(index.getDownstream('1', 2)).sort();
      expect(downstream).toEqual(['2', '3']);
    });
  });
});
