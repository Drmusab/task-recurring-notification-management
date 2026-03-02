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
import {
  SiYuanApiAdapter,
  SiYuanApiExecutionError,
  SiYuanCapabilityError,
  type SiYuanBlockAPI,
  reportSiYuanApiIssue,
} from "@backend/core/api/SiYuanApiAdapter";
import { GlobalFilter } from '@backend/core/filtering/GlobalFilter';
import { TaskIndexManager } from '@backend/core/storage/TaskIndexManager';
import { BatchBlockSync } from '@backend/core/storage/BatchBlockSync';
import { BlockMetadataService } from '@backend/core/api/BlockMetadataService';
import { JsonToBlockMigration } from '@backend/core/storage/JsonToBlockMigration';

// ================== Phase 3: Storage Layer Consolidation ==================
// Moved from TaskPersistenceController.ts and TaskRepository.ts

/**
 * Task state snapshot for transaction rollback
 * 
 * FIX [CRITICAL-005]: Transaction pattern to prevent partial saves
 */
interface TaskSnapshot {
  task: Task;
  existed: boolean;
  previousTask?: Task;
  version: number;
}

/**
 * Task state snapshot for persistence
 */
export interface TaskState {
  tasks: Task[];
}

/**
 * Writer interface for task state persistence
 */
export interface TaskStateWriter {
  write(state: TaskState): Promise<void>;
}

/**
 * TaskRepositoryProvider interface (moved from TaskRepository.ts)
 * Defines the contract for task storage operations
 */
export interface TaskRepositoryProvider {
  /** Return all tasks. */
  getAllTasks(): Task[];
  /** Get a task by ID. */
  getTask(id: string): Task | undefined;
  /** Get a task by linked block ID. */
  getTaskByBlockId(blockId: string): Task | undefined;
  /** Return enabled tasks only. */
  getEnabledTasks(): Task[];
  /** Return tasks due on or before a date. */
  getTasksDueOnOrBefore(date: Date): Task[];
  /** Return tasks due today or overdue. */
  getTodayAndOverdueTasks(): Task[];
  /** Return tasks within a date range. */
  getTasksInRange(startDate: Date, endDate: Date): Task[];
  /** Persist a task. */
  saveTask(task: Task): Promise<void>;
  /** Remove a task by ID. */
  deleteTask(taskId: string): Promise<void>;
  /** Archive a task snapshot. */
  archiveTask(task: Task): Promise<void>;
  /** Load archived tasks. */
  loadArchive(filter?: ArchiveQuery): Promise<Task[]>;
  /** Flush pending writes. */
  flush(): Promise<void>;
}

/**
 * TaskStorage manages task persistence using SiYuan storage API.
 * Active tasks are loaded on startup, while archived tasks are stored in
 * chunked files and loaded on demand to keep startup fast.
 */
export interface TaskStorageProvider {
  /** Load active tasks from storage. */
  loadActive(signal?: AbortSignal): Promise<Map<string, Task>>;
  /** Save active tasks to storage. */
  saveActive(tasks: Map<string, Task>): Promise<void>;
  /** Archive a completed task. */
  archiveTask(task: Task): Promise<void>;
  /** Load archived tasks with optional filtering. */
  loadArchive(filter?: ArchiveQuery): Promise<Task[]>;
}

/**
 * Inlined TaskPersistenceController (Phase 3 consolidation)
 * Serializes disk writes and guarantees latest-state persistence.
 */
class InlinedPersistenceController {
  private pendingState: TaskState | null = null;
  private writeInProgress = false;
  private scheduledTimer: ReturnType<typeof setTimeout> | null = null;
  private flushResolvers: Array<() => void> = [];

  constructor(
    private writer: TaskStateWriter,
    private debounceMs = 50
  ) {}

  requestSave(state: TaskState): void {
    this.pendingState = state;

    if (this.writeInProgress || this.scheduledTimer) {
      return;
    }

    this.scheduledTimer = setTimeout(() => {
      this.scheduledTimer = null;
      void this.drainQueue();
    }, this.debounceMs);
  }

