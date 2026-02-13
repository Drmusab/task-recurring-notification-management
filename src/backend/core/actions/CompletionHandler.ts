/**
 * Completion Handler for orchestrating task completion flow
 * Handles: date tracking, recurrence generation, placement, and onCompletion actions
 */

import type { Task } from "@backend/core/models/Task";
import type { RecurrenceEngineRRULE } from "@backend/core/engine/recurrence/RecurrenceEngineRRULE";
import type { PluginSettings } from "@backend/core/settings/PluginSettings";
import { duplicateTask } from "@backend/core/models/Task";
import * as logger from "@backend/logging/logger";

export interface CompletionResult {
  success: boolean;
  nextTask?: Task;
  warnings?: string[];
  error?: string;
}

export interface TaskStorage {
  saveTask(task: Task): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
}

export interface SiYuanBlockAPI {
  insertBlockAbove?(blockId: string, markdown: string): Promise<{ id: string }>;
  insertBlockBelow?(blockId: string, markdown: string): Promise<{ id: string }>;
  deleteBlock?(params: { id: string }): Promise<void>;
  getChildBlocks?(params: { id: string }): Promise<any[]>;
}

/**
 * Serializes a task to markdown format for insertion
 */
function serializeTask(task: Task): string {
  // Simple markdown serialization - extend as needed
  const checkbox = task.status === 'done' ? 'x' : ' ';
  let line = `- [${checkbox}] ${task.name}`;
  
  if (task.dueAt) {
    const dueDate = new Date(task.dueAt);
    line += ` 📅 ${dueDate.toISOString().split('T')[0]}`;
  }
  
  if (task.frequency) {
    line += ` 🔁 every ${task.frequency.interval} ${task.frequency.type}${task.frequency.interval > 1 ? 's' : ''}`;
  }
  
  return line;
}

/**
 * CompletionHandler orchestrates task completion flow:
 * 1. Add completion dates (done/cancelled)
 * 2. Generate next recurrence instance
 * 3. Place next instance (above/below per settings)
 * 4. Handle onCompletion action (keep/delete)
 */
export class CompletionHandler {
  constructor(
    private storage: TaskStorage,
    private recurrenceEngine: RecurrenceEngineRRULE,
    private settings: PluginSettings,
    private siyuanApi?: SiYuanBlockAPI
  ) {}

