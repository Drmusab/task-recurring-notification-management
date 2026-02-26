/**
 * IntegrationDispatcher — HTTP Webhook Delivery Engine
 *
 * Drains the WebhookQueue and delivers each item via HTTP POST.
 * Handles HMAC signing via SignatureGenerator, tracks deliveries
 * via RetryManager, and emits frontend-reactive events.
 *
 * This is the ONLY component that makes outbound HTTP requests.
 * All validation happens upstream in OutboundWebhookEmitter.
 *
 * Flow:
 *   WebhookQueue.drain() → IntegrationDispatcher.fire()
 *     → SignatureGenerator.signWithContext()
 *     → HTTP POST
 *     → RetryManager.track()
 *     → EventBus.emit("task:webhook:fired")
 *
 * AI urgency rule:
 *   Webhook retry MUST NOT trigger SmartSuggestionEngine.increaseUrgency().
 *   The RetryManager emits task:webhook:retry (NOT task:escalated),
 *   so PatternLearner will not see a false urgency spike.
 *
 * FORBIDDEN:
 *   - Validate tasks (upstream responsibility)
 *   - Import frontend / Svelte
 *   - Fire after plugin.onunload()
 *   - Trigger AI escalation on retry
 */

import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { WebhookEvent } from "@backend/events/types/EventTypes";
import type { SignatureGenerator, SignatureContext } from "./SignatureGenerator";
import type { RetryManager, DeliveryRecord } from "./RetryManager";
import type { WebhookQueue, WebhookQueueItem, WebhookDeliveryTarget } from "./WebhookQueue";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface IntegrationDispatcherDeps {
  pluginEventBus: PluginEventBus;
  signatureGenerator: SignatureGenerator;
  retryManager: RetryManager;
  webhookQueue: WebhookQueue;
  /** Injectable fetch (default: globalThis.fetch) */
  fetcher?: typeof fetch;
}

export interface DispatchBatchResult {
  /** Total items drained from queue */
  drained: number;
  /** Successful deliveries */
  dispatched: number;
  /** Failed deliveries (queued for retry) */
  failed: number;
  /** Duration in milliseconds */
  durationMs: number;
}

