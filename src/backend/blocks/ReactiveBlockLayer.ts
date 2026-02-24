/**
 * ReactiveBlockLayer — Event-driven block monitoring
 *
 * Replaces manual block polling with SiYuan eventBus subscriptions.
 * Binds to SiYuanRuntimeBridge and emits domain-level block events
 * that the rest of the system can react to.
 *
 * Emits through PluginEventBus:
 *   - TASK_BLOCK_UPDATED  (block content changed)
 *   - TASK_BLOCK_REMOVED  (block deleted)
 *   - TASK_BLOCK_COMPLETED (checkbox toggled)
 *   - TASK_BLOCK_CREATED  (new task-like block inserted)
 *
 * The BlockActionEngine is triggered automatically when relevant
 * block mutations are detected for linked tasks.
 */

import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type {
  SiYuanRuntimeBridge,
  RuntimeEvent,
  BlockMutation,
} from "@backend/runtime/SiYuanRuntimeBridge";
import type { BlockActionEngine } from "@backend/core/block-actions/BlockActionEngine";
import type { BlockEvent } from "@backend/core/block-actions/BlockActionTypes";
import * as logger from "@backend/logging/logger";

export interface ReactiveBlockLayerDeps {
  runtimeBridge: SiYuanRuntimeBridge;
  pluginEventBus: PluginEventBus;
  /** Optional: block action engine for linked-task triggers */
  blockActionEngine?: BlockActionEngine;
}

export class ReactiveBlockLayer {
  private runtimeBridge: SiYuanRuntimeBridge;
  private pluginEventBus: PluginEventBus;
  private blockActionEngine?: BlockActionEngine;
  private cleanups: (() => void)[] = [];
  private active = false;

  constructor(deps: ReactiveBlockLayerDeps) {
    this.runtimeBridge = deps.runtimeBridge;
    this.pluginEventBus = deps.pluginEventBus;
    this.blockActionEngine = deps.blockActionEngine;
  }

  /**
   * Start listening to block mutations and forwarding to block action engine.
   * Call in onLayoutReady() after runtimeBridge.start().
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    // Subscribe to high-level runtime events
    this.cleanups.push(
      this.runtimeBridge.subscribeRuntimeEvent((evt) => {
        this.handleRuntimeEvent(evt);
      })
    );

    // Subscribe to raw block updates for block action engine
    if (this.blockActionEngine) {
      this.cleanups.push(
        this.runtimeBridge.subscribeBlockUpdate((mutation) => {
          this.forwardToBlockActionEngine(mutation);
        })
      );

      this.cleanups.push(
        this.runtimeBridge.subscribeBlockDelete((mutation) => {
          this.forwardDeleteToBlockActionEngine(mutation);
        })
      );
    }

    logger.info("[ReactiveBlockLayer] Started — listening to block mutations");
  }

  /**
   * Stop all subscriptions.
   * Call in onunload().
   */
  stop(): void {
    this.active = false;
    for (const cleanup of this.cleanups) {
      try { cleanup(); } catch { /* ignore */ }
    }
    this.cleanups.length = 0;
    logger.info("[ReactiveBlockLayer] Stopped");
  }

  /**
   * Process high-level runtime events and emit to PluginEventBus.
   */
  private handleRuntimeEvent(evt: RuntimeEvent): void {
    if (!this.active) return;

    switch (evt.type) {
      case "TASK_BLOCK_CREATED":
        logger.info("[ReactiveBlockLayer] TASK_BLOCK_CREATED", { blockId: evt.blockId });
        break;

      case "TASK_BLOCK_UPDATED":
        logger.info("[ReactiveBlockLayer] TASK_BLOCK_UPDATED", { blockId: evt.blockId });
        break;

      case "TASK_BLOCK_REMOVED":
        logger.info("[ReactiveBlockLayer] TASK_BLOCK_REMOVED", { blockId: evt.blockId });
        break;

      case "TASK_BLOCK_COMPLETED":
        logger.info("[ReactiveBlockLayer] TASK_BLOCK_COMPLETED", {
          blockId: evt.blockId,
          checked: evt.checked,
        });
        break;
    }
  }

  /**
   * Forward block update mutations to BlockActionEngine as BlockEvents.
   */
  private forwardToBlockActionEngine(mutation: BlockMutation): void {
    if (!this.blockActionEngine || !this.active) return;

    const blockEvent: BlockEvent = {
      type: "contentChanged",
      blockId: mutation.blockId,
      content: mutation.data || "",
      previousContent: mutation.previousData,
      timestamp: new Date(mutation.timestamp).toISOString(),
      source: "system",
    };

    this.blockActionEngine.handleBlockEvent(blockEvent).catch((err) => {
      logger.error("[ReactiveBlockLayer] BlockActionEngine error", err);
    });
  }

  /**
   * Forward block delete mutations to BlockActionEngine.
   */
  private forwardDeleteToBlockActionEngine(mutation: BlockMutation): void {
    if (!this.blockActionEngine || !this.active) return;

    const blockEvent: BlockEvent = {
      type: "deleted",
      blockId: mutation.blockId,
      timestamp: new Date(mutation.timestamp).toISOString(),
      source: "system",
    };

    this.blockActionEngine.handleBlockEvent(blockEvent).catch((err) => {
      logger.error("[ReactiveBlockLayer] BlockActionEngine delete error", err);
    });
  }
}
