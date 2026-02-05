/**
 * Bulk Actions Tests
 * Tests for bulk selection and bulk operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { bulkSelectionStore, selectedCount } from '@stores/bulk-selection.store';
import { 
  bulkComplete, 
  bulkSetPriority, 
  bulkReschedule, 
  bulkDelete,
  bulkCancel 
} from '@backend/blocks/bulk-operations';
import type { Task } from '@backend/core/models/Task';
import { createTask } from '@backend/core/models/Task';
import type { Frequency } from '@backend/core/models/Frequency';

describe('Bulk Selection Store', () => {
  beforeEach(() => {
    bulkSelectionStore.disableBulkMode();
  });

  it('should initialize in disabled state', () => {
    const state = get(bulkSelectionStore);
    expect(state.enabled).toBe(false);
    expect(state.selectedIds.size).toBe(0);
  });

  it('should enable bulk mode', () => {
    bulkSelectionStore.enableBulkMode();
    const state = get(bulkSelectionStore);
    expect(state.enabled).toBe(true);
  });

  it('should disable bulk mode and clear selections', () => {
    bulkSelectionStore.enableBulkMode();
    bulkSelectionStore.toggleTask('task1');
    bulkSelectionStore.disableBulkMode();
    
    const state = get(bulkSelectionStore);
    expect(state.enabled).toBe(false);
    expect(state.selectedIds.size).toBe(0);
  });

  it('should toggle task selection', () => {
    bulkSelectionStore.toggleTask('task1');
    let state = get(bulkSelectionStore);
    expect(state.selectedIds.has('task1')).toBe(true);
    
    bulkSelectionStore.toggleTask('task1');
    state = get(bulkSelectionStore);
    expect(state.selectedIds.has('task1')).toBe(false);
  });

  it('should select all tasks', () => {
    const taskIds = ['task1', 'task2', 'task3'];
    bulkSelectionStore.selectAll(taskIds);
    
    const state = get(bulkSelectionStore);
    expect(state.selectedIds.size).toBe(3);
    taskIds.forEach(id => {
      expect(state.selectedIds.has(id)).toBe(true);
    });
  });

  it('should clear all selections', () => {
    bulkSelectionStore.selectAll(['task1', 'task2', 'task3']);
    bulkSelectionStore.clear();
    
    const state = get(bulkSelectionStore);
    expect(state.selectedIds.size).toBe(0);
  });

  it('should support range selection', () => {
    const frequency: Frequency = { type: 'once' };
    const tasks = [
      createTask('Task 1', frequency),
      createTask('Task 2', frequency),
      createTask('Task 3', frequency),
      createTask('Task 4', frequency)
    ];
    
    bulkSelectionStore.rangeSelect(tasks[0].id, tasks[2].id, tasks);
    
    const state = get(bulkSelectionStore);
    expect(state.selectedIds.has(tasks[0].id)).toBe(true);
    expect(state.selectedIds.has(tasks[1].id)).toBe(true);
    expect(state.selectedIds.has(tasks[2].id)).toBe(true);
    expect(state.selectedIds.has(tasks[3].id)).toBe(false);
  });

  it('should count selected tasks', () => {
    bulkSelectionStore.toggleTask('task1');
    bulkSelectionStore.toggleTask('task2');
    
    const count = get(selectedCount);
    expect(count).toBe(2);
  });
});

describe('Bulk Operations', () => {
  const createTestTask = (name: string): Task => {
    const frequency: Frequency = { type: 'once' };
    return createTask(name, frequency);
  };

  describe('bulkComplete', () => {
    it('should mark all tasks as completed', () => {
      const tasks = [
        createTestTask('Task 1'),
        createTestTask('Task 2')
      ];
      
      const result = bulkComplete(tasks);
      
      expect(result.success).toBe(true);
      expect(result.updatedTasks).toHaveLength(2);
      result.updatedTasks.forEach(task => {
        expect(task.status).toBe('done');
        expect(task.enabled).toBe(false);
        expect(task.doneAt).toBeDefined();
      });
    });

    it('should update updatedAt timestamp', () => {
      const tasks = [createTestTask('Task 1')];
      const result = bulkComplete(tasks);
      
      expect(result.updatedTasks[0].updatedAt).toBeDefined();
    });
  });

  describe('bulkSetPriority', () => {
    it('should set priority for all tasks', () => {
      const tasks = [
        createTestTask('Task 1'),
        createTestTask('Task 2')
      ];
      
      const result = bulkSetPriority(tasks, 'high');
      
      expect(result.success).toBe(true);
      expect(result.updatedTasks).toHaveLength(2);
      result.updatedTasks.forEach(task => {
        expect(task.priority).toBe('high');
      });
    });

    it('should support all priority levels', () => {
      const task = createTestTask('Task 1');
      
      const priorities: Array<'highest' | 'high' | 'medium' | 'low' | 'lowest'> = [
        'highest', 'high', 'medium', 'low', 'lowest'
      ];
      
      priorities.forEach(priority => {
        const result = bulkSetPriority([task], priority);
        expect(result.updatedTasks[0].priority).toBe(priority);
      });
    });
  });

  describe('bulkReschedule', () => {
    it('should reschedule all tasks to new date', () => {
      const tasks = [
        createTestTask('Task 1'),
        createTestTask('Task 2')
      ];
      
      const newDate = new Date('2024-12-31');
      const result = bulkReschedule(tasks, newDate);
      
      expect(result.success).toBe(true);
      expect(result.updatedTasks).toHaveLength(2);
      result.updatedTasks.forEach(task => {
        expect(task.dueAt).toBe(newDate.toISOString());
      });
    });
  });

  describe('bulkDelete', () => {
    it('should return task IDs to delete', () => {
      const taskIds = ['task1', 'task2', 'task3'];
      const result = bulkDelete(taskIds);
      
      expect(result.success).toBe(true);
      expect(result.taskIds).toEqual(taskIds);
    });

    it('should handle empty array', () => {
      const result = bulkDelete([]);
      
      expect(result.success).toBe(true);
      expect(result.taskIds).toEqual([]);
    });
  });

  describe('bulkCancel', () => {
    it('should cancel all tasks', () => {
      const tasks = [
        createTestTask('Task 1'),
        createTestTask('Task 2')
      ];
      
      const result = bulkCancel(tasks);
      
      expect(result.success).toBe(true);
      expect(result.updatedTasks).toHaveLength(2);
      result.updatedTasks.forEach(task => {
        expect(task.status).toBe('cancelled');
        expect(task.enabled).toBe(false);
        expect(task.cancelledAt).toBeDefined();
      });
    });
  });
});

describe('Bulk Selection Scenarios', () => {
  const createTestTask = (name: string): Task => {
    const frequency: Frequency = { type: 'once' };
    return createTask(name, frequency);
  };

  beforeEach(() => {
    bulkSelectionStore.disableBulkMode();
  });

  it('should handle shift-click range selection', () => {
    const tasks = [
      createTestTask('Task 1'),
      createTestTask('Task 2'),
      createTestTask('Task 3'),
      createTestTask('Task 4'),
      createTestTask('Task 5')
    ];
    
    // Select first task
    bulkSelectionStore.toggleTask(tasks[0].id);
    
    // Shift-click on third task
    bulkSelectionStore.rangeSelect(tasks[0].id, tasks[2].id, tasks);
    
    const state = get(bulkSelectionStore);
    expect(state.selectedIds.size).toBe(3);
    expect(state.selectedIds.has(tasks[0].id)).toBe(true);
    expect(state.selectedIds.has(tasks[1].id)).toBe(true);
    expect(state.selectedIds.has(tasks[2].id)).toBe(true);
  });

  it('should maintain selections when entering/exiting bulk mode', () => {
    bulkSelectionStore.enableBulkMode();
    bulkSelectionStore.toggleTask('task1');
    bulkSelectionStore.toggleTask('task2');
    
    // Exiting bulk mode clears selections
    bulkSelectionStore.disableBulkMode();
    const state = get(bulkSelectionStore);
    expect(state.selectedIds.size).toBe(0);
  });

  it('should clear selections after bulk action', () => {
    const tasks = [createTestTask('Task 1')];
    
    bulkSelectionStore.toggleTask(tasks[0].id);
    bulkComplete(tasks);
    bulkSelectionStore.clear();
    
    const state = get(bulkSelectionStore);
    expect(state.selectedIds.size).toBe(0);
  });
});
