/**
 * Delete Handler for safe task deletion with nested items protection
 */

import type { Task } from "@backend/core/models/Task";
import * as logger from "@shared/utils/misc/logger";

export interface DeleteResult {
  success: boolean;
  requiresConfirmation?: boolean;
  warnings?: string[];
  error?: string;
}

export interface TaskStorage {
  deleteTask(taskId: string): Promise<void>;
}

export interface SiYuanBlockAPI {
  deleteBlock?(params: { id: string }): Promise<void>;
  getChildBlocks?(params: { id: string }): Promise<any[]>;
}

/**
 * DeleteHandler manages safe task deletion
 * Checks for nested items and provides warnings before deletion
 */
export class DeleteHandler {
  constructor(
    private storage: TaskStorage,
    private siyuanApi?: SiYuanBlockAPI
  ) {}

  /**
   * Safely delete a task with nested items protection
   * @param task - Task to delete
   * @param force - Force deletion even if nested items exist
   * @returns Delete result with warnings or errors
   */
  async safeDelete(task: Task, force: boolean = false): Promise<DeleteResult> {
    try {
      // 1. Check for nested items
      const hasNested = await this.hasNestedItems(task.linkedBlockId);
      
      if (hasNested && !force) {
        // Require confirmation for tasks with children
        logger.warn('Task has nested items, confirmation required', {
          taskId: task.id,
          blockId: task.linkedBlockId,
        });
        
        return {
          success: false,
          requiresConfirmation: true,
          warnings: [
            `Task "${task.name}" has nested items.`,
            'Deleting will remove all children.',
            'Please confirm or remove children first.'
          ],
        };
      }
      
      // 2. Delete from storage
      await this.storage.deleteTask(task.id);
      logger.info('Task deleted from storage', { taskId: task.id });
      
      // 3. Delete block from document if linked
      if (task.linkedBlockId) {
        await this.deleteBlock(task.linkedBlockId);
      }
      
      return {
        success: true,
      };
    } catch (err) {
      logger.error('Failed to delete task', {
        taskId: task.id,
        error: err,
      });
      
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Check if task has nested children (sub-items)
   * @param blockId - SiYuan block ID of the task
   * @returns true if task has child blocks
   */
  async hasNestedItems(blockId?: string): Promise<boolean> {
    if (!blockId) {
      return false;
    }
    
    if (!this.siyuanApi?.getChildBlocks) {
      // If API not available, assume no nested items (safer for deletion)
      logger.warn('SiYuan API not available for nested item check');
      return false;
    }
    
    try {
      const children = await this.siyuanApi.getChildBlocks({ id: blockId });
      return children && children.length > 0;
    } catch (err) {
      logger.error('Failed to check for nested items', { blockId, error: err });
      // On error, assume no nested items to allow deletion
      return false;
    }
  }

  /**
   * Delete block from SiYuan document
   */
  private async deleteBlock(blockId: string): Promise<void> {
    if (!this.siyuanApi?.deleteBlock) {
      logger.warn('SiYuan API not available, cannot delete block from document');
      return;
    }
    
    try {
      await this.siyuanApi.deleteBlock({ id: blockId });
      logger.info('Task block deleted from document', { blockId });
    } catch (err) {
      logger.error('Failed to delete task block from document', {
        blockId,
        error: err,
      });
      // Don't throw - task already deleted from storage
    }
  }
}
