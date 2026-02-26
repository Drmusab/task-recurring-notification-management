/**
 * BlockAttributeSync — Canonical authority for block↔attribute reads and writes
 *
 * Single point of truth for:
 *   1. Writing task metadata → SiYuan block attributes (via /api/attr/setBlockAttrs)
 *   2. Reading task metadata ← SiYuan block attributes (via /api/attr/getBlockAttrs)
 *   3. Clearing task attributes when a task is unlinked from a block
 *
 * On failure, the write operation is enqueued to BlockRetryQueue for
 * exponential backoff retry.
 *
 * Uses canonical attribute constants from @shared/constants/misc-constants.
 *
 * FORBIDDEN:
 *   - Modifying markdown, DOM, or kramdown
 *   - Calling /api/block/updateBlock (content modification)
 *   - Scanning all blocks
 *
 * Lifecycle:
 *   - Constructed in onload() (no side effects)
 *   - Active after onLayoutReady() (depends on BlockRetryQueue.start())
 *   - No explicit stop — depends on BlockRetryQueue lifecycle
 */

import type { Task } from "@backend/core/models/Task";
import * as logger from "@backend/logging/logger";
import {
  setBlockAttrs,
  getBlockAttrs,
  SiYuanApiError,
} from "@backend/core/api/SiYuanApiClient";
import {
  BLOCK_ATTR_TASK_ID,
  BLOCK_ATTR_TASK_DUE,
  BLOCK_ATTR_TASK_ENABLED,
  BLOCK_ATTR_TASK_STATUS,
  BLOCK_ATTR_TASK_PRIORITY,
  BLOCK_ATTR_TASK_RECURRENCE,
  BLOCK_ATTR_TASK_TAGS,
  BLOCK_ATTR_TASK_DATA,
  BLOCK_ATTR_TASK_CATEGORY,
  BLOCK_ATTR_TASK_CREATED,
  BLOCK_ATTR_TASK_UPDATED,
  BLOCK_ATTR_TASK_COMPLETED_AT,
} from "@shared/constants/misc-constants";
import type { BlockRetryQueue } from "@backend/blocks/BlockRetryQueue";

// ── Types ───────────────────────────────────────────────────

export interface BlockTaskAttributes {
  blockId: string;
  taskId: string;
  status: string;
  priority: string;
  dueAt: string;
  recurrence: string;
  enabled: boolean;
  tags: string[];
  category: string;
  completedAt?: string;
}

// ── Implementation ──────────────────────────────────────────

export class BlockAttributeSync {
  constructor(private retryQueue: BlockRetryQueue) {}

  /**
   * Write task metadata as SiYuan block attributes.
   * On API failure, the operation is enqueued for retry.
   *
   * @returns true if the initial write succeeded, false if it failed (but was queued)
   */
  async syncTaskToBlock(task: Task, blockId: string): Promise<boolean> {
    if (!blockId) {
      logger.warn("[BlockAttributeSync] Cannot sync: no blockId", { taskId: task.id });
      return false;
    }

    const attrs = this.buildAttributes(task);

    try {
      await setBlockAttrs(blockId, attrs);
      logger.debug("[BlockAttributeSync] Task synced to block", { blockId, taskId: task.id });
      return true;
    } catch (error) {
      this.handleWriteError(error, blockId, task.id, attrs);
      return false;
    }
  }

  /**
   * Write a completion timestamp to block attributes.
   */
  async markBlockCompleted(blockId: string, taskId: string): Promise<boolean> {
    if (!blockId) return false;

    const now = new Date().toISOString();
    const attrs: Record<string, string> = {
      [BLOCK_ATTR_TASK_STATUS]: "done",
      [BLOCK_ATTR_TASK_COMPLETED_AT]: now,
      [BLOCK_ATTR_TASK_UPDATED]: now,
    };

    try {
      await setBlockAttrs(blockId, attrs);
      logger.debug("[BlockAttributeSync] Block marked completed", { blockId, taskId });
      return true;
    } catch (error) {
      this.handleWriteError(error, blockId, taskId, attrs);
      return false;
    }
  }

