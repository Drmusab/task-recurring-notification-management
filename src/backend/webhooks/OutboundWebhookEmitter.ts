/**
 * OutboundWebhookEmitter — Runtime-Validated Webhook Emission Gate
 *
 * The ENTRY POINT for the webhook pipeline. Validates every webhook request
 * through the full runtime gate chain before mapping and enqueueing.
 *
 * Validation pipeline (all gates must pass before webhook fires):
 *   1. Lifecycle check     — emitter must be active (not before onload / after onunload)
 *   2. Status check        — completed / archived / cancelled → suppress
 *   3. Dependency guard    — DependencyExecutionGuard.isBlocked() → suppress
 *   4. Recurrence resolver — resolve to latest instance, skip parent template
 *   5. Block validator     — BlockAttributeValidator.exists() → suppress if invalid
 *
 * After validation:
 *   6. Map via WebhookEventMapper
 *   7. Generate dedup key via SignatureGenerator
 *   8. Enqueue to WebhookQueue
 *   9. Emit task:webhook:fired (or task:webhook:suppressed)
 *
 * What moved:
 *   HTTP delivery → IntegrationDispatcher (new file)
 *   HMAC signing  → SignatureGenerator (new file)
 *
 * Flow:
 *   SchedulerService.emit(task:overdue)
 *     → OutboundWebhookEmitter.emit()
 *       → validate → map → enqueue
 *     → IntegrationDispatcher.fire()
 *       → HTTP POST → RetryManager.track()
 *
 * FORBIDDEN:
 *   - Make HTTP requests (delegate to IntegrationDispatcher)
 *   - Import frontend / Svelte
 *   - Bypass validation gates
 *   - Fire for completed / blocked / deleted tasks
 *   - Emit for recurring parent template (must resolve instance)
 *   - Initialize before plugin.onload()
 *   - Fire before storage load
 */

import type { ReadonlyTask, Task } from "@backend/core/models/Task";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { DependencyExecutionGuard } from "@backend/dependencies/DependencyExecutionGuard";
import type { RecurrenceResolver, ResolveResult } from "@backend/services/RecurrenceResolver";
import type { BlockAttributeValidator, BlockValidationResult } from "@backend/services/BlockAttributeValidator";
import type { WebhookEvent } from "@backend/events/types/EventTypes";
import type { WebhookEventMapper, ValidatedMappingContext } from "./WebhookEventMapper";
import type { SignatureGenerator, SignatureContext } from "./SignatureGenerator";
import type { WebhookQueue, WebhookDeliveryTarget, WebhookQueueItem } from "./WebhookQueue";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface EmitterDeps {
  pluginEventBus: PluginEventBus;
  dependencyGuard: DependencyExecutionGuard;
  recurrenceResolver: RecurrenceResolver;
  blockValidator: BlockAttributeValidator;
  webhookMapper: WebhookEventMapper;
  signatureGenerator: SignatureGenerator;
  webhookQueue: WebhookQueue;
}

export type EmitEventType =
  | "due"
  | "overdue"
  | "escalated"
  | "completed"
  | "escalation_resolved"
  | "notification_sent";

export interface EmitInput {
  /** The task to fire a webhook for */
  task: ReadonlyTask;
  /** Type of webhook event */
  eventType: EmitEventType;
  /** Delivery targets (URL + optional secret) */
  targets: WebhookDeliveryTarget[];
  /** Extra context per event type */
  overdueMinutes?: number;
  escalationLevel?: number;
  escalationReason?: string;
  resolvedBy?: "completed" | "rescheduled" | "deleted" | "manual";
  previousEscalationLevel?: number;
  notificationType?: "due" | "overdue" | "advance" | "completed";
  nextDueDate?: string | null;
}

export type SuppressionReason =
  | "emitter_inactive"
  | "no_targets"
  | "status_terminal"
  | "dependency_blocked"
  | "recurrence_parent_template"
  | "recurrence_series_ended"
  | "block_validation_failed"
  | "enqueue_failed";

export interface EmitResult {
  /** Whether the webhook was enqueued for delivery */
  emitted: boolean;
  /** Number of queue items created (one per target) */
  enqueuedCount: number;
  /** Suppression reason if emitted is false */
  suppressionReason?: SuppressionReason;
  /** Explanation for suppression */
  explanation?: string;
  /** Resolved recurrence instance (if recurring) */
  recurrenceInstance?: string;
  /** Resolved task (after recurrence resolution) */
  resolvedTask?: ReadonlyTask;
}

export interface EmitterStats {
  totalEmitted: number;
  totalSuppressed: number;
  totalEnqueued: number;
  suppressionBreakdown: Record<SuppressionReason, number>;
}

// Legacy compat exports (used by IntegrationManager)
export interface WebhookTarget {
  url: string;
  secret?: string;
  blockId?: string;
}

