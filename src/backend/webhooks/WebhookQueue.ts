/**
 * WebhookQueue — Priority-Sorted Webhook Delivery Queue
 *
 * Queues webhook deliveries for batch dispatch by IntegrationDispatcher.
 * Provides deduplication by dedup key, priority sorting, and max capacity.
 *
 * Priority levels (lower number = higher priority):
 *   1 — task.escalated
 *   2 — task.overdue
 *   3 — task.due / default
 *   4 — task.completed / notification.sent
 *
 * Integration:
 *   OutboundWebhookEmitter.emit() → WebhookQueue.enqueue()
 *   IntegrationDispatcher.fire() → WebhookQueue.drain()
 *
 * Dedup rule:
 *   Two items with the same deduplicationKey (taskId::dueAt::instance)
 *   are considered duplicates. Only the first is enqueued.
 *
 * Capacity:
 *   Max 500 items. Oldest low-priority items are dropped when full.
 *
 * FORBIDDEN:
 *   - Make HTTP requests (delegate to IntegrationDispatcher)
 *   - Import frontend / Svelte
 *   - Hold mutable task references (only IDs + event payloads)
 *   - Access DOM
 */

import type { WebhookEvent, EventType } from "@backend/events/types/EventTypes";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface WebhookDeliveryTarget {
  /** Target URL */
  url: string;
  /** HMAC secret for signing (optional) */
  secret?: string;
  /** Registration ID */
  registrationId?: string;
}

export interface WebhookQueueItem {
  /** Unique item ID */
  id: string;
  /** Task ID this delivery relates to */
  taskId: string;
  /** SiYuan block ID (if block-linked) */
  blockId?: string;
  /** Mapped webhook event payload */
  event: WebhookEvent;
  /** Delivery targets */
  targets: WebhookDeliveryTarget[];
  /** Dedup key: taskId::dueAt::recurrenceInstance */
  deduplicationKey: string;
  /** Priority: 1=highest → 5=lowest */
  priority: number;
  /** ISO-8601 enqueue timestamp */
  enqueuedAt: string;
  /** Resolved recurrence instance identifier (if recurring) */
  recurrenceInstance?: string;
}

export interface WebhookQueueStats {
  size: number;
  totalEnqueued: number;
  totalDequeued: number;
  totalDropped: number;
  totalDeduplicated: number;
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const MAX_QUEUE_SIZE = 500;

const PRIORITY_ESCALATED = 1;
const PRIORITY_OVERDUE = 2;
const PRIORITY_DUE = 3;
const PRIORITY_COMPLETED = 4;
const PRIORITY_DEFAULT = 3;

/** Map WebhookEvent.event → queue priority */
const EVENT_PRIORITY_MAP: Record<string, number> = {
  "task.escalated": PRIORITY_ESCALATED,
  "task.escalation.resolved": PRIORITY_ESCALATED,
  "task.overdue": PRIORITY_OVERDUE,
  "task.due": PRIORITY_DUE,
  "task.completed": PRIORITY_COMPLETED,
  "task.created": PRIORITY_DEFAULT,
  "task.updated": PRIORITY_DEFAULT,
  "task.deleted": PRIORITY_DEFAULT,
  "notification.sent": PRIORITY_COMPLETED,
  "recurrence.paused": PRIORITY_DEFAULT,
  "recurrence.resumed": PRIORITY_DEFAULT,
  "recurrence.regenerated": PRIORITY_DEFAULT,
  "recurrence.skipped": PRIORITY_DEFAULT,
};

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class WebhookQueue {
  private queue: WebhookQueueItem[] = [];
  private readonly dedupSet: Set<string> = new Set();
  private active = false;

  // Stats
  private totalEnqueued = 0;
  private totalDequeued = 0;
  private totalDropped = 0;
  private totalDeduplicated = 0;

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[WebhookQueue] Started");
  }

