/**
 * DependencyExecutionGuard — Scheduler/Notification Gate
 *
 * The single authority that determines if a task is allowed to:
 *   - Emit task:due
 *   - Emit task:overdue
 *   - Be suggested by AI
 *   - Be shown as actionable in frontend
 *
 * Integration points:
 *   Scheduler.checkDueTasks() → guard.canExecute(taskId)
 *   SmartSuggestionEngine    → guard.canSuggest(taskId)
 *   Frontend filters         → guard.isBlocked(taskId)
 *
 * FORBIDDEN:
 *  - bypass DependencyGraph
 *  - trust memory-only state beyond TTL
 *  - import frontend components
 */

import type { DependencyGraph } from "./DependencyGraph";
import type { DependencyValidator } from "./DependencyValidator";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ExecutionGuardDeps {
  graph: DependencyGraph;
  validator: DependencyValidator;
  pluginEventBus: PluginEventBus;
}

export interface CanExecuteResult {
  allowed: boolean;
  reason?: string;
  blockers?: string[];
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class DependencyExecutionGuard {
  private readonly graph: DependencyGraph;
  private readonly validator: DependencyValidator;
  private readonly eventBus: PluginEventBus;

  constructor(deps: ExecutionGuardDeps) {
    this.graph = deps.graph;
    this.validator = deps.validator;
    this.eventBus = deps.pluginEventBus;
  }

  /**
   * Sync check — fast, uses in-memory graph state.
   * Suitable for hot-path filtering (scheduler tick, bulk listing).
   */
  canExecuteSync(taskId: string): boolean {
    return !this.graph.isBlocked(taskId);
  }

  /**
   * Async check — validates against SiYuan block attributes.
   * Use before emitting task:due or task:overdue for maximum correctness.
   */
  async canExecute(taskId: string): Promise<CanExecuteResult> {
    // Fast path: no deps → always allowed
    const node = this.graph.getNode(taskId);
    if (!node || node.dependsOn.size === 0) {
      return { allowed: true };
    }

    // Validate against block attrs
    const result = await this.validator.validate(taskId);

    if (result.cycle.length > 0) {
      return {
        allowed: false,
        reason: `Circular dependency: ${result.cycle.join(" → ")}`,
        blockers: result.cycle,
      };
    }

    if (result.blocked) {
      return {
        allowed: false,
        reason: result.reason,
        blockers: result.incompleteDeps,
      };
    }

    return { allowed: true };
  }

  /**
   * Sync check for AI suggestion filtering.
   * Blocked tasks should NEVER be suggested by SmartSuggestionEngine.
   */
  canSuggest(taskId: string): boolean {
    return !this.graph.isBlocked(taskId);
  }

  /**
   * Check if task is blocked (for frontend use via EventService).
   */
  isBlocked(taskId: string): boolean {
    return this.graph.isBlocked(taskId);
  }

  /**
   * Explain why a task is blocked (for TaskEditor / Dashboard UI).
   */
  explainBlocked(taskId: string): { blockers: string[]; chains: string[][] } {
    return this.graph.explainBlocked(taskId);
  }

  /**
   * Get tasks that would become unblocked if taskId completes.
   */
  getUnblockCandidates(taskId: string): string[] {
    return this.graph.getUnblockCandidates(taskId);
  }
}
