/**
 * Time-Partitioned History Storage
 * 
 * Solves the problem of unbounded history growth by:
 * - Partitioning completed tasks by month
 * - Lazy loading historical data
 * - Automatic archival/cleanup of old partitions
 * - Bounded memory usage
 * 
 * Storage structure:
 * - data/tasks-active.json (active/open tasks - in memory)
 * - data/history/2026-02.json (completed tasks for Feb 2026)
 * - data/history/2026-01.json (completed tasks for Jan 2026)
 * - etc.
 */

import type { Task } from '../domain/models/Task';

/**
 * History partition (one month of completed tasks)
 */
export interface HistoryPartition {
  month: string;              // Format: YYYY-MM
  tasks: Task[];
  count: number;
  oldestCompletion: string;   // ISO timestamp
  newestCompletion: string;   // ISO timestamp
  sizeBytes?: number;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  activeTaskCount: number;
  historyPartitionCount: number;
  totalHistoricalTasks: number;
  oldestPartition: string | null;
  newestPartition: string | null;
  totalSizeBytes: number;
}

/**
 * Query options for historical data
 */
export interface HistoryQueryOptions {
  fromDate?: string;          // ISO date string
  toDate?: string;            // ISO date string
  limit?: number;
  offset?: number;
  sortBy?: 'completedAt' | 'dueAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Archive policy
 */
export interface ArchivePolicy {
  enabled: boolean;
  retentionMonths: number;    // How many months to keep queryable
  deleteAfter: boolean;       // Delete or export old partitions
  exportPath?: string;        // Where to export archived partitions
}

/**
 * History Storage Manager
 */
export class HistoryStorage {
  private basePath: string;
  private loadedPartitions: Map<string, HistoryPartition> = new Map();
  private archivePolicy: ArchivePolicy;

  constructor(basePath: string = 'data/history', archivePolicy?: ArchivePolicy) {
    this.basePath = basePath;
    this.archivePolicy = archivePolicy || {
      enabled: true,
      retentionMonths: 12,
      deleteAfter: false,
      exportPath: 'data/archive',
    };
  }

  /**
   * Get partition key for a date
   */
  private getPartitionKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get partition file path
   */
  private getPartitionPath(partitionKey: string): string {
    return `${this.basePath}/${partitionKey}.json`;
  }

  /**
   * Load a partition from storage
   */
  async loadPartition(partitionKey: string): Promise<HistoryPartition | null> {
    // Check cache first
    if (this.loadedPartitions.has(partitionKey)) {
      return this.loadedPartitions.get(partitionKey)!;
    }

    try {
      const path = this.getPartitionPath(partitionKey);
      
      // In SiYuan, use file API
      // For now, use localStorage as fallback
      const stored = localStorage.getItem(`history-partition-${partitionKey}`);
      
      if (!stored) {
        return null;
      }

      const partition: HistoryPartition = JSON.parse(stored);
      
      // Cache the loaded partition
      this.loadedPartitions.set(partitionKey, partition);
      
      return partition;

    } catch (error) {
      console.error(`Failed to load partition ${partitionKey}:`, error);
      return null;
    }
  }

