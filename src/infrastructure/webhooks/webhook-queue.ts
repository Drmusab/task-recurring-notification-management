/**
 * webhook-queue.ts — Persistent Webhook Delivery Queue
 *
 * Priority queue for outbound webhook deliveries with:
 *  - Deduplication by key
 *  - Priority ordering (lower number = higher priority)
 *  - Capacity limits with eviction
 *  - Plugin storage persistence
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Manages delivery queue state
 *   ✔ Persists to SiYuan plugin storage
 *   ✔ Thread-safe dequeue via drain()
 *   ❌ No HTTP calls
 *   ❌ No frontend imports
 */

import type {
  QueuedDelivery,
  WebhookPayload,
  WebhookEndpoint,
  DeliveryStatus,
} from "./webhook-types";
import { WEBHOOK_QUEUE_KEY } from "./webhook-types";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Priority mapping for event types (lower = higher priority). */
const EVENT_PRIORITY: Record<string, number> = {
  "task.escalated": 1,
  "task.overdue": 2,
  "task.missed": 2,
  "task.due": 3,
  "reminder.triggered": 3,
  "task.completed": 4,
  "task.created": 4,
  "task.rescheduled": 4,
  "task.updated": 5,
  "task.deleted": 5,
  "recurring.triggered": 4,
  "test.ping": 6,
};

/** Queue configuration. */
export interface WebhookQueueConfig {
  /** Maximum items in the queue (default: 500) */
  readonly maxSize: number;
  /** Maximum batch size for drain operations (default: 50) */
  readonly drainBatchSize: number;
}

export const DEFAULT_QUEUE_CONFIG: WebhookQueueConfig = {
  maxSize: 500,
  drainBatchSize: 50,
};

/** Storage adapter interface for persistence. */
export interface QueueStorageAdapter {
  load(): Promise<QueuedDelivery[]>;
  save(items: QueuedDelivery[]): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════
// Queue Implementation
// ═══════════════════════════════════════════════════════════════

/**
 * Persistent webhook delivery queue.
 *
 * Items are ordered by priority (escalated > overdue > due > completed > other)
 * then by enqueue time (FIFO within same priority).
 *
 * Deduplication uses the payload's `delivery.dedupeKey`. If an item with the
 * same key is already queued, the newer item is silently dropped.
 */
export class WebhookQueue {
  private items: QueuedDelivery[] = [];
  private readonly dedupeSet = new Set<string>();
  private readonly config: WebhookQueueConfig;
  private readonly storage: QueueStorageAdapter | null;
  private dirty = false;

