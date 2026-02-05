/**
 * Incremental task index for fast queries
 * Listens to block changes and updates only affected entries
 */

import type { Task } from "@backend/core/models/Task";
import type { StatusType } from "@backend/core/models/Status";
import * as logger from "@shared/utils/misc/logger";

export interface Filter {
  type: "status" | "due" | "scheduled" | "tag" | "path";
  value: any;
}

export class TaskIndex {
  // Indexes
  private byId: Map<string, Task> = new Map();
  private byBlockId: Map<string, string> = new Map(); // blockId → taskId
  private byDue: Map<string, Set<string>> = new Map(); // date key → taskIds
  private byScheduled: Map<string, Set<string>> = new Map();
  private byStatus: Map<string, Set<string>> = new Map();
  private byTag: Map<string, Set<string>> = new Map();
  private byPath: Map<string, Set<string>> = new Map();

  // Debounce tracking
  private pendingUpdates: Map<string, NodeJS.Timeout> = new Map();
  private debounceMs: number = 300;

  constructor(debounceMs: number = 300) {
    this.debounceMs = debounceMs;
  }

  /**
   * Incremental update when a block changes
   */
  onBlockChanged(blockId: string, content: string, task?: Task): void {
    // Clear any pending debounced update
    const pending = this.pendingUpdates.get(blockId);
    if (pending) {
      clearTimeout(pending);
    }

    // Debounce rapid changes
    const timeout = setTimeout(() => {
      this.processBlockChange(blockId, content, task);
      this.pendingUpdates.delete(blockId);
    }, this.debounceMs);

    this.pendingUpdates.set(blockId, timeout);
  }

  private processBlockChange(blockId: string, content: string, task?: Task): void {
    const existingTaskId = this.byBlockId.get(blockId);
    
    if (existingTaskId) {
      // Remove old entry
      this.removeTaskFromIndexes(existingTaskId);
    }

    if (task) {
      // Add new/updated entry
      this.addTaskToIndexes(task);
      this.byBlockId.set(blockId, task.id);
    }
  }

  /**
   * Handle block deletion
   */
  onBlockDeleted(blockId: string): void {
    const taskId = this.byBlockId.get(blockId);
    if (taskId) {
      this.removeTaskFromIndexes(taskId);
      this.byBlockId.delete(blockId);
    }
  }

  /**
   * Handle block moved to new path
   */
  onBlockMoved(blockId: string, newPath: string): void {
    const taskId = this.byBlockId.get(blockId);
    if (!taskId) return;

    const task = this.byId.get(taskId);
    if (!task) return;

    // Remove from old path index
    const oldPath = task.linkedBlockContent || "";
    this.removeFromSetIndex(this.byPath, oldPath, taskId);

    // Add to new path index
    this.addToSetIndex(this.byPath, newPath, taskId);

    // Update task
    task.linkedBlockContent = newPath;
  }

