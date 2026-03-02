/**
 * WebhookBoot — Webhook System Boot Integration
 *
 * Provides a clean function that constructs and starts the infrastructure
 * WebhookManager, wires it to the canonical EventBus, and initializes
 * the frontend WebhookStore.
 *
 * Called from BootSequence Phase 6 (after engine + runtime validation are ready)
 * or from index.ts onLayoutReady.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Single entry point for all webhook system bootstrapping
 *   ✔ Uses canonical EventBus (not legacy PluginEventBus)
 *   ✔ Produces a typed WebhookServices group for ServiceRegistry
 *   ❌ No UI logic
 *   ❌ No domain mutations
 */

import type { Plugin } from "siyuan";
import { eventBus } from "@events/EventBus";
import { WebhookManager, type PluginStorage } from "@infrastructure/webhooks/webhook-manager";
import { initWebhookStore, resetWebhookStore } from "@frontend/stores/Webhook.store";
import * as webhookLogger from "@infrastructure/logging/webhook-logger";
import * as pluginLogger from "@shared/logging/logger";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Webhook services returned to the registry. */
export interface WebhookServices {
  readonly webhookManager: WebhookManager;
}

// ═══════════════════════════════════════════════════════════════
// Boot Function
// ═══════════════════════════════════════════════════════════════

/**
 * Boot the webhook infrastructure layer.
 *
 * Steps:
 *  1. Create PluginStorage adapter from SiYuan plugin
 *  2. Construct WebhookManager(eventBus, storage)
 *  3. Initialize (load settings from storage)
 *  4. Start (subscribe to EventBus, begin delivery timer)
 *  5. Initialize frontend WebhookStore
 *
 * @param plugin - SiYuan plugin instance
 * @returns WebhookServices group for ServiceRegistry
 */
export async function bootWebhookSystem(plugin: Plugin): Promise<WebhookServices> {
  pluginLogger.info("[WebhookBoot] Initializing webhook system");
  webhookLogger.lifecycle("Webhook system boot starting");

  // Create storage adapter
  const storage: PluginStorage = {
    loadData: (key: string) => plugin.loadData(key),
    saveData: (key: string, data: unknown) => plugin.saveData(key, data),
  };

  // Construct the manager
  const webhookManager = new WebhookManager(eventBus, storage);

  // Initialize (loads settings, queue, log from storage)
  await webhookManager.initialize();

  // Start (subscribes to EventBus domain events, starts delivery timer)
  webhookManager.start();

  // Initialize the frontend store
  await initWebhookStore(plugin, webhookManager);

  webhookLogger.lifecycle("Webhook system boot complete", {
    enabled: webhookManager.getSettings().enabled,
    endpoints: webhookManager.getSettings().endpoints.length,
  });

  pluginLogger.info("[WebhookBoot] Webhook system initialized", {
    enabled: webhookManager.getSettings().enabled,
    endpoints: webhookManager.getSettings().endpoints.length,
  });

  return { webhookManager };
}

/**
 * Shutdown the webhook system gracefully.
 *
 * Steps:
 *  1. Stop the WebhookManager (unsubscribe events, stop timer)
 *  2. Persist queue and log
 *  3. Reset the frontend store
 *
 * @param webhookServices - The services returned from bootWebhookSystem
 */
export async function shutdownWebhookSystem(
  webhookServices: WebhookServices | null,
): Promise<void> {
  if (!webhookServices) return;

  try {
    await webhookServices.webhookManager.shutdown();
    resetWebhookStore();
    webhookLogger.lifecycle("Webhook system shutdown complete");
    pluginLogger.info("[WebhookBoot] Webhook system shut down");
  } catch (err) {
    pluginLogger.error("[WebhookBoot] Webhook shutdown error:", err);
  }
}