export interface IntegrationDispatcherStats {
  totalDrained: number;
  totalDispatched: number;
  totalFailed: number;
  totalBatches: number;
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 10_000; // 10 seconds per request
const USER_AGENT = "SiYuan-TaskPlugin-Webhook/2.0";
const MAX_DRAIN_PER_BATCH = 50; // prevent queue starvation

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class IntegrationDispatcher {
  private readonly eventBus: PluginEventBus;
  private readonly sigGen: SignatureGenerator;
  private readonly retryManager: RetryManager;
  private readonly queue: WebhookQueue;
  private readonly fetcher: typeof fetch;

  private active = false;

  // Stats
  private totalDrained = 0;
  private totalDispatched = 0;
  private totalFailed = 0;
  private totalBatches = 0;

  constructor(deps: IntegrationDispatcherDeps) {
    this.eventBus = deps.pluginEventBus;
    this.sigGen = deps.signatureGenerator;
    this.retryManager = deps.retryManager;
    this.queue = deps.webhookQueue;
    this.fetcher = deps.fetcher ?? globalThis.fetch?.bind(globalThis);
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[IntegrationDispatcher] Started — ready to deliver webhooks");
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    logger.info("[IntegrationDispatcher] Stopped", this.getStats());
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Drain the WebhookQueue and deliver all pending items.
   *
   * Each item is delivered to all its targets via HTTP POST.
   * Successful deliveries are tracked; failures go to RetryManager.
   */
  async fire(): Promise<DispatchBatchResult> {
    if (!this.active) {
      return { drained: 0, dispatched: 0, failed: 0, durationMs: 0 };
    }

    const startMs = Date.now();
    const items = this.queue.drain(MAX_DRAIN_PER_BATCH);

    if (items.length === 0) {
      return { drained: 0, dispatched: 0, failed: 0, durationMs: 0 };
    }

    this.totalBatches++;
    this.totalDrained += items.length;

    let dispatched = 0;
    let failed = 0;

    for (const item of items) {
      for (const target of item.targets) {
        const success = await this.deliverToTarget(item, target);
        if (success) {
          dispatched++;
          this.totalDispatched++;
        } else {
          failed++;
          this.totalFailed++;
        }
      }
    }

    const durationMs = Date.now() - startMs;

    logger.debug("[IntegrationDispatcher] Batch complete", {
      drained: items.length,
      dispatched,
      failed,
      durationMs,
    });

    return { drained: items.length, dispatched, failed, durationMs };
  }

  /**
   * Retry a previously failed delivery (called by RetryManager).
   *
   * Uses the stored DeliveryRecord to reconstruct and re-send the request.
   * MUST NOT trigger AI urgency escalation.
   */
  async retry(record: DeliveryRecord): Promise<boolean> {
    if (!this.active) return false;

    try {
      const body = JSON.stringify(record.event);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-Webhook-Event": record.event.event,
        "X-Webhook-Delivery": record.deliveryId,
        "X-Webhook-Timestamp": record.event.timestamp,
        "X-Webhook-Retry": String(record.attempts),
        // Flag to downstream systems: this is a retry, do NOT escalate AI urgency
        "X-Webhook-AI-Guarded": "true",
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await this.fetcher(record.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const success = response.ok;

      if (success) {
        this.totalDispatched++;
        logger.debug("[IntegrationDispatcher] Retry succeeded", {
          deliveryId: record.deliveryId,
          attempt: record.attempts,
        });
      }

      return success;
    } catch (err) {
      logger.warn("[IntegrationDispatcher] Retry delivery failed", {
        deliveryId: record.deliveryId,
        attempt: record.attempts,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Get dispatcher statistics.
   */
  getStats(): IntegrationDispatcherStats {
    return {
      totalDrained: this.totalDrained,
      totalDispatched: this.totalDispatched,
      totalFailed: this.totalFailed,
      totalBatches: this.totalBatches,
    };
  }

  // ── Internal ─────────────────────────────────────────────────

  /**
   * Deliver a single queue item to a single target.
   */
  private async deliverToTarget(
    item: WebhookQueueItem,
    target: WebhookDeliveryTarget,
  ): Promise<boolean> {
    const deliveryId = item.id;
    const body = JSON.stringify(item.event);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-Webhook-Event": item.event.event,
        "X-Webhook-Delivery": deliveryId,
        "X-Webhook-Timestamp": item.event.timestamp,
      };

      // ── HMAC-SHA256 signature if secret is provided ──
      if (target.secret) {
        const sigCtx: SignatureContext = {
          taskId: item.taskId,
          dueAt: (item.event as { payload?: { dueDate?: string } }).payload?.dueDate ?? "",
          recurrenceInstance: item.recurrenceInstance,
        };
        const signed = await this.sigGen.signWithContext(body, target.secret, sigCtx);
        const sigHeaders = this.sigGen.buildSignatureHeaders(signed);
        Object.assign(headers, sigHeaders);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await this.fetcher(target.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const success = response.ok;

      // ── Track in RetryManager ──
      this.retryManager.track(
        deliveryId,
        item.taskId,
        item.event,
        target.url,
        success,
        item.blockId,
        success ? undefined : `HTTP ${response.status} ${response.statusText}`,
      );

      if (!success) {
        logger.warn("[IntegrationDispatcher] Delivery failed", {
          deliveryId,
          taskId: item.taskId,
          url: target.url,
          status: response.status,
        });
      }

      return success;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Track failure for retry
      this.retryManager.track(
        deliveryId,
        item.taskId,
        item.event,
        target.url,
        false,
        item.blockId,
        errorMsg,
      );

      logger.warn("[IntegrationDispatcher] Delivery exception", {
        deliveryId,
        taskId: item.taskId,
        url: target.url,
        error: errorMsg,
      });

      return false;
    }
  }
}
