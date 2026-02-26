/**
 * TaskSelector — Base Task Selection with Cache Validation
 *
 * Provides the foundational selection layer that reads from TaskCache
 * (never from TaskStorage directly) and optionally validates entries
 * against SiYuan block attributes before returning results.
 *
 * This is the ONLY import path from the cache layer into the query
 * runtime. All higher-level selectors (DependencyAwareSelector,
 * RecurrenceAwareSelector) compose on top of this class.
 *
 * Design:
 *   - Reads from TaskCache (fast in-memory)
 *   - Validates via TaskCache.getTaskValidated() (block-aware, TTL-gated)
 *   - Verifies block existence via BlockAttributeSync.readTaskAttributes()
 *   - Returns ReadonlyTask[] — never mutable Task references
 *   - Subscribes to cache invalidation events to stay fresh
 *
 * FORBIDDEN:
 *   - import TaskStorage directly
 *   - mutate task model
 *   - parse markdown / access DOM
 *   - fire integration events
 *   - write to storage
 */

import type { Task, ReadonlyTask } from "@backend/core/models/Task";
import type { TaskCache } from "@backend/cache/TaskCache";
import type { BlockAttributeSync, BlockTaskAttributes } from "@backend/blocks/BlockAttributeSync";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface TaskSelectorDeps {
  taskCache: TaskCache;
  blockAttributeSync: BlockAttributeSync;
  pluginEventBus: PluginEventBus;
}

export interface SelectionOptions {
  /** If true, validate each task against SiYuan block attributes (slower). Default: false */
  validate?: boolean;
  /** If true, verify that the block still exists in SiYuan (rejects orphans). Default: false */
  verifyBlockExists?: boolean;
  /** Maximum number of tasks to return (0 = unlimited). Default: 0 */
  limit?: number;
}

export interface SelectionResult {
  /** Selected tasks (ReadonlyTask — never mutable) */
  readonly tasks: ReadonlyTask[];
  /** Number of tasks fetched from cache before filtering */
  readonly fromCache: number;
  /** Number of tasks that failed block verification and were excluded */
  readonly orphansExcluded: number;
  /** Duration in milliseconds */
  readonly durationMs: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class TaskSelector {
  private readonly cache: TaskCache;
  private readonly blockSync: BlockAttributeSync;
  private readonly eventBus: PluginEventBus;

  constructor(deps: TaskSelectorDeps) {
    this.cache = deps.taskCache;
    this.blockSync = deps.blockAttributeSync;
    this.eventBus = deps.pluginEventBus;
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Select all enabled tasks from cache.
   * Default path: fast in-memory read, no SiYuan API calls.
   */
  async selectAll(opts?: SelectionOptions): Promise<SelectionResult> {
    const start = performance.now();
    const raw = this.cache.getEnabledTasks();
    return this.processSelection(raw, opts, start);
  }

  /**
   * Select tasks due on or before `date`.
   */
  async selectDue(date: Date, opts?: SelectionOptions): Promise<SelectionResult> {
    const start = performance.now();
    const raw = this.cache.getTasksDueOnOrBefore(date);
    return this.processSelection(raw, opts, start);
  }

  /**
   * Select tasks in a date range.
   */
  async selectInRange(startDate: Date, endDate: Date, opts?: SelectionOptions): Promise<SelectionResult> {
    const start = performance.now();
    const raw = this.cache.getTasksInRange(startDate, endDate);
    return this.processSelection(raw, opts, start);
  }

  /**
   * Select a single task by ID.
   * When `validate` is true, uses getTaskValidated() for block-checked read.
   */
  async selectById(taskId: string, opts?: SelectionOptions): Promise<ReadonlyTask | undefined> {
    const validate = opts?.validate ?? false;

    const task = validate
      ? await this.cache.getTaskValidated(taskId)
      : this.cache.getTask(taskId);

    if (!task) return undefined;

    // Optionally verify block existence
    if (opts?.verifyBlockExists) {
      const exists = await this.blockExists(task);
      if (!exists) {
        logger.debug("[TaskSelector] Block not found for task, excluding", { taskId });
        return undefined;
      }
    }

    return task as ReadonlyTask;
  }

  // ── Internal ─────────────────────────────────────────────────

  /**
   * Process a raw task array through optional validation and block-existence
   * checks, returning a ReadonlyTask[] result.
   */
  private async processSelection(
    raw: Task[],
    opts: SelectionOptions | undefined,
    startMs: number,
  ): Promise<SelectionResult> {
    const fromCache = raw.length;
    let tasks: Task[] = raw;
    let orphansExcluded = 0;

    // 1. Block-validated reads (per-task, TTL-gated inside TaskCache)
    if (opts?.validate) {
      const validated: Task[] = [];
      for (const t of tasks) {
        const v = await this.cache.getTaskValidated(t.id);
        if (v) validated.push(v);
      }
      tasks = validated;
    }

    // 2. Verify block existence (expensive — only when explicitly requested)
    if (opts?.verifyBlockExists) {
      const verified: Task[] = [];
      for (const t of tasks) {
        const exists = await this.blockExists(t);
        if (exists) {
          verified.push(t);
        } else {
          orphansExcluded++;
        }
      }
      tasks = verified;
    }

    // 3. Limit
    if (opts?.limit && opts.limit > 0 && tasks.length > opts.limit) {
      tasks = tasks.slice(0, opts.limit);
    }

    const durationMs = performance.now() - startMs;

    logger.debug("[TaskSelector] Selection complete", {
      fromCache,
      returned: tasks.length,
      orphansExcluded,
      durationMs: Math.round(durationMs),
    });

    return {
      tasks: tasks as ReadonlyTask[],
      fromCache,
      orphansExcluded,
      durationMs,
    };
  }

  /**
   * Check if a task's linked block still exists in SiYuan.
   * Returns true if:
   *   - task has no blockId (non-block task → always valid)
   *   - blockAttributeSync.readTaskAttributes() returns non-null
   */
  private async blockExists(task: Task): Promise<boolean> {
    const blockId = task.blockId ?? task.linkedBlockId;
    if (!blockId) return true; // non-block task is always valid

    try {
      const attrs: BlockTaskAttributes | null = await this.blockSync.readTaskAttributes(blockId);
      return attrs !== null;
    } catch {
      // API error → assume exists to avoid false rejections
      return true;
    }
  }
}
