/**
 * Webhook.store.ts — Svelte Store for Webhook Settings & State
 *
 * Manages webhook configuration, endpoint registry, delivery log,
 * and system status for the frontend settings UI.
 *
 * Follows the same patterns as Settings.store.ts:
 *  - Singleton class wrapping a Svelte writable store
 *  - SiYuan plugin.loadData/saveData persistence
 *  - Debounced saves
 *  - initWebhookStore(plugin) / resetWebhookStore() lifecycle
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Single source of truth for webhook UI state
 *   ✔ Delegates all webhook operations to WebhookManager
 *   ✔ Readonly delivery log (populated from WebhookManager)
 *   ❌ No HTTP calls (delegated to infrastructure layer)
 *   ❌ No domain logic
 */

import { writable, derived, get } from "svelte/store";
import type { Writable, Readable } from "svelte/store";
import type { Plugin } from "siyuan";
import type {
  WebhookSettings,
  WebhookEndpoint,
  WebhookEventType,
  WebhookTestResult,
  WebhookRetryPolicy,
  DeliveryLogEntry,
  QueuedDelivery,
} from "@infrastructure/webhooks/webhook-types";
import { DEFAULT_WEBHOOK_SETTINGS, WEBHOOK_EVENT_LABELS, DEFAULT_RETRY_POLICY } from "@infrastructure/webhooks/webhook-types";
import type {
  WebhookManager,
  CreateEndpointParams,
  UpdateEndpointParams,
  WebhookSystemStatus,
} from "@infrastructure/webhooks/webhook-manager";

// ── Re-exports for UI boundary ──────────────────────────────
// Components should import these from the store, not directly
// from infrastructure, to respect layer boundaries.
export type {
  WebhookSettings,
  WebhookEndpoint,
  WebhookEventType,
  WebhookTestResult,
  WebhookRetryPolicy,
  DeliveryLogEntry,
  QueuedDelivery,
  CreateEndpointParams,
  UpdateEndpointParams,
  WebhookSystemStatus,
};
export { DEFAULT_RETRY_POLICY, WEBHOOK_EVENT_LABELS };

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Store state shape. */
export interface WebhookStoreState {
  /** Current webhook settings snapshot. */
  readonly settings: WebhookSettings;
  /** System status (populated on refresh). */
  readonly status: WebhookSystemStatus | null;
  /** Recent delivery log entries. */
  readonly deliveryLog: readonly DeliveryLogEntry[];
  /** Queued deliveries snapshot. */
  readonly queueSnapshot: readonly QueuedDelivery[];
  /** Last test result per endpoint ID. */
  readonly testResults: Record<string, WebhookTestResult>;
  /** Whether the store has been initialized. */
  readonly initialized: boolean;
  /** Whether a save operation is in progress. */
  readonly saving: boolean;
  /** Last error message (null if no error). */
  readonly lastError: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Defaults
// ═══════════════════════════════════════════════════════════════

function getDefaultState(): WebhookStoreState {
  return {
    settings: { ...DEFAULT_WEBHOOK_SETTINGS },
    status: null,
    deliveryLog: [],
    queueSnapshot: [],
    testResults: {},
    initialized: false,
    saving: false,
    lastError: null,
  };
}

// ═══════════════════════════════════════════════════════════════
// Store Implementation
// ═══════════════════════════════════════════════════════════════

let pluginRef: Plugin | null = null;
let managerRef: WebhookManager | null = null;

class WebhookStore {
  private store: Writable<WebhookStoreState> = writable(getDefaultState());

  /** Allow $webhookStore syntax in Svelte components. */
  subscribe = this.store.subscribe;

