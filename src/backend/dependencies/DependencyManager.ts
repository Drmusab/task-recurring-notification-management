/**
 * DependencyManager — Lifecycle Orchestrator for Dependency Subsystem
 *
 * Single creation + wiring point for:
 *   DependencyGraph   → block-validated DAG
 *   DependencyValidator → block-attr validation
 *   DependencyExecutionGuard → scheduler/AI gate
 *   DependencyResolver → topological ordering + visualization
 *
 * Lifecycle rules:
 *   - Created in index.ts after TaskStorage.init()
 *   - start() called in onLayoutReady (after CacheManager.start())
 *   - stop() called in onunload (before CacheManager.stop())
 *   - MUST NOT survive plugin.onunload()
 *   - MUST NOT initialize before plugin.onload()
 *
 * FORBIDDEN:
 *  - run at import time
 *  - import frontend components
 */

import type { TaskRepositoryProvider } from "@backend/core/storage/TaskStorage";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyValidator } from "./DependencyValidator";
import { DependencyExecutionGuard } from "./DependencyExecutionGuard";
import { DependencyResolver } from "./DependencyResolver";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface DependencyManagerDeps {
  repository: TaskRepositoryProvider;
  pluginEventBus: PluginEventBus;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class DependencyManager {
  readonly graph: DependencyGraph;
  readonly validator: DependencyValidator;
  readonly guard: DependencyExecutionGuard;
  readonly resolver: DependencyResolver;

  private active = false;

  constructor(deps: DependencyManagerDeps) {
    const { repository, pluginEventBus } = deps;

    this.graph = new DependencyGraph({ repository, pluginEventBus });

    this.validator = new DependencyValidator({
      repository,
      graph: this.graph,
    });

    this.guard = new DependencyExecutionGuard({
      graph: this.graph,
      validator: this.validator,
      pluginEventBus,
    });

    this.resolver = new DependencyResolver({
      repository,
      graph: this.graph,
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    this.graph.start();
    logger.info("[DependencyManager] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.graph.stop();
    this.active = false;
    logger.info("[DependencyManager] Stopped");
  }

  isActive(): boolean {
    return this.active;
  }
}