export interface FireResult {
  deliveryId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

/** Task statuses that MUST NOT trigger webhooks */
const TERMINAL_STATUSES = new Set(["done", "archived", "cancelled"]);

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class OutboundWebhookEmitter {
  private readonly eventBus: PluginEventBus;
  private readonly dependencyGuard: DependencyExecutionGuard;
  private readonly recurrenceResolver: RecurrenceResolver;
  private readonly blockValidator: BlockAttributeValidator;
  private readonly mapper: WebhookEventMapper;
  private readonly sigGen: SignatureGenerator;
  private readonly queue: WebhookQueue;

  private active = false;

  // Stats
  private totalEmitted = 0;
  private totalSuppressed = 0;
  private totalEnqueued = 0;
  private suppressionBreakdown: Record<SuppressionReason, number> = {
    emitter_inactive: 0,
    no_targets: 0,
    status_terminal: 0,
    dependency_blocked: 0,
    recurrence_parent_template: 0,
    recurrence_series_ended: 0,
    block_validation_failed: 0,
    enqueue_failed: 0,
  };

  constructor(deps: EmitterDeps) {
    this.eventBus = deps.pluginEventBus;
    this.dependencyGuard = deps.dependencyGuard;
    this.recurrenceResolver = deps.recurrenceResolver;
    this.blockValidator = deps.blockValidator;
    this.mapper = deps.webhookMapper;
    this.sigGen = deps.signatureGenerator;
    this.queue = deps.webhookQueue;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[OutboundWebhookEmitter] Started — validation gate active");
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    logger.info("[OutboundWebhookEmitter] Stopped", this.getStats());
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Emit a webhook for a task through the full validation pipeline.
   *
   * Pipeline:
   *   1. lifecycle check
   *   2. target check
   *   3. status check (terminal → suppress)
   *   4. dependency guard (blocked → suppress)
   *   5. recurrence resolution (parent → suppress, series ended → suppress)
   *   6. block validation (invalid → suppress)
   *   7. map → enqueue
   *
   * @returns EmitResult with emitted status, suppression reason, or enqueue count
   */
  async emit(input: EmitInput): Promise<EmitResult> {
    // ── Gate 1: Lifecycle ──
    if (!this.active) {
      return this.suppress(input.task, "emitter_inactive", "Emitter not active");
    }

    // ── Gate 2: Targets ──
    if (!input.targets || input.targets.length === 0) {
      return this.suppress(input.task, "no_targets", "No delivery targets configured");
    }

    // ── Gate 3: Terminal status ──
    if (input.task.status && TERMINAL_STATUSES.has(input.task.status)) {
      return this.suppress(
        input.task,
        "status_terminal",
        `Task ${input.task.id} has terminal status: ${input.task.status}`,
      );
    }

    // ── Gate 4: Dependency guard ──
    if (this.dependencyGuard.isBlocked(input.task.id)) {
      return this.suppress(
        input.task,
        "dependency_blocked",
        `Task ${input.task.id} is blocked by dependencies`,
      );
    }

    // ── Gate 5: Recurrence resolution ──
    let resolvedTask: ReadonlyTask = input.task;
    let recurrenceInstance: string | undefined;
    let resolvedDueAt: string | undefined;

    const recurrenceResult: ResolveResult = this.recurrenceResolver.resolveInstance(input.task);

    if (recurrenceResult.isParentTemplate && !recurrenceResult.resolved) {
      return this.suppress(
        input.task,
        "recurrence_parent_template",
        `Task ${input.task.id} is a recurring parent template — webhook must target instance`,
      );
    }

    if (recurrenceResult.seriesEnded) {
      return this.suppress(
        input.task,
        "recurrence_series_ended",
        `Task ${input.task.id} recurrence series has ended`,
      );
    }

    resolvedTask = recurrenceResult.task;
    resolvedDueAt = recurrenceResult.resolvedDueAt;
    if (recurrenceResult.resolved && recurrenceResult.resolvedDueAt) {
      recurrenceInstance = recurrenceResult.resolvedDueAt;
    }

    // ── Gate 6: Block attribute validation ──
    const blockResult: BlockValidationResult = await this.blockValidator.exists(resolvedTask);
    if (!blockResult.valid) {
      return this.suppress(
        resolvedTask,
        "block_validation_failed",
        blockResult.reason || `Block validation failed for task ${input.task.id}`,
      );
    }

    // ── All gates passed — map and enqueue ──
    const validCtx: ValidatedMappingContext = {
      recurrenceInstance,
      isResolvedInstance: recurrenceResult.resolved,
      resolvedDueAt,
      verifiedBlockId: (resolvedTask as Task).blockId,
    };

    const event: WebhookEvent = this.mapEvent(input, resolvedTask as Task, validCtx);

    const sigCtx: SignatureContext = {
      taskId: resolvedTask.id,
      dueAt: resolvedDueAt ?? resolvedTask.dueAt ?? "",
      recurrenceInstance,
    };
    const deduplicationKey = this.sigGen.generateDeduplicationKey(sigCtx);

    let enqueuedCount = 0;
    for (const target of input.targets) {
      const queueItem: WebhookQueueItem = {
        id: this.sigGen.generateDeliveryId(),
        taskId: resolvedTask.id,
        blockId: (resolvedTask as Task).blockId,
        event,
        targets: [target],
        deduplicationKey: `${deduplicationKey}::${target.url}`,
        priority: 0, // auto-assigned by queue
        enqueuedAt: new Date().toISOString(),
        recurrenceInstance,
      };

      if (this.queue.enqueue(queueItem)) {
        enqueuedCount++;
      }
    }

    if (enqueuedCount === 0) {
      return this.suppress(
        resolvedTask,
        "enqueue_failed",
        "All items deduplicated or queue full",
      );
    }

    this.totalEmitted++;
    this.totalEnqueued += enqueuedCount;

    // ── Emit frontend-reactive event ──
    this.eventBus.emit("task:webhook:fired", {
      taskId: resolvedTask.id,
      eventType: event.event,
      deliveryId: deduplicationKey,
      target: input.targets.map((t) => t.url).join(", "),
    });

    logger.debug("[OutboundWebhookEmitter] Webhook enqueued", {
      taskId: resolvedTask.id,
      eventType: event.event,
      targets: enqueuedCount,
      recurrenceInstance,
    });

    return {
      emitted: true,
      enqueuedCount,
      recurrenceInstance,
      resolvedTask,
    };
  }

  /**
   * Check whether a task would pass validation gates (dry run).
   * Does NOT enqueue.
   */
  async canEmit(task: ReadonlyTask): Promise<{ allowed: boolean; reason?: SuppressionReason }> {
    if (!this.active) return { allowed: false, reason: "emitter_inactive" };
    if (task.status && TERMINAL_STATUSES.has(task.status)) return { allowed: false, reason: "status_terminal" };
    if (this.dependencyGuard.isBlocked(task.id)) return { allowed: false, reason: "dependency_blocked" };

    const rec = this.recurrenceResolver.resolveInstance(task);
    if (rec.isParentTemplate && !rec.resolved) return { allowed: false, reason: "recurrence_parent_template" };
    if (rec.seriesEnded) return { allowed: false, reason: "recurrence_series_ended" };

    const block = await this.blockValidator.exists(rec.task);
    if (!block.valid) return { allowed: false, reason: "block_validation_failed" };

    return { allowed: true };
  }

  /**
   * Get emitter statistics.
   */
  getStats(): EmitterStats {
    return {
      totalEmitted: this.totalEmitted,
      totalSuppressed: this.totalSuppressed,
      totalEnqueued: this.totalEnqueued,
      suppressionBreakdown: { ...this.suppressionBreakdown },
    };
  }

  // ── Internal ─────────────────────────────────────────────────

  /**
   * Map the input to a WebhookEvent via WebhookEventMapper.
   */
  private mapEvent(
    input: EmitInput,
    task: Task,
    validCtx: ValidatedMappingContext,
  ): WebhookEvent {
    switch (input.eventType) {
      case "due":
        return this.mapper.mapTaskDue(task, validCtx);

      case "overdue":
        return this.mapper.mapTaskOverdue(task, input.overdueMinutes ?? 0, validCtx);

      case "escalated":
        return this.mapper.mapEscalation({
          task,
          level: input.escalationLevel ?? 1,
          reason: input.escalationReason ?? "overdue",
          overdueMinutes: input.overdueMinutes ?? 0,
          recurrenceInstance: validCtx.recurrenceInstance,
        });

      case "completed":
        return this.mapper.mapTaskCompleted(task, input.nextDueDate);

      case "escalation_resolved":
        return this.mapper.mapEscalationResolved({
          task,
          resolvedBy: input.resolvedBy ?? "manual",
          previousLevel: input.previousEscalationLevel ?? 0,
        });

      case "notification_sent":
        return this.mapper.mapNotificationSent(task, input.notificationType ?? "due");

      default:
        return this.mapper.mapGeneric("task.due" as const, task.id, {
          title: task.name ?? task.id,
          dueDate: task.dueAt ?? "",
          priority: task.priority ?? "medium",
        });
    }
  }

  /**
   * Record a suppression and emit the corresponding event.
   */
  private suppress(
    task: ReadonlyTask,
    reason: SuppressionReason,
    explanation: string,
  ): EmitResult {
    this.totalSuppressed++;
    this.suppressionBreakdown[reason]++;

    this.eventBus.emit("task:webhook:suppressed", {
      taskId: task.id,
      reason: explanation,
    });

    logger.debug("[OutboundWebhookEmitter] Suppressed", {
      taskId: task.id,
      reason,
    });

    return {
      emitted: false,
      enqueuedCount: 0,
      suppressionReason: reason,
      explanation,
    };
  }
}
