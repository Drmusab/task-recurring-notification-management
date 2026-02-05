import type { Task, OnCompletionAction as TaskOnCompletionAction } from "@backend/core/models/Task";
import * as logger from "@backend/logging/logger";

export type OnCompletionAction = 'keep' | 'delete' | 'archive' | 'customTransition';

export interface OnCompletionResult {
  success: boolean;
  warnings?: string[];
  error?: string;
  updatedTask?: Task;
}

/**
 * Handler for task completion actions
 * Manages what happens to a task when it's completed (keep, delete, archive, or custom transition)
 */
export class OnCompletionHandler {
  private siyuanApi: any;
  private archiveStorage?: any; // Storage for archived tasks

  constructor(siyuanApi?: any, archiveStorage?: any) {
    this.siyuanApi = siyuanApi;
    this.archiveStorage = archiveStorage;
  }

  /**
   * Execute the onCompletion action for a task
   * @param task - The task being completed
   * @param action - keep, delete, archive, or custom action object
   * @returns Result with success/error, warnings, and potentially updated task
   */
  async execute(task: Task, action: OnCompletionAction | TaskOnCompletionAction): Promise<OnCompletionResult> {
    try {
      // Handle legacy string format
      if (typeof action === 'string') {
        return this.executeSimpleAction(task, action);
      }
      
      // Handle new object format
      const actionObj = action as TaskOnCompletionAction;
      
      switch (actionObj.action) {
        case 'keep':
          return this.executeKeepAction(task);
        
        case 'delete':
          return this.executeDeleteAction(task);
        
        case 'archive':
          return this.executeArchiveAction(task);
        
        case 'customTransition':
          return this.executeCustomTransition(task, actionObj.nextStatus, actionObj.customHandler);
        
        default:
          return {
            success: false,
            error: `Unknown onCompletion action: ${actionObj.action}`
          };
      }
    } catch (err) {
      logger.error(`Failed to execute onCompletion action`, {
        taskId: task.id,
        action,
        error: err
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Execute simple action (legacy format support)
   */
  private async executeSimpleAction(task: Task, action: OnCompletionAction): Promise<OnCompletionResult> {
    switch (action) {
      case 'keep':
        return this.executeKeepAction(task);
      case 'delete':
        return this.executeDeleteAction(task);
      case 'archive':
        return this.executeArchiveAction(task);
      default:
        return {
          success: false,
          error: `Unknown onCompletion action: ${action}`
        };
    }
  }

  /**
   * Keep action: task stays in place, just marked as done
   */
  private async executeKeepAction(task: Task): Promise<OnCompletionResult> {
    logger.info(`Task "${task.name}" completed and kept`, { taskId: task.id });
    return { success: true };
  }

  /**
   * Delete action: remove task from document
   */
  private async executeDeleteAction(task: Task): Promise<OnCompletionResult> {
    // Delete action: check for nested items first
    if (!task.linkedBlockId) {
      // No linked block, can't delete from document
      logger.warn(`Task "${task.name}" has no linkedBlockId, cannot delete from document`, { taskId: task.id });
      return { 
        success: true,
        warnings: ['Task has no linked block, removed from task list only']
      };
    }

    // Check for nested items
    const hasNested = await this.hasNestedItems(task.linkedBlockId);
    if (hasNested) {
      logger.warn(`Cannot delete task with nested items`, { 
        taskId: task.id, 
        blockId: task.linkedBlockId 
      });
      return {
        success: false,
        error: "Cannot delete task with nested items",
        warnings: ['Task has sub-items. Please remove them first or use "keep" mode.']
      };
    }

    // Safe to delete
    if (this.siyuanApi && this.siyuanApi.deleteBlock) {
      await this.siyuanApi.deleteBlock({ id: task.linkedBlockId });
      logger.info(`Task "${task.name}" completed and deleted from document`, { 
        taskId: task.id,
        blockId: task.linkedBlockId 
      });
    } else {
      logger.warn('SiYuan API not available, cannot delete block from document');
      return {
        success: true,
        warnings: ['Block could not be deleted from document (API unavailable)']
      };
    }

    return { success: true };
  }

  /**
   * Archive action: move task to archive storage
   */
  private async executeArchiveAction(task: Task): Promise<OnCompletionResult> {
    if (!this.archiveStorage) {
      logger.warn('Archive storage not configured, falling back to keep');
      return this.executeKeepAction(task);
    }

    try {
      // Archive the task
      await this.archiveStorage.archive(task);
      logger.info(`Task "${task.name}" completed and archived`, { taskId: task.id });
      
      // If task has a linked block, optionally hide or mark it
      if (task.linkedBlockId && this.siyuanApi && this.siyuanApi.updateBlock) {
        // Could add an archived tag or update the block content
        logger.info(`Task block archived`, { blockId: task.linkedBlockId });
      }
      
      return { success: true };
    } catch (err) {
      logger.error('Failed to archive task', { taskId: task.id, error: err });
      return {
        success: false,
        error: `Failed to archive task: ${err instanceof Error ? err.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Custom transition action: change task status to a custom value
   */
  private async executeCustomTransition(task: Task, nextStatus?: string, customHandler?: string): Promise<OnCompletionResult> {
    if (!nextStatus) {
      return {
        success: false,
        error: 'Custom transition requires nextStatus to be specified'
      };
    }

    // Allow standard statuses and custom string values
    const updatedTask: Task = {
      ...task,
      status: nextStatus as 'todo' | 'done' | 'cancelled',
      updatedAt: new Date().toISOString()
    };

    // Execute custom handler if provided
    if (customHandler) {
      logger.info(`Executing custom handler: ${customHandler}`, { taskId: task.id });
      // Custom handler logic could be implemented here in the future
    }

    logger.info(`Task "${task.name}" transitioned to status: ${nextStatus}`, { taskId: task.id });
    
    return {
      success: true,
      updatedTask
    };
  }

  /**
   * Check if task has nested children (sub-items)
   * @param taskBlockId - SiYuan block ID of the task
   * @returns true if task has child blocks
   */
  async hasNestedItems(taskBlockId: string): Promise<boolean> {
    if (!this.siyuanApi || !this.siyuanApi.getChildBlocks) {
      // If API not available, assume has nested items (safer default - prevents deletion)
      logger.warn('SiYuan API not available for nested item check');
      return true;
    }

    try {
      const children = await this.siyuanApi.getChildBlocks({ id: taskBlockId });
      return children && children.length > 0;
    } catch (err) {
      logger.error('Failed to check for nested items', { blockId: taskBlockId, error: err });
      // On error, assume has nested items (safer default - prevents deletion)
      return true;
    }
  }
}
