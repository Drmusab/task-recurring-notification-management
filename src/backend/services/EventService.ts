/**
 * EventService — Runtime Signal Hub
 *
 * Typed facade over PluginEventBus for service-layer consumers.
 * All runtime event routing flows through this service.
 *
 * Responsibilities:
 *   1. Type-safe emit() for all plugin events
 *   2. Type-safe on()/off() for consumer subscriptions
 *   3. Convenience helpers for task lifecycle events
 *   4. Lifecycle-safe subscription management (auto-cleanup on shutdown)
 *
 * Consumers:
 *   - TaskService         → emitTaskSaved, emitTaskCompleted, etc.
 *   - SchedulerService    → emitRuntimeDue, emitRuntimeCompleted
 *   - Frontend            → on("task:refresh"), on("task:attention:*")
 *   - AI Layer            → on("task:runtime:*") for ML signals
 *   - IntegrationService  → on("task:escalated") for webhook dispatch
 *
 * Event groups:
 *   Task Lifecycle   : task:create, task:saved, task:complete, task:edit
 *   Runtime Signals  : task:runtime:due, task:runtime:completed, ...
 *   Attention Events : task:attention:due, task:attention:urgent
 *   Cache Events     : cache:task:updated, cache:task:invalidated
 *   Dependency Events: task:blocked, task:unblocked
 *   Query Events     : query:tasks:selected, query:tasks:filtered
 *   Escalation Events: task:escalated, task:escalation:retry
 *
 * Lifecycle:
 *   - Constructed (no side effects)
 *   - init()     → mark active
 *   - shutdown() → unsubscribe all managed handlers
 *
 * FORBIDDEN:
 *   - Send HTTP requests (delegate to IntegrationService)
 *   - Mutate task model (delegate to TaskService)
 *   - Access DOM / frontend components
 *   - Parse markdown
 *   - Import PluginEventBus singleton directly (receive via DI)
 */

import type { PluginEventBus, PluginEventMap } from "@backend/core/events/PluginEventBus";
import type { Task } from "@backend/core/models/Task";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface EventServiceDeps {
  pluginEventBus: PluginEventBus;
}

/** Handler type for event callbacks */
type EventHandler<T> = (data: T) => void;

// ─── Runtime Signal Subtypes ─────────────────────────────────

/** Events emitted by TaskService on mutation */
export type TaskLifecycleEvent =
  | "task:create"
  | "task:saved"
  | "task:complete"
  | "task:edit"
  | "task:updated";

/** Events emitted by SchedulerService / EngineController */
export type RuntimeSignalEvent =
  | "task:runtime:due"
  | "task:runtime:completed"
  | "task:runtime:rescheduled"
  | "task:runtime:recurrence"
  | "task:runtime:skipped"
  | "engine:tick:complete";

/** Attention-filtered events */
export type AttentionEvent =
  | "task:attention:due"
  | "task:attention:urgent"
  | "task:attention:suppressed"
  | "ai:attention:suggestion";

/** Cache invalidation events */
export type CacheEvent =
  | "cache:task:updated"
  | "cache:task:invalidated"
  | "cache:analytics:updated";

/** Dependency graph events */
export type DependencyEvent =
  | "task:blocked"
  | "task:unblocked"
  | "dependency:resolved"
  | "dependency:cycle:detected"
  | "dependency:added"
  | "dependency:removed";

/** Escalation pipeline events */
export type EscalationEvent =
  | "task:escalated"
  | "task:escalation:retry"
  | "task:escalation:resolved"
  | "task:escalation:blocked";

