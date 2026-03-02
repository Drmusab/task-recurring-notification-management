/**
 * ReactiveTaskManager — Block-mutation-driven task lifecycle manager
 *
 * Replaces the deleted singleton TaskManager with a reactive system
 * that responds to SiYuan block events via SiYuanRuntimeBridge.
 *
 * Event Flow:
 *   User toggles checkbox
 *       ↓
 *   SiYuanRuntimeBridge.subscribeCheckboxToggle()
 *       ↓
 *   ReactiveTaskManager.onCheckboxToggle()
 *       ↓
 *   OnCompletion → Scheduler → NotificationState
 *       ↓
 *   updateBlockAttrs() → Task.store updated
 *
 * Lifecycle:
 *   - Constructed: onload() after all services initialized
 *   - Wire: onLayoutReady() after runtime bridge starts
 *   - Destroy: onunload()
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskStorage } from "@backend/core/storage/TaskStorage";
import type { Scheduler } from "@backend/core/engine/Scheduler";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type {
  SiYuanRuntimeBridge,
  BlockMutation,
  CheckboxToggleEvent,
  RuntimeEvent,
} from "@backend/runtime/SiYuanRuntimeBridge";
import type { BlockMetadataService } from "@backend/core/api/BlockMetadataService";
import { BLOCK_ATTR_TASK_STATUS, BLOCK_ATTR_TASK_COMPLETED_AT } from "@shared/constants/misc-constants";
import * as logger from "@backend/logging/logger";

export interface ReactiveTaskManagerDeps {
  storage: TaskStorage;
  scheduler: Scheduler;
  pluginEventBus: PluginEventBus;
  runtimeBridge: SiYuanRuntimeBridge;
  blockMetadataService: BlockMetadataService;
}

/**
 * Lifecycle precondition flags.
 * All must be true before wire() will accept activation.
 *
 * Order:
 *   1. plugin.onload()           → storageLoaded = false (plugin is alive)
 *   2. TaskStorage.load()        → storageLoaded = true
 *   3. Cache.rebuild()           → cacheRebuilt = true
 *   4. DependencyGraph.validate()→ dependenciesValidated = true
 *   5. wire()                    → subscriptions active
 */
export interface LifecyclePreconditions {
  storageLoaded: boolean;
  cacheRebuilt: boolean;
  dependenciesValidated: boolean;
}

export class ReactiveTaskManager {
  private storage: TaskStorage;
  private scheduler: Scheduler;
  private pluginEventBus: PluginEventBus;
  private runtimeBridge: SiYuanRuntimeBridge;
  private blockMetadataService: BlockMetadataService;
  private cleanups: (() => void)[] = [];
  private active = false;

  /** Lifecycle gate — all preconditions must be met before wire() */
  private preconditions: LifecyclePreconditions = {
    storageLoaded: false,
    cacheRebuilt: false,
    dependenciesValidated: false,
  };

  constructor(deps: ReactiveTaskManagerDeps) {
    this.storage = deps.storage;
    this.scheduler = deps.scheduler;
    this.pluginEventBus = deps.pluginEventBus;
    this.runtimeBridge = deps.runtimeBridge;
    this.blockMetadataService = deps.blockMetadataService;
  }

  // ═══════════════════════════════════════════════════════════
  // LIFECYCLE PRECONDITIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Mark a lifecycle precondition as satisfied.
   * Call these in the correct order from the plugin boot sequence.
   */
  markStorageLoaded(): void {
    this.preconditions.storageLoaded = true;
    logger.info("[ReactiveTaskManager] Precondition met: storageLoaded");
  }

  markCacheRebuilt(): void {
    this.preconditions.cacheRebuilt = true;
    logger.info("[ReactiveTaskManager] Precondition met: cacheRebuilt");
  }

  markDependenciesValidated(): void {
    this.preconditions.dependenciesValidated = true;
    logger.info("[ReactiveTaskManager] Precondition met: dependenciesValidated");
  }

  /** Check if all preconditions are met */
  private allPreconditionsMet(): boolean {
    return (
      this.preconditions.storageLoaded &&
      this.preconditions.cacheRebuilt &&
      this.preconditions.dependenciesValidated
    );
  }

