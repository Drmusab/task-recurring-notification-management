/**
 * MountService — Lifecycle-Aware UI Mount Orchestrator
 *
 * Central controller that gates ALL UI mounts on runtime lifecycle signals.
 * Prevents the mount layer from rendering UI before backend data is ready.
 *
 * ── Boot Flow ────────────────────────────────────────────────
 *   plugin.onload()
 *     ↓
 *   await BootProgress === 100
 *     ↓
 *   TaskStorage.load()
 *     ↓
 *   BlockAttrSync.complete()    (via /api/attr/getBlockAttrs)
 *     ↓
 *   Cache.rebuild()
 *     ↓
 *   Scheduler.sync()
 *     ↓
 *   Analytics.load()
 *     ↓
 *   RuntimeReady.emit()
 *     ↓
 *   MountService.mountAll()     (gates per-mount)
 *
 * ── Mount Rules ──────────────────────────────────────────────
 *   Dashboard:      runtimeReady     (all gates)
 *   ReminderPanel:  reminderReady    (scheduler + cache)
 *   AI Panel:       aiPanelReady     (analytics + cache)
 *   Modal Root:     modalReady       (domain mapper + lifecycle)
 *   Navigation:     navigationReady  (dependency graph + cache)
 *   Calendar Dock:  runtimeReady     (all gates)
 *
 * ── Forbidden ────────────────────────────────────────────────
 *   Mount layer must NOT:
 *   ❌ call Scheduler
 *   ❌ access TaskStorage
 *   ❌ mutate Domain
 *   ❌ compute Analytics
 *   ❌ call Integration
 *   ❌ parse Markdown
 *   ❌ modify block
 *
 *   Mount must ONLY:
 *   ✔ inject UI
 *   ✔ subscribe to EventService (after RuntimeReady)
 *
 * ── Unmount ──────────────────────────────────────────────────
 *   All mounts unsubscribe on plugin.onunload() via destroyAll().
 */

import { get, type Unsubscriber } from "svelte/store";
import type { Plugin } from "siyuan";
import type { PluginServices } from "../../plugin/types";
import type {
  MountHandle,
  DeferredMount,
  MountServiceConfig,
  BootProgressConfig,
  LifecycleGate,
} from "./types";
import * as logger from "@shared/logging/logger";
import { siyuanRequestSafe } from "@backend/core/api/SiYuanApiClient";
import {
  runtimeReady,
  reminderReady,
  aiPanelReady,
  modalReady,
  navigationReady,
  markBootComplete,
  getLifecycleSnapshot,
} from "../stores/RuntimeReady.store";

// ══════════════════════════════════════════════════════════════
// Boot Progress Poller
// ══════════════════════════════════════════════════════════════

/**
 * Poll SiYuan's /api/system/bootProgress until it reaches 100.
 * Returns a promise that resolves when boot is complete OR times out.
 */
async function waitForBootProgress(config?: BootProgressConfig): Promise<boolean> {
  const pollMs = config?.pollIntervalMs ?? 200;
  const timeoutMs = config?.timeoutMs ?? 30_000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const result = await siyuanRequestSafe<{ progress: number; details?: string }>(
        "/api/system/bootProgress",
        {},
      );
      if (result && result.progress >= 100) {
        return true;
      }
    } catch {
      // Network error during boot — keep polling
    }
    await sleep(pollMs);
  }

  logger.warn("[MountService] Boot progress poll timed out — proceeding anyway");
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ══════════════════════════════════════════════════════════════
// Gate Store Map
// ══════════════════════════════════════════════════════════════

/** Map gate names to their Svelte derived stores */
function getGateStore(gate: LifecycleGate) {
  switch (gate) {
    case "runtimeReady":    return runtimeReady;
    case "reminderReady":   return reminderReady;
    case "aiPanelReady":    return aiPanelReady;
    case "modalReady":      return modalReady;
    case "navigationReady": return navigationReady;
  }
}

// ══════════════════════════════════════════════════════════════
// MountService
// ══════════════════════════════════════════════════════════════

export class MountService {
  private plugin: Plugin;
  private services: PluginServices;

  /** All registered deferred mounts */
  private mounts: DeferredMount[] = [];

  /** Svelte store unsubscribers (cleaned up on destroy) */
  private gateUnsubscribers: Unsubscriber[] = [];

  /** Whether the service has been started */
  private started = false;

  /** Whether boot progress has been confirmed */
  private bootConfirmed = false;

  constructor(config: MountServiceConfig) {
    this.plugin = config.plugin;
    this.services = config.services;
  }

  // ────────────────────────────────────────────────────────────
  // Registration API
  // ────────────────────────────────────────────────────────────

  /**
   * Register a deferred mount point.
   * The mount function will be called ONLY when its gate signal becomes true.
   *
   * @param name   Human-readable name for diagnostics
   * @param gate   Which lifecycle gate to wait for
   * @param mountFn  The function that performs the actual UI mount
   */
  register(name: string, gate: LifecycleGate, mountFn: () => MountHandle | void): void {
    if (this.started) {
      logger.warn(`[MountService] Cannot register "${name}" — service already started`);
      return;
    }
    this.mounts.push({
      name,
      gate,
      mount: mountFn,
      mounted: false,
      handle: null,
    });
  }