/** Query pipeline events */
export type QueryEvent =
  | "query:tasks:selected"
  | "query:tasks:filtered"
  | "query:tasks:invalidated";

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class EventService {
  private readonly eventBus: PluginEventBus;
  private readonly managedUnsubscribes: Array<() => void> = [];
  private active = false;

  constructor(deps: EventServiceDeps) {
    this.eventBus = deps.pluginEventBus;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Initialize the event service. No-op if already initialized.
   * Kept async for lifecycle compatibility with index.ts wiring.
   */
  async init(): Promise<void> {
    if (this.active) return;
    this.active = true;
    logger.info("[EventService] Initialized (runtime signal hub)");
  }

  /**
   * Shut down: unsubscribe all managed handlers and mark inactive.
   */
  async shutdown(): Promise<void> {
    if (!this.active) return;

    for (const unsub of this.managedUnsubscribes) {
      try { unsub(); } catch { /* handler already removed */ }
    }
    this.managedUnsubscribes.length = 0;
    this.active = false;

    logger.info("[EventService] Shut down");
  }

  /** Whether the service is currently active */
  get isActive(): boolean {
    return this.active;
  }

  // ── Core Event API ───────────────────────────────────────────

  /**
   * Emit a typed event through the plugin event bus.
   * Fire-and-forget — handlers execute synchronously.
   */
  emit<K extends keyof PluginEventMap>(event: K, data: PluginEventMap[K]): void {
    this.eventBus.emit(event, data);
  }

  /**
   * Subscribe to a typed event. Returns an unsubscribe function.
   * The subscription is tracked for automatic cleanup on shutdown().
   */
  on<K extends keyof PluginEventMap>(
    event: K,
    handler: EventHandler<PluginEventMap[K]>,
  ): () => void {
    const unsub = this.eventBus.on(event, handler);
    this.managedUnsubscribes.push(unsub);
    return unsub;
  }

  /**
   * Subscribe to a typed event for ONE invocation only.
   * Automatically unsubscribes after the first emission.
   */
  once<K extends keyof PluginEventMap>(
    event: K,
    handler: EventHandler<PluginEventMap[K]>,
  ): () => void {
    let unsub: (() => void) | undefined;
    const wrapper = ((data: PluginEventMap[K]) => {
      if (unsub) unsub();
      handler(data);
    }) as EventHandler<PluginEventMap[K]>;
    unsub = this.on(event, wrapper);
    return unsub;
  }

  // ── Task Lifecycle Helpers ───────────────────────────────────

  /**
   * Emit task:saved after a task is persisted (create or update).
   */
  emitTaskSaved(task: Task, isNew: boolean): void {
    this.emit("task:saved", { task, isNew });
  }

  /**
   * Emit task:updated for a field-level change (no full snapshot needed).
   */
  emitTaskUpdated(taskId: string): void {
    this.emit("task:updated", { taskId });
  }

  /**
   * Emit task:complete for user-initiated completion.
   */
  emitTaskCompleted(taskId: string, task?: Task): void {
    this.emit("task:complete", { taskId, task });
  }

  /**
   * Emit task:reschedule for user-initiated delay.
   */
  emitTaskRescheduled(taskId: string, delayMinutes: number, task?: Task): void {
    this.emit("task:reschedule", { taskId, delayMinutes, task });
  }

  /**
   * Emit task:refresh to trigger full UI re-render.
   * Use sparingly — prefer targeted updates where possible.
   */
  emitRefresh(): void {
    this.emit("task:refresh", undefined as unknown as void);
  }

  // ── Runtime Signal Helpers ───────────────────────────────────

  /**
   * Emit task:runtime:due from scheduler.
   */
  emitRuntimeDue(taskId: string, dueAt: string, task?: Task): void {
    this.emit("task:runtime:due", { taskId, dueAt, task });
  }

  /**
   * Emit task:runtime:completed after task is marked done.
   */
  emitRuntimeCompleted(taskId: string, completedAt: string, nextDueAt?: string): void {
    this.emit("task:runtime:completed", { taskId, completedAt, nextDueAt });
  }

  /**
   * Emit task:runtime:rescheduled after dueAt change.
   */
  emitRuntimeRescheduled(
    taskId: string,
    previousDueAt: string,
    newDueAt: string,
    reason: string,
  ): void {
    this.emit("task:runtime:rescheduled", { taskId, previousDueAt, newDueAt, reason });
  }

  /**
   * Emit task:runtime:recurrence after occurrence generation.
   */
  emitRuntimeRecurrence(taskId: string, nextDueAt: string, rrule: string): void {
    this.emit("task:runtime:recurrence", { taskId, nextDueAt, rrule });
  }

  /**
   * Emit task:runtime:deleted after a task is permanently removed.
   */
  emitRuntimeDeleted(taskId: string, task?: Task): void {
    this.emit("task:runtime:deleted", { taskId, task });
  }

  // ── Cache Invalidation Helpers ───────────────────────────────

  /**
   * Emit cache:task:invalidated to trigger cache refresh.
   */
  emitCacheInvalidation(scope: "full" | "single" | "due", taskId?: string): void {
    this.emit("cache:task:invalidated", { scope, taskId });
  }

  /**
   * Emit query:tasks:invalidated to signal stale query results.
   */
  emitQueryInvalidation(scope: "full" | "single", reason: string, taskId?: string): void {
    this.emit("query:tasks:invalidated", { scope, reason, taskId });
  }

  // ── Escalation Helpers ───────────────────────────────────────

  /**
   * Emit task:escalated when escalation fires.
   */
  emitEscalation(taskId: string, level: number, reason: string): void {
    this.emit("task:escalated", {
      taskId,
      level,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit task:escalation:resolved when an escalation clears.
   */
  emitEscalationResolved(
    taskId: string,
    resolvedBy: "completed" | "rescheduled" | "deleted" | "manual",
  ): void {
    this.emit("task:escalation:resolved", { taskId, resolvedBy });
  }
}
