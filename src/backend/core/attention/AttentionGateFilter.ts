/**
 * AttentionGateFilter — Gateway between Scheduler events and downstream consumers.
 *
 * This is the ONLY module that decides whether a task:due or task:overdue event
 * should reach the frontend and notification layer.
 *
 * Architecture:
 *   Scheduler.checkDueTasks() → TaskDueEvent
 *     ↓
 *   AttentionGateFilter.processTaskDue(event)
 *     ↓ computeVerdict(task, decayEntry)
 *     ├── action: "emit"     → pluginEventBus.emit("task:attention:due", payload)
 *     │                         + optional kernel notification if score > NOTIFICATION_THRESHOLD
 *     ├── action: "suppress" → pluginEventBus.emit("task:attention:suppressed", payload)
 *     │                         + record ignore in UrgencyDecayTracker
 *     └── action: "mute"     → pluginEventBus.emit("task:attention:suppressed", payload)
 *                               + log only (no notification, no UI update)
 *
 * Lifecycle:
 *   - Created in onLayoutReady() AFTER scheduler is initialized
 *   - Subscribes to Scheduler's raw task:due and task:overdue
 *   - Destroyed in onunload()
 *
 * FORBIDDEN:
 *   - No computation at plugin load
 *   - No scanning all tasks
 *   - No direct notification for every due task
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskDueEvent } from "@backend/core/engine/SchedulerEvents";
import type { Scheduler } from "@backend/core/engine/Scheduler";
import { pluginEventBus } from "@backend/core/events/PluginEventBus";
import { computeVerdict } from "./AttentionModel";
import { UrgencyDecayTracker } from "./UrgencyDecayTracker";
import type {
  AttentionVerdict,
  AttentionDuePayload,
  AttentionSuppressedPayload,
  NotificationBudgetState,
} from "./AttentionGateTypes";
import {
  NOTIFICATION_THRESHOLD,
  NOTIFICATION_BUDGET_MAX,
  NOTIFICATION_BUDGET_WINDOW_MS,
} from "./AttentionGateTypes";
import { notify } from "@backend/core/api/NotificationAdapter";
import * as logger from "@backend/logging/logger";

export class AttentionGateFilter {
  private decayTracker: UrgencyDecayTracker;
  private cleanups: Array<() => void> = [];
  private destroyed = false;

  /** Notification budget: sliding window rate limiter */
  private budget: NotificationBudgetState = { recentTimestamps: [] };

  /** Set of task IDs emitted this check cycle, for dedup within one tick */
  private emittedThisCycle: Set<string> = new Set();

  constructor(decayTracker: UrgencyDecayTracker) {
    this.decayTracker = decayTracker;
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Bind to the Scheduler's raw events and gate them through the attention model.
   * Also subscribes to task lifecycle events for decay tracking.
   */
  bind(scheduler: Scheduler): void {
    if (this.destroyed) return;

    // Gate task:due events
    const unsubDue = scheduler.on("task:due", (event) => {
      this.processTaskDue(event).catch((err) => {
        logger.error("[AttentionGateFilter] Failed to process task:due", err);
      });
    });
    this.cleanups.push(unsubDue);

    // Gate task:overdue events  
    const unsubOverdue = scheduler.on("task:overdue", (event) => {
      this.processTaskOverdue(event).catch((err) => {
        logger.error("[AttentionGateFilter] Failed to process task:overdue", err);
      });
    });
    this.cleanups.push(unsubOverdue);

    // Track user engagement for decay management
    const unsubComplete = pluginEventBus.on("task:complete", (data) => {
      this.decayTracker.resetOnCompletion(data.taskId);
      this.decayTracker.save().catch(() => {});
    });
    this.cleanups.push(unsubComplete);

    const unsubSnooze = pluginEventBus.on("task:snooze", (data) => {
      this.decayTracker.resetOnSnooze(data.taskId);
      this.decayTracker.save().catch(() => {});
    });
    this.cleanups.push(unsubSnooze);

    logger.info("[AttentionGateFilter] Bound to scheduler and lifecycle events");
  }

  /**
   * Unbind all listeners and mark as destroyed.
   */
  destroy(): void {
    this.destroyed = true;
    for (const cleanup of this.cleanups) {
      try { cleanup(); } catch { /* already cleaned */ }
    }
    this.cleanups = [];

    // Persist final decay state
    this.decayTracker.save().catch(() => {});
    logger.info("[AttentionGateFilter] Destroyed");
  }

  // ─── Event Processing ─────────────────────────────────────

  /**
   * Process a raw task:due event through the attention model.
   * Emits attention-aware events based on the verdict.
   */
  async processTaskDue(event: TaskDueEvent): Promise<void> {
    if (this.destroyed) return;

    // Dedup within the same check cycle
    if (this.emittedThisCycle.has(event.taskId)) return;

    const task = event.task;
    const decayEntry = this.decayTracker.getDecayEntry(event.taskId);
    const verdict = computeVerdict(task, decayEntry);

    logger.info(
      `[AttentionGateFilter] task:due ${event.taskId} → ${verdict.action} (score: ${(verdict.score * 100).toFixed(0)}%)`,
      { breakdown: verdict.breakdown }
    );

    switch (verdict.action) {
      case "emit":
        this.emitAttentionDue(task, verdict);
        this.emittedThisCycle.add(event.taskId);
        break;

      case "suppress":
        this.emitSuppressed(task, verdict, "suppress");
        this.decayTracker.recordIgnore(event.taskId);
        break;

      case "mute":
        this.emitSuppressed(task, verdict, "mute");
        break;
    }

    // Clear cycle dedup after microtask (one Scheduler.checkDueTasks() call)
    queueMicrotask(() => this.emittedThisCycle.delete(event.taskId));
  }

  /**
   * Process a raw task:overdue event — uses same attention model
   * but with a higher urgency bias (overdue tasks are more important).
   */
  async processTaskOverdue(event: TaskDueEvent): Promise<void> {
    if (this.destroyed) return;

    const task = event.task;
    const decayEntry = this.decayTracker.getDecayEntry(event.taskId);
    const verdict = computeVerdict(task, decayEntry);

    // Overdue tasks get promoted: emit as urgent if they pass threshold
    if (verdict.action === "emit") {
      this.emitAttentionUrgent(task, verdict);
    } else if (verdict.action === "suppress") {
      this.emitSuppressed(task, verdict, "suppress");
      this.decayTracker.recordIgnore(event.taskId);
    } else {
      this.emitSuppressed(task, verdict, "mute");
    }
  }

  // ─── Notification Budget ──────────────────────────────────

  /**
   * Check if we have budget remaining for a kernel notification.
   */
  private hasBudget(now: number = Date.now()): boolean {
    // Prune timestamps outside the window
    const cutoff = now - NOTIFICATION_BUDGET_WINDOW_MS;
    this.budget.recentTimestamps = this.budget.recentTimestamps.filter((t) => t > cutoff);
    return this.budget.recentTimestamps.length < NOTIFICATION_BUDGET_MAX;
  }

  /**
   * Consume one notification budget slot.
   */
  private consumeBudget(now: number = Date.now()): void {
    this.budget.recentTimestamps.push(now);
  }

  // ─── Event Emission ───────────────────────────────────────

  /**
   * Emit task:attention:due — task deserves user's attention.
   * Also sends kernel notification if score > NOTIFICATION_THRESHOLD and budget allows.
   */
  private emitAttentionDue(task: Task, verdict: AttentionVerdict): void {
    const payload: AttentionDuePayload = {
      taskId: task.id,
      task,
      attentionScore: verdict.score,
      breakdown: verdict.breakdown,
    };

    pluginEventBus.emit("task:attention:due", payload);

    // Gate kernel notification behind NOTIFICATION_THRESHOLD + budget
    if (verdict.score >= NOTIFICATION_THRESHOLD && this.hasBudget()) {
      this.consumeBudget();
      notify({
        message: `📋 ${task.name}`,
        level: "info",
        timeout: 5000,
        useKernelApi: true,
      }).catch((err) => {
        logger.warn("[AttentionGateFilter] Kernel notification failed", { err });
      });
    }
  }

  /**
   * Emit task:attention:urgent — overdue task that passed attention threshold.
   */
  private emitAttentionUrgent(task: Task, verdict: AttentionVerdict): void {
    const payload: AttentionDuePayload = {
      taskId: task.id,
      task,
      attentionScore: verdict.score,
      breakdown: verdict.breakdown,
    };

    pluginEventBus.emit("task:attention:urgent", payload);

    // Urgent tasks always try to notify if budget allows
    if (this.hasBudget()) {
      this.consumeBudget();
      notify({
        message: `⚠️ Overdue: ${task.name}`,
        level: "warning",
        timeout: 7000,
        useKernelApi: true,
      }).catch((err) => {
        logger.warn("[AttentionGateFilter] Kernel notification failed", { err });
      });
    }
  }

  /**
   * Emit task:attention:suppressed — task was filtered out. No notification.
   */
  private emitSuppressed(
    task: Task,
    verdict: AttentionVerdict,
    action: "suppress" | "mute",
  ): void {
    const payload: AttentionSuppressedPayload = {
      taskId: task.id,
      task,
      attentionScore: verdict.score,
      reason: verdict.reason,
      action,
    };

    pluginEventBus.emit("task:attention:suppressed", payload);
  }
}
