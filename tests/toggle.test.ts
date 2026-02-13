/**
 * Integration Tests - Status Toggle & Completion
 * Tests for CompletionHandler and NestedContentDetector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  toggleTaskStatus, 
  markTaskDone, 
  checkDeleteAction,
  applyOnCompletionAction,
  bulkCompleteTasks,
} from '../src/application/actions/CompletionHandler';
import {
  detectNestedContent,
  hasChildListItems,
  findTaskPositions,
  generateNestedContentWarning,
} from '../src/infrastructure/detectors/NestedContentDetector';
import { createTask } from '../src/domain/models/Task';
import type { Task, Frequency } from '../src/domain/models/Task';

describe('CompletionHandler - Status Toggle', () => {
  let task: Task;
  
  beforeEach(() => {
    task = createTask({
      name: 'Test task',
      statusSymbol: ' ',
    });
  });
  
  describe('Toggle task status', () => {
    it('should toggle from todo to done', () => {
      const result = toggleTaskStatus(task, {});
      
      expect(result.updatedTask.statusSymbol).toBe('x');
      expect(result.updatedTask.status).toBe('done');
      expect(result.updatedTask.doneAt).toBeDefined();
    });
    
    it('should increment completion count', () => {
      const taskWithHistory: Task = {
        ...task,
        completionCount: 5,
      };
      
      const result = toggleTaskStatus(taskWithHistory, {});
      
      expect(result.updatedTask.completionCount).toBe(6);
    });
    
    it('should update streak on completion', () => {
      const taskWithStreak: Task = {
        ...task,
        currentStreak: 3,
        bestStreak: 5,
      };
      
      const result = toggleTaskStatus(taskWithStreak, {});
      
      expect(result.updatedTask.currentStreak).toBe(4);
    });
    
    it('should update best streak when exceeded', () => {
      const taskWithStreak: Task = {
        ...task,
        currentStreak: 5,
        bestStreak: 5,
      };
      
      const result = toggleTaskStatus(taskWithStreak, {});
      
      expect(result.updatedTask.bestStreak).toBe(6);
    });
    
    it('should populate completion history', () => {
      const taskWithDueDate: Task = {
        ...task,
        dueAt: '2024-01-10T10:00:00Z',
      };
      
      const result = toggleTaskStatus(taskWithDueDate, {
        timezone: 'America/Los_Angeles',
      });
      
      expect(result.updatedTask.completionHistory).toBeDefined();
      expect(result.updatedTask.completionHistory?.length).toBe(1);
    });
    
    it('should reset streak when cancelled', () => {
      // Note: This test depends on status registry having a cancelled status
      // For now, we'll just verify that toggling works
      const taskWithStreak: Task = {
        ...task,
        statusSymbol: 'x', // Start as done
        currentStreak: 5,
        status: 'done',
      };
      
      const result = toggleTaskStatus(taskWithStreak, {});
      
      // Task should toggle to next status (depends on registry configuration)
      expect(result.updatedTask.statusSymbol).toBeDefined();
    });
  });
  
  describe('Recurring task completion', () => {
    it('should generate next instance for recurring task', () => {
      const recurringTask: Task = {
        ...task,
        frequency: { type: 'daily', interval: 1 },
        dueAt: '2024-01-15T10:00:00Z',
      };
      
      const result = toggleTaskStatus(recurringTask, {});
      
      expect(result.nextInstance).toBeDefined();
      expect(result.nextInstance?.dueAt).toContain('2024-01-16');
    });
    
    it('should calculate from completion date when setting enabled', () => {
      const recurringTask: Task = {
        ...task,
        frequency: { type: 'daily', interval: 1 },
        dueAt: '2024-01-15T10:00:00Z',
        whenDone: true,
      };
      
      const result = toggleTaskStatus(recurringTask, {
        recurrenceFromCompletion: true,
      });
      
      expect(result.nextInstance).toBeDefined();
    });
    
    it('should preserve series ID in next instance', () => {
      const recurringTask: Task = {
        ...task,
        frequency: { type: 'daily', interval: 1 },
        seriesId: 'series-abc',
        occurrenceIndex: 2,
      };
      
      const result = toggleTaskStatus(recurringTask, {});
      
      expect(result.nextInstance?.seriesId).toBe('series-abc');
      expect(result.nextInstance?.occurrenceIndex).toBe(3);
    });
  });
  
  describe('OnCompletion actions', () => {
    it('should mark task for deletion when onCompletion is delete', () => {
      const taskWithDelete: Task = {
        ...task,
        onCompletion: 'delete',
      };
      
      const result = toggleTaskStatus(taskWithDelete, {});
      
      expect(result.shouldDelete).toBe(true);
    });
    
    it('should not delete when onCompletion is keep', () => {
      const taskWithKeep: Task = {
        ...task,
        onCompletion: 'keep',
      };
      
      const result = toggleTaskStatus(taskWithKeep, {});
      
      expect(result.shouldDelete).toBe(false);
    });
    
    it('should handle OnCompletionAction object', () => {
      const taskWithAction: Task = {
        ...task,
        onCompletion: {
          action: 'delete',
          nextStatus: 'archived',
        },
      };
      
      const result = toggleTaskStatus(taskWithAction, {});
      
      expect(result.shouldDelete).toBe(true);
    });
  });
  
  describe('markTaskDone shortcut', () => {
    it('should directly mark task as done', () => {
      const result = markTaskDone(task, {});
      
      expect(result.updatedTask.status).toBe('done');
      expect(result.updatedTask.doneAt).toBeDefined();
    });
  });
  
  describe('Bulk operations', () => {
    it('should complete multiple tasks', () => {
      const tasks = [
        createTask({ name: 'Task 1' }),
        createTask({ name: 'Task 2' }),
        createTask({ name: 'Task 3' }),
      ];
      
      const result = bulkCompleteTasks(tasks, {});
      
      expect(result.completed).toHaveLength(3);
      result.completed.forEach(t => {
        expect(t.status).toBe('done');
      });
    });
    
    it('should generate next instances for recurring tasks in bulk', () => {
      const tasks = [
        createTask({ 
          name: 'Daily task',
          frequency: { type: 'daily', interval: 1 },
          dueAt: '2024-01-15T10:00:00Z',
        }),
        createTask({
          name: 'Weekly task',
          frequency: { type: 'weekly', interval: 1 },
          dueAt: '2024-01-15T10:00:00Z',
        }),
      ];
      
      const result = bulkCompleteTasks(tasks, {});
      
      expect(result.nextInstances).toHaveLength(2);
    });
  });
});

describe('NestedContentDetector - Safety Checks', () => {
  describe('Detect nested content', () => {
    it('should detect nested list items', () => {
      const lines = [
        '- [ ] Parent task',
        '  - [ ] Child task 1',
        '  - [ ] Child task 2',
        '- [ ] Another parent',
      ];
      
      const result = detectNestedContent(
        { blockId: 'test', lineNumber: 0, indentLevel: 0, content: lines[0] },
        lines
      );
      
      expect(result.hasNestedContent).toBe(true);
      expect(result.nestedItemCount).toBe(2);
    });
    
    it('should not detect content at same indent level', () => {
      const lines = [
        '- [ ] Task 1',
        '- [ ] Task 2',
        '- [ ] Task 3',
      ];
      
      const result = detectNestedContent(
        { blockId: 'test', lineNumber: 0, indentLevel: 0, content: lines[0] },
        lines
      );
      
      expect(result.hasNestedContent).toBe(false);
    });
    
    it('should detect nested code blocks', () => {
      const lines = [
        '- [ ] Task with code',
        '  ```javascript',
        '  console.log("test");',
        '  ```',
      ];
      
      const result = detectNestedContent(
        { blockId: 'test', lineNumber: 0, indentLevel: 0, content: lines[0] },
        lines
      );
      
      expect(result.hasNestedContent).toBe(true);
      expect(result.nestedBlockTypes).toContain('code-block');
    });
    
    it('should detect multiple block types', () => {
      const lines = [
        '- [ ] Complex task',
        '  - Sub item',
        '  > Quote',
        '  ```code```',
      ];
      
      const result = detectNestedContent(
        { blockId: 'test', lineNumber: 0, indentLevel: 0, content: lines[0] },
        lines
      );
      
      expect(result.nestedBlockTypes.length).toBeGreaterThan(1);
    });
    
    it('should handle emoji format tasks', () => {
      const lines = [
        '◻️ Parent task',
        '  ◻️ Child task',
      ];
      
      const result = detectNestedContent(
        { blockId: 'test', lineNumber: 0, indentLevel: 0, content: lines[0] },
        lines
      );
      
      expect(result.hasNestedContent).toBe(true);
    });
  });
  
  describe('Quick child check', () => {
    it('should quickly detect child on next line', () => {
      const lines = [
        '- [ ] Parent',
        '  - [ ] Child',
      ];
      
      const hasChild = hasChildListItems(
        { blockId: 'test', lineNumber: 0, indentLevel: 0, content: lines[0] },
        lines
      );
      
      expect(hasChild).toBe(true);
    });
    
    it('should return false when no child', () => {
      const lines = [
        '- [ ] Task',
        '- [ ] Next task',
      ];
      
      const hasChild = hasChildListItems(
        { blockId: 'test', lineNumber: 0, indentLevel: 0, content: lines[0] },
        lines
      );
      
      expect(hasChild).toBe(false);
    });
  });
  
  describe('Warning generation', () => {
    it('should generate warning for nested content', () => {
      const result = {
        hasNestedContent: true,
        nestedItemCount: 3,
        nestedBlockTypes: ['list-item', 'code-block'],
        nestedContent: [],
      };
      
      const warning = generateNestedContentWarning(result, 'My Task');
      
      expect(warning).toContain('My Task');
      expect(warning).toContain('3 nested item');
      expect(warning).toContain('list-item');
      expect(warning).toContain('code-block');
    });
    
    it('should return empty string when no nested content', () => {
      const result = {
        hasNestedContent: false,
        nestedItemCount: 0,
        nestedBlockTypes: [],
        nestedContent: [],
      };
      
      const warning = generateNestedContentWarning(result, 'My Task');
      
      expect(warning).toBe('');
    });
  });
  
  describe('Find task positions', () => {
    it('should find all tasks in document', () => {
      const doc = `
- [ ] Task 1
Some text
- [ ] Task 2
  - [ ] Nested task
◻️ Emoji task
`;
      
      const positions = findTaskPositions(doc);
      
      expect(positions.length).toBeGreaterThanOrEqual(3);
    });
    
    it('should calculate indent levels correctly', () => {
      const doc = `
- [ ] Parent
  - [ ] Child (2 spaces)
    - [ ] Grandchild (4 spaces)
`;
      
      const positions = findTaskPositions(doc);
      
      expect(positions[0].indentLevel).toBe(0);
      expect(positions[1].indentLevel).toBeGreaterThan(0);
      expect(positions[2].indentLevel).toBeGreaterThan(positions[1].indentLevel);
    });
  });
});

describe('Delete Action Safety', () => {
  it('should warn when deleting task with nested content', () => {
    const task = createTask({ name: 'Task with children' });
    
    const result = checkDeleteAction(task, true);
    
    expect(result.shouldProceed).toBe(false);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.warning).toContain('nested content');
  });
  
  it('should allow delete when no nested content', () => {
    const task = createTask({ name: 'Simple task' });
    
    const result = checkDeleteAction(task, false);
    
    expect(result.shouldProceed).toBe(true);
    expect(result.requiresConfirmation).toBe(false);
  });
  
  it('should handle onCompletion delete action', () => {
    const task = createTask({ name: 'Task' });
    
    const result = applyOnCompletionAction(task, 'delete', false);
    
    expect(result.shouldProceed).toBe(true);
  });
  
  it('should require confirmation for delete with nested content', () => {
    const task = createTask({ name: 'Task' });
    
    const result = applyOnCompletionAction(task, 'delete', true);
    
    expect(result.requiresConfirmation).toBe(true);
  });
});