  constructor(
    storage: QueueStorageAdapter | null = null,
    config: Partial<WebhookQueueConfig> = {},
  ) {
    this.storage = storage;
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Load queue state from persistent storage.
   * Call once during initialization.
   */
  async initialize(): Promise<void> {
    if (!this.storage) return;

    try {
      const stored = await this.storage.load();
      if (Array.isArray(stored)) {
        // Only restore pending items
        this.items = stored.filter(
          (item) => item.status === "pending" || item.status === "rate_limited",
        );
        this.rebuildDedupeSet();
        this.sortQueue();
      }
    } catch (err) {
      console.error("[WebhookQueue] Failed to load from storage:", err);
      this.items = [];
    }
  }

  /**
   * Persist current queue state to storage.
   * Call periodically or after mutations.
   */
  async persist(): Promise<void> {
    if (!this.storage || !this.dirty) return;

    try {
      await this.storage.save([...this.items]);
      this.dirty = false;
    } catch (err) {
      console.error("[WebhookQueue] Failed to persist:", err);
    }
  }

  /**
   * Shut down the queue. Persists and clears in-memory state.
   */
  async shutdown(): Promise<void> {
    await this.persist();
    this.items = [];
    this.dedupeSet.clear();
    this.dirty = false;
  }

  // ─── Enqueue ────────────────────────────────────────────────

  /**
   * Enqueue a delivery for a specific endpoint.
   *
   * @returns The queued delivery, or `null` if deduplicated/dropped
   */
  enqueue(payload: WebhookPayload, endpoint: WebhookEndpoint): QueuedDelivery | null {
    const dedupeKey = payload.delivery.dedupeKey;

    // Dedup check
    if (this.dedupeSet.has(`${endpoint.id}:${dedupeKey}`)) {
      return null;
    }

    // Capacity check — evict lowest-priority item if full
    if (this.items.length >= this.config.maxSize) {
      const evicted = this.evictLowestPriority(payload.event);
      if (!evicted) {
        // New item has lower priority than everything in queue — drop it
        return null;
      }
    }

    const now = new Date().toISOString();
    const delivery: QueuedDelivery = {
      id: payload.delivery.eventId,
      endpointId: endpoint.id,
      url: endpoint.url,
      payload,
      status: "pending",
      attempts: 0,
      enqueuedAt: now,
      nextRetryAt: now,
      lastAttemptAt: null,
      lastStatusCode: null,
      lastError: null,
    };

    this.items.push(delivery);
    this.dedupeSet.add(`${endpoint.id}:${dedupeKey}`);
    this.sortQueue();
    this.dirty = true;

    return delivery;
  }

  // ─── Drain (Dequeue Batch) ──────────────────────────────────

  /**
   * Drain up to `batchSize` pending deliveries that are ready.
   *
   * "Ready" means: status = "pending" AND nextRetryAt <= now.
   *
   * Items are NOT removed from the queue — their status is updated
   * to indicate they are being processed. Call `markDelivered()` or
   * `markFailed()` after delivery attempt.
   */
  drain(batchSize?: number): QueuedDelivery[] {
    const limit = batchSize ?? this.config.drainBatchSize;
    const now = Date.now();
    const ready: QueuedDelivery[] = [];

    for (const item of this.items) {
      if (ready.length >= limit) break;
      if (item.status !== "pending" && item.status !== "rate_limited") continue;
      if (new Date(item.nextRetryAt).getTime() > now) continue;
      ready.push(item);
    }

    return ready;
  }

  // ─── Status Updates ─────────────────────────────────────────

  /**
   * Mark a delivery as successfully delivered.
   * Removes it from the queue.
   */
  markDelivered(deliveryId: string, statusCode: number): void {
    const index = this.items.findIndex((item) => item.id === deliveryId);
    if (index === -1) return;

    const item = this.items[index]!;
    this.dedupeSet.delete(`${item.endpointId}:${item.payload.delivery.dedupeKey}`);
    this.items.splice(index, 1);
    this.dirty = true;
  }

  /**
   * Mark a delivery attempt as failed.
   * Updates attempt count and schedules retry (if applicable).
   */
  markFailed(
    deliveryId: string,
    statusCode: number | null,
    error: string,
    nextRetryAt: string | null,
  ): void {
    const item = this.items.find((i) => i.id === deliveryId);
    if (!item) return;

    item.attempts += 1;
    item.lastAttemptAt = new Date().toISOString();
    item.lastStatusCode = statusCode;
    item.lastError = error;

    if (nextRetryAt) {
      item.status = "pending";
      item.nextRetryAt = nextRetryAt;
    } else {
      // No more retries — abandon
      item.status = "abandoned";
    }

    this.dirty = true;
  }

  /**
   * Mark a delivery as rate-limited.
   * Sets the next retry time based on the rate limiter's retry-after.
   */
  markRateLimited(deliveryId: string, retryAfterMs: number): void {
    const item = this.items.find((i) => i.id === deliveryId);
    if (!item) return;

    item.status = "rate_limited";
    item.nextRetryAt = new Date(Date.now() + retryAfterMs).toISOString();
    this.dirty = true;
  }

  /**
   * Remove all abandoned deliveries from the queue.
   */
  pruneAbandoned(): number {
    const before = this.items.length;
    const pruned = this.items.filter(
      (item) => item.status !== "abandoned" && item.status !== "failed",
    );
    const removed = before - pruned.length;

    if (removed > 0) {
      this.items = pruned;
      this.rebuildDedupeSet();
      this.dirty = true;
    }

    return removed;
  }

  // ─── Queries ────────────────────────────────────────────────

  /** Get current queue size. */
  get size(): number {
    return this.items.length;
  }

  /** Get count of pending (ready or scheduled) deliveries. */
  get pendingCount(): number {
    return this.items.filter(
      (item) => item.status === "pending" || item.status === "rate_limited",
    ).length;
  }

  /** Check if a specific delivery is in the queue. */
  has(deliveryId: string): boolean {
    return this.items.some((item) => item.id === deliveryId);
  }

  /** Check if a dedup key is already queued for a given endpoint. */
  isDuplicate(endpointId: string, dedupeKey: string): boolean {
    return this.dedupeSet.has(`${endpointId}:${dedupeKey}`);
  }

  /** Get a snapshot of queue items (for diagnostics). */
  snapshot(): readonly QueuedDelivery[] {
    return [...this.items];
  }

  /** Get queue items for a specific endpoint. */
  forEndpoint(endpointId: string): QueuedDelivery[] {
    return this.items.filter((item) => item.endpointId === endpointId);
  }

  /**
   * Remove all queued deliveries for an endpoint.
   * Used when an endpoint is deleted or disabled.
   */
  removeEndpoint(endpointId: string): number {
    const before = this.items.length;
    this.items = this.items.filter((item) => item.endpointId !== endpointId);
    const removed = before - this.items.length;

    if (removed > 0) {
      this.rebuildDedupeSet();
      this.dirty = true;
    }

    return removed;
  }

  /** Clear the entire queue. */
  clear(): void {
    this.items = [];
    this.dedupeSet.clear();
    this.dirty = true;
  }

  // ─── Internal ───────────────────────────────────────────────

  /** Sort queue by priority then by enqueue time. */
  private sortQueue(): void {
    this.items.sort((a, b) => {
      const prioA = EVENT_PRIORITY[a.payload.event] ?? 5;
      const prioB = EVENT_PRIORITY[b.payload.event] ?? 5;
      if (prioA !== prioB) return prioA - prioB;
      return a.enqueuedAt.localeCompare(b.enqueuedAt);
    });
  }

  /** Rebuild the dedup set from current items. */
  private rebuildDedupeSet(): void {
    this.dedupeSet.clear();
    for (const item of this.items) {
      if (item.status === "pending" || item.status === "rate_limited") {
        this.dedupeSet.add(`${item.endpointId}:${item.payload.delivery.dedupeKey}`);
      }
    }
  }

  /**
   * Evict the lowest-priority item to make room.
   * Returns `true` if eviction succeeded, `false` if the new item
   * is lower priority than everything in the queue.
   */
  private evictLowestPriority(newEventType: string): boolean {
    const newPriority = EVENT_PRIORITY[newEventType] ?? 5;

    // Find the lowest-priority item (last after sort)
    const lastItem = this.items[this.items.length - 1];
    if (!lastItem) return true; // empty queue — allow
    const lastPriority = EVENT_PRIORITY[lastItem.payload.event] ?? 5;

    if (newPriority >= lastPriority) {
      // New item is same or lower priority — don't evict
      return false;
    }

    // Evict the last (lowest priority) item
    const evicted = this.items.pop()!;
    this.dedupeSet.delete(`${evicted.endpointId}:${evicted.payload.delivery.dedupeKey}`);
    this.dirty = true;

    return true;
  }
}

/**
 * Create a storage adapter using SiYuan plugin's loadData/saveData.
 */
export function createPluginStorageAdapter(
  loadData: (key: string) => Promise<unknown>,
  saveData: (key: string, data: unknown) => Promise<void>,
): QueueStorageAdapter {
  return {
    async load(): Promise<QueuedDelivery[]> {
      const data = await loadData(WEBHOOK_QUEUE_KEY);
      if (Array.isArray(data)) return data as QueuedDelivery[];
      return [];
    },
    async save(items: QueuedDelivery[]): Promise<void> {
      await saveData(WEBHOOK_QUEUE_KEY, items);
    },
  };
}