  // ═══════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  /**
   * Wire all block mutation subscriptions.
   * Call in onLayoutReady() after runtimeBridge.start().
   *
   * Preconditions (enforced):
   *   - TaskStorage.load() completed  → markStorageLoaded()
   *   - Cache.rebuild() completed     → markCacheRebuilt()
   *   - DependencyGraph.validate()    → markDependenciesValidated()
   */
  wire(): void {
    if (this.active) return;

    // ── Lifecycle gate: all preconditions must be met ──
    if (!this.allPreconditionsMet()) {
      const missing: string[] = [];
      if (!this.preconditions.storageLoaded) missing.push("storageLoaded");
      if (!this.preconditions.cacheRebuilt) missing.push("cacheRebuilt");
      if (!this.preconditions.dependenciesValidated) missing.push("dependenciesValidated");
      logger.error(
        "[ReactiveTaskManager] wire() blocked — preconditions not met",
        { missing }
      );
      throw new Error(
        `[ReactiveTaskManager] Cannot wire before preconditions: ${missing.join(", ")}`
      );
    }

    this.active = true;

    // 1. Block update → onBlockUpdated
    this.cleanups.push(
      this.runtimeBridge.subscribeBlockUpdate((mutation) => {
        if (mutation.action === "insert") {
          this.onBlockCreated(mutation).catch((err) =>
            logger.error("[ReactiveTaskManager] onBlockCreated error", err)
          );
        } else {
          this.onBlockUpdated(mutation).catch((err) =>
            logger.error("[ReactiveTaskManager] onBlockUpdated error", err)
          );
        }
      })
    );

    // 2. Block delete → onBlockDeleted
    this.cleanups.push(
      this.runtimeBridge.subscribeBlockDelete((mutation) => {
        this.onBlockDeleted(mutation).catch((err) =>
          logger.error("[ReactiveTaskManager] onBlockDeleted error", err)
        );
      })
    );

    // 3. Checkbox toggle → onCheckboxToggle
    this.cleanups.push(
      this.runtimeBridge.subscribeCheckboxToggle((evt) => {
        this.onCheckboxToggle(evt).catch((err) =>
          logger.error("[ReactiveTaskManager] onCheckboxToggle error", err)
        );
      })
    );

    // 4. Plugin event bus: task:complete → markDone
    this.cleanups.push(
      this.pluginEventBus.on("task:complete", ({ taskId }) => {
        this.completeTask(taskId).catch((err) =>
          logger.error("[ReactiveTaskManager] completeTask error", err)
        );
      })
    );

    logger.info("[ReactiveTaskManager] Wired to block mutations");
  }

  /**
   * Destroy all subscriptions.
   * Call in onunload().
   */
  destroy(): void {
    this.active = false;
    for (const cleanup of this.cleanups) {
      try { cleanup(); } catch { /* ignore */ }
    }
    this.cleanups.length = 0;
    logger.info("[ReactiveTaskManager] Destroyed");
  }

  // ═══════════════════════════════════════════════════════════
  // BLOCK MUTATION HANDLERS
  // ═══════════════════════════════════════════════════════════

  /**
   * Handle a new block being created.
   * Checks if content looks like a task (checkbox pattern) and
   * notifies the system.
   */
  async onBlockCreated(mutation: BlockMutation): Promise<void> {
    if (!this.active) return;

    const blockId = mutation.blockId;
    const content = mutation.data || "";

    // Check if this looks like a task block (has checkbox markers)
    if (!this.isTaskContent(content)) return;

    logger.info("[ReactiveTaskManager] Task-like block created", { blockId });

    // Notify that a potential task block was created
    this.pluginEventBus.emit("task:create", {
      source: "block-mutation",
      linkedBlockId: blockId,
      linkedBlockContent: this.stripHtml(content),
    });
  }

  /**
   * Handle a block being updated.
   * Updates the linked task's metadata and triggers recalculation.
   */
  async onBlockUpdated(mutation: BlockMutation): Promise<void> {
    if (!this.active) return;

    const blockId = mutation.blockId;

    // Find tasks linked to this block
    const linkedTask = this.findTaskByBlockId(blockId);
    if (!linkedTask) return;

    // Immutable update — create a new copy with updated fields
    const updatedTask: Task = {
      ...linkedTask,
      lastMutationTime: mutation.timestamp,
      updatedAt: new Date().toISOString(),
      ...(mutation.data ? { linkedBlockContent: this.stripHtml(mutation.data) } : {}),
    };

    // Persist
    await this.storage.saveTask(updatedTask);

    // Sync block attributes
    await this.blockMetadataService.syncTaskToBlock(updatedTask);

    // Notify — single event, cache subscribes to task:updated
    this.pluginEventBus.emit("task:updated", { taskId: updatedTask.id });

    logger.info("[ReactiveTaskManager] Task updated from block mutation", {
      taskId: linkedTask.id,
      blockId,
    });
  }

  /**
   * Handle a block being deleted.
   * Disables the linked task (does not delete — safe default).
   */
  async onBlockDeleted(mutation: BlockMutation): Promise<void> {
    if (!this.active) return;

    const blockId = mutation.blockId;
    const linkedTask = this.findTaskByBlockId(blockId);
    if (!linkedTask) return;

    // Immutable update — disable task when block is deleted
    const now = new Date().toISOString();
    const updatedTask: Task = {
      ...linkedTask,
      enabled: false,
      status: "cancelled",
      cancelledAt: now,
      updatedAt: now,
      lastMutationTime: mutation.timestamp,
    };

    await this.storage.saveTask(updatedTask);

    // Single event — cache subscribes to task:updated and will invalidate
    this.pluginEventBus.emit("task:updated", { taskId: updatedTask.id });

    logger.info("[ReactiveTaskManager] Task disabled — linked block deleted", {
      taskId: linkedTask.id,
      blockId,
    });
  }

