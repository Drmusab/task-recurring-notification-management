import type { Task } from "@backend/core/models/Task";
import type { Plugin } from "siyuan";
import {
  BLOCK_ATTR_TASK_ID,
  BLOCK_ATTR_TASK_DUE,
  BLOCK_ATTR_TASK_ENABLED,
  STORAGE_ACTIVE_KEY,
  STORAGE_ARCHIVE_KEY,
  STORAGE_LEGACY_BACKUP_KEY,
  STORAGE_LEGACY_KEY,
} from "@shared/constants/misc-constants";
import { ActiveTaskStore } from "@backend/core/storage/ActiveTaskStore";
import { ArchiveTaskStore, type ArchiveQuery } from "@backend/core/storage/ArchiveTaskStore";
import * as logger from "@backend/logging/logger";
import { TaskPersistenceController } from "@backend/core/storage/TaskPersistenceController";
import {
  SiYuanApiAdapter,
  SiYuanApiExecutionError,
  SiYuanCapabilityError,
  type SiYuanBlockAPI,
  reportSiYuanApiIssue,
} from "@backend/core/api/SiYuanApiAdapter";
import { GlobalFilter } from '@backend/core/filtering/GlobalFilter'; // Add this import
import { TaskIndexManager } from '@backend/core/storage/TaskIndexManager';
import { BatchBlockSync } from '@backend/core/storage/BatchBlockSync';

/**
 * TaskStorage manages task persistence using SiYuan storage API.
 * Active tasks are loaded on startup, while archived tasks are stored in
 * chunked files and loaded on demand to keep startup fast.
 */
export interface TaskStorageProvider {
  /** Load active tasks from storage. */
  loadActive(): Promise<Map<string, Task>>;
  /** Save active tasks to storage. */
  saveActive(tasks: Map<string, Task>): Promise<void>;
  /** Archive a completed task. */
  archiveTask(task: Task): Promise<void>;
  /** Load archived tasks with optional filtering. */
  loadArchive(filter?: ArchiveQuery): Promise<Task[]>;
}

export class TaskStorage implements TaskStorageProvider {
  private plugin: Plugin;
  private activeTasks: Map<string, Task>;
  private indexManager: TaskIndexManager;
  private batchBlockSync: BatchBlockSync;
  private activeStore: ActiveTaskStore;
  private archiveStore: ArchiveTaskStore;
  private persistence: TaskPersistenceController;
  private blockAttrSyncEnabled = true;
  private blockApi: SiYuanBlockAPI;
  private apiAdapter: SiYuanApiAdapter;
  
  // Retry queue for failed block attribute syncs (timeout-based, managed per blockId)
  private blockAttrRetryQueue: Map<string, { attrs: Record<string, string>; attempts: number }> = new Map();
  private blockAttrRetryTimeouts: Map<string, number> = new Map(); // Track setTimeout IDs for cleanup

  constructor(plugin: Plugin, apiAdapter: SiYuanApiAdapter = new SiYuanApiAdapter()) {
    this.plugin = plugin;
    this.activeTasks = new Map();
    this.indexManager = new TaskIndexManager();
    this.apiAdapter = apiAdapter;
    this.blockApi = apiAdapter;
    this.batchBlockSync = new BatchBlockSync(apiAdapter, 500, 100);
    this.activeStore = new ActiveTaskStore(plugin, apiAdapter);
    this.archiveStore = new ArchiveTaskStore(plugin);
    this.persistence = new TaskPersistenceController(this.activeStore);
  }

  /**
   * Initialize storage by loading tasks from disk
   */
  async init(): Promise<void> {
    await this.migrateLegacyStorage();
    const loadedTasks = await this.activeStore.loadActive();
    
    // Apply global filter
    const globalFilter = GlobalFilter.getInstance();
    const filtered = new Map<string, Task>();
    for (const [id, task] of loadedTasks.entries()) {
      if (globalFilter.shouldIncludeTask(task)) {
        filtered.set(id, task);
      }
    }
    
    this.activeTasks = filtered;
    logger.info(`Loaded ${this.activeTasks.size} active tasks from storage (after global filter)`);
    this.indexManager.rebuildIndexes(this.activeTasks);
  }