  /**
   * Save a partition to storage
   */
  async savePartition(partition: HistoryPartition): Promise<void> {
    try {
      const path = this.getPartitionPath(partition.month);
      const data = JSON.stringify(partition, null, 2);
      
      // Update cache
      this.loadedPartitions.set(partition.month, partition);
      
      // In SiYuan, use file API
      // For now, use localStorage as fallback
      localStorage.setItem(`history-partition-${partition.month}`, data);
      
    } catch (error) {
      throw new Error(`Failed to save partition ${partition.month}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add completed task to history
   */
  async addCompletedTask(task: Task): Promise<void> {
    // Determine partition based on completion date
    const completionDate = task.doneAt || task.cancelledAt || new Date().toISOString();
    const partitionKey = this.getPartitionKey(completionDate);

    // Load or create partition
    let partition = await this.loadPartition(partitionKey);
    
    if (!partition) {
      partition = {
        month: partitionKey,
        tasks: [],
        count: 0,
        oldestCompletion: completionDate,
        newestCompletion: completionDate,
      };
    }

    // Add task to partition
    partition.tasks.push(task);
    partition.count = partition.tasks.length;
    
    // Update timestamps
    if (completionDate < partition.oldestCompletion) {
      partition.oldestCompletion = completionDate;
    }
    if (completionDate > partition.newestCompletion) {
      partition.newestCompletion = completionDate;
    }

    // Calculate size
    partition.sizeBytes = new Blob([JSON.stringify(partition)]).size;

    // Save partition
    await this.savePartition(partition);
  }

  /**
   * Query historical tasks
   */
  async queryHistory(options: HistoryQueryOptions = {}): Promise<Task[]> {
    const results: Task[] = [];
    
    // Determine which partitions to load
    const partitionKeys = await this.getRelevantPartitions(options.fromDate, options.toDate);

    // Load and filter tasks from each partition
    for (const key of partitionKeys) {
      const partition = await this.loadPartition(key);
      
      if (!partition) continue;

      let tasks = partition.tasks;

      // Apply date filters
      if (options.fromDate) {
        tasks = tasks.filter(t => {
          const completionDate = t.doneAt || t.cancelledAt || '';
          return completionDate >= options.fromDate!;
        });
      }

      if (options.toDate) {
        tasks = tasks.filter(t => {
          const completionDate = t.doneAt || t.cancelledAt || '';
          return completionDate <= options.toDate!;
        });
      }

      results.push(...tasks);
    }

    // Sort results
    if (options.sortBy) {
      results.sort((a, b) => {
        let aValue: string | undefined;
        let bValue: string | undefined;

        switch (options.sortBy) {
          case 'completedAt':
            aValue = a.doneAt || a.cancelledAt;
            bValue = b.doneAt || b.cancelledAt;
            break;
          case 'dueAt':
            aValue = a.dueAt;
            bValue = b.dueAt;
            break;
          case 'priority':
            aValue = a.priority;
            bValue = b.priority;
            break;
        }

        if (!aValue && !bValue) return 0;
        if (!aValue) return 1;
        if (!bValue) return -1;

        const comparison = aValue.localeCompare(bValue);
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || results.length;
    
    return results.slice(offset, offset + limit);
  }

  /**
   * Get partition keys that might contain tasks in date range
   */
  private async getRelevantPartitions(fromDate?: string, toDate?: string): Promise<string[]> {
    const allPartitions = await this.listPartitions();
    
    if (!fromDate && !toDate) {
      return allPartitions;
    }

    const from = fromDate ? this.getPartitionKey(fromDate) : '0000-00';
    const to = toDate ? this.getPartitionKey(toDate) : '9999-99';

    return allPartitions.filter(key => key >= from && key <= to);
  }

  /**
   * List all partition keys
   */
  async listPartitions(): Promise<string[]> {
    const partitions: string[] = [];
    
    // Scan localStorage for partition keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('history-partition-')) {
        const partitionKey = key.replace('history-partition-', '');
        partitions.push(partitionKey);
      }
    }

    return partitions.sort();
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    const partitions = await this.listPartitions();
    let totalTasks = 0;
    let totalSize = 0;

    for (const key of partitions) {
      const partition = await this.loadPartition(key);
      if (partition) {
        totalTasks += partition.count;
        totalSize += partition.sizeBytes || 0;
      }
    }

    return {
      activeTaskCount: 0, // Would come from active task store
      historyPartitionCount: partitions.length,
      totalHistoricalTasks: totalTasks,
      oldestPartition: partitions[0] || null,
      newestPartition: partitions[partitions.length - 1] || null,
      totalSizeBytes: totalSize,
    };
  }

  /**
   * Archive old partitions
   */
  async archiveOldPartitions(): Promise<{ archived: number; deleted: number }> {
    if (!this.archivePolicy.enabled) {
      return { archived: 0, deleted: 0 };
    }

    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - this.archivePolicy.retentionMonths, 1);
    const cutoffKey = this.getPartitionKey(cutoffDate);

    const partitions = await this.listPartitions();
    const oldPartitions = partitions.filter(key => key < cutoffKey);

    let archived = 0;
    let deleted = 0;

    for (const key of oldPartitions) {
      if (this.archivePolicy.deleteAfter) {
        // Delete partition
        localStorage.removeItem(`history-partition-${key}`);
        this.loadedPartitions.delete(key);
        deleted++;
      } else {
        // Export partition (implementation would write to archive path)
        const partition = await this.loadPartition(key);
        if (partition && this.archivePolicy.exportPath) {
          // Export logic here (write to file, etc.)
          archived++;
        }
      }
    }

    return { archived, deleted };
  }

  /**
   * Compact a partition (remove duplicates, optimize storage)
   */
  async compactPartition(partitionKey: string): Promise<void> {
    const partition = await this.loadPartition(partitionKey);
    
    if (!partition) {
      throw new Error(`Partition not found: ${partitionKey}`);
    }

    // Remove duplicate tasks (by ID)
    const seen = new Set<string>();
    partition.tasks = partition.tasks.filter(task => {
      if (seen.has(task.id)) {
        return false;
      }
      seen.add(task.id);
      return true;
    });

    // Update count
    partition.count = partition.tasks.length;

    // Recalculate timestamps
    if (partition.tasks.length > 0) {
      const completionDates = partition.tasks
        .map(t => t.doneAt || t.cancelledAt || '')
        .filter(d => d);
      
      partition.oldestCompletion = completionDates.reduce((a, b) => a < b ? a : b);
      partition.newestCompletion = completionDates.reduce((a, b) => a > b ? a : b);
    }

    // Save compacted partition
    await this.savePartition(partition);
  }

  /**
   * Get partition info without loading all tasks
   */
  async getPartitionInfo(partitionKey: string): Promise<Omit<HistoryPartition, 'tasks'> | null> {
    const partition = await this.loadPartition(partitionKey);
    
    if (!partition) {
      return null;
    }

    return {
      month: partition.month,
      count: partition.count,
      oldestCompletion: partition.oldestCompletion,
      newestCompletion: partition.newestCompletion,
      sizeBytes: partition.sizeBytes,
    };
  }

  /**
   * Clear all history (dangerous!)
   */
  async clearHistory(confirm: boolean = false): Promise<number> {
    if (!confirm) {
      throw new Error('Must confirm history deletion');
    }

    const partitions = await this.listPartitions();
    
    for (const key of partitions) {
      localStorage.removeItem(`history-partition-${key}`);
      this.loadedPartitions.delete(key);
    }

    return partitions.length;
  }

  /**
   * Unload partitions from memory (keep on disk)
   */
  unloadPartitions(keepRecent: number = 2): number {
    const partitions = Array.from(this.loadedPartitions.keys()).sort().reverse();
    const toUnload = partitions.slice(keepRecent);
    
    toUnload.forEach(key => {
      this.loadedPartitions.delete(key);
    });

    return toUnload.length;
  }

  /**
   * Get current archive policy
   */
  getArchivePolicy(): ArchivePolicy {
    return { ...this.archivePolicy };
  }

  /**
   * Update archive policy
   */
  setArchivePolicy(policy: Partial<ArchivePolicy>): void {
    this.archivePolicy = { ...this.archivePolicy, ...policy };
  }
}

/**
 * Singleton instance
 */
export const historyStorage = new HistoryStorage();

/**
 * Convenience function to add completed task
 */
export async function archiveCompletedTask(task: Task): Promise<void> {
  return historyStorage.addCompletedTask(task);
}

/**
 * Convenience function to query history
 */
export async function queryTaskHistory(options: HistoryQueryOptions = {}): Promise<Task[]> {
  return historyStorage.queryHistory(options);
}