  /**
   * Rebuild entire index
   */
  async rebuildIndex(
    tasks: Task[],
    progressCallback?: (percent: number) => void
  ): Promise<void> {
    logger.info(`Rebuilding task index with ${tasks.length} tasks`);
    
    // Clear all indexes
    this.clearAllIndexes();

    const batchSize = 1000;
    const total = tasks.length;

    for (let i = 0; i < total; i += batchSize) {
      const batch = tasks.slice(i, Math.min(i + batchSize, total));
      
      for (const task of batch) {
        this.addTaskToIndexes(task);
      }

      if (progressCallback) {
        const percent = Math.min(100, Math.floor(((i + batchSize) / total) * 100));
        progressCallback(percent);
      }

      // Yield to UI thread every batch
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (progressCallback) {
      progressCallback(100);
    }

    logger.info(`Index rebuild complete: ${this.byId.size} tasks indexed`);
  }

  /**
   * Query tasks by filters
   */
  query(filters: Filter[]): Task[] {
    if (filters.length === 0) {
      return Array.from(this.byId.values());
    }

    // Start with all task IDs
    let resultIds = new Set(this.byId.keys());

    // Apply each filter
    for (const filter of filters) {
      const filterIds = this.getIdsForFilter(filter);
      resultIds = this.intersect(resultIds, filterIds);
    }

    // Convert IDs to tasks
    const tasks: Task[] = [];
    for (const id of resultIds) {
      const task = this.byId.get(id);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * Get tasks by due date range
   */
  getByDueRange(start: Date, end: Date): Task[] {
    const startKey = this.toDateKey(start);
    const endKey = this.toDateKey(end);
    
    const resultIds = new Set<string>();
    
    for (const [dateKey, taskIds] of this.byDue) {
      if (dateKey >= startKey && dateKey <= endKey) {
        taskIds.forEach(id => resultIds.add(id));
      }
    }

    return Array.from(resultIds)
      .map(id => this.byId.get(id))
      .filter((task): task is Task => task !== undefined);
  }

  /**
   * Get tasks by status
   */
  getByStatus(statusType: string): Task[] {
    const taskIds = this.byStatus.get(statusType) || new Set();
    return Array.from(taskIds)
      .map(id => this.byId.get(id))
      .filter((task): task is Task => task !== undefined);
  }

  /**
   * Get tasks by tag
   */
  getByTag(tag: string): Task[] {
    const taskIds = this.byTag.get(tag) || new Set();
    return Array.from(taskIds)
      .map(id => this.byId.get(id))
      .filter((task): task is Task => task !== undefined);
  }

  /**
   * Get task by ID
   */
  getById(id: string): Task | undefined {
    return this.byId.get(id);
  }

  /**
   * Get task by block ID
   */
  getByBlockId(blockId: string): Task | undefined {
    const taskId = this.byBlockId.get(blockId);
    return taskId ? this.byId.get(taskId) : undefined;
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.byId.values());
  }

  // Private helper methods

  private addTaskToIndexes(task: Task): void {
    // Main index
    this.byId.set(task.id, task);

    // Block index
    if (task.linkedBlockId) {
      this.byBlockId.set(task.linkedBlockId, task.id);
    }

    // Due date index
    if (task.dueAt) {
      const dateKey = this.toDateKey(new Date(task.dueAt));
      this.addToSetIndex(this.byDue, dateKey, task.id);
    }

    // Scheduled date index
    if (task.scheduledAt) {
      const dateKey = this.toDateKey(new Date(task.scheduledAt));
      this.addToSetIndex(this.byScheduled, dateKey, task.id);
    }

    // Status index
    if (task.status) {
      this.addToSetIndex(this.byStatus, task.status, task.id);
    }

    // Tag index
    if (task.tags) {
      for (const tag of task.tags) {
        this.addToSetIndex(this.byTag, tag, task.id);
      }
    }

    // Path index
    if (task.linkedBlockContent) {
      this.addToSetIndex(this.byPath, task.linkedBlockContent, task.id);
    }
  }

  private removeTaskFromIndexes(taskId: string): void {
    const task = this.byId.get(taskId);
    if (!task) return;

    // Remove from all indexes
    this.byId.delete(taskId);

    if (task.linkedBlockId) {
      this.byBlockId.delete(task.linkedBlockId);
    }

    if (task.dueAt) {
      const dateKey = this.toDateKey(new Date(task.dueAt));
      this.removeFromSetIndex(this.byDue, dateKey, taskId);
    }

    if (task.scheduledAt) {
      const dateKey = this.toDateKey(new Date(task.scheduledAt));
      this.removeFromSetIndex(this.byScheduled, dateKey, taskId);
    }

    if (task.status) {
      this.removeFromSetIndex(this.byStatus, task.status, taskId);
    }

    if (task.tags) {
      for (const tag of task.tags) {
        this.removeFromSetIndex(this.byTag, tag, taskId);
      }
    }

    if (task.linkedBlockContent) {
      this.removeFromSetIndex(this.byPath, task.linkedBlockContent, taskId);
    }
  }

  private clearAllIndexes(): void {
    this.byId.clear();
    this.byBlockId.clear();
    this.byDue.clear();
    this.byScheduled.clear();
    this.byStatus.clear();
    this.byTag.clear();
    this.byPath.clear();
  }

  private addToSetIndex(index: Map<string, Set<string>>, key: string, taskId: string): void {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(taskId);
  }

  private removeFromSetIndex(index: Map<string, Set<string>>, key: string, taskId: string): void {
    const set = index.get(key);
    if (set) {
      set.delete(taskId);
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private getIdsForFilter(filter: Filter): Set<string> {
    switch (filter.type) {
      case "status":
        return this.byStatus.get(filter.value) || new Set();
      case "tag":
        return this.byTag.get(filter.value) || new Set();
      case "path":
        return this.byPath.get(filter.value) || new Set();
      case "due": {
        const dateKey = this.toDateKey(filter.value);
        return this.byDue.get(dateKey) || new Set();
      }
      case "scheduled": {
        const dateKey = this.toDateKey(filter.value);
        return this.byScheduled.get(dateKey) || new Set();
      }
      default:
        return new Set();
    }
  }

  private intersect(set1: Set<string>, set2: Set<string>): Set<string> {
    const result = new Set<string>();
    for (const item of set1) {
      if (set2.has(item)) {
        result.add(item);
      }
    }
    return result;
  }

  /**
   * Clean up pending updates
   */
  destroy(): void {
    for (const timeout of this.pendingUpdates.values()) {
      clearTimeout(timeout);
    }
    this.pendingUpdates.clear();
  }
}
