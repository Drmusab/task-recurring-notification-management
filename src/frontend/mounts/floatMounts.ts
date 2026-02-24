/**
 * Float Layer Mount Adapters
 *
 * Uses SiYuan's native Dialog API for transient reminder overlays.
 * This ensures all UI lives within SiYuan's container system,
 * preventing z-index conflicts and ensuring proper cleanup.
 *
 * Pattern: new Dialog({...}) → render reminders inside → auto-dismiss
 * Based on official plugin-sample Dialog usage patterns.
 */

import { Dialog } from "siyuan";
import type { Plugin } from "siyuan";
import { mount, unmount } from "svelte";
import type { PluginServices } from "../../plugin/types";
import type { MountHandle, FloatMountOptions } from "./types";

/**
 * Show a reminder notification using SiYuan's Dialog API.
 *
 * Creates a SiYuan Dialog with the current due/overdue reminders.
 * Auto-dismisses after a configurable timeout.
 *
 * Triggered by:
 *   - Scheduler when tasks become due
 *   - Top bar notification bell click
 */
export function showReminderFloat(options: FloatMountOptions): MountHandle {
  const { plugin, services, autoHideMs = 8000 } = options;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let dialogInstance: Dialog | null = null;

  dialogInstance = new Dialog({
    title: "🔔 " + (plugin.i18n?.remindersTitle || "Reminders"),
    content: `<div id="reminder-float-root" class="fn__flex-column" style="padding:8px;min-height:60px;max-height:400px;overflow-y:auto;">
      <div style="text-align:center;padding:16px;color:var(--b3-theme-on-surface-light);font-size:13px;">Loading reminders...</div>
    </div>`,
    width: "360px",
    height: "auto",
    transparent: false,
    destroyCallback: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      dialogInstance = null;
    },
  });

  // Load and render reminders inside the dialog
  const container = dialogInstance.element.querySelector("#reminder-float-root") as HTMLElement;
  if (container) {
    loadDueReminders(container, services, plugin);
  }

  // Auto-hide after timeout
  if (autoHideMs > 0) {
    timeoutId = setTimeout(() => {
      dialogInstance?.destroy();
      dialogInstance = null;
    }, autoHideMs);
  }

  return {
    destroy: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      dialogInstance?.destroy();
      dialogInstance = null;
    },
  };
}

/**
 * Load due/overdue tasks and render them as reminder cards inside the dialog.
 */
async function loadDueReminders(
  container: HTMLElement,
  services: PluginServices,
  plugin: Plugin
): Promise<void> {
  try {
    const taskMap = await services.taskStorage.loadActive();
    const tasks = Array.from(taskMap.values());
    const now = new Date();

    // Filter to due/overdue tasks
    const dueOrOverdue = tasks.filter((task: any) => {
      if (task.status === "done" || task.status === "cancelled") return false;
      const dueDate = task.dueAt || task.dueDate;
      if (!dueDate) return false;
      return new Date(dueDate) <= now;
    });

    if (dueOrOverdue.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:20px;color:var(--b3-theme-on-surface-light);font-size:13px;">
          ✅ ${plugin.i18n?.noReminders || "No reminders at the moment"}
        </div>`;
      return;
    }

    // Render reminder cards
    container.innerHTML = dueOrOverdue
      .slice(0, 10)
      .map((task: any) => {
        const name = task.name || task.description || "Unnamed task";
        const dueStr = task.dueAt || task.dueDate || "";
        const overdue = dueStr ? new Date(dueStr) < now : false;
        return `
          <div class="reminder-card" style="
            padding:8px 12px;
            margin-bottom:4px;
            border-radius:4px;
            background:${overdue ? "var(--b3-card-error-background, rgba(255,0,0,0.06))" : "var(--b3-theme-surface)"};
            border-left:3px solid ${overdue ? "var(--b3-theme-error)" : "var(--b3-theme-primary)"};
            font-size:13px;
          ">
            <div style="font-weight:500;color:var(--b3-theme-on-background);">${escapeHtml(name)}</div>
            ${dueStr ? `<div style="font-size:11px;color:${overdue ? "var(--b3-theme-error)" : "var(--b3-theme-on-surface-light)"};margin-top:2px;">${overdue ? "⚠️ Overdue" : "📅"} ${dueStr}</div>` : ""}
          </div>`;
      })
      .join("");

    if (dueOrOverdue.length > 10) {
      container.innerHTML += `
        <div style="text-align:center;padding:8px;color:var(--b3-theme-on-surface-light);font-size:12px;">
          +${dueOrOverdue.length - 10} ${plugin.i18n?.moreReminders || "more reminders"}
        </div>`;
    }
  } catch (err) {
    console.error("[TaskRecurring] Failed to load reminders for float:", err);
    container.innerHTML = `<div style="padding:12px;color:var(--b3-theme-error);font-size:13px;">${plugin.i18n?.reminderLoadError || "Failed to load reminders"}</div>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
