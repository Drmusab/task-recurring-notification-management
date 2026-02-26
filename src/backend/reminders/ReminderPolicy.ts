/**
 * ReminderPolicy — Runtime-Validated Reminder Evaluation Gate
 *
 * Determines whether a reminder is ALLOWED to fire for a given task.
 *
 * Evaluation pipeline (all gates must pass):
 *   1. Task enabled check       — disabled tasks → suppress
 *   2. Status check             — completed/cancelled/archived → suppress
 *   3. Dependency guard         — blocked tasks → suppress
 *   4. Recurrence resolution    — resolve to latest instance, skip ended series
 *   5. Block attribute check    — block must exist and not be terminal
 *   6. Overdue dedup            — one reminder per overdue state change
 *   7. Dismissed check          — already dismissed in this cycle → suppress
 *
 * Consumers:
 *   DueEventEmitter → evaluate() before enqueue
 *   ReminderRetryManager → evaluate() before retry
 *
 * FORBIDDEN:
 *   - Fire reminders (delegate to ReminderDispatcher)
 *   - Mutate task model
 *   - Access DOM / frontend
 *   - Import PluginEventBus directly
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { DependencyExecutionGuard } from "@backend/dependencies/DependencyExecutionGuard";
import type { BlockAttributeValidator, BlockValidationResult } from "@backend/services/BlockAttributeValidator";
import type { RecurrenceResolver, ResolveResult } from "@backend/services/RecurrenceResolver";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ReminderPolicyDeps {
  dependencyGuard: DependencyExecutionGuard;
  blockValidator: BlockAttributeValidator;
  recurrenceResolver: RecurrenceResolver;
}

export type PolicyRejectionReason =
  | "task_disabled"
  | "status_terminal"
  | "dependency_blocked"
  | "recurrence_series_ended"
  | "block_validation_failed"
  | "overdue_already_reminded"
  | "dismissed_this_cycle"
  | "policy_inactive";

export interface PolicyEvaluationResult {
  /** Whether the reminder is allowed to fire */
  allowed: boolean;
  /** The task after recurrence resolution (may have patched dueAt) */
  resolvedTask: ReadonlyTask;
  /** Why the reminder was suppressed */
  rejectionReason?: PolicyRejectionReason;
  /** Human-readable explanation */
  explanation?: string;
  /** Block validation details (if checked) */
  blockValidation?: BlockValidationResult;
  /** Recurrence resolution details */
  recurrenceResult?: ResolveResult;
}

export interface ReminderPolicyStats {
  totalEvaluated: number;
  totalAllowed: number;
  totalSuppressed: number;
  suppressionBreakdown: Record<PolicyRejectionReason, number>;
}

