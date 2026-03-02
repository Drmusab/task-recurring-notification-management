/**
 * webhook-manager.ts — Webhook System Orchestrator
 *
 * Top-level manager that wires all webhook subsystems together and provides
 * the public API for the rest of the plugin. Handles:
 *  - Lifecycle management (start/stop)
 *  - EventBus → webhook payload bridging
 *  - Endpoint CRUD operations
 *  - Settings persistence
 *  - Queue + dispatcher coordination
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Single entry point for all webhook operations
 *   ✔ Manages lifecycle of all webhook subsystems
 *   ✔ Bridges domain events to outbound webhooks
 *   ✔ Persists settings via plugin storage
 *   ❌ No direct HTTP calls (delegated to dispatcher)
 *   ❌ No frontend imports
 */

import type { EventBus, DomainEventType, EventPayloadMap } from "@events/EventBus";
import type { DomainTask } from "@domain/DomainTask";
import type {
  WebhookSettings,
  WebhookEndpoint,
  WebhookEventType,
  WebhookPayload,
  WebhookTestResult,
  WebhookRetryPolicy,
  DeliveryLogEntry,
  QueuedDelivery,
} from "./webhook-types";
import {
  DEFAULT_WEBHOOK_SETTINGS,
  DEFAULT_RETRY_POLICY,
  WEBHOOK_SETTINGS_KEY,
} from "./webhook-types";
import { fromDomainEvent, buildPayload, buildTaskSnapshot, DOMAIN_TO_WEBHOOK } from "./webhook-events";
import { validateDomain, WebhookRateLimiter, clearKeyCache } from "./webhook-security";
import { WebhookQueue, createPluginStorageAdapter } from "./webhook-queue";
import { WebhookRetryManager, createLogStorageAdapter } from "./webhook-retry";
import { WebhookDispatcher } from "./webhook-dispatcher";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Plugin storage interface (subset of SiYuan Plugin API). */
export interface PluginStorage {
  loadData(key: string): Promise<unknown>;
  saveData(key: string, data: unknown): Promise<void>;
}

/** Endpoint creation parameters (without auto-generated fields). */
export interface CreateEndpointParams {
  name: string;
  url: string;
  secret?: string;
  events?: WebhookEventType[];
  headers?: Record<string, string>;
  retryPolicy?: WebhookRetryPolicy | null;
  enabled?: boolean;
}

/** Endpoint update parameters. */
export interface UpdateEndpointParams {
  name?: string;
  url?: string;
  secret?: string;
  events?: WebhookEventType[];
  headers?: Record<string, string>;
  retryPolicy?: WebhookRetryPolicy | null;
  enabled?: boolean;
}

