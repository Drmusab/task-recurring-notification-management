/**
 * TaskIndexManager - Multi-attribute indexing for high-performance task queries
 * 
 * Provides O(1) lookups for common query patterns by maintaining indexes
 * on frequently queried task attributes.
 * 
 * Target Performance:
 * - Index rebuild < 500ms for 10,000 tasks
 * - Query by tag/priority/status: O(1) lookup
 * - Query by date: O(log n) lookup with sorted index
 * 
 * Phase 1, Week 1 - Performance Optimization
 */

import type { Task, TaskPriority } from '@backend/core/models/Task';
import * as logger from '@backend/logging/logger';

/**
 * Task status type (aligned with Task interface)
 */
export type TaskStatus = 'todo' | 'done' | 'cancelled';

/**
 * Index statistics for monitoring and optimization
 */
export interface IndexStats {
  /** Total number of tasks indexed */
  totalTasks: number;
  /** Number of unique tags */
  uniqueTags: number;
  /** Number of unique priorities */
  uniquePriorities: number;
  /** Number of unique status values */
  uniqueStatuses: number;
  /** Number of tasks with due dates */
  tasksWithDueDates: number;
  /** Number of tasks with scheduled dates */
  tasksWithScheduledDates: number;
  /** Last rebuild timestamp */
  lastRebuild: number;
  /** Time taken for last rebuild (ms) */
  lastRebuildDuration: number;
}

/**
 * TaskIndexManager maintains multiple indexes for fast task queries
 * 
 * Features:
 * - Tag index for O(1) tag-based queries
 * - Priority index for O(1) priority filtering
 * - Status index for O(1) status filtering
 * - Due date index for fast date range queries
 * - Scheduled date index for calendar views
 * - Block ID index for SiYuan integration
 * 
 * Usage:
 * ```typescript
 * const indexManager = new TaskIndexManager();
 * indexManager.rebuildIndexes(taskMap);
 * 
 * // Fast lookups
 * const todoTasks = indexManager.queryByStatus('todo');
 * const urgentTasks = indexManager.queryByPriority('highest');
 * const taggedTasks = indexManager.queryByTags(['work', 'important']);
 * ```
 */
export class TaskIndexManager {
  // Core indexes
  private tagIndex: Map<string, Set<string>> = new Map();
  private priorityIndex: Map<TaskPriority | 'none', Set<string>> = new Map();
  private statusIndex: Map<TaskStatus, Set<string>> = new Map();
  private dueDateIndex: Map<string, Set<string>> = new Map(); // YYYY-MM-DD -> task IDs
  private scheduledDateIndex: Map<string, Set<string>> = new Map(); // YYYY-MM-DD -> task IDs
  private blockIdIndex: Map<string, string> = new Map(); // blockId -> taskId
  private taskBlockIndex: Map<string, string> = new Map(); // taskId -> blockId
  
  // Statistics
  private stats: IndexStats = {
    totalTasks: 0,
    uniqueTags: 0,
    uniquePriorities: 0,
    uniqueStatuses: 0,
    tasksWithDueDates: 0,
    tasksWithScheduledDates: 0,
    lastRebuild: 0,
    lastRebuildDuration: 0,
  };

  /**
   * Rebuild all indexes from a task map
   * 
   * Target: < 500ms for 10,000 tasks
   * 
   * @param tasks - Map of task ID to Task objects
   */
  rebuildIndexes(tasks: Map<string, Task>): void {
    const startTime = performance.now();
    
    // Clear existing indexes
    this.clearIndexes();
    
    // Build indexes
    for (const [taskId, task] of tasks.entries()) {
      this.indexTask(taskId, task);
    }
    
    // Update statistics
    const duration = performance.now() - startTime;
    this.stats = {
      totalTasks: tasks.size,
      uniqueTags: this.tagIndex.size,
      uniquePriorities: this.priorityIndex.size,
      uniqueStatuses: this.statusIndex.size,
      tasksWithDueDates: this.dueDateIndex.size,
      tasksWithScheduledDates: this.scheduledDateIndex.size,
      lastRebuild: Date.now(),
      lastRebuildDuration: duration,
    };
    
    logger.info(
      `TaskIndexManager rebuilt: ${tasks.size} tasks in ${duration.toFixed(1)}ms ` +
      `(tags=${this.tagIndex.size}, priorities=${this.priorityIndex.size})`
    );
  }

