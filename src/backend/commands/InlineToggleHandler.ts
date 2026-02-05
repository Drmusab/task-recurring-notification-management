/**
 * Inline Toggle Handler
 * 
 * Handles checkbox toggle events for inline tasks in SiYuan editor.
 * Integrates with existing task completion pipeline and recurrence engine.
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskCommands } from "@backend/commands/TaskCommands";
import type { TaskIndex } from "@backend/core/storage/TaskIndex";
import type { ParsedTask } from "@backend/parsers/InlineTaskParser";
import { parseInlineTask, normalizeTask } from "@backend/parsers/InlineTaskParser";
import * as logger from "@backend/logging/logger";
import { toast } from "@frontend/utils/notifications";

export interface InlineToggleHandlerDeps {
  taskIndex: TaskIndex;
  taskCommands: TaskCommands;
  parser?: {
    parseInlineTask: typeof parseInlineTask;
    normalizeTask: typeof normalizeTask;
  };
}

/**
 * Handler for inline checkbox toggle events
 */
export class InlineToggleHandler {
  private taskIndex: TaskIndex;
  private taskCommands: TaskCommands;
  private parseInlineTask: typeof parseInlineTask;
  private normalizeTask: typeof normalizeTask;
  private pendingToggles: Map<string, NodeJS.Timeout> = new Map();
  private readonly debounceMs = 100;

  constructor(deps: InlineToggleHandlerDeps) {
    this.taskIndex = deps.taskIndex;
    this.taskCommands = deps.taskCommands;
    this.parseInlineTask = deps.parser?.parseInlineTask || parseInlineTask;
    this.normalizeTask = deps.parser?.normalizeTask || normalizeTask;
  }

  /**
   * Handle checkbox toggle event
   * @param blockId - SiYuan block ID
   * @param newChecked - New checkbox state (true = checked)
   */
  async handleToggle(blockId: string, newChecked: boolean): Promise<void> {
    // Debounce rapid toggles
    const pending = this.pendingToggles.get(blockId);
    if (pending) {
      clearTimeout(pending);
    }

    const timeout = setTimeout(async () => {
      await this.processToggle(blockId, newChecked);
      this.pendingToggles.delete(blockId);
    }, this.debounceMs);

    this.pendingToggles.set(blockId, timeout);
  }

  /**
   * Process the toggle after debouncing
   */
  private async processToggle(blockId: string, newChecked: boolean): Promise<void> {
    try {
      // 1. Check if this is a managed task
      const task = this.taskIndex.getByBlockId(blockId);
      
      if (!task) {
        // Not a managed task - ignore
        logger.debug('Checkbox toggle on non-managed task', { blockId });
        return;
      }

      // 2. Get current block content from DOM
      const blockContent = this.getBlockContentFromDOM(blockId);
      if (!blockContent) {
        logger.warn('Could not get block content for toggle', { blockId });
        return;
      }

      // 3. Parse current inline task
      const parsed = this.parseInlineTask(blockContent);
      if ('error' in parsed) {
        logger.error('Failed to parse inline task during toggle', {
          blockId,
          error: parsed.message
        });
        return;
      }

      // 4. Determine new status based on checkbox state and current status
      const newStatus = this.calculateNewStatus(newChecked, parsed.status);
      
      // If status hasn't changed, ignore
      if (newStatus === task.status) {
        logger.debug('Status unchanged, ignoring toggle', { blockId, status: newStatus });
        return;
      }

      logger.info('Processing inline task toggle', {
        blockId,
        taskId: task.id,
        oldStatus: task.status,
        newStatus,
        newChecked
      });

      // 5. Update task status through commands
      if (newStatus === 'done') {
        // Use completeTask for done status (handles recurrence)
        await this.taskCommands.completeTask(task.id);
      } else {
        // Use toggleStatus for other status changes
        // We need to toggle until we reach the desired status
        await this.ensureTaskStatus(task.id, newStatus);
      }

      // 6. Update block content to reflect changes
      await this.updateBlockAfterToggle(blockId, task.id, newStatus);

    } catch (error) {
      logger.error('Failed to handle inline toggle', {
        blockId,
        newChecked,
        error
      });
      toast.error('Failed to update task');
    }
  }

