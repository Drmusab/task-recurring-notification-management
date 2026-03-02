/**
 * Top Bar & Menu Module
 * 
 * Registers the top bar icon button and handles the quick actions menu.
 * Based on official plugin-sample addTopBar() + Menu pattern.
 * 
 * Per official sample: addTopBar is called in onLayoutReady() (DOM must be ready).
 */

import type { Plugin } from "siyuan";
import { Menu, openTab } from "siyuan";
import { TAB_TYPE } from "./constants";
import * as logger from "@shared/logging/logger";

export interface TopBarState {
  topBarElement: HTMLElement | null;
}

export function createTopBarState(): TopBarState {
  return {
    topBarElement: null,
  };
}

export interface TopBarCallbacks {
  openQuickTaskEditor: () => void;
  showTodayTasks: () => void;
  openSetting: () => void;
}

/**
 * Register top bar icon button.
 * Per official plugin-sample: addTopBar in onLayoutReady (DOM ready).
 * Click shows a context menu (official pattern).
 */
export function registerTopBarButton(
  plugin: Plugin,
  state: TopBarState,
  isMobile: boolean,
  callbacks: TopBarCallbacks
): void {
  try {
    state.topBarElement = plugin.addTopBar({
      icon: "iconTaskRecurring",
      title: plugin.i18n?.topBarTitle || "Recurring Tasks",
      position: "right",
      callback: () => {
        if (isMobile) {
          showQuickActionsMenu(plugin, isMobile, callbacks);
        } else {
          const rect = state.topBarElement?.getBoundingClientRect();
          if (rect && rect.width > 0) {
            showQuickActionsMenu(plugin, isMobile, callbacks, rect);
          } else {
            // Fallback: try #barMore or #barPlugins (per official sample)
            const fallbackRect =
              document.querySelector("#barMore")?.getBoundingClientRect() ||
              document.querySelector("#barPlugins")?.getBoundingClientRect();
            showQuickActionsMenu(
              plugin,
              isMobile,
              callbacks,
              fallbackRect as DOMRect | undefined
            );
          }
        }
      },
    });
  } catch (error) {
    logger.warn("[TaskRecurring] Top bar registration failed", { error });
  }
}

/**
 * Show quick actions menu from toolbar icon click.
 * Per official plugin-sample: uses SiYuan Menu class.
 */
export function showQuickActionsMenu(
  plugin: Plugin,
  isMobile: boolean,
  callbacks: TopBarCallbacks,
  rect?: DOMRect
): void {
  const menu = new Menu("taskRecurringQuickActions");

  // New Task
  menu.addItem({
    icon: "iconAdd",
    label: plugin.i18n?.createTask || "Create Task",
    click: () => {
      callbacks.openQuickTaskEditor();
    },
  });

  // Today's Tasks
  menu.addItem({
    icon: "iconTaskCalendar",
    label: plugin.i18n?.todayTasks || "Today's Tasks",
    click: () => {
      callbacks.showTodayTasks();
    },
  });

  menu.addSeparator();

  // Open Dashboard Tab
  menu.addItem({
    icon: "iconTaskRecurring",
    label: plugin.i18n?.dockTitle || "Open Dashboard",
    click: () => {
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

  menu.addSeparator();

  // Settings
  menu.addItem({
    icon: "iconSettings",
    label: plugin.i18n?.settings || "Settings",
    click: () => {
      callbacks.openSetting();
    },
  });

  if (isMobile) {
    menu.fullscreen();
  } else {
    menu.open({
      x: rect?.right ?? 0,
      y: rect?.bottom ?? 0,
      isLeft: true,
    });
  }
}
