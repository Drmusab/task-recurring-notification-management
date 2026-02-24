/**
 * JsonToBlockMigration - One-time migration from JSON file storage to block attributes
 * 
 * On first load after upgrade:
 * 1. Read all tasks from JSON (Plugin.loadData)
 * 2. Write each task to its linked block's attributes via BlockMetadataService
 * 3. Mark migration complete in plugin settings
 * 
 * If a task has no linkedBlockId, it's stored in JSON-only mode (orphan task).
 * These remain in JSON as a fallback until the user links them to a block.
 * 
 * Phase 6: Block DB Storage Migration
 */

import type { Plugin } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import { BlockMetadataService } from "@backend/core/api/BlockMetadataService";
import * as logger from "@backend/logging/logger";

const MIGRATION_FLAG_KEY = "block-storage-migration-v1";

export interface MigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
  orphanTasks: string[];  // Task IDs with no linkedBlockId
}

export class JsonToBlockMigration {
  private plugin: Plugin;
  private blockMetadata: BlockMetadataService;

  constructor(plugin: Plugin, blockMetadata?: BlockMetadataService) {
    this.plugin = plugin;
    this.blockMetadata = blockMetadata ?? new BlockMetadataService();
  }

  /**
   * Check if migration has already been completed
   */
  async isMigrated(): Promise<boolean> {
    try {
      const flag = await this.plugin.loadData(MIGRATION_FLAG_KEY);
      return flag?.completed === true;
    } catch {
      return false;
    }
  }

  /**
   * Run the JSON → block attribute migration for all active tasks.
   * 
   * @param tasks - Map of tasks loaded from JSON storage
   * @returns Migration result with counts
   */
  async migrate(tasks: Map<string, Task>): Promise<MigrationResult> {
    const result: MigrationResult = {
      migrated: 0,
      skipped: 0,
      failed: 0,
      orphanTasks: [],
    };

    if (tasks.size === 0) {
      await this.markComplete(result);
      return result;
    }

    logger.info(`[Migration] Starting JSON → block attribute migration for ${tasks.size} tasks`);

    for (const [id, task] of tasks) {
      const blockId = task.linkedBlockId;

      if (!blockId) {
        // Task has no block link — it stays in JSON only
        result.orphanTasks.push(id);
        result.skipped++;
        continue;
      }

      try {
        const success = await this.blockMetadata.setTaskAttributes(blockId, task);
        if (success) {
          result.migrated++;
        } else {
          result.failed++;
          logger.warn(`[Migration] Failed to write task ${id} to block ${blockId}`);
        }
      } catch (err) {
        result.failed++;
        logger.error(`[Migration] Error migrating task ${id}`, err);
      }

      // Yield to prevent blocking the UI during large migrations
      if (result.migrated % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    await this.markComplete(result);

    logger.info("[Migration] JSON → block migration complete", {
      migrated: result.migrated,
      skipped: result.skipped,
      failed: result.failed,
      orphans: result.orphanTasks.length,
    });

    return result;
  }

  /**
   * Mark migration as complete in plugin settings
   */
  private async markComplete(result: MigrationResult): Promise<void> {
    try {
      await this.plugin.saveData(MIGRATION_FLAG_KEY, {
        completed: true,
        timestamp: new Date().toISOString(),
        stats: {
          migrated: result.migrated,
          skipped: result.skipped,
          failed: result.failed,
          orphans: result.orphanTasks.length,
        },
      });
    } catch (err) {
      logger.error("[Migration] Failed to save migration flag", err);
    }
  }

  /**
   * Reset migration flag (for testing or re-migration)
   */
  async resetMigration(): Promise<void> {
    try {
      await this.plugin.saveData(MIGRATION_FLAG_KEY, { completed: false });
      logger.info("[Migration] Migration flag reset");
    } catch (err) {
      logger.error("[Migration] Failed to reset migration flag", err);
    }
  }
}
