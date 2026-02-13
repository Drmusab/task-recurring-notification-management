/**
 * TaskIndex - High-Performance In-Memory Index
 * Extracted from TaskStorage for O(1) lookups and O(log n) range queries
 * 
 * Indexes:
 * - By ID (taskId, linkedBlockId)
 * - By status
 * - By due date
 * - By scheduled date
 * - By tags
 * - By path
 * - By dependency relationships
 */

import type { Task } from '../../domain/models/Task';
import { isTaskCompleted, isTaskOverdue } from '../../domain/models/Task';

/**
 * Index structure for fast lookups
 */
export interface IndexStructure {
  // Primary indexes
  byId: Map<string, Task>;                  // id -> Task
  byBlockId: Map<string, Task>;             // linkedBlockId -> Task
  byTaskId: Map<string, Task>;              // taskId (dependency ID) -> Task
  
  // Status indexes
  byStatus: Map<string, Set<string>>;       // status -> Set<id>
  
  // Date indexes (sorted arrays for range queries)
  byDueDate: Array<{ date: string; id: string }>;
  byScheduledDate: Array<{ date: string; id: string }>;
  
  // Tag/path indexes
  byTag: Map<string, Set<string>>;          // tag -> Set<id>
  byPath: Map<string, Set<string>>;         // path -> Set<id>
  
  // Dependency indexes
  byDependsOn: Map<string, Set<string>>;    // taskId -> Set<id> (tasks that depend on this)
  blockedTasks: Set<string>;                 // Set of task IDs currently blocked
}

/**
 * TaskIndex provides fast lookups and queries
 */
export class TaskIndex {
  private index: IndexStructure;
  
  constructor() {
    this.index = this.createEmptyIndex();
  }
  
  /**
   * Create empty index structure
   */
  private createEmptyIndex(): IndexStructure {
    return {
      byId: new Map(),
      byBlockId: new Map(),
      byTaskId: new Map(),
      byStatus: new Map(),
      byDueDate: [],
      byScheduledDate: [],
      byTag: new Map(),
      byPath: new Map(),
      byDependsOn: new Map(),
      blockedTasks: new Set(),
    };
  }
  
  /**
   * Build index from task array (full rebuild)
   * Complexity: O(n log n) due to sorting
   */
  buildIndex(tasks: Task[]): void {
    this.index = this.createEmptyIndex();
    
    // First pass: Build primary indexes
    for (const task of tasks) {
      this.addToIndex(task);
    }
    
    // Sort date indexes
    this.sortDateIndexes();
    
    // Second pass: Calculate blocked tasks
    this.calculateBlockedTasks();
  }
  
  /**
   * Add single task to index (incremental update)
   * Complexity: O(log n) for date insertion, O(1) for others
   */
  addToIndex(task: Task): void {
    // Primary indexes
    this.index.byId.set(task.id, task);
    
    if (task.linkedBlockId) {
      this.index.byBlockId.set(task.linkedBlockId, task);
    }
    
    if (task.taskId) {
      this.index.byTaskId.set(task.taskId, task);
    }
    
    // Status index
    if (!this.index.byStatus.has(task.status)) {
      this.index.byStatus.set(task.status, new Set());
    }
    this.index.byStatus.get(task.status)!.add(task.id);
    
    // Date indexes (will need re-sort)
    if (task.dueAt) {
      this.index.byDueDate.push({ date: task.dueAt, id: task.id });
    }
    
    if (task.scheduledAt) {
      this.index.byScheduledDate.push({ date: task.scheduledAt, id: task.id });
    }
    
    // Tag index
    if (task.tags) {
      for (const tag of task.tags) {
        if (!this.index.byTag.has(tag)) {
          this.index.byTag.set(tag, new Set());
        }
        this.index.byTag.get(tag)!.add(task.id);
      }
    }
    
    // Path index
    if (task.path) {
      if (!this.index.byPath.has(task.path)) {
        this.index.byPath.set(task.path, new Set());
      }
      this.index.byPath.get(task.path)!.add(task.id);
    }
    
    // Dependency index
    if (task.dependsOn) {
      for (const depTaskId of task.dependsOn) {
        if (!this.index.byDependsOn.has(depTaskId)) {
          this.index.byDependsOn.set(depTaskId, new Set());
        }
        this.index.byDependsOn.get(depTaskId)!.add(task.id);
      }
    }
  }
  
  /**
   * Remove task from index
   * Complexity: O(k) where k = number of indexes task appears in
   */
  removeFromIndex(taskId: string): void {
    const task = this.index.byId.get(taskId);
    if (!task) return;
    
    // Primary indexes
    this.index.byId.delete(taskId);
    
    if (task.linkedBlockId) {
      this.index.byBlockId.delete(task.linkedBlockId);
    }
    
    if (task.taskId) {
      this.index.byTaskId.delete(task.taskId);
    }
    
    // Status index
    this.index.byStatus.get(task.status)?.delete(taskId);
    
    // Date indexes (remove from arrays)
    this.index.byDueDate = this.index.byDueDate.filter(entry => entry.id !== taskId);
    this.index.byScheduledDate = this.index.byScheduledDate.filter(entry => entry.id !== taskId);
    
    // Tag index
    if (task.tags) {
      for (const tag of task.tags) {
        this.index.byTag.get(tag)?.delete(taskId);
      }
    }
    
    // Path index
    if (task.path) {
      this.index.byPath.get(task.path)?.delete(taskId);
    }
    
    // Dependency index
    if (task.dependsOn) {
      for (const depTaskId of task.dependsOn) {
        this.index.byDependsOn.get(depTaskId)?.delete(taskId);
      }
    }
    
    // Blocked tasks
    this.index.blockedTasks.delete(taskId);
  }
  
