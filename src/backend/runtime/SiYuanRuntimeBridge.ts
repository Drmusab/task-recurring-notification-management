/**
 * SiYuanRuntimeBridge — Reactive bridge between SiYuan kernel and task engine
 *
 * Replaces REST-style block polling with event-driven block mutation subscriptions.
 * All block operations go through the plugin instance (never raw HTTP).
 *
 * Responsibilities:
 * - Subscribe to block change/delete/checkbox events via SiYuan eventBus
 * - Normalize block mutations into typed domain events
 * - Emit task lifecycle events through PluginEventBus
 * - Provide typed block API (getBlockTree, updateBlockAttrs, etc.)
 *
 * Lifecycle: Constructed in onload(), started in onLayoutReady(), stopped in onunload().
 */

import type { Plugin, EventBus } from "siyuan";
import { fetchPost, fetchSyncPost } from "siyuan";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import * as logger from "@backend/logging/logger";

// ─── Block Mutation Types ────────────────────────────────────

export interface BlockMutation {
  /** SiYuan block ID */
  blockId: string;
  /** Root document ID */
  rootId: string;
  /** Mutation type */
  action: "insert" | "update" | "delete" | "move";
  /** Raw block data from transaction (when available) */
  data?: string;
  /** Previous content for diff support */
  previousData?: string;
  /** Timestamp of mutation */
  timestamp: number;
}

export interface CheckboxToggleEvent {
  blockId: string;
  rootId: string;
  checked: boolean;
  content: string;
  timestamp: number;
}

export interface BlockTreeNode {
  id: string;
  type: string;
  subType?: string;
  content?: string;
  children?: BlockTreeNode[];
  parentId?: string;
}

// ─── Domain Events Emitted ────────────────────────────────────

export type RuntimeEvent =
  | { type: "TASK_BLOCK_UPDATED"; blockId: string; rootId: string; content?: string }
  | { type: "TASK_BLOCK_REMOVED"; blockId: string; rootId: string }
  | { type: "TASK_BLOCK_CREATED"; blockId: string; rootId: string; content?: string }
  | { type: "TASK_BLOCK_COMPLETED"; blockId: string; rootId: string; checked: boolean };

// ─── Bridge Class ─────────────────────────────────────────────

export class SiYuanRuntimeBridge {
  private plugin: Plugin;
  private pluginEventBus: PluginEventBus;
  private active = false;

  // SiYuan eventBus handler references (for cleanup)
  private wsMainHandler: ((evt: { detail: any }) => void) | null = null;
  private blockIconHandler: ((evt: { detail: any }) => void) | null = null;

  // Subscribers
  private blockUpdateSubscribers: Set<(mutation: BlockMutation) => void> = new Set();
  private blockDeleteSubscribers: Set<(mutation: BlockMutation) => void> = new Set();
  private checkboxToggleSubscribers: Set<(evt: CheckboxToggleEvent) => void> = new Set();
  private runtimeEventSubscribers: Set<(evt: RuntimeEvent) => void> = new Set();

  // Debounce: coalesce rapid mutations on same block
  private mutationDebounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly MUTATION_DEBOUNCE_MS = 150;

  constructor(plugin: Plugin, pluginEventBus: PluginEventBus) {
    this.plugin = plugin;
    this.pluginEventBus = pluginEventBus;
  }

  // ═══════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════