  /**
   * Read task metadata from block attributes.
   * Returns null if the block has no task attributes.
   */
  async readTaskAttributes(blockId: string): Promise<BlockTaskAttributes | null> {
    if (!blockId) return null;

    try {
      const attrs = await getBlockAttrs(blockId);
      const taskId = attrs[BLOCK_ATTR_TASK_ID];
      if (!taskId) return null;

      return {
        blockId,
        taskId,
        status: attrs[BLOCK_ATTR_TASK_STATUS] || "todo",
        priority: attrs[BLOCK_ATTR_TASK_PRIORITY] || "medium",
        dueAt: attrs[BLOCK_ATTR_TASK_DUE] || "",
        recurrence: attrs[BLOCK_ATTR_TASK_RECURRENCE] || "",
        enabled: attrs[BLOCK_ATTR_TASK_ENABLED] !== "false",
        tags: attrs[BLOCK_ATTR_TASK_TAGS] ? attrs[BLOCK_ATTR_TASK_TAGS].split(",") : [],
        category: attrs[BLOCK_ATTR_TASK_CATEGORY] || "",
        completedAt: attrs[BLOCK_ATTR_TASK_COMPLETED_AT] || undefined,
      };
    } catch (error) {
      logger.error("[BlockAttributeSync] Failed to read block attributes", {
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
    if (!blockId) return false;

    const emptyAttrs: Record<string, string> = {
      [BLOCK_ATTR_TASK_ID]: "",
      [BLOCK_ATTR_TASK_DUE]: "",
      [BLOCK_ATTR_TASK_ENABLED]: "",
      [BLOCK_ATTR_TASK_STATUS]: "",
      [BLOCK_ATTR_TASK_PRIORITY]: "",
      [BLOCK_ATTR_TASK_RECURRENCE]: "",
      [BLOCK_ATTR_TASK_TAGS]: "",
      [BLOCK_ATTR_TASK_DATA]: "",
      [BLOCK_ATTR_TASK_CATEGORY]: "",
      [BLOCK_ATTR_TASK_CREATED]: "",
      [BLOCK_ATTR_TASK_UPDATED]: "",
      [BLOCK_ATTR_TASK_COMPLETED_AT]: "",
    };

    try {
      await setBlockAttrs(blockId, emptyAttrs);
      logger.debug("[BlockAttributeSync] Task attributes cleared", { blockId });
      return true;
    } catch (error) {
      logger.error("[BlockAttributeSync] Failed to clear block attributes", {
        blockId,
        error,
      });
      return false;
    }
  }

  // ── Private Helpers ─────────────────────────────────────────

  /**
   * Build the canonical attribute map from a Task object.
   * Only task metadata goes into block attributes — NEVER block content.
   */
  private buildAttributes(task: Task): Record<string, string> {
    const attrs: Record<string, string> = {
      [BLOCK_ATTR_TASK_ID]: task.id,
      [BLOCK_ATTR_TASK_STATUS]: task.status || "todo",
      [BLOCK_ATTR_TASK_PRIORITY]: task.priority || "medium",
      [BLOCK_ATTR_TASK_ENABLED]: String(task.enabled !== false),
      [BLOCK_ATTR_TASK_CREATED]: task.createdAt || new Date().toISOString(),
      [BLOCK_ATTR_TASK_UPDATED]: new Date().toISOString(),
    };

    if (task.dueAt) {
      attrs[BLOCK_ATTR_TASK_DUE] = typeof task.dueAt === "string"
        ? task.dueAt
        : new Date(task.dueAt).toISOString();
    }

    if (task.recurrence?.rrule) {
      attrs[BLOCK_ATTR_TASK_RECURRENCE] = task.recurrence.rrule;
    }

    if (task.tags && task.tags.length > 0) {
      attrs[BLOCK_ATTR_TASK_TAGS] = task.tags.join(",");
    }

    if (task.category) {
      attrs[BLOCK_ATTR_TASK_CATEGORY] = task.category;
    }

    if (task.lastCompletedAt) {
      attrs[BLOCK_ATTR_TASK_COMPLETED_AT] = task.lastCompletedAt;
    }

    // Full task JSON for round-trip fidelity
    try {
      attrs[BLOCK_ATTR_TASK_DATA] = JSON.stringify(task);
    } catch {
      logger.warn("[BlockAttributeSync] Failed to serialize task data", { taskId: task.id });
    }

    return attrs;
  }

  /**
   * Handle a write failure: log and enqueue for retry.
   */
  private handleWriteError(
    error: unknown,
    blockId: string,
    taskId: string,
    attrs: Record<string, string>
  ): void {
    if (error instanceof SiYuanApiError) {
      logger.error("[BlockAttributeSync] API error writing block attrs", {
        blockId,
        taskId,
        code: error.code,
        msg: error.kernelMessage,
      });
    } else {
      logger.error("[BlockAttributeSync] Error writing block attributes", {
        blockId,
        taskId,
        error,
      });
    }

    // Enqueue for retry
    this.retryQueue.enqueue(
      `${blockId}:sync`,
      async () => {
        await setBlockAttrs(blockId, attrs);
      },
      { blockId, taskId, action: "syncTaskToBlock" }
    );
  }
}
