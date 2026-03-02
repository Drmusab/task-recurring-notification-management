/**
 * Mounts Layer — Svelte Component Mounting
 *
 * Handles mounting Svelte components into SiYuan's DOM:
 * dialogs, floating panels, dock panels, and lazy-loaded views.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ MountService manages lifecycle
 *   ✔ All mounts go through lifecycle gates
 *   ✔ Components receive DTOs, not domain models
 *   ❌ No backend imports
 */

export {
  // ── Mount Service ──────────────────────────────────────────
  MountService,

  // ── Dialog Mounts ──────────────────────────────────────────
  openTaskEditDialog,
  openRecurrenceDialog,
  openAboutDialog,
  openKeyboardShortcutsDialog,
  openConfirmationDialog,

  // ── Float Mounts ───────────────────────────────────────────
  showReminderFloat,

  // ── Lazy Mounts ────────────────────────────────────────────
  openAnalyticsDashboard,
} from "@frontend/mounts";

export type {
  MountHandle,
  DialogMountOptions,
  FloatMountOptions,
  MountRegistry,
  LifecycleGate,
  DeferredMount,
  MountServiceConfig,
  BootProgressConfig,
} from "@frontend/mounts/types";

// ── Dock Mounts ──────────────────────────────────────────────
export { mountCalendarDock } from "@frontend/mounts/dockMounts";

// ── Canonical Mount Service (Spec §9) ────────────────────────
export {
  MountService as CanonicalMountService,
  type MountPoint,
} from "./MountService";
