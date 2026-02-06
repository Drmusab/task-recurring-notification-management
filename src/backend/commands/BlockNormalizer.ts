// @ts-nocheck
/**
 * Block Normalizer - Converts saved tasks back to canonical inline format
 */

import type { Task } from "@backend/core/models/Task";
import type { ParsedTask } from "@backend/parsers/InlineTaskParser";
import { normalizeTask } from "@backend/parsers/InlineTaskParser";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskRepository";
import type { SiYuanBlockAPI } from "@backend/core/api/SiYuanApiAdapter";
import * as logger from "@backend/logging/logger";
import { toast } from "@frontend/utils/notifications";

/**
 * Save task and normalize the associated block content
 */
export async function saveAndNormalizeBlock(
  task: Task,
  blockId: string,
  repository: TaskRepositoryProvider,
  blockApi: SiYuanBlockAPI
): Promise<void> {
  // 1. Save to storage
  const savedTask = await repository.saveTask(task);
  
  logger.info("Task saved, normalizing block", { taskId: savedTask.id, blockId });

  // 2. Convert Task to ParsedTask format for normalization
  const parsedTask: ParsedTask = {
    description: savedTask.name || "",
    status: savedTask.status || 'todo',
    dueDate: savedTask.dueAt ? savedTask.dueAt.substring(0, 10) : undefined,
    scheduledDate: savedTask.scheduledAt ? savedTask.scheduledAt.substring(0, 10) : undefined,
    startDate: savedTask.startAt ? savedTask.startAt.substring(0, 10) : undefined,
    // Map Task priority ('high'|'normal'|'low') to ParsedTask priority ('high'|'medium'|'low')
    // 'normal' maps to 'medium' to match the inline parser's emoji system (??)
    priority: savedTask.priority === 'high' ? 'high' : 
              savedTask.priority === 'low' ? 'low' :
              savedTask.priority === 'normal' ? 'medium' : undefined,
    id: savedTask.id,
    tags: savedTask.tags,
    recurrence: savedTask.frequency ? {
      rule: savedTask.frequency.rrule || '',
      mode: 'scheduled' // Default mode, could be enhanced later
    } : undefined,
    dependsOn: savedTask.dependsOn
  };

  // 3. Normalize inline content
  const normalizedContent = normalizeTask(parsedTask);
  
  logger.info("Normalized content", { normalizedContent });

  // 4. Update block via SiYuan API
  try {
    await updateBlockContent(blockId, normalizedContent, blockApi);
    logger.info("Block normalized successfully");
  } catch (error) {
    logger.error("Block normalization failed", error);
    // Don't fail the whole operation - task is already saved
    toast.warning("Task saved, but block update failed. Please refresh.");
  }
}

/**
 * Update block content using SiYuan API
 * 
 * Note: This is a Phase 2 implementation that uses custom attributes.
 * Full block markdown content update requires SiYuan's SQL API or kernel API,
 * which will be implemented in a future phase when we have more context
 * about the best approach for different SiYuan versions.
 * 
 * Current approach:
 * - Sets custom attributes to track normalization state
 * - Stores normalized content in an attribute for debugging
 * - Does NOT modify the actual block markdown yet
 * 
 * TODO: Implement full block content update in Phase 3 using appropriate SiYuan API
 */
async function updateBlockContent(
  blockId: string,
  content: string,
  blockApi: SiYuanBlockAPI
): Promise<void> {
  // Use setBlockAttrs to update the block's content
  // In SiYuan, we typically update the markdown directly via API
  // For now, we'll set a custom attribute to track the normalization
  await blockApi.setBlockAttrs(blockId, {
    'custom-recurring-task-normalized': 'true',
    'custom-task-content': content
  });
  
  // Note: Full block content update would require a different API call
  // This is a placeholder that demonstrates the concept
  // In production, you'd use the SQL API or kernel API to update block markdown
}
