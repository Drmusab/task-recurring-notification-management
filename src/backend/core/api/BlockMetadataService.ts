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

import { fetchSyncPost } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import * as logger from "@backend/logging/logger";

// Block attribute keys (prefixed with 'custom-' per SiYuan convention)
export const ATTR_TASK_ID = "custom-task-id";
export const ATTR_TASK_DUE = "custom-task-due";
export const ATTR_TASK_STATUS = "custom-task-status";
export const ATTR_TASK_PRIORITY = "custom-task-priority";
export const ATTR_TASK_RECURRENCE = "custom-task-recurrence";
export const ATTR_TASK_ENABLED = "custom-task-enabled";
export const ATTR_TASK_TAGS = "custom-task-tags";
export const ATTR_TASK_DATA = "custom-task-data";
export const ATTR_TASK_CATEGORY = "custom-task-category";
export const ATTR_TASK_CREATED = "custom-task-created";
export const ATTR_TASK_UPDATED = "custom-task-updated";

export interface BlockTaskMetadata {
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
        [ATTR_TASK_ID]: task.id,
        [ATTR_TASK_STATUS]: task.status || "todo",
        [ATTR_TASK_PRIORITY]: task.priority || "medium",
        [ATTR_TASK_ENABLED]: String(task.enabled !== false),
        [ATTR_TASK_CREATED]: task.createdAt || new Date().toISOString(),
        [ATTR_TASK_UPDATED]: new Date().toISOString(),
      };

      // Optional fields - only set if present
      if (task.dueAt) {
        attrs[ATTR_TASK_DUE] = typeof task.dueAt === "string"
          ? task.dueAt
          : new Date(task.dueAt).toISOString();
      }

      if (task.recurrence?.rrule) {
        attrs[ATTR_TASK_RECURRENCE] = task.recurrence.rrule;
      }

      if (task.tags && task.tags.length > 0) {
        attrs[ATTR_TASK_TAGS] = task.tags.join(",");
      }

      if (task.category) {
        attrs[ATTR_TASK_CATEGORY] = task.category;
      }

      // Store full task data as JSON fallback (for complex fields)
      const taskData = this.serializeTaskData(task);
      if (taskData) {
        attrs[ATTR_TASK_DATA] = taskData;
      }

      const response = await fetchSyncPost("/api/attr/setBlockAttrs", {
        id: blockId,
        attrs,
      });

      if (response?.code !== 0) {
        logger.error("[BlockMetadata] Failed to set block attrs", {
          blockId,
          code: response?.code,
          msg: response?.msg,
        });
        return false;
      }

      logger.debug("[BlockMetadata] Task attributes saved to block", { blockId, taskId: task.id });
      return true;
    } catch (error) {
      logger.error("[BlockMetadata] Error setting block attributes", error);
      return false;
    }
  }

  /**
   * Read task metadata from block attributes
   */
  async getTaskAttributes(blockId: string): Promise<BlockTaskMetadata | null> {
    if (!blockId) return null;

    try {
      const response = await fetchSyncPost("/api/attr/getBlockAttrs", {
        id: blockId,
      });

      if (response?.code !== 0 || !response?.data) {
        return null;
      }

      const attrs = response.data as Record<string, string>;
      const taskId = attrs[ATTR_TASK_ID];

      if (!taskId) {
        return null; // Not a task block
      }

      return {
        blockId,
        taskId,
        status: attrs[ATTR_TASK_STATUS] || "todo",
        priority: attrs[ATTR_TASK_PRIORITY] || "medium",
        dueAt: attrs[ATTR_TASK_DUE] || "",
        recurrence: attrs[ATTR_TASK_RECURRENCE] || "",
        enabled: attrs[ATTR_TASK_ENABLED] !== "false",
        tags: attrs[ATTR_TASK_TAGS] ? attrs[ATTR_TASK_TAGS].split(",") : [],
        category: attrs[ATTR_TASK_CATEGORY] || "",
      };
    } catch (error) {
      logger.error("[BlockMetadata] Error reading block attributes", error);
      return null;
    }
  }

  /**
   * Remove all task-related attributes from a block
   */
  async removeTaskAttributes(blockId: string): Promise<boolean> {
    if (!blockId) return false;

    try {
      const attrs: Record<string, string> = {
        [ATTR_TASK_ID]: "",
        [ATTR_TASK_STATUS]: "",
        [ATTR_TASK_PRIORITY]: "",
        [ATTR_TASK_DUE]: "",
        [ATTR_TASK_RECURRENCE]: "",
        [ATTR_TASK_ENABLED]: "",
        [ATTR_TASK_TAGS]: "",
        [ATTR_TASK_CATEGORY]: "",
        [ATTR_TASK_DATA]: "",
        [ATTR_TASK_CREATED]: "",
        [ATTR_TASK_UPDATED]: "",
      };

      const response = await fetchSyncPost("/api/attr/setBlockAttrs", {
        id: blockId,
        attrs,
      });

      return response?.code === 0;
    } catch (error) {
      logger.error("[BlockMetadata] Error removing block attributes", error);
      return false;
    }
  }

  /**
   * Query all blocks that have task metadata using SiYuan SQL
   */
  async queryTaskBlocks(filter?: {
    status?: string;
    priority?: string;
    dueBefore?: string;
    enabled?: boolean;
  }): Promise<BlockTaskMetadata[]> {
    try {
      // Sanitize filter values to prevent SQL injection
      const sanitize = (v: string) => v.replace(/['"\\;]/g, "");

      let sql = `SELECT blocks.id, blocks.ial FROM blocks 
        WHERE blocks.ial LIKE '%${sanitize(ATTR_TASK_ID)}%'`;

      if (filter?.status) {
        const safeStatus = sanitize(filter.status);
        sql += ` AND blocks.ial LIKE '%${sanitize(ATTR_TASK_STATUS)}="${safeStatus}"%'`;
      }

      if (filter?.priority) {
        const safePriority = sanitize(filter.priority);
        sql += ` AND blocks.ial LIKE '%${sanitize(ATTR_TASK_PRIORITY)}="${safePriority}"%'`;
      }

      if (filter?.enabled !== undefined) {
        sql += ` AND blocks.ial LIKE '%${sanitize(ATTR_TASK_ENABLED)}="${String(filter.enabled)}"%'`;
      }

      sql += " LIMIT 10000";

      const response = await fetchSyncPost("/api/query/sql", { stmt: sql });

      if (response?.code !== 0 || !Array.isArray(response?.data)) {
        return [];
      }

      const results: BlockTaskMetadata[] = [];
      for (const block of response.data) {
        const meta = await this.getTaskAttributes(block.id);
        if (meta) {
          results.push(meta);
        }
      }

      return results;
    } catch (error) {
      logger.error("[BlockMetadata] Error querying task blocks", error);
      return [];
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
    const taskId = attrs[ATTR_TASK_ID];
    if (!taskId) return null;

    // Try full JSON blob first (most reliable)
    const dataBlob = attrs[ATTR_TASK_DATA];
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
      dueAt: attrs[ATTR_TASK_DUE] || new Date().toISOString(),
      enabled: attrs[ATTR_TASK_ENABLED] !== "false",
      status: (attrs[ATTR_TASK_STATUS] as Task["status"]) || "todo",
      priority: (attrs[ATTR_TASK_PRIORITY] as Task["priority"]) || "medium",
      tags: attrs[ATTR_TASK_TAGS] ? attrs[ATTR_TASK_TAGS].split(",") : [],
      category: attrs[ATTR_TASK_CATEGORY] || "",
      linkedBlockId: blockId,
      version: 5,
      createdAt: attrs[ATTR_TASK_CREATED] || new Date().toISOString(),
      updatedAt: attrs[ATTR_TASK_UPDATED] || new Date().toISOString(),
      ...(attrs[ATTR_TASK_RECURRENCE] ? { recurrence: { rrule: attrs[ATTR_TASK_RECURRENCE] } } : {}),
    } as Task;
  }

  /**
   * Load ALL tasks from block attributes via SQL query.
   * Returns a Map<taskId, Task> for direct use by TaskStorage.
   */
  async loadAllTasks(): Promise<Map<string, Task>> {
    const tasks = new Map<string, Task>();

    try {
      const sql = `SELECT id, ial FROM blocks WHERE ial LIKE '%${ATTR_TASK_ID}%' LIMIT 50000`;
      const response = await fetchSyncPost("/api/query/sql", { stmt: sql });

      if (response?.code !== 0 || !Array.isArray(response?.data)) {
        logger.warn("[BlockMetadata] SQL query failed or returned no data");
        return tasks;
      }

      // For each block, fetch full attributes and deserialize
      for (const block of response.data) {
        try {
          const attrResponse = await fetchSyncPost("/api/attr/getBlockAttrs", { id: block.id });
          if (attrResponse?.code !== 0 || !attrResponse?.data) continue;

          const task = this.deserializeTask(block.id, attrResponse.data as Record<string, string>);
          if (task) {
            tasks.set(task.id, task);
          }
        } catch (e) {
          logger.warn("[BlockMetadata] Failed to load task from block", { blockId: block.id });
        }
      }

      logger.info(`[BlockMetadata] Loaded ${tasks.size} tasks from block attributes`);
      return tasks;
    } catch (error) {
      logger.error("[BlockMetadata] Failed to load tasks from blocks", error);
      return tasks;
    }
  }
}
