/**
 * SyncService — Block Attribute Sync Service
 *
 * Service-layer facade over BlockAttributeSync for task↔block
 * attribute synchronization via SiYuan Block Attribute API.
 *
 * API surface:
 *   syncTaskToBlock(task, blockId)    → write task metadata to block attrs
 *   markBlockCompleted(blockId, id)   → set status=done + completedAt
 *   readBlockAttributes(blockId)      → read task metadata from block
 *   clearTaskAttributes(blockId)      → remove all task attrs from block
 *   batchSync(tasks)                  → bulk sync for initial load
 *
 * SiYuan API used:
 *   POST /api/attr/setBlockAttrs  — write attributes
 *   POST /api/attr/getBlockAttrs  — read attributes
 *
 * Lifecycle:
 *   - Constructed (no side effects)
 *   - start() → mark active
 *   - stop()  → mark inactive
 *
 * FORBIDDEN:
 *   - Modify markdown via /api/block/updateBlock
 *   - Modify DOM
 *   - Scan all blocks
 *   - Import frontend / Svelte
 *   - Bypass BlockAttributeSync for direct API calls
 */

import type { Task } from "@backend/core/models/Task";
import type { BlockAttributeSync, BlockTaskAttributes } from "@backend/blocks/BlockAttributeSync";
import type { BlockMetadataService } from "@backend/core/api/BlockMetadataService";
import type { EventService } from "./EventService";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface SyncServiceDeps {
  blockAttributeSync: BlockAttributeSync;
  blockMetadataService: BlockMetadataService;
  eventService: EventService;
}

export interface BatchSyncResult {
  synced: number;
  failed: number;
  skipped: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class SyncService {
  private readonly blockSync: BlockAttributeSync;
  private readonly metadataService: BlockMetadataService;
  private readonly eventService: EventService;
  private active = false;

  // ── Stats ──────────────────────────────────────────────────
  private totalSynced = 0;
  private totalFailed = 0;

  constructor(deps: SyncServiceDeps) {
    this.blockSync = deps.blockAttributeSync;
    this.metadataService = deps.blockMetadataService;
    this.eventService = deps.eventService;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[SyncService] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    logger.info("[SyncService] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Sync a task's metadata to its linked SiYuan block attributes.
   *
   * Uses POST /api/attr/setBlockAttrs under the hood.
   * On failure, the operation is enqueued to BlockRetryQueue.
   *
   * @returns true if initial write succeeded, false if queued for retry
   */
  async syncTaskToBlock(task: Task, blockId: string): Promise<boolean> {
    this.requireActive("syncTaskToBlock");

    if (!blockId) {
      logger.warn("[SyncService] No blockId for task sync", { taskId: task.id });
      return false;
    }

    try {
      const success = await this.blockSync.syncTaskToBlock(task, blockId);
      if (success) {
        this.totalSynced++;
      } else {
        this.totalFailed++;
      }
      return success;
    } catch (error) {
      this.totalFailed++;
      logger.error("[SyncService] syncTaskToBlock error", {
        taskId: task.id,
        blockId,
        error,
      });
      return false;
    }
  }

  /**
   * Mark a block's task status as completed.
   *
   * Sets custom-task-status="done" and custom-task-completed-at=<now>.
   */
  async markBlockCompleted(blockId: string, taskId: string): Promise<boolean> {
    this.requireActive("markBlockCompleted");

    if (!blockId) return false;

    try {
      return await this.blockSync.markBlockCompleted(blockId, taskId);
    } catch (error) {
      logger.error("[SyncService] markBlockCompleted error", {
        blockId,
        taskId,
        error,
      });
      return false;
    }
  }

  /**
   * Read task metadata from a block's attributes.
   *
   * Uses POST /api/attr/getBlockAttrs under the hood.
   * Returns null if the block has no task attributes.
   */
  async readBlockAttributes(blockId: string): Promise<BlockTaskAttributes | null> {
    this.requireActive("readBlockAttributes");

    if (!blockId) return null;

    try {
      return await this.blockSync.readTaskAttributes(blockId);
    } catch (error) {
      logger.error("[SyncService] readBlockAttributes error", {
        blockId,
        error,
      });
      return null;
    }
  }

  /**
   * Clear all task-related attributes from a block (unlink task from block).
   */
  async clearTaskAttributes(blockId: string): Promise<boolean> {
    this.requireActive("clearTaskAttributes");

    if (!blockId) return false;

    try {
      return await this.blockSync.clearTaskAttributes(blockId);
    } catch (error) {
      logger.error("[SyncService] clearTaskAttributes error", {
        blockId,
        error,
      });
      return false;
    }
  }

  /**
   * Batch sync multiple tasks to their linked blocks.
   * Skips tasks without a blockId / linkedBlockId.
   */
  async batchSync(tasks: Task[]): Promise<BatchSyncResult> {
    this.requireActive("batchSync");

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const task of tasks) {
      const blockId = task.blockId || task.linkedBlockId;
      if (!blockId) {
        skipped++;
        continue;
      }

      const ok = await this.syncTaskToBlock(task, blockId);
      if (ok) {
        synced++;
      } else {
        failed++;
      }
    }

    if (synced > 0 || failed > 0) {
      logger.info("[SyncService] Batch sync complete", { synced, failed, skipped });
    }

    return { synced, failed, skipped };
  }

  /**
   * Sync a task to block via BlockMetadataService (higher-level sync).
   * Delegates to the existing BlockMetadataService for full metadata round-trip.
   */
  async syncViaMetadataService(task: Task): Promise<void> {
    this.requireActive("syncViaMetadataService");
    await this.metadataService.syncTaskToBlock(task);
  }

  /**
   * Get sync service stats.
   */
  getStats(): { totalSynced: number; totalFailed: number } {
    return {
      totalSynced: this.totalSynced,
      totalFailed: this.totalFailed,
    };
  }

  // ── Private ──────────────────────────────────────────────────

  private requireActive(method: string): void {
    if (!this.active) {
      throw new Error(`[SyncService] Not started — cannot call ${method}()`);
    }
  }
}
