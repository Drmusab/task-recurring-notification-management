/**
 * EventQueue — Ordered, deduplicated event queue for the Engine Runtime
 *
 * All scheduler/recurrence events pass through EventQueue before reaching
 * PluginEventBus. This provides:
 *  1. Ordering: events are emitted in enqueue order within the same tick
 *  2. Deduplication: same (type, taskId) within a window is dropped
 *  3. Retry: failed emissions are retried once on next tick
 *  4. Backpressure: queue depth is capped to prevent memory leaks
 *
 * Integration:
 *   Scheduler.checkDueTasks() → EventQueue.enqueue() → PluginEventBus.emit()
 *
 * FORBIDDEN:
 *  - import frontend / Svelte
 *  - bypass this queue from engine code
 *  - hold task references (only IDs + event data)
 */

import type { PluginEventBus, PluginEventMap } from "@backend/core/events/PluginEventBus";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface QueuedEvent<K extends keyof PluginEventMap = keyof PluginEventMap> {
  type: K;
  data: PluginEventMap[K];
  /** ISO timestamp when enqueued */
  enqueuedAt: string;
  /** Dedup key: `${type}:${taskId}` or `${type}:${custom}` */
  dedupKey: string;
  /** Number of times emission has been attempted */
  attempts: number;
}

export interface EventQueueStats {
  /** Current queue depth */
  depth: number;
  /** Total events enqueued since start */
  totalEnqueued: number;
  /** Total events flushed (successfully emitted) */
  totalFlushed: number;
  /** Total events dropped (dedup or overflow) */
  totalDropped: number;
  /** Total retry attempts */
  totalRetries: number;
}

export interface EventQueueDeps {
  pluginEventBus: PluginEventBus;
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

/** Maximum queue depth before oldest events are evicted */
const MAX_QUEUE_DEPTH = 500;

/** Dedup window in ms — events with same dedupKey within this window are dropped */
const DEDUP_WINDOW_MS = 5_000;

/** Max retry attempts per event */
const MAX_RETRY_ATTEMPTS = 2;

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class EventQueue {
  private readonly eventBus: PluginEventBus;
  private queue: QueuedEvent[] = [];
  private recentKeys: Map<string, number> = new Map(); // dedupKey → timestamp

  // Stats
  private totalEnqueued = 0;
  private totalFlushed = 0;
  private totalDropped = 0;
  private totalRetries = 0;

  private active = false;

  constructor(deps: EventQueueDeps) {
    this.eventBus = deps.pluginEventBus;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[EventQueue] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    // Flush remaining events before shutdown
    this.flush();
    this.queue = [];
    this.recentKeys.clear();
    logger.info("[EventQueue] Stopped", {
      totalEnqueued: this.totalEnqueued,
      totalFlushed: this.totalFlushed,
      totalDropped: this.totalDropped,
    });
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Enqueue an event for emission. Events are deduped by (type, taskId).
   *
   * @param type    PluginEventMap key
   * @param data    Event payload
   * @param dedupId Optional custom dedup ID (defaults to `taskId` if present)
   */
  enqueue<K extends keyof PluginEventMap>(
    type: K,
    data: PluginEventMap[K],
    dedupId?: string
  ): void {
    if (!this.active) return;

    const id = dedupId ?? (data && typeof data === "object" && "taskId" in data
      ? (data as { taskId: string }).taskId
      : "");
    const dedupKey = `${String(type)}:${id}`;

    // Dedup check
    const now = Date.now();
    const lastSeen = this.recentKeys.get(dedupKey);
    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
      this.totalDropped++;
      return;
    }
    this.recentKeys.set(dedupKey, now);

    // Overflow check
    if (this.queue.length >= MAX_QUEUE_DEPTH) {
      this.queue.shift(); // evict oldest
      this.totalDropped++;
      logger.warn("[EventQueue] Queue overflow, evicted oldest event");
    }

    this.queue.push({
      type,
      data,
      enqueuedAt: new Date(now).toISOString(),
      dedupKey,
      attempts: 0,
    });
    this.totalEnqueued++;
  }

  /**
   * Flush all queued events to PluginEventBus.
   * Called once per scheduler tick after all tasks are processed.
   */
  flush(): void {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0);
    const retry: QueuedEvent[] = [];

    for (const evt of batch) {
      try {
        this.eventBus.emit(evt.type, evt.data as PluginEventMap[typeof evt.type]);
        this.totalFlushed++;
      } catch (err) {
        evt.attempts++;
        if (evt.attempts < MAX_RETRY_ATTEMPTS) {
          retry.push(evt);
          this.totalRetries++;
          logger.warn("[EventQueue] Event emission failed, will retry", {
            type: evt.type,
            dedupKey: evt.dedupKey,
            attempt: evt.attempts,
          });
        } else {
          this.totalDropped++;
          logger.error("[EventQueue] Event dropped after max retries", {
            type: evt.type,
            dedupKey: evt.dedupKey,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Re-enqueue retries at front
    if (retry.length > 0) {
      this.queue.unshift(...retry);
    }

    // Prune stale dedup keys
    this.pruneRecentKeys();
  }

  // ── Stats ────────────────────────────────────────────────────

  getStats(): EventQueueStats {
    return {
      depth: this.queue.length,
      totalEnqueued: this.totalEnqueued,
      totalFlushed: this.totalFlushed,
      totalDropped: this.totalDropped,
      totalRetries: this.totalRetries,
    };
  }

  // ── Internals ────────────────────────────────────────────────

  private pruneRecentKeys(): void {
    const cutoff = Date.now() - DEDUP_WINDOW_MS * 2;
    for (const [key, ts] of this.recentKeys) {
      if (ts < cutoff) {
        this.recentKeys.delete(key);
      }
    }
  }
}
