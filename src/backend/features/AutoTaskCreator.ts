// @ts-nocheck
/**
 * Auto Task Creator - Automatic task creation from inline markdown checklists
 * 
 * Implements debounced auto-creation with duplicate detection and error handling.
 * Part of Phase 3: Auto-Creation for Inline Tasks
 */

import type { ParsedTask, ParseError } from '@backend/parsers/InlineTaskParser';
import type { Task } from '@backend/core/models/Task';
import type { TaskRepositoryProvider } from '@backend/core/storage/TaskRepository';
import type { InlineTaskSettings } from '@backend/core/settings/PluginSettings';
import { parseInlineTask } from '@backend/parsers/InlineTaskParser';
import { showParseErrorHint } from '@components/common/InlineErrorHints';
import { createTask } from '@backend/core/models/Task';
import { createDefaultFrequency } from '@backend/core/models/Frequency';
import { normalizeTask } from '@backend/parsers/InlineTaskParser';
import * as logger from "@backend/logging/logger";

/**
 * Dependencies required for auto task creation
 */
export interface AutoTaskCreatorDeps {
  repository: TaskRepositoryProvider;
  settings: () => InlineTaskSettings;
  updateBlockContent?: (blockId: string, content: string) => Promise<void>;
  saveTask: (task: Task) => Promise<void>;
}

/**
 * Auto Task Creator class
 */
export class AutoTaskCreator {
  private deps: AutoTaskCreatorDeps;
  private debouncedCreateTimeout: number | undefined;
  
  constructor(deps: AutoTaskCreatorDeps) {
    this.deps = deps;
  }
  
  /**
   * Debounced auto-create function (500ms delay)
   */
  private debouncedCreateInternal = async (blockId: string, text: string) => {
    await this.tryAutoCreate(blockId, text);
  };
  
  private debouncedCreate = (blockId: string, text: string) => {
    if (this.debouncedCreateTimeout !== undefined) {
      clearTimeout(this.debouncedCreateTimeout);
    }
    this.debouncedCreateTimeout = setTimeout(() => {
      this.debouncedCreateInternal(blockId, text).catch((err) => {
        logger.error('Debounced auto-create failed', { error: err, blockId });
      });
      this.debouncedCreateTimeout = undefined;
    }, 500) as unknown as number;
  };
  
  /**
   * Handle Enter key press on a checklist block
   */
  async handleEnter(blockId: string, text: string): Promise<void> {
    const settings = this.deps.settings();
    
    if (!settings.enableInlineCreation || !settings.autoCreateOnEnter) {
      logger.info('Auto-create on Enter disabled');
      return;
    }
    
    // Don't debounce Enter - create immediately
    await this.tryAutoCreate(blockId, text);
  }
  
  /**
   * Handle blur event on a checklist block
   */
  async handleBlur(blockId: string, text: string): Promise<void> {
    const settings = this.deps.settings();
    
    if (!settings.enableInlineCreation || !settings.autoCreateOnBlur) {
      logger.info('Auto-create on Blur disabled');
      return;
    }
    
    // Debounce blur to avoid excessive operations
    this.debouncedCreate(blockId, text);
  }
  
  /**
   * Try to auto-create a task from block content
   */
  private async tryAutoCreate(blockId: string, text: string): Promise<void> {
    try {
      const settings = this.deps.settings();
      
      // Check if text is a checklist
      if (!text.trim().match(/^-\s*\[\s*[x\s\-]\s*\]/i)) {
        logger.info('Not a checklist, skipping auto-create', { blockId });
        return;
      }
      
      // Check for existing task
      const existingTask = this.deps.repository.getTaskByBlockId(blockId);
      if (existingTask) {
        logger.info('Task already exists for block, skipping', { blockId, taskId: existingTask.id });
        return;
      }
      
      // Parse the inline task
      const parseResult = parseInlineTask(text);
      
      if ('error' in parseResult) {
        // Show error hint if enabled
        if (settings.showInlineHints) {
          showParseErrorHint(parseResult as ParseError, blockId);
        }
        logger.warn('Parse error during auto-create', { error: parseResult, blockId });
        return;
      }
      
      logger.info('Auto-creating task from block', { blockId, parsed: parseResult });
      
      // Create task from parsed data
      const task = this.createTaskFromParsed(parseResult as ParsedTask, blockId, text);
      
      // Save task
      await this.deps.saveTask(task);
      
      logger.info('Task auto-created successfully', { taskId: task.id, blockId });
      
      // Normalize block content if enabled
      if (settings.normalizeOnSave && this.deps.updateBlockContent) {
        const normalized = normalizeTask(parseResult as ParsedTask);
        if (normalized !== text) {
          await this.deps.updateBlockContent(blockId, normalized);
          logger.info('Block content normalized', { blockId });
        }
      }
      
    } catch (error) {
      logger.error('Auto-create failed', { error, blockId });
    }
  }
  
  /**
   * Create Task object from parsed inline task
   */
  private createTaskFromParsed(parsed: ParsedTask, blockId: string, originalContent: string): Task {
    const task = createTask(
      parsed.description || 'Untitled Task',
      createDefaultFrequency(),
      new Date()
    );
    
    // Link to block
    task.linkedBlockId = blockId;
    task.linkedBlockContent = originalContent;
    
    // Map parsed fields to Task
    if (parsed.dueDate) {
      task.due = new Date(parsed.dueDate);
    }
    
    if (parsed.scheduledDate) {
      task.scheduled = new Date(parsed.scheduledDate);
    }
    
    if (parsed.startDate) {
      task.start = new Date(parsed.startDate);
    }
    
    if (parsed.priority) {
      task.priority = parsed.priority === 'high' ? 1 : parsed.priority === 'medium' ? 2 : 3;
    }
    
    if (parsed.tags) {
      task.tags = parsed.tags;
    }
    
    if (parsed.recurrence) {
      // Handle recurrence if needed - simplified for now
      task.frequency.recurrenceRule = parsed.recurrence.rule;
    }
    
    // Set status based on parsed status
    task.status = parsed.status === 'done' ? 'done' : parsed.status === 'cancelled' ? 'cancelled' : 'todo';
    
    return task;
  }
  
  /**
   * Cleanup all pending operations
   */
  cleanup(): void {
    // Clear debounced timeout
    if (this.debouncedCreateTimeout !== undefined) {
      clearTimeout(this.debouncedCreateTimeout);
      this.debouncedCreateTimeout = undefined;
    }
  }
}