  /**
   * Handle task completion with full orchestration
   */
  async onComplete(task: Task, completionDate: Date): Promise<CompletionResult> {
    try {
      const warnings: string[] = [];
      
      // 1. Add completion date
      const updatedTask = this.addCompletionDate(task, completionDate);
      
      // 2. Handle recurrence if present
      let nextTask: Task | undefined;
      if (task.frequency) {
        nextTask = await this.generateNextInstance(updatedTask, completionDate);
        
        if (nextTask) {
          // 3. Place next instance
          const placed = await this.placeNextInstance(updatedTask, nextTask);
          if (!placed) {
            warnings.push('Could not place next instance in document (API unavailable)');
          }
          
          // 4. Save next task to storage
          await this.storage.saveTask(nextTask);
        }
      }
      
      // 5. Handle onCompletion action
      if (task.onCompletion === 'delete') {
        // Check for nested items before deleting
        const hasNested = await this.hasNestedItems(task.linkedBlockId);
        if (hasNested) {
          logger.warn('Cannot delete task with nested items', { 
            taskId: task.id,
            blockId: task.linkedBlockId 
          });
          
          // Keep task instead of deleting
          await this.storage.saveTask(updatedTask);
          warnings.push('Task has nested items - kept instead of deleted');
        } else {
          // Safe to delete
          await this.deleteTask(task);
        }
      } else {
        // Default: keep task
        await this.storage.saveTask(updatedTask);
      }
      
      return {
        success: true,
        nextTask,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (err) {
      logger.error('Failed to handle task completion', {
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
   * Add completion date to task
   */
  private addCompletionDate(task: Task, completionDate: Date): Task {
    const updated = { ...task };
    const isoDate = completionDate.toISOString();
    
    if (task.status === 'done' && this.settings.dates.autoAddDone) {
      updated.doneAt = isoDate;
      updated.cancelledAt = undefined; // Clear if was previously cancelled
    } else if (task.status === 'cancelled' && this.settings.dates.autoAddCancelled) {
      updated.cancelledAt = isoDate;
      updated.doneAt = undefined; // Clear if was previously done
    }
    
    return updated;
  }

  /**
   * Generate next task instance from recurrence
   */
  private async generateNextInstance(
    task: Task,
    completionDate: Date
  ): Promise<Task | undefined> {
    if (!task.frequency) {
      return undefined;
    }
    
    try {
      // Determine base date for calculation
      const currentDue = new Date(task.dueAt);
      
      // Calculate next occurrence using whenDone logic
      const nextDueDate = this.recurrenceEngine.calculateNext(
        currentDue,
        task.frequency,
        {
          completionDate,
          // @ts-expect-error - Legacy Frequency may have whenDone property
          whenDone: task.frequency.whenDone || task.whenDone,
        }
      );
      
      if (!nextDueDate) {
        // Recurrence series exhausted — no next occurrence
        logger.info(`Task "${task.name}" recurrence series exhausted after completion`);
        return undefined;
      }
      
      // Create next task instance
      const nextTask = duplicateTask(task, {
        dueAt: nextDueDate.toISOString(),
        status: 'todo',
        doneAt: undefined,
        cancelledAt: undefined,
        linkedBlockId: undefined, // Will be set after insertion
        linkedBlockContent: undefined,
      });
      
      // Remove scheduled date if setting enabled
      if (this.settings.recurrence.removeScheduledOnRecurrence) {
        nextTask.scheduledAt = undefined;
      }
      
      return nextTask;
    } catch (err) {
      logger.error('Failed to generate next recurrence instance', {
        taskId: task.id,
        frequency: task.frequency,
        error: err,
      });
      return undefined;
    }
  }

  /**
   * Place next instance in document (above/below per settings)
   */
  private async placeNextInstance(
    originalTask: Task,
    nextTask: Task
  ): Promise<boolean> {
    if (!originalTask.linkedBlockId) {
      logger.warn('Original task has no linkedBlockId, cannot place next instance');
      return false;
    }
    
    if (!this.siyuanApi) {
      logger.warn('SiYuan API not available, cannot place next instance');
      return false;
    }
    
    const placement = this.settings.recurrence.newTaskPosition;
    const markdown = serializeTask(nextTask);
    
    try {
      let result: { id: string } | undefined;
      
      if (placement === 'above' && this.siyuanApi.insertBlockAbove) {
        result = await this.siyuanApi.insertBlockAbove(originalTask.linkedBlockId, markdown);
      } else if (placement === 'below' && this.siyuanApi.insertBlockBelow) {
        result = await this.siyuanApi.insertBlockBelow(originalTask.linkedBlockId, markdown);
      }
      
      if (result?.id) {
        nextTask.linkedBlockId = result.id;
        nextTask.linkedBlockContent = markdown;
        return true;
      }
      
      return false;
    } catch (err) {
      logger.error('Failed to place next instance in document', {
        taskId: originalTask.id,
        placement,
        error: err,
      });
      return false;
    }
  }

  /**
   * Check if task has nested items
   */
  private async hasNestedItems(blockId?: string): Promise<boolean> {
    if (!blockId) {
      return false;
    }
    
    if (!this.siyuanApi?.getChildBlocks) {
      // If API not available, assume no nested items for simpler flow
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
   * Delete task from storage and document
   */
  private async deleteTask(task: Task): Promise<void> {
    // Delete from storage
    await this.storage.deleteTask(task.id);
    
    // Delete from document if linked
    if (task.linkedBlockId && this.siyuanApi?.deleteBlock) {
      try {
        await this.siyuanApi.deleteBlock({ id: task.linkedBlockId });
        logger.info('Task deleted from document and storage', {
          taskId: task.id,
          blockId: task.linkedBlockId,
        });
      } catch (err) {
        logger.error('Failed to delete task from document', {
          taskId: task.id,
          blockId: task.linkedBlockId,
          error: err,
        });
      }
    } else {
      logger.info('Task deleted from storage only (no linked block)', {
        taskId: task.id,
      });
    }
  }
}
