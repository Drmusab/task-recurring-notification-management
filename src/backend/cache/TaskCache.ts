/**
 * TaskCache — Block-Validated Runtime Cache for Tasks
 *
 * Provides a fast, event-reactive read path for task data.
 * All reads come from the in-memory map (populated from TaskStorage).
 * Critical fields (due, status, completion) can be revalidated against
 * SiYuan block attributes on demand.
 *
 * Invalidation triggers:
 *  task:complete, task:reschedule, task:create, task:updated,
 *  task:refresh, block:updated, block:deleted, plugin:storage:reload
 *
 * FORBIDDEN:
 *  - store markdown/DOM
 *  - bypass BlockAttributeSync
 *  - mutate task model
 *  - import frontend components
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskStorage";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import {
  getBlockAttrs,
} from "@backend/core/api/SiYuanApiClient";
import {
  BLOCK_ATTR_TASK_DUE,
  BLOCK_ATTR_TASK_STATUS,
  BLOCK_ATTR_TASK_COMPLETED_AT,
  BLOCK_ATTR_TASK_RECURRENCE,
  BLOCK_ATTR_TASK_ENABLED,
} from "@shared/constants/misc-constants";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface TaskCacheStats {
  size: number;
  hits: number;
  misses: number;
  validations: number;
  validationFailures: number;
  lastRebuildAt: string | null;
}

export interface TaskCacheDeps {
  repository: TaskRepositoryProvider;
  pluginEventBus: PluginEventBus;
}

/** Minimum milliseconds between full block-attr validations for a single task. */
const VALIDATION_TTL_MS = 30_000; // 30 s

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class TaskCache {
  private tasks: Map<string, Task> = new Map();
  private validatedAt: Map<string, number> = new Map(); // taskId → epoch ms
  private active = false;

  private readonly repository: TaskRepositoryProvider;
  private readonly eventBus: PluginEventBus;
  private readonly unsubscribes: Array<() => void> = [];

  // stats
  private hits = 0;
  private misses = 0;
  private validations = 0;
  private validationFailures = 0;
  private lastRebuildAt: string | null = null;

  constructor(deps: TaskCacheDeps) {
    this.repository = deps.repository;
    this.eventBus = deps.pluginEventBus;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Populate cache from storage and subscribe to invalidation events.
   * MUST be called after plugin.onload() has finished initializing storage.
   */
  start(): void {
    if (this.active) return;
    this.active = true;
    this.rebuild();
    this.subscribeEvents();
    logger.info("[TaskCache] Started", { size: this.tasks.size });
  }

  /**
   * Tear down: clear data + unsubscribe.
   */
  stop(): void {
    if (!this.active) return;
    this.active = false;
    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* already removed */ }
    }
    this.unsubscribes.length = 0;
    this.tasks.clear();
    this.validatedAt.clear();
    logger.info("[TaskCache] Stopped");
  }

  // ── Public read API ──────────────────────────────────────────

  /** Get a task by ID (fast, from memory). */
  getTask(taskId: string): Task | undefined {
    const t = this.tasks.get(taskId);
    if (t) { this.hits++; } else { this.misses++; }
    return t;
  }

  /** Get a task by block ID. */
  getTaskByBlockId(blockId: string): Task | undefined {
    for (const t of this.tasks.values()) {
      if (t.linkedBlockId === blockId || t.blockId === blockId) {
        this.hits++;
        return t;
      }
    }
    this.misses++;
    return undefined;
  }

  /** Return all cached tasks. */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /** Return enabled tasks only. */
  getEnabledTasks(): Task[] {
    return this.getAllTasks().filter(t => t.enabled);
  }

  /** Return tasks due on or before the given date. */
  getTasksDueOnOrBefore(date: Date): Task[] {
    const ms = date.getTime();
    return this.getEnabledTasks().filter(t => {
      if (!t.dueAt) return false;
      return new Date(t.dueAt).getTime() <= ms;
    });
  }

  /** Return tasks within a date range. */
  getTasksInRange(start: Date, end: Date): Task[] {
    const sMs = start.getTime();
    const eMs = end.getTime();
    return this.getEnabledTasks().filter(t => {
      if (!t.dueAt) return false;
      const d = new Date(t.dueAt).getTime();
      return d >= sMs && d <= eMs;
    });
  }

  /** Number of cached tasks. */
  get size(): number {
    return this.tasks.size;
  }

  // ── Block‐Validated Read ─────────────────────────────────────

  /**
   * Get a task while validating its critical fields against block attributes.
   * Uses a per-task TTL to avoid excessive API calls.
   * Returns `undefined` if the task doesn't exist or the block has diverged
   * (in which case the cache entry is patched in‐place).
   */
  async getTaskValidated(taskId: string): Promise<Task | undefined> {
    const task = this.tasks.get(taskId);
    if (!task) { this.misses++; return undefined; }

    const blockId = task.linkedBlockId ?? task.blockId;
    if (!blockId) {
      // No block link → memory is the truth
      this.hits++;
      return task;
    }

    const now = Date.now();
    const lastVal = this.validatedAt.get(taskId) ?? 0;
    if (now - lastVal < VALIDATION_TTL_MS) {
      this.hits++;
      return task;
    }

    // Fetch block attrs and reconcile — immutable copy pattern
    try {
      this.validations++;
      const attrs = await getBlockAttrs(blockId);
      this.validatedAt.set(taskId, now);

      const patches: { -readonly [K in keyof Task]?: Task[K] } = {};
      let patched = false;

      const blockDue = attrs[BLOCK_ATTR_TASK_DUE];
      if (blockDue && blockDue !== task.dueAt) {
        patches.dueAt = blockDue;
        patched = true;
      }
      const blockStatus = attrs[BLOCK_ATTR_TASK_STATUS];
      if (blockStatus && blockStatus !== task.status) {
        patches.status = blockStatus as Task['status'];
        patched = true;
      }
      const blockEnabled = attrs[BLOCK_ATTR_TASK_ENABLED];
      if (blockEnabled !== undefined) {
        const en = blockEnabled === "true";
        if (en !== task.enabled) {
          patches.enabled = en;
          patched = true;
        }
      }
      const blockCompleted = attrs[BLOCK_ATTR_TASK_COMPLETED_AT];
      if (blockCompleted && blockCompleted !== task.lastCompletedAt) {
        patches.lastCompletedAt = blockCompleted;
        patched = true;
      }
      const blockRecurrence = attrs[BLOCK_ATTR_TASK_RECURRENCE];
      if (blockRecurrence && task.recurrence && blockRecurrence !== task.recurrence.rrule) {
        patches.recurrence = { ...task.recurrence, rrule: blockRecurrence };
        patched = true;
      }

      if (patched) {
        // Replace cache entry with a new object — never mutate in place
        const patchedTask: Task = { ...task, ...patches };
        this.tasks.set(taskId, patchedTask);
        this.eventBus.emit("cache:task:updated", { taskId });
        this.hits++;
        return patchedTask;
      }

      this.hits++;
      return task;
    } catch (err) {
      this.validationFailures++;
      logger.warn("[TaskCache] Block validation failed, returning memory state", { taskId, err });
      this.hits++;
      return task;
    }
  }

  // ── Rebuild / Invalidation ───────────────────────────────────

  /**
   * Full cache rebuild from repository (source of truth for warm cache).
   * Clears all validation timestamps.
   */
  rebuild(): void {
    this.tasks.clear();
    this.validatedAt.clear();
    for (const t of this.repository.getAllTasks()) {
      this.tasks.set(t.id, t);
    }
    this.lastRebuildAt = new Date().toISOString();
    this.eventBus.emit("cache:task:invalidated", { scope: "full" });
  }

  /**
   * Invalidate a single task — re-read from repository.
   */
  invalidateTask(taskId: string): void {
    this.validatedAt.delete(taskId);
    const fresh = this.repository.getTask(taskId);
    if (fresh) {
      this.tasks.set(taskId, fresh);
    } else {
      this.tasks.delete(taskId);
    }
    this.eventBus.emit("cache:task:updated", { taskId });
  }

  /**
   * Remove a task from cache.
   */
  evict(taskId: string): void {
    this.tasks.delete(taskId);
    this.validatedAt.delete(taskId);
    this.eventBus.emit("cache:task:invalidated", { scope: "single", taskId });
  }

  // ── Stats ────────────────────────────────────────────────────

  getStats(): TaskCacheStats {
    return {
      size: this.tasks.size,
      hits: this.hits,
      misses: this.misses,
      validations: this.validations,
      validationFailures: this.validationFailures,
      lastRebuildAt: this.lastRebuildAt,
    };
  }

  // ── Event Subscriptions ──────────────────────────────────────

  private subscribeEvents(): void {
    const bus = this.eventBus;

    // Task mutations → invalidate single
    this.unsubscribes.push(
      bus.on("task:complete", (p) => this.invalidateTask(p.taskId)),
      bus.on("task:reschedule", (p) => this.invalidateTask(p.taskId)),
      bus.on("task:updated", (p) => this.invalidateTask(p.taskId)),
      bus.on("task:saved", (p) => {
        this.tasks.set(p.task.id, p.task);
        this.validatedAt.delete(p.task.id);
        this.eventBus.emit("cache:task:updated", { taskId: p.task.id });
      }),
    );

    // Block mutations → find linked task and invalidate
    this.unsubscribes.push(
      bus.on("block:updated", (p) => {
        const task = this.getTaskByBlockId(p.blockId);
        if (task) this.invalidateTask(task.id);
      }),
      bus.on("block:deleted", (p) => {
        const task = this.getTaskByBlockId(p.blockId);
        if (task) this.evict(task.id);
      }),
    );

    // Full-scope invalidations
    this.unsubscribes.push(
      bus.on("task:refresh", () => this.rebuild()),
    );

    // Spec §4.2 — cache invalidation from runtime domain events
    this.unsubscribes.push(
      bus.on("plugin:storage:reload", () => {
        this.rebuild();
      }),
    );
    this.unsubscribes.push(
      bus.on("task:runtime:recurrenceGenerated", (p) => {
        // New recurrence child created — invalidate so next query picks it up
        this.invalidateTask(p.taskId);
      }),
    );
  }
}
