/**
 * Dock Panel Registration Module
 * 
 * Registers Dashboard and Reminder dock panels using SiYuan's addDock() API.
 * Based on official plugin-sample addDock() pattern.
 * 
 * Each dock panel:
 * - Has mobile/desktop chrome variants
 * - Mounts Svelte components into content containers
 * - Properly destroys components on dock close
 */

import type { Plugin } from "siyuan";
import { adaptHotkey } from "siyuan";
import { mount, unmount } from "svelte";
import TaskDashboardDock from "@frontend/components/dashboard/TaskDashboardDock.svelte";
import ReminderPanel from "@frontend/components/reminders/ReminderPanel.svelte";
import { resolveDockElement, validateDockElement } from "@infrastructure/integrations/siyuan/DockAdapter";
import { DOCK_TYPE_DASHBOARD, DOCK_TYPE_REMINDERS } from "./constants";
import type { PluginServices } from "./types";
import { runtimeReady, reminderReady } from "@frontend/stores/RuntimeReady.store";
import { get } from "svelte/store";
import * as logger from "@backend/logging/logger";

/**
 * State holder for dock-mounted components.
 * Allows external cleanup from onunload().
 */
export interface DockState {
  dashboardComponent: ReturnType<typeof mount> | null;
  reminderComponent: ReturnType<typeof mount> | null;
  dockDashboardEl: HTMLElement | null;
  dockReminderEl: HTMLElement | null;
}

/**
 * Create initial dock state.
 */
export function createDockState(): DockState {
  return {
    dashboardComponent: null,
    reminderComponent: null,
    dockDashboardEl: null,
    dockReminderEl: null,
  };
}

/**
 * Mount Dashboard Svelte component into a target element.
 */
function mountDashboard(
  state: DockState,
  target: HTMLElement,
  services: PluginServices
): void {
  if (state.dashboardComponent) {
    unmountDashboard(state);
  }

  try {
    state.dashboardComponent = mount(TaskDashboardDock, {
      target,
      props: {
        plugin: services.plugin,
        settings: services.settings,
        isMobile: services.isMobile,
      },
    });
  } catch (error) {
    logger.error(`[TaskRecurring] Dashboard mount failed:`, error);
  }
}

/**
 * Unmount Dashboard Svelte component.
 */
export function unmountDashboard(state: DockState): void {
  if (state.dashboardComponent) {
    try {
      unmount(state.dashboardComponent);
    } catch (error) {
      logger.error(`[TaskRecurring] Dashboard unmount error:`, error);
    }
    state.dashboardComponent = null;
    state.dockDashboardEl = null;
  }
}

/**
 * Mount Reminder Panel Svelte component into a target element.
 */
function mountReminders(
  state: DockState,
  target: HTMLElement,
  services: PluginServices
): void {
  if (state.reminderComponent) {
    unmountReminders(state);
  }

  try {
    state.reminderComponent = mount(ReminderPanel, {
      target,
      props: {
        plugin: services.plugin,
        isMobile: services.isMobile,
      },
    });
  } catch (error) {
    logger.error(`[TaskRecurring] Reminder panel mount failed:`, error);
  }
}

/**
 * Unmount Reminder Panel Svelte component.
 */
export function unmountReminders(state: DockState): void {
  if (state.reminderComponent) {
    try {
      unmount(state.reminderComponent);
    } catch (error) {
      logger.error(`[TaskRecurring] Reminder unmount error:`, error);
    }
    state.reminderComponent = null;
    state.dockReminderEl = null;
  }
}

/**
 * Build dock chrome HTML for desktop layout.
 */
function buildDesktopDockChrome(iconId: string, title: string): string {
  return `
    <div class="fn__flex-1 fn__flex-column">
      <div class="block__icons">
        <div class="block__logo">
          <svg class="block__logoicon"><use xlink:href="#${iconId}"></use></svg>
          ${title}
        </div>
        <span class="fn__flex-1 fn__space"></span>
        <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="Min ${adaptHotkey("⌘W")}">
          <svg><use xlink:href="#iconMin"></use></svg>
        </span>
      </div>
      <div class="fn__flex-1 dock__content" style="overflow:auto;"></div>
    </div>`;
}

