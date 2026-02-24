/**
 * Dock Mount Adapters
 *
 * SiYuan dock panel mount controllers for Svelte components.
 * Dashboard and Reminder docks are registered via plugin/docks.ts.
 * Only Calendar dock is mounted here (Phase 4 addition).
 */

import type { Plugin } from "siyuan";
import { adaptHotkey } from "siyuan";
import { mount, unmount } from "svelte";
import CalendarView from "@frontend/components/calendar/CalendarView.svelte";
import { resolveDockElement } from "@infrastructure/integrations/siyuan/DockAdapter";
import {
  DOCK_TYPE_CALENDAR,
} from "../../plugin/constants";
import type { PluginServices } from "../../plugin/types";
import type { MountHandle } from "./types";

// ─── State ──────────────────────────────────────────────────
let calendarHandle: ReturnType<typeof mount> | null = null;

// ─── Chrome builders ────────────────────────────────────────

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

function buildMobileDockChrome(iconId: string, title: string): string {
  return `
    <div class="toolbar toolbar--border toolbar--dark">
      <svg class="toolbar__icon"><use xlink:href="#${iconId}"></use></svg>
      <div class="toolbar__text">${title}</div>
    </div>
    <div class="fn__flex-1 dock__content" style="overflow:auto;"></div>`;
}

// ─── Calendar Dock ──────────────────────────────────────────

/**
 * Register Calendar View as a SiYuan dock panel.
 * New dock panel — Phase 4.
 */
export function mountCalendarDock(
  plugin: Plugin,
  services: PluginServices
): MountHandle {
  plugin.addDock({
    config: {
      position: "LeftBottom",
      size: { width: 420, height: 500 },
      icon: "iconTaskCalendar",
      title: plugin.i18n?.calendarTitle || "Task Calendar",
      hotkey: "⌥⌘C",
    },
    data: { text: plugin.i18n?.calendarTitle || "Task Calendar" },
    type: DOCK_TYPE_CALENDAR,
    resize() {},
    update() {},
    init: (dock) => {
      const { element } = resolveDockElement(dock);
      element.innerHTML = services.isMobile
        ? buildMobileDockChrome("iconTaskCalendar", plugin.i18n?.calendarTitle || "Task Calendar")
        : buildDesktopDockChrome("iconTaskCalendar", plugin.i18n?.calendarTitle || "Task Calendar");

      const contentEl = element.querySelector(".dock__content") as HTMLElement;
      if (calendarHandle) {
        try { unmount(calendarHandle); } catch { /* ok */ }
      }
      calendarHandle = mount(CalendarView, {
        target: contentEl || element,
        props: {
          taskStorage: services.taskStorage,
          pluginEventBus: services.pluginEventBus,
          plugin: services.plugin,
          isMobile: services.isMobile,
        },
      });
    },
    destroy: () => {
      if (calendarHandle) {
        try { unmount(calendarHandle); } catch { /* ok */ }
        calendarHandle = null;
      }
    },
  });

  return {
    destroy() {
      if (calendarHandle) {
        try { unmount(calendarHandle); } catch { /* ok */ }
        calendarHandle = null;
      }
    },
  };
}
