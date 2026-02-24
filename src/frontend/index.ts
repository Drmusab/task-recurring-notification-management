/**
 * Frontend Module — Plugin UI Mount Controller
 *
 * Central entry point for all UI components, stores, and mount adapters.
 * Each mount function connects a Svelte component to a SiYuan lifecycle hook.
 *
 * Mount Map:
 * ┌───────────────────────────┬──────────────────────┬──────────────────────┐
 * │ Component                 │ Mount Method         │ Trigger              │
 * ├───────────────────────────┼──────────────────────┼──────────────────────┤
 * │ TaskDashboardDock.svelte  │ addDock + addTab     │ onload()             │
 * │ ReminderPanel.svelte      │ addDock              │ onload()             │
 * │ CalendarView.svelte       │ addDock              │ onload()             │
 * │ TaskEditDialog            │ Dialog               │ command/slash/menu   │
 * │ ReminderFloat             │ Float layer          │ notification trigger │
 * │ AnalyticsDashboard        │ lazy Dialog          │ on-demand            │
 * │ SharedModals              │ Dialog               │ on-demand            │
 * │ Chart Adapters            │ lazy D3              │ on panel open        │
 * └───────────────────────────┴──────────────────────┴──────────────────────┘
 *
 * NOTE: Barrel re-exports are kept minimal to avoid circular dependency issues.
 * Import specific modules directly when possible.
 */

// ─── Mount Adapters (SiYuan lifecycle integration) ──────────
export {
  mountCalendarDock,
} from "./mounts/dockMounts";

export {
  openTaskEditDialog,
  openRecurrenceDialog,
  openAboutDialog,
  openKeyboardShortcutsDialog,
  openConfirmationDialog,
} from "./mounts/dialogMounts";

export { showReminderFloat } from "./mounts/floatMounts";
export { openAnalyticsDashboard } from "./mounts/lazyMounts";
export type { MountHandle, DialogMountOptions, FloatMountOptions } from "./mounts/types";

// ─── Chart Adapters (lazy-loaded D3 visualization layer) ────
export {
  renderHeatmapChart,
  renderPieChart,
  renderBulletChart,
} from "./adapters/dashboard";
export type { ChartRenderOptions } from "./adapters/dashboard";

// ─── Modals (SiYuan Dialog wrappers) ────────────────────────
export * from "@frontend/modals";

// ─── Stores (reactive state) ────────────────────────────────
export * from "@frontend/stores";
