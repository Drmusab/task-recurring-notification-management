/**
 * Frontend Mount Controller
 *
 * Central registry of all UI mount points in the plugin.
 * Each mount function connects a Svelte component to a SiYuan lifecycle hook
 * (addDock, addTab, Dialog, addFloatLayer, etc.)
 *
 * Usage from index.ts:
 *   import { mountCalendarDock, ... } from "@frontend/mounts";
 *
 * Note: Dashboard and Reminder docks are registered via plugin/docks.ts.
 * Only Calendar dock uses the dockMounts adapter.
 *
 * Mount Map:
 * ┌──────────────────────┬──────────────────────┬──────────────────────┐
 * │ Component            │ Mount Method         │ Trigger              │
 * ├──────────────────────┼──────────────────────┼──────────────────────┤
 * │ Dashboard.svelte     │ addDock + addTab     │ onload()             │
 * │ ReminderPanel.svelte │ addDock              │ onload()             │
 * │ TaskEditDialog       │ Dialog               │ command/slash/menu   │
 * │ CalendarView.svelte  │ addDock              │ onload()             │
 * │ AnalyticsDashboard   │ lazy Dialog          │ dashboard tab click  │
 * │ ReminderFloat        │ addFloatLayer        │ notification trigger │
 * │ SharedModals         │ Dialog               │ on-demand            │
 * └──────────────────────┴──────────────────────┴──────────────────────┘
 */

// ─── Dock mount adapters ────────────────────────────────────
export {
  mountCalendarDock,
} from "./dockMounts";

// ─── Dialog/Modal mount adapters ────────────────────────────
export {
  openTaskEditDialog,
  openRecurrenceDialog,
  openAboutDialog,
  openKeyboardShortcutsDialog,
  openConfirmationDialog,
} from "./dialogMounts";

// ─── Float layer mount adapters ─────────────────────────────
export { showReminderFloat } from "./floatMounts";

// ─── Lazy-loaded mount adapters ─────────────────────────────
export { openAnalyticsDashboard } from "./lazyMounts";

// ─── Types ──────────────────────────────────────────────────
export type { MountHandle, DialogMountOptions, FloatMountOptions } from "./types";
