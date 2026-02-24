/**
 * Plugin Constants
 * 
 * Centralized constants for dock types, tab types, and storage keys
 * used throughout the plugin registration and lifecycle.
 */

// ─── Dock & Tab Type Identifiers ────────────────────────────
export const DOCK_TYPE_DASHBOARD = "task-recurring-dashboard-dock";
export const DOCK_TYPE_REMINDERS = "task-recurring-reminders-dock";
export const DOCK_TYPE_CALENDAR = "task-recurring-calendar-dock";
export const TAB_TYPE = "task-recurring-tab";

// ─── Storage Keys ───────────────────────────────────────────
export const STORAGE_NAME = "settings";

// ─── Default Status Options ─────────────────────────────────
export const DEFAULT_STATUS_OPTIONS = [
  {
    symbol: "TODO",
    name: "Todo",
    type: "TODO" as const,
    nextStatusSymbol: "DONE",
  },
  {
    symbol: "DONE",
    name: "Done",
    type: "DONE" as const,
    nextStatusSymbol: "TODO",
  },
  {
    symbol: "IN_PROGRESS",
    name: "In Progress",
    type: "IN_PROGRESS" as const,
    nextStatusSymbol: "DONE",
  },
  {
    symbol: "CANCELLED",
    name: "Cancelled",
    type: "CANCELLED" as const,
    nextStatusSymbol: "TODO",
  },
] as const;