  /**
   * Calculate new status based on checkbox state
   * 
   * If checkbox is checked (true):
   *   - If status was 'todo' → 'done'
   *   - If status was 'cancelled' → 'done'
   *   - If status was 'done' → ignore (already done)
   * 
   * If checkbox is unchecked (false):
   *   - If status was 'done' → 'todo'
   *   - If status was 'cancelled' → 'todo'
   *   - If status was 'todo' → ignore (already todo)
   */
  private calculateNewStatus(
    newChecked: boolean,
    currentStatus: 'todo' | 'done' | 'cancelled'
  ): 'todo' | 'done' | 'cancelled' {
    if (newChecked) {
      // Checkbox is checked - should be done
      return currentStatus === 'done' ? currentStatus : 'done';
    } else {
      // Checkbox is unchecked - should be todo
      return currentStatus === 'todo' ? currentStatus : 'todo';
    }
  }

  /**
   * Ensure task reaches target status by toggling as needed
   */
  private async ensureTaskStatus(
    taskId: string,
    targetStatus: 'todo' | 'done' | 'cancelled'
  ): Promise<void> {
    const task = this.taskIndex.getById(taskId);
    if (!task) {
      logger.warn('Task not found when ensuring status', { taskId });
      return;
    }

    // If already at target status, nothing to do
    if (task.status === targetStatus) {
      return;
    }

    // Toggle status - the toggleStatus command cycles through statuses
    // For now, we'll call it once and trust it updates correctly
    // In a more complex scenario, we might need to loop until target is reached
    await this.taskCommands.toggleStatus(taskId);
  }

  /**
   * Check if a block contains a managed task
   */
  async isManagedTask(blockId: string): Promise<boolean> {
    // Use TaskIndex's byBlockId lookup for O(1) performance
    const task = this.taskIndex.getByBlockId(blockId);
    return task !== undefined;
  }

  /**
   * Update block content after task toggle
   */
  async updateBlockAfterToggle(
    blockId: string,
    taskId: string,
    newStatus: 'todo' | 'done' | 'cancelled'
  ): Promise<void> {
    try {
      // Get updated task from index
      const task = this.taskIndex.getById(taskId);
      if (!task) {
        logger.warn('Task not found after toggle', { taskId, blockId });
        return;
      }

      // Get current block content
      const blockContent = this.getBlockContentFromDOM(blockId);
      if (!blockContent) {
        logger.warn('Block not found after toggle', { blockId });
        return;
      }

      // Parse current content
      const parsed = this.parseInlineTask(blockContent);
      if ('error' in parsed) {
        logger.error('Failed to parse block after toggle', {
          blockId,
          error: parsed.message
        });
        return;
      }

      // Update with new task data
      const updated: ParsedTask = {
        ...parsed,
        status: newStatus,
        dueDate: task.dueAt ? task.dueAt.split('T')[0] : undefined,
        scheduledDate: task.scheduledAt ? task.scheduledAt.split('T')[0] : undefined,
        startDate: task.startAt ? task.startAt.split('T')[0] : undefined,
      };

      // Normalize and update block in DOM
      const normalized = this.normalizeTask(updated);
      this.updateBlockContentInDOM(blockId, normalized);

      logger.debug('Block content updated after toggle', {
        blockId,
        taskId,
        status: newStatus
      });

    } catch (error) {
      logger.error('Failed to update block after toggle', {
        blockId,
        taskId,
        error
      });
    }
  }

  /**
   * Get block content from DOM
   */
  private getBlockContentFromDOM(blockId: string): string | null {
    const blockElement = document.querySelector(`[data-node-id="${blockId}"]`);
    if (!blockElement) {
      return null;
    }
    return blockElement.textContent?.trim() || null;
  }

  /**
   * Update block content in DOM
   * Note: This is a simplified approach that updates textContent.
   * In production, you might want to use SiYuan's API for proper markdown updates.
   */
  private updateBlockContentInDOM(blockId: string, content: string): void {
    const blockElement = document.querySelector(`[data-node-id="${blockId}"]`);
    if (!blockElement) {
      logger.warn('Block element not found for update', { blockId });
      return;
    }

    // Update the text content
    // Note: This is a simple approach. A more robust implementation would
    // preserve the DOM structure and only update the checkbox state.
    const firstChild = blockElement.firstChild;
    if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
      firstChild.textContent = content;
    } else {
      blockElement.textContent = content;
    }
  }

  /**
   * Cleanup pending toggles
   */
  destroy(): void {
    for (const timeout of this.pendingToggles.values()) {
      clearTimeout(timeout);
    }
    this.pendingToggles.clear();
  }
}
