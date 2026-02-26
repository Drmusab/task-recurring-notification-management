/**
 * WebhookEventMapper — Maps PluginEventBus events → WebhookEvent payloads
 *
 * Translates internal runtime events (task:escalated, task:overdue, etc.)
 * into the canonical WebhookEvent envelope defined in EventTypes.ts.
 *
 * Each mapped event includes:
 *   - Unique eventId (UUID v4 via crypto.randomUUID)
 *   - ISO-8601 timestamp
 *   - workspaceId from runtime context
 *   - Typed payload matching the EventType discriminant
 *   - Recurrence instance key (when task is recurring)
 *
 * Recurrence rule:
 *   All events for recurring tasks MUST attach to the latest resolved
 *   recurrence instance, NEVER the parent template. The recurrenceInstance
 *   field is set by the caller from RecurrenceResolver.resolveInstance().
 *
 * Integration:
 *   OutboundWebhookEmitter.emit() → WebhookEventMapper.map()
 *   EscalationManager → WebhookEventMapper.mapEscalation()
 *
 * FORBIDDEN:
 *   - Import frontend / Svelte
 *   - Call SiYuan API directly (no side effects)
 *   - Hold mutable state (pure mapper)
 *   - Resolve recurrence internally (caller provides instance)
 */

import type {
  WebhookEvent,
  TaskDueEvent,
  TaskOverdueEvent,
  TaskCompletedEvent,
  TaskEscalatedEvent,
  TaskEscalationResolvedEvent,
  NotificationSentEvent,
  EventType,
} from "@backend/events/types/EventTypes";
import type { Task } from "@backend/core/models/Task";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface MapperContext {
  workspaceId: string;
}

export interface EscalationEventInput {
  task: Task;
  level: number;
  reason: string;
  overdueMinutes: number;
  recurrenceInstance?: string;
}

export interface EscalationResolvedInput {
  task: Task;
  resolvedBy: 'completed' | 'rescheduled' | 'deleted' | 'manual';
  previousLevel: number;
}

/**
 * Extended context for validated webhook mapping.
 * Carries recurrence resolution + block validation results.
 */
export interface ValidatedMappingContext {
  /** Resolved recurrence instance key (from RecurrenceResolver) */
  recurrenceInstance?: string;
  /** Whether the task is the resolved instance (not the parent template) */
  isResolvedInstance?: boolean;
  /** Resolved due date (may differ from task.dueAt for recurring tasks) */
  resolvedDueAt?: string;
  /** Block ID verified by BlockAttributeValidator */
  verifiedBlockId?: string;
}

