/**
 * Lazy Mount Adapters
 *
 * Components that are expensive to render (analytics, charts, etc.)
 * are loaded on-demand rather than during plugin.onload().
 *
 * Uses dynamic import() to code-split heavy dependencies.
 *
 * ── Lifecycle Gate ───────────────────────────────────────────
 *   AnalyticsDashboard mounts with gate: "aiPanelReady".
 *   MountService ensures this dialog is only callable AFTER:
 *     - TaskAnalytics.load() completed
 *     - Cache.rebuild() completed
 *     - StorageLoaded
 *     - BootComplete
 *
 *   The openAnalyticsDashboard() function also performs an
 *   additional isRuntimeReady() guard before rendering.
 *
 * ── Forbidden ────────────────────────────────────────────────
 *   ❌ call Scheduler / TaskStorage / Domain / Integration
 *   ❌ parse Markdown / modify block
 *   ✔ inject UI only
 *   ✔ read from UIQueryService (pre-projected DTOs)
 */

import { Dialog } from "siyuan";
import { mount, unmount } from "svelte";
import type { Plugin } from "siyuan";
import type { PluginServices } from "../../plugin/types";
import type { MountHandle } from "./types";
import { uiQueryService } from "../services/UIQueryService";
import { isRuntimeReady } from "../stores/RuntimeReady.store";

/**
 * Open the Analytics Dashboard in a SiYuan Dialog.
 *
 * Lazy-loads the AnalyticsDashboard component and its D3 dependencies
 * only when the user explicitly requests analytics.
 *
 * This prevents heavy chart rendering during plugin startup.
 *
 * LIFECYCLE GATE: "aiPanelReady"
 * Only callable after TaskAnalytics.load() and Cache.rebuild().
 * An additional isRuntimeReady() guard prevents stale data display.
 *
 * Triggered from:
 *   - Dashboard "Analytics" tab click
 *   - Command palette "Open Analytics"
 *   - Top bar menu "Analytics"
 */
export function openAnalyticsDashboard(options: {
  plugin: Plugin;
  services: PluginServices;
}): MountHandle {
  const { plugin, services } = options;
  let svelteHandle: ReturnType<typeof mount> | null = null;

  // ── Lifecycle guard ──
  if (!isRuntimeReady()) {
    console.warn("[lazyMounts] openAnalyticsDashboard called before runtimeReady — suppressed");
    return { destroy: () => {} };
  }

  const dialog = new Dialog({
    title: plugin.i18n?.analyticsTitle || "Task Analytics",
    content: `
      <div id="analytics-dialog-root" style="padding:16px;min-height:400px;">
        <div class="analytics-loading" style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--b3-theme-on-surface-light);">
          Loading analytics...
        </div>
      </div>`,
    width: "900px",
    height: "600px",
    destroyCallback: () => {
      if (svelteHandle) {
        try { unmount(svelteHandle); } catch { /* ok */ }
        svelteHandle = null;
      }
    },
  });

  const container = dialog.element.querySelector("#analytics-dialog-root") as HTMLElement;

  if (container) {
    // Lazy load analytics module
    lazyLoadAnalytics(container, services).catch((err) => {
      console.error("[TaskRecurring] Analytics lazy load failed:", err);
      container.innerHTML = `
        <div style="padding:40px;text-align:center;">
          <p style="color:var(--b3-theme-error);font-size:14px;">Failed to load analytics</p>
          <p style="color:var(--b3-theme-on-surface-light);font-size:12px;margin-top:8px;">${err.message}</p>
        </div>`;
    });
  }

  return { destroy: () => dialog.destroy() };
}

/**
 * Lazy-load analytics data and render summary.
 * Currently uses the existing TaskAnalytics.store + TrackerDashboard.
 */
async function lazyLoadAnalytics(
  container: HTMLElement,
  services: PluginServices
): Promise<void> {
  // Load tasks via UIQueryService — NOT services.taskStorage.loadActive()
  const tasks = uiQueryService.selectDashboard();

  // Update the analytics store
  const { updateAnalyticsFromTasks, taskAnalyticsStore } = await import("@stores/TaskAnalytics.store");
  updateAnalyticsFromTasks(tasks);

  // Get analytics snapshot
  const snapshot = taskAnalyticsStore.getSnapshot();

  // Clear loading indicator
  container.innerHTML = "";

  // Render analytics summary using plain HTML
  // (Avoids importing heavy Svelte chart components at this stage)
  container.innerHTML = `
    <div class="analytics-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
      ${analyticsCard("Total Tasks", String(snapshot.totalTasks), "📊")}
      ${analyticsCard("Active", String(snapshot.activeTasks), "🟢")}
      ${analyticsCard("Completion Rate", `${snapshot.completionRate.toFixed(1)}%`, "✅")}
      ${analyticsCard("Miss Rate", `${snapshot.missRate.toFixed(1)}%`, "❌")}
      ${analyticsCard("Current Streak", String(snapshot.bestCurrentStreak), "🔥")}
      ${analyticsCard("Overdue", String(snapshot.overdueCount), "⚠️")}
      ${analyticsCard("Due Today", String(snapshot.dueTodayCount), "📅")}
      ${analyticsCard("Due This Week", String(snapshot.dueThisWeekCount), "📆")}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div style="background:var(--b3-theme-surface);border-radius:8px;padding:16px;">
        <h3 style="margin:0 0 12px;font-size:14px;color:var(--b3-theme-on-background);">Health Breakdown</h3>
        <div style="display:flex;gap:16px;">
          ${healthBar("Healthy", snapshot.healthBreakdown.healthy, snapshot.totalTasks, "#22c55e")}
          ${healthBar("Moderate", snapshot.healthBreakdown.moderate, snapshot.totalTasks, "#f59e0b")}
          ${healthBar("Struggling", snapshot.healthBreakdown.struggling, snapshot.totalTasks, "#ef4444")}
        </div>
      </div>
      <div style="background:var(--b3-theme-surface);border-radius:8px;padding:16px;">
        <h3 style="margin:0 0 12px;font-size:14px;color:var(--b3-theme-on-background);">Statistics</h3>
        <div style="font-size:13px;color:var(--b3-theme-on-surface);line-height:1.8;">
          <div>Total Completions: <strong>${snapshot.totalCompletions}</strong></div>
          <div>Total Misses: <strong>${snapshot.totalMisses}</strong></div>
          <div>Best Overall Streak: <strong>${snapshot.bestOverallStreak}</strong></div>
          <div>Average Health: <strong>${snapshot.averageHealth.toFixed(0)}%</strong></div>
        </div>
      </div>
    </div>`;
}

function analyticsCard(label: string, value: string, icon: string): string {
  return `
    <div style="background:var(--b3-theme-surface);border-radius:8px;padding:12px;text-align:center;">
      <div style="font-size:20px;margin-bottom:4px;">${icon}</div>
      <div style="font-size:18px;font-weight:700;color:var(--b3-theme-on-background);">${value}</div>
      <div style="font-size:11px;color:var(--b3-theme-on-surface-light);margin-top:2px;">${label}</div>
    </div>`;
}

function healthBar(label: string, count: number, total: number, color: string): string {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return `
    <div style="flex:1;">
      <div style="font-size:12px;color:var(--b3-theme-on-surface);margin-bottom:4px;">${label}: ${count}</div>
      <div style="height:8px;background:var(--b3-theme-background);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.3s;"></div>
      </div>
    </div>`;
}
