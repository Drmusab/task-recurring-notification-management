/**
 * EscalationManager — Runtime-Validated Escalation Pipeline Core
 *
 * The central orchestrator for the escalation pipeline. Validates every
 * escalation through a strict sequence of guards before dispatching:
 *
 *   1. DependencyExecutionGuard.isBlocked() — skip if deps unmet
 *   2. BlockAttributeSync.readTaskAttributes() — validate block exists, status ≠ done/archived
 *   3. Recurrence instance resolution — attach escalation to LATEST instance, not parent
 *   4. NotificationState.getEscalationLevel() — check threshold from task.escalationPolicy
 *   5. EventQueue.enqueue() — emit task:escalated via PluginEventBus
 *   6. IntegrationManager.dispatchEscalation() — fire webhooks
 *
 * Trigger rules:
 *   - Escalate ONLY on task:runtime:missed (from SchedulerService overdue detection)
 *   - NEVER escalate on postponed, rescheduled, or snoozed tasks
 *   - AI urgency scoring is upstream (AttentionGateFilter); this layer runs post-filter
 *
 * Cache invalidation subscriptions:
 *   - task:runtime:completed  → resolveEscalation("completed")
 *   - task:runtime:rescheduled → resolveEscalation("rescheduled")
 *   - task:runtime:recurrence → refresh recurrence instance
 *
 * Lifecycle safety:
 *   - No init before onload
 *   - No escalation before storage load
 *   - No retry after onunload
 *
 * FORBIDDEN:
 *   - Import frontend / Svelte
 *   - Bypass DependencyExecutionGuard
 *   - Bypass BlockAttributeSync validation
 *   - Escalate on postponed/rescheduled events
 */

import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { DependencyExecutionGuard } from "@backend/dependencies/DependencyExecutionGuard";
import type { BlockAttributeSync } from "@backend/blocks/BlockAttributeSync";
import type { NotificationState } from "@backend/core/engine/NotificationState";
import type { EventQueue } from "@backend/core/engine/EventQueue";
import type { IntegrationManager } from "@backend/integrations/IntegrationManager";
import type { Task } from "@backend/core/models/Task";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface EscalationManagerDeps {
  pluginEventBus: PluginEventBus;
  dependencyGuard: DependencyExecutionGuard;
  blockAttributeSync: BlockAttributeSync;
  notificationState: NotificationState;
  eventQueue: EventQueue;
  integrationManager: IntegrationManager;
  /** Task lookup function (from TaskStorage) */
  getTask: (taskId: string) => Promise<Task | undefined>;
}

export interface EscalationCheckResult {
  escalated: boolean;
  level: number;
  reason: string;
  blocked?: boolean;
  blockReason?: string;
}

