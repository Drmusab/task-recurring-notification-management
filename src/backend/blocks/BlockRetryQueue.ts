/**
 * BlockRetryQueue — Exponential backoff retry for failed block API operations
 *
 * When a block attribute write or read fails (network, kernel restart, etc.),
 * the operation is enqueued here and retried with exponential backoff.
 *
 * Configuration uses canonical constants from misc-constants:
 *   MAX_SYNC_RETRIES (3), RETRY_DELAYS [1s, 5s, 30s], processor interval 10s
 *
 * Lifecycle:
 *   - start() → called in onLayoutReady() after runtime bridge
 *   - stop()  → called in onunload() before storage flush
 */

import * as logger from "@backend/logging/logger";
import {
  MAX_SYNC_RETRIES,
  RETRY_DELAYS,
  SYNC_RETRY_PROCESSOR_INTERVAL,
} from "@shared/constants/misc-constants";

// ── Types ───────────────────────────────────────────────────

export interface RetryableBlockAction {
  /** Unique ID for deduplication (typically `${blockId}:${operationType}`) */
  id: string;
  /** The async operation to retry */
  operation: () => Promise<void>;
  /** Number of retries already attempted */
  retryCount: number;
  /** Unix timestamp (ms) for next retry attempt */
  nextRetryAt: number;
  /** Context for logging / diagnostics */
  context: {
    blockId: string;
    taskId?: string;
    action: string;
  };
}

export interface BlockRetryQueueStats {
  pending: number;
  totalRetried: number;
  totalDropped: number;
}

// ── Implementation ──────────────────────────────────────────

export class BlockRetryQueue {
  private queue = new Map<string, RetryableBlockAction>();
  private processorTimer: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private totalRetried = 0;
  private totalDropped = 0;

  private readonly maxRetries: number;
  private readonly retryDelays: readonly number[];
  private readonly processorIntervalMs: number;

  constructor(options?: {
    maxRetries?: number;
    retryDelays?: readonly number[];
    processorIntervalMs?: number;
  }) {
    this.maxRetries = options?.maxRetries ?? MAX_SYNC_RETRIES;
    this.retryDelays = options?.retryDelays ?? RETRY_DELAYS;
    this.processorIntervalMs = options?.processorIntervalMs ?? SYNC_RETRY_PROCESSOR_INTERVAL;
  }

  /**
   * Start the periodic retry processor.
   * Call after onLayoutReady() when block API is available.
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    this.processorTimer = setInterval(() => {
      this.processQueue().catch((err) => {
        logger.error("[BlockRetryQueue] Processor cycle failed", err);
      });
    }, this.processorIntervalMs);

    logger.info("[BlockRetryQueue] Started", {
      maxRetries: this.maxRetries,
      intervalMs: this.processorIntervalMs,
    });
  }

  /**
   * Stop the retry processor and clear all pending actions.
   * Call in onunload().
   */
  stop(): void {
    this.active = false;
    if (this.processorTimer !== null) {
      clearInterval(this.processorTimer);
      this.processorTimer = null;
    }

    const dropped = this.queue.size;
    if (dropped > 0) {
      logger.warn("[BlockRetryQueue] Stopped with pending actions", {
        dropped,
        totalRetried: this.totalRetried,
        totalDropped: this.totalDropped + dropped,
      });
    }

    this.queue.clear();
    logger.info("[BlockRetryQueue] Stopped");
  }

  /**
   * Enqueue a failed operation for retry.
   * If an action with the same ID is already queued, it's replaced (latest wins).
   */
  enqueue(
    id: string,
    operation: () => Promise<void>,
    context: RetryableBlockAction["context"]
  ): void {
    if (!this.active) {
      logger.warn("[BlockRetryQueue] Enqueue rejected — queue not active", { id });
      return;
    }

    const existing = this.queue.get(id);
    const retryCount = existing ? existing.retryCount : 0;

    if (retryCount >= this.maxRetries) {
      this.totalDropped++;
      logger.error("[BlockRetryQueue] Max retries exceeded — dropping action", {
        id,
        retryCount,
        context,
      });
      this.queue.delete(id);
      return;
    }

    const delayIndex = Math.min(retryCount, this.retryDelays.length - 1);
    const delay = this.retryDelays[delayIndex] ?? 30000;

    this.queue.set(id, {
      id,
      operation,
      retryCount,
      nextRetryAt: Date.now() + delay,
      context,
    });

    logger.debug("[BlockRetryQueue] Action enqueued", {
      id,
      retryCount,
      nextRetryIn: delay,
      context,
    });
  }

  /**
   * Process all due actions in the queue.
   * Each action is attempted once per cycle. On failure, retryCount increments
   * and it stays in the queue for the next cycle (with increased delay).
   */
  private async processQueue(): Promise<void> {
    if (!this.active || this.queue.size === 0) return;

    const now = Date.now();
    const due: RetryableBlockAction[] = [];

    for (const action of this.queue.values()) {
      if (action.nextRetryAt <= now) {
        due.push(action);
      }
    }

    if (due.length === 0) return;

    logger.debug("[BlockRetryQueue] Processing due actions", { count: due.length });

    for (const action of due) {
      try {
        await action.operation();
        // Success — remove from queue
        this.queue.delete(action.id);
        this.totalRetried++;

        logger.info("[BlockRetryQueue] Retry succeeded", {
          id: action.id,
          attempt: action.retryCount + 1,
          context: action.context,
        });
      } catch (err) {
        const nextCount = action.retryCount + 1;

        if (nextCount >= this.maxRetries) {
          // Exhausted — drop the action
          this.queue.delete(action.id);
          this.totalDropped++;
          logger.error("[BlockRetryQueue] Retry exhausted — action dropped", {
            id: action.id,
            attempts: nextCount,
            context: action.context,
            error: err,
          });
        } else {
          // Re-enqueue with incremented count
          const delayIndex = Math.min(nextCount, this.retryDelays.length - 1);
          const delay = this.retryDelays[delayIndex] ?? 30000;

          this.queue.set(action.id, {
            ...action,
            retryCount: nextCount,
            nextRetryAt: Date.now() + delay,
          });

          logger.warn("[BlockRetryQueue] Retry failed — will retry again", {
            id: action.id,
            attempt: nextCount,
            nextRetryIn: delay,
            context: action.context,
          });
        }
      }
    }
  }

  /** Number of actions currently waiting for retry */
  get pendingCount(): number {
    return this.queue.size;
  }

  /** Diagnostic stats */
  get stats(): BlockRetryQueueStats {
    return {
      pending: this.queue.size,
      totalRetried: this.totalRetried,
      totalDropped: this.totalDropped,
    };
  }

  /** Check if a specific action is already queued */
  has(id: string): boolean {
    return this.queue.has(id);
  }
}