/**
 * Build dock chrome HTML for mobile layout.
 */
function buildMobileDockChrome(iconId: string, title: string): string {
  return `
    <div class="toolbar toolbar--border toolbar--dark">
      <svg class="toolbar__icon"><use xlink:href="#${iconId}"></use></svg>
      <div class="toolbar__text">${title}</div>
    </div>
    <div class="fn__flex-1 dock__content" style="overflow:auto;"></div>`;
}

/**
 * Register the main Dashboard dock panel.
 * Uses official addDock() pattern from plugin-sample.
 */
export function registerDashboardDock(
  plugin: Plugin,
  state: DockState,
  services: PluginServices
): void {
  plugin.addDock({
    config: {
      position: "RightBottom",
      size: { width: 380, height: 550 },
      icon: "iconTaskRecurring",
      title: plugin.i18n?.dockTitle || "Recurring Tasks",
      hotkey: "⌥⌘W",
    },
    data: {
      text: plugin.i18n?.dockTitle || "Recurring Tasks",
    },
    type: DOCK_TYPE_DASHBOARD,
    resize() {
      // Dock resized — no action needed, CSS handles layout
    },
    update() {
      // Dock updated — no action needed
    },
    init: (dock) => {
      const { element } = resolveDockElement(dock);
      state.dockDashboardEl = element;

      if (!validateDockElement(element)) {
        logger.warn(`[TaskRecurring] Dock element validation failed — mounting anyway`);
      }

      element.innerHTML = services.isMobile
        ? buildMobileDockChrome("iconTaskRecurring", plugin.i18n?.dockTitle || "Recurring Tasks")
        : buildDesktopDockChrome("iconTaskRecurring", plugin.i18n?.dockTitle || "Recurring Tasks");

      const contentEl = element.querySelector(".dock__content");
      const target = (contentEl || element) as HTMLElement;

      // Gate: wait for full runtime before mounting dashboard
      if (get(runtimeReady)) {
        mountDashboard(state, target, services);
      } else {
        const unsub = runtimeReady.subscribe((ready) => {
          if (ready) {
            unsub();
            mountDashboard(state, target, services);
          }
        });
      }
    },
    destroy: () => {
      unmountDashboard(state);
    },
  });
}

/**
 * Register the Reminder dock panel.
 * Separate dock for persistent reminder display.
 */
export function registerReminderDock(
  plugin: Plugin,
  state: DockState,
  services: PluginServices
): void {
  plugin.addDock({
    config: {
      position: "RightTop",
      size: { width: 300, height: 350 },
      icon: "iconTaskNotification",
      title: plugin.i18n?.remindersTitle || "Reminders",
      hotkey: "⌥⌘R",
    },
    data: {
      text: plugin.i18n?.remindersTitle || "Reminders",
    },
    type: DOCK_TYPE_REMINDERS,
    resize() {
      // Dock resized — no action needed
    },
    update() {
      // Dock updated — no action needed
    },
    init: (dock) => {
      const { element } = resolveDockElement(dock);
      state.dockReminderEl = element;

      element.innerHTML = services.isMobile
        ? buildMobileDockChrome("iconTaskNotification", plugin.i18n?.remindersTitle || "Reminders")
        : buildDesktopDockChrome("iconTaskNotification", plugin.i18n?.remindersTitle || "Reminders");

      const contentEl = element.querySelector(".dock__content");
      const target = (contentEl || element) as HTMLElement;

      // Gate: wait for reminderReady before mounting reminder panel
      if (get(reminderReady)) {
        mountReminders(state, target, services);
      } else {
        const unsub = reminderReady.subscribe((ready) => {
          if (ready) {
            unsub();
            mountReminders(state, target, services);
          }
        });
      }
    },
    destroy: () => {
      unmountReminders(state);
    },
  });
}
