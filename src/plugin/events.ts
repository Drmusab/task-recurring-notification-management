/**
 * SiYuan Event Bus Integration Module
 * 
 * Connects the plugin to SiYuan's native event bus for:
 * - Block transactions (create/update/delete)
 * - Document lifecycle (open/save/switch/close)
 * - Block icon context menu integration
 * 
 * Based on official plugin-sample eventBus.on/off pattern.
 */

import type { Plugin, EventBus } from "siyuan";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { BlockMetadataService } from "@backend/core/api/BlockMetadataService";
import type { Scheduler } from "@backend/core/engine/Scheduler";
import { showMessage } from "siyuan";

export interface EventHandlerState {
  wsMainHandler: ((evt: { detail: any }) => void) | null;
  blockIconHandler: ((evt: { detail: any }) => void) | null;
  protyleLoadedHandler: ((evt: { detail: any }) => void) | null;
  protyleDynamicHandler: ((evt: { detail: any }) => void) | null;
  protyleSwitchHandler: ((evt: { detail: any }) => void) | null;
  protyleDestroyHandler: ((evt: { detail: any }) => void) | null;
  schedulerEventCleanups: (() => void)[];
  schedulerDebounceTimer: ReturnType<typeof setTimeout> | null;
}

export function createEventHandlerState(): EventHandlerState {
  return {
    wsMainHandler: null,
    blockIconHandler: null,
    protyleLoadedHandler: null,
    protyleDynamicHandler: null,
    protyleSwitchHandler: null,
    protyleDestroyHandler: null,
    schedulerEventCleanups: [],
    schedulerDebounceTimer: null,
  };
}

export interface EventDeps {
  plugin: Plugin;
  pluginEventBus: PluginEventBus;
  blockMetadataService: BlockMetadataService;
  scheduler: Scheduler;
  openQuickTaskEditor: () => void;
  /** Open task editor pre-populated for an existing block */
  openTaskEditorForBlock?: (blockId: string, blockContent: string) => void;
}

/**
 * Register SiYuan native event bus handlers.
 * Connects plugin to SiYuan's block/document lifecycle events.
 */
export function registerSiYuanEventHandlers(
  state: EventHandlerState,
  deps: EventDeps
): void {
  const { plugin, pluginEventBus, blockMetadataService } = deps;

  // ws-main: Block transactions (create, update, delete)
  state.wsMainHandler = ({ detail }: { detail: any }) => {
    if (detail?.cmd === "transactions") {
      const data = detail.data;
      const hasTaskOps =
        Array.isArray(data) &&
        data.some(
          (tx: any) =>
            Array.isArray(tx?.doOperations) &&
            tx.doOperations.some(
              (op: any) =>
                op?.action === "update" ||
                op?.action === "insert" ||
                op?.action === "delete"
            )
        );
      if (hasTaskOps) {
        pluginEventBus.emit("task:refresh", undefined);
      }
    }
    // Document saved → trigger scan
    if (detail?.cmd === "savedoc") {
      const rootId = detail.data?.rootID;
      if (rootId) {
        pluginEventBus.emit("document:saved", { rootId });
      }
    }
  };
  plugin.eventBus.on("ws-main", state.wsMainHandler);

  // Block icon click → detect task blocks
  state.blockIconHandler = ({ detail }: { detail: any }) => {
    const blockId =
      detail?.blockElements?.[0]?.getAttribute?.("data-node-id");
    if (blockId && detail?.menu) {
      addBlockContextMenu(detail, pluginEventBus, blockMetadataService, deps.openQuickTaskEditor, plugin, deps.openTaskEditorForBlock);
    }
  };
  plugin.eventBus.on("click-blockicon", state.blockIconHandler);

  // Document opened → scan for tasks
  state.protyleLoadedHandler = ({ detail }: { detail: any }) => {
    const rootId = detail?.protyle?.block?.rootID;
    if (rootId) {
      pluginEventBus.emit("document:opened", { rootId });
    }
  };
  plugin.eventBus.on("loaded-protyle-static", state.protyleLoadedHandler);

  // Dynamic protyle loaded (embeds, backlinks) → scan for tasks
  state.protyleDynamicHandler = ({ detail }: { detail: any }) => {
    const rootId = detail?.protyle?.block?.rootID;
    if (rootId) {
      pluginEventBus.emit("document:opened", { rootId });
    }
  };
  plugin.eventBus.on("loaded-protyle-dynamic", state.protyleDynamicHandler);

  // Document switched → update context
  state.protyleSwitchHandler = ({ detail }: { detail: any }) => {
    const rootId = detail?.protyle?.block?.rootID;
    if (rootId) {
      pluginEventBus.emit("document:switched", { rootId });
    }
  };
  plugin.eventBus.on("switch-protyle", state.protyleSwitchHandler);

  // Document closed → cleanup
  state.protyleDestroyHandler = ({ detail }: { detail: any }) => {
    const rootId = detail?.protyle?.block?.rootID;
    if (rootId) {
      pluginEventBus.emit("document:closed", { rootId });
    }
  };
  plugin.eventBus.on("destroy-protyle", state.protyleDestroyHandler);
}

/**
 * Wire internal event bus into the scheduler for event-driven rechecks.
 * Events trigger immediate scheduler checks (debounced 500ms).
 */
