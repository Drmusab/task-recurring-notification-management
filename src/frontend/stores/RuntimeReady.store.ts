/**
 * RuntimeReady Store — Lifecycle Guard for All Mount Points
 *
 * Provides granular lifecycle flags that MountService uses to gate
 * every UI mount in the plugin. No component should render until
 * its specific set of prerequisites is satisfied.
 *
 * ── Lifecycle Phases (in boot order) ─────────────────────────
 *   1. plugin.onload() completed         → pluginLoaded
 *   2. BootProgress === 100              → bootComplete
 *   3. TaskStorage.load() completed      → storageLoaded
 *   4. BlockAttrSync.complete()          → blockAttrsValidated
 *   5. Cache.rebuild() completed         → cacheRebuilt
 *   6. Scheduler.sync() completed        → schedulerSynced
 *   7. TaskAnalytics.load() completed    → analyticsLoaded
 *   8. DependencyGraph.ready()           → dependencyGraphReady
 *   9. DomainMapper.ready()              → domainMapperReady
 *   10. TaskLifecycle.ready()            → taskLifecycleReady
 *   11. ALL above                        → runtimeReady
 *
 * ── Per-Mount Gate Signals ───────────────────────────────────
 *   Dashboard:       runtimeReady (all gates)
 *   ReminderPanel:   schedulerSynced + cacheRebuilt
 *   AISuggestions:   analyticsLoaded + runtimeReady
 *   ModalRoot:       domainMapperReady + taskLifecycleReady
 *   Navigation:      dependencyGraphReady + cacheRebuilt
 *   CalendarDock:    runtimeReady
 *
 * Usage in Svelte components:
 *   import { runtimeReady } from '@stores/RuntimeReady.store';
 *   {#if $runtimeReady}
 *     <Dashboard />
 *   {:else}
 *     <LoadingSpinner />
 *   {/if}
 *
 * Called by plugin index.ts / MountService:
 *   import { markBootComplete, markStorageLoaded, ... } from '@stores/RuntimeReady.store';
 *   // On unload:
 *   resetRuntimeReady();
 */

import { writable, derived, get } from 'svelte/store';

// ═══════════════════════════════════════════════════════════════
// Internal state flags (one per lifecycle phase)
// ═══════════════════════════════════════════════════════════════

const pluginLoaded          = writable(false);
const bootComplete          = writable(false);
const storageLoaded         = writable(false);
const blockAttrsValidated   = writable(false);
const cacheRebuilt          = writable(false);
const schedulerSynced       = writable(false);
const analyticsLoaded       = writable(false);
const dependencyGraphReady  = writable(false);
const domainMapperReady     = writable(false);
const taskLifecycleReady    = writable(false);

// ═══════════════════════════════════════════════════════════════
// Derived gate signals — consumed by MountService
// ═══════════════════════════════════════════════════════════════

/**
 * ALL lifecycle prerequisites met — the master gate.
 * Dashboard + Calendar dock gate on this.
 */
export const runtimeReady = derived(
  [
    pluginLoaded, bootComplete, storageLoaded,
    blockAttrsValidated, cacheRebuilt, schedulerSynced,
    analyticsLoaded, dependencyGraphReady, domainMapperReady,
    taskLifecycleReady,
  ],
  ([
    $pluginLoaded, $bootComplete, $storageLoaded,
    $blockAttrsValidated, $cacheRebuilt, $schedulerSynced,
    $analyticsLoaded, $dependencyGraphReady, $domainMapperReady,
    $taskLifecycleReady,
  ]) =>
    $pluginLoaded && $bootComplete && $storageLoaded &&
    $blockAttrsValidated && $cacheRebuilt && $schedulerSynced &&
    $analyticsLoaded && $dependencyGraphReady && $domainMapperReady &&
    $taskLifecycleReady
);

/**
 * ReminderPanel gate: scheduler synced + cache rebuilt.
 */
export const reminderReady = derived(
  [schedulerSynced, cacheRebuilt, storageLoaded, bootComplete],
  ([$schedulerSynced, $cacheRebuilt, $storageLoaded, $bootComplete]) =>
    $schedulerSynced && $cacheRebuilt && $storageLoaded && $bootComplete
);

/**
 * AI Suggestions gate: analytics loaded + full runtime.
 */
