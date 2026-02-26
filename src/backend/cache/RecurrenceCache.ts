/**
 * RecurrenceCache — Block-Validated Recurrence State Cache
 *
 * Caches "next occurrence" dates and recurrence rules for tasks.
 * Validates recurrence RRULE against block attribute on read when stale.
 * Invalidates on: task:complete, task:reschedule, block:updated,
 *                 task:refresh (full rebuild).
 *
 * Consumers: Scheduler (via DueStateCache), EventService, Dashboard
 *
 * FORBIDDEN:
 *  - store markdown/DOM
 *  - bypass SiYuan block API
 *  - import frontend components
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskStorage";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import {
  getBlockAttrs,
} from "@backend/core/api/SiYuanApiClient";
import {
  BLOCK_ATTR_TASK_RECURRENCE,
} from "@shared/constants/misc-constants";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface RecurrenceCacheEntry {
  taskId: string;
  rrule: string | null;
  /** Computed next occurrence (ISO string) — null if no recurrence */
  nextDue: string | null;
  /** Epoch ms when this entry was validated against the block */
  validatedAt: number;
}

export interface RecurrenceCacheStats {
  size: number;
  hits: number;
  misses: number;
  validations: number;
  staleCorrections: number;
}

export interface RecurrenceCacheDeps {
  repository: TaskRepositoryProvider;
  pluginEventBus: PluginEventBus;
  /** Compute next occurrence date from a task.  Injected so we don't
   *  couple directly to RecurrenceEngine. */
  computeNext?: (task: Task) => string | null;
}

const VALIDATION_TTL_MS = 60_000; // 60 s for recurrence (less volatile than due)

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class RecurrenceCache {
  private entries: Map<string, RecurrenceCacheEntry> = new Map();
  private active = false;

  private readonly repository: TaskRepositoryProvider;
  private readonly eventBus: PluginEventBus;
  private readonly computeNext: (task: Task) => string | null;
  private readonly unsubscribes: Array<() => void> = [];

  // stats
  private hits = 0;
  private misses = 0;
  private validations = 0;
  private staleCorrections = 0;

  constructor(deps: RecurrenceCacheDeps) {
    this.repository = deps.repository;
    this.eventBus = deps.pluginEventBus;
    this.computeNext = deps.computeNext ?? (() => null);
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    this.rebuild();
    this.subscribeEvents();
    logger.info("[RecurrenceCache] Started", { size: this.entries.size });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* noop */ }
    }
    this.unsubscribes.length = 0;
    this.entries.clear();
    logger.info("[RecurrenceCache] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Fast synchronous read — returns cached entry (may be stale).
   */
  getEntry(taskId: string): RecurrenceCacheEntry | undefined {
    const e = this.entries.get(taskId);
    if (e) { this.hits++; } else { this.misses++; }
    return e;
  }

  /**
   * Validated read — checks block attrs if entry is older than TTL.
   * Returns corrected entry.
   */
  async getValidated(taskId: string): Promise<RecurrenceCacheEntry | undefined> {
    const e = this.entries.get(taskId);
    if (!e) { this.misses++; return undefined; }

    const now = Date.now();
    if (now - e.validatedAt < VALIDATION_TTL_MS) {
      this.hits++;
      return e;
    }

    const task = this.repository.getTask(taskId);
    if (!task) {
      this.entries.delete(taskId);
      return undefined;
    }

    const blockId = task.linkedBlockId ?? task.blockId;
    if (!blockId) {
      e.validatedAt = now;
      this.hits++;
      return e;
    }

    try {
      this.validations++;
      const attrs = await getBlockAttrs(blockId);
      const blockRrule = attrs[BLOCK_ATTR_TASK_RECURRENCE] ?? null;

      if (blockRrule !== e.rrule) {
        this.staleCorrections++;
        logger.info("[RecurrenceCache] RRULE diverged, correcting", { taskId, cached: e.rrule, block: blockRrule });
        e.rrule = blockRrule;
        // Recompute next occurrence
        const patchedTask = { ...task, recurrence: blockRrule ? { ...task.recurrence, rrule: blockRrule } : undefined } as Task;
        e.nextDue = this.computeNext(patchedTask);
      }
      e.validatedAt = now;
      this.hits++;
      return e;
    } catch (err) {
      logger.warn("[RecurrenceCache] Validation failed", { taskId, err });
      e.validatedAt = now; // prevent retry storm
      this.hits++;
      return e;
    }
  }

  /**
   * Get all entries that have recurrence (rrule !== null).
   */
  getRecurringEntries(): RecurrenceCacheEntry[] {
    return Array.from(this.entries.values()).filter(e => e.rrule !== null);
  }

  // ── Rebuild / Invalidation ───────────────────────────────────

  rebuild(): void {
    this.entries.clear();
    for (const task of this.repository.getAllTasks()) {
      this.populateEntry(task);
    }
  }

  invalidateTask(taskId: string): void {
    const task = this.repository.getTask(taskId);
    if (task) {
      this.populateEntry(task);
    } else {
      this.entries.delete(taskId);
    }
  }

  evict(taskId: string): void {
    this.entries.delete(taskId);
  }

  // ── Stats ────────────────────────────────────────────────────

  getStats(): RecurrenceCacheStats {
    return {
      size: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      validations: this.validations,
      staleCorrections: this.staleCorrections,
    };
  }

  // ── Internals ────────────────────────────────────────────────

  private populateEntry(task: Task): void {
    const rrule = task.recurrence?.rrule ?? null;
    const nextDue = this.computeNext(task);
    this.entries.set(task.id, {
      taskId: task.id,
      rrule,
      nextDue,
      validatedAt: Date.now(),
    });
  }

  private subscribeEvents(): void {
    const bus = this.eventBus;

    this.unsubscribes.push(
      bus.on("task:complete", (p) => this.invalidateTask(p.taskId)),
      bus.on("task:reschedule", (p) => this.invalidateTask(p.taskId)),
      bus.on("task:updated", (p) => this.invalidateTask(p.taskId)),
      bus.on("block:updated", (p) => {
        // Find task by block
        for (const [tid, _e] of this.entries) {
          const task = this.repository.getTask(tid);
          if (task && (task.linkedBlockId === p.blockId || task.blockId === p.blockId)) {
            this.invalidateTask(tid);
            break;
          }
        }
      }),
      bus.on("task:refresh", () => this.rebuild()),
    );
  }
}
