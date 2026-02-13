import { describe, it, expect, vi } from 'vitest';
import { QueryParser } from '@backend/core/query/QueryParser';
import { QueryEngine } from '@backend/core/query/QueryEngine';
import type { Task } from '@backend/core/models/Task';
import { createTask } from '@backend/core/models/Task';
import { StatusType } from '@backend/core/models/Status';

describe('Enhanced Query Language Filters', () => {
  const mockTasks: Task[] = [
    {
      id: '1',
      name: 'High priority task',
      priority: 'high',
      statusSymbol: ' ',
      dueAt: '2024-01-15T10:00:00Z',
      createdAt: '2024-01-01T10:00:00Z',
    } as Task,
    {
      id: '2',
      name: 'Meeting with team',
      priority: 'medium',
      statusSymbol: ' ',
      dueAt: '2024-01-20T10:00:00Z',
      createdAt: '2024-01-01T10:00:00Z',
    } as Task,
    {
      id: '3',
      name: 'Low priority task',
      priority: 'low',
      statusSymbol: 'x',
      doneAt: '2024-01-10T10:00:00Z',
      createdAt: '2024-01-01T10:00:00Z',
    } as Task,
    {
      id: '4',
      name: 'Normal priority task',
      priority: 'normal',
      statusSymbol: ' ',
      createdAt: '2024-01-01T10:00:00Z',
    } as Task,
  ];

  const mockIndex = {
    getAllTasks: () => mockTasks,
  };

  describe('DescriptionFilter with case sensitivity', () => {
    it('should filter tasks by description (case-insensitive by default)', () => {
      const parser = new QueryParser();
      const ast = parser.parse('description includes "meeting"');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].id).toBe('2');
    });

    it('should filter tasks by description (case-insensitive with uppercase)', () => {
      const parser = new QueryParser();
      const ast = parser.parse('description includes "MEETING"');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].id).toBe('2');
    });

    it('should support "does not include" operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('description does not include "meeting"');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(3);
      expect(result.tasks.every(t => !t.name.toLowerCase().includes('meeting'))).toBe(true);
    });

    it('should support regex operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('description regex "^High"');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].id).toBe('1');
    });

    it('should handle invalid regex gracefully', () => {
      const parser = new QueryParser();
      const ast = parser.parse('description regex "[invalid"');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      // Should return empty results, not crash
      expect(result.tasks.length).toBe(0);
    });
  });

  describe('PriorityFilter with 6 levels', () => {
    it('should filter by priority "is" operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].id).toBe('1');
    });

    it('should filter by priority "above" operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority above normal');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      // Tasks with priority > normal: medium (3) and high (4)
      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
      expect(result.tasks.some(t => t.id === '1' || t.id === '2')).toBe(true);
    });

    it('should filter by priority "below" operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority below normal');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      // Tasks with priority < normal: low
      expect(result.tasks.some(t => t.id === '3')).toBe(true);
    });

    it('should handle "lowest" priority level', () => {
      const taskWithLowest: Task = {
        ...mockTasks[0],
        id: '5',
        name: 'Lowest priority',
        priority: 'lowest',
      };
      
      const tasksWithLowest = [...mockTasks, taskWithLowest];
      const indexWithLowest = {
        getAllTasks: () => tasksWithLowest,
      };
      
      const parser = new QueryParser();
      const ast = parser.parse('priority is lowest');
      const engine = new QueryEngine(indexWithLowest);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].id).toBe('5');
    });

    it('should handle "highest" priority level', () => {
      const taskWithHighest: Task = {
        ...mockTasks[0],
        id: '6',
        name: 'Highest priority',
        priority: 'highest',
      };
      
      const tasksWithHighest = [...mockTasks, taskWithHighest];
      const indexWithHighest = {
        getAllTasks: () => tasksWithHighest,
      };
      
      const parser = new QueryParser();
      const ast = parser.parse('priority is highest');
      const engine = new QueryEngine(indexWithHighest);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].id).toBe('6');
    });
  });

  describe('UrgencyFilter', () => {
    it('should filter tasks by urgency above a threshold', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-14T09:00:00Z'));

      try {
        const parser = new QueryParser();
        const ast = parser.parse('urgency above 80');
        const urgencyTasks: Task[] = [
          {
            ...createTask('Urgent Task', { type: 'daily', interval: 1 }),
            dueAt: new Date('2024-01-15T09:00:00Z').toISOString(),
            priority: 'high',
          },
          {
            ...createTask('Later Task', { type: 'daily', interval: 1 }),
            dueAt: new Date('2024-01-25T09:00:00Z').toISOString(),
            priority: 'low',
          },
        ];
        const engine = new QueryEngine({ getAllTasks: () => urgencyTasks });
        const result = engine.execute(ast);

        expect(result.tasks.length).toBeGreaterThanOrEqual(1);
        expect(result.tasks[0].name).toBe('Urgent Task');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('EscalationFilter', () => {
    it('should filter tasks by escalation level thresholds', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-10T09:00:00Z'));

      const parser = new QueryParser();
      const ast = parser.parse('escalation >= critical');
      const escalationTasks: Task[] = [
        {
          ...createTask('Warning Task', { type: 'daily', interval: 1 }),
          dueAt: new Date('2024-01-08T09:00:00Z').toISOString(),
        },
        {
          ...createTask('Critical Task', { type: 'daily', interval: 1 }),
          dueAt: new Date('2024-01-03T09:00:00Z').toISOString(),
        },
        {
          ...createTask('Severe Task', { type: 'daily', interval: 1 }),
          dueAt: new Date('2023-12-31T09:00:00Z').toISOString(),
        },
      ];
      const engine = new QueryEngine({ getAllTasks: () => escalationTasks });
      const result = engine.execute(ast);

      expect(result.tasks.length).toBe(2);
      expect(result.tasks.some((task) => task.name === 'Critical Task')).toBe(true);
      expect(result.tasks.some((task) => task.name === 'Severe Task')).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('Boolean operators', () => {
    it('should support AND operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('not done AND priority is high');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      // Should find high priority tasks that are not done
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].id).toBe('1');
      expect(result.tasks[0].priority).toBe('high');
      expect(result.tasks[0].statusSymbol).not.toBe('x');
    });

    it('should support case-insensitive AND operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('not done and priority is high');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].id).toBe('1');
    });

    it('should support OR operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high OR priority is low');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      // Should find both high and low priority tasks
      expect(result.tasks.length).toBe(2);
      expect(result.tasks.some(t => t.id === '1')).toBe(true);
      expect(result.tasks.some(t => t.id === '3')).toBe(true);
    });

    it('should support case-insensitive OR operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high or priority is low');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(2);
    });

    it('should support NOT operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('NOT priority is high');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      // Should find all tasks except high priority
      expect(result.tasks.length).toBe(3);
      expect(result.tasks.every(t => t.priority !== 'high')).toBe(true);
    });

    it('should support case-insensitive NOT operator', () => {
      const parser = new QueryParser();
      const ast = parser.parse('not priority is high');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(3);
    });

    it('should support chained AND operators', () => {
      const parser = new QueryParser();
      const ast = parser.parse('not done AND priority is high AND description includes "priority"');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      // Should find high priority, not done tasks with "priority" in name
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].id).toBe('1');
    });

    it('should support complex boolean expressions', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high OR priority is medium');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(2);
      expect(result.tasks.some(t => t.id === '1')).toBe(true);
      expect(result.tasks.some(t => t.id === '2')).toBe(true);
    });
  });

  describe('QueryEngine validation API', () => {
    it('should validate a correct query', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.validateQuery('not done AND priority is high');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.parsedFilters).toBeDefined();
    });

    it('should validate complex queries', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.validateQuery('priority is high OR priority is low\nsort by due');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid queries', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.validateQuery('invalid query syntax');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject queries with syntax errors', () => {
      const engine = new QueryEngine(mockIndex);
      const result = engine.validateQuery('priority xyz abc');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Backward compatibility', () => {
    it('should still support simple "done" filter', () => {
      const parser = new QueryParser();
      const ast = parser.parse('done');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].id).toBe('3');
    });

    it('should still support simple "not done" filter', () => {
      const parser = new QueryParser();
      const ast = parser.parse('not done');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(3);
      expect(result.tasks.every(t => t.statusSymbol !== 'x')).toBe(true);
    });

    it('should still support priority filters without boolean operators', () => {
      const parser = new QueryParser();
      const ast = parser.parse('priority is high');
      const engine = new QueryEngine(mockIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].priority).toBe('high');
    });
  });

  describe('DateFilter with "between" operator', () => {
    const tasksWithDates: Task[] = [
      {
        id: '1',
        name: 'Task 1',
        statusSymbol: ' ',
        dueAt: '2024-01-15T10:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
      } as Task,
      {
        id: '2',
        name: 'Task 2',
        statusSymbol: ' ',
        dueAt: '2024-01-20T10:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
      } as Task,
      {
        id: '3',
        name: 'Task 3',
        statusSymbol: ' ',
        dueAt: '2024-01-25T10:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
      } as Task,
      {
        id: '4',
        name: 'Task 4',
        statusSymbol: ' ',
        dueAt: '2024-02-05T10:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
      } as Task,
    ];

    const dateIndex = {
      getAllTasks: () => tasksWithDates,
    };

    it('should filter tasks between two dates', () => {
      const parser = new QueryParser();
      const ast = parser.parse('due between 2024-01-20 and 2024-01-31');
      const engine = new QueryEngine(dateIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(2);
      expect(result.tasks.map(t => t.id)).toContain('2');
      expect(result.tasks.map(t => t.id)).toContain('3');
    });

    it('should include boundary dates in "between" filter', () => {
      const parser = new QueryParser();
      const ast = parser.parse('due between 2024-01-15 and 2024-01-20');
      const engine = new QueryEngine(dateIndex);
      const result = engine.execute(ast);
      
      expect(result.tasks.length).toBe(2);
      expect(result.tasks.map(t => t.id)).toContain('1');
      expect(result.tasks.map(t => t.id)).toContain('2');
    });

    it('should work with natural language dates in "between"', () => {
      const referenceDate = new Date('2024-01-15T12:00:00Z');
      const parser = new QueryParser();
      const ast = parser.parse('due between today and in 7 days', referenceDate);
      const engine = new QueryEngine(dateIndex);
      const result = engine.execute(ast);
      
      // Should match tasks within 7 days from reference date
      expect(result.tasks.length).toBeGreaterThan(0);
    });
  });
});
