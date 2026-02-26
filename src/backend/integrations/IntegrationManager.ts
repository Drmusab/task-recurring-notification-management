/**
 * IntegrationManager — Lifecycle Orchestrator for External Integrations
 *
 * Owns the webhook delivery pipeline lifecycle via WebhookService:
 *   1. SignatureGenerator   (HMAC signing + dedup)
 *   2. WebhookEventMapper   (payload mapping with recurrence context)
 *   3. WebhookQueue         (priority queue with dedup)
 *   4. OutboundWebhookEmitter (validation gate: dependency, recurrence, block)
 *   5. IntegrationDispatcher  (HTTP delivery engine)
 *   6. RetryManager          (block-validated retry with AI guard)
 *
 * When validation-gate deps are provided (dependencyGuard, recurrenceResolver,
 * blockValidator, getTask), uses the full WebhookService pipeline.
 * Otherwise operates in degraded mode (all dispatches suppressed).
 *
 * Boot sequence:
 *   IntegrationManager.start() → WebhookService.start()
 *
 * Integration:
 *   EngineController.start() ... → IntegrationManager.start()
 *   index.ts.onunload()         → IntegrationManager.stop()
 *
 * FORBIDDEN:
 *   - Import frontend / Svelte
 *   - Start before TaskStorage.init() completes
 *   - Bypass lifecycle order
 */

import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { BlockAttributeSync } from "@backend/blocks/BlockAttributeSync";
import type { DependencyExecutionGuard } from "@backend/dependencies/DependencyExecutionGuard";
import type { RecurrenceResolver } from "@backend/services/RecurrenceResolver";
import type { BlockAttributeValidator } from "@backend/services/BlockAttributeValidator";
import type { ReadonlyTask, Task } from "@backend/core/models/Task";
import {
  WebhookService,
  type WebhookRegistration,
  type WebhookServiceConfig,
  type RetryConfig,
  type EscalationEventInput,
  type EscalationResolvedInput,
  type EmitResult,
} from "@backend/webhooks";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface IntegrationManagerDeps {
  pluginEventBus: PluginEventBus;
  blockAttributeSync: BlockAttributeSync;
  /** Injectable fetch for testing */
  fetcher?: typeof fetch;
  /** Validation-gate deps (required for full pipeline) */
  dependencyGuard?: DependencyExecutionGuard;
  recurrenceResolver?: RecurrenceResolver;
  blockValidator?: BlockAttributeValidator;
  getTask?: (taskId: string) => ReadonlyTask | undefined;
}

export interface IntegrationManagerConfig {
  workspaceId: string;
  retryConfig?: Partial<RetryConfig>;
}

/** Lightweight dispatch result for backward compatibility */
export interface DispatchResult {
  eventType: string;
  taskId: string;
  targets: number;
  successes: number;
  failures: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class IntegrationManager {
  private readonly deps: IntegrationManagerDeps;
  private config: IntegrationManagerConfig;

  private webhookService: WebhookService | null = null;
  private active = false;

  constructor(deps: IntegrationManagerDeps, config: IntegrationManagerConfig) {
    this.deps = deps;
    this.config = config;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) {
      logger.warn("[IntegrationManager] Already started");
      return;
    }

    logger.info("[IntegrationManager] Starting integration pipeline…");

    // ── Validate that all required deps are provided ──
    if (
      this.deps.dependencyGuard &&
      this.deps.recurrenceResolver &&
      this.deps.blockValidator &&
      this.deps.getTask
    ) {
      this.webhookService = new WebhookService(
        {
          pluginEventBus: this.deps.pluginEventBus,
          dependencyGuard: this.deps.dependencyGuard,
          blockValidator: this.deps.blockValidator,
          recurrenceResolver: this.deps.recurrenceResolver,
          getTask: this.deps.getTask,
          fetcher: this.deps.fetcher,
        },
        {
          workspaceId: this.config.workspaceId,
          retryConfig: this.config.retryConfig,
        },
      );
      this.webhookService.start();
      logger.info("[IntegrationManager] Full WebhookService pipeline started");
    } else {
      logger.warn(
        "[IntegrationManager] Validation-gate deps not provided — webhook pipeline degraded",
        {
          hasDependencyGuard: !!this.deps.dependencyGuard,
          hasRecurrenceResolver: !!this.deps.recurrenceResolver,
          hasBlockValidator: !!this.deps.blockValidator,
          hasGetTask: !!this.deps.getTask,
        },
      );
    }

    this.active = true;
    logger.info("[IntegrationManager] Integration pipeline started");
  }

