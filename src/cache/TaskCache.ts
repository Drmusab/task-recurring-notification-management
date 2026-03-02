/**
 * TaskCache — In-Memory Cache with Event-Driven Invalidation (§4.2)
 *
 * Maintains an optimized in-memory representation of tasks for fast
 * queries. Rebuilds on storage load and invalidates reactively based
 * on domain events.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Populated via service callbacks after persistence
 *   ✔ Read-only access from query/ and engine/
 *   ✔ Invalidated by domain events
 *   ❌ No direct SiYuan API calls
 *   ❌ No mutations — caches are derived state
 */

import type { DomainTask } from "@domain/DomainTask";
import { isTerminal } from "@domain/DomainTask";
import type { EventBus } from "@events/EventBus";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface TaskCacheDeps {
  readonly eventBus: EventBus;
}

export interface TaskCacheStats {
  readonly totalTasks: number;
  readonly activeTasks: number;
  readonly completedTasks: number;
  readonly byBlockIdCount: number;
  readonly rebuildCount: number;
  readonly invalidationCount: number;
}

export type TaskLoader = () => readonly DomainTask[];

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

/**
 * In-memory task cache with event-driven invalidation.
 *
 * Provides O(1) lookup by task ID and block ID.
 * Invalidation triggers:
 *   - task:runtime:completed → remove from active
 *   - task:runtime:deleted   → remove from all
 *   - task:runtime:recurrenceGenerated → add new instance
 *   - plugin:storage:reload  → full rebuild
 *   - block:updated          → refresh specific task
 */
export class TaskCache {
  private tasks: Map<string, DomainTask> = new Map();
  private byBlockId: Map<string, string> = new Map();
  private loader: TaskLoader | null = null;
  private unsubscribers: Array<() => void> = [];

  // Stats
  private rebuildCount = 0;
  private invalidationCount = 0;

  constructor(private readonly eventBus: EventBus) {
    this.subscribeToEvents();
  }

  // ──────────────────────────────────────────────────────────
  // Read Operations
  // ──────────────────────────────────────────────────────────

  /**
   * Get a task by its domain ID.
   */
  getById(taskId: string): DomainTask | null {
    return this.tasks.get(taskId) ?? null;
  }

  /**
   * Get a task by its SiYuan block ID.
   */
  getByBlockId(blockId: string): DomainTask | null {
    const taskId = this.byBlockId.get(blockId);
    if (!taskId) return null;
    return this.tasks.get(taskId) ?? null;
  }

  /**
   * Get all cached tasks (snapshot).
   */
  getAll(): readonly DomainTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get all active (non-terminal) tasks.
   */
  getActive(): readonly DomainTask[] {
    return this.getAll().filter((t) => !isTerminal(t));
  }

  /**
   * Check if a task exists in cache.
   */
  has(taskId: string): boolean {
    return this.tasks.has(taskId);
  }

  /**
   * Current number of cached tasks.
   */
  get size(): number {
    return this.tasks.size;
  }

  // ──────────────────────────────────────────────────────────
  // Write Operations (called by services only)
  // ──────────────────────────────────────────────────────────

  /**
   * Add or update a task in the cache.
   */
  set(task: DomainTask): void {
    const taskId = task.id as string;
    this.tasks.set(taskId, task);
    if (task.blockId) {
      this.byBlockId.set(task.blockId, taskId);
    }
  }

  /**
   * Add a task to the cache (alias for set).
   */
  add(task: DomainTask): void {
    this.set(task);
  }

  /**
   * Remove a task from the cache.
   */
  remove(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.blockId) {
      this.byBlockId.delete(task.blockId);
    }
    this.tasks.delete(taskId);
  }

  /**
   * Invalidate a specific task's cache entry.
   */
  invalidate(taskId: string): void {
    this.remove(taskId);
    this.invalidationCount++;
  }

  // ──────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────

  /**
   * Register the task loader function used for rebuilds.
   */
  setLoader(loader: TaskLoader): void {
    this.loader = loader;
  }

  /**
   * Rebuild the entire cache from the loader.
   */
  rebuild(): void {
    this.tasks.clear();
    this.byBlockId.clear();
    this.rebuildCount++;

    if (this.loader) {
      const tasks = this.loader();
      for (const task of tasks) {
        this.set(task);
      }
    }
  }

  /**
   * Clear all cached data.
   */
  clear(): void {
    this.tasks.clear();
    this.byBlockId.clear();
  }

  /**
   * Destroy the cache and unsubscribe from events.
   */
  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.clear();
  }

  // ──────────────────────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────────────────────

  getStats(): TaskCacheStats {
    let activeTasks = 0;
    let completedTasks = 0;
    for (const task of this.tasks.values()) {
      if (isTerminal(task)) {
        completedTasks++;
      } else {
        activeTasks++;
      }
    }

    return {
      totalTasks: this.tasks.size,
      activeTasks,
      completedTasks,
      byBlockIdCount: this.byBlockId.size,
      rebuildCount: this.rebuildCount,
      invalidationCount: this.invalidationCount,
    };
  }

  // ──────────────────────────────────────────────────────────
  // Event Subscriptions (§4.2)
  // ──────────────────────────────────────────────────────────

  private subscribeToEvents(): void {
    // task:runtime:completed → update in cache with new status
    this.unsubscribers.push(
      this.eventBus.on("task:runtime:completed", ({ task }) => {
        this.set(task);
        this.invalidationCount++;
      }),
    );

    // task:runtime:deleted → remove from all caches
    this.unsubscribers.push(
      this.eventBus.on("task:runtime:deleted", ({ taskId }) => {
        this.remove(taskId);
        this.invalidationCount++;
      }),
    );

    // task:runtime:recurrenceGenerated → add new instance
    this.unsubscribers.push(
      this.eventBus.on("task:runtime:recurrenceGenerated", ({ task }) => {
        this.set(task);
      }),
    );

    // plugin:storage:reload → full rebuild
    this.unsubscribers.push(
      this.eventBus.on("plugin:storage:reload", () => {
        this.rebuild();
      }),
    );

    // block:updated → refresh specific task
    this.unsubscribers.push(
      this.eventBus.on("block:updated", ({ blockId }) => {
        const taskId = this.byBlockId.get(blockId);
        if (taskId) {
          this.invalidate(taskId);
        }
      }),
    );

    // task:runtime:created → add to cache
    this.unsubscribers.push(
      this.eventBus.on("task:runtime:created", ({ task }) => {
        this.set(task);
      }),
    );

    // task:runtime:rescheduled → update in cache
    this.unsubscribers.push(
      this.eventBus.on("task:runtime:rescheduled", ({ task }) => {
        this.set(task);
      }),
    );
  }
}
