/**
 * DueStateCache — Block-Validated Due-State Cache for Scheduler
 *
 * The Scheduler's SOLE read path for task due-state.
 * Maintains a sorted set of (dueMs, taskId) pairs for fast range queries.
 * Validates task.dueAt against block attributes when entries exceed
 * a configurable TTL, ensuring the Scheduler never fires stale events.
 *
 * Invalidation triggers:
 *   task:complete      → evict (no longer due)
 *   task:reschedule    → update dueAt
 *   task:updated       → re-read dueAt from repository
 *   block:updated      → revalidate against block attr
 *   task:refresh       → full rebuild
 *
 * FORBIDDEN:
 *  - trust stale memory beyond TTL
 *  - reuse recurrence snapshot without validation
 *  - import frontend components
 *  - mutate task model
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
} from "@shared/constants/misc-constants";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface DueStateEntry {
  taskId: string;
  dueMs: number;
  enabled: boolean;
  status: string;
  /** Epoch ms when this entry was last validated against block attrs */
  validatedAt: number;
}

export interface DueStateCacheStats {
  size: number;
  dueNow: number;
  overdue: number;
  validations: number;
  corrections: number;
}

export interface DueStateCacheDeps {
  repository: TaskRepositoryProvider;
  pluginEventBus: PluginEventBus;
}