export interface WebhookEventMapperStats {
  totalMapped: number;
  byEventType: Record<string, number>;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function generateEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeBase(event: EventType, taskId: string, ctx: MapperContext) {
  return {
    event,
    taskId,
    workspaceId: ctx.workspaceId,
    timestamp: new Date().toISOString(),
    eventId: generateEventId(),
  };
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class WebhookEventMapper {
  private readonly ctx: MapperContext;

  // Stats
  private totalMapped = 0;
  private byEventType: Record<string, number> = {};

  constructor(ctx: MapperContext) {
    this.ctx = ctx;
  }

  /** Update workspace ID at runtime (e.g., on workspace:changed). */
  setWorkspaceId(id: string): void {
    (this.ctx as { workspaceId: string }).workspaceId = id;
  }

  // ── Mappers ──────────────────────────────────────────────────

  /**
   * Map a task:due event → TaskDueEvent webhook payload.
   *
   * @param task      The due task
   * @param validCtx  Optional recurrence instance context
   */
  mapTaskDue(task: Task, validCtx?: ValidatedMappingContext): TaskDueEvent {
    this.track("task.due");
    const dueDate = validCtx?.resolvedDueAt ?? task.dueAt ?? "";
    return {
      ...makeBase("task.due", task.id, this.ctx),
      event: "task.due",
      payload: {
        title: task.name ?? task.id,
        dueDate,
        priority: task.priority ?? "medium",
      },
    };
  }

  /**
   * Map a task:overdue event → TaskOverdueEvent webhook payload.
   *
   * @param task             The overdue task
   * @param overdueMinutes   Minutes overdue
   * @param validCtx         Optional recurrence instance context
   */
  mapTaskOverdue(
    task: Task,
    overdueMinutes: number,
    validCtx?: ValidatedMappingContext,
  ): TaskOverdueEvent {
    this.track("task.overdue");
    const dueDate = validCtx?.resolvedDueAt ?? task.dueAt ?? "";
    return {
      ...makeBase("task.overdue", task.id, this.ctx),
      event: "task.overdue",
      payload: {
        title: task.name ?? task.id,
        dueDate,
        overdueMinutes,
        priority: task.priority ?? "medium",
      },
    };
  }

  /**
   * Map a task:completed event → TaskCompletedEvent webhook payload.
   */
  mapTaskCompleted(
    task: Task,
    nextDueDate?: string | null,
  ): TaskCompletedEvent {
    this.track("task.completed");
    return {
      ...makeBase("task.completed", task.id, this.ctx),
      event: "task.completed",
      payload: {
        title: task.name ?? task.id,
        completedAt: new Date().toISOString(),
        isRecurring: !!task.recurrence,
        nextDueDate: nextDueDate ?? null,
      },
    };
  }

  /**
   * Map an escalation event → TaskEscalatedEvent webhook payload.
   * This is the PRIMARY escalation pipeline mapper.
   *
   * The recurrenceInstance MUST be the resolved instance key,
   * NEVER the parent template ID.
   */
  mapEscalation(input: EscalationEventInput): TaskEscalatedEvent {
    this.track("task.escalated");
    const { task, level, reason, overdueMinutes, recurrenceInstance } = input;
    return {
      ...makeBase("task.escalated", task.id, this.ctx),
      event: "task.escalated",
      payload: {
        title: task.name ?? task.id,
        escalationLevel: level,
        reason,
        dueDate: task.dueAt ?? "",
        overdueMinutes,
        priority: task.priority ?? "medium",
        recurrenceInstance,
      },
    };
  }

  /**
   * Map an escalation resolved event → TaskEscalationResolvedEvent.
   */
  mapEscalationResolved(input: EscalationResolvedInput): TaskEscalationResolvedEvent {
    this.track("task.escalation.resolved");
    const { task, resolvedBy, previousLevel } = input;
    return {
      ...makeBase("task.escalation.resolved", task.id, this.ctx),
      event: "task.escalation.resolved",
      payload: {
        title: task.name ?? task.id,
        resolvedBy,
        previousLevel,
        resolvedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Map a notification sent event → NotificationSentEvent.
   */
  mapNotificationSent(
    task: Task,
    notificationType: "due" | "overdue" | "advance" | "completed",
  ): NotificationSentEvent {
    this.track("notification.sent");
    return {
      ...makeBase("notification.sent", task.id, this.ctx),
      event: "notification.sent",
      payload: {
        title: task.name ?? task.id,
        notificationType,
        sentAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Generic mapper: given any WebhookEvent type and raw payload, build envelope.
   * Useful for extensions or future event types.
   */
  mapGeneric<E extends WebhookEvent>(
    event: E["event"],
    taskId: string,
    payload: E["payload"],
  ): E {
    this.track(event);
    return {
      ...makeBase(event, taskId, this.ctx),
      event,
      payload,
    } as unknown as E;
  }

  /**
   * Get mapper statistics.
   */
  getStats(): WebhookEventMapperStats {
    return {
      totalMapped: this.totalMapped,
      byEventType: { ...this.byEventType },
    };
  }

  // ── Internal ─────────────────────────────────────────────────

  private track(eventType: string): void {
    this.totalMapped++;
    this.byEventType[eventType] = (this.byEventType[eventType] ?? 0) + 1;
  }
}