/** Task statuses that are terminal — no reminder allowed */
const TERMINAL_STATUSES = new Set(["done", "archived", "cancelled"]);

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class ReminderPolicy {
  private readonly dependencyGuard: DependencyExecutionGuard;
  private readonly blockValidator: BlockAttributeValidator;
  private readonly recurrenceResolver: RecurrenceResolver;

  private active = false;

  /** Set of taskId that have been reminded in current overdue cycle */
  private readonly overdueRemindedSet: Set<string> = new Set();

  /** Set of taskId that user has dismissed in current cycle */
  private readonly dismissedSet: Set<string> = new Set();

  // ── Stats ──
  private totalEvaluated = 0;
  private totalAllowed = 0;
  private totalSuppressed = 0;
  private suppressionBreakdown: Record<PolicyRejectionReason, number> = {
    task_disabled: 0,
    status_terminal: 0,
    dependency_blocked: 0,
    recurrence_series_ended: 0,
    block_validation_failed: 0,
    overdue_already_reminded: 0,
    dismissed_this_cycle: 0,
    policy_inactive: 0,
  };

  constructor(deps: ReminderPolicyDeps) {
    this.dependencyGuard = deps.dependencyGuard;
    this.blockValidator = deps.blockValidator;
    this.recurrenceResolver = deps.recurrenceResolver;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[ReminderPolicy] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.overdueRemindedSet.clear();
    this.dismissedSet.clear();
    this.active = false;
    logger.info("[ReminderPolicy] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Evaluate whether a reminder is allowed for this task.
   *
   * Full pipeline:
   *   1. Lifecycle active
   *   2. Task enabled
   *   3. Status not terminal
   *   4. Not already dismissed
   *   5. Dependency guard
   *   6. Recurrence resolution
   *   7. Block attribute validation
   *   8. Overdue dedup
   */
  async evaluate(task: ReadonlyTask): Promise<PolicyEvaluationResult> {
    this.totalEvaluated++;

    // Gate 1: Policy must be active
    if (!this.active) {
      return this.reject(task, "policy_inactive", "ReminderPolicy is not active");
    }

    // Gate 2: Task must be enabled
    if (!task.enabled) {
      return this.reject(task, "task_disabled", `Task ${task.id} is disabled`);
    }

    // Gate 3: Status must not be terminal
    if (task.status && TERMINAL_STATUSES.has(task.status)) {
      return this.reject(task, "status_terminal", `Task ${task.id} has terminal status: ${task.status}`);
    }

    // Gate 4: Not dismissed in this cycle
    if (this.dismissedSet.has(task.id)) {
      return this.reject(task, "dismissed_this_cycle", `Task ${task.id} was dismissed this cycle`);
    }

    // Gate 5: Dependency guard — blocked tasks must NOT be reminded
    if (this.dependencyGuard.isBlocked(task.id)) {
      return this.reject(task, "dependency_blocked", `Task ${task.id} is blocked by dependencies`);
    }

    // Gate 6: Recurrence resolution — attach to latest instance
    const recurrenceResult = this.recurrenceResolver.resolveInstance(task);
    const resolvedTask = recurrenceResult.task;

    if (recurrenceResult.seriesEnded) {
      return this.reject(
        resolvedTask,
        "recurrence_series_ended",
        `Task ${task.id} recurrence series has ended`,
        undefined,
        recurrenceResult,
      );
    }

    // Gate 7: Block attribute validation
    const blockResult = await this.blockValidator.exists(resolvedTask);
    if (!blockResult.valid) {
      return this.reject(
        resolvedTask,
        "block_validation_failed",
        blockResult.reason || `Block validation failed for task ${task.id}`,
        blockResult,
        recurrenceResult,
      );
    }

    // Gate 8: Overdue dedup — one reminder per overdue state change
    if (this.overdueRemindedSet.has(task.id)) {
      return this.reject(
        resolvedTask,
        "overdue_already_reminded",
        `Task ${task.id} already reminded in this overdue cycle`,
        blockResult,
        recurrenceResult,
      );
    }

    // All gates passed
    this.totalAllowed++;
    return {
      allowed: true,
      resolvedTask,
      blockValidation: blockResult,
      recurrenceResult,
    };
  }

  /**
   * Mark a task as reminded in the current overdue cycle.
   * Prevents duplicate reminders for the same overdue state.
   */
  markReminded(taskId: string): void {
    this.overdueRemindedSet.add(taskId);
  }

  /**
   * Clear the overdue reminded state for a task.
   * Called when task transitions out of overdue (completed, rescheduled, etc).
   */
  clearRemindedState(taskId: string): void {
    this.overdueRemindedSet.delete(taskId);
    this.dismissedSet.delete(taskId);
  }

  /**
   * Mark a task's reminder as dismissed by the user.
   * Prevents re-firing within the same cycle.
   */
  markDismissed(taskId: string): void {
    this.dismissedSet.add(taskId);
  }

  /**
   * Reset all state (e.g., on new scheduler cycle).
   */
  resetCycle(): void {
    this.overdueRemindedSet.clear();
    this.dismissedSet.clear();
  }

  /**
   * Get policy evaluation stats.
   */
  getStats(): ReminderPolicyStats {
    return {
      totalEvaluated: this.totalEvaluated,
      totalAllowed: this.totalAllowed,
      totalSuppressed: this.totalSuppressed,
      suppressionBreakdown: { ...this.suppressionBreakdown },
    };
  }

  // ── Private ──────────────────────────────────────────────────

  private reject(
    task: ReadonlyTask,
    reason: PolicyRejectionReason,
    explanation: string,
    blockValidation?: BlockValidationResult,
    recurrenceResult?: ResolveResult,
  ): PolicyEvaluationResult {
    this.totalSuppressed++;
    this.suppressionBreakdown[reason]++;
    logger.debug("[ReminderPolicy] Suppressed", { taskId: task.id, reason });
    return {
      allowed: false,
      resolvedTask: task,
      rejectionReason: reason,
      explanation,
      blockValidation,
      recurrenceResult,
    };
  }
}
