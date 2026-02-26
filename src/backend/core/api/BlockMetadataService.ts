/**
 * BlockMetadataService - SiYuan Block Attribute Storage for Tasks
 * 
 * Replaces JSON-file-based task persistence with SiYuan's native block
 * attribute system. Tasks are stored as metadata on their linked blocks,
 * enabling direct DB queries and cross-plugin interoperability.
 * 
 * Uses SiYuan's kernel API:
 * - /api/attr/setBlockAttrs  - Write task metadata to block
 * - /api/attr/getBlockAttrs  - Read task metadata from block
 * - /api/query/sql            - Query tasks via SQL (block DB)
 * 
 * Block Attribute Schema:
 * - custom-task-id:        Unique task identifier
 * - custom-task-due:       ISO date string for due date
 * - custom-task-status:    Task status (todo/done/in_progress/cancelled)
 * - custom-task-priority:  Priority level (low/medium/high/urgent)
 * - custom-task-recurrence: RRule string for recurrence pattern
 * - custom-task-enabled:   Whether the task is active (true/false)
 * - custom-task-tags:      Comma-separated tags
 * - custom-task-data:      JSON blob for full task data (fallback)
 */

import type { Task } from "@backend/core/models/Task";
import * as logger from "@backend/logging/logger";
import {
  setBlockAttrs,
  getBlockAttrs,
  querySql,
  SiYuanApiError,
} from "@backend/core/api/SiYuanApiClient";
import { pluginEventBus } from "@backend/core/events/PluginEventBus";
import {
  BLOCK_ATTR_TASK_ID,
  BLOCK_ATTR_TASK_DUE,
  BLOCK_ATTR_TASK_STATUS,
  BLOCK_ATTR_TASK_PRIORITY,
  BLOCK_ATTR_TASK_RECURRENCE,
  BLOCK_ATTR_TASK_ENABLED,
  BLOCK_ATTR_TASK_TAGS,
  BLOCK_ATTR_TASK_DATA,
  BLOCK_ATTR_TASK_CATEGORY,
  BLOCK_ATTR_TASK_CREATED,
  BLOCK_ATTR_TASK_UPDATED,
} from "@shared/constants/misc-constants";

interface BlockTaskMetadata {
  blockId: string;
  taskId: string;
  status: string;
  priority: string;
  dueAt: string;
  recurrence: string;
  enabled: boolean;
  tags: string[];
  category: string;
}

export class BlockMetadataService {
  /**
   * Write task metadata as block attributes in SiYuan
   */
  async setTaskAttributes(blockId: string, task: Task): Promise<boolean> {
    if (!blockId) {
      logger.warn("[BlockMetadata] Cannot set attributes: no blockId");
      return false;
    }

    try {
      const attrs: Record<string, string> = {
        [BLOCK_ATTR_TASK_ID]: task.id,
        [BLOCK_ATTR_TASK_STATUS]: task.status || "todo",
        [BLOCK_ATTR_TASK_PRIORITY]: task.priority || "medium",
        [BLOCK_ATTR_TASK_ENABLED]: String(task.enabled !== false),
        [BLOCK_ATTR_TASK_CREATED]: task.createdAt || new Date().toISOString(),
        [BLOCK_ATTR_TASK_UPDATED]: new Date().toISOString(),
      };

      // Optional fields - only set if present
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

      // Store full task data as JSON fallback (for complex fields)
      const taskData = this.serializeTaskData(task);
      if (taskData) {
        attrs[BLOCK_ATTR_TASK_DATA] = taskData;
      }

      await setBlockAttrs(blockId, attrs);

      logger.debug("[BlockMetadata] Task attributes saved to block", { blockId, taskId: task.id });

      // Emit event so dashboard/calendar/AI panels react to the update
      pluginEventBus.emit("task:updated", { taskId: task.id });

      return true;
    } catch (error) {
      if (error instanceof SiYuanApiError) {
        logger.error("[BlockMetadata] Failed to set block attrs", {
          blockId,
          code: error.code,
          msg: error.kernelMessage,
        });
      } else {
        logger.error("[BlockMetadata] Error setting block attributes", error);
      }
      return false;
    }
  }

