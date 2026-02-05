/**
 * Drag-to-Reorder Tests
 * Tests for drag-and-drop task reordering functionality
 */

import { describe, it, expect } from 'vitest';
import { updateTaskOrder, ensureTaskOrder, sortByOrder } from '@shared/utils/misc/reorderTasks';
import { reorderTasks, sortTasksByOrder, initializeTaskOrder } from '@/stores/taskOrderStore';
import type { Task } from '@backend/core/models/Task';
import { createTask } from '@backend/core/models/Task';
import type { Frequency } from '@backend/core/models/Frequency';

describe('Reorder Tasks Utility', () => {
  const createTestTask = (name: string, order?: number): Task => {
    const frequency: Frequency = { type: 'once' };
    const task = createTask(name, frequency);
    if (order !== undefined) task.order = order;
    return task;
  };

  describe('updateTaskOrder', () => {
    it('should reorder tasks when moved down', () => {
      const tasks = [
        createTestTask('Task 1', 0),
        createTestTask('Task 2', 1),
        createTestTask('Task 3', 2)
      ];
      
      const result = updateTaskOrder(tasks, 0, 2);
      
      expect(result[0].name).toBe('Task 2');
      expect(result[1].name).toBe('Task 3');
      expect(result[2].name).toBe('Task 1');
      
      // Check order fields are updated
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(2);
    });

    it('should reorder tasks when moved up', () => {
      const tasks = [
        createTestTask('Task 1', 0),
        createTestTask('Task 2', 1),
        createTestTask('Task 3', 2)
      ];
      
      const result = updateTaskOrder(tasks, 2, 0);
      
      expect(result[0].name).toBe('Task 3');
      expect(result[1].name).toBe('Task 1');
      expect(result[2].name).toBe('Task 2');
      
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(2);
    });

    it('should handle adjacent swaps', () => {
      const tasks = [
        createTestTask('Task 1', 0),
        createTestTask('Task 2', 1)
      ];
      
      const result = updateTaskOrder(tasks, 0, 1);
      
      expect(result[0].name).toBe('Task 2');
      expect(result[1].name).toBe('Task 1');
    });
  });

  describe('ensureTaskOrder', () => {
    it('should add order to tasks without it', () => {
      const tasks = [
        createTestTask('Task 1'),
        createTestTask('Task 2'),
        createTestTask('Task 3')
      ];
      
      const result = ensureTaskOrder(tasks);
      
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(2);
    });

    it('should preserve existing order', () => {
      const tasks = [
        createTestTask('Task 1', 5),
        createTestTask('Task 2', 3),
        createTestTask('Task 3')
      ];
      
      const result = ensureTaskOrder(tasks);
      
      expect(result[0].order).toBe(5);
      expect(result[1].order).toBe(3);
      expect(result[2].order).toBe(2);
    });
  });

  describe('sortByOrder', () => {
    it('should sort tasks by order field', () => {
      const tasks = [
        createTestTask('Task 3', 2),
        createTestTask('Task 1', 0),
        createTestTask('Task 2', 1)
      ];
      
      const result = sortByOrder(tasks);
      
      expect(result[0].name).toBe('Task 1');
      expect(result[1].name).toBe('Task 2');
      expect(result[2].name).toBe('Task 3');
    });

    it('should handle tasks without order', () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 1000);
      
      const tasks = [
        { ...createTestTask('Task 2'), createdAt: now.toISOString() },
        { ...createTestTask('Task 1'), createdAt: earlier.toISOString() }
      ];
      
      const result = sortByOrder(tasks);
      
      expect(result[0].name).toBe('Task 1');
      expect(result[1].name).toBe('Task 2');
    });

    it('should prioritize order over creation date', () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 1000);
      
      const tasks = [
        { ...createTestTask('Task 1', 1), createdAt: earlier.toISOString() },
        { ...createTestTask('Task 2', 0), createdAt: now.toISOString() }
      ];
      
      const result = sortByOrder(tasks);
      
      expect(result[0].name).toBe('Task 2');
      expect(result[1].name).toBe('Task 1');
    });
  });
});

