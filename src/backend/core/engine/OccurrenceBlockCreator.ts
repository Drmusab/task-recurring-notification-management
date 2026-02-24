/**
 * OccurrenceBlockCreator - Creates SiYuan blocks for recurring task occurrences
 * 
 * When a recurring task becomes due, this service materializes it as a new
 * SiYuan block in the linked document. This lets users see task occurrences
 * directly in their notes, with full block attribute metadata.
 * 
 * Phase 7: Recurring Engine Lifecycle Sync
 * 
 * Flow:
 *   Scheduler emits "task:due" → EventService.handleTaskDue()
 *     → OccurrenceBlockCreator.createOccurrenceBlock()
 *       → TaskBlockService.createTaskBlock() → /api/block/appendBlock
 *       → BlockMetadataService.setTaskAttributes() → /api/attr/setBlockAttrs
 *       → Update parent task's lastGenerated timestamp
 */

import type { Plugin } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import { TaskBlockService } from "@backend/core/api/block-api";
import { BlockMetadataService } from "@backend/core/api/BlockMetadataService";
import type { TaskStorage } from "@backend/core/storage/TaskStorage";
import * as logger from "@backend/logging/logger";

export interface OccurrenceResult {
  success: boolean;
  blockId?: string;
  error?: string;
}

export class OccurrenceBlockCreator {
  private taskBlockService: TaskBlockService;
  private blockMetadata: BlockMetadataService;
  private taskStorage: TaskStorage;

  constructor(plugin: Plugin, taskStorage: TaskStorage, blockMetadata?: BlockMetadataService) {
    this.taskBlockService = new TaskBlockService(plugin);
    this.blockMetadata = blockMetadata ?? new BlockMetadataService();
    this.taskStorage = taskStorage;
  }

  /**
   * Create a new SiYuan block for a recurring task occurrence.
   * 
   * Only creates a block if:
   * - Task has recurrence (not a one-shot task)
   * - Task has a linkedBlockId (knows where to put the new block)
   * - Task hasn't already generated a block for this occurrence
   * 
   * @param task - The due recurring task
   * @param occurrenceDate - When this occurrence is due
   * @returns Result with the new block ID or error info
   */
  async createOccurrenceBlock(task: Task, occurrenceDate: Date): Promise<OccurrenceResult> {
    // Only create blocks for recurring tasks
    if (!task.recurrence?.rrule) {
      return { success: false, error: "Not a recurring task" };
    }

    // Must have a parent block to know where to insert
    const parentBlockId = task.linkedBlockId;
    if (!parentBlockId) {
      return { success: false, error: "No linked block ID" };
    }

    // Dedup: check if we already generated for this occurrence
    const lastGenerated = (task as any).lastGeneratedAt;
    if (lastGenerated) {
      const lastDate = new Date(lastGenerated);
      const occDate = new Date(occurrenceDate);
      // If generated within the same minute, skip
      if (Math.abs(lastDate.getTime() - occDate.getTime()) < 60_000) {
        return { success: false, error: "Already generated for this occurrence" };
      }
    }

    try {
      // Generate a unique ID for the occurrence
      const occurrenceId = `${task.id}-occ-${occurrenceDate.getTime()}`;

      // Create the occurrence block adjacent to the parent
      const blockId = await this.taskBlockService.createTaskBlock(
        {
          id: occurrenceId,
          name: task.name,
          description: task.description,
          status: "todo",
          priority: task.priority,
          dueAt: occurrenceDate.toISOString(),
          enabled: true,
        },
        parentBlockId
      );

      // Stamp full metadata on the new block
      const occurrenceTask: Task = {
        ...task,
        id: occurrenceId,
        dueAt: occurrenceDate.toISOString(),
        status: "todo",
        enabled: true,
        linkedBlockId: blockId,
        seriesId: task.id,
        occurrenceIndex: (task.occurrenceIndex ?? 0) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completionCount: 0,
        currentStreak: task.currentStreak,
        bestStreak: task.bestStreak,
      };

      await this.blockMetadata.setTaskAttributes(blockId, occurrenceTask);

      // Update parent task's lastGeneratedAt timestamp
      (task as any).lastGeneratedAt = occurrenceDate.toISOString();
      task.updatedAt = new Date().toISOString();
      await this.taskStorage.saveTask(task);

      logger.info("[OccurrenceCreator] Created occurrence block", {
        parentTaskId: task.id,
        occurrenceId,
        blockId,
        dueAt: occurrenceDate.toISOString(),
      });

      return { success: true, blockId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[OccurrenceCreator] Failed to create occurrence block", {
        taskId: task.id,
        occurrenceDate: occurrenceDate.toISOString(),
        error: msg,
      });
      return { success: false, error: msg };
    }
  }
}
