/**
 * webhook-dispatcher.ts — HTTP Delivery Engine
 *
 * Handles the actual HTTP POST delivery of webhook payloads to endpoints.
 * Manages request construction, timeout, response parsing, and delivery tracking
 * through the queue and retry systems.
 *
 * Flow:
 *   WebhookQueue.drain()
 *     → WebhookDispatcher.deliverBatch()
 *       → for each: POST payload → record result → update queue
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Owns HTTP delivery lifecycle
 *   ✔ Coordinates queue, retry, and security subsystems
 *   ✔ Emits delivery events via EventBus
 *   ❌ No domain logic
 *   ❌ No frontend imports
 */

import type { EventBus } from "@events/EventBus";
import type {
  WebhookPayload,
  WebhookEndpoint,
  WebhookSettings,
  QueuedDelivery,
  WebhookTestResult,
  WebhookRetryPolicy,
} from "./webhook-types";
import { DEFAULT_RETRY_POLICY } from "./webhook-types";
import { WebhookQueue } from "./webhook-queue";
import { WebhookRetryManager, resolveRetryPolicy } from "./webhook-retry";
import { buildSignatureHeaders, WebhookRateLimiter, validateDomain } from "./webhook-security";
import { buildTestPingPayload } from "./webhook-events";

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

/** Dispatcher configuration. */
export interface DispatcherConfig {
  /** HTTP request timeout in milliseconds (default: 10000) */
  readonly timeoutMs: number;
  /** User-Agent header value */
  readonly userAgent: string;
  /** Maximum concurrent deliveries (default: 5) */
  readonly maxConcurrent: number;
  /** Flush interval in milliseconds (default: 5000) */
  readonly flushIntervalMs: number;
}

export const DEFAULT_DISPATCHER_CONFIG: DispatcherConfig = {
  timeoutMs: 10_000,
  userAgent: "SiYuan-TaskPlugin-Webhook/2.0",
  maxConcurrent: 5,
  flushIntervalMs: 5_000,
};

// ═══════════════════════════════════════════════════════════════
// Dispatcher
// ═══════════════════════════════════════════════════════════════

/**
 * HTTP webhook delivery engine.
 *
 * Drains the queue at regular intervals, delivers payloads via HTTP POST,
 * and records results through the retry manager.
 */
export class WebhookDispatcher {
  private readonly queue: WebhookQueue;
  private readonly retryManager: WebhookRetryManager;
  private readonly rateLimiter: WebhookRateLimiter;
  private readonly eventBus: EventBus | null;
  private readonly config: DispatcherConfig;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private activeDeliveries = 0;
  private endpointLookup: Map<string, WebhookEndpoint> = new Map();
  private defaultRetryPolicy: WebhookRetryPolicy = DEFAULT_RETRY_POLICY;
  private settings: Pick<WebhookSettings, "allowedDomains" | "allowLocalhost"> = {
    allowedDomains: [],
    allowLocalhost: false,
  };

  constructor(
    queue: WebhookQueue,
    retryManager: WebhookRetryManager,
    rateLimiter: WebhookRateLimiter,
    eventBus: EventBus | null = null,
    config: Partial<DispatcherConfig> = {},
  ) {
    this.queue = queue;
    this.retryManager = retryManager;
    this.rateLimiter = rateLimiter;
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_DISPATCHER_CONFIG, ...config };
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Start the periodic flush timer.
   * Call after queue and retry manager are initialized.
   */
  start(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.config.flushIntervalMs);

