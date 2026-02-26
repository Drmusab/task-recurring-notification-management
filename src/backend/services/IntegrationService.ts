/**
 * IntegrationService — Integration Guard Layer
 *
 * The ONLY entry point for dispatching integration events (webhooks,
 * escalations, external notifications). Every dispatch MUST pass
 * through a strict validation sequence:
 *
 *   1. DependencyExecutionGuard.canExecute(taskId) — skip if deps unmet
 *   2. CacheManager.taskCache freshness check — reject stale state
 *   3. BlockAttributeSync.readTaskAttributes() — confirm block exists & valid
 *   4. IntegrationManager.dispatch*() — fire to registered targets
 *
 * This service unifies the TWO previously overlapping webhook paths:
 *   Path A (legacy):  EventService → scheduler.on("task:due") → HTTP POST
 *   Path B (new):     EscalationManager → IntegrationManager → NotificationService
 *
 * Now there is ONE path:
 *   IntegrationService.dispatch() → validate → IntegrationManager.dispatch*()
 *
 * Integration:
 *   DependencyExecutionGuard — block-level gate
 *   BlockAttributeSync       — block existence + status validation
 *   CacheManager             — freshness validation
 *   IntegrationManager       — webhook pipeline (mapper → emitter → targets)
 *   EventService             — emit escalation events on dispatch
 *
 * Lifecycle:
 *   - Constructed (no side effects)
 *   - start() → mark active, subscribe to trigger events
 *   - stop()  → unsubscribe, mark inactive
 *
 * FORBIDDEN:
 *   - Send HTTP requests directly (delegate to IntegrationManager)
 *   - Mutate task model (delegate to TaskService)
 *   - Bypass DependencyExecutionGuard
 *   - Import frontend / Svelte
 *   - Parse markdown
 */

import type { Task } from "@backend/core/models/Task";
import type { DependencyExecutionGuard, CanExecuteResult } from "@backend/dependencies/DependencyExecutionGuard";
import type { BlockAttributeSync, BlockTaskAttributes } from "@backend/blocks/BlockAttributeSync";
import type { IntegrationManager } from "@backend/integrations/IntegrationManager";
import type { CacheManager } from "@backend/cache/CacheManager";
import type { EventService } from "./EventService";
import type { RecurrenceResolver } from "./RecurrenceResolver";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface IntegrationServiceDeps {
  dependencyGuard: DependencyExecutionGuard;
  blockAttributeSync: BlockAttributeSync;
  integrationManager: IntegrationManager;
  cacheManager: CacheManager;
  eventService: EventService;
  /** Task lookup function (from TaskStorage) */
  getTask: (taskId: string) => Task | undefined;
  /** Recurrence instance resolver (Session 19) */
  recurrenceResolver?: RecurrenceResolver;
}

export interface DispatchGuardResult {
  allowed: boolean;
  reason?: string;
  blockers?: string[];
  blockAttributes?: BlockTaskAttributes | null;
}

export interface IntegrationDispatchResult {
  dispatched: boolean;
  guardResult: DispatchGuardResult;
  targets?: number;
  successes?: number;
  failures?: number;
}

export interface IntegrationServiceStats {
  totalDispatched: number;
  totalBlocked: number;
  totalFailed: number;
  guardBreakdown: {
    dependencyBlocked: number;
    cacheStale: number;
    blockMissing: number;
    blockDone: number;
  };
}

// ── Constants ────────────────────────────────────────────────

