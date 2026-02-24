/**
 * CommandRegistry — Central command dispatcher bound to SiYuan plugin runtime
 *
 * Replaces the deleted internal CommandRegistry with a proper SiYuan-native
 * command system. All commands are registered via:
 *   - plugin.addCommand()       → keyboard shortcuts / command palette
 *   - eventBus "click-blockicon" → block context menu
 *   - plugin.protyleSlash       → slash commands
 *
 * Registry is populated in onload() and cleaned up automatically by SiYuan
 * when the plugin unloads.
 *
 * ┌──────────────────────────────────────────────────────┐
 * │  Command            │  Mount Point                   │
 * ├──────────────────────────────────────────────────────┤
 * │  Create Task        │  block menu + command palette  │
 * │  Toggle Recurring   │  checkbox (runtime bridge)     │
 * │  Open Task Editor   │  slash command + hotkey        │
 * │  Skip Recurrence    │  command palette               │
 * │  Complete Task      │  command palette               │
 * │  Open Dashboard     │  command palette + hotkey      │
 * │  Today's Tasks      │  command palette + hotkey      │
 * └──────────────────────────────────────────────────────┘
 */

import type { Plugin } from "siyuan";
import { openTab } from "siyuan";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { Scheduler } from "@backend/core/engine/Scheduler";
import type { SiYuanRuntimeBridge } from "@backend/runtime/SiYuanRuntimeBridge";
import * as logger from "@backend/logging/logger";
import { TAB_TYPE } from "../../plugin/constants";

// ─── Command Definition ──────────────────────────────────────

export interface TaskCommand {
  id: string;
  langKey: string;
  hotkey?: string;
  /** Where this command mounts */
  mount: "command-palette" | "block-menu" | "slash" | "checkbox";
  /** The callback to execute */
  execute: (...args: any[]) => void | Promise<void>;
}

export interface CommandRegistryDeps {
  plugin: Plugin;
  pluginEventBus: PluginEventBus;
  scheduler: Scheduler;
  runtimeBridge?: SiYuanRuntimeBridge;
  openQuickTaskEditor: () => void;
  showTodayTasks: () => void;
  openTaskEditorForBlock?: (blockId: string, blockContent: string) => void;
  showQuickActionsMenu?: () => void;
  openSetting?: () => void;
}

// ─── Registry Class ──────────────────────────────────────────

export class CommandRegistry {
  private commands: Map<string, TaskCommand> = new Map();
  private cleanups: (() => void)[] = [];

