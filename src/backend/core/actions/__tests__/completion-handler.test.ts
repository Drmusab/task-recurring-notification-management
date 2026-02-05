import { describe, it, expect, beforeEach } from 'vitest';
import { CompletionHandler } from "@backend/core/actions/CompletionHandler";
import type { Task } from '@backend/core/models/Task';
import type { TaskStorage, SiYuanBlockAPI } from "@backend/core/actions/CompletionHandler";
import { RecurrenceEngineRRULE as RecurrenceEngine } from '@backend/core/engine/recurrence/RecurrenceEngineRRULE';
import { DEFAULT_SETTINGS } from '@backend/core/settings/PluginSettings';

describe('CompletionHandler', () => {
  let handler: CompletionHandler;
  let mockStorage: TaskStorage;
  let mockApi: SiYuanBlockAPI;
  let recurrenceEngine: RecurrenceEngine;
  let savedTasks: Task[];
  let deletedTaskIds: string[];
  let insertedBlocks: Array<{ blockId: string; markdown: string; placement: 'above' | 'below' }>;

  beforeEach(() => {
    savedTasks = [];
    deletedTaskIds = [];
    insertedBlocks = [];

    mockStorage = {
      async saveTask(task: Task) {
        savedTasks.push(task);
      },
      async deleteTask(taskId: string) {
        deletedTaskIds.push(taskId);
      },
    };

    mockApi = {
      async insertBlockAbove(blockId: string, markdown: string) {
        insertedBlocks.push({ blockId, markdown, placement: 'above' });
        return { id: 'new-block-above-' + blockId };
      },
      async insertBlockBelow(blockId: string, markdown: string) {
        insertedBlocks.push({ blockId, markdown, placement: 'below' });
        return { id: 'new-block-below-' + blockId };
      },
      async deleteBlock(params: { id: string }) {
        // No-op for tests
      },
      async getChildBlocks(params: { id: string }) {
        return [];
      },
    };

    recurrenceEngine = new RecurrenceEngine();
    handler = new CompletionHandler(
      mockStorage,
      recurrenceEngine,
      DEFAULT_SETTINGS,
      mockApi
    );
  });

  describe('onComplete', () => {
    it('should add done date when completing a task', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Test Task',
        dueAt: new Date('2025-01-20T09:00:00Z').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        status: 'done',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const completionDate = new Date('2025-01-20T15:00:00Z');
      const result = await handler.onComplete(task, completionDate);

      expect(result.success).toBe(true);
      expect(savedTasks.length).toBeGreaterThan(0);
    });

    it('should generate next recurrence instance', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Daily Task',
        dueAt: new Date('2025-01-20T09:00:00Z').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        status: 'done',
        linkedBlockId: 'block-123',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const completionDate = new Date('2025-01-20T15:00:00Z');
      const result = await handler.onComplete(task, completionDate);

      expect(result.success).toBe(true);
      expect(result.nextTask).toBeDefined();
      expect(result.nextTask?.dueAt).toBe(new Date('2025-01-21T09:00:00Z').toISOString());
      expect(result.nextTask?.status).toBe('todo');
      expect(result.nextTask?.doneAt).toBeUndefined();
    });

    it('should calculate next from completion date when whenDone is true', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'WhenDone Task',
        dueAt: new Date('2025-01-20T09:00:00Z').toISOString(),
        frequency: { type: 'daily', interval: 1, whenDone: true },
        enabled: true,
        status: 'done',
        linkedBlockId: 'block-123',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const completionDate = new Date('2025-01-22T15:00:00Z'); // 2 days late
      const result = await handler.onComplete(task, completionDate);

      expect(result.success).toBe(true);
      expect(result.nextTask).toBeDefined();
      // Next should be 1 day after completion, not after original due
      expect(result.nextTask?.dueAt).toBe(new Date('2025-01-23T15:00:00Z').toISOString());
    });

    it('should place next instance below when configured', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Daily Task',
        dueAt: new Date('2025-01-20T09:00:00Z').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        status: 'done',
        linkedBlockId: 'block-123',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const completionDate = new Date('2025-01-20T15:00:00Z');
      const result = await handler.onComplete(task, completionDate);

      expect(result.success).toBe(true);
      expect(insertedBlocks.length).toBe(1);
      expect(insertedBlocks[0].placement).toBe('below');
      expect(insertedBlocks[0].blockId).toBe('block-123');
    });

    it('should delete task when onCompletion is delete and no nested items', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'One-time Task',
        dueAt: new Date('2025-01-20T09:00:00Z').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        status: 'done',
        linkedBlockId: 'block-123',
        onCompletion: 'delete',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const completionDate = new Date('2025-01-20T15:00:00Z');
      const result = await handler.onComplete(task, completionDate);

      expect(result.success).toBe(true);
      expect(deletedTaskIds).toContain('task-1');
    });

    it('should keep task when onCompletion is delete but has nested items', async () => {
      const mockApiWithChildren: SiYuanBlockAPI = {
        ...mockApi,
        async getChildBlocks(params: { id: string }) {
          return [{ id: 'child-1' }];
        },
      };

      const handlerWithChildren = new CompletionHandler(
        mockStorage,
        recurrenceEngine,
        DEFAULT_SETTINGS,
        mockApiWithChildren
      );

      const task: Task = {
        id: 'task-1',
        name: 'Task with Children',
        dueAt: new Date('2025-01-20T09:00:00Z').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        status: 'done',
        linkedBlockId: 'block-123',
        onCompletion: 'delete',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const completionDate = new Date('2025-01-20T15:00:00Z');
      const result = await handlerWithChildren.onComplete(task, completionDate);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain('nested items');
      expect(deletedTaskIds).not.toContain('task-1');
      expect(savedTasks.some(t => t.id === 'task-1')).toBe(true);
    });

    it('should remove scheduled date when removeScheduledOnRecurrence is enabled', async () => {
      const settingsWithRemove = {
        ...DEFAULT_SETTINGS,
        recurrence: {
          ...DEFAULT_SETTINGS.recurrence,
          removeScheduledOnRecurrence: true,
        },
      };

      const handlerWithRemove = new CompletionHandler(
        mockStorage,
        recurrenceEngine,
        settingsWithRemove,
        mockApi
      );

      const task: Task = {
        id: 'task-1',
        name: 'Task with Scheduled',
        dueAt: new Date('2025-01-20T09:00:00Z').toISOString(),
        scheduledAt: new Date('2025-01-19T09:00:00Z').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        status: 'done',
        linkedBlockId: 'block-123',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const completionDate = new Date('2025-01-20T15:00:00Z');
      const result = await handlerWithRemove.onComplete(task, completionDate);

      expect(result.success).toBe(true);
      expect(result.nextTask).toBeDefined();
      expect(result.nextTask?.scheduledAt).toBeUndefined();
    });

    it('should handle tasks without recurrence', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'One-time Task',
        dueAt: new Date('2025-01-20T09:00:00Z').toISOString(),
        enabled: true,
        status: 'done',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      } as Task;

      const completionDate = new Date('2025-01-20T15:00:00Z');
      const result = await handler.onComplete(task, completionDate);

      expect(result.success).toBe(true);
      expect(result.nextTask).toBeUndefined();
      expect(savedTasks.some(t => t.id === 'task-1')).toBe(true);
    });
  });
});