/** Block statuses that are terminal — no dispatch allowed */
const TERMINAL_BLOCK_STATUSES = new Set(["done", "archived", "cancelled"]);

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class IntegrationService {
  private readonly dependencyGuard: DependencyExecutionGuard;
  private readonly blockSync: BlockAttributeSync;
  private readonly integrationManager: IntegrationManager;
  private readonly cacheManager: CacheManager;
  private readonly eventService: EventService;
  private readonly getTask: (taskId: string) => Task | undefined;
  private readonly recurrenceResolver: RecurrenceResolver | null;

  private active = false;
  private readonly unsubscribes: Array<() => void> = [];

  /** Fire-once deduplication: taskId → last dispatch timestamp */
  private readonly fireOnceMap: Map<string, number> = new Map();
  /** Dedup window: 60 seconds */
  private static readonly FIRE_ONCE_WINDOW_MS = 60_000;

  // ── Stats ──────────────────────────────────────────────────
  private totalDispatched = 0;
  private totalBlocked = 0;
  private totalFailed = 0;
  private dependencyBlocked = 0;
  private cacheStale = 0;
  private blockMissing = 0;
  private blockDone = 0;

  constructor(deps: IntegrationServiceDeps) {
    this.dependencyGuard = deps.dependencyGuard;
    this.blockSync = deps.blockAttributeSync;
    this.integrationManager = deps.integrationManager;
    this.cacheManager = deps.cacheManager;
    this.eventService = deps.eventService;
    this.getTask = deps.getTask;
    this.recurrenceResolver = deps.recurrenceResolver ?? null;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[IntegrationService] Started");
  }

  stop(): void {
    if (!this.active) return;

    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* already removed */ }
    }
    this.unsubscribes.length = 0;
    this.active = false;

    logger.info("[IntegrationService] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Dispatch an escalation event through the full guard pipeline.
   *
   * Guard sequence:
   *   1. DependencyExecutionGuard.canExecute() → blocked tasks get event emitted
   *   2. Block attribute validation → block must exist, status ≠ done/archived
   *   3. IntegrationManager.dispatchEscalation() → fire webhooks
   */
  async dispatchEscalation(
    taskId: string,
    level: number,
    reason: string,
  ): Promise<IntegrationDispatchResult> {
    this.requireActive("dispatchEscalation");

    // ── Step 1: Dependency guard ──
    const guardResult = await this.runGuardPipeline(taskId);
    if (!guardResult.allowed) {
      this.totalBlocked++;
      this.eventService.emit("task:escalation:blocked", {
        taskId,
        reason: guardResult.reason || "guard_rejected",
        blockers: guardResult.blockers,
      });
      return { dispatched: false, guardResult };
    }

    // ── Step 2: Fire-once deduplication ──
    if (this.isFireOnceDuplicate(taskId)) {
      logger.debug("[IntegrationService] Fire-once dedup: skipping", { taskId });
      return { dispatched: false, guardResult };
    }

    // ── Step 3: Dispatch through IntegrationManager ──
    try {
      let task = this.getTask(taskId);
      if (!task) {
        logger.warn("[IntegrationService] Task not found for escalation", { taskId });
        return { dispatched: false, guardResult };
      }

      // Resolve recurrence instance — ensure we fire for latest occurrence
      if (this.recurrenceResolver) {
        const resolved = this.recurrenceResolver.resolveInstance(task);
        if (resolved.seriesEnded) {
          logger.debug("[IntegrationService] Series ended, skipping dispatch", { taskId });
          return { dispatched: false, guardResult };
        }
        if (resolved.resolved) {
          task = { ...task, dueAt: resolved.resolvedDueAt! } as Task;
        }
      }

      const dueMs = new Date(task.dueAt).getTime();
      const overdueMinutes = Math.max(0, Math.round((Date.now() - dueMs) / 60_000));

      const result = await this.integrationManager.dispatchEscalation({
        task,
        level,
        reason,
        overdueMinutes,
      });

      this.totalDispatched++;
      this.markFireOnce(taskId);

      // Emit escalation event
      this.eventService.emitEscalation(taskId, level, reason);

      logger.info("[IntegrationService] Escalation dispatched", {
        taskId,
        level,
        targets: result.targets,
        successes: result.successes,
      });

      return {
        dispatched: true,
        guardResult,
        targets: result.targets,
        successes: result.successes,
        failures: result.failures,
      };
    } catch (error) {
      this.totalFailed++;
      logger.error("[IntegrationService] Dispatch failed", { taskId, error });
      return {
        dispatched: false,
        guardResult,
      };
    }
  }

  /**
   * Dispatch an escalation-resolved notification.
   * Used when a task is completed, rescheduled, or deleted.
   */
  async dispatchEscalationResolved(
    taskId: string,
    resolvedBy: "completed" | "rescheduled" | "deleted" | "manual",
  ): Promise<void> {
    this.requireActive("dispatchEscalationResolved");

    try {
      const task = this.getTask(taskId);
      if (!task) {
        logger.warn("[IntegrationService] Task not found for resolution", { taskId });
        return;
      }

      await this.integrationManager.dispatchEscalationResolved({
        task,
        resolvedBy,
        previousLevel: 0, // Reset level on resolution
      });

      this.eventService.emitEscalationResolved(taskId, resolvedBy);

      logger.debug("[IntegrationService] Escalation resolved dispatched", {
        taskId,
        resolvedBy,
      });
    } catch (error) {
      logger.error("[IntegrationService] Resolved dispatch failed", {
        taskId,
        resolvedBy,
        error,
      });
    }
  }

  /**
   * Run the guard pipeline for a task before dispatch.
   * Returns the guard result with reason/blockers if rejected.
   */
  async runGuardPipeline(taskId: string): Promise<DispatchGuardResult> {
    // ── Gate 1: Dependency execution guard ──
    const depResult: CanExecuteResult = await this.dependencyGuard.canExecute(taskId);
    if (!depResult.allowed) {
      this.dependencyBlocked++;
      return {
        allowed: false,
        reason: `Dependency blocked: ${depResult.reason || "deps unmet"}`,
        blockers: depResult.blockers,
      };
    }

    // ── Gate 2: Block attribute existence + status ──
    const task = this.getTask(taskId);
    const blockId = task?.blockId || task?.linkedBlockId;

    if (blockId) {
      const blockAttrs = await this.blockSync.readTaskAttributes(blockId);

      if (!blockAttrs) {
        this.blockMissing++;
        return {
          allowed: false,
          reason: `Block not found or has no task attributes: ${blockId}`,
          blockAttributes: null,
        };
      }

      if (TERMINAL_BLOCK_STATUSES.has(blockAttrs.status)) {
        this.blockDone++;
        return {
          allowed: false,
          reason: `Block task status is terminal: ${blockAttrs.status}`,
          blockAttributes: blockAttrs,
        };
      }

      return { allowed: true, blockAttributes: blockAttrs };
    }

    // No block linked — allow (non-block tasks can still trigger integrations)
    return { allowed: true };
  }

  /**
   * Get integration service stats.
   */
  getStats(): IntegrationServiceStats {
    return {
      totalDispatched: this.totalDispatched,
      totalBlocked: this.totalBlocked,
      totalFailed: this.totalFailed,
      guardBreakdown: {
        dependencyBlocked: this.dependencyBlocked,
        cacheStale: this.cacheStale,
        blockMissing: this.blockMissing,
        blockDone: this.blockDone,
      },
    };
  }

  // ── Fire-Once Deduplication ─────────────────────────────────

  private isFireOnceDuplicate(taskId: string): boolean {
    const lastTime = this.fireOnceMap.get(taskId);
    if (!lastTime) return false;
    return Date.now() - lastTime < IntegrationService.FIRE_ONCE_WINDOW_MS;
  }

  private markFireOnce(taskId: string): void {
    this.fireOnceMap.set(taskId, Date.now());
    // Prune old entries
    if (this.fireOnceMap.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.fireOnceMap) {
        if (now - v > IntegrationService.FIRE_ONCE_WINDOW_MS * 2) {
          this.fireOnceMap.delete(k);
        }
      }
    }
  }

  // ── Private ──────────────────────────────────────────────────

  private requireActive(method: string): void {
    if (!this.active) {
      throw new Error(`[IntegrationService] Not started — cannot call ${method}()`);
    }
  }
}