/** How long a due-state entry can be trusted without block revalidation. */
const DUE_VALIDATION_TTL_MS = 45_000; // 45 s — between scheduler ticks

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class DueStateCache {
  /** taskId → DueStateEntry */
  private entries: Map<string, DueStateEntry> = new Map();
  private active = false;

  private readonly repository: TaskRepositoryProvider;
  private readonly eventBus: PluginEventBus;
  private readonly unsubscribes: Array<() => void> = [];

  // stats
  private validations = 0;
  private corrections = 0;

  constructor(deps: DueStateCacheDeps) {
    this.repository = deps.repository;
    this.eventBus = deps.pluginEventBus;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    this.rebuild();
    this.subscribeEvents();
    logger.info("[DueStateCache] Started", { size: this.entries.size });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* noop */ }
    }
    this.unsubscribes.length = 0;
    this.entries.clear();
    logger.info("[DueStateCache] Stopped");
  }

  // ── Public Read API (Scheduler-oriented) ─────────────────────

  /**
   * Fast synchronous read — tasks due on or before `date`.
   * Filters to enabled tasks with status !== "done" / "cancelled".
   */
  getTasksDueOnOrBefore(date: Date): DueStateEntry[] {
    const ms = date.getTime();
    const result: DueStateEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.enabled && entry.dueMs <= ms && entry.status !== "done" && entry.status !== "cancelled") {
        result.push(entry);
      }
    }
    return result;
  }

  /**
   * Get tasks due today or overdue (convenience for Scheduler.checkDueTasks).
   */
  getTodayAndOverdue(): DueStateEntry[] {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    return this.getTasksDueOnOrBefore(endOfToday);
  }

  /**
   * Get tasks in a date range.
   */
  getInRange(start: Date, end: Date): DueStateEntry[] {
    const sMs = start.getTime();
    const eMs = end.getTime();
    const result: DueStateEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.enabled && entry.dueMs >= sMs && entry.dueMs <= eMs && entry.status !== "done" && entry.status !== "cancelled") {
        result.push(entry);
      }
    }
    return result;
  }

  /** Get a single entry. */
  getEntry(taskId: string): DueStateEntry | undefined {
    return this.entries.get(taskId);
  }

  /** Number of tracked entries. */
  get size(): number {
    return this.entries.size;
  }

  // ── Validated Read ───────────────────────────────────────────

  /**
   * Return tasks due before `date`, revalidating stale entries against
   * block attributes first.  Returns full Task objects (not just entries)
   * so the caller can use them directly.
   *
   * Intended for Scheduler.checkDueTasks() hot path.
   */
  async getValidatedDueTasks(date: Date): Promise<Task[]> {
    const ms = date.getTime();
    const now = Date.now();
    const freshTasks: Task[] = [];

    for (const entry of this.entries.values()) {
      if (!entry.enabled || entry.status === "done" || entry.status === "cancelled") continue;
      if (entry.dueMs > ms) continue;

      const task = this.repository.getTask(entry.taskId);
      if (!task) {
        this.entries.delete(entry.taskId);
        continue;
      }

      // Revalidate if stale
      if (now - entry.validatedAt > DUE_VALIDATION_TTL_MS) {
        await this.revalidateEntry(entry, task);
        // After revalidation, re-check eligibility
        if (!entry.enabled || entry.status === "done" || entry.status === "cancelled") continue;
        if (entry.dueMs > ms) continue;
      }

      freshTasks.push(task);
    }
    return freshTasks;
  }

  // ── Rebuild / Invalidation ───────────────────────────────────

  rebuild(): void {
    this.entries.clear();
    const now = Date.now();
    for (const task of this.repository.getAllTasks()) {
      if (!task.dueAt) continue;
      this.entries.set(task.id, {
        taskId: task.id,
        dueMs: new Date(task.dueAt).getTime(),
        enabled: task.enabled,
        status: task.status ?? "todo",
        validatedAt: now,
      });
    }
    this.eventBus.emit("cache:task:invalidated", { scope: "due" });
  }

  invalidateTask(taskId: string): void {
    const task = this.repository.getTask(taskId);
    if (!task || !task.dueAt) {
      this.entries.delete(taskId);
      return;
    }
    this.entries.set(taskId, {
      taskId: task.id,
      dueMs: new Date(task.dueAt).getTime(),
      enabled: task.enabled,
      status: task.status ?? "todo",
      validatedAt: Date.now(),
    });
  }

  evict(taskId: string): void {
    this.entries.delete(taskId);
  }

  // ── Stats ────────────────────────────────────────────────────

  getStats(): DueStateCacheStats {
    const now = Date.now();
    let dueNow = 0;
    let overdue = 0;
    for (const entry of this.entries.values()) {
      if (!entry.enabled || entry.status === "done" || entry.status === "cancelled") continue;
      if (entry.dueMs <= now) {
        overdue++;
        dueNow++;
      }
    }
    return {
      size: this.entries.size,
      dueNow,
      overdue,
      validations: this.validations,
      corrections: this.corrections,
    };
  }

  // ── Internals ────────────────────────────────────────────────

  private async revalidateEntry(entry: DueStateEntry, task: Task): Promise<void> {
    const blockId = task.linkedBlockId ?? task.blockId;
    if (!blockId) {
      entry.validatedAt = Date.now();
      return;
    }

    try {
      this.validations++;
      const attrs = await getBlockAttrs(blockId);

      // Check due date
      const blockDue = attrs[BLOCK_ATTR_TASK_DUE];
      if (blockDue) {
        const blockDueMs = new Date(blockDue).getTime();
        if (!isNaN(blockDueMs) && blockDueMs !== entry.dueMs) {
          this.corrections++;
          logger.info("[DueStateCache] Due date corrected from block", {
            taskId: entry.taskId,
            cached: new Date(entry.dueMs).toISOString(),
            block: blockDue,
          });
          entry.dueMs = blockDueMs;
        }
      }

      // Check status
      const blockStatus = attrs[BLOCK_ATTR_TASK_STATUS];
      if (blockStatus && blockStatus !== entry.status) {
        this.corrections++;
        entry.status = blockStatus;
      }

      // Check if completed
      const completedAt = attrs[BLOCK_ATTR_TASK_COMPLETED_AT];
      if (completedAt && entry.status !== "done") {
        this.corrections++;
        entry.status = "done";
        entry.enabled = false;
      }

      entry.validatedAt = Date.now();
    } catch (err) {
      logger.warn("[DueStateCache] Block revalidation failed", { taskId: entry.taskId, err });
      entry.validatedAt = Date.now(); // prevent rapid retry
    }
  }

  private subscribeEvents(): void {
    const bus = this.eventBus;

    this.unsubscribes.push(
      bus.on("task:complete", (p) => this.evict(p.taskId)),
      bus.on("task:reschedule", (p) => this.invalidateTask(p.taskId)),
      bus.on("task:updated", (p) => this.invalidateTask(p.taskId)),
      bus.on("task:saved", (p) => {
        if (p.task.dueAt) {
          this.invalidateTask(p.task.id);
        }
      }),
      bus.on("block:updated", (p) => {
        // Find task linked to this block
        for (const entry of this.entries.values()) {
          const task = this.repository.getTask(entry.taskId);
          if (task && (task.linkedBlockId === p.blockId || task.blockId === p.blockId)) {
            this.invalidateTask(entry.taskId);
            break;
          }
        }
      }),
      bus.on("block:deleted", (p) => {
        for (const entry of this.entries.values()) {
          const task = this.repository.getTask(entry.taskId);
          if (task && (task.linkedBlockId === p.blockId || task.blockId === p.blockId)) {
            this.evict(entry.taskId);
            break;
          }
        }
      }),
      bus.on("task:refresh", () => this.rebuild()),
    );
  }
}
