// @ts-nocheck
/**
 * Create Task from Block - Main command handler for inline task creation
 */

import type { Plugin } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import type { ParsedTask } from "@backend/parsers/InlineTaskParser";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskRepository";
import type { SiYuanBlockAPI } from "@backend/core/api/SiYuanApiAdapter";
import { parseInlineTask } from "@backend/parsers/InlineTaskParser";
import { getCurrentBlockContent } from "@backend/commands/BlockHandler";
import { saveAndNormalizeBlock } from "@backend/commands/BlockNormalizer";
import { showParseErrorHint } from "@components/shared/utils/inlineErrorHints";
import { createTask } from "@backend/core/models/Task";
import { createDefaultFrequency } from "@backend/core/models/Frequency";
import { toast } from "@frontend/utils/notifications";
import * as logger from "@backend/logging/logger";

export interface CreateTaskFromBlockDependencies {
  repository: TaskRepositoryProvider;
  blockApi: SiYuanBlockAPI;
  openTaskEditor: (task?: Task, initialData?: Partial<Task>) => void;
}

/**
 * Handle the create/edit task from block command
 * This is the main entry point for Phase 2
 */
export async function handleCreateTaskFromBlock(
  deps: CreateTaskFromBlockDependencies
): Promise<void> {
  logger.info("Create task from block command triggered");

  // 1. Get current block
  const blockData = getCurrentBlockContent();
  
  if (!blockData) {
    toast.error("No block selected or cursor not in editor");
    logger.warn("No block context available");
    return;
  }

  logger.info("Block data extracted", { 
    blockId: blockData.blockId,
    isChecklist: blockData.isChecklist,
    contentLength: blockData.content.length 
  });

  // 2. Auto-promote plain text to checklist
  let content = blockData.content;
  if (!blockData.isChecklist) {
    content = `- [ ] ${content}`;
    logger.info("Auto-promoted plain text to checklist");
  }

  // 3. Parse inline task
  const parseResult = parseInlineTask(content);
  
  if ('error' in parseResult) {
    logger.info("Parse error occurred, opening editor with raw content", { error: parseResult });
    
    // Show error notification
    showParseErrorHint(parseResult, blockData.blockId);
    
    // Open modal with raw text as description
    const fallbackTask = createTask(
      blockData.content,
      createDefaultFrequency(),
      new Date()
    );
    fallbackTask.linkedBlockId = blockData.blockId;
    fallbackTask.linkedBlockContent = blockData.content;
    
    deps.openTaskEditor(fallbackTask, {
      name: blockData.content,
      status: 'todo'
    });
    return;
  }

  logger.info("Task parsed successfully", { parsed: parseResult });

  // 4. Check if task already exists for this block
  const existingTask = deps.repository.getTaskByBlockId(blockData.blockId);
  
  // 5. Create or update task object
  let taskToEdit: Task;
  
  if (existingTask) {
    // Edit mode - update existing task
    logger.info("Editing existing task", { taskId: existingTask.id });
    taskToEdit = { ...existingTask };
    updateTaskFromParsed(taskToEdit, parseResult);
  } else {
    // Create mode - new task from parsed data
    logger.info("Creating new task from block");
    taskToEdit = createTaskFromParsed(parseResult, blockData.blockId, blockData.content);
  }

  // 6. Open task editor with pre-populated data
  deps.openTaskEditor(taskToEdit);
}

/**
 * Create a new Task from ParsedTask data
 */
function createTaskFromParsed(
  parsed: ParsedTask,
  blockId: string,
  blockContent: string
): Task {
  const dueDate = parsed.dueDate ? new Date(parsed.dueDate) : new Date();
  const frequency = createDefaultFrequency();
  
  // Create base task
  const task = createTask(parsed.description, frequency, dueDate);
  
  // Add block linkage
  task.linkedBlockId = blockId;
  task.linkedBlockContent = blockContent;
  
  // Apply parsed metadata
  updateTaskFromParsed(task, parsed);
  
  return task;
}

/**
 * Update a Task object with ParsedTask data
 */
function updateTaskFromParsed(task: Task, parsed: ParsedTask): void {
  task.name = parsed.description;
  task.status = parsed.status;
  
  if (parsed.dueDate) {
    task.dueAt = new Date(parsed.dueDate).toISOString();
  }
  
  if (parsed.scheduledDate) {
    task.scheduledAt = new Date(parsed.scheduledDate).toISOString();
  }
  
  if (parsed.startDate) {
    task.startAt = new Date(parsed.startDate).toISOString();
  }
  
  if (parsed.priority) {
    task.priority = parsed.priority === 'high' ? 'high' :
                    parsed.priority === 'low' ? 'low' : 'normal';
  }
  
  if (parsed.tags) {
    task.tags = parsed.tags;
  }
  
  if (parsed.dependsOn) {
    task.dependsOn = parsed.dependsOn;
  }
  
  // TODO: Full recurrence parsing implementation
  // Currently this is a simplified version for Phase 2.
  // Full implementation requires:
  // - Parsing RRULE strings from inline format
  // - Converting to Frequency object
  // - Handling 'when done' mode vs 'scheduled' mode
  // - Validating recurrence rules
  // This will be completed in Phase 3 when auto-creation features are added.
  if (parsed.recurrence) {
    task.recurrenceText = parsed.recurrence.rule;
  }
}