  async flush(): Promise<void> {
    if (!this.pendingState && !this.writeInProgress && !this.scheduledTimer) {
      return;
    }

    return new Promise((resolve) => {
      this.flushResolvers.push(resolve);
      if (!this.writeInProgress && !this.scheduledTimer && this.pendingState) {
        void this.drainQueue();
      }
    });
  }

  private async drainQueue(): Promise<void> {
    if (this.writeInProgress) {
      return;
    }

    this.writeInProgress = true;

    try {
      while (this.pendingState) {
        const stateToWrite = this.pendingState;
        this.pendingState = null;

        const success = await this.writeWithRetry(stateToWrite);
        if (!success) {
          this.pendingState = stateToWrite;
          break;
        }
      }
    } finally {
      this.writeInProgress = false;

      if (!this.pendingState) {
        this.resolveFlushes();
      }

      if (this.pendingState && !this.scheduledTimer) {
        this.scheduledTimer = setTimeout(() => {
          this.scheduledTimer = null;
          void this.drainQueue();
        }, this.debounceMs);
      }
    }
  }

  private async writeWithRetry(state: TaskState): Promise<boolean> {
    try {
      await this.writer.write(state);
      return true;
    } catch (err) {
      logger.error("Task persistence write failed, retrying once", err);
    }

    try {
      await this.writer.write(state);
      return true;
    } catch (err) {
      logger.error("Task persistence write failed after retry", err);
      return false;
    }
  }

  private resolveFlushes(): void {
    if (this.flushResolvers.length === 0) {
      return;
    }
    const resolvers = [...this.flushResolvers];
    this.flushResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }

  /**
   * Cancel any pending timers. Must be called on plugin unload
   * to prevent orphaned callbacks.
   */
  destroy(): void {
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    this.pendingState = null;
    this.resolveFlushes();
  }
}