  stop(): void {
    if (!this.active) return;
    const stats = this.getStats();
    this.queue = [];
    this.dedupSet.clear();
    this.active = false;
    logger.info("[WebhookQueue] Stopped", stats);
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Enqueue a webhook delivery item.
   *
   * @returns true if enqueued, false if deduplicated or dropped
   */
  enqueue(item: WebhookQueueItem): boolean {
    if (!this.active) return false;

    // ── Dedup check ──
    if (this.dedupSet.has(item.deduplicationKey)) {
      this.totalDeduplicated++;
      logger.debug("[WebhookQueue] Deduplicated", {
        taskId: item.taskId,
        key: item.deduplicationKey,
      });
      return false;
    }

    // ── Capacity check — drop lowest-priority if full ──
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      const evicted = this.evictLowestPriority();
      if (!evicted) {
        this.totalDropped++;
        logger.warn("[WebhookQueue] Queue full — dropping item", {
          taskId: item.taskId,
          size: this.queue.length,
        });
        return false;
      }
    }

    // ── Auto-assign priority from event type if not set ──
    if (!item.priority || item.priority <= 0) {
      item.priority = EVENT_PRIORITY_MAP[item.event.event] ?? PRIORITY_DEFAULT;
    }

    // ── Insert in priority order (lower number = higher priority) ──
    const insertIdx = this.findInsertIndex(item.priority);
    this.queue.splice(insertIdx, 0, item);
    this.dedupSet.add(item.deduplicationKey);
    this.totalEnqueued++;

    logger.debug("[WebhookQueue] Enqueued", {
      taskId: item.taskId,
      event: item.event.event,
      priority: item.priority,
      queueSize: this.queue.length,
    });

    return true;
  }

  /**
   * Drain up to maxItems from the queue (highest priority first).
   *
   * @param maxItems  Max items to return (default: all)
   * @returns         Array of queue items, ordered by priority
   */
  drain(maxItems?: number): WebhookQueueItem[] {
    if (!this.active || this.queue.length === 0) return [];

    const count = maxItems
      ? Math.min(maxItems, this.queue.length)
      : this.queue.length;

    const items = this.queue.splice(0, count);
    for (const item of items) {
      this.dedupSet.delete(item.deduplicationKey);
    }
    this.totalDequeued += items.length;

    return items;
  }

  /**
   * Peek at the next item without removing.
   */
  peek(): WebhookQueueItem | null {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  /**
   * Check if a task has a pending webhook in the queue.
   */
  has(taskId: string): boolean {
    return this.queue.some((item) => item.taskId === taskId);
  }

  /**
   * Remove all pending webhooks for a task.
   *
   * @returns Number of items removed
   */
  remove(taskId: string): number {
    const before = this.queue.length;
    this.queue = this.queue.filter((item) => {
      if (item.taskId === taskId) {
        this.dedupSet.delete(item.deduplicationKey);
        return false;
      }
      return true;
    });
    return before - this.queue.length;
  }

  /**
   * Current queue size.
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get queue statistics.
   */
  getStats(): WebhookQueueStats {
    return {
      size: this.queue.length,
      totalEnqueued: this.totalEnqueued,
      totalDequeued: this.totalDequeued,
      totalDropped: this.totalDropped,
      totalDeduplicated: this.totalDeduplicated,
    };
  }

  // ── Internal ─────────────────────────────────────────────────

  /**
   * Find insertion index to maintain priority order.
   */
  private findInsertIndex(priority: number): number {
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority > priority) return i;
    }
    return this.queue.length;
  }

  /**
   * Evict the lowest-priority (highest number) item from the queue.
   *
   * @returns true if an item was evicted
   */
  private evictLowestPriority(): boolean {
    if (this.queue.length === 0) return false;

    // Last item has lowest priority (queue is sorted ascending)
    const evicted = this.queue.pop();
    if (evicted) {
      this.dedupSet.delete(evicted.deduplicationKey);
      this.totalDropped++;
      logger.warn("[WebhookQueue] Evicted lowest-priority item", {
        taskId: evicted.taskId,
        priority: evicted.priority,
      });
      return true;
    }
    return false;
  }
}
