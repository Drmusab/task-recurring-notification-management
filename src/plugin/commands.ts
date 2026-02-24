/**
 * Command Registration Module
 * 
 * Registers all keyboard commands for the plugin.
 * Based on official plugin-sample addCommand() pattern.
 */

import type { Plugin } from "siyuan";
import { openTab } from "siyuan";
import { TAB_TYPE } from "./constants";

export interface CommandCallbacks {
  showQuickActionsMenu: () => void;
  openQuickTaskEditor: () => void;
  showTodayTasks: () => void;
}

/**
 * Register all keyboard commands for the plugin.
 * Called during onload() phase.
 */
export function registerCommands(
  plugin: Plugin,
  callbacks: CommandCallbacks
): void {
  plugin.addCommand({
    langKey: "openTaskPanel",
    hotkey: "⌘⌥T",
    callback: () => {
      callbacks.showQuickActionsMenu();
    },
  });

  plugin.addCommand({
    langKey: "createQuickTask",
    hotkey: "⌘⇧N",
    callback: () => {
      callbacks.openQuickTaskEditor();
    },
  });

  plugin.addCommand({
    langKey: "todayTasks",
    hotkey: "⌘⌥D",
    callback: () => {
      callbacks.showTodayTasks();
    },
  });

  plugin.addCommand({
    langKey: "openTaskTab",
    hotkey: "⌘⇧T",
    callback: () => {
      openTab({
        app: plugin.app,
        custom: {
          id: plugin.name + TAB_TYPE,
          title: plugin.i18n?.dockTitle || "Recurring Tasks",
          icon: "iconTaskRecurring",
        },
      });
    },
  });
}