  /**
   * Update task in index (remove + add)
   */
  updateInIndex(task: Task): void {
    this.removeFromIndex(task.id);
    this.addToIndex(task);
    this.sortDateIndexes(); // Re-sort after update
    this.calculateBlockedTasks(); // Recalculate dependencies
  }
  
  /**
   * Sort date indexes for range queries
   */
  private sortDateIndexes(): void {
    this.index.byDueDate.sort((a, b) => a.date.localeCompare(b.date));
    this.index.byScheduledDate.sort((a, b) => a.date.localeCompare(b.date));
  }
  
  /**
   * Calculate which tasks are currently blocked
   */
  private calculateBlockedTasks(): void {
    this.index.blockedTasks.clear();
    
    for (const task of this.index.byId.values()) {
      if (task.dependsOn && task.dependsOn.length > 0) {
        // Check if any dependency is not completed
        const hasOpenDeps = task.dependsOn.some(depTaskId => {
          const depTask = this.index.byTaskId.get(depTaskId);
          return depTask && !isTaskCompleted(depTask);
        });
        
        if (hasOpenDeps) {
          this.index.blockedTasks.add(task.id);
        }
      }
    }
  }
  
  // ===== Query Methods =====
  
  /**
   * Get task by ID
   * Complexity: O(1)
   */
  getById(id: string): Task | undefined {
    return this.index.byId.get(id);
  }
  
  /**
   * Get task by block ID
   * Complexity: O(1)
   */
  getByBlockId(blockId: string): Task | undefined {
    return this.index.byBlockId.get(blockId);
  }
  
  /**
   * Get task by dependency task ID
   * Complexity: O(1)
   */
  getByTaskId(taskId: string): Task | undefined {
    return this.index.byTaskId.get(taskId);
  }
  
  /**
   * Get all tasks with status
   * Complexity: O(1) for lookup, O(k) to build array where k = result size
   */
  getByStatus(status: string): Task[] {
    const ids = this.index.byStatus.get(status);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.index.byId.get(id))
      .filter((task): task is Task => task !== undefined);
  }
  
  /**
   * Get tasks with tag
   * Complexity: O(k) where k = result size
   */
  getByTag(tag: string): Task[] {
    const ids = this.index.byTag.get(tag);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.index.byId.get(id))
      .filter((task): task is Task => task !== undefined);
  }
  
  /**
   * Get tasks in path
   * Complexity: O(k) where k = result size
   */
  getByPath(path: string): Task[] {
    const ids = this.index.byPath.get(path);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.index.byId.get(id))
      .filter((task): task is Task => task !== undefined);
  }
  
  /**
   * Get tasks due before date (range query)
   * Complexity: O(log n + k) where k = result size
   */
  getDueBefore(date: string): Task[] {
    const index = this.binarySearchDate(this.index.byDueDate, date);
    
    return this.index.byDueDate
      .slice(0, index)
      .map(entry => this.index.byId.get(entry.id))
      .filter((task): task is Task => task !== undefined);
  }
  
  /**
   * Get tasks due after date
   * Complexity: O(log n + k) where k = result size
   */
  getDueAfter(date: string): Task[] {
    const index = this.binarySearchDate(this.index.byDueDate, date);
    
    return this.index.byDueDate
      .slice(index)
      .map(entry => this.index.byId.get(entry.id))
      .filter((task): task is Task => task !== undefined);
  }
  
  /**
   * Get overdue tasks
   * Complexity: O(log n + k)
   */
  getOverdue(): Task[] {
    const now = new Date().toISOString();
    return this.getDueBefore(now).filter(task => !isTaskCompleted(task));
  }
  
  /**
   * Get blocked tasks
   * Complexity: O(k) where k = number of blocked tasks
   */
  getBlocked(): Task[] {
    return Array.from(this.index.blockedTasks)
      .map(id => this.index.byId.get(id))
      .filter((task): task is Task => task !== undefined);
  }
  
  /**
   * Get tasks that depend on given task
   * Complexity: O(k) where k = number of dependent tasks
   */
  getDependents(taskId: string): Task[] {
    const ids = this.index.byDependsOn.get(taskId);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.index.byId.get(id))
      .filter((task): task is Task => task !== undefined);
  }
  
  /**
   * Get all tasks
   * Complexity: O(n)
   */
  getAll(): Task[] {
    return Array.from(this.index.byId.values());
  }
  
  /**
   * Get task count
   * Complexity: O(1)
   */
  getCount(): number {
    return this.index.byId.size;
  }

  // ===== Convenience Methods (Aliases for Store Compatibility) =====

  /**
   * Alias for getAll() - for store compatibility
   */
  getAllTasks(): Task[] {
    return this.getAll();
  }

  /**
   * Alias for addToIndex() - for store compatibility
   */
  add(task: Task): void {
    this.addToIndex(task);
    this.sortDateIndexes();
    this.calculateBlockedTasks();
  }

  /**
   * Alias for updateInIndex() - for store compatibility
   */
  update(id: string, task: Task): void {
    this.updateInIndex(task);
  }

  /**
   * Alias for removeFromIndex() - for store compatibility
   */
  remove(id: string): void {
    this.removeFromIndex(id);
  }
  
  /**
   * Binary search for date in sorted date index
   * Returns insertion point
   */
  private binarySearchDate(arr: Array<{ date: string; id: string }>, target: string): number {
    let left = 0;
    let right = arr.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      
      if (arr[mid]!.date < target) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    return left;
  }
}
