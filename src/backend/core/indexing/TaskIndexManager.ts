/**
 * @fileoverview Multi-attribute indexing for O(1) task lookups
 * @reference obsidian-tasks Cache.ts indexing strategy
 * @constraint Support 10k+ tasks with <100ms queries
 * 
 * Provides efficient indexed access to tasks by various attributes:
 * - Tags (multi-value index)
 * - Priority (single-value index)
 * - Status (single-value index)
 * - Due date (range index)
 * - Linked blocks (unique index)
 */

import type { Task, TaskPriority } from '../models/Task';

/**
 * Index rebuild statistics
 */
export interface IndexStats {
    taskCount: number;
    rebuildTimeMs: number;
    indexSizes: {
        tags: number;
        priorities: number;
        statuses: number;
        dueDates: number;
        linkedBlocks: number;
    };
}

/**
 * Task index manager for fast attribute-based lookups
 * 
 * **Performance Characteristics:**
 * - Lookup: O(1) for indexed attributes
 * - Rebuild: O(n) where n = number of tasks
 * - Memory: ~5-10MB for 10k tasks
 * 
 * **Example Usage:**
 * ```typescript
 * const indexManager = new TaskIndexManager();
 * 
 * // Rebuild indexes after loading tasks
 * indexManager.rebuildIndexes(taskMap);
 * 
 * // Fast queries
 * const highPriorityIds = indexManager.queryByPriority('high');
 * const taggedIds = indexManager.queryByTags(['work', 'urgent']);
 * const dueTodayIds = indexManager.queryByDueDateRange('2024-01-15', '2024-01-15');
 * ```
 */
export class TaskIndexManager {
    // Multi-attribute indexes
    private tagIndex: Map<string, Set<string>> = new Map();
    private priorityIndex: Map<string, Set<string>> = new Map();
    private statusIndex: Map<string, Set<string>> = new Map();
    private dueDateIndex: Map<string, Set<string>> = new Map(); // YYYY-MM-DD → taskIds
    private linkedBlockIndex: Map<string, string> = new Map(); // blockId → taskId (1:1)

    /**
     * Rebuild all indexes from task collection
     * 
     * Call after: initial load, bulk import, migration
     * 
     * @param tasks - Map of taskId → Task
     * @returns Statistics about rebuild operation
     */
    rebuildIndexes(tasks: Map<string, Task>): IndexStats {
        const startTime = performance.now();

        this.clearAll();

        for (const [taskId, task] of tasks.entries()) {
            this.indexTask(taskId, task);
        }

        const elapsed = performance.now() - startTime;

        return {
            taskCount: tasks.size,
            rebuildTimeMs: elapsed,
            indexSizes: {
                tags: this.tagIndex.size,
                priorities: this.priorityIndex.size,
                statuses: this.statusIndex.size,
                dueDates: this.dueDateIndex.size,
                linkedBlocks: this.linkedBlockIndex.size
            }
        };
    }

    /**
     * Index a single task (for incremental updates)
     * 
     * Call when: creating new task, updating task attributes
     */
    indexTask(taskId: string, task: Task): void {
        // Tag index (multi-value)
        task.tags?.forEach(tag => {
            this.addToIndex(this.tagIndex, tag, taskId);
        });

        // Priority index
        if (task.priority) {
            this.addToIndex(this.priorityIndex, task.priority, taskId);
        }

        // Status index
        if (task.status) {
            this.addToIndex(this.statusIndex, task.status, taskId);
        }

        // Due date index (extract date part only)
        if (task.dueAt) {
            const dateKey = this.extractDateKey(task.dueAt);
            if (dateKey) {
                this.addToIndex(this.dueDateIndex, dateKey, taskId);
            }
        }

        // Linked block index (1:1 mapping)
        if (task.linkedBlockId) {
            this.linkedBlockIndex.set(task.linkedBlockId, taskId);
        }
    }

    /**
     * Remove task from all indexes
     * 
     * Call when: deleting task, before updating indexed attributes
     */
    removeTask(taskId: string, task: Task): void {
        // Remove from tag index
        task.tags?.forEach(tag => {
            this.removeFromIndex(this.tagIndex, tag, taskId);
        });

        // Remove from priority index
        if (task.priority) {
            this.removeFromIndex(this.priorityIndex, task.priority, taskId);
        }

        // Remove from status index
        if (task.status) {
            this.removeFromIndex(this.statusIndex, task.status, taskId);
        }

        // Remove from due date index
        if (task.dueAt) {
            const dateKey = this.extractDateKey(task.dueAt);
            if (dateKey) {
                this.removeFromIndex(this.dueDateIndex, dateKey, taskId);
            }
        }

        // Remove from linked block index
        if (task.linkedBlockId) {
            this.linkedBlockIndex.delete(task.linkedBlockId);
        }
    }

