/**
 * EngineController — Lifecycle Orchestrator for the Task Execution Runtime
 *
 * Owns the deterministic boot sequence:
 *   1. CacheManager.start()          → populate block-validated caches
 *   2. DependencyManager.start()     → build + validate dependency graph
 *   3. Scheduler.injectDependencies() → wire DueStateCache, Guard, EventQueue
 *   4. Scheduler.start()             → begin tick loop
 *
 * Owns the shutdown sequence (reverse order):
 *   1. Scheduler.stop()
 *   2. EventQueue.stop()
 *   3. (CacheManager + DependencyManager stopped separately by index.ts)
 *
 * Integration point:
 *   index.ts.onLayoutReady() → engineController.start()
 *   index.ts.onunload()      → engineController.stop()
 *
 * FORBIDDEN:
 *  - import frontend / Svelte
 *  - hold task data (delegates to Scheduler / Caches)
 *  - bypass this controller for engine lifecycle operations
 */

import type { Scheduler } from "./Scheduler";
import type { CacheManager } from "@backend/cache/CacheManager";
import type { DependencyManager } from "@backend/dependencies/DependencyManager";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import { EventQueue } from "./EventQueue";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface EngineControllerDeps {
  scheduler: Scheduler;
  cacheManager: CacheManager;
  dependencyManager: DependencyManager;
  pluginEventBus: PluginEventBus;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class EngineController {
  private readonly scheduler: Scheduler;
  private readonly cacheManager: CacheManager;
  private readonly dependencyManager: DependencyManager;
  private readonly pluginEventBus: PluginEventBus;
  private eventQueue: EventQueue | null = null;
  private active = false;

  constructor(deps: EngineControllerDeps) {
    this.scheduler = deps.scheduler;
    this.cacheManager = deps.cacheManager;
    this.dependencyManager = deps.dependencyManager;
    this.pluginEventBus = deps.pluginEventBus;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Start the engine in deterministic order.
   *
   * Preconditions (caller must ensure):
   *   - TaskStorage.init() has completed
   *   - CacheManager is constructed (but start via this controller)
   *   - DependencyManager is constructed (but start via this controller)
   *
   * Sequence:
   *   CacheManager.start() → DependencyManager.start() → EventQueue.start()
   *   → Scheduler.injectDependencies() → Scheduler.recoverMissedTasks()
   *   → Scheduler.start()
   */
  async start(): Promise<void> {
    if (this.active) {
      logger.warn("[EngineController] Already started — ignoring");
      return;
    }

    logger.info("[EngineController] Starting engine runtime…");

    // 1. Start caches (populates DueStateCache, TaskCache, etc.)
    this.cacheManager.start();
    logger.info("[EngineController] CacheManager started");

    // 2. Start dependency graph (builds DAG, validates)
    this.dependencyManager.start();
    logger.info("[EngineController] DependencyManager started");

    // 3. Create and start EventQueue
    this.eventQueue = new EventQueue({ pluginEventBus: this.pluginEventBus });
    this.eventQueue.start();

    // 4. Inject runtime deps into Scheduler
    this.scheduler.injectDependencies({
      dueStateCache: this.cacheManager.dueStateCache,
      dependencyGuard: this.dependencyManager.guard,
      eventQueue: this.eventQueue,
      pluginEventBus: this.pluginEventBus,
    });

    // 5. Recover missed tasks (async, non-blocking for start)
    try {
      await this.scheduler.recoverMissedTasks();
    } catch (err) {
      logger.warn("[EngineController] Missed task recovery failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 6. Start scheduler tick loop
    this.scheduler.start();

    this.active = true;
    logger.info("[EngineController] Engine runtime started");
  }

  /**
   * Stop the engine in reverse order.
   */
  async stop(): Promise<void> {
    if (!this.active) return;

    logger.info("[EngineController] Stopping engine runtime…");

    // 1. Stop scheduler (persists emitted state)
    await this.scheduler.stop();

    // 2. Stop EventQueue (flushes remaining events)
    if (this.eventQueue) {
      this.eventQueue.stop();
      this.eventQueue = null;
    }

    // Note: CacheManager and DependencyManager are stopped by index.ts
    // in their own teardown order (dependency before cache).

    this.active = false;
    logger.info("[EngineController] Engine runtime stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /** Whether the engine is running. */
  isActive(): boolean {
    return this.active;
  }

  /** Get EventQueue stats for monitoring. */
  getEventQueueStats() {
    return this.eventQueue?.getStats() ?? null;
  }

  /** Get the EventQueue instance (for external enqueue if needed). */
  getEventQueue(): EventQueue | null {
    return this.eventQueue;
  }
}
