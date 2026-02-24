/**
 * SiYuan Block API Helpers
 * Based on official plugin-sample patterns
 * 
 * Centralizes all Block API interactions for consistency and maintainability.
 * See: https://github.com/siyuan-note/siyuan/blob/master/API.md
 */

import { fetchPost, fetchSyncPost, type IWebSocketData } from "siyuan";
import type { Plugin } from "siyuan";

/**
 * Request wrapper with error handling
 */
async function request(url: string, data: any): Promise<any> {
  const response: IWebSocketData = await fetchSyncPost(url, data);
  return response.code === 0 ? response.data : null;
}

/**
 * Block API service following SiYuan official patterns
 */
export class BlockAPI {
  constructor(private plugin: Plugin) {}

  // ==================== Block CRUD Operations ====================

  /**
   * Insert a new block
   * @param dataType - Block data type (markdown, dom, etc.)
   * @param data - Block content
   * @param nextID - Optional: Insert before this block ID
   */
  async insertBlock(dataType: string, data: string, nextID?: string): Promise<any> {
    return request("/api/block/insertBlock", {
      dataType,
      data,
      nextID,
    });
  }

  /**
   * Prepend a block to a parent
   */
  async prependBlock(parentID: string, dataType: string, data: string): Promise<any> {
    return request("/api/block/prependBlock", {
      parentID,
      dataType,
      data,
    });
  }

  /**
   * Append a block to a parent
   */
  async appendBlock(parentID: string, dataType: string, data: string): Promise<any> {
    return request("/api/block/appendBlock", {
      parentID,
      dataType,
      data,
    });
  }

  /**
   * Update an existing block
   */
  async updateBlock(id: string, data: string, dataType: string = "markdown"): Promise<any> {
    return request("/api/block/updateBlock", {
      id,
      data,
      dataType,
    });
  }

  /**
   * Delete a block
   */
  async deleteBlock(id: string): Promise<any> {
    return request("/api/block/deleteBlock", { id });
  }

  /**
   * Move a block to a new location
   */
  async moveBlock(id: string, previousID?: string, parentID?: string): Promise<any> {
    return request("/api/block/moveBlock", {
      id,
      previousID,
      parentID,
    });
  }

  // ==================== Block Attributes ====================

  /**
   * Set custom attributes on a block
   */
  async setBlockAttrs(id: string, attrs: Record<string, string>): Promise<any> {
    return request("/api/attr/setBlockAttrs", {
      id,
      attrs,
    });
  }

  /**
   * Get block attributes
   */
  async getBlockAttrs(id: string): Promise<any> {
    return request("/api/attr/getBlockAttrs", { id });
  }

  // ==================== Block Content ====================

  /**
   * Get block in Kramdown format
   */
  async getBlockKramdown(id: string): Promise<any> {
    return request("/api/block/getBlockKramdown", { id });
  }

  /**
   * Get child blocks of a parent
   */
  async getChildBlocks(id: string): Promise<any> {
    return request("/api/block/getChildBlocks", { id });
  }

  // ==================== Notebook Operations ====================

  /**
   * List all notebooks
   */
  async lsNotebooks(): Promise<any> {
    return request("/api/notebook/lsNotebooks", {});
  }

  /**
   * Get notebook configuration
   */
  async getNotebookConf(notebook: string): Promise<any> {
    return request("/api/notebook/getNotebookConf", { notebook });
  }

  // ==================== Document Operations ====================

  /**
   * Create document with markdown
   */
  async createDocWithMd(notebook: string, path: string, markdown: string): Promise<any> {
    return request("/api/filetree/createDocWithMd", {
      notebook,
      path,
      markdown,
    });
  }

  /**
   * Rename document
   */
  async renameDoc(notebook: string, path: string, title: string): Promise<any> {
    return request("/api/filetree/renameDoc", {
      notebook,
      path,
      title,
    });
  }

  /**
   * Remove document
   */
  async removeDoc(notebook: string, path: string): Promise<any> {
    return request("/api/filetree/removeDoc", {
      notebook,
      path,
    });
  }

  // ==================== SQL Query ====================

  /**
   * Execute SQL query on SiYuan database
   */
  async sql(sql: string): Promise<any> {
    return request("/api/query/sql", { stmt: sql });
  }
}

/**
 * Task-specific block operations
 */
export class TaskBlockService {
  private blockAPI: BlockAPI;

  constructor(private plugin: Plugin) {
    this.blockAPI = new BlockAPI(plugin);
  }

  /**
   * Create a task block in SiYuan document
   * Returns block ID for linking
   */
  async createTaskBlock(
    task: {
      id: string;
      name: string;
      description?: string;
      status?: string;
      priority?: string;
      dueAt?: string;
      enabled?: boolean;
    },
    parentBlockId?: string
  ): Promise<string> {
    const markdown = this.formatTaskAsMarkdown(task);

    let result;
    if (parentBlockId) {
      result = await this.blockAPI.appendBlock(parentBlockId, "markdown", markdown);
    } else {
      result = await this.blockAPI.insertBlock("markdown", markdown);
    }

    const blockId = result?.[0]?.doOperations?.[0]?.id;
    if (!blockId) {
      throw new Error("Failed to get block ID from insert result");
    }

    // Set block attributes to link task
    await this.blockAPI.setBlockAttrs(blockId, {
      "custom-task-id": task.id,
      "custom-task-due": task.dueAt || "",
      "custom-task-enabled": task.enabled ? "true" : "false",
      "custom-task-type": "recurring",
    });

    return blockId;
  }

  /**
   * Update existing task block
   */
  async updateTaskBlock(
    blockId: string,
    task: {
      id: string;
      name: string;
      description?: string;
      status?: string;
      priority?: string;
      dueAt?: string;
      enabled?: boolean;
    }
  ): Promise<void> {
    const markdown = this.formatTaskAsMarkdown(task);
    await this.blockAPI.updateBlock(blockId, markdown);

    await this.blockAPI.setBlockAttrs(blockId, {
      "custom-task-id": task.id,
      "custom-task-due": task.dueAt || "",
      "custom-task-enabled": task.enabled ? "true" : "false",
    });
  }

  /**
   * Find task blocks by custom attributes
   */
  async findTaskBlocks(taskId: string): Promise<any[]> {
    const sql = `SELECT * FROM blocks WHERE type='p' AND content LIKE '%${taskId}%' AND ial LIKE '%custom-task-id="${taskId}"%'`;
    const result = await this.blockAPI.sql(sql);
    return result || [];
  }

  /**
   * Format task as markdown for block content
   */
  private formatTaskAsMarkdown(task: {
    name: string;
    description?: string;
    status?: string;
    priority?: string;
    dueAt?: string;
  }): string {
    const checkbox = task.status === "done" ? "x" : " ";
    const priority = task.priority ? `[${task.priority}]` : "";
    const due = task.dueAt ? `📅 ${task.dueAt}` : "";

    let markdown = `- [${checkbox}] ${priority} ${task.name} ${due}`.trim();

    if (task.description) {
      markdown += `\n  ${task.description}`;
    }

    return markdown;
  }
}
