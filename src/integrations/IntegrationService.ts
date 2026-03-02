/**
 * IntegrationService — Webhook Dispatch with Retry (§5.2)
 *
 * Dispatches webhook payloads to configured endpoints after task
 * lifecycle events. Implements retry logic with exponential backoff.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Subscribes to EventBus events
 *   ✔ Sends HTTP POST with task DTOs (never domain objects)
 *   ✔ Retry with exponential backoff (3 attempts)
 *   ✔ Emits task:webhook:fired on success
 *   ❌ No task mutations
 *   ❌ No SiYuan kernel API (uses raw fetch for external webhooks)
 *   ❌ No frontend imports
 */

import type { DomainTask } from "@domain/DomainTask";
import { toDTO } from "@domain/DomainMapper";
import { eventBus } from "@events/EventBus";
import type { TaskDTO } from "@domain/DomainMapper";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface WebhookConfig {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly enabled: boolean;
  readonly events: readonly string[];
  readonly headers?: Record<string, string>;
  readonly secret?: string;
}

export interface WebhookDelivery {
  readonly deliveryId: string;
  readonly webhookId: string;
  readonly event: string;
  readonly status: "success" | "failed";
  readonly statusCode?: number;
  readonly timestamp: string;
  readonly error?: string;
  readonly attempts: number;
}

interface WebhookPayload {
  readonly event: string;
  readonly timestamp: string;
  readonly task: TaskDTO;
  readonly pluginVersion: string;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class IntegrationService {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveryLog: WebhookDelivery[] = [];
  private unsubscribers: Array<() => void> = [];
  private readonly maxRetries = 3;
  private readonly maxDeliveryLogSize = 200;

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    this.unsubscribers.push(
      eventBus.on("task:runtime:created", ({ task }) => {
        void this.dispatch("task:runtime:created", task);
      }),
      eventBus.on("task:runtime:completed", ({ task }) => {
        void this.dispatch("task:runtime:completed", task);
      }),
      eventBus.on("task:runtime:rescheduled", ({ task }) => {
        void this.dispatch("task:runtime:rescheduled", task);
      }),
      eventBus.on("task:runtime:deleted", ({ task }) => {
        if (task) void this.dispatch("task:runtime:deleted", task);
      }),
      eventBus.on("task:runtime:missed", ({ task }) => {
        void this.dispatch("task:runtime:missed", task);
      }),
    );
  }

  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  // ── Configuration ────────────────────────────────────────────

  registerWebhook(config: WebhookConfig): void {
    this.webhooks.set(config.id, config);
  }

  unregisterWebhook(webhookId: string): void {
    this.webhooks.delete(webhookId);
  }

  getWebhooks(): readonly WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  getDeliveryLog(): readonly WebhookDelivery[] {
    return [...this.deliveryLog];
  }

  // ── Dispatch ─────────────────────────────────────────────────

  /**
   * Dispatch an event to all matching webhooks.
   */
  private async dispatch(event: string, task: DomainTask): Promise<void> {
    const dto = toDTO(task);

    for (const webhook of this.webhooks.values()) {
      if (!webhook.enabled) continue;
      if (webhook.events.length > 0 && !webhook.events.includes(event)) continue;

      await this.deliverWithRetry(webhook, event, dto);
    }
  }

  /**
   * Deliver a webhook payload with retry logic.
   */
  private async deliverWithRetry(
    webhook: WebhookConfig,
    event: string,
    taskDTO: TaskDTO,
  ): Promise<void> {
    const deliveryId = `delivery-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      task: taskDTO,
      pluginVersion: "3.0.0",
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...webhook.headers,
    };

    if (webhook.secret) {
      headers["X-Webhook-Secret"] = webhook.secret;
    }

    let lastError: string | undefined;
    let statusCode: number | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        statusCode = response.status;

        if (response.ok) {
          this.recordDelivery({
            deliveryId,
            webhookId: webhook.id,
            event,
            status: "success",
            statusCode,
            timestamp: new Date().toISOString(),
            attempts: attempt,
          });

          // Emit webhook:fired event
          eventBus.emit("task:webhook:fired", {
            task: {} as DomainTask, // minimal — dto already sent
            webhook: { id: webhook.id, url: webhook.url, name: webhook.name },
            deliveryId,
          });

          return;
        }

        lastError = `HTTP ${response.status}: ${response.statusText}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      // Exponential backoff before retry
      if (attempt < this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // All attempts failed
    this.recordDelivery({
      deliveryId,
      webhookId: webhook.id,
      event,
      status: "failed",
      statusCode,
      timestamp: new Date().toISOString(),
      error: lastError,
      attempts: this.maxRetries,
    });
  }

  private recordDelivery(delivery: WebhookDelivery): void {
    this.deliveryLog.push(delivery);
    // Trim log to prevent memory bloat
    if (this.deliveryLog.length > this.maxDeliveryLogSize) {
      this.deliveryLog = this.deliveryLog.slice(-this.maxDeliveryLogSize);
    }
  }
}