  /**
   * Start listening to SiYuan kernel events.
   * Call in onLayoutReady() after DOM is available.
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    // 1. Listen to ws-main for block transactions
    this.wsMainHandler = ({ detail }: { detail: any }) => {
      this.handleWsMain(detail);
    };
    this.plugin.eventBus.on("ws-main", this.wsMainHandler);

    logger.info("[SiYuanRuntimeBridge] Started — listening to block mutations");
  }

  /**
   * Stop all event listeners and clear debounce timers.
   * Call in onunload().
   */
  stop(): void {
    this.active = false;

    if (this.wsMainHandler) {
      this.plugin.eventBus.off("ws-main", this.wsMainHandler);
      this.wsMainHandler = null;
    }

    if (this.blockIconHandler) {
      this.plugin.eventBus.off("click-blockicon", this.blockIconHandler);
      this.blockIconHandler = null;
    }

    // Clear all debounce timers
    for (const timer of this.mutationDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.mutationDebounceTimers.clear();

    // Clear subscribers
    this.blockUpdateSubscribers.clear();
    this.blockDeleteSubscribers.clear();
    this.checkboxToggleSubscribers.clear();
    this.runtimeEventSubscribers.clear();

    logger.info("[SiYuanRuntimeBridge] Stopped");
  }

  // ═══════════════════════════════════════════════════════════
  // SUBSCRIPTION API
  // ═══════════════════════════════════════════════════════════

  /**
   * Subscribe to block update events (insert + update).
   * Returns unsubscribe function.
   */
  subscribeBlockUpdate(handler: (mutation: BlockMutation) => void): () => void {
    this.blockUpdateSubscribers.add(handler);
    return () => this.blockUpdateSubscribers.delete(handler);
  }

  /**
   * Subscribe to block delete events.
   */
  subscribeBlockDelete(handler: (mutation: BlockMutation) => void): () => void {
    this.blockDeleteSubscribers.add(handler);
    return () => this.blockDeleteSubscribers.delete(handler);
  }

  /**
   * Subscribe to checkbox toggle events (task completion detection).
   */
  subscribeCheckboxToggle(handler: (evt: CheckboxToggleEvent) => void): () => void {
    this.checkboxToggleSubscribers.add(handler);
    return () => this.checkboxToggleSubscribers.delete(handler);
  }

  /**
   * Subscribe to high-level runtime events (TASK_BLOCK_UPDATED, etc.).
   */
  subscribeRuntimeEvent(handler: (evt: RuntimeEvent) => void): () => void {
    this.runtimeEventSubscribers.add(handler);
    return () => this.runtimeEventSubscribers.delete(handler);
  }

  // ═══════════════════════════════════════════════════════════
  // BLOCK API (replaces REST-style polling)
  // ═══════════════════════════════════════════════════════════

  /**
   * Get block tree (children) for a given block/document.
   */
  async getBlockTree(blockId: string): Promise<BlockTreeNode[]> {
    try {
      const resp = await fetchSyncPost("/api/block/getChildBlocks", { id: blockId });
      if (resp?.code === 0 && Array.isArray(resp.data)) {
        return resp.data as BlockTreeNode[];
      }
      return [];
    } catch (err) {
      logger.error("[SiYuanRuntimeBridge] getBlockTree failed", { blockId, error: err });
      return [];
    }
  }

  /**
   * Update block attributes via kernel API.
   * Used to set task metadata (status, priority, etc.) on blocks.
   */
  async updateBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<boolean> {
    try {
      const resp = await fetchSyncPost("/api/attr/setBlockAttrs", {
        id: blockId,
        attrs,
      });
      return resp?.code === 0;
    } catch (err) {
      logger.error("[SiYuanRuntimeBridge] updateBlockAttrs failed", { blockId, error: err });
      return false;
    }
  }

  /**
   * Get block attributes.
   */
  async getBlockAttrs(blockId: string): Promise<Record<string, string>> {
    try {
      const resp = await fetchSyncPost("/api/attr/getBlockAttrs", { id: blockId });
      if (resp?.code === 0 && resp.data) {
        return resp.data as Record<string, string>;
      }
      return {};
    } catch (err) {
      logger.error("[SiYuanRuntimeBridge] getBlockAttrs failed", { blockId, error: err });
      return {};
    }
  }

  /**
   * Get block info (content, markdown, type).
   */
  async getBlockInfo(blockId: string): Promise<{ content: string; markdown: string; type: string } | null> {
    try {
      const resp = await fetchSyncPost("/api/block/getBlockInfo", { id: blockId });
      if (resp?.code === 0 && resp.data) {
        return {
          content: resp.data.content ?? "",
          markdown: resp.data.markdown ?? "",
          type: resp.data.type ?? "",
        };
      }
      return null;
    } catch (err) {
      logger.error("[SiYuanRuntimeBridge] getBlockInfo failed", { blockId, error: err });
      return null;
    }
  }

  /**
   * Execute SQL query against SiYuan's block database.
   * Useful for finding task blocks by custom attributes.
   */
  async querySql(sql: string): Promise<any[]> {
    try {
      const resp = await fetchSyncPost("/api/query/sql", { stmt: sql });
      if (resp?.code === 0 && Array.isArray(resp.data)) {
        return resp.data;
      }
      return [];
    } catch (err) {
      logger.error("[SiYuanRuntimeBridge] querySql failed", { error: err });
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // INTERNAL: Event Processing
  // ═══════════════════════════════════════════════════════════

  /**
   * Process ws-main messages from SiYuan kernel.
   * Extracts block transactions and normalizes into BlockMutation events.
   */
  private handleWsMain(detail: any): void {
    if (!this.active) return;

    // Handle block transactions
    if (detail?.cmd === "transactions") {
      this.processTransactions(detail.data);
      return;
    }

    // Handle document save
    if (detail?.cmd === "savedoc") {
      const rootId = detail.data?.rootID;
      if (rootId) {
        this.pluginEventBus.emit("document:saved", { rootId });
      }
      return;
    }
  }

  /**
   * Process raw SiYuan transaction data into normalized mutations.
   */
  private processTransactions(data: any[]): void {
    if (!Array.isArray(data)) return;

    for (const tx of data) {
      if (!Array.isArray(tx?.doOperations)) continue;

      for (const op of tx.doOperations) {
        if (!op?.id) continue;

        const mutation: BlockMutation = {
          blockId: op.id,
          rootId: op.parentID || op.previousID || "",
          action: this.normalizeAction(op.action),
          data: op.data,
          timestamp: Date.now(),
        };

        // Detect checkbox toggles from update operations
        if (mutation.action === "update" && this.isCheckboxToggle(op)) {
          this.emitCheckboxToggle(mutation, op);
        }

        // Debounce rapid mutations on same block
        this.debouncedEmitMutation(mutation);
      }
    }
  }

  /**
   * Normalize SiYuan operation action to our mutation types.
   */
  private normalizeAction(action: string): BlockMutation["action"] {
    switch (action) {
      case "insert":
      case "insertBefore":
      case "insertAfter":
        return "insert";
      case "update":
      case "setAttrs":
        return "update";
      case "delete":
      case "removeBlock":
        return "delete";
      case "move":
      case "moveBlock":
        return "move";
      default:
        return "update";
    }
  }

  /**
   * Detect if an update operation is a checkbox toggle.
   * SiYuan list items with task markers use [x] / [ ] in their data.
   */
  private isCheckboxToggle(op: any): boolean {
    if (!op.data || typeof op.data !== "string") return false;
    // Detect task list item pattern
    return /data-subtype="t"/.test(op.data) || /\[[ x]\]/.test(op.data);
  }

  /**
   * Extract checkbox state and emit toggle event.
   */
  private emitCheckboxToggle(mutation: BlockMutation, op: any): void {
    const data = op.data || "";
    const checked = /\[x\]/i.test(data) || /class="protyle-action--task protyle-action protyle-icons"[^>]*>[^<]*checked/i.test(data);

    const evt: CheckboxToggleEvent = {
      blockId: mutation.blockId,
      rootId: mutation.rootId,
      checked,
      content: this.extractTextContent(data),
      timestamp: mutation.timestamp,
    };

    for (const handler of this.checkboxToggleSubscribers) {
      try {
        handler(evt);
      } catch (err) {
        logger.error("[SiYuanRuntimeBridge] checkboxToggle handler error", err);
      }
    }

    // Emit high-level runtime event
    this.emitRuntimeEvent({
      type: "TASK_BLOCK_COMPLETED",
      blockId: mutation.blockId,
      rootId: mutation.rootId,
      checked,
    });
  }

  /**
   * Debounce mutations on the same block to coalesce rapid edits.
   */
  private debouncedEmitMutation(mutation: BlockMutation): void {
    const existing = this.mutationDebounceTimers.get(mutation.blockId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.mutationDebounceTimers.delete(mutation.blockId);
      this.dispatchMutation(mutation);
    }, this.MUTATION_DEBOUNCE_MS);

    this.mutationDebounceTimers.set(mutation.blockId, timer);
  }

  /**
   * Dispatch a normalized mutation to subscribers and emit runtime events.
   */
  private dispatchMutation(mutation: BlockMutation): void {
    switch (mutation.action) {
      case "insert": {
        for (const handler of this.blockUpdateSubscribers) {
          try { handler(mutation); } catch (err) {
            logger.error("[SiYuanRuntimeBridge] blockUpdate handler error", err);
          }
        }
        this.emitRuntimeEvent({
          type: "TASK_BLOCK_CREATED",
          blockId: mutation.blockId,
          rootId: mutation.rootId,
          content: mutation.data,
        });
        // Also trigger task refresh on plugin event bus
        this.pluginEventBus.emit("task:refresh", undefined);
        break;
      }
      case "update":
      case "move": {
        for (const handler of this.blockUpdateSubscribers) {
          try { handler(mutation); } catch (err) {
            logger.error("[SiYuanRuntimeBridge] blockUpdate handler error", err);
          }
        }
        this.emitRuntimeEvent({
          type: "TASK_BLOCK_UPDATED",
          blockId: mutation.blockId,
          rootId: mutation.rootId,
          content: mutation.data,
        });
        this.pluginEventBus.emit("task:refresh", undefined);
        break;
      }
      case "delete": {
        for (const handler of this.blockDeleteSubscribers) {
          try { handler(mutation); } catch (err) {
            logger.error("[SiYuanRuntimeBridge] blockDelete handler error", err);
          }
        }
        this.emitRuntimeEvent({
          type: "TASK_BLOCK_REMOVED",
          blockId: mutation.blockId,
          rootId: mutation.rootId,
        });
        this.pluginEventBus.emit("task:refresh", undefined);
        break;
      }
    }
  }

  /**
   * Emit a high-level runtime event to all subscribers.
   */
  private emitRuntimeEvent(evt: RuntimeEvent): void {
    for (const handler of this.runtimeEventSubscribers) {
      try {
        handler(evt);
      } catch (err) {
        logger.error("[SiYuanRuntimeBridge] runtimeEvent handler error", err);
      }
    }
  }

  /**
   * Extract plain text from SiYuan block HTML data.
   */
  private extractTextContent(html: string): string {
    // Simple HTML tag strip for content extraction
    return html.replace(/<[^>]+>/g, "").trim();
  }
}