  /** Get current state snapshot. */
  getState(): WebhookStoreState {
    return get(this.store);
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Initialize the store with settings from the WebhookManager.
   */
  async initialize(manager: WebhookManager): Promise<void> {
    managerRef = manager;

    const settings = manager.getSettings();
    const status = manager.getStatus();
    const deliveryLog = manager.getDeliveryLog(50);
    const queueSnapshot = manager.getQueueSnapshot();

    this.store.set({
      settings: { ...settings },
      status,
      deliveryLog: [...deliveryLog],
      queueSnapshot: [...queueSnapshot],
      testResults: {},
      initialized: true,
      saving: false,
      lastError: null,
    });
  }

  /**
   * Reset the store to defaults.
   */
  reset(): void {
    managerRef = null;
    this.store.set(getDefaultState());
  }

  // ─── Settings Operations ────────────────────────────────────

  /**
   * Toggle the global webhook system enabled/disabled.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    await this.updateSettings({ enabled });
  }

  /**
   * Update global webhook settings.
   */
  async updateSettings(
    updates: Partial<Pick<WebhookSettings, "enabled" | "allowedDomains" | "allowLocalhost" | "rateLimitPerMinute" | "includeDescription" | "defaultRetryPolicy">>,
  ): Promise<void> {
    if (!managerRef) {
      this.setError("Webhook manager not initialized");
      return;
    }

    this.store.update((s) => ({ ...s, saving: true, lastError: null }));

    try {
      await managerRef.updateSettings(updates);
      this.refreshFromManager();
    } catch (err) {
      this.setError(err instanceof Error ? err.message : String(err));
    } finally {
      this.store.update((s) => ({ ...s, saving: false }));
    }
  }

  // ─── Endpoint CRUD ──────────────────────────────────────────

  /**
   * Add a new webhook endpoint.
   */
  async addEndpoint(params: CreateEndpointParams): Promise<WebhookEndpoint | null> {
    if (!managerRef) {
      this.setError("Webhook manager not initialized");
      return null;
    }

    this.store.update((s) => ({ ...s, saving: true, lastError: null }));

    try {
      const endpoint = await managerRef.addEndpoint(params);
      this.refreshFromManager();
      return endpoint;
    } catch (err) {
      this.setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.store.update((s) => ({ ...s, saving: false }));
    }
  }

  /**
   * Update an existing endpoint.
   */
  async updateEndpoint(id: string, updates: UpdateEndpointParams): Promise<boolean> {
    if (!managerRef) {
      this.setError("Webhook manager not initialized");
      return false;
    }

    this.store.update((s) => ({ ...s, saving: true, lastError: null }));

    try {
      await managerRef.updateEndpoint(id, updates);
      this.refreshFromManager();
      return true;
    } catch (err) {
      this.setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      this.store.update((s) => ({ ...s, saving: false }));
    }
  }

  /**
   * Remove a webhook endpoint.
   */
  async removeEndpoint(id: string): Promise<boolean> {
    if (!managerRef) {
      this.setError("Webhook manager not initialized");
      return false;
    }

    this.store.update((s) => ({ ...s, saving: true, lastError: null }));

    try {
      await managerRef.removeEndpoint(id);
      this.refreshFromManager();
      return true;
    } catch (err) {
      this.setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      this.store.update((s) => ({ ...s, saving: false }));
    }
  }

  /**
   * Toggle an endpoint's enabled state.
   */
  async toggleEndpoint(id: string): Promise<boolean> {
    if (!managerRef) return false;
    const endpoint = managerRef.getEndpoint(id);
    if (!endpoint) return false;
    return this.updateEndpoint(id, { enabled: !endpoint.enabled });
  }

  // ─── Test ───────────────────────────────────────────────────

  /**
   * Test a webhook endpoint with a test.ping event.
   */
  async testEndpoint(id: string): Promise<WebhookTestResult | null> {
    if (!managerRef) {
      this.setError("Webhook manager not initialized");
      return null;
    }

    try {
      const result = await managerRef.testEndpoint(id);

      this.store.update((s) => ({
        ...s,
        testResults: { ...s.testResults, [id]: result },
        lastError: null,
      }));

      return result;
    } catch (err) {
      this.setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  // ─── Queue & Log ────────────────────────────────────────────

  /**
   * Manually flush the delivery queue.
   */
  async flushQueue(): Promise<number> {
    if (!managerRef) return 0;

    try {
      const delivered = await managerRef.flush();
      this.refreshFromManager();
      return delivered;
    } catch (err) {
      this.setError(err instanceof Error ? err.message : String(err));
      return 0;
    }
  }

  /**
   * Clear the delivery log.
   */
  clearDeliveryLog(): void {
    if (!managerRef) return;
    managerRef.clearDeliveryLog();
    this.refreshFromManager();
  }

  /**
   * Prune abandoned deliveries from the queue.
   */
  pruneQueue(): number {
    if (!managerRef) return 0;
    const pruned = managerRef.pruneQueue();
    this.refreshFromManager();
    return pruned;
  }

  // ─── Refresh ────────────────────────────────────────────────

  /**
   * Refresh all state from the WebhookManager.
   * Call after any mutation or periodically.
   */
  refreshFromManager(): void {
    if (!managerRef) return;

    const settings = managerRef.getSettings();
    const status = managerRef.getStatus();
    const deliveryLog = managerRef.getDeliveryLog(50);
    const queueSnapshot = managerRef.getQueueSnapshot();

    this.store.update((s) => ({
      ...s,
      settings: { ...settings },
      status,
      deliveryLog: [...deliveryLog],
      queueSnapshot: [...queueSnapshot],
    }));
  }

  // ─── Helpers ────────────────────────────────────────────────

  private setError(message: string): void {
    this.store.update((s) => ({ ...s, lastError: message }));
    console.error("[WebhookStore]", message);
  }
}

// ═══════════════════════════════════════════════════════════════
// Derived Stores
// ═══════════════════════════════════════════════════════════════

/** Singleton store instance. */
export const webhookStore = new WebhookStore();

/** Whether webhooks are globally enabled. */
export const webhooksEnabled: Readable<boolean> = derived(
  { subscribe: webhookStore.subscribe },
  ($state) => $state.settings.enabled,
);

/** List of registered endpoints. */
export const webhookEndpoints: Readable<readonly WebhookEndpoint[]> = derived(
  { subscribe: webhookStore.subscribe },
  ($state) => $state.settings.endpoints,
);

/** Count of active (enabled) endpoints. */
export const activeEndpointCount: Readable<number> = derived(
  { subscribe: webhookStore.subscribe },
  ($state) => $state.settings.endpoints.filter((ep) => ep.enabled).length,
);

/** Available event type labels for the UI. */
export const availableEventTypes: ReadonlyArray<{ value: WebhookEventType; label: string }> =
  Object.entries(WEBHOOK_EVENT_LABELS).map(([value, label]) => ({
    value: value as WebhookEventType,
    label,
  }));

// ═══════════════════════════════════════════════════════════════
// Lifecycle Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize the webhook store with a plugin reference and WebhookManager.
 * Called during boot sequence.
 */
export async function initWebhookStore(
  plugin: Plugin,
  manager: WebhookManager,
): Promise<void> {
  pluginRef = plugin;
  await webhookStore.initialize(manager);
}

/**
 * Reset the webhook store.
 * Called during plugin unload.
 */
export function resetWebhookStore(): void {
  webhookStore.reset();
  pluginRef = null;
  managerRef = null;
}
