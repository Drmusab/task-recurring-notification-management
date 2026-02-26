/**
 * Frontend Mount Controller
 *
 * Central registry of all UI mount points in the plugin.
 * Each mount function connects a Svelte component to a SiYuan lifecycle hook
 * (addDock, addTab, Dialog, addFloatLayer, etc.)
 *
 * ── Lifecycle-Aware Architecture ────────────────────────────
 *
 * All mounts are gated by the MountService, which waits for specific
 * lifecycle signals before activating each UI component:
 *
 *   plugin.onload()
 *     ↓
 *   await BootProgress === 100
 *     ↓
 *   TaskStorage.load()  →  BlockAttrSync  →  Cache.rebuild()
 *     ↓                                        ↓
 *   Scheduler.sync()  →  Analytics.load()  →  RuntimeReady.emit()
 *     ↓
 *   MountService.mountAll()  (gates per-mount on lifecycle signals)
 *
 * ── Mount Map ───────────────────────────────────────────────
 * ┌──────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐
 * │ Component            │ Mount Method         │ Trigger              │ Lifecycle Gate       │
 * ├──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
 * │ Dashboard.svelte     │ addDock + addTab     │ MountService         │ runtimeReady         │
 * │ ReminderPanel.svelte │ addDock              │ MountService         │ reminderReady        │
 * │ CalendarView.svelte  │ addDock              │ MountService         │ runtimeReady         │
 * │ TaskEditDialog       │ Dialog               │ command/slash/menu   │ modalReady (guarded) │
 * │ AnalyticsDashboard   │ lazy Dialog          │ dashboard tab click  │ aiPanelReady         │
 * │ ReminderFloat        │ Dialog               │ notification trigger │ reminderReady        │
 * │ SharedModals         │ Dialog               │ on-demand            │ (none — read-only)   │
 * └──────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┘
 *
 * Usage from index.ts:
 *   import { MountService, mountCalendarDock, ... } from "@frontend/mounts";
 */

// ─── MountService (lifecycle-aware orchestrator) ────────────
export { MountService } from "./MountService";

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
export type {
  MountHandle,
  DialogMountOptions,
  FloatMountOptions,
  MountServiceConfig,
  LifecycleGate,
  DeferredMount,
  BootProgressConfig,
} from "./types";
