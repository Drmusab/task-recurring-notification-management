/**
 * Mount System Types
 *
 * Shared interfaces for all mount adapters.
 */

import type { Plugin } from "siyuan";
import type { PluginServices } from "../../plugin/types";
import type { Task } from "@backend/core/models/Task";

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
