/**
 * WebhookService — Runtime-Validated Integration Pipeline Orchestrator
 *
 * Top-level service that wires together the entire webhook subsystem:
 *
 *   SignatureGenerator       — HMAC signing + dedup keys
 *   WebhookEventMapper       — event payload mapping
 *   WebhookQueue             — priority queue with dedup
 *   OutboundWebhookEmitter   — validation gate (dependency, recurrence, block)
 *   IntegrationDispatcher    — HTTP delivery engine
 *   RetryManager             — block-validated retry with AI guard
 *
 * Canonical flow:
 *   SchedulerService.emit("task:overdue")
 *     → WebhookService.handleTaskEvent()
 *       → OutboundWebhookEmitter.emit()
 *         → dependency guard → recurrence resolver → block validator
 *         → WebhookEventMapper.map()
 *         → WebhookQueue.enqueue()
 *     → WebhookService.flush()
 *       → IntegrationDispatcher.fire()
 *         → HTTP POST → RetryManager.track()
 *         → EventBus.emit("task:webhook:fired")
 *
 * Lifecycle rules:
 *   - MUST NOT initialize before plugin.onload()
 *   - MUST NOT fire before storage load
 *   - MUST NOT retry after plugin.onunload()
 *   - MUST NOT fire directly from scheduler (must go through validation)
 *
 * Event subscriptions:
 *   task:runtime:completed   → resolve pending retries
 *   task:runtime:rescheduled → resolve pending retries
 *   task:overdue             → emit webhook (via validation pipeline)
 *   task:runtime:due         → emit webhook (via validation pipeline)
 *   task:escalated           → emit escalation webhook
 *
 * FORBIDDEN:
 *   - Bypass the pipeline (all webhooks must flow through validate → enqueue → fire)
 *   - Mutate task model
 *   - Access DOM / frontend
 *   - Trigger AI urgency on retry
 */

import type { ReadonlyTask, Task } from "@backend/core/models/Task";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { DependencyExecutionGuard } from "@backend/dependencies/DependencyExecutionGuard";
import type { BlockAttributeValidator } from "@backend/services/BlockAttributeValidator";
import type { RecurrenceResolver } from "@backend/services/RecurrenceResolver";
import { SignatureGenerator, type SignatureGeneratorStats } from "./SignatureGenerator";
import { WebhookEventMapper, type MapperContext, type WebhookEventMapperStats } from "./WebhookEventMapper";
import { WebhookQueue, type WebhookDeliveryTarget, type WebhookQueueStats } from "./WebhookQueue";
import { OutboundWebhookEmitter, type EmitInput, type EmitResult, type EmitterStats } from "./OutboundWebhookEmitter";
import { IntegrationDispatcher, type DispatchBatchResult, type IntegrationDispatcherStats } from "./IntegrationDispatcher";
import { RetryManager, type RetryConfig, type RetryManagerStats } from "./RetryManager";
import type { EscalationEventInput, EscalationResolvedInput } from "./WebhookEventMapper";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface WebhookServiceDeps {
  pluginEventBus: PluginEventBus;
  dependencyGuard: DependencyExecutionGuard;
  blockValidator: BlockAttributeValidator;
  recurrenceResolver: RecurrenceResolver;
  /** Task lookup function (from TaskStorage) */
  getTask: (taskId: string) => ReadonlyTask | undefined;
  /** Injectable fetch (default: globalThis.fetch) */
  fetcher?: typeof fetch;
}

export interface WebhookServiceConfig {
  workspaceId: string;
  retryConfig?: Partial<RetryConfig>;
}

export interface WebhookRegistration {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  description?: string;
}