  /**
   * Add a single task to all indexes
   * 
   * @param taskId - Task ID
   * @param task - Task object
   */
  addTask(taskId: string, task: Task): void {
    this.indexTask(taskId, task);
    this.stats.totalTasks++;
    
    logger.debug(`TaskIndexManager added: ${taskId}`);
  }

  /**
   * Remove a task from all indexes
   * 
   * @param taskId - Task ID
   * @param task - Task object (needed to remove from attribute indexes)
   */
  removeTask(taskId: string, task: Task): void {
    this.deindexTask(taskId, task);
    this.stats.totalTasks--;
    
    logger.debug(`TaskIndexManager removed: ${taskId}`);
  }

  /**
   * Update a task in all indexes
   * 
   * @param taskId - Task ID
   * @param oldTask - Previous task state
   * @param newTask - New task state
   */
  updateTask(taskId: string, oldTask: Task, newTask: Task): void {
    this.deindexTask(taskId, oldTask);
    this.indexTask(taskId, newTask);
    
    logger.debug(`TaskIndexManager updated: ${taskId}`);
  }

  /**
   * Query tasks by status
   * 
   * @param status - Task status
   * @returns Set of task IDs (O(1) lookup)
   */
  queryByStatus(status: TaskStatus): Set<string> {
    return new Set(this.statusIndex.get(status) || []);
  }

  /**
   * Query tasks by priority
   * 
   * @param priority - Task priority or 'none'
   * @returns Set of task IDs (O(1) lookup)
   */
  queryByPriority(priority: TaskPriority | 'none'): Set<string> {
    return new Set(this.priorityIndex.get(priority) || []);
  }

  /**
   * Query tasks by tags
   * 
   * Returns intersection of all tasks with ALL specified tags.
   * 
   * @param tags - Array of tag names (without # prefix)
   * @returns Set of task IDs (O(k) where k = number of tags)
   */
  queryByTags(tags: string[]): Set<string> {
    if (tags.length === 0) {
      return new Set();
    }
    
    // Start with tasks for first tag (we know tags[0] exists because length > 0)
    const firstTag = tags[0]!;
    const result = new Set(this.tagIndex.get(firstTag) || []);
    
    // Intersect with tasks for remaining tags
    for (let i = 1; i < tags.length; i++) {
      const tag = tags[i]!; // We know this exists because i < length
      const tagTasks = this.tagIndex.get(tag);
      if (!tagTasks) {
        // No tasks have this tag - intersection is empty
        return new Set();
      }
      
      // Keep only tasks that have this tag too
      for (const taskId of result) {
        if (!tagTasks.has(taskId)) {
          result.delete(taskId);
        }
      }
      
      // Early exit if intersection is empty
      if (result.size === 0) {
        return result;
      }
    }
    
    return result;
  }

  /**
   * Query tasks by single tag
   * 
   * @param tag - Tag name (without # prefix)
   * @returns Set of task IDs (O(1) lookup)
   */
  queryByTag(tag: string): Set<string> {
    return new Set(this.tagIndex.get(tag) || []);
  }

  /**
   * Query tasks by due date
   * 
   * @param date - Date in YYYY-MM-DD format or Date object
   * @returns Set of task IDs (O(1) lookup)
   */
  queryByDueDate(date: string | Date): Set<string> {
    const dateKey = typeof date === 'string' ? date : this.formatDate(date);
    return new Set(this.dueDateIndex.get(dateKey) || []);
  }

  /**
   * Query tasks by scheduled date
   * 
   * @param date - Date in YYYY-MM-DD format or Date object
   * @returns Set of task IDs (O(1) lookup)
   */
  queryByScheduledDate(date: string | Date): Set<string> {
    const dateKey = typeof date === 'string' ? date : this.formatDate(date);
    return new Set(this.scheduledDateIndex.get(dateKey) || []);
  }

  /**
   * Query tasks by date range
   * 
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @param dateField - 'due' or 'scheduled'
   * @returns Set of task IDs
   */
  queryByDateRange(
    startDate: string | Date, 
    endDate: string | Date,
    dateField: 'due' | 'scheduled' = 'due'
  ): Set<string> {
    const start = typeof startDate === 'string' ? startDate : this.formatDate(startDate);
    const end = typeof endDate === 'string' ? endDate : this.formatDate(endDate);
    
    const index = dateField === 'due' ? this.dueDateIndex : this.scheduledDateIndex;
    const result = new Set<string>();
    
    for (const [dateKey, taskIds] of index.entries()) {
      if (dateKey >= start && dateKey <= end) {
        for (const taskId of taskIds) {
          result.add(taskId);
        }
      }
    }
    
    return result;
  }

