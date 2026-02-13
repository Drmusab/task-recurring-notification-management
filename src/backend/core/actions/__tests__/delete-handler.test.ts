import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteHandler } from "@backend/core/actions/DeleteHandler";
import type { Task } from '@backend/core/models/Task';
import type { TaskStorage, SiYuanBlockAPI } from "@backend/core/actions/DeleteHandler";

describe('DeleteHandler', () => {
  let handler: DeleteHandler;
  let mockStorage: TaskStorage;
  let mockApi: SiYuanBlockAPI;
  let deletedTaskIds: string[];
  let deletedBlockIds: string[];

  beforeEach(() => {
    deletedTaskIds = [];
    deletedBlockIds = [];

    mockStorage = {
      async deleteTask(taskId: string) {
        deletedTaskIds.push(taskId);
      },
    };

    mockApi = {
      async deleteBlock(params: { id: string }) {
        deletedBlockIds.push(params.id);
      },
      async getChildBlocks(params: { id: string }) {
        return [];
      },
    };

    handler = new DeleteHandler(mockStorage, mockApi);
  });

  describe('safeDelete', () => {
    it('should delete task without nested items', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Test Task',
        dueAt: new Date('2025-01-20').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        linkedBlockId: 'block-123',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const result = await handler.safeDelete(task);

      expect(result.success).toBe(true);
      expect(deletedTaskIds).toContain('task-1');
      expect(deletedBlockIds).toContain('block-123');
    });

    it('should require confirmation when task has nested items', async () => {
      const mockApiWithChildren: SiYuanBlockAPI = {
        ...mockApi,
        async getChildBlocks(params: { id: string }) {
          return [{ id: 'child-1' }, { id: 'child-2' }];
        },
      };

      const handlerWithChildren = new DeleteHandler(mockStorage, mockApiWithChildren);

      const task: Task = {
        id: 'task-1',
        name: 'Task with Children',
        dueAt: new Date('2025-01-20').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        linkedBlockId: 'block-123',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const result = await handlerWithChildren.safeDelete(task, false);

      expect(result.success).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain('nested items');
      expect(deletedTaskIds).not.toContain('task-1');
    });

    it('should force delete task with nested items when force=true', async () => {
      const mockApiWithChildren: SiYuanBlockAPI = {
        ...mockApi,
        async getChildBlocks(params: { id: string }) {
          return [{ id: 'child-1' }, { id: 'child-2' }];
        },
      };

      const handlerWithChildren = new DeleteHandler(mockStorage, mockApiWithChildren);

      const task: Task = {
        id: 'task-1',
        name: 'Task with Children',
        dueAt: new Date('2025-01-20').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        linkedBlockId: 'block-123',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const result = await handlerWithChildren.safeDelete(task, true);

      expect(result.success).toBe(true);
      expect(deletedTaskIds).toContain('task-1');
      expect(deletedBlockIds).toContain('block-123');
    });

    it('should delete task without linked block', async () => {
      const task: Task = {
        id: 'task-1',
        name: 'Test Task',
        dueAt: new Date('2025-01-20').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        // No linkedBlockId
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const result = await handler.safeDelete(task);

      expect(result.success).toBe(true);
      expect(deletedTaskIds).toContain('task-1');
      expect(deletedBlockIds.length).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      const mockApiWithError: SiYuanBlockAPI = {
        async deleteBlock(params: { id: string }) {
          throw new Error('API error');
        },
        async getChildBlocks(params: { id: string }) {
          return [];
        },
      };

      const handlerWithError = new DeleteHandler(mockStorage, mockApiWithError);

      const task: Task = {
        id: 'task-1',
        name: 'Test Task',
        dueAt: new Date('2025-01-20').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        linkedBlockId: 'block-123',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const result = await handlerWithError.safeDelete(task);

      // Should still succeed deleting from storage, just log error for block
      expect(result.success).toBe(true);
      expect(deletedTaskIds).toContain('task-1');
    });
  });

  describe('hasNestedItems', () => {
    it('should return false when no block ID provided', async () => {
      const result = await handler.hasNestedItems(undefined);
      expect(result).toBe(false);
    });

    it('should return false when no API available', async () => {
      const handlerNoApi = new DeleteHandler(mockStorage);
      const result = await handlerNoApi.hasNestedItems('block-123');
      expect(result).toBe(false);
    });

    it('should return true when children exist', async () => {
      const mockApiWithChildren: SiYuanBlockAPI = {
        ...mockApi,
        async getChildBlocks(params: { id: string }) {
          return [{ id: 'child-1' }];
        },
      };

      const handlerWithChildren = new DeleteHandler(mockStorage, mockApiWithChildren);
      const result = await handlerWithChildren.hasNestedItems('block-123');
      expect(result).toBe(true);
    });

    it('should return false when no children exist', async () => {
      const result = await handler.hasNestedItems('block-123');
      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      const mockApiWithError: SiYuanBlockAPI = {
        async getChildBlocks(params: { id: string }) {
          throw new Error('API error');
        },
      };

      const handlerWithError = new DeleteHandler(mockStorage, mockApiWithError);
      const result = await handlerWithError.hasNestedItems('block-123');
      // Returns false on error to allow deletion
      expect(result).toBe(false);
    });
  });
});
