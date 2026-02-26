/**
 * DependencyCache — Cache Facade over DependencyGraph
 *
 * Thin layer in the cache system that delegates to backend/dependencies/DependencyGraph.
 * Exists for CacheManager compatibility — all real logic is in DependencyGraph.
 *
 * Invalidation triggers (delegated):
 *   task:complete, task:updated, task:refresh,
 *   block:updated, block:deleted
 *
 * FORBIDDEN:
 *  - duplicate DependencyGraph logic
 *  - import frontend components
 *  - mutate task model
 *  - bypass DependencyGraph
 */

import type { TaskRepositoryProvider } from "@backend/core/storage/TaskStorage";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import { DependencyGraph } from "@backend/dependencies/DependencyGraph";
import type { DependencyNode, DependencyGraphStats } from "@backend/dependencies/DependencyGraph";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Re-export types for backward compatibility
// ──────────────────────────────────────────────────────────────

export type { DependencyNode, DependencyGraphStats as DependencyCacheStats };

export interface DependencyCacheDeps {
  repository: TaskRepositoryProvider;
  pluginEventBus: PluginEventBus;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class DependencyCache {
  private readonly graph: DependencyGraph;
  private active = false;

  constructor(deps: DependencyCacheDeps) {
    this.graph = new DependencyGraph({
      repository: deps.repository,
      pluginEventBus: deps.pluginEventBus,
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    this.graph.start();
    logger.info("[DependencyCache] Started (delegating to DependencyGraph)");
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.graph.stop();
    logger.info("[DependencyCache] Stopped");
  }

  // ── Public API (delegate to graph) ───────────────────────────

  getNode(taskId: string): DependencyNode | undefined {
    return this.graph.getNode(taskId);
  }

  isBlocked(taskId: string): boolean {
    return this.graph.isBlocked(taskId);
  }

  getBlockedBy(taskId: string): string[] {
    return this.graph.getDependents(taskId);
  }

  getUnblockCandidates(taskId: string): string[] {
    return this.graph.getUnblockCandidates(taskId);
  }

  getBlockedTasks(): string[] {
    return this.graph.getBlockedTasks();
  }

  getReadyTasks(): string[] {
    return this.graph.getReadyTasks();
  }

  /** Get the underlying DependencyGraph for advanced consumers. */
  getGraph(): DependencyGraph {
    return this.graph;
  }

  // ── Rebuild / Invalidation ───────────────────────────────────

  rebuild(): void {
    this.graph.rebuild();
  }

  invalidateTask(taskId: string): void {
    this.graph.invalidateTask(taskId);
  }

  evict(taskId: string): void {
    this.graph.evictNode(taskId);
  }

  // ── Stats ────────────────────────────────────────────────────

  getStats(): DependencyGraphStats {
    return this.graph.getStats();
  }
}
