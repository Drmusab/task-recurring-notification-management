/**
 * NotificationService — Centralized Notification Dispatch (DEPRECATED)
 *
 * @deprecated Use WebhookService from @backend/webhooks instead.
 *
 * The webhook delivery pipeline has been migrated to WebhookService,
 * which provides runtime-validated dispatch (dependency guard, recurrence
 * resolution, block validation, AI urgency guard).
 *
 * IntegrationManager now delegates to WebhookService directly.
 *
 * This file is retained for backward compatibility and will be removed
 * in a future refactoring session.
 *
 * FORBIDDEN:
 *   - Import frontend / Svelte
 *   - Call SiYuan API directly (delegates to BlockAttributeSync)
 *   - Start before storage load completes
 */

import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type {
  WebhookEventMapper,
  EscalationEventInput,
  EscalationResolvedInput,
} from "@backend/webhooks";
import type { RetryManager, EmitResult } from "@backend/webhooks";
import type { OutboundWebhookEmitter, WebhookTarget } from "@backend/webhooks";
import type { Task } from "@backend/core/models/Task";
import type { WebhookEvent, EventType } from "@backend/events/types/EventTypes";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface NotificationServiceDeps {
  pluginEventBus: PluginEventBus;
  webhookMapper: WebhookEventMapper;
  webhookEmitter: OutboundWebhookEmitter;
  retryManager: RetryManager;
}

export interface WebhookRegistration {
  id: string;
  url: string;
  secret?: string;
  /** Event types this registration listens to (empty = all) */
  events: EventType[];
  active: boolean;
  description?: string;
}

export interface DispatchResult {
  eventType: EventType;
  taskId: string;
  targets: number;
  successes: number;
  failures: number;
}

export interface NotificationServiceStats {
  totalDispatched: number;
  totalDelivered: number;
  totalFailed: number;
  registeredTargets: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class NotificationService {
  private readonly eventBus: PluginEventBus;
  private readonly mapper: WebhookEventMapper;
  private readonly emitter: OutboundWebhookEmitter;
  private readonly retryManager: RetryManager;

  /** Registered webhook targets */
  private registrations: Map<string, WebhookRegistration> = new Map();

  /** Event unsubscribe handles */
  private unsubscribes: Array<() => void> = [];

  private active = false;

  // Stats
  private totalDispatched = 0;
  private totalDelivered = 0;
  private totalFailed = 0;

  constructor(deps: NotificationServiceDeps) {
    this.eventBus = deps.pluginEventBus;
    this.mapper = deps.webhookMapper;
    this.emitter = deps.webhookEmitter;
    this.retryManager = deps.retryManager;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;

    // Subscribe to cache-invalidation events to resolve pending retries
    this.unsubscribes.push(
      this.eventBus.on("task:runtime:completed", ({ taskId }) => {
        this.retryManager.resolve(taskId, "completed");
        this.eventBus.emit("task:escalation:resolved", {
          taskId,
          resolvedBy: "completed",
        });
      }),

      this.eventBus.on("task:runtime:rescheduled", ({ taskId }) => {
        this.retryManager.resolve(taskId, "rescheduled");
        this.eventBus.emit("task:escalation:resolved", {
          taskId,
          resolvedBy: "rescheduled",
        });
      }),
    );

    logger.info("[NotificationService] Started", {
      targets: this.registrations.size,
    });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;

    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* already cleared */ }
    }
    this.unsubscribes = [];