  // ────────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────────

  /**
   * Start the MountService.
   *
   * 1. Awaits SiYuan boot progress === 100
   * 2. Marks bootComplete in RuntimeReady store
   * 3. Subscribes to each gate store and mounts when ready
   *
   * Call this from plugin.onLayoutReady() AFTER all backend services
   * have been initialized and their lifecycle marks set.
   */
  async start(bootConfig?: BootProgressConfig): Promise<void> {
    if (this.started) return;
    this.started = true;

    logger.info("[MountService] Starting — awaiting boot progress...");

    // Phase 1: Wait for SiYuan kernel boot to complete
    this.bootConfirmed = await waitForBootProgress(bootConfig);
    markBootComplete();
    logger.info(`[MountService] Boot progress confirmed: ${this.bootConfirmed}`);

    // Phase 2: Subscribe to gate stores and mount when ready
    this.subscribeToGates();

    // Phase 3: Check if any gates are already satisfied (late start scenario)
    this.checkAndMountReady();

    logger.info("[MountService] Started — monitoring lifecycle gates", {
      pendingMounts: this.mounts.filter(m => !m.mounted).map(m => m.name),
      snapshot: getLifecycleSnapshot(),
    });
  }

  /**
   * Subscribe to all unique gate stores used by registered mounts.
   * When a gate flips to true, mount all pending mounts for that gate.
   */
  private subscribeToGates(): void {
    // Collect unique gates
    const uniqueGates = new Set(this.mounts.map(m => m.gate));

    for (const gate of uniqueGates) {
      const store = getGateStore(gate);
      const unsub = store.subscribe((ready) => {
        if (ready) {
          this.mountForGate(gate);
        }
      });
      this.gateUnsubscribers.push(unsub);
    }
  }

  /**
   * Mount all pending mounts that are gated on the given signal.
   */
  private mountForGate(gate: LifecycleGate): void {
    for (const deferred of this.mounts) {
      if (deferred.gate === gate && !deferred.mounted) {
        this.activateMount(deferred);
      }
    }
  }

  /**
   * Immediately check all gates and mount anything that's already ready.
   * Handles the case where lifecycle marks were set before subscriptions.
   */
  private checkAndMountReady(): void {
    for (const deferred of this.mounts) {
      if (deferred.mounted) continue;
      const store = getGateStore(deferred.gate);
      if (get(store)) {
        this.activateMount(deferred);
      }
    }
  }

  /**
   * Activate a single deferred mount.
   * Wraps the call in try/catch to prevent one mount failure from
   * blocking others.
   */
  private activateMount(deferred: DeferredMount): void {
    if (deferred.mounted) return;

    try {
      logger.info(`[MountService] Mounting "${deferred.name}" (gate: ${deferred.gate})`);
      const handle = deferred.mount();
      deferred.handle = handle ?? null;
      deferred.mounted = true;
    } catch (err) {
      logger.error(`[MountService] Failed to mount "${deferred.name}":`, err);
      // Mark as mounted to prevent retry loops — mount errors are not transient
      deferred.mounted = true;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Query API (for diagnostics)
  // ────────────────────────────────────────────────────────────

  /**
   * Get the current mount status for all registered mounts.
   */
  getStatus(): Array<{ name: string; gate: LifecycleGate; mounted: boolean }> {
    return this.mounts.map(m => ({
      name: m.name,
      gate: m.gate,
      mounted: m.mounted,
    }));
  }

  /**
   * Check whether a specific named mount is active.
   */
  isMounted(name: string): boolean {
    return this.mounts.find(m => m.name === name)?.mounted ?? false;
  }

  /**
   * Get the MountHandle for a specific named mount (if active).
   */
  getHandle(name: string): MountHandle | null {
    return this.mounts.find(m => m.name === name)?.handle ?? null;
  }

  // ────────────────────────────────────────────────────────────
  // Cleanup
  // ────────────────────────────────────────────────────────────

  /**
   * Destroy all active mounts and unsubscribe from all gate stores.
   * Call this from plugin.onunload().
   *
   * Order: unsubscribe gates FIRST, then destroy mounts.
   * This prevents gate callbacks from re-mounting during teardown.
   */
  destroyAll(): void {
    logger.info("[MountService] Destroying all mounts...");

    // 1. Unsubscribe from gate stores (prevents new mounts during teardown)
    for (const unsub of this.gateUnsubscribers) {
      try { unsub(); } catch { /* already unsubscribed */ }
    }
    this.gateUnsubscribers = [];

    // 2. Destroy all active mount handles (reverse registration order)
    const mountsCopy = [...this.mounts];
    for (let i = mountsCopy.length - 1; i >= 0; i--) {
      const deferred = mountsCopy[i]!;
      if (deferred.handle) {
        try {
          deferred.handle.destroy();
          logger.info(`[MountService] Destroyed "${deferred.name}"`);
        } catch (err) {
          logger.error(`[MountService] Error destroying "${deferred.name}":`, err);
        }
        deferred.handle = null;
      }
      deferred.mounted = false;
    }

    // 3. Clear registry
    this.mounts = [];
    this.started = false;
    this.bootConfirmed = false;

    logger.info("[MountService] All mounts destroyed");
  }
}