export interface WebhookServiceStats {
  active: boolean;
  flushCount: number;
  lastFlushAt: string | null;
  registeredTargets: number;
  signatureGenerator: SignatureGeneratorStats;
  mapper: WebhookEventMapperStats;
  queue: WebhookQueueStats;
  emitter: EmitterStats;
  dispatcher: IntegrationDispatcherStats;
  retryManager: RetryManagerStats;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class WebhookService {
  private readonly eventBus: PluginEventBus;
  private readonly getTask: (taskId: string) => ReadonlyTask | undefined;

  // ── Sub-services (composed internally) ──
  private readonly signatureGenerator: SignatureGenerator;
  private readonly mapper: WebhookEventMapper;
  private readonly queue: WebhookQueue;
  private readonly emitter: OutboundWebhookEmitter;
  private readonly dispatcher: IntegrationDispatcher;
  private readonly retryManager: RetryManager;

  // ── Registration state ──
  private registrations: Map<string, WebhookRegistration> = new Map();

  // ── Event subscriptions ──
  private unsubscribes: Array<() => void> = [];

  // ── Lifecycle ──
  private active = false;
  private flushCount = 0;
  private lastFlushAt: string | null = null;

  /** Periodic flush interval handle */
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  /** Default flush interval in milliseconds */
  private static readonly FLUSH_INTERVAL_MS = 5_000; // 5 seconds

  constructor(deps: WebhookServiceDeps, config: WebhookServiceConfig) {
    this.eventBus = deps.pluginEventBus;
    this.getTask = deps.getTask;

    // ── Build the pipeline ──

    // 1. Signature generator
    this.signatureGenerator = new SignatureGenerator();

    // 2. Event mapper
    const mapperCtx: MapperContext = { workspaceId: config.workspaceId };
    this.mapper = new WebhookEventMapper(mapperCtx);

    // 3. Queue
    this.queue = new WebhookQueue();

    // 4. Retry manager (needs onRetry callback → set after dispatcher construction)
    this.retryManager = new RetryManager(
      {
        blockValidator: deps.blockValidator,
        pluginEventBus: deps.pluginEventBus,
        onRetry: (record) => this.dispatcher.retry(record),
      },
      config.retryConfig,
    );

    // 5. Integration dispatcher (HTTP delivery)
    this.dispatcher = new IntegrationDispatcher({
      pluginEventBus: deps.pluginEventBus,
      signatureGenerator: this.signatureGenerator,
      retryManager: this.retryManager,
      webhookQueue: this.queue,
      fetcher: deps.fetcher,
    });

    // 6. Outbound emitter (validation gate)
    this.emitter = new OutboundWebhookEmitter({
      pluginEventBus: deps.pluginEventBus,
      dependencyGuard: deps.dependencyGuard,
      recurrenceResolver: deps.recurrenceResolver,
      blockValidator: deps.blockValidator,
      webhookMapper: this.mapper,
      signatureGenerator: this.signatureGenerator,
      webhookQueue: this.queue,
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;

    // Start sub-services in dependency order
    this.signatureGenerator.start();
    this.queue.start();
    this.retryManager.start();
    this.dispatcher.start();
    this.emitter.start();

    // Subscribe to runtime events
    this.subscribeToEvents();

    // Periodic flush
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, WebhookService.FLUSH_INTERVAL_MS);

    this.active = true;
    logger.info("[WebhookService] Started — full webhook pipeline active", {
      targets: this.registrations.size,
    });
  }

  stop(): void {
    if (!this.active) return;

    // Cancel flush interval
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Unsubscribe from events
    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* already cleared */ }
    }
    this.unsubscribes = [];

    // Stop sub-services in reverse order
    this.emitter.stop();
    this.dispatcher.stop();
    this.retryManager.stop();
    this.queue.stop();
    this.signatureGenerator.stop();

    this.active = false;
    logger.info("[WebhookService] Stopped — all webhook activity halted");
  }

  // ── Public API: Dispatch ─────────────────────────────────────

  /**
   * Flush queued webhooks — drain queue and deliver.
   */
  async flush(): Promise<DispatchBatchResult> {
    if (!this.active) {
      return { drained: 0, dispatched: 0, failed: 0, durationMs: 0 };
    }

    const result = await this.dispatcher.fire();
    this.flushCount++;
    this.lastFlushAt = new Date().toISOString();
    return result;
  }

  /**
   * Dispatch an escalation webhook through the full validation pipeline.
   */
  async dispatchEscalation(input: EscalationEventInput): Promise<EmitResult> {
    if (!this.active) {
      return { emitted: false, enqueuedCount: 0, suppressionReason: "emitter_inactive" };
    }

    return this.emitter.emit({
      task: input.task as ReadonlyTask,
      eventType: "escalated",
      targets: this.getActiveTargetsForEvent("task.escalated"),
      overdueMinutes: input.overdueMinutes,
      escalationLevel: input.level,
      escalationReason: input.reason,
    });
  }

  /**
   * Dispatch an escalation resolved webhook.
   */
  async dispatchEscalationResolved(input: EscalationResolvedInput): Promise<EmitResult> {
    if (!this.active) {
      return { emitted: false, enqueuedCount: 0, suppressionReason: "emitter_inactive" };
    }

    return this.emitter.emit({
      task: input.task as ReadonlyTask,
      eventType: "escalation_resolved",
      targets: this.getActiveTargetsForEvent("task.escalation.resolved"),
      resolvedBy: input.resolvedBy,
      previousEscalationLevel: input.previousLevel,
    });
  }

  /**
   * Dispatch a task:due webhook.
   */
  async dispatchTaskDue(task: Task): Promise<EmitResult> {
    if (!this.active) {
      return { emitted: false, enqueuedCount: 0, suppressionReason: "emitter_inactive" };
    }

    return this.emitter.emit({
      task: task as ReadonlyTask,
      eventType: "due",
      targets: this.getActiveTargetsForEvent("task.due"),
    });
  }

  /**
   * Dispatch a task:overdue webhook.
   */
  async dispatchTaskOverdue(task: Task, overdueMinutes: number): Promise<EmitResult> {
    if (!this.active) {
      return { emitted: false, enqueuedCount: 0, suppressionReason: "emitter_inactive" };
    }

    return this.emitter.emit({
      task: task as ReadonlyTask,
      eventType: "overdue",
      targets: this.getActiveTargetsForEvent("task.overdue"),
      overdueMinutes,
    });
  }