    logger.info("[NotificationService] Stopped", this.getStats());
  }

  // ── Registration ─────────────────────────────────────────────

  /**
   * Register a webhook target for event delivery.
   */
  registerTarget(reg: WebhookRegistration): void {
    this.registrations.set(reg.id, reg);
    logger.info("[NotificationService] Target registered", {
      id: reg.id,
      url: reg.url,
      events: reg.events,
    });
  }

  /**
   * Unregister a webhook target.
   */
  unregisterTarget(id: string): void {
    this.registrations.delete(id);
  }

  /**
   * Get all registered targets.
   */
  getTargets(): WebhookRegistration[] {
    return Array.from(this.registrations.values());
  }

  // ── Dispatch ─────────────────────────────────────────────────

  /**
   * Dispatch an escalation event to all matching targets.
   */
  async dispatchEscalation(input: EscalationEventInput): Promise<DispatchResult> {
    if (!this.active) {
      return { eventType: "task.escalated", taskId: input.task.id, targets: 0, successes: 0, failures: 0 };
    }

    const event = this.mapper.mapEscalation(input);
    return this.deliverToTargets(event, input.task.id);
  }

  /**
   * Dispatch an escalation-resolved event to all matching targets.
   */
  async dispatchEscalationResolved(input: EscalationResolvedInput): Promise<DispatchResult> {
    if (!this.active) {
      return { eventType: "task.escalation.resolved", taskId: input.task.id, targets: 0, successes: 0, failures: 0 };
    }

    const event = this.mapper.mapEscalationResolved(input);
    return this.deliverToTargets(event, input.task.id);
  }

  /**
   * Dispatch a task-due notification.
   */
  async dispatchTaskDue(task: Task): Promise<DispatchResult> {
    if (!this.active) {
      return { eventType: "task.due", taskId: task.id, targets: 0, successes: 0, failures: 0 };
    }

    const event = this.mapper.mapTaskDue(task);
    return this.deliverToTargets(event, task.id);
  }

  /**
   * Dispatch a task-overdue notification.
   */
  async dispatchTaskOverdue(task: Task, overdueMinutes: number): Promise<DispatchResult> {
    if (!this.active) {
      return { eventType: "task.overdue", taskId: task.id, targets: 0, successes: 0, failures: 0 };
    }

    const event = this.mapper.mapTaskOverdue(task, overdueMinutes);
    return this.deliverToTargets(event, task.id);
  }

  /**
   * Dispatch a generic webhook event.
   */
  async dispatchGeneric(event: WebhookEvent, taskId: string): Promise<DispatchResult> {
    if (!this.active) {
      return { eventType: event.event, taskId, targets: 0, successes: 0, failures: 0 };
    }

    return this.deliverToTargets(event, taskId);
  }

  // ── Stats ────────────────────────────────────────────────────

  getStats(): NotificationServiceStats {
    return {
      totalDispatched: this.totalDispatched,
      totalDelivered: this.totalDelivered,
      totalFailed: this.totalFailed,
      registeredTargets: this.registrations.size,
    };
  }

  // ── Internal ─────────────────────────────────────────────────

  /**
   * Deliver an event to all matching registered targets.
   *
   * @deprecated This method is no longer functional. Use WebhookService instead.
   * Retained for backward compatibility — logs a deprecation warning.
   */
  private async deliverToTargets(event: WebhookEvent, taskId: string): Promise<DispatchResult> {
    const targets = this.matchTargets(event.event);
    this.totalDispatched++;

    if (targets.length === 0) {
      logger.debug("[NotificationService] No targets for event", {
        eventType: event.event,
        taskId,
      });
      return { eventType: event.event, taskId, targets: 0, successes: 0, failures: 0 };
    }

    logger.warn(
      "[NotificationService] deliverToTargets is DEPRECATED — use WebhookService",
      { eventType: event.event, taskId, targetCount: targets.length },
    );

    // In the old pipeline, this called emitter.fire() for each target.
    // The new OutboundWebhookEmitter uses emit() with validation gates.
    // Since IntegrationManager now delegates to WebhookService,
    // this code path should never be reached.
    return {
      eventType: event.event,
      taskId,
      targets: targets.length,
      successes: 0,
      failures: targets.length,
    };
  }

  /**
   * Find registered targets that match an event type.
   */
  private matchTargets(eventType: EventType): WebhookRegistration[] {
    const matched: WebhookRegistration[] = [];
    for (const reg of this.registrations.values()) {
      if (!reg.active) continue;
      // Empty events array = subscribe to all events
      if (reg.events.length === 0 || reg.events.includes(eventType)) {
        matched.push(reg);
      }
    }
    return matched;
  }
}