export function registerSchedulerEventTriggers(
  state: EventHandlerState,
  pluginEventBus: PluginEventBus,
  scheduler: Scheduler
): void {
  const events = [
    "task:refresh",
    "task:create",
    "document:saved",
    "document:opened",
  ] as const;

  for (const evt of events) {
    const handler = () => {
      if (state.schedulerDebounceTimer) {
        clearTimeout(state.schedulerDebounceTimer);
      }
      state.schedulerDebounceTimer = setTimeout(() => {
        scheduler.triggerCheck();
        state.schedulerDebounceTimer = null;
      }, 500);
    };
    const unsub = pluginEventBus.on(evt, handler);
    state.schedulerEventCleanups.push(unsub);
  }
}

/**
 * Unregister all SiYuan native event bus handlers.
 */
export function unregisterSiYuanEventHandlers(
  state: EventHandlerState,
  eventBus: EventBus
): void {
  if (state.wsMainHandler) {
    eventBus.off("ws-main", state.wsMainHandler);
    state.wsMainHandler = null;
  }
  if (state.blockIconHandler) {
    eventBus.off("click-blockicon", state.blockIconHandler);
    state.blockIconHandler = null;
  }
  if (state.protyleLoadedHandler) {
    eventBus.off("loaded-protyle-static", state.protyleLoadedHandler);
    state.protyleLoadedHandler = null;
  }
  if (state.protyleDynamicHandler) {
    eventBus.off("loaded-protyle-dynamic", state.protyleDynamicHandler);
    state.protyleDynamicHandler = null;
  }
  if (state.protyleSwitchHandler) {
    eventBus.off("switch-protyle", state.protyleSwitchHandler);
    state.protyleSwitchHandler = null;
  }
  if (state.protyleDestroyHandler) {
    eventBus.off("destroy-protyle", state.protyleDestroyHandler);
    state.protyleDestroyHandler = null;
  }

  // Cleanup scheduler event triggers
  for (const unsub of state.schedulerEventCleanups) {
    try { unsub(); } catch { /* ignore */ }
  }
  state.schedulerEventCleanups.length = 0;

  if (state.schedulerDebounceTimer) {
    clearTimeout(state.schedulerDebounceTimer);
    state.schedulerDebounceTimer = null;
  }
}

/**
 * Add task-related context menu items to block icon menu.
 */
function addBlockContextMenu(
  detail: any,
  pluginEventBus: PluginEventBus,
  blockMetadataService: BlockMetadataService,
  openQuickTaskEditor: () => void,
  plugin: Plugin,
  openTaskEditorForBlock?: (blockId: string, blockContent: string) => void
): void {
  // "Edit as Task" — opens the task editor dialog for this block
  detail.menu.addItem({
    id: "taskRecurring_editAsTask",
    iconHTML: '<svg class="b3-menu__icon"><use xlink:href="#iconTaskRecurring"></use></svg>',
    label: plugin.i18n?.editAsTask || "Edit as Task",
    click: () => {
      const blockId =
        detail.blockElements?.[0]?.getAttribute?.("data-node-id");
      const blockContent =
        detail.blockElements?.[0]?.textContent?.trim() || "";
      if (blockId && openTaskEditorForBlock) {
        openTaskEditorForBlock(blockId, blockContent);
      } else if (blockId) {
        // Fallback: emit create event + open editor
        pluginEventBus.emit("task:create", {
          source: "block-context-menu",
          linkedBlockId: blockId,
          linkedBlockContent: blockContent,
        });
        openQuickTaskEditor();
      }
    },
  });

  detail.menu.addItem({
    id: "taskRecurring_linkTask",
    iconHTML: '<svg class="b3-menu__icon"><use xlink:href="#iconTaskRecurring"></use></svg>',
    label: plugin.i18n?.linkToTask || "Link to Task",
    click: () => {
      const blockId =
        detail.blockElements?.[0]?.getAttribute?.("data-node-id");
      if (blockId) {
        pluginEventBus.emit("task:create", {
          source: "block-context-menu",
          linkedBlockId: blockId,
          linkedBlockContent:
            detail.blockElements?.[0]?.textContent?.trim() || "",
        });
        openQuickTaskEditor();
      }
    },
  });

  detail.menu.addItem({
    id: "taskRecurring_viewTaskMeta",
    iconHTML: '<svg class="b3-menu__icon"><use xlink:href="#iconTaskNotification"></use></svg>',
    label: plugin.i18n?.viewTaskMetadata || "View Task Metadata",
    click: async () => {
      const blockId =
        detail.blockElements?.[0]?.getAttribute?.("data-node-id");
      if (blockId) {
        const meta = await blockMetadataService.getTaskAttributes(blockId);
        if (meta) {
          try {
            showMessage(
              `Task: ${meta.taskId} | Status: ${meta.status} | Priority: ${meta.priority}`,
              6000,
              "info"
            );
          } catch {
            console.log(`Task: ${meta.taskId} | Status: ${meta.status}`);
          }
        } else {
          try {
            showMessage("No task metadata on this block", 6000, "info");
          } catch {
            console.log("No task metadata on this block");
          }
        }
      }
    },
  });
}
