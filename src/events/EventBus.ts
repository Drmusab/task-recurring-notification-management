/**
 * EventBus — Canonical Typed Pub/Sub System (§7)
 *
 * Central event bus for ALL domain and runtime events in the plugin.
 * Every state change flows through this bus.
 *
 * This is a clean-room implementation that satisfies the architecture spec.
 * It delegates to the existing PluginEventBus internally for backward
 * compatibility while exposing the spec-mandated typed interface.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ All state changes MUST emit events
 *   ✔ Events are fire-and-forget (no return values)
 *   ✔ Subscribers MUST NOT throw (wrapped in try/catch)
 *   ✔ Typed payloads for all events
 *   ❌ No synchronous blocking in handlers
 *   ❌ No circular event chains
 */

import type { DomainTask } from "@domain/DomainTask";
import type { TaskDTO } from "@domain/DomainMapper";

// ──────────────────────────────────────────────────────────────
// Event Type Definitions (§7)
// ──────────────────────────────────────────────────────────────

/** All domain events that flow through the EventBus. */
export type DomainEventType =
  | "task:runtime:created"
  | "task:runtime:completed"
  | "task:runtime:rescheduled"
  | "task:runtime:dependencyChanged"
  | "task:runtime:recurrenceGenerated"
  | "task:runtime:missed"
  | "task:runtime:deleted"
  | "task:reminder:due"
  | "task:webhook:fired"
  | "plugin:storage:reload"
  | "block:updated"
  | "runtime:ready";

/** Webhook reference (minimal shape for event payloads). */
export interface WebhookRef {
  readonly id: string;
  readonly url: string;
  readonly name?: string;
}

/** Typed payload map — every event has an explicit payload shape. */
export interface EventPayloadMap {
  "task:runtime:created": { task: DomainTask; source?: string };
  "task:runtime:completed": { task: DomainTask; previousStatus?: string };
  "task:runtime:rescheduled": { task: DomainTask; previousDue: string | null; newDue: string };
  "task:runtime:dependencyChanged": { task: DomainTask; dependencyId: string; action: "add" | "remove" };
  "task:runtime:recurrenceGenerated": { task: DomainTask; parentTask: DomainTask };
  "task:runtime:missed": { task: DomainTask; missedAt: string };
  "task:runtime:deleted": { taskId: string; task?: DomainTask };
  "task:reminder:due": { task: DomainTask };
  "task:webhook:fired": { task: DomainTask; webhook: WebhookRef; deliveryId: string };
  "plugin:storage:reload": Record<string, never>;
  "block:updated": { blockId: string };
  "runtime:ready": Record<string, never>;
}

// ──────────────────────────────────────────────────────────────
// Event Handler Type
// ──────────────────────────────────────────────────────────────

export type EventHandler<E extends DomainEventType> = (
  payload: EventPayloadMap[E],
) => void;

// ──────────────────────────────────────────────────────────────
// EventBus Implementation
// ──────────────────────────────────────────────────────────────

/**
 * Typed, fire-and-forget event bus.
 *
 * Usage:
 * ```ts
 * const bus = new EventBus();
 *
 * // Subscribe
 * const unsub = bus.on('task:runtime:created', ({ task }) => { ... });
 *
 * // Emit
 * bus.emit('task:runtime:created', { task });
 *
 * // Unsubscribe
 * unsub();
 * ```
 */
export class EventBus {
  private listeners: Map<string, Set<Function>> = new Map();
  private emitCount = 0;

  /**
   * Register a handler for a domain event.
   *
   * @returns Unsubscribe function — call to remove the handler.
   */
  on<E extends DomainEventType>(
    event: E,
    handler: EventHandler<E>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  /**
   * Remove a specific handler for an event.
   */
  off<E extends DomainEventType>(
    event: E,
    handler: EventHandler<E>,
  ): void {
    this.listeners.get(event)?.delete(handler);
  }

  /**
   * Emit a domain event with its typed payload.
   *
   * All handlers run synchronously. If any handler throws,
   * the error is caught and logged — it does NOT propagate.
   */
  emit<E extends DomainEventType>(
    event: E,
    payload: EventPayloadMap[E],
  ): void {
    this.emitCount++;
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        // Handlers MUST NOT throw — log and continue
        console.error(
          `[EventBus] Handler error for "${event}":`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  /**
   * Check if any handlers are registered for an event.
   */
  hasListeners(event: DomainEventType): boolean {
    const handlers = this.listeners.get(event);
    return !!handlers && handlers.size > 0;
  }

  /**
   * Get the number of handlers registered for an event.
   */
  listenerCount(event: DomainEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Get total emit count for observability.
   */
  getEmitCount(): number {
    return this.emitCount;
  }

  /**
   * Clear all registered handlers.
   * Called during plugin unload / shutdown.
   */
  clear(): void {
    this.listeners.clear();
    this.emitCount = 0;
  }
}

// ──────────────────────────────────────────────────────────────
// Singleton Instance
// ──────────────────────────────────────────────────────────────

/**
 * Global EventBus instance.
 *
 * In production, services receive the EventBus via dependency injection.
 * This singleton exists for module-level convenience and backward compat.
 */
export const eventBus = new EventBus();