/** Webhook system status for diagnostics. */
export interface WebhookSystemStatus {
  enabled: boolean;
  endpointCount: number;
  activeEndpointCount: number;
  queueSize: number;
  pendingDeliveries: number;
  rateLimitTokens: number;
  deliveryStats: {
    total: number;
    delivered: number;
    failed: number;
    avgDurationMs: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// Manager Implementation
// ═══════════════════════════════════════════════════════════════

/**
 * Central webhook manager — the public API for all webhook operations.
 *
 * Usage:
 * ```ts
 * const manager = new WebhookManager(eventBus, pluginStorage);
 * await manager.initialize();
 * manager.start();
 *
 * // Later...
 * await manager.addEndpoint({ name: "n8n", url: "https://..." });
 *
 * // Shutdown
 * await manager.shutdown();
 * ```
 */
export class WebhookManager {
  private settings: WebhookSettings = { ...DEFAULT_WEBHOOK_SETTINGS };
  private readonly eventBus: EventBus;
  private readonly storage: PluginStorage;
  private readonly queue: WebhookQueue;
  private readonly retryManager: WebhookRetryManager;
  private readonly rateLimiter: WebhookRateLimiter;
  private readonly dispatcher: WebhookDispatcher;
  private readonly unsubscribers: Array<() => void> = [];
  private initialized = false;
  private running = false;

  constructor(eventBus: EventBus, storage: PluginStorage) {
    this.eventBus = eventBus;
    this.storage = storage;

    // Create subsystems
    const queueStorage = createPluginStorageAdapter(
      (key) => storage.loadData(key),
      (key, data) => storage.saveData(key, data),
    );
    const logStorage = createLogStorageAdapter(
      (key) => storage.loadData(key),
      (key, data) => storage.saveData(key, data),
    );

    this.queue = new WebhookQueue(queueStorage);
    this.retryManager = new WebhookRetryManager(logStorage);
    this.rateLimiter = new WebhookRateLimiter(DEFAULT_WEBHOOK_SETTINGS.rateLimitPerMinute);
    this.dispatcher = new WebhookDispatcher(
      this.queue,
      this.retryManager,
      this.rateLimiter,
      eventBus,
    );
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Initialize the webhook system.
   * Loads settings, queue state, and delivery log from storage.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load settings
      const stored = await this.storage.loadData(WEBHOOK_SETTINGS_KEY);
      if (stored && typeof stored === "object") {
        this.settings = { ...DEFAULT_WEBHOOK_SETTINGS, ...(stored as Partial<WebhookSettings>) };
      }

      // Initialize subsystems
      await this.queue.initialize();
      await this.retryManager.initialize();

      // Update dispatcher with current settings
      this.dispatcher.updateSettings(this.settings);

      this.initialized = true;
      console.log("[WebhookManager] Initialized", {
        enabled: this.settings.enabled,
        endpoints: this.settings.endpoints.length,
      });
    } catch (err) {
      console.error("[WebhookManager] Initialization failed:", err);
      // Use defaults on failure
      this.settings = { ...DEFAULT_WEBHOOK_SETTINGS };
      this.initialized = true;
    }
  }

  /**
   * Start the webhook system.
   * Subscribes to EventBus events and starts the delivery timer.
   */
  start(): void {
    if (!this.initialized) {
      console.warn("[WebhookManager] Cannot start — not initialized");
      return;
    }
    if (this.running) return;
    if (!this.settings.enabled) {
      console.log("[WebhookManager] Webhook system disabled — not starting");
      return;
    }

    // Subscribe to domain events
    this.subscribeToEvents();

    // Start the dispatcher flush timer
    this.dispatcher.start();

    this.running = true;
    console.log("[WebhookManager] Started");
  }

  /**
   * Stop the webhook system.
   * Unsubscribes from events and stops the delivery timer.
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    // Unsubscribe from all events
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;

    // Stop dispatcher
    await this.dispatcher.stop();

    this.running = false;
    console.log("[WebhookManager] Stopped");
  }

  /**
   * Full shutdown — stop, persist everything, and clean up.
   */
  async shutdown(): Promise<void> {
    try {
      await this.stop();
      await this.queue.shutdown();
      await this.retryManager.shutdown();
      clearKeyCache();

      this.initialized = false;
      console.log("[WebhookManager] Shut down");
    } catch (err) {
      console.error(
        "[WebhookManager] Error during shutdown:",
        err instanceof Error ? err.message : err,
      );
      // Ensure state is marked as not-initialized even on failure
      this.initialized = false;
    }
  }

  // ─── Settings ───────────────────────────────────────────────

  /** Get current webhook settings (readonly snapshot). */
  getSettings(): Readonly<WebhookSettings> {
    return this.settings;
  }

  /**
   * Update global webhook settings.
   * Persists to storage and restarts if enabled state changed.
   */
  async updateSettings(
    updates: Partial<Pick<WebhookSettings, "enabled" | "allowedDomains" | "allowLocalhost" | "rateLimitPerMinute" | "includeDescription" | "defaultRetryPolicy">>,
  ): Promise<void> {
    const wasEnabled = this.settings.enabled;
    const wasRunning = this.running;

    this.settings = {
      ...this.settings,
      ...updates,
    };

    // Persist
    await this.persistSettings();

    // Update dispatcher
    this.dispatcher.updateSettings(this.settings);

    // Handle enable/disable transitions
    if (updates.enabled !== undefined && updates.enabled !== wasEnabled) {
      if (updates.enabled && !wasRunning) {
        this.start();
      } else if (!updates.enabled && wasRunning) {
        await this.stop();
      }
    }
  }

  // ─── Endpoint CRUD ──────────────────────────────────────────

  /** Get all registered endpoints. */
  getEndpoints(): readonly WebhookEndpoint[] {
    return this.settings.endpoints;
  }

  /** Get a specific endpoint by ID. */
  getEndpoint(id: string): WebhookEndpoint | undefined {
    return this.settings.endpoints.find((ep) => ep.id === id);
  }

  /**
   * Add a new webhook endpoint.
   * Validates URL domain before adding.
   *
   * @returns The created endpoint, or throws on validation failure
   */
  async addEndpoint(params: CreateEndpointParams): Promise<WebhookEndpoint> {
    // Validate URL
    const domainResult = validateDomain(params.url, this.settings);
    if (!domainResult.valid) {
      throw new Error(`Invalid endpoint URL: ${domainResult.reason}`);
    }

    const id = this.generateEndpointId();
    const now = new Date().toISOString();

    const endpoint: WebhookEndpoint = {
      id,
      name: params.name,
      url: params.url,
      enabled: params.enabled ?? true,
      secret: params.secret ?? "",
      events: params.events ?? [],
      headers: params.headers ?? {},
      retryPolicy: params.retryPolicy ?? null,
      createdAt: now,
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
    };

    this.settings = {
      ...this.settings,
      endpoints: [...this.settings.endpoints, endpoint],
    };

    await this.persistSettings();
    this.dispatcher.updateSettings(this.settings);

    console.log(`[WebhookManager] Added endpoint "${endpoint.name}" (${endpoint.id})`);
    return endpoint;
  }

  /**
   * Update an existing endpoint.
   * Validates new URL if changed.
   */
  async updateEndpoint(id: string, updates: UpdateEndpointParams): Promise<WebhookEndpoint> {
    const index = this.settings.endpoints.findIndex((ep) => ep.id === id);
    if (index === -1) {
      throw new Error(`Endpoint "${id}" not found`);
    }

    // Validate URL if changed
    if (updates.url) {
      const domainResult = validateDomain(updates.url, this.settings);
      if (!domainResult.valid) {
        throw new Error(`Invalid endpoint URL: ${domainResult.reason}`);
      }
    }

    const existing = this.settings.endpoints[index]!;
    const updated: WebhookEndpoint = {
      ...existing,
      name: updates.name ?? existing.name,
      url: updates.url ?? existing.url,
      secret: updates.secret ?? existing.secret,
      events: updates.events ?? existing.events,
      headers: updates.headers ?? existing.headers,
      retryPolicy: updates.retryPolicy !== undefined ? updates.retryPolicy : existing.retryPolicy,
      enabled: updates.enabled ?? existing.enabled,
    };

    const endpoints = [...this.settings.endpoints];
    endpoints[index] = updated;
    this.settings = { ...this.settings, endpoints };

    await this.persistSettings();
    this.dispatcher.updateSettings(this.settings);

    // If disabled, remove queued deliveries for this endpoint
    if (updates.enabled === false) {
      this.queue.removeEndpoint(id);
    }

    console.log(`[WebhookManager] Updated endpoint "${updated.name}" (${id})`);
    return updated;
  }

  /**
   * Remove a webhook endpoint.
   * Also removes all queued deliveries for this endpoint.
   */
  async removeEndpoint(id: string): Promise<void> {
    const endpoint = this.settings.endpoints.find((ep) => ep.id === id);
    if (!endpoint) {
      throw new Error(`Endpoint "${id}" not found`);
    }

    this.settings = {
      ...this.settings,
      endpoints: this.settings.endpoints.filter((ep) => ep.id !== id),
    };

    // Remove queued deliveries
    this.queue.removeEndpoint(id);

    await this.persistSettings();
    this.dispatcher.updateSettings(this.settings);

    console.log(`[WebhookManager] Removed endpoint "${endpoint.name}" (${id})`);
  }

  /**
   * Test an endpoint with a test.ping event.
   */
  async testEndpoint(id: string): Promise<WebhookTestResult> {
    const endpoint = this.settings.endpoints.find((ep) => ep.id === id);
    if (!endpoint) {
      return {
        success: false,
        statusCode: null,
        responseBody: null,
        durationMs: 0,
        error: `Endpoint "${id}" not found`,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      return await this.dispatcher.testEndpoint(endpoint);
    } catch (err) {
      return {
        success: false,
        statusCode: null,
        responseBody: null,
        durationMs: 0,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ─── Manual Operations ──────────────────────────────────────

  /**
   * Manually trigger a flush of the delivery queue.
   */
  async flush(): Promise<number> {
    try {
      return await this.dispatcher.flush();
    } catch (err) {
      console.error(
        "[WebhookManager] Flush failed:",
        err instanceof Error ? err.message : err,
      );
      return 0;
    }
  }

  /**
   * Manually enqueue a webhook event for a task.
   * Use when you need to fire a webhook outside the normal EventBus flow.
   */
  enqueueEvent(
    event: WebhookEventType,
    task: DomainTask,
    triggeredBy: "user" | "system" | "scheduler" | "recurrence" = "system",
  ): number {
    const payload = buildPayload(
      event,
      task,
      { triggeredBy },
      this.settings.includeDescription,
    );

    return this.enqueueForAllEndpoints(payload);
  }

  // ─── Diagnostics ────────────────────────────────────────────

  /** Get current system status. */
  getStatus(): WebhookSystemStatus {
    return {
      enabled: this.settings.enabled,
      endpointCount: this.settings.endpoints.length,
      activeEndpointCount: this.settings.endpoints.filter((ep) => ep.enabled).length,
      queueSize: this.queue.size,
      pendingDeliveries: this.queue.pendingCount,
      rateLimitTokens: this.rateLimiter.getAvailableTokens(),
      deliveryStats: this.retryManager.getStats(),
    };
  }

  /** Get delivery log entries. */
  getDeliveryLog(count?: number): readonly DeliveryLogEntry[] {
    if (count) return this.retryManager.getRecentLog(count);
    return this.retryManager.getLog();
  }

  /** Get delivery log for a specific endpoint. */
  getEndpointLog(endpointId: string): DeliveryLogEntry[] {
    return this.retryManager.getLogForEndpoint(endpointId);
  }

  /** Get queued deliveries snapshot. */
  getQueueSnapshot(): readonly QueuedDelivery[] {
    return this.queue.snapshot();
  }

  /** Clear the delivery log. */
  clearDeliveryLog(): void {
    this.retryManager.clearLog();
  }

  /** Prune abandoned deliveries from the queue. */
  pruneQueue(): number {
    return this.queue.pruneAbandoned();
  }

  // ─── Internal: EventBus Integration ─────────────────────────

  /**
   * Subscribe to domain events and bridge them to webhook payloads.
   */
  private subscribeToEvents(): void {
    const mappedEvents = Object.keys(DOMAIN_TO_WEBHOOK) as DomainEventType[];

    for (const domainEvent of mappedEvents) {
      const unsub = this.eventBus.on(domainEvent, (payload) => {
        this.handleDomainEvent(domainEvent, payload);
      });
      this.unsubscribers.push(unsub);
    }

    console.log(`[WebhookManager] Subscribed to ${mappedEvents.length} domain events`);
  }

  /**
   * Handle a domain event: convert to webhook payload and enqueue.
   */
  private handleDomainEvent<E extends DomainEventType>(
    event: E,
    payload: EventPayloadMap[E],
  ): void {
    // Extract the task from the payload
    const task = this.extractTask(event, payload);
    if (!task) return;

    try {
      const webhookPayload = fromDomainEvent(
        event,
        payload,
        this.settings.includeDescription,
      );

      if (!webhookPayload) {
        // Event type not mapped — skip silently
        return;
      }

      this.enqueueForAllEndpoints(webhookPayload);
    } catch (err) {
      console.error(
        `[WebhookManager] Failed to process event "${event}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Extract a DomainTask from an event payload.
   * Different events carry the task in different payload shapes.
   */
  private extractTask<E extends DomainEventType>(
    event: E,
    payload: EventPayloadMap[E],
  ): DomainTask | null {
    // Most events have { task: DomainTask }
    const p = payload as Record<string, unknown>;
    if (p.task && typeof p.task === "object") {
      return p.task as DomainTask;
    }

    // task:runtime:deleted may only have taskId
    if (event === "task:runtime:deleted") {
      return null; // Deleted tasks may not have full task object
    }

    return null;
  }

  /**
   * Enqueue a webhook payload for all matching enabled endpoints.
   * @returns Number of endpoints the payload was queued for
   */
  private enqueueForAllEndpoints(payload: WebhookPayload): number {
    let enqueued = 0;

    for (const endpoint of this.settings.endpoints) {
      if (!endpoint.enabled) continue;

      // Filter by subscribed events
      if (
        endpoint.events.length > 0 &&
        !endpoint.events.includes(payload.event)
      ) {
        continue;
      }

      // Validate domain (in case settings changed after endpoint creation)
      const domainValid = validateDomain(endpoint.url, this.settings);
      if (!domainValid.valid) {
        console.warn(
          `[WebhookManager] Skipping endpoint "${endpoint.name}": ${domainValid.reason}`,
        );
        continue;
      }

      const result = this.queue.enqueue(payload, endpoint);
      if (result) enqueued++;
    }

    return enqueued;
  }

  // ─── Internal: Helpers ──────────────────────────────────────

  /** Persist settings to plugin storage. */
  private async persistSettings(): Promise<void> {
    try {
      await this.storage.saveData(WEBHOOK_SETTINGS_KEY, this.settings);
    } catch (err) {
      console.error("[WebhookManager] Failed to persist settings:", err);
    }
  }

  /** Generate a unique endpoint ID. */
  private generateEndpointId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `ep_${crypto.randomUUID().slice(0, 8)}`;
    }
    return `ep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
}
