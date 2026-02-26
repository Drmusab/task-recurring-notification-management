/**
 * ReminderQueue — Priority-Sorted Reminder Queue with Deduplication
 *
 * Holds validated reminders awaiting dispatch. Tasks are enqueued ONLY
 * after passing ReminderPolicy.evaluate(). The queue is priority-sorted
 * by dueAt (earliest first) with per-task deduplication.
 *
 * Features:
 *   - Priority queue (earliest dueAt first)
 *   - Per-task dedup (same taskId cannot be enqueued twice)
 *   - Bounded capacity (prevents memory leak)
 *   - Peek/drain for batch dispatch
 *   - Stats tracking
 *
 * Consumers:
 *   DueEventEmitter         → enqueue() after policy passes
 *   ReminderDispatcher      → drain() or dequeue() for dispatch
 *   ReminderRetryManager    → enqueue() for retry
 *
 * FORBIDDEN:
 *   - Evaluate policy (the caller must have already validated)
 *   - Fire reminders directly
 *   - Access DOM / frontend
 *   - Import PluginEventBus directly
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ReminderQueueEntry {
  /** The validated, recurrence-resolved task */
  task: ReadonlyTask;
  /** When this entry was enqueued (ISO string) */
  enqueuedAt: string;
  /** Number of times this entry has been retried */
  retryCount: number;
  /** Priority level: 1 = normal due, 2 = overdue, 3 = urgent */
  priority: number;
  /** Source of the enqueue (e.g., "due_event", "retry", "missed") */
  source: string;
}

export interface ReminderQueueStats {
  currentSize: number;
  totalEnqueued: number;
  totalDequeued: number;
  totalDuplicatesRejected: number;
  totalCapacityRejected: number;
}

/** Maximum queue size to prevent memory leak */
const MAX_QUEUE_SIZE = 500;

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class ReminderQueue {
  /** Priority-sorted queue (earliest dueAt first) */
  private readonly entries: ReminderQueueEntry[] = [];

  /** Dedup index: taskId → true if currently in the queue */
  private readonly taskIndex: Set<string> = new Set();

  private active = false;

  // ── Stats ──
  private totalEnqueued = 0;
  private totalDequeued = 0;
  private totalDuplicatesRejected = 0;
  private totalCapacityRejected = 0;

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[ReminderQueue] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.entries.length = 0;
    this.taskIndex.clear();
    this.active = false;
    logger.info("[ReminderQueue] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Enqueue a validated reminder entry.
   * Rejects duplicates (same taskId) and over-capacity entries.
   *
   * @returns true if enqueued, false if rejected (duplicate or full)
   */
  enqueue(entry: ReminderQueueEntry): boolean {
    if (!this.active) return false;

    // Dedup: reject if same taskId already queued
    if (this.taskIndex.has(entry.task.id)) {
      this.totalDuplicatesRejected++;
      logger.debug("[ReminderQueue] Duplicate rejected", { taskId: entry.task.id });
      return false;
    }

    // Capacity: reject if queue is full
    if (this.entries.length >= MAX_QUEUE_SIZE) {
      this.totalCapacityRejected++;
      logger.warn("[ReminderQueue] Capacity reached, rejecting", { taskId: entry.task.id });
      return false;
    }

    // Insert in sorted position (earliest dueAt first)
    const insertIdx = this.findInsertIndex(entry);
    this.entries.splice(insertIdx, 0, entry);
    this.taskIndex.add(entry.task.id);
    this.totalEnqueued++;

    logger.debug("[ReminderQueue] Enqueued", {
      taskId: entry.task.id,
      priority: entry.priority,
      queueSize: this.entries.length,
    });

    return true;
  }

  /**
   * Dequeue the highest-priority (earliest dueAt) entry.
   * Returns null if queue is empty.
   */
  dequeue(): ReminderQueueEntry | null {
    if (!this.active || this.entries.length === 0) return null;

    const entry = this.entries.shift()!;
    this.taskIndex.delete(entry.task.id);
    this.totalDequeued++;
    return entry;
  }

  /**
   * Drain all entries from the queue.
   * Returns entries in priority order (earliest first).
   */
  drain(): ReminderQueueEntry[] {
    if (!this.active) return [];

    const drained = [...this.entries];
    this.totalDequeued += drained.length;
    this.entries.length = 0;
    this.taskIndex.clear();
    return drained;
  }

  /**
   * Peek at the next entry without removing it.
   */
  peek(): ReminderQueueEntry | null {
    if (!this.active || this.entries.length === 0) return null;
    return this.entries[0] ?? null;
  }

  /**
   * Remove a specific task from the queue.
   * Used when task is completed/cancelled while in queue.
   */
  remove(taskId: string): boolean {
    if (!this.taskIndex.has(taskId)) return false;

    const idx = this.entries.findIndex((e) => e.task.id === taskId);
    if (idx >= 0) {
      this.entries.splice(idx, 1);
      this.taskIndex.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * Check if a task is currently queued.
   */
  has(taskId: string): boolean {
    return this.taskIndex.has(taskId);
  }

  /**
   * Current queue size.
   */
  get size(): number {
    return this.entries.length;
  }

  /**
   * Get queue stats.
   */
  getStats(): ReminderQueueStats {
    return {
      currentSize: this.entries.length,
      totalEnqueued: this.totalEnqueued,
      totalDequeued: this.totalDequeued,
      totalDuplicatesRejected: this.totalDuplicatesRejected,
      totalCapacityRejected: this.totalCapacityRejected,
    };
  }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Find insertion index using binary search for priority-sorted order.
   * Sort key: priority descending THEN dueAt ascending.
   */
  private findInsertIndex(entry: ReminderQueueEntry): number {
    let lo = 0;
    let hi = this.entries.length;
    const entryDue = new Date(entry.task.dueAt).getTime();
    const entryPri = entry.priority;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const midEntry = this.entries[mid]!;
      const midDue = new Date(midEntry.task.dueAt).getTime();
      const midPri = midEntry.priority;

      // Higher priority first, then earlier dueAt
      if (midPri > entryPri || (midPri === entryPri && midDue <= entryDue)) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }
}
