import { describe, it, expect, beforeEach } from 'vitest';
import { OnCompletionHandler } from '../OnCompletion';
import type { Task } from '@backend/core/models/Task';

describe('OnCompletionHandler', () => {
  let handler: OnCompletionHandler;
  let mockTask: Task;

  beforeEach(() => {
    handler = new OnCompletionHandler();
    mockTask = {
      id: 'test-task-1',
      name: 'Test Task',
      dueAt: new Date('2025-01-20').toISOString(),
      frequency: { type: 'daily', interval: 1 },
      enabled: true,
      createdAt: new Date('2025-01-01').toISOString(),
      updatedAt: new Date('2025-01-01').toISOString(),
    };
  });

  describe('keep action', () => {
    it('should successfully execute keep action', async () => {
      const result = await handler.execute(mockTask, 'keep');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should keep task in place without warnings', async () => {
      const result = await handler.execute(mockTask, 'keep');
      expect(result.warnings).toBeUndefined();
    });
  });

  describe('delete action', () => {
    it('should warn when task has no linkedBlockId', async () => {
      const result = await handler.execute(mockTask, 'delete');
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain('no linked block');
    });

    it('should prevent deletion when API is not available (safe default)', async () => {
      const taskWithBlock = {
        ...mockTask,
        linkedBlockId: 'block-123',
      };

      const result = await handler.execute(taskWithBlock, 'delete');
      expect(result.success).toBe(false);
      expect(result.error).toContain('nested items');
    });

    it('should prevent deletion when task has nested items', async () => {
      const mockApi = {
        getChildBlocks: async () => [{ id: 'child-1' }],
      };
      const handlerWithApi = new OnCompletionHandler(mockApi);
      
      const taskWithBlock = {
        ...mockTask,
        linkedBlockId: 'block-123',
      };

      const result = await handlerWithApi.execute(taskWithBlock, 'delete');
      expect(result.success).toBe(false);
      expect(result.error).toContain('nested items');
      expect(result.warnings).toBeDefined();
    });

    it('should successfully delete when no nested items exist', async () => {
      let deletedBlockId: string | undefined;
      const mockApi = {
        getChildBlocks: async () => [],
        deleteBlock: async ({ id }: { id: string }) => {
          deletedBlockId = id;
        },
      };
      const handlerWithApi = new OnCompletionHandler(mockApi);
      
      const taskWithBlock = {
        ...mockTask,
        linkedBlockId: 'block-123',
      };

      const result = await handlerWithApi.execute(taskWithBlock, 'delete');
      expect(result.success).toBe(true);
      expect(deletedBlockId).toBe('block-123');
    });

    it('should handle API errors gracefully', async () => {
      const mockApi = {
        getChildBlocks: async () => {
          throw new Error('API error');
        },
      };
      const handlerWithApi = new OnCompletionHandler(mockApi);
      
      const taskWithBlock = {
        ...mockTask,
        linkedBlockId: 'block-123',
      };

      // Should assume has nested items on error (safe default)
      const result = await handlerWithApi.execute(taskWithBlock, 'delete');
      expect(result.success).toBe(false);
      expect(result.error).toContain('nested items');
    });
  });

  describe('hasNestedItems', () => {
    it('should return true when API not available (safe default)', async () => {
      const result = await handler.hasNestedItems('block-123');
      expect(result).toBe(true);
    });

    it('should return true when children exist', async () => {
      const mockApi = {
        getChildBlocks: async () => [{ id: 'child-1' }, { id: 'child-2' }],
      };
      const handlerWithApi = new OnCompletionHandler(mockApi);
      
      const result = await handlerWithApi.hasNestedItems('block-123');
      expect(result).toBe(true);
    });

    it('should return false when no children exist', async () => {
      const mockApi = {
        getChildBlocks: async () => [],
      };
      const handlerWithApi = new OnCompletionHandler(mockApi);
      
      const result = await handlerWithApi.hasNestedItems('block-123');
      expect(result).toBe(false);
    });

    it('should return true on error (safe default)', async () => {
      const mockApi = {
        getChildBlocks: async () => {
          throw new Error('Network error');
        },
      };
      const handlerWithApi = new OnCompletionHandler(mockApi);
      
      const result = await handlerWithApi.hasNestedItems('block-123');
      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle unknown action type', async () => {
      const result = await handler.execute(mockTask, 'unknown' as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown');
    });
  });
});
