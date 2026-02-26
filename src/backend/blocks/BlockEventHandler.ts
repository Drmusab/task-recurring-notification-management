/**
 * BlockEventHandler — Receives raw SiYuanRuntimeBridge events and routes them
 *
 * Sits between SiYuanRuntimeBridge (raw WS events) and BlockActionExecutor.
 * Normalizes BlockMutation/CheckboxToggleEvent into typed BlockEvent, then
 * dispatches to the executor and emits PluginEventBus signals.
 *
 * Key responsibilities:
 *   1. Subscribe to runtimeBridge block updates, deletes, checkbox toggles
 *   2. Normalize mutations into BlockEvent discriminated union
 *   3. Route checkbox toggles into `blockCompleted` trigger path (was dead before)
 *   4. Emit PluginEventBus block:* events for frontend reactivity
 *   5. Handle errors gracefully — never throw into runtimeBridge
 *
 * Required Execution Flow:
 *   BlockEventHandler → BlockActionExecutor → TaskService → SchedulerService
 *                     → EventBus.emit() → Frontend
 *
 * Lifecycle:
 *   - start() → called in onLayoutReady() after runtimeBridge.start()
 *   - stop()  → called in onunload() before runtimeBridge.stop()
 */

import type {
  SiYuanRuntimeBridge,
  BlockMutation,
  CheckboxToggleEvent,
} from "@backend/runtime/SiYuanRuntimeBridge";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { BlockActionExecutor } from "@backend/blocks/BlockActionExecutor";
import type { BlockEvent } from "@backend/core/block-actions/BlockActionTypes";
import * as logger from "@backend/logging/logger";

export interface BlockEventHandlerDeps {
  runtimeBridge: SiYuanRuntimeBridge;
  pluginEventBus: PluginEventBus;
  /** Optional — if not provided, events are still emitted but no actions executed */
  executor?: BlockActionExecutor;
}

export class BlockEventHandler {
  private runtimeBridge: SiYuanRuntimeBridge;
  private pluginEventBus: PluginEventBus;
  private executor?: BlockActionExecutor;
  private cleanups: (() => void)[] = [];
  private active = false;

  constructor(deps: BlockEventHandlerDeps) {
    this.runtimeBridge = deps.runtimeBridge;
    this.pluginEventBus = deps.pluginEventBus;
    this.executor = deps.executor;
  }

  /**
   * Start listening to block mutations from the runtime bridge.
   * Call in onLayoutReady() after runtimeBridge.start().
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    // 1. Block content updates → contentChanged event
    this.cleanups.push(
      this.runtimeBridge.subscribeBlockUpdate((mutation) => {
        this.handleBlockUpdate(mutation);
      })
    );

    // 2. Block deletions → deleted event
    this.cleanups.push(
      this.runtimeBridge.subscribeBlockDelete((mutation) => {
        this.handleBlockDelete(mutation);
      })
    );

    // 3. Checkbox toggles → blockCompleted trigger (was DEAD PATH before)
    this.cleanups.push(
      this.runtimeBridge.subscribeCheckboxToggle((evt) => {
        this.handleCheckboxToggle(evt);
      })
    );

    logger.info("[BlockEventHandler] Started — listening to block mutations + checkbox toggles");
  }

  /**
   * Stop all subscriptions. Call in onunload().
   */
  stop(): void {
    this.active = false;
    for (const cleanup of this.cleanups) {
      try { cleanup(); } catch { /* ignore */ }
    }
    this.cleanups.length = 0;
    logger.info("[BlockEventHandler] Stopped");
  }

  // ── Event Handlers ──────────────────────────────────────────

  private handleBlockUpdate(mutation: BlockMutation): void {
    if (!this.active) return;

    // Emit to PluginEventBus for frontend (dashboard, calendar, stores)
    this.pluginEventBus.emit("block:updated", {
      blockId: mutation.blockId,
      rootId: mutation.rootId,
      content: mutation.data,
    });

    // Build BlockEvent and route to executor
    const blockEvent: BlockEvent = {
      type: "contentChanged",
      blockId: mutation.blockId,
      content: mutation.data || "",
      previousContent: mutation.previousData,
      timestamp: new Date(mutation.timestamp).toISOString(),
      source: "system",
    };

    this.dispatchToExecutor(blockEvent);
  }

  private handleBlockDelete(mutation: BlockMutation): void {
    if (!this.active) return;

    // Emit to PluginEventBus for frontend
    this.pluginEventBus.emit("block:deleted", {
      blockId: mutation.blockId,
      rootId: mutation.rootId,
    });

    const blockEvent: BlockEvent = {
      type: "deleted",
      blockId: mutation.blockId,
      timestamp: new Date(mutation.timestamp).toISOString(),
      source: "system",
    };

    this.dispatchToExecutor(blockEvent);
  }

  /**
   * Handle checkbox toggle — maps to `blockCompleted` trigger type.
   *
   * Previously this was a DEAD PATH: ReactiveBlockLayer logged the event
   * but never routed it to the block action engine. Now it creates a
   * contentChanged BlockEvent with checkbox content so the evaluator's
   * `blockCompleted` trigger (which tests for [x] pattern) fires correctly.
   */
  private handleCheckboxToggle(evt: CheckboxToggleEvent): void {
    if (!this.active) return;

    // Emit to PluginEventBus for frontend
    this.pluginEventBus.emit("block:checkbox", {
      blockId: evt.blockId,
      rootId: evt.rootId,
      checked: evt.checked,
    });

    // Create a contentChanged event with the checkbox content,
    // so BlockActionEvaluator's `blockCompleted` trigger can match [x]/[ ]
    const blockEvent: BlockEvent = {
      type: "contentChanged",
      blockId: evt.blockId,
      content: evt.content,
      timestamp: new Date(evt.timestamp).toISOString(),
      source: "system",
    };

    this.dispatchToExecutor(blockEvent);
  }

  // ── Dispatch ────────────────────────────────────────────────

  /**
   * Send a BlockEvent to the executor for action evaluation + execution.
   * Errors are caught and logged — never propagate into runtimeBridge callbacks.
   */
  private dispatchToExecutor(event: BlockEvent): void {
    if (!this.executor) return;

    this.executor.handleBlockEvent(event).catch((err: unknown) => {
      logger.error("[BlockEventHandler] Executor error", {
        eventType: event.type,
        blockId: event.blockId,
        error: err,
      });
    });
  }
}
