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
  MAX_SYNC_RETRIES,
  RETRY_DELAYS,
  SYNC_RETRY_PROCESSOR_INTERVAL,
} from "@shared/utils/misc/constants";
import { ActiveTaskStore } from "@backend/core/storage/ActiveTaskStore";
import { ArchiveTaskStore, type ArchiveQuery } from "@backend/core/storage/ArchiveTaskStore";
import * as logger from "@shared/utils/misc/logger";
import { TaskPersistenceController } from "@backend/core/storage/TaskPersistenceController";
import {
  SiYuanApiAdapter,
  SiYuanApiExecutionError,
  SiYuanCapabilityError,
  type SiYuanBlockAPI,
  reportSiYuanApiIssue,
} from "@backend/core/api/SiYuanApiAdapter";
import { GlobalFilter } from '@backend/core/filtering/GlobalFilter'; // Add this import

/**
 * Retry queue entry for failed block attribute syncs
 */
interface SyncRetryEntry {
  task: Task;
  attempts: number;
  nextRetry: number;
}

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
  private blockIndex: Map<string, string> = new Map(); // blockId -> taskId
  private taskBlockIndex: Map<string, string> = new Map(); // taskId -> blockId
  private dueIndex: Map<string, Set<string>> = new Map(); // dateKey (YYYY-MM-DD) -> taskIds
  private activeStore: ActiveTaskStore;
  private archiveStore: ArchiveTaskStore;
  private persistence: TaskPersistenceController;
  private blockAttrSyncEnabled = true;
  private blockApi: SiYuanBlockAPI;
  private apiAdapter: SiYuanApiAdapter;
  
  // Retry queue for failed block attribute syncs
  private syncRetryQueue: Map<string, SyncRetryEntry> = new Map();
  private retryProcessorInterval?: NodeJS.Timeout;

  constructor(plugin: Plugin, apiAdapter: SiYuanApiAdapter = new SiYuanApiAdapter()) {
    this.plugin = plugin;
    this.activeTasks = new Map();
    this.apiAdapter = apiAdapter;
    this.blockApi = apiAdapter;
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
    this.rebuildBlockIndex();
    this.rebuildDueIndex();
    this.startSyncRetryProcessor();
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
   * Rebuild the block index from existing tasks
   */
  private rebuildBlockIndex(): void {
    this.blockIndex.clear();
    this.taskBlockIndex.clear();
    for (const task of this.activeTasks.values()) {
      if (task.linkedBlockId) {
        this.blockIndex.set(task.linkedBlockId, task.id);
        this.taskBlockIndex.set(task.id, task.linkedBlockId);
      }
    }
    logger.info(`Rebuilt block index with ${this.blockIndex.size} entries`);
  }

  /**
   * Rebuild the due date index from existing tasks
   */
  private rebuildDueIndex(): void {
    this.dueIndex.clear();
    for (const task of this.activeTasks.values()) {
      if (task.enabled) {
        this.addToDueIndex(task);
      }
    }
    logger.info(`Rebuilt due index with ${this.dueIndex.size} date entries`);
  }

  /**
   * Add a task to the due date index
   */
  private addToDueIndex(task: Task): void {
    const dateKey = task.dueAt.slice(0, 10); // YYYY-MM-DD
    if (!this.dueIndex.has(dateKey)) {
      this.dueIndex.set(dateKey, new Set());
    }
    this.dueIndex.get(dateKey)!.add(task.id);
  }

  /**
   * Remove a task from the due date index
   */
  private removeFromDueIndex(task: Task): void {
    const dateKey = task.dueAt.slice(0, 10);
    const ids = this.dueIndex.get(dateKey);
    if (ids) {
      ids.delete(task.id);
      if (ids.size === 0) {
        this.dueIndex.delete(dateKey);
      }
    }
  }

  /**
   * Get tasks due on a specific date
   */
  getTasksDueOn(date: Date): Task[] {
    const dateKey = date.toISOString().slice(0, 10);
    return this.getTasksForDueKey(dateKey);
  }

  /**
   * Get tasks due on or before a specific date using the due index.
   * Uses lexicographic date keys (YYYY-MM-DD) for fast comparisons.
   */
  getTasksDueOnOrBefore(date: Date): Task[] {
    const dateKey = date.toISOString().slice(0, 10);
    const results: Task[] = [];

    for (const [key] of this.dueIndex) {
      if (key <= dateKey) {
        results.push(...this.getTasksForDueKey(key));
      }
    }

    return results;
  }

  private getTasksForDueKey(dateKey: string): Task[] {
    const ids = this.dueIndex.get(dateKey);
    if (!ids) {
      return [];
    }

    const tasks: Task[] = [];
    for (const id of ids) {
      const task = this.activeTasks.get(id);
      if (!task) {
        this.removeStaleDueIndexEntry(dateKey, id, "missing task");
        continue;
      }

      if (!task.enabled) {
        this.removeStaleDueIndexEntry(dateKey, id, "task disabled");
        continue;
      }

      if (task.dueAt.slice(0, 10) !== dateKey) {
        this.removeStaleDueIndexEntry(dateKey, id, "date mismatch");
        continue;
      }

      tasks.push(task);
    }

    return tasks;
  }

  private removeStaleDueIndexEntry(dateKey: string, taskId: string, reason: string): void {
    const ids = this.dueIndex.get(dateKey);
    if (!ids) {
      return;
    }

    ids.delete(taskId);
    if (ids.size === 0) {
      this.dueIndex.delete(dateKey);
    }

    logger.warn("Removed stale due index entry", { taskId, dateKey, reason });
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
    const taskId = this.blockIndex.get(blockId);
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
    const previousBlockId = this.taskBlockIndex.get(task.id);
    if (previousBlockId && previousBlockId !== task.linkedBlockId) {
      this.blockIndex.delete(previousBlockId);
      this.taskBlockIndex.delete(task.id);
    }

    // Remove from old due date index if the date changed or task is disabled
    if (previousTask && previousTask.enabled) {
      if (previousTask.dueAt !== task.dueAt || !task.enabled) {
        this.removeFromDueIndex(previousTask);
      }
    }

    // Add new block index entry if task has linkedBlockId
    if (task.linkedBlockId) {
      this.blockIndex.set(task.linkedBlockId, task.id);
      this.taskBlockIndex.set(task.id, task.linkedBlockId);
    }

    // Update due date index
    if (task.enabled) {
      this.addToDueIndex(task);
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

    await this.updateBlockAttrs(task.linkedBlockId, {
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
      if (err instanceof SiYuanCapabilityError || err instanceof SiYuanApiExecutionError) {
        reportSiYuanApiIssue({
          feature: err.feature,
          capability: err.capability,
          message: err.message,
          cause: err.cause,
        });
      } else {
        reportSiYuanApiIssue({
          feature: "Block attribute sync",
          capability: "setBlockAttrs",
          message:
            "Unexpected error while syncing block attributes. Block sync disabled to keep tasks stable.",
          cause: err,
        });
      }
      this.blockAttrSyncEnabled = false;
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    const task = this.activeTasks.get(id);

    // Remove from block index if task has linkedBlockId
    if (task?.linkedBlockId) {
      this.blockIndex.delete(task.linkedBlockId);
      await this.clearBlockAttrs(task.linkedBlockId);
    }
    this.taskBlockIndex.delete(id);

    // Remove from due date index
    if (task) {
      this.removeFromDueIndex(task);
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

    const legacyTasks = Array.isArray(legacyData.tasks) ? legacyData.tasks : Array.isArray(legacyData) ? legacyData : [];
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
   * Sync task data to block attributes with retry support
   */
  private async syncTaskToBlockAttrsWithRetry(task: Task): Promise<void> {
    try {
      await this.syncTaskToBlockAttrs(task);
      
      // If successful, remove from retry queue if it was there
      this.syncRetryQueue.delete(task.id);
    } catch (err) {
      // Add to retry queue
      const retryEntry = this.syncRetryQueue.get(task.id) || {
        task,
        attempts: 0,
        nextRetry: Date.now(),
      };
      
      if (retryEntry.attempts < MAX_SYNC_RETRIES) {
        retryEntry.attempts++;
        retryEntry.nextRetry = Date.now() + RETRY_DELAYS[retryEntry.attempts - 1];
        retryEntry.task = task; // Update with latest task data
        this.syncRetryQueue.set(task.id, retryEntry);
        
        logger.warn(`Block sync failed for task ${task.id}, added to retry queue`, {
          taskId: task.id,
          attempts: retryEntry.attempts,
          nextRetry: new Date(retryEntry.nextRetry).toISOString(),
          error: err instanceof Error ? err.message : String(err),
        });
      } else {
        // Max retries exceeded
        logger.error(`Block sync failed for task ${task.id} after ${MAX_SYNC_RETRIES} attempts`, {
          taskId: task.id,
          error: err instanceof Error ? err.message : String(err),
        });
        this.syncRetryQueue.delete(task.id);
      }
    }
  }

  /**
   * Start background processor for retry queue
   */
  private startSyncRetryProcessor(): void {
    if (this.retryProcessorInterval) {
      clearInterval(this.retryProcessorInterval);
    }
    
    this.retryProcessorInterval = setInterval(async () => {
      const now = Date.now();
      const toRetry: Array<{ id: string; entry: { task: Task; attempts: number; nextRetry: number } }> = [];
      
      // Collect entries ready for retry
      for (const [id, entry] of this.syncRetryQueue.entries()) {
        if (entry.nextRetry <= now) {
          toRetry.push({ id, entry });
        }
      }
      
      // Process retries
      for (const { id, entry } of toRetry) {
        try {
          await this.syncTaskToBlockAttrs(entry.task);
          
          // Success - remove from queue
          this.syncRetryQueue.delete(id);
          logger.info(`Block sync retry succeeded for task ${id}`, {
            taskId: id,
            attempts: entry.attempts,
          });
        } catch (err) {
          // Failed again - update retry info
          if (entry.attempts < MAX_SYNC_RETRIES) {
            entry.attempts++;
            entry.nextRetry = Date.now() + RETRY_DELAYS[entry.attempts - 1];
            this.syncRetryQueue.set(id, entry);
            
            logger.warn(`Block sync retry failed for task ${id}`, {
              taskId: id,
              attempts: entry.attempts,
              nextRetry: new Date(entry.nextRetry).toISOString(),
              error: err instanceof Error ? err.message : String(err),
            });
          } else {
            // Max retries exceeded
            logger.error(`Block sync retry exhausted for task ${id} after ${MAX_SYNC_RETRIES} attempts`, {
              taskId: id,
              error: err instanceof Error ? err.message : String(err),
            });
            this.syncRetryQueue.delete(id);
          }
        }
      }
    }, SYNC_RETRY_PROCESSOR_INTERVAL);
  }

  /**
   * Stop the retry processor (call on plugin unload)
   */
  stopSyncRetryProcessor(): void {
    if (this.retryProcessorInterval) {
      clearInterval(this.retryProcessorInterval);
      this.retryProcessorInterval = undefined;
    }
  }
}