export class TaskStorage implements TaskStorageProvider, TaskRepositoryProvider {
  private plugin: Plugin;
  private activeTasks: Map<string, Task>;
  private indexManager: TaskIndexManager;
  private batchBlockSync: BatchBlockSync;
  private activeStore: ActiveTaskStore;
  private archiveStore: ArchiveTaskStore;
  private persistence: InlinedPersistenceController;
  private blockAttrSyncEnabled = true;
  private blockApi: SiYuanBlockAPI;
  private apiAdapter: SiYuanApiAdapter;
  private blockMetadata: BlockMetadataService;
  private migration: JsonToBlockMigration;
  
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
    this.persistence = new InlinedPersistenceController(this.activeStore);
    this.blockMetadata = new BlockMetadataService();
    this.migration = new JsonToBlockMigration(plugin, this.blockMetadata);
  }

  /**
   * Initialize storage — hybrid block-first loading with JSON fallback
   * 
   * Phase 6 Strategy:
   * 1. Run legacy JSON migration (v0 format → active/archive split)
   * 2. Check if JSON→block migration has been done
   *    - If NOT migrated: load from JSON, write to blocks, mark done
   *    - If migrated: load from blocks (primary), fall back to JSON if blocks empty
   * 3. Apply global filter and rebuild indexes
   */
  async init(): Promise<void> {
    await this.migrateLegacyStorage();

    const isMigrated = await this.migration.isMigrated();

    if (!isMigrated) {
      // First run after upgrade: load from JSON, migrate to blocks
      const jsonTasks = await this.activeStore.loadActive();
      logger.info(`[Storage] Pre-migration: loaded ${jsonTasks.size} tasks from JSON`);

      if (jsonTasks.size > 0) {
        const result = await this.migration.migrate(jsonTasks);
        logger.info("[Storage] Migration complete", result);
      } else {
        // No JSON tasks — mark migrated anyway
        await this.migration.migrate(new Map());
      }

      this.activeTasks = this.applyGlobalFilter(jsonTasks);
    } else {
      // Post-migration: try loading from block attributes first
      let blockTasks: Map<string, Task>;
      try {
        blockTasks = await this.blockMetadata.loadAllTasks();
      } catch (err) {
        logger.warn("[Storage] Block attribute loading failed, falling back to JSON", err);
        blockTasks = new Map();
      }

      if (blockTasks.size > 0) {
        logger.info(`[Storage] Loaded ${blockTasks.size} tasks from block attributes (primary)`);
        this.activeTasks = this.applyGlobalFilter(blockTasks);
      } else {
        // Fallback: blocks returned nothing (maybe blocks were deleted, or fresh install)
        logger.info("[Storage] No tasks in block attributes, falling back to JSON");
        const jsonTasks = await this.activeStore.loadActive();
        this.activeTasks = this.applyGlobalFilter(jsonTasks);
      }
    }

    logger.info(`[Storage] Initialized with ${this.activeTasks.size} active tasks`);
    this.indexManager.rebuildIndexes(this.activeTasks);
  }

  /**
   * Apply global filter to a task map
   */
  private applyGlobalFilter(tasks: Map<string, Task>): Map<string, Task> {
    const globalFilter = GlobalFilter.getInstance();
    const filtered = new Map<string, Task>();
    for (const [id, task] of tasks.entries()) {
      if (globalFilter.shouldIncludeTask(task)) {
        filtered.set(id, task);
      }
    }
    return filtered;
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
   * Optimized: queries only from the earliest stored due date rather than epoch.
   */
  getTasksDueOnOrBefore(date: Date): Task[] {
    const taskIds = this.indexManager.queryByDateRange(
      this.indexManager.getEarliestDueDate() ?? date,
      date,
      'due'
    );
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
   * Get all tasks.
   * Returns shallow-frozen copies to enforce immutability outside storage.
   */
  getAllTasks(): Task[] {
    return Array.from(this.activeTasks.values()).map(t => Object.freeze({ ...t }));
  }

  /**
   * Get a task by ID.
   * Returns a shallow-frozen copy to prevent external mutation.
   */
  getTask(id: string): Task | undefined {
    const task = this.activeTasks.get(id);
    return task ? Object.freeze({ ...task }) : undefined;
  }

  /**
   * Get a task by linked block ID.
   * Returns a shallow-frozen copy to prevent external mutation.
   */
  getTaskByBlockId(blockId: string): Task | undefined {
    const taskId = this.indexManager.getTaskByBlockId(blockId);
    const task = taskId ? this.activeTasks.get(taskId) : undefined;
    return task ? Object.freeze({ ...task }) : undefined;
  }

  /**
   * Add or update a task
   * 
   * FIX [CRITICAL-005]: Transaction pattern with rollback to prevent data inconsistency
   */
  async saveTask(task: Task): Promise<void> {
    const existingTask = this.activeTasks.get(task.id);
    
    // Optimistic locking check
    if (existingTask && task.version !== undefined && existingTask.version !== undefined) {
      if (task.version < existingTask.version) {
        throw new Error(`Concurrent modification detected for task "${task.name}". Please refresh and try again.`);
      }
    }
    
    // Increment version on save — work on a mutable copy to avoid mutating caller's frozen object
    const mutable: { -readonly [K in keyof Task]: Task[K] } = { ...task, version: (task.version ?? 0) + 1 };
    
    const previousTask = this.activeTasks.get(mutable.id);
    const previousBlockId = previousTask?.linkedBlockId;
    
    // ✅ FIX: Create snapshot for transaction rollback
    const snapshot: TaskSnapshot = {
      task: { ...mutable },
      existed: this.activeTasks.has(mutable.id),
      previousTask: previousTask ? { ...previousTask } : undefined,
      version: mutable.version
    };

    try {
      // Phase 1: Update index manager
      if (previousTask) {
        this.indexManager.updateTask(mutable.id, previousTask, mutable);
      } else {
        this.indexManager.addTask(mutable.id, mutable);
      }

      // Phase 2: Update in-memory state
      mutable.updatedAt = new Date().toISOString();
      this.activeTasks.set(mutable.id, mutable);
      
      // Phase 3: Persist to disk
      await this.save();

      // Phase 4: Sync to block attributes for persistence with retry
      if (mutable.linkedBlockId) {
        await this.syncTaskToBlockAttrsWithRetry(mutable);
      }

      // Phase 5: Clean up old block attributes if block changed
      if (previousBlockId && previousBlockId !== mutable.linkedBlockId) {
        await this.clearBlockAttrs(previousBlockId);
      }

      logger.info(`Task saved successfully: ${mutable.name}`, { taskId: mutable.id });

    } catch (error) {
      // ✅ FIX: Rollback on any error to maintain consistency
      logger.error(
        `Failed to save task "${task.name}", rolling back changes`,
        { error: error as Error, taskId: task.id }
      );

      await this.rollbackTaskSave(snapshot);
      throw error; // Re-throw so caller knows save failed
    }
  }

  /**
   * Rollback task save operation
   * 
   * FIX [CRITICAL-005]: Restore previous state on save failure
   */
  private async rollbackTaskSave(snapshot: TaskSnapshot): Promise<void> {
    try {
      if (snapshot.existed && snapshot.previousTask) {
        // Restore previous version
        this.activeTasks.set(snapshot.previousTask.id, snapshot.previousTask);
        
        // Restore index
        this.indexManager.updateTask(snapshot.task.id, snapshot.task, snapshot.previousTask);
      } else {
        // Remove the new task that failed to save
        this.activeTasks.delete(snapshot.task.id);
        this.indexManager.removeTask(snapshot.task.id, snapshot.task);
      }

      logger.info('Task save rolled back successfully', { taskId: snapshot.task.id });
    } catch (rollbackError) {
      logger.error(
        'CRITICAL: Rollback failed - data may be inconsistent',
        { error: rollbackError as Error, taskId: snapshot.task.id }
      );
      // Note: We cannot recover from rollback failure
      // This should trigger manual intervention
    }
  }

  /**
   * Sync task data to block attributes (Phase 6: full attribute set via BlockMetadataService)
   * This is now the PRIMARY persistence path for tasks with linked blocks.
   * JSON file persistence is kept as a backup.
   */
  private async syncTaskToBlockAttrs(task: Task): Promise<void> {
    if (!task.linkedBlockId) {
      return;
    }

    // Use BlockMetadataService for full attribute sync (11 fields + JSON blob)
    try {
      await this.blockMetadata.setTaskAttributes(task.linkedBlockId, task);
    } catch (err) {
      // Fall back to batch sync with minimal attributes
      logger.warn("[Storage] BlockMetadataService sync failed, queuing minimal batch sync", {
        taskId: task.id,
        blockId: task.linkedBlockId,
      });
      this.batchBlockSync.queueUpdate(task.linkedBlockId, {
        [BLOCK_ATTR_TASK_ID]: task.id,
        [BLOCK_ATTR_TASK_DUE]: task.dueAt,
        [BLOCK_ATTR_TASK_ENABLED]: task.enabled ? "true" : "false",
      });
    }
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
   * Get enabled tasks (single-pass, no double allocation)
   */
  getEnabledTasks(): Task[] {
    const result: Task[] = [];
    for (const task of this.activeTasks.values()) {
      if (task.enabled) {
        result.push(task);
      }
    }
    return result;
  }

  /**
   * Get tasks due today or earlier (single-pass over the map)
   */
  getTodayAndOverdueTasks(): Task[] {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const endMs = endOfToday.getTime();

    const result: Task[] = [];
    for (const task of this.activeTasks.values()) {
      if (task.enabled && task.dueAt) {
        const dueMs = new Date(task.dueAt).getTime();
        if (dueMs <= endMs) {
          result.push(task);
        }
      }
    }
    return result;
  }

  /**
   * Get tasks in a date range (single-pass over the map)
   */
  getTasksInRange(startDate: Date, endDate: Date): Task[] {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    const result: Task[] = [];
    for (const task of this.activeTasks.values()) {
      if (task.enabled && task.dueAt) {
        const dueMs = new Date(task.dueAt).getTime();
        if (dueMs >= startMs && dueMs <= endMs) {
          result.push(task);
        }
      }
    }
    return result;
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
   * @param signal - Optional AbortSignal for cancellation support
   */
  async loadActive(signal?: AbortSignal): Promise<Map<string, Task>> {
    return this.activeStore.loadActive(signal);
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
   * Cleanup and flush on shutdown.
   * Cancels all timers to prevent memory leaks.
   */
  async destroy(): Promise<void> {
    this.persistence.destroy();
    await this.batchBlockSync.destroy();
    this.stopSyncRetryProcessor();
  }
}