  /**
   * Load active tasks with batch processing and progress callbacks
   */
  async loadActiveTasks(
    batchSize: number = 1000,
    progressCallback?: (loaded: number, total: number) => void
  ): Promise<Task[]> {
    const taskMap = await this.activeStore.loadActive();
    const allTasks = Array.from(taskMap.values());
    
    // Apply global filter BEFORE indexing
    const globalFilter = GlobalFilter.getInstance();
    const filteredTasks = allTasks.filter(task => globalFilter.shouldIncludeTask(task));
    
    const total = filteredTasks.length;
    
    if (total === 0) {
      return [];
    }

    const result: Task[] = [];

    for (let i = 0; i < total; i += batchSize) {
      const batch = filteredTasks.slice(i, Math.min(i + batchSize, total));
      result.push(...batch);

      if (progressCallback) {
        progressCallback(result.length, total);
      }

      // Yield to UI thread
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return result;
  }

  /**
   * Get tasks due on a specific date
   */
  getTasksDueOn(date: Date): Task[] {
    const taskIds = this.indexManager.queryByDueDate(date);
    return Array.from(taskIds)
      .map(id => this.activeTasks.get(id))
      .filter((task): task is Task => task !== undefined && task.enabled);
  }

  /**
   * Get tasks due on or before a specific date using the index manager.
   */
  getTasksDueOnOrBefore(date: Date): Task[] {
    const startDate = new Date('1970-01-01'); // Start from earliest date
    const taskIds = this.indexManager.queryByDateRange(startDate, date, 'due');
    return Array.from(taskIds)
      .map(id => this.activeTasks.get(id))
      .filter((task): task is Task => task !== undefined && task.enabled);
  }

  /**
   * Save all tasks to disk
   */
  async save(): Promise<void> {
    this.persistence.requestSave({ tasks: Array.from(this.activeTasks.values()) });
  }

  /**
   * Flush any pending task persistence writes.
   */
  async flush(): Promise<void> {
    await this.persistence.flush();
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): Task | undefined {
    return this.activeTasks.get(id);
  }

  /**
   * Get a task by linked block ID
   */
  getTaskByBlockId(blockId: string): Task | undefined {
    const taskId = this.indexManager.getTaskByBlockId(blockId);
    return taskId ? this.activeTasks.get(taskId) : undefined;
  }

  /**
   * Add or update a task
   */
  async saveTask(task: Task): Promise<void> {
    const existingTask = this.activeTasks.get(task.id);
    
    // Optimistic locking check
    if (existingTask && task.version !== undefined && existingTask.version !== undefined) {
      if (task.version < existingTask.version) {
        throw new Error(`Concurrent modification detected for task "${task.name}". Please refresh and try again.`);
      }
    }
    
    // Increment version on save
    task.version = (task.version ?? 0) + 1;
    
    const previousTask = this.activeTasks.get(task.id);
    
    // Update index manager
    if (previousTask) {
      this.indexManager.updateTask(task.id, previousTask, task);
    } else {
      this.indexManager.addTask(task.id, task);
    }

    task.updatedAt = new Date().toISOString();
    this.activeTasks.set(task.id, task);
    await this.save();

    // Sync to block attributes for persistence with retry
    if (task.linkedBlockId) {
      await this.syncTaskToBlockAttrsWithRetry(task);
    }

    if (previousBlockId && previousBlockId !== task.linkedBlockId) {
      await this.clearBlockAttrs(previousBlockId);
    }
  }

  /**
   * Sync task data to block attributes
   * This ensures task information persists even if plugin data is lost
   */
  private async syncTaskToBlockAttrs(task: Task): Promise<void> {
    if (!task.linkedBlockId) {
      return;
    }

    // Use batch sync instead of immediate update
    this.batchBlockSync.queueUpdate(task.linkedBlockId, {
      [BLOCK_ATTR_TASK_ID]: task.id,
      [BLOCK_ATTR_TASK_DUE]: task.dueAt,
      [BLOCK_ATTR_TASK_ENABLED]: task.enabled ? "true" : "false",
    });
  }

  private async clearBlockAttrs(blockId: string): Promise<void> {
    await this.updateBlockAttrs(blockId, {
      [BLOCK_ATTR_TASK_ID]: "",
      [BLOCK_ATTR_TASK_DUE]: "",
      [BLOCK_ATTR_TASK_ENABLED]: "",
    });
  }

  private async updateBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void> {
    if (!this.blockAttrSyncEnabled) {
      return;
    }

    if (!this.apiAdapter.supportedCapabilities.setBlockAttrs) {
      reportSiYuanApiIssue({
        feature: "Block attribute sync",
        capability: "setBlockAttrs",
        message:
          "Block attribute sync unavailable in current SiYuan version. Tasks will continue to function without block sync.",
      });
      this.blockAttrSyncEnabled = false;
      return;
    }

    try {
      await this.blockApi.setBlockAttrs(blockId, attrs);
    } catch (err) {
      if (err instanceof SiYuanCapabilityError) {
        // Permanent capability issue — disable sync for the session
        reportSiYuanApiIssue({
          feature: err.feature,
          capability: err.capability,
          message: err.message,
        });
        this.blockAttrSyncEnabled = false;
      } else if (err instanceof SiYuanApiExecutionError) {
        // Transient error — log but keep sync enabled for future attempts
        reportSiYuanApiIssue({
          feature: err.feature,
          capability: err.capability,
          message: err.message,
          cause: err.cause,
        });
        // Queue for retry instead of permanently disabling
        this.queueBlockAttrRetry(blockId, attrs);
      } else {
        reportSiYuanApiIssue({
          feature: "Block attribute sync",
          capability: "setBlockAttrs",
          message:
            "Unexpected error while syncing block attributes. Block sync disabled to keep tasks stable.",
          cause: err,
        });
        this.blockAttrSyncEnabled = false;
      }
    }
  }

  /**
   * Queue a failed block attr update for retry.
   * Transient failures are retried up to 3 times, then silently dropped.
   */
  private queueBlockAttrRetry(blockId: string, attrs: Record<string, string>): void {
    const existing = this.blockAttrRetryQueue.get(blockId);
    const attempts = (existing?.attempts ?? 0) + 1;
    if (attempts > 3) {
      logger.warn(`Block attr sync for ${blockId} failed after 3 retries, giving up`);
      this.blockAttrRetryQueue.delete(blockId);
      this.blockAttrRetryTimeouts.delete(blockId);
      return;
    }
    this.blockAttrRetryQueue.set(blockId, { attrs, attempts });

    // Clear any previously scheduled retry for this block
    const existingTimeout = this.blockAttrRetryTimeouts.get(blockId);
    if (existingTimeout !== undefined) {
      globalThis.clearTimeout(existingTimeout);
    }

    // Schedule retry and track the timeout ID
    const timeoutId = globalThis.setTimeout(() => {
      this.blockAttrRetryTimeouts.delete(blockId);
      const entry = this.blockAttrRetryQueue.get(blockId);
      if (entry) {
        this.blockAttrRetryQueue.delete(blockId);
        this.updateBlockAttrs(blockId, entry.attrs).catch(() => {
          // Will re-queue itself if still failing
        });
      }
    }, 2000 * attempts) as unknown as number;
    this.blockAttrRetryTimeouts.set(blockId, timeoutId);
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    const task = this.activeTasks.get(id);

    // Remove from index manager
    if (task) {
      this.indexManager.removeTask(id, task);
      
      // Clear block attributes if linked
      if (task.linkedBlockId) {
        await this.clearBlockAttrs(task.linkedBlockId);
      }
    }

    this.activeTasks.delete(id);
    await this.save();
  }

  /**
   * Get enabled tasks
   */
  getEnabledTasks(): Task[] {
    return this.getAllTasks().filter((task) => task.enabled);
  }

  /**
   * Get tasks due today or earlier
   */
  getTodayAndOverdueTasks(): Task[] {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    return this.getEnabledTasks().filter((task) => {
      const dueDate = new Date(task.dueAt);
      return dueDate <= endOfToday;
    });
  }

  /**
   * Get tasks in a date range
   */
  getTasksInRange(startDate: Date, endDate: Date): Task[] {
    return this.getEnabledTasks().filter((task) => {
      const dueDate = new Date(task.dueAt);
      return dueDate >= startDate && dueDate <= endDate;
    });
  }

  /**
   * Clear all tasks (for testing/reset)
   */
  async clearAll(): Promise<void> {
    this.activeTasks.clear();
    await this.save();
  }

  /**
   * Load active tasks from storage (TaskStorageProvider API).
   */
  async loadActive(): Promise<Map<string, Task>> {
    return this.activeStore.loadActive();
  }

  /**
   * Persist active tasks via the TaskPersistenceController.
   */
  async saveActive(tasks: Map<string, Task>): Promise<void> {
    this.persistence.requestSave({ tasks: Array.from(tasks.values()) });
  }

  /**
   * Archive a completed task snapshot.
   */
  async archiveTask(task: Task): Promise<void> {
    await this.archiveStore.archiveTask(task);
  }

  /**
   * Load archived tasks with optional filtering.
   */
  async loadArchive(filter?: ArchiveQuery): Promise<Task[]> {
    return this.archiveStore.loadArchive(filter);
  }

  private async migrateLegacyStorage(): Promise<void> {
    const existingActive = await this.plugin.loadData(STORAGE_ACTIVE_KEY);
    if (existingActive && Array.isArray(existingActive.tasks)) {
      return;
    }

    const legacyData = await this.plugin.loadData(STORAGE_LEGACY_KEY);
    if (!legacyData) {
      return;
    }

    const legacyTasks: Task[] = Array.isArray(legacyData.tasks) ? legacyData.tasks as Task[] : Array.isArray(legacyData) ? legacyData as Task[] : [];
    if (legacyTasks.length === 0) {
      return;
    }

    await this.plugin.saveData(STORAGE_LEGACY_BACKUP_KEY, legacyData);
    logger.info(`Created legacy backup at ${STORAGE_LEGACY_BACKUP_KEY}`);

    const archivedTasks = legacyTasks.filter((task: Task) => !task.enabled && task.lastCompletedAt);
    const activeTasks = legacyTasks.filter((task: Task) => !archivedTasks.includes(task));

    const activeMap = new Map(activeTasks.map((task: Task) => [task.id, task]));
    this.persistence.requestSave({ tasks: Array.from(activeMap.values()) });
    await this.persistence.flush();

    if (archivedTasks.length > 0) {
      await this.archiveStore.archiveTasks(archivedTasks);
    }

    logger.info("Legacy storage migration complete", {
      activeCount: activeTasks.length,
      archivedCount: archivedTasks.length,
      legacyKey: STORAGE_LEGACY_KEY,
      activeKey: STORAGE_ACTIVE_KEY,
      archiveIndexKey: STORAGE_ARCHIVE_KEY,
    });
  }

  /**
   * Sync task data to block attributes with retry support.
   * On transient failure, updateBlockAttrs() internally queues a retry
   * via queueBlockAttrRetry(), so no second retry layer is needed.
   */
  private async syncTaskToBlockAttrsWithRetry(task: Task): Promise<void> {
    try {
      await this.syncTaskToBlockAttrs(task);
    } catch (err) {
      // updateBlockAttrs already handles retries for transient errors.
      // Log the top-level failure for observability.
      logger.warn(`Initial block sync failed for task ${task.id}, retry queued if transient`, {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Stop the retry processor (call on plugin unload)
   */
  stopSyncRetryProcessor(): void {
    // Clear all pending block attr retry timeouts to prevent orphaned callbacks
    for (const timeoutId of this.blockAttrRetryTimeouts.values()) {
      globalThis.clearTimeout(timeoutId);
    }
    this.blockAttrRetryTimeouts.clear();
    this.blockAttrRetryQueue.clear();
  }

  /**
   * Get the task index manager for advanced queries
   */
  getIndexManager(): TaskIndexManager {
    return this.indexManager;
  }

  /**
   * Get index statistics for monitoring
   */
  getIndexStats() {
    return this.indexManager.getStats();
  }

  /**
   * Get batch sync statistics
   */
  getBatchSyncStats() {
    return this.batchBlockSync.getStats();
  }

  /**
   * Force flush pending batch updates
   */
  async flushBatchUpdates(): Promise<number> {
    return await this.batchBlockSync.flush();
  }

  /**
   * Cleanup and flush on shutdown
   */
  async destroy(): Promise<void> {
    await this.batchBlockSync.destroy();
    this.stopSyncRetryProcessor();
  }
}
