/**
 * webhook-events.ts — Webhook Event Builder & Domain Event Bridge
 *
 * Bridges the internal EventBus domain events to outbound webhook payloads.
 * Converts DomainTask instances to n8n-compatible WebhookPayload envelopes.
 *
 * This module is the ONLY place where domain events are translated to webhook payloads.
 *
 * Flow:
 *   EventBus.emit("task:runtime:completed")
 *     → WebhookEvents.fromDomainEvent()
 *       → WebhookPayload { event: "task.completed", task: {...}, ... }
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Pure functions — no side effects
 *   ✔ Maps domain events → webhook payloads
 *   ✔ Generates unique event IDs for idempotency
 *   ❌ No HTTP calls
 *   ❌ No storage access
 *   ❌ No frontend imports
 */

import type { DomainTask } from "@domain/DomainTask";
import type { DomainEventType, EventPayloadMap } from "@events/EventBus";
import type {
  WebhookPayload,
  WebhookTaskSnapshot,
  WebhookMetadata,
  WebhookEventType,
  WebhookDeliveryInfo,
} from "./webhook-types";
import { WEBHOOK_SOURCE, WEBHOOK_VERSION } from "./webhook-types";

// ═══════════════════════════════════════════════════════════════
// Event ID Generation
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a unique event ID for idempotency.
 * Uses crypto.randomUUID when available, falls back to timestamp + random.
 */
export function generateEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Generate a deduplication key from event context.
 * Format: `{event}:{taskId}:{timestamp_minute}`
 */
export function generateDedupeKey(event: WebhookEventType, taskId: string): string {
  const minuteKey = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  return `${event}:${taskId}:${minuteKey}`;
}

// ═══════════════════════════════════════════════════════════════
// Task Snapshot Builder
// ═══════════════════════════════════════════════════════════════

/**
 * Create a WebhookTaskSnapshot from a DomainTask.
 * Extracts only the fields safe for external consumption.
 */
export function buildTaskSnapshot(
  task: DomainTask,
  includeDescription = false,
): WebhookTaskSnapshot {
  return {
    id: task.id,
    title: task.name ?? task.id,
    due: task.dueAt ?? null,
    recurrence: task.recurrence?.rrule ?? null,
    tags: task.tags ? [...task.tags] : [],
    status: task.status ?? "todo",
    priority: task.priority ?? "medium",
    description: includeDescription ? (task.description ?? undefined) : undefined,
    blockId: task.blockId ?? undefined,
    completionCount: task.analytics?.completionCount,
    missCount: task.analytics?.missCount,
    currentStreak: task.analytics?.currentStreak,
  };
}

// ═══════════════════════════════════════════════════════════════
// Payload Builder
// ═══════════════════════════════════════════════════════════════

/**
 * Build a complete WebhookPayload from components.
 */
export function buildPayload(
  event: WebhookEventType,
  task: DomainTask | null,
  metadata: Partial<WebhookMetadata> = {},
  includeDescription = false,
): WebhookPayload {
  const eventId = generateEventId();
  const taskId = task?.id ?? "system";
  const dedupeKey = generateDedupeKey(event, taskId);

  const delivery: WebhookDeliveryInfo = {
    eventId,
    dedupeKey,
    attempt: 1,
  };

  return {
    event,
    timestamp: new Date().toISOString(),
    source: WEBHOOK_SOURCE,
    version: WEBHOOK_VERSION,
    task: task ? buildTaskSnapshot(task, includeDescription) : null,
    metadata: {
      triggeredBy: metadata.triggeredBy ?? "system",
      workspaceId: metadata.workspaceId,
      blockId: task?.blockId ?? metadata.blockId,
      escalationLevel: metadata.escalationLevel,
      overdueMinutes: metadata.overdueMinutes,
      previousDue: metadata.previousDue,
      nextDue: metadata.nextDue,
      recurrenceInstance: metadata.recurrenceInstance,
    },
    delivery,
  };
}

/**
 * Build a test ping payload.
 */
export function buildTestPingPayload(): WebhookPayload {
  return buildPayload("test.ping", null, { triggeredBy: "user" });
}

// ═══════════════════════════════════════════════════════════════
// Domain Event → Webhook Event Mapping
// ═══════════════════════════════════════════════════════════════

/**
 * Map from EventBus domain event types to webhook event types.
 * Returns null for domain events that should NOT trigger webhooks.
 */
export const DOMAIN_TO_WEBHOOK: Partial<Record<DomainEventType, WebhookEventType>> = {
  "task:runtime:created": "task.created",
  "task:runtime:completed": "task.completed",
  "task:runtime:rescheduled": "task.rescheduled",
  "task:runtime:missed": "task.missed",
  "task:runtime:deleted": "task.deleted",
  "task:runtime:recurrenceGenerated": "recurring.triggered",
  "task:reminder:due": "reminder.triggered",
};

/**
 * Convert a domain event into a WebhookPayload.
 * Returns null if the domain event type is not mapped to a webhook event.
 *
 * @param domainEvent  The EventBus event type
 * @param payload      The event payload from EventBus
 * @param includeDesc  Whether to include task description in snapshot
 */
export function fromDomainEvent<E extends DomainEventType>(
  domainEvent: E,
  payload: EventPayloadMap[E],
  includeDescription = false,
): WebhookPayload | null {
  const webhookEvent = DOMAIN_TO_WEBHOOK[domainEvent];
  if (!webhookEvent) return null;

  // Extract the task from the payload (all mapped events have a task field)
  const task = extractTask(payload);
  if (!task && webhookEvent !== "test.ping") return null;

  // Build mutable metadata — readonly is enforced on the final WebhookPayload
  const meta: { -readonly [K in keyof WebhookMetadata]?: WebhookMetadata[K] } = {
    triggeredBy: "system",
  };

  // Enrich metadata based on event type
  switch (domainEvent) {
    case "task:runtime:completed": {
      meta.triggeredBy = "user";
      break;
    }
    case "task:runtime:rescheduled": {
      const p = payload as EventPayloadMap["task:runtime:rescheduled"];
      meta.previousDue = p.previousDue ?? undefined;
      meta.nextDue = p.newDue;
      break;
    }
    case "task:runtime:missed": {
      meta.triggeredBy = "scheduler";
      break;
    }
    case "task:runtime:recurrenceGenerated": {
      const p = payload as EventPayloadMap["task:runtime:recurrenceGenerated"];
      meta.triggeredBy = "recurrence";
      if (p.parentTask) {
        meta.recurrenceInstance = p.parentTask.id;
      }
      break;
    }
    case "task:reminder:due": {
      meta.triggeredBy = "scheduler";
      break;
    }
    case "task:runtime:deleted": {
      meta.triggeredBy = "user";
      break;
    }
    default:
      break;
  }

  return buildPayload(webhookEvent, task, meta, includeDescription);
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Extract DomainTask from an event payload.
 * EventPayloadMap values have varying shapes — normalize here.
 */
function extractTask(payload: unknown): DomainTask | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if ("task" in p && p.task && typeof p.task === "object") {
    return p.task as DomainTask;
  }
  return null;
}
