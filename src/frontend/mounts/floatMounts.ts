/**
 * Float Layer Mount Adapters
 *
 * Uses SiYuan's native Dialog API for transient reminder overlays.
 * This ensures all UI lives within SiYuan's container system,
 * preventing z-index conflicts and ensuring proper cleanup.
 *
 * ── Lifecycle Gate ───────────────────────────────────────────
 *   ReminderFloat mounts with gate: "reminderReady".
 *   MountService ensures this is only called AFTER:
 *     - Scheduler.sync()
 *     - Cache.rebuild()
 *     - StorageLoaded
 *     - BootComplete
 *
 *   The showReminderFloat() function also performs a runtime guard
 *   check before rendering any task data.
 *
 * ── Forbidden ────────────────────────────────────────────────
 *   ❌ call Scheduler / TaskStorage / Domain / Analytics / Integration
 *   ❌ parse Markdown / modify block
 *   ✔ inject UI only
 *   ✔ read from UIQueryService (pre-projected DTOs only)
 *
 * Pattern: new Dialog({...}) → render reminders inside → auto-dismiss
 * Based on official plugin-sample Dialog usage patterns.
 */

import { Dialog } from "siyuan";
import type { Plugin } from "siyuan";
import { mount, unmount } from "svelte";
import type { PluginServices } from "../../plugin/types";
import type { MountHandle, FloatMountOptions } from "./types";
import { uiQueryService } from "../services/UIQueryService";
import type { TaskDTO } from "../services/DTOs";
import { reminderReady } from "../stores/RuntimeReady.store";
import { get } from "svelte/store";
import * as logger from "@shared/logging/logger";

/**
 * Show a reminder notification using SiYuan's Dialog API.
 *
 * Creates a SiYuan Dialog with the current due/overdue reminders.
 * Auto-dismisses after a configurable timeout.
 *
 * LIFECYCLE GATE: "reminderReady"
 * MountService calls this only after scheduler is synced and
 * reminder queue is ready. An additional isRuntimeReady() guard
 * prevents rendering if somehow triggered outside the gate.
 *
 * Triggered by:
 *   - Scheduler when tasks become due (via attention gate)
 *   - Top bar notification bell click
 */
export function showReminderFloat(options: FloatMountOptions): MountHandle {
  const { plugin, services, autoHideMs = 8000 } = options;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let dialogInstance: Dialog | null = null;

  // ── Lifecycle guard — must use reminderReady, not generic runtimeReady ──
  if (!get(reminderReady)) {
    logger.warn("[floatMounts] showReminderFloat called before reminderReady — suppressed");
    return { destroy: () => {} };
  }

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
 * Load due/overdue tasks via UIQueryService and render them as reminder cards.
 * Sorted by attention-worthiness: overdue first, then by due date.
 * Limited to top 5 most relevant tasks (attention-aware cap).
 */
async function loadDueReminders(
  container: HTMLElement,
  services: PluginServices,
  plugin: Plugin
): Promise<void> {
  try {
    // Use UIQueryService — NOT services.taskStorage.loadActive()
    const allTasks = uiQueryService.selectDashboard();

    // Filter to due/overdue tasks using DTO's pre-computed isOverdue flag
    const dueOrOverdue = allTasks.filter((task: TaskDTO) => {
      if (task.status === "done" || task.status === "cancelled") return false;
      return task.isOverdue || task.lifecycleState === "due";
    });

    if (dueOrOverdue.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:20px;color:var(--b3-theme-on-surface-light);font-size:13px;">
          ✅ ${plugin.i18n?.noReminders || "No reminders at the moment"}
        </div>`;
      return;
    }

    // Sort by overdue first, then by due date (most overdue at top)
    dueOrOverdue.sort((a: TaskDTO, b: TaskDTO) => {
      const aDue = new Date(a.dueAt!).getTime();
      const bDue = new Date(b.dueAt!).getTime();
      return aDue - bDue; // earliest (most overdue) first
    });

    // Attention-aware cap: show at most 5 tasks to prevent cognitive overload
    const MAX_DISPLAY = 5;

    // Render reminder cards
    container.innerHTML = dueOrOverdue
      .slice(0, MAX_DISPLAY)
      .map((task: TaskDTO) => {
        const name = task.name || task.description || "Unnamed task";
        const dueStr = task.dueAt || "";
        const overdue = task.isOverdue;
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

    if (dueOrOverdue.length > MAX_DISPLAY) {
      container.innerHTML += `
        <div style="text-align:center;padding:8px;color:var(--b3-theme-on-surface-light);font-size:12px;">
          +${dueOrOverdue.length - MAX_DISPLAY} ${plugin.i18n?.moreReminders || "more reminders"}
        </div>`;
    }
  } catch (err) {
    logger.error("[TaskRecurring] Failed to load reminders for float", { error: err });
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