describe('Task Order Store', () => {
  const createTestTask = (name: string, order?: number): Task => {
    const frequency: Frequency = { type: 'once' };
    const task = createTask(name, frequency);
    if (order !== undefined) task.order = order;
    return task;
  };

  describe('reorderTasks', () => {
    it('should assign sequential order to tasks', () => {
      const tasks = [
        createTestTask('Task 1'),
        createTestTask('Task 2'),
        createTestTask('Task 3')
      ];
      
      const result = reorderTasks(tasks);
      
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(2);
    });

    it('should override existing order', () => {
      const tasks = [
        createTestTask('Task 1', 5),
        createTestTask('Task 2', 3),
        createTestTask('Task 3', 1)
      ];
      
      const result = reorderTasks(tasks);
      
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(2);
    });
  });

  describe('sortTasksByOrder', () => {
    it('should sort tasks by order field', () => {
      const tasks = [
        createTestTask('Task 3', 2),
        createTestTask('Task 1', 0),
        createTestTask('Task 2', 1)
      ];
      
      const result = sortTasksByOrder(tasks);
      
      expect(result[0].name).toBe('Task 1');
      expect(result[1].name).toBe('Task 2');
      expect(result[2].name).toBe('Task 3');
    });

    it('should put tasks without order at the end', () => {
      const tasks = [
        createTestTask('Task 3'),
        createTestTask('Task 1', 0),
        createTestTask('Task 2', 1)
      ];
      
      const result = sortTasksByOrder(tasks);
      
      expect(result[0].name).toBe('Task 1');
      expect(result[1].name).toBe('Task 2');
      expect(result[2].name).toBe('Task 3');
    });
  });

  describe('initializeTaskOrder', () => {
    it('should initialize order for all tasks', () => {
      const tasks = [
        createTestTask('Task 1'),
        createTestTask('Task 2'),
        createTestTask('Task 3')
      ];
      
      const result = initializeTaskOrder(tasks);
      
      result.forEach((task, index) => {
        expect(task.order).toBe(index);
      });
    });

    it('should preserve existing order values', () => {
      const tasks = [
        createTestTask('Task 1', 5),
        createTestTask('Task 2'),
        createTestTask('Task 3', 3)
      ];
      
      const result = initializeTaskOrder(tasks);
      
      expect(result[0].order).toBe(5);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(3);
    });
  });
});

describe('Drag Order Persistence', () => {
  const createTestTask = (name: string, order?: number): Task => {
    const frequency: Frequency = { type: 'once' };
    const task = createTask(name, frequency);
    if (order !== undefined) task.order = order;
    return task;
  };
  
  it('should maintain order after filter changes', () => {
    const frequency: Frequency = { type: 'once' };
    const tasks = [
      { ...createTask('Task 1', frequency), order: 0, priority: 'high' },
      { ...createTask('Task 2', frequency), order: 1, priority: 'low' },
      { ...createTask('Task 3', frequency), order: 2, priority: 'high' }
    ];
    
    // Filter by priority
    const highPriority = tasks.filter(t => t.priority === 'high');
    const sorted = sortByOrder(highPriority);
    
    expect(sorted[0].order).toBe(0);
    expect(sorted[1].order).toBe(2);
  });

  it('should preserve relative order when tasks are removed', () => {
    const tasks = [
      createTestTask('Task 1', 0),
      createTestTask('Task 2', 1),
      createTestTask('Task 3', 2),
      createTestTask('Task 4', 3)
    ];
    
    // Remove middle task
    const remaining = [tasks[0], tasks[2], tasks[3]];
    const sorted = sortByOrder(remaining);
    
    expect(sorted[0].order).toBe(0);
    expect(sorted[1].order).toBe(2);
    expect(sorted[2].order).toBe(3);
  });
});