    /**
     * Update task indexes (remove old, add new)
     * 
     * Call when: updating task with indexed attribute changes
     */
    updateTask(taskId: string, oldTask: Task, newTask: Task): void {
        this.removeTask(taskId, oldTask);
        this.indexTask(taskId, newTask);
    }

    // Query Methods

    /**
     * Query tasks by tags (AND logic - all tags must match)
     * 
     * @param tags - Array of tag names
     * @returns Array of task IDs matching all tags
     */
    queryByTags(tags: string[]): string[] {
        if (tags.length === 0) return [];

        // Get sets for each tag
        const sets = tags.map(tag => this.tagIndex.get(tag) || new Set<string>());

        // Return intersection
        return Array.from(this.intersectSets(sets));
    }

    /**
     * Query tasks by any of the given tags (OR logic)
     * 
     * @param tags - Array of tag names
     * @returns Array of task IDs matching any tag
     */
    queryByAnyTag(tags: string[]): string[] {
        if (tags.length === 0) return [];

        const result = new Set<string>();
        tags.forEach(tag => {
            const tagSet = this.tagIndex.get(tag);
            if (tagSet) {
                tagSet.forEach(id => result.add(id));
            }
        });

        return Array.from(result);
    }

    /**
     * Query tasks by priority
     */
    queryByPriority(priority: TaskPriority): string[] {
        return Array.from(this.priorityIndex.get(priority) || new Set());
    }

    /**
     * Query tasks by status
     */
    queryByStatus(status: string): string[] {
        return Array.from(this.statusIndex.get(status) || new Set());
    }

    /**
     * Query tasks by due date range (inclusive)
     * 
     * @param startDate - Start date (YYYY-MM-DD format)
     * @param endDate - End date (YYYY-MM-DD format)
     * @returns Array of task IDs with due dates in range
     */
    queryByDueDateRange(startDate: string, endDate: string): string[] {
        const taskIds = new Set<string>();

        for (const [dateKey, ids] of this.dueDateIndex.entries()) {
            if (dateKey >= startDate && dateKey <= endDate) {
                ids.forEach(id => taskIds.add(id));
            }
        }

        return Array.from(taskIds);
    }

    /**
     * Query tasks due on specific date
     */
    queryByDueDate(date: string): string[] {
        return Array.from(this.dueDateIndex.get(date) || new Set());
    }

    /**
     * Query task by linked block ID
     * 
     * @returns Task ID or undefined if not found
     */
    queryByBlockId(blockId: string): string | undefined {
        return this.linkedBlockIndex.get(blockId);
    }

    /**
     * Get all unique tags in index
     */
    getAllTags(): string[] {
        return Array.from(this.tagIndex.keys());
    }

    /**
     * Get all unique priorities in index
     */
    getAllPriorities(): string[] {
        return Array.from(this.priorityIndex.keys());
    }

    /**
     * Get all unique statuses in index
     */
    getAllStatuses(): string[] {
        return Array.from(this.statusIndex.keys());
    }

    // Helper Methods

    /**
     * Add value to multi-value index
     */
    private addToIndex<K>(index: Map<K, Set<string>>, key: K, value: string): void {
        if (!index.has(key)) {
            index.set(key, new Set());
        }
        const indexSet = index.get(key);
        if (indexSet) {
            indexSet.add(value);
        }
    }

    /**
     * Remove value from multi-value index
     */
    private removeFromIndex<K>(index: Map<K, Set<string>>, key: K, value: string): void {
        const set = index.get(key);
        if (set) {
            set.delete(value);
            // Clean up empty sets
            if (set.size === 0) {
                index.delete(key);
            }
        }
    }

    /**
     * Compute intersection of multiple sets
     */
    private intersectSets(sets: Set<string>[]): Set<string> {
        if (sets.length === 0) return new Set();
        const firstSet = sets[0];
        if (sets.length === 1) return firstSet || new Set();

        // Start with first set
        let result = new Set(sets[0]);

        // Intersect with remaining sets
        for (let i = 1; i < sets.length; i++) {
            const currentSet = sets[i];
            if (!currentSet) continue;
            
            const intersection = new Set<string>();
            for (const item of result) {
                if (currentSet.has(item)) {
                    intersection.add(item);
                }
            }

            // Early termination if intersection is empty
            if (intersection.size === 0) return new Set();

            result = intersection;
        }

        return result;
    }

    /**
     * Extract date key from ISO timestamp
     * 
     * @param isoString - ISO 8601 timestamp
     * @returns Date in YYYY-MM-DD format, or null if invalid
     */
    private extractDateKey(isoString: string): string | null {
        const match = isoString.match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? (match[1] || null) : null;
    }

    /**
     * Clear all indexes
     */
    private clearAll(): void {
        this.tagIndex.clear();
        this.priorityIndex.clear();
        this.statusIndex.clear();
        this.dueDateIndex.clear();
        this.linkedBlockIndex.clear();
    }
}