    console.log(
      `[WebhookDispatcher] Started (flush every ${this.config.flushIntervalMs}ms)`,
    );
  }

  /**
   * Stop the flush timer and wait for in-flight deliveries.
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Wait briefly for active deliveries to complete
    const maxWait = 5000;
    const start = Date.now();
    while (this.activeDeliveries > 0 && Date.now() - start < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("[WebhookDispatcher] Stopped");
  }

  /**
   * Update endpoint registry and settings.
   * Call whenever webhook settings change.
   */
  updateSettings(settings: WebhookSettings): void {
    this.endpointLookup.clear();
    for (const ep of settings.endpoints) {
      if (ep.enabled) {
        this.endpointLookup.set(ep.id, ep);
      }
    }
    this.defaultRetryPolicy = settings.defaultRetryPolicy;
    this.settings = {
      allowedDomains: settings.allowedDomains as string[],
      allowLocalhost: settings.allowLocalhost,
    };
    this.rateLimiter.updateRate(settings.rateLimitPerMinute);
  }

  // ─── Delivery ───────────────────────────────────────────────

  /**
   * Manual flush — drain the queue and deliver all ready items.
   */
  async flush(): Promise<number> {
    const batch = this.queue.drain();
    if (batch.length === 0) return 0;

    let delivered = 0;

    // Process sequentially to respect rate limits and concurrency
    for (const item of batch) {
      if (this.activeDeliveries >= this.config.maxConcurrent) {
        break; // Respect concurrency limit
      }

      const endpoint = this.endpointLookup.get(item.endpointId);
      if (!endpoint) {
        // Endpoint was removed — mark as abandoned
        this.queue.markFailed(item.id, null, "Endpoint not found", null);
        continue;
      }

      // Rate limit check
      if (!this.rateLimiter.tryConsume()) {
        const retryAfter = this.rateLimiter.getRetryAfterMs();
        this.queue.markRateLimited(item.id, retryAfter);
        continue;
      }

      this.activeDeliveries++;
      try {
        const success = await this.deliverSingle(item, endpoint);
        if (success) delivered++;
      } finally {
        this.activeDeliveries--;
      }
    }

    // Persist queue state after batch
    void this.queue.persist();
    void this.retryManager.persist();

    return delivered;
  }

  /**
   * Send a test ping to an endpoint (bypasses queue and rate limits).
   */
  async testEndpoint(endpoint: WebhookEndpoint): Promise<WebhookTestResult> {
    // Validate domain
    const domainResult = validateDomain(endpoint.url, this.settings);
    if (!domainResult.valid) {
      return {
        success: false,
        statusCode: null,
        responseBody: null,
        durationMs: 0,
        error: domainResult.reason ?? "Domain validation failed",
        timestamp: new Date().toISOString(),
      };
    }

    const payload = buildTestPingPayload();
    const body = JSON.stringify(payload);
    const startTime = performance.now();

    try {
      const headers = await this.buildHeaders(body, endpoint, payload);
      const response = await this.httpPost(endpoint.url, body, headers);
      const durationMs = Math.round(performance.now() - startTime);
      const responseBody = await this.safeReadBody(response);

      return {
        success: response.ok,
        statusCode: response.status,
        responseBody,
        durationMs,
        error: response.ok ? null : `HTTP ${response.status} ${response.statusText}`,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        statusCode: null,
        responseBody: null,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ─── Internal ───────────────────────────────────────────────

  /**
   * Deliver a single queued item.
   * @returns `true` if delivered successfully
   */
  private async deliverSingle(
    item: QueuedDelivery,
    endpoint: WebhookEndpoint,
  ): Promise<boolean> {
    const body = JSON.stringify(item.payload);
    const startTime = performance.now();

    try {
      const headers = await this.buildHeaders(body, endpoint, item.payload);
      const response = await this.httpPost(item.url, body, headers);
      const durationMs = Math.round(performance.now() - startTime);

      if (response.ok) {
        // Success
        this.retryManager.recordSuccess(item, endpoint, response.status, durationMs);
        this.queue.markDelivered(item.id, response.status);
        this.emitDeliveryEvent(item, endpoint, true);
        return true;
      }

      // HTTP error
      const errorMsg = `HTTP ${response.status} ${response.statusText}`;
      return this.handleFailure(item, endpoint, response.status, errorMsg, durationMs);
    } catch (err) {
      // Network error
      const durationMs = Math.round(performance.now() - startTime);
      const errorMsg = err instanceof Error ? err.message : String(err);
      return this.handleFailure(item, endpoint, null, errorMsg, durationMs);
    }
  }

  /**
   * Handle a delivery failure — determine retry or abandon.
   */
  private handleFailure(
    item: QueuedDelivery,
    endpoint: WebhookEndpoint,
    statusCode: number | null,
    error: string,
    durationMs: number,
  ): boolean {
    const policy = resolveRetryPolicy(endpoint, this.defaultRetryPolicy);
    const result = this.retryManager.recordFailure(
      item,
      endpoint,
      statusCode,
      error,
      durationMs,
      policy,
    );

    this.queue.markFailed(item.id, statusCode, error, result.nextRetryAt);

    if (!result.shouldRetry) {
      this.emitDeliveryEvent(item, endpoint, false);
    }

    return false;
  }

  /**
   * Build HTTP headers for a delivery.
   */
  private async buildHeaders(
    body: string,
    endpoint: WebhookEndpoint,
    payload: WebhookPayload,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": this.config.userAgent,
      "X-Webhook-Event": payload.event,
      "X-Event-ID": payload.delivery.eventId,
      ...endpoint.headers,
    };

    // Add HMAC signature if endpoint has a secret
    if (endpoint.secret) {
      const sigHeaders = await buildSignatureHeaders(body, endpoint, payload);
      Object.assign(headers, sigHeaders);
    }

    return headers;
  }

  /**
   * Perform the HTTP POST with timeout.
   */
  private async httpPost(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      return await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Safely read response body (truncated to 1KB).
   */
  private async safeReadBody(response: Response): Promise<string | null> {
    try {
      const text = await response.text();
      return text.length > 1024 ? text.slice(0, 1024) + "..." : text;
    } catch {
      return null;
    }
  }

  /**
   * Emit a delivery event via EventBus for observability.
   */
  private emitDeliveryEvent(
    item: QueuedDelivery,
    endpoint: WebhookEndpoint,
    success: boolean,
  ): void {
    if (!this.eventBus) return;

    if (success && item.payload.task) {
      // Use the canonical task:webhook:fired event
      this.eventBus.emit("task:webhook:fired", {
        task: item.payload.task as never, // WebhookTaskSnapshot ≠ DomainTask, but good enough for logging
        webhook: { id: endpoint.id, url: endpoint.url },
        deliveryId: item.id,
      });
    }
  }
}
