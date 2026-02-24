/**
 * Tab Registration Module
 * 
 * Registers the Dashboard tab type using SiYuan's addTab() API.
 * Based on official plugin-sample addTab() + Svelte mount pattern.
 */

import type { Plugin } from "siyuan";
import { mount, unmount } from "svelte";
import TaskDashboardDock from "@frontend/components/dashboard/TaskDashboardDock.svelte";
import { TAB_TYPE } from "./constants";
import type { PluginServices } from "./types";

/**
 * State holder for tab-mounted components.
 */
export interface TabState {
  tabDashboardComponent: ReturnType<typeof mount> | null;
}

/**
 * Create initial tab state.
 */
export function createTabState(): TabState {
  return {
    tabDashboardComponent: null,
  };
}

/**
 * Unmount tab dashboard component.
 */
export function unmountTabDashboard(state: TabState): void {
  if (state.tabDashboardComponent) {
    try {
      unmount(state.tabDashboardComponent);
    } catch {
      /* ignore unmount errors during cleanup */
    }
    state.tabDashboardComponent = null;
  }
}

/**
 * Register custom tab type for opening dashboard in a full tab.
 * Based on official plugin-sample addTab() pattern with Svelte mount.
 * 
 * Returns the tab custom function for use with openTab().
 */
export function registerDashboardTab(
  plugin: Plugin,
  state: TabState,
  services: PluginServices
): void {
  plugin.addTab({
    type: TAB_TYPE,
    init() {
      const tabEl = this.element as HTMLElement;
      if (!tabEl) return;
      tabEl.style.height = "100%";

      const tabDiv = document.createElement("div");
      tabDiv.style.height = "100%";
      tabEl.appendChild(tabDiv);

      state.tabDashboardComponent = mount(TaskDashboardDock, {
        target: tabDiv,
        props: {
          taskStorage: services.taskStorage,
          recurrenceEngine: services.recurrenceEngine,
          taskScheduler: services.scheduler,
          notificationService: services.eventService,
          eventBus: services.pluginEventBus,
          plugin: services.plugin,
          taskCreationService: services.taskCreationService,
          autoMigrationService: services.autoMigrationService,
          settings: services.settings,
        },
      });
    },
    beforeDestroy() {
      // Tab about to be destroyed
    },
    destroy() {
      unmountTabDashboard(state);
    },
  });
}