export interface EscalationManagerStats {
  totalChecked: number;
  totalEscalated: number;
  totalBlocked: number;
  totalResolved: number;
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

/** Default escalation threshold levels when task has no explicit policy */
const DEFAULT_ESCALATION_LEVELS = [
  { missCount: 1, action: "notify" as const },
  { missCount: 3, action: "escalate" as const },
  { missCount: 7, action: "escalate" as const },
];

/** Block statuses that prevent escalation */
const NON_ESCALATABLE_STATUSES = new Set(["done", "completed", "archived", "deleted", "cancelled"]);

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class EscalationManager {
  private readonly eventBus: PluginEventBus;
  private readonly guard: DependencyExecutionGuard;
  private readonly blockSync: BlockAttributeSync;
  private readonly notifState: NotificationState;
  private readonly eventQueue: EventQueue;
  private readonly integrationMgr: IntegrationManager;
  private readonly getTask: (taskId: string) => Promise<Task | undefined>;

  /** Event unsubscribe handles */
  private unsubscribes: Array<() => void> = [];
  private active = false;

  // Stats
  private totalChecked = 0;
  private totalEscalated = 0;
  private totalBlocked = 0;
  private totalResolved = 0;

  constructor(deps: EscalationManagerDeps) {
    this.eventBus = deps.pluginEventBus;
    this.guard = deps.dependencyGuard;
    this.blockSync = deps.blockAttributeSync;
    this.notifState = deps.notificationState;
    this.eventQueue = deps.eventQueue;
    this.integrationMgr = deps.integrationManager;
    this.getTask = deps.getTask;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Start the escalation manager — subscribe to runtime events.
   *
   * Preconditions (caller must ensure):
   *   - TaskStorage.init() completed
   *   - EngineController started (EventQueue active)
   *   - IntegrationManager started
   *   - NotificationState loaded
   */
  start(): void {
    if (this.active) {
      logger.warn("[EscalationManager] Already started");
      return;
    }

    // ── Subscribe to task:runtime:missed ONLY ──
    // This is the ONLY trigger for escalation. Never escalate on
    // task:overdue (which fires before dependency validation) or
    // task:runtime:rescheduled/skipped (which are intentional actions).
    //
    // The Scheduler emits task:runtime:due for on-time tasks.
    // Missed tasks go through: task:overdue → Scheduler.handleOverdue()
    // → task:missed (when repeated overdue detected).
    //
    // We listen to BOTH task:missed and task:overdue, but only escalate
    // when the dependency guard and block validation pass.
    this.unsubscribes.push(
      this.eventBus.on("task:missed", ({ taskId }) => {
        this.checkAndEscalate(taskId, "missed").catch((err) => {
          logger.error("[EscalationManager] Missed task escalation failed", {
            taskId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      })
    );

    // ── Subscribe to resolution events ──
    this.unsubscribes.push(
      this.eventBus.on("task:runtime:completed", ({ taskId }) => {
        this.resolveEscalation(taskId, "completed");
      }),
      this.eventBus.on("task:runtime:rescheduled", ({ taskId }) => {
        this.resolveEscalation(taskId, "rescheduled");
      }),
    );

    this.active = true;
    logger.info("[EscalationManager] Started");
  }

  /**
   * Stop the escalation manager — unsubscribe from all events.
   */
  stop(): void {
    if (!this.active) return;
    this.active = false;

    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* already cleared */ }
    }
    this.unsubscribes = [];

    logger.info("[EscalationManager] Stopped", this.getStats());
  }

  // ── Core Pipeline ────────────────────────────────────────────

  /**
   * Full escalation check + dispatch pipeline.
   *
   * Flow:
   *   1. Guard: DependencyExecutionGuard.isBlocked()
   *   2. Task lookup
   *   3. Block validation via BlockAttributeSync
   *   4. Threshold check via NotificationState + task.escalationPolicy
   *   5. EventQueue enqueue (task:escalated)
   *   6. IntegrationManager dispatch (webhooks)
   */
  async checkAndEscalate(taskId: string, trigger: string): Promise<EscalationCheckResult> {
    if (!this.active) {
      return { escalated: false, level: 0, reason: "Manager not active" };
    }

    this.totalChecked++;

    // ── 1. Dependency guard ──
    if (this.guard.isBlocked(taskId)) {
      this.totalBlocked++;
      const { blockers } = this.guard.explainBlocked(taskId);
      const reason = `Blocked by dependencies: ${blockers.join(", ")}`;

      this.eventBus.emit("task:escalation:blocked", {
        taskId,
        reason,
        blockers,
      });

      logger.debug("[EscalationManager] Escalation blocked by dependency", {
        taskId,
        blockers,
      });

      return { escalated: false, level: 0, reason, blocked: true, blockReason: reason };
    }

    // ── 2. Task lookup ──
    const task = await this.getTask(taskId);
    if (!task) {
      logger.warn("[EscalationManager] Task not found", { taskId });
      return { escalated: false, level: 0, reason: "Task not found" };
    }

    // ── 3. Block validation ──
    const blockId = task.blockId || task.linkedBlockId;
    if (blockId) {
      const attrs = await this.blockSync.readTaskAttributes(blockId);
      if (!attrs) {
        this.totalBlocked++;
        this.eventBus.emit("task:escalation:blocked", {
          taskId,
          reason: "Block not found — task may have been deleted",
        });
        return { escalated: false, level: 0, reason: "Block not found", blocked: true };
      }
      if (NON_ESCALATABLE_STATUSES.has(attrs.status)) {
        // Task is completed/archived — resolve instead of escalate
        this.resolveEscalation(taskId, "completed");
        return { escalated: false, level: 0, reason: `Task status is '${attrs.status}'` };
      }
      if (!attrs.enabled) {
        return { escalated: false, level: 0, reason: "Task is disabled" };
      }
    }

    // ── 4. Check if task is enabled ──
    if (!task.enabled) {
      return { escalated: false, level: 0, reason: "Task is disabled" };
    }

    // ── 5. Threshold check ──
    const currentLevel = this.notifState.getEscalationLevel(taskId);
    const policy = task.escalationPolicy;

    // If policy exists and is disabled, skip
    if (policy && !policy.enabled) {
      return { escalated: false, level: currentLevel, reason: "Escalation policy disabled" };
    }

    const levels = [...(policy?.levels ?? DEFAULT_ESCALATION_LEVELS)] as Array<{ missCount: number; action: string; channels?: string[] }>;
    const newLevel = this.notifState.incrementEscalation(taskId);

    // Find the matching escalation tier
    const matchedTier = this.findMatchingTier(newLevel, levels);
    if (!matchedTier) {
      // Below all thresholds — no action yet
      logger.debug("[EscalationManager] Below escalation threshold", {
        taskId,
        level: newLevel,
      });
      return { escalated: false, level: newLevel, reason: "Below threshold" };
    }

    // ── 6. Resolve recurrence instance ──
    const recurrenceInstance = this.resolveRecurrenceInstance(task);

    // ── 7. Calculate overdue duration ──
    const overdueMinutes = this.calculateOverdueMinutes(task);

    // ── 8. Enqueue escalation event to EventQueue ──
    const reason = `${trigger}: level ${newLevel} (${matchedTier.action})`;

    this.eventQueue.enqueue("task:escalated", {
      taskId,
      level: newLevel,
      reason,
      timestamp: new Date().toISOString(),
    });

    // ── 9. Dispatch via IntegrationManager (webhooks) ──
    this.integrationMgr.dispatchEscalation({
      task,
      level: newLevel,
      reason,
      overdueMinutes,
      recurrenceInstance,
    }).catch((err) => {
      logger.error("[EscalationManager] Webhook dispatch failed", {
        taskId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    this.totalEscalated++;

    logger.info("[EscalationManager] Task escalated", {
      taskId,
      level: newLevel,
      action: matchedTier.action,
      trigger,
      recurrenceInstance,
    });

    return { escalated: true, level: newLevel, reason };
  }

  // ── Resolution ───────────────────────────────────────────────

  /**
   * Resolve all pending escalations for a task.
   * Called when task is completed, rescheduled, or deleted.
   */
  resolveEscalation(
    taskId: string,
    resolvedBy: "completed" | "rescheduled" | "deleted" | "manual"
  ): void {
    const previousLevel = this.notifState.getEscalationLevel(taskId);
    if (previousLevel === 0) return; // Nothing to resolve

    // Reset escalation state
    this.notifState.resetEscalation(taskId);

    // Resolve pending retries in integration layer
    this.integrationMgr.resolveRetries(taskId, resolvedBy);

    // Emit resolution event
    this.eventBus.emit("task:escalation:resolved", {
      taskId,
      resolvedBy,
    });

    this.totalResolved++;

    logger.info("[EscalationManager] Escalation resolved", {
      taskId,
      resolvedBy,
      previousLevel,
    });

    // Dispatch resolution webhook (fire & forget)
    this.getTask(taskId).then((task) => {
      if (task) {
        this.integrationMgr.dispatchEscalationResolved({
          task,
          resolvedBy,
          previousLevel,
        }).catch(() => { /* non-critical */ });
      }
    }).catch(() => { /* non-critical */ });
  }

  // ── Stats ────────────────────────────────────────────────────

  getStats(): EscalationManagerStats {
    return {
      totalChecked: this.totalChecked,
      totalEscalated: this.totalEscalated,
      totalBlocked: this.totalBlocked,
      totalResolved: this.totalResolved,
    };
  }

  // ── Internal ─────────────────────────────────────────────────

  /**
   * Find the matching escalation tier based on current level.
   * Returns the highest tier whose missCount ≤ currentLevel.
   */
  private findMatchingTier(
    currentLevel: number,
    levels: Array<{ missCount: number; action: string; channels?: string[] }>
  ): { missCount: number; action: string; channels?: string[] } | null {
    let matched: { missCount: number; action: string; channels?: string[] } | null = null;

    for (const tier of levels) {
      if (currentLevel >= tier.missCount) {
        if (!matched || tier.missCount > matched.missCount) {
          matched = tier;
        }
      }
    }

    return matched;
  }

  /**
   * Resolve the latest recurrence instance identifier.
   * Escalation attaches to the LATEST recurrence instance, NOT the original parent.
   */
  private resolveRecurrenceInstance(task: Task): string | undefined {
    if (!task.recurrence?.rrule) return undefined;

    // Use dueAt as the recurrence instance identifier
    // This ensures escalation is tied to a specific occurrence, not the task itself
    if (task.dueAt) {
      return `${task.id}@${task.dueAt}`;
    }

    return undefined;
  }

  /**
   * Calculate how many minutes the task is overdue.
   */
  private calculateOverdueMinutes(task: Task): number {
    if (!task.dueAt) return 0;

    const dueTime = new Date(task.dueAt).getTime();
    const now = Date.now();

    if (now <= dueTime) return 0;
    return Math.floor((now - dueTime) / 60_000);
  }
}