  /**
   * Read task metadata from block attributes
   */
  async getTaskAttributes(blockId: string): Promise<BlockTaskMetadata | null> {
    if (!blockId) return null;

    try {
      const attrs = await getBlockAttrs(blockId);

      const taskId = attrs[BLOCK_ATTR_TASK_ID];

      if (!taskId) {
        return null; // Not a task block
      }

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
      };
    } catch (error) {
      logger.error("[BlockMetadata] Error reading block attributes", error);
      return null;
    }
  }

  /**
   * Sync a task to its linked block (if blockId is present)
   */
  async syncTaskToBlock(task: Task): Promise<boolean> {
    const blockId = (task as any).blockId || (task as any).linkedBlockId;
    if (!blockId) return false;
    return this.setTaskAttributes(blockId, task);
  }

  /**
   * Batch sync multiple tasks to their linked blocks
   */
  async batchSyncTasks(tasks: Task[]): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    for (const task of tasks) {
      const blockId = (task as any).blockId || (task as any).linkedBlockId;
      if (!blockId) continue;

      const success = await this.setTaskAttributes(blockId, task);
      if (success) synced++;
      else failed++;
    }

    logger.info(`[BlockMetadata] Batch sync complete: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  /**
   * Serialize task to compact JSON for block attribute storage
   * Only includes fields not already stored as individual attributes
   */
  private serializeTaskData(task: Task): string | null {
    try {
      // Store the FULL task as JSON for complete round-trip fidelity
      return JSON.stringify(task);
    } catch {
      return null;
    }
  }

  /**
   * Deserialize a full Task from block attributes.
   * Uses the `custom-task-data` JSON blob as primary source (contains full Task),
   * falling back to individual attributes for partial reconstruction.
   */
  deserializeTask(blockId: string, attrs: Record<string, string>): Task | null {
    const taskId = attrs[BLOCK_ATTR_TASK_ID];
    if (!taskId) return null;

    // Try full JSON blob first (most reliable)
    const dataBlob = attrs[BLOCK_ATTR_TASK_DATA];
    if (dataBlob) {
      try {
        const task = JSON.parse(dataBlob) as Task;
        // Ensure blockId is set
        if (!task.linkedBlockId) task.linkedBlockId = blockId;
        return task;
      } catch {
        logger.warn("[BlockMetadata] Failed to parse task data blob", { blockId, taskId });
      }
    }

    // Fallback: reconstruct from individual attributes (partial data)
    return {
      id: taskId,
      name: `Task ${taskId.slice(0, 8)}`, // placeholder name
      dueAt: attrs[BLOCK_ATTR_TASK_DUE] || new Date().toISOString(),
      enabled: attrs[BLOCK_ATTR_TASK_ENABLED] !== "false",
      status: (attrs[BLOCK_ATTR_TASK_STATUS] as Task["status"]) || "todo",
      priority: (attrs[BLOCK_ATTR_TASK_PRIORITY] as Task["priority"]) || "medium",
      tags: attrs[BLOCK_ATTR_TASK_TAGS] ? attrs[BLOCK_ATTR_TASK_TAGS].split(",") : [],
      category: attrs[BLOCK_ATTR_TASK_CATEGORY] || "",
      linkedBlockId: blockId,
      version: 5,
      createdAt: attrs[BLOCK_ATTR_TASK_CREATED] || new Date().toISOString(),
      updatedAt: attrs[BLOCK_ATTR_TASK_UPDATED] || new Date().toISOString(),
      ...(attrs[BLOCK_ATTR_TASK_RECURRENCE] ? { recurrence: { rrule: attrs[BLOCK_ATTR_TASK_RECURRENCE] } } : {}),
    } as Task;
  }

  /**
   * Load ALL tasks from block attributes via SQL query.
   * Returns a Map<taskId, Task> for direct use by TaskStorage.
   *
   * Performance fix: parses the `ial` field inline from the SQL result
   * instead of issuing an individual getBlockAttrs call per block (N+1).
   */
  async loadAllTasks(): Promise<Map<string, Task>> {
    const tasks = new Map<string, Task>();

    try {
      const sql = `SELECT id, ial FROM blocks WHERE ial LIKE '%${BLOCK_ATTR_TASK_ID}%' LIMIT 50000`;
      const rows = await querySql<Array<{ id: string; ial: string }>>(sql);

      if (!Array.isArray(rows)) {
        logger.warn("[BlockMetadata] SQL query returned non-array data");
        return tasks;
      }

      for (const row of rows) {
        try {
          const attrs = this.parseIal(row.ial);
          if (!attrs) continue;

          const task = this.deserializeTask(row.id, attrs);
          if (task) {
            tasks.set(task.id, task);
          }
        } catch (e) {
          logger.warn("[BlockMetadata] Failed to parse task from IAL", { blockId: row.id });
        }
      }

      logger.info(`[BlockMetadata] Loaded ${tasks.size} tasks from block attributes`);
      return tasks;
    } catch (error) {
      logger.error("[BlockMetadata] Failed to load tasks from blocks", error);
      return tasks;
    }
  }

  /**
   * Parse SiYuan's IAL string into a key-value map.
   *
   * IAL format: `{: key="value" key2="value2" }`
   * Returns null if the string is empty or unparseable.
   */
  private parseIal(ial: string): Record<string, string> | null {
    if (!ial) return null;

    const attrs: Record<string, string> = {};
    // Match key="value" pairs inside the IAL braces
    const pairRegex = /(\S+?)="([^"]*)"/g;
    let match: RegExpExecArray | null;

    while ((match = pairRegex.exec(ial)) !== null) {
      const key = match[1];
      const val = match[2];
      if (key !== undefined && val !== undefined) {
        attrs[key] = val;
      }
    }

    return Object.keys(attrs).length > 0 ? attrs : null;
  }
}