  stop(): void {
    if (!this.active) return;

    logger.info("[IntegrationManager] Stopping integration pipeline…");

    this.webhookService?.stop();
    this.webhookService = null;

    this.active = false;
    logger.info("[IntegrationManager] Integration pipeline stopped");
  }

  // ── Public API: Dispatch ─────────────────────────────────────

  async dispatchEscalation(input: EscalationEventInput): Promise<DispatchResult> {
    if (!this.webhookService) {
      return this.noop("task.escalated", input.task.id);
    }
    const result = await this.webhookService.dispatchEscalation(input);
    return this.toDispatchResult("task.escalated", input.task.id, result);
  }

  async dispatchEscalationResolved(input: EscalationResolvedInput): Promise<DispatchResult> {
    if (!this.webhookService) {
      return this.noop("task.escalation.resolved", input.task.id);
    }
    const result = await this.webhookService.dispatchEscalationResolved(input);
    return this.toDispatchResult("task.escalation.resolved", input.task.id, result);
  }

  async dispatchTaskDue(task: Task): Promise<DispatchResult> {
    if (!this.webhookService) {
      return this.noop("task.due", task.id);
    }
    const result = await this.webhookService.dispatchTaskDue(task);
    return this.toDispatchResult("task.due", task.id, result);
  }

  async dispatchTaskOverdue(task: Task, overdueMinutes: number): Promise<DispatchResult> {
    if (!this.webhookService) {
      return this.noop("task.overdue", task.id);
    }
    const result = await this.webhookService.dispatchTaskOverdue(task, overdueMinutes);
    return this.toDispatchResult("task.overdue", task.id, result);
  }

  // ── Public API: Registration ─────────────────────────────────

  registerTarget(reg: WebhookRegistration): void {
    this.webhookService?.registerTarget(reg);
  }

  unregisterTarget(id: string): void {
    this.webhookService?.unregisterTarget(id);
  }

  getTargets(): WebhookRegistration[] {
    return this.webhookService?.getTargets() ?? [];
  }

  // ── Public API: Workspace ────────────────────────────────────

  setWorkspaceId(id: string): void {
    this.config.workspaceId = id;
    this.webhookService?.setWorkspaceId(id);
  }

  // ── Public API: Stats ────────────────────────────────────────

  isActive(): boolean {
    return this.active;
  }

  getStats() {
    if (!this.webhookService) {
      return { webhook: null };
    }
    return { webhook: this.webhookService.getStats() };
  }

  // ── Public API: Retry Resolution ────────────────────────────

  resolveRetries(
    taskId: string,
    resolvedBy: "completed" | "rescheduled" | "deleted" | "manual",
  ): void {
    this.webhookService?.resolveRetries(taskId, resolvedBy);
  }

  // ── Internal ─────────────────────────────────────────────────

  private noop(eventType: string, taskId: string): DispatchResult {
    return { eventType, taskId, targets: 0, successes: 0, failures: 0 };
  }

  private toDispatchResult(eventType: string, taskId: string, result: EmitResult): DispatchResult {
    return {
      eventType,
      taskId,
      targets: result.enqueuedCount,
      successes: result.emitted ? result.enqueuedCount : 0,
      failures: result.emitted ? 0 : (result.enqueuedCount > 0 ? 0 : 1),
    };
  }
}
