/**
 * ReactiveBlockLayer — Orchestrator for the block runtime layer
 *
 * Thin coordinator that creates and lifecycle-manages all block subsystem
 * components. Replaces the former monolithic approach with a clean pipeline:
 *
 *   SiYuanRuntimeBridge (raw WS events)
 *       ↓
 *   BlockEventHandler (normalize, emit PluginEventBus)
 *       ↓
 *   BlockActionExecutor (evaluate triggers, execute actions, emit events)
 *       ↓
 *   BlockAttributeSync (write attributes via API; retry on failure)
 *       ↓
 *   BlockRetryQueue (exponential backoff for failed writes)
 *
 * Lifecycle:
 *   - Constructed in onload() with all deps
 *   - start() → called in onLayoutReady() after runtimeBridge.start()
 *   - stop()  → called in onunload() before runtimeBridge.stop()
 */

import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type {
  SiYuanRuntimeBridge,
} from "@backend/runtime/SiYuanRuntimeBridge";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskStorage";
import type { PluginSettings } from "@backend/core/settings/PluginSettings";
import type { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import { BlockRetryQueue } from "@backend/blocks/BlockRetryQueue";
import { BlockAttributeSync } from "@backend/blocks/BlockAttributeSync";
import { BlockEventHandler } from "@backend/blocks/BlockEventHandler";
import { BlockActionExecutor } from "@backend/blocks/BlockActionExecutor";
import * as logger from "@backend/logging/logger";

export interface ReactiveBlockLayerDeps {
  runtimeBridge: SiYuanRuntimeBridge;
  pluginEventBus: PluginEventBus;
  repository: TaskRepositoryProvider;
  settingsProvider: () => PluginSettings;
  recurrenceEngine?: RecurrenceEngine;
}

export class ReactiveBlockLayer {
  // ── Subsystem components (created in constructor, lifecycle-managed) ──
  readonly retryQueue: BlockRetryQueue;
  readonly attributeSync: BlockAttributeSync;
  readonly executor: BlockActionExecutor;
  readonly eventHandler: BlockEventHandler;

  private active = false;

  constructor(deps: ReactiveBlockLayerDeps) {
    // Build the pipeline bottom-up: retry → sync → executor → handler
    this.retryQueue = new BlockRetryQueue();

    this.attributeSync = new BlockAttributeSync(this.retryQueue);

    this.executor = new BlockActionExecutor({
      repository: deps.repository,
      settingsProvider: deps.settingsProvider,
      pluginEventBus: deps.pluginEventBus,
      blockAttributeSync: this.attributeSync,
      recurrenceEngine: deps.recurrenceEngine,
    });

    this.eventHandler = new BlockEventHandler({
      runtimeBridge: deps.runtimeBridge,
      pluginEventBus: deps.pluginEventBus,
      executor: this.executor,
    });
  }

  /**
   * Start all block subsystem components.
   * Call in onLayoutReady() after runtimeBridge.start().
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    // Start in dependency order: retry queue → executor → event handler
    this.retryQueue.start();
    this.executor.activate();
    this.eventHandler.start();

    logger.info("[ReactiveBlockLayer] Started — full block pipeline active");
  }

  /**
   * Stop all block subsystem components.
   * Call in onunload().
   */
  stop(): void {
    if (!this.active) return;
    this.active = false;

    // Stop in reverse order: handler → executor → retry queue
    this.eventHandler.stop();
    this.executor.deactivate();
    this.retryQueue.stop();

    logger.info("[ReactiveBlockLayer] Stopped");
  }
}