export const aiPanelReady = derived(
  [analyticsLoaded, cacheRebuilt, storageLoaded, bootComplete],
  ([$analyticsLoaded, $cacheRebuilt, $storageLoaded, $bootComplete]) =>
    $analyticsLoaded && $cacheRebuilt && $storageLoaded && $bootComplete
);

/**
 * Modal root gate: domain mapper + task lifecycle ready.
 */
export const modalReady = derived(
  [domainMapperReady, taskLifecycleReady, storageLoaded, bootComplete],
  ([$domainMapperReady, $taskLifecycleReady, $storageLoaded, $bootComplete]) =>
    $domainMapperReady && $taskLifecycleReady && $storageLoaded && $bootComplete
);

/**
 * Navigation gate: dependency graph + query service ready.
 */
export const navigationReady = derived(
  [dependencyGraphReady, cacheRebuilt, storageLoaded, bootComplete],
  ([$dependencyGraphReady, $cacheRebuilt, $storageLoaded, $bootComplete]) =>
    $dependencyGraphReady && $cacheRebuilt && $storageLoaded && $bootComplete
);

// ═══════════════════════════════════════════════════════════════
// Lifecycle API — called from plugin index.ts / MountService
// ═══════════════════════════════════════════════════════════════

/** Mark plugin.onload() as complete. */
export function markPluginLoaded(): void {
  pluginLoaded.set(true);
}

/** Mark SiYuan boot progress === 100. */
export function markBootComplete(): void {
  bootComplete.set(true);
}

/** Mark TaskStorage.load() as complete. */
export function markStorageLoaded(): void {
  storageLoaded.set(true);
}

/** Mark block attribute validation as complete. */
export function markBlockAttrsValidated(): void {
  blockAttrsValidated.set(true);
}

/** Mark Cache.rebuild() as complete. */
export function markCacheRebuilt(): void {
  cacheRebuilt.set(true);
}

/** Mark Scheduler.sync() as complete. */
export function markSchedulerSynced(): void {
  schedulerSynced.set(true);
}

/** Mark TaskAnalytics.load() as complete. */
export function markAnalyticsLoaded(): void {
  analyticsLoaded.set(true);
}

/** Mark DependencyGraph as ready. */
export function markDependencyGraphReady(): void {
  dependencyGraphReady.set(true);
}

/** Mark DomainMapper as ready. */
export function markDomainMapperReady(): void {
  domainMapperReady.set(true);
}

/** Mark TaskLifecycle as ready. */
export function markTaskLifecycleReady(): void {
  taskLifecycleReady.set(true);
}

/**
 * Convenience: mark ALL prerequisites at once.
 * Equivalent to calling every individual mark function.
 */
export function markRuntimeReady(): void {
  pluginLoaded.set(true);
  bootComplete.set(true);
  storageLoaded.set(true);
  blockAttrsValidated.set(true);
  cacheRebuilt.set(true);
  schedulerSynced.set(true);
  analyticsLoaded.set(true);
  dependencyGraphReady.set(true);
  domainMapperReady.set(true);
  taskLifecycleReady.set(true);
}

/**
 * Check current readiness synchronously (non-reactive).
 */
export function isRuntimeReady(): boolean {
  return get(runtimeReady);
}

/**
 * Get a snapshot of all individual flags (for diagnostics).
 */
export function getLifecycleSnapshot(): Record<string, boolean> {
  return {
    pluginLoaded: get(pluginLoaded),
    bootComplete: get(bootComplete),
    storageLoaded: get(storageLoaded),
    blockAttrsValidated: get(blockAttrsValidated),
    cacheRebuilt: get(cacheRebuilt),
    schedulerSynced: get(schedulerSynced),
    analyticsLoaded: get(analyticsLoaded),
    dependencyGraphReady: get(dependencyGraphReady),
    domainMapperReady: get(domainMapperReady),
    taskLifecycleReady: get(taskLifecycleReady),
  };
}

/**
 * Reset all flags to false. Called on plugin unload to prevent
 * stale state across hot-reloads.
 */
export function resetRuntimeReady(): void {
  pluginLoaded.set(false);
  bootComplete.set(false);
  storageLoaded.set(false);
  blockAttrsValidated.set(false);
  cacheRebuilt.set(false);
  schedulerSynced.set(false);
  analyticsLoaded.set(false);
  dependencyGraphReady.set(false);
  domainMapperReady.set(false);
  taskLifecycleReady.set(false);
}
