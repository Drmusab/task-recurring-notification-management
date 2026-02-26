/**
 * NotificationService — Service-Layer Notification Dispatch
 *
 * High-level notification routing service that coordinates between
 * the integration pipeline and the event bus. Routes validated events
 * to the appropriate notification channels.
 *
 * Responsibilities:
 *   1. Subscribe to runtime events that require notification
 *   2. Route events through IntegrationService (guarded dispatch)
 *   3. Emit frontend-facing events via EventService
 *   4. Track notification state and deduplication
 *
 * Event subscriptions:
 *   task:runtime:due       → notify if attention gate passes
 *   task:attention:due     → route to integration
 *   task:attention:urgent  → route to integration (high priority)
 *   task:escalated         → already dispatched by IntegrationService
 *
 * Integration:
 *   EventService          → subscribe to triggers, emit frontend events
 *   IntegrationService    → guarded dispatch for webhooks
 *
 * Note: This is the SERVICE-LAYER NotificationService (notification routing).
 * The events/NotificationService handles the lower-level webhook dispatch.
 *
 * Lifecycle:
 *   - Constructed (no side effects)
 *   - start() → subscribe to trigger events
 *   - stop()  → unsubscribe all
 *
 * FORBIDDEN:
 *   - Send HTTP requests directly
 *   - Mutate task model
 *   - Access DOM / frontend
 *   - Bypass IntegrationService for dispatch
 */

import type { EventService } from "./EventService";
import type { IntegrationService } from "./IntegrationService";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ServiceNotificationDeps {
  eventService: EventService;
  integrationService: IntegrationService;
}

export interface NotificationRecord {
  taskId: string;
  eventType: string;
  timestamp: string;
  dispatched: boolean;
  level?: number;
}

export interface NotificationServiceStats {
  totalReceived: number;
  totalDispatched: number;
  totalSuppressed: number;
  recentNotifications: NotificationRecord[];
}

// ── Constants ────────────────────────────────────────────────

/** Maximum recent notification records to keep in memory for debugging */
const MAX_RECENT_RECORDS = 100;

/** Deduplication window in milliseconds — suppress duplicate notifications */
const DEDUPE_WINDOW_MS = 30_000; // 30 seconds

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class ServiceNotificationService {
  private readonly eventService: EventService;
  private readonly integrationService: IntegrationService;

  private active = false;
  private readonly unsubscribes: Array<() => void> = [];

  // ── Deduplication ──────────────────────────────────────────
  /** Map of "taskId:eventType" → last dispatch timestamp */
  private readonly dedupeMap: Map<string, number> = new Map();

  // ── Stats ──────────────────────────────────────────────────
  private totalReceived = 0;
  private totalDispatched = 0;
  private totalSuppressed = 0;
  private readonly recentRecords: NotificationRecord[] = [];

  constructor(deps: ServiceNotificationDeps) {
    this.eventService = deps.eventService;
    this.integrationService = deps.integrationService;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Start: subscribe to runtime events that trigger notifications.
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    // Subscribe to attention-filtered due events
    this.unsubscribes.push(
      this.eventService.on("task:attention:due", (data) => {
        void this.handleAttentionDue(data.taskId, data.task?.dueAt || "", 1);
      }),
    );

    // Subscribe to urgent attention events (higher priority)
    this.unsubscribes.push(
      this.eventService.on("task:attention:urgent", (data) => {
        void this.handleAttentionDue(data.taskId, data.task?.dueAt || "", 2);
      }),
    );

    // Subscribe to escalation resolution for cleanup
    this.unsubscribes.push(
      this.eventService.on("task:escalation:resolved", (data) => {
        this.clearDedupe(data.taskId);
      }),
    );

    logger.info("[ServiceNotificationService] Started — subscribed to notification triggers");
  }

  /**
   * Stop: unsubscribe all handlers and clear state.
   */
  stop(): void {
    if (!this.active) return;

    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* already removed */ }
    }
    this.unsubscribes.length = 0;
    this.dedupeMap.clear();
    this.active = false;

    logger.info("[ServiceNotificationService] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Dispatch a notification for a specific task through the integration guard.
   * Can be called directly (e.g., from scheduler missed detection).
   */
  async dispatch(
    taskId: string,
    eventType: string,
    level: number = 1,
    reason: string = "notification",
  ): Promise<boolean> {
    this.requireActive("dispatch");
    this.totalReceived++;

    // Deduplicate
    if (this.isDuplicate(taskId, eventType)) {
      this.totalSuppressed++;
      this.recordNotification(taskId, eventType, false);
      return false;
    }

    // Dispatch through IntegrationService guard pipeline
    const result = await this.integrationService.dispatchEscalation(
      taskId,
      level,
      reason,
    );

    if (result.dispatched) {
      this.totalDispatched++;
      this.markDispatched(taskId, eventType);
    }

    this.recordNotification(taskId, eventType, result.dispatched, level);
    return result.dispatched;
  }

  /**
   * Get notification service stats.
   */
  getStats(): NotificationServiceStats {
    return {
      totalReceived: this.totalReceived,
      totalDispatched: this.totalDispatched,
      totalSuppressed: this.totalSuppressed,
      recentNotifications: [...this.recentRecords].slice(-20),
    };
  }

  // ── Private Handlers ─────────────────────────────────────────

  /**
   * Handle attention:due / attention:urgent events.
   */
  private async handleAttentionDue(
    taskId: string,
    dueAt: string,
    level: number,
  ): Promise<void> {
    const eventType = level >= 2 ? "attention:urgent" : "attention:due";
    await this.dispatch(taskId, eventType, level, `Attention event: ${eventType}`);
  }

  // ── Deduplication ─────────────────────────────────────────────

  private isDuplicate(taskId: string, eventType: string): boolean {
    const key = `${taskId}:${eventType}`;
    const lastTime = this.dedupeMap.get(key);
    if (!lastTime) return false;
    return Date.now() - lastTime < DEDUPE_WINDOW_MS;
  }

  private markDispatched(taskId: string, eventType: string): void {
    const key = `${taskId}:${eventType}`;
    this.dedupeMap.set(key, Date.now());

    // Prune old entries periodically
    if (this.dedupeMap.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.dedupeMap) {
        if (now - v > DEDUPE_WINDOW_MS * 2) {
          this.dedupeMap.delete(k);
        }
      }
    }
  }

  private clearDedupe(taskId: string): void {
    for (const key of this.dedupeMap.keys()) {
      if (key.startsWith(`${taskId}:`)) {
        this.dedupeMap.delete(key);
      }
    }
  }

  // ── Record Keeping ────────────────────────────────────────────

  private recordNotification(
    taskId: string,
    eventType: string,
    dispatched: boolean,
    level?: number,
  ): void {
    this.recentRecords.push({
      taskId,
      eventType,
      timestamp: new Date().toISOString(),
      dispatched,
      level,
    });

    // Keep bounded
    if (this.recentRecords.length > MAX_RECENT_RECORDS) {
      this.recentRecords.splice(0, this.recentRecords.length - MAX_RECENT_RECORDS);
    }
  }

  // ── Private ──────────────────────────────────────────────────

  private requireActive(method: string): void {
    if (!this.active) {
      throw new Error(`[ServiceNotificationService] Not started — cannot call ${method}()`);
    }
  }
}