  /**
   * Get task ID by block ID (SiYuan integration)
   * 
   * @param blockId - SiYuan block ID
   * @returns Task ID or undefined (O(1) lookup)
   */
  getTaskByBlockId(blockId: string): string | undefined {
    return this.blockIdIndex.get(blockId);
  }

  /**
   * Get block ID by task ID (SiYuan integration)
   * 
   * @param taskId - Task ID
   * @returns Block ID or undefined (O(1) lookup)
   */
  getBlockByTaskId(taskId: string): string | undefined {
    return this.taskBlockIndex.get(taskId);
  }

  /**
   * Get index statistics
   * 
   * @returns Current index statistics
   */
  getStats(): IndexStats {
    return { ...this.stats };
  }

  /**
   * Clear all indexes
   */
  private clearIndexes(): void {
    this.tagIndex.clear();
    this.priorityIndex.clear();
    this.statusIndex.clear();
    this.dueDateIndex.clear();
    this.scheduledDateIndex.clear();
    this.blockIdIndex.clear();
    this.taskBlockIndex.clear();
  }

  /**
   * Add a task to all applicable indexes
   */
  private indexTask(taskId: string, task: Task): void {
    // Index status
    this.addToIndex(this.statusIndex, task.status, taskId);
    
    // Index priority
    const priority = task.priority || 'none';
    this.addToIndex(this.priorityIndex, priority, taskId);
    
    // Index tags
    if (task.tags && task.tags.length > 0) {
      for (const tag of task.tags) {
        // Remove # prefix if present
        const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
        this.addToIndex(this.tagIndex, cleanTag, taskId);
      }
    }
    
    // Index due date
    if (task.dueAt) {
      const dateKey = this.formatDate(new Date(task.dueAt));
      this.addToIndex(this.dueDateIndex, dateKey, taskId);
    }
    
    // Index scheduled date
    if (task.scheduledAt) {
      const dateKey = this.formatDate(new Date(task.scheduledAt));
      this.addToIndex(this.scheduledDateIndex, dateKey, taskId);
    }
    
    // Index block ID (SiYuan integration)
    if (task.linkedBlockId) {
      this.blockIdIndex.set(task.linkedBlockId, taskId);
      this.taskBlockIndex.set(taskId, task.linkedBlockId);
    }
  }

  /**
   * Remove a task from all applicable indexes
   */
  private deindexTask(taskId: string, task: Task): void {
    // Remove from status index
    this.removeFromIndex(this.statusIndex, task.status, taskId);
    
    // Remove from priority index
    const priority = task.priority || 'none';
    this.removeFromIndex(this.priorityIndex, priority, taskId);
    
    // Remove from tag indexes
    if (task.tags && task.tags.length > 0) {
      for (const tag of task.tags) {
        const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
        this.removeFromIndex(this.tagIndex, cleanTag, taskId);
      }
    }
    
    // Remove from due date index
    if (task.dueAt) {
      const dateKey = this.formatDate(new Date(task.dueAt));
      this.removeFromIndex(this.dueDateIndex, dateKey, taskId);
    }
    
    // Remove from scheduled date index
    if (task.scheduledAt) {
      const dateKey = this.formatDate(new Date(task.scheduledAt));
      this.removeFromIndex(this.scheduledDateIndex, dateKey, taskId);
    }
    
    // Remove from block ID index
    if (task.linkedBlockId) {
      this.blockIdIndex.delete(task.linkedBlockId);
      this.taskBlockIndex.delete(taskId);
    }
  }

  /**
   * Add a task ID to a set-based index
   */
  private addToIndex<K>(index: Map<K, Set<string>>, key: K, taskId: string): void {
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(taskId);
  }

  /**
   * Remove a task ID from a set-based index
   */
  private removeFromIndex<K>(index: Map<K, Set<string>>, key: K, taskId: string): void {
    const set = index.get(key);
    if (set) {
      set.delete(taskId);
      // Clean up empty sets
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  /**
   * Format a Date object as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