  /**
   * Handle checkbox toggle on a task block.
   * Routes to complete/uncomplete based on checked state.
   */
  async onCheckboxToggle(evt: CheckboxToggleEvent): Promise<void> {
    if (!this.active) return;

    const linkedTask = this.findTaskByBlockId(evt.blockId);
    if (!linkedTask) return;

    if (evt.checked) {
      // Task completed → route through scheduler
      await this.completeTask(linkedTask.id);
    } else {
      // Task unchecked → reactivate (immutable copy)
      const updatedTask: Task = {
        ...linkedTask,
        status: "todo",
        enabled: true,
        doneAt: undefined,
        lastCompletedAt: undefined,
        updatedAt: new Date().toISOString(),
        lastMutationTime: evt.timestamp,
      };

      await this.storage.saveTask(updatedTask);

      // Sync block attributes
      await this.runtimeBridge.updateBlockAttrs(evt.blockId, {
        "custom-task-status": "todo",
      });

      this.pluginEventBus.emit("task:updated", { taskId: updatedTask.id });

      logger.info("[ReactiveTaskManager] Task reactivated from checkbox uncheck", {
        taskId: linkedTask.id,
        blockId: evt.blockId,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TASK OPERATIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Complete a task by ID.
   * Delegates to scheduler for rescheduling and analytics.
   */
  async completeTask(taskId: string): Promise<void> {
    try {
      await this.scheduler.markTaskDone(taskId);

      // Update block attributes to reflect completion
      const task = this.storage.getTask(taskId);
      if (task?.linkedBlockId || task?.blockId) {
        const blockId = task.blockId || task.linkedBlockId!;
        await this.runtimeBridge.updateBlockAttrs(blockId, {
          [BLOCK_ATTR_TASK_STATUS]: "done",
          [BLOCK_ATTR_TASK_COMPLETED_AT]: new Date().toISOString(),
        });
      }

      this.pluginEventBus.emit("task:updated", { taskId });

      logger.info("[ReactiveTaskManager] Task completed", { taskId });
    } catch (err) {
      logger.error("[ReactiveTaskManager] completeTask failed", { taskId, error: err });
    }
  }

  /**
   * Skip current occurrence and reschedule.
   */
  async skipTask(taskId: string): Promise<void> {
    try {
      await this.scheduler.skipOccurrence(taskId);

      const task = this.storage.getTask(taskId);
      if (task?.linkedBlockId || task?.blockId) {
        const blockId = task.blockId || task.linkedBlockId!;
        await this.runtimeBridge.updateBlockAttrs(blockId, {
          "custom-task-status": "todo",
          "custom-task-due": task.dueAt,
        });
      }

      this.pluginEventBus.emit("task:updated", { taskId });

      logger.info("[ReactiveTaskManager] Task skipped", { taskId });
    } catch (err) {
      logger.error("[ReactiveTaskManager] skipTask failed", { taskId, error: err });
    }
  }

  /**
   * Reschedule a task (delay by minutes or to tomorrow).
   */
  async rescheduleTask(taskId: string, delayMinutes: number): Promise<void> {
    try {
      await this.scheduler.delayTask(taskId, delayMinutes);

      const task = this.storage.getTask(taskId);
      if (task?.linkedBlockId || task?.blockId) {
        const blockId = task.blockId || task.linkedBlockId!;
        await this.runtimeBridge.updateBlockAttrs(blockId, {
          "custom-task-due": task.dueAt,
        });
      }

      this.pluginEventBus.emit("task:updated", { taskId });

      logger.info("[ReactiveTaskManager] Task rescheduled", { taskId, delayMinutes });
    } catch (err) {
      logger.error("[ReactiveTaskManager] rescheduleTask failed", { taskId, error: err });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  /**
   * Find a task by its block ID (checks both blockId and linkedBlockId).
   */
  private findTaskByBlockId(blockId: string): Task | null {
    const allTasks = this.storage.getAllTasks();
    return (
      allTasks.find(
        (t) => t.blockId === blockId || t.linkedBlockId === blockId
      ) || null
    );
  }

  /**
   * Check if block content looks like a task (has checkbox-like markers).
   */
  private isTaskContent(content: string): boolean {
    return /\[[ x]\]/i.test(content) || /data-subtype="t"/.test(content);
  }

  /**
   * Strip HTML tags from content.
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, "").trim();
  }
}