  /**
   * Register all task commands with SiYuan's plugin system.
   * Call in onload().
   */
  register(deps: CommandRegistryDeps): void {
    const { plugin, pluginEventBus, scheduler } = deps;

    // ── 1. Create Recurring Task (command palette + hotkey) ──
    const createTaskCmd: TaskCommand = {
      id: "createRecurringTask",
      langKey: "createRecurringTask",
      hotkey: "⌘⌥T",
      mount: "command-palette",
      execute: () => deps.openQuickTaskEditor(),
    };
    this.commands.set(createTaskCmd.id, createTaskCmd);
    plugin.addCommand({
      langKey: createTaskCmd.langKey,
      hotkey: createTaskCmd.hotkey!,
      callback: () => createTaskCmd.execute(),
    });

    // ── 2. Open Task Editor (slash + hotkey) ──
    const openEditorCmd: TaskCommand = {
      id: "openTaskEditor",
      langKey: "createQuickTask",
      hotkey: "⌘⇧N",
      mount: "command-palette",
      execute: () => deps.openQuickTaskEditor(),
    };
    this.commands.set(openEditorCmd.id, openEditorCmd);
    plugin.addCommand({
      langKey: openEditorCmd.langKey,
      hotkey: openEditorCmd.hotkey!,
      callback: () => openEditorCmd.execute(),
    });

    // ── 3. Skip Recurrence (command palette) ──
    const skipCmd: TaskCommand = {
      id: "skipRecurrence",
      langKey: "skipRecurrence",
      hotkey: "⌘⌥S",
      mount: "command-palette",
      execute: () => {
        // Emit skip event — TaskManager will handle the actual skip
        pluginEventBus.emit("task:refresh", undefined);
        logger.info("[CommandRegistry] Skip recurrence triggered via command palette");
      },
    };
    this.commands.set(skipCmd.id, skipCmd);
    plugin.addCommand({
      langKey: skipCmd.langKey,
      hotkey: skipCmd.hotkey!,
      callback: () => skipCmd.execute(),
    });

    // ── 4. Today's Tasks (command palette + hotkey) ──
    const todayCmd: TaskCommand = {
      id: "todayTasks",
      langKey: "todayTasks",
      hotkey: "⌘⌥D",
      mount: "command-palette",
      execute: () => deps.showTodayTasks(),
    };
    this.commands.set(todayCmd.id, todayCmd);
    plugin.addCommand({
      langKey: todayCmd.langKey,
      hotkey: todayCmd.hotkey!,
      callback: () => todayCmd.execute(),
    });

    // ── 5. Open Dashboard Tab (command palette + hotkey) ──
    const dashboardCmd: TaskCommand = {
      id: "openTaskTab",
      langKey: "openTaskTab",
      hotkey: "⌘⇧T",
      mount: "command-palette",
      execute: () => {
        openTab({
          app: plugin.app,
          custom: {
            id: plugin.name + TAB_TYPE,
            title: plugin.i18n?.dockTitle || "Recurring Tasks",
            icon: "iconTaskRecurring",
          },
        });
      },
    };
    this.commands.set(dashboardCmd.id, dashboardCmd);
    plugin.addCommand({
      langKey: dashboardCmd.langKey,
      hotkey: dashboardCmd.hotkey!,
      callback: () => dashboardCmd.execute(),
    });

    // ── 6. Toggle Recurring via checkbox (runtime bridge subscription) ──
    if (deps.runtimeBridge) {
      const unsub = deps.runtimeBridge.subscribeCheckboxToggle((evt) => {
        logger.info("[CommandRegistry] Checkbox toggled", {
          blockId: evt.blockId,
          checked: evt.checked,
        });
        // Emit into plugin event bus for TaskManager to handle
        if (evt.checked) {
          pluginEventBus.emit("task:complete", { taskId: evt.blockId });
        }
      });
      this.cleanups.push(unsub);
    }

    // ── 7. Quick Actions Menu (command palette) ──
    if (deps.showQuickActionsMenu) {
      const quickActionsCmd: TaskCommand = {
        id: "openTaskPanel",
        langKey: "openTaskPanel",
        hotkey: "⌘⌥P",
        mount: "command-palette",
        execute: () => deps.showQuickActionsMenu!(),
      };
      this.commands.set(quickActionsCmd.id, quickActionsCmd);
      plugin.addCommand({
        langKey: quickActionsCmd.langKey,
        hotkey: quickActionsCmd.hotkey!,
        callback: () => quickActionsCmd.execute(),
      });
    }

    logger.info(`[CommandRegistry] Registered ${this.commands.size} commands`);
  }

  /**
   * Get a registered command by ID.
   */
  get(commandId: string): TaskCommand | undefined {
    return this.commands.get(commandId);
  }

  /**
   * Execute a command by ID.
   */
  async execute(commandId: string, ...args: any[]): Promise<void> {
    const cmd = this.commands.get(commandId);
    if (!cmd) {
      logger.warn(`[CommandRegistry] Command not found: ${commandId}`);
      return;
    }
    await cmd.execute(...args);
  }

  /**
   * Get all registered commands.
   */
  getAll(): TaskCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Cleanup all command-related subscriptions.
   * Called in onunload(). SiYuan handles removing plugin.addCommand() registrations.
   */
  destroy(): void {
    for (const cleanup of this.cleanups) {
      try { cleanup(); } catch { /* ignore */ }
    }
    this.cleanups.length = 0;
    this.commands.clear();
    logger.info("[CommandRegistry] Destroyed");
  }
}