  // ── Public API: Registration ─────────────────────────────────

  registerTarget(reg: WebhookRegistration): void {
    this.registrations.set(reg.id, reg);
    logger.info("[WebhookService] Target registered", {
      id: reg.id,
      url: reg.url,
      events: reg.events,
    });
  }

  unregisterTarget(id: string): void {
    this.registrations.delete(id);
  }

  getTargets(): WebhookRegistration[] {
    return Array.from(this.registrations.values());
  }

  // ── Public API: Workspace ────────────────────────────────────

  setWorkspaceId(id: string): void {
    this.mapper.setWorkspaceId(id);
  }

  // ── Public API: Retry Resolution ─────────────────────────────

  resolveRetries(
    taskId: string,
    resolvedBy: "completed" | "rescheduled" | "deleted" | "manual",
  ): void {
    this.retryManager.resolve(taskId, resolvedBy);
    this.queue.remove(taskId);
  }

  /**
   * Check if task has pending webhooks or retries.
   */
  hasPending(taskId: string): boolean {
    return this.queue.has(taskId) || this.retryManager.hasPending(taskId);
  }

  // ── Public API: Stats ────────────────────────────────────────

  isActive(): boolean {
    return this.active;
  }

  getStats(): WebhookServiceStats {
    return {
      active: this.active,
      flushCount: this.flushCount,
      lastFlushAt: this.lastFlushAt,
      registeredTargets: this.registrations.size,
      signatureGenerator: this.signatureGenerator.getStats(),
      mapper: this.mapper.getStats(),
      queue: this.queue.getStats(),
      emitter: this.emitter.getStats(),
      dispatcher: this.dispatcher.getStats(),
      retryManager: this.retryManager.getStats(),
    };
  }

  // ── Sub-service Access (for testing/monitoring) ──────────────

  getSignatureGenerator(): SignatureGenerator { return this.signatureGenerator; }
  getMapper(): WebhookEventMapper { return this.mapper; }
  getQueue(): WebhookQueue { return this.queue; }
  getEmitter(): OutboundWebhookEmitter { return this.emitter; }
  getDispatcher(): IntegrationDispatcher { return this.dispatcher; }
  getRetryManager(): RetryManager { return this.retryManager; }

  // ── Internal ─────────────────────────────────────────────────

  /**
   * Subscribe to runtime events for automatic webhook dispatch.
   */
  private subscribeToEvents(): void {
    // ── Task completed → resolve pending webhooks/retries ──
    this.unsubscribes.push(
      this.eventBus.on("task:runtime:completed", ({ taskId }) => {
        this.resolveRetries(taskId, "completed");
      }),
    );

    // ── Task rescheduled → resolve pending webhooks/retries ──
    this.unsubscribes.push(
      this.eventBus.on("task:runtime:rescheduled", ({ taskId }) => {
        this.resolveRetries(taskId, "rescheduled");
      }),
    );

    // ── Task overdue → emit webhook if targets registered ──
    this.unsubscribes.push(
      this.eventBus.on("task:overdue", ({ taskId, task }) => {
        if (!task) {
          const looked = this.getTask(taskId);
          if (looked) {
            void this.dispatchTaskOverdue(looked as Task, 0);
          }
          return;
        }
        void this.dispatchTaskOverdue(task, 0);
      }),
    );

    // ── Task due → emit webhook ──
    this.unsubscribes.push(
      this.eventBus.on("task:runtime:due", ({ taskId, task }) => {
        if (!task) {
          const looked = this.getTask(taskId);
          if (looked) {
            void this.dispatchTaskDue(looked as Task);
          }
          return;
        }
        void this.dispatchTaskDue(task);
      }),
    );

    // ── Escalation → emit webhook ──
    this.unsubscribes.push(
      this.eventBus.on("task:escalated", ({ taskId, level, reason }) => {
        const task = this.getTask(taskId);
        if (!task) return;
        void this.dispatchEscalation({
          task: task as Task,
          level,
          reason,
          overdueMinutes: 0,
        });
      }),
    );

    // ── Workspace changed → update mapper context ──
    this.unsubscribes.push(
      this.eventBus.on("workspace:changed", ({ workspaceId }) => {
        this.setWorkspaceId(workspaceId);
      }),
    );
  }

  /**
   * Get active delivery targets that match a specific event type.
   */
  private getActiveTargetsForEvent(eventType: string): WebhookDeliveryTarget[] {
    const targets: WebhookDeliveryTarget[] = [];
    for (const reg of this.registrations.values()) {
      if (!reg.active) continue;
      if (reg.events.length === 0 || reg.events.includes(eventType) || reg.events.includes("*")) {
        targets.push({
          url: reg.url,
          secret: reg.secret,
          registrationId: reg.id,
        });
      }
    }
    return targets;
  }
}
