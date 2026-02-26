/**
 * Mount System Types
 *
 * Shared interfaces for all mount adapters and the MountService.
 */

import type { Plugin } from "siyuan";
import type { PluginServices } from "../../plugin/types";
import type { TaskDTO } from '../services/DTOs';
type Task = TaskDTO;

/**
 * Handle returned by any mount operation.
 * Call destroy() to unmount the component.
 */
export interface MountHandle {
  /** Unmount and clean up the component */
  destroy: () => void;
}

/**
 * Options for Dialog-based mounts.
 */
export interface DialogMountOptions {
  /** Plugin instance for SiYuan API access */
  plugin: Plugin;
  /** Full service container */
  services: PluginServices;
  /** Task to edit (null for new task) */
  task?: Task | null;
  /** Callback on save */
  onSave?: (task: Task) => void | Promise<void>;
  /** Callback on delete */
  onDelete?: (task: Task) => void | Promise<void>;
  /** Dialog title override */
  title?: string;
  /** Dialog width override */
  width?: string;
  /** Dialog height override */
  height?: string;
}

/**
 * Options for float layer mounts.
 */
export interface FloatMountOptions {
  /** Plugin instance */
  plugin: Plugin;
  /** Full service container */
  services: PluginServices;
  /** Position rect for float placement */
  position?: { x: number; y: number };
  /** Auto-dismiss timeout in ms (0 = no auto-dismiss) */
  autoHideMs?: number;
}

/**
 * Mount state tracking for lifecycle cleanup.
 */
export interface MountRegistry {
  /** Active dock mounts keyed by dock type */
  docks: Map<string, MountHandle>;
  /** Active dialog mounts */
  dialogs: Set<MountHandle>;
  /** Active float layer mounts */
  floats: Set<MountHandle>;
}

/**
 * Create an empty mount registry.
 */
export function createMountRegistry(): MountRegistry {
  return {
    docks: new Map(),
    dialogs: new Set(),
    floats: new Set(),
  };
}

// ═══════════════════════════════════════════════════════════════
// MountService Types
// ═══════════════════════════════════════════════════════════════

/**
 * Lifecycle gate names — each mount declares which gates it requires.
 */
export type LifecycleGate =
  | "runtimeReady"
  | "reminderReady"
  | "aiPanelReady"
  | "modalReady"
  | "navigationReady";

/**
 * Configuration for a deferred mount point.
 * MountService holds these and activates them when their gate signal fires.
 */
export interface DeferredMount {
  /** Unique name for this mount point (for logging/diagnostics) */
  name: string;
  /** Which lifecycle gate must be satisfied before mounting */
  gate: LifecycleGate;
  /** The actual mount function — called once the gate is open */
  mount: () => MountHandle | void;
  /** Whether this mount has been activated */
  mounted: boolean;
  /** The handle returned by mount(), if any */
  handle: MountHandle | null;
}

/**
 * MountService configuration passed from plugin index.ts.
 */
export interface MountServiceConfig {
  /** Plugin instance */
  plugin: Plugin;
  /** Full service container */
  services: PluginServices;
}

/**
 * Boot progress polling configuration.
 */
export interface BootProgressConfig {
  /** Poll interval in ms (default: 200) */
  pollIntervalMs?: number;
  /** Timeout before giving up (default: 30000) */
  timeoutMs?: number;
}
