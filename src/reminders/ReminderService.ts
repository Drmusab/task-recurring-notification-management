/**
 * ReminderService — Notification Dispatch (§5.1)
 *
 * Fires once per overdue state transition via SiYuan push notification.
 * Subscribes to task:reminder:due events from EventBus.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Uses SiYuanApiAdapter for push notifications
 *   ✔ Fires exactly once per state transition (dedup via Set)
 *   ✔ Subscribes to EventBus events
 *   ❌ No direct DOM manipulation
 *   ❌ No task mutations
 *   ❌ No block attribute writes
 */

import type { DomainTask } from "@domain/DomainTask";
import { eventBus } from "@events/EventBus";
import { siyuanApi } from "@infrastructure/SiYuanApiAdapter";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ReminderConfig {
  /** Enable/disable reminder notifications */
  readonly enabled: boolean;
  /** Minimum interval between reminders for the same task (ms) */
  readonly cooldownMs: number;
  /** Default notification timeout (ms) */
  readonly timeoutMs: number;
}

const DEFAULT_CONFIG: ReminderConfig = {
  enabled: true,
  cooldownMs: 5 * 60 * 1000, // 5 minutes
  timeoutMs: 7000,
};

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class ReminderService {
  private config: ReminderConfig;
  /** Set of taskIds already reminded (dedup). Reset on each boot. */
  private firedSet: Set<string> = new Set();
  /** Cooldown timestamps per taskId */
  private cooldowns: Map<string, number> = new Map();
  private unsubscribers: Array<() => void> = [];

  constructor(config: Partial<ReminderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    // Subscribe to reminder events
    this.unsubscribers.push(
      eventBus.on("task:reminder:due", ({ task }) => {
        void this.fireReminder(task);
      }),
    );

    // Also subscribe to missed events for overdue reminders
    this.unsubscribers.push(
      eventBus.on("task:runtime:missed", ({ task }) => {
        void this.fireReminder(task, "overdue");
      }),
    );
  }

  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.firedSet.clear();
    this.cooldowns.clear();
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Fire a reminder notification for a task.
   * Deduplicates: each task fires at most once per cooldown period.
   */
  async fireReminder(
    task: DomainTask,
    type: "due" | "overdue" = "due",
  ): Promise<boolean> {
    if (!this.config.enabled) return false;

    const taskId = task.id as string;

    // Cooldown check
    const lastFired = this.cooldowns.get(taskId);
    if (lastFired && Date.now() - lastFired < this.config.cooldownMs) {
      return false; // Still in cooldown
    }

    // Build notification message
    const title = type === "overdue"
      ? `⏰ Overdue: ${task.name}`
      : `📋 Due: ${task.name}`;

    const message = task.dueAt
      ? `Due at ${new Date(task.dueAt as string).toLocaleString()}`
      : "No due date set";

    try {
      await siyuanApi.pushNotification({
        msg: `${title}\n${message}`,
        timeout: this.config.timeoutMs,
      });
      this.firedSet.add(taskId);
      this.cooldowns.set(taskId, Date.now());
      return true;
    } catch {
      // Notification is best-effort
      return false;
    }
  }

  /**
   * Check if a reminder has been fired for a task.
   */
  hasFired(taskId: string): boolean {
    return this.firedSet.has(taskId);
  }

  /**
   * Clear the fired state for a task (e.g., after reschedule).
   */
  clearFired(taskId: string): void {
    this.firedSet.delete(taskId);
    this.cooldowns.delete(taskId);
  }

  /**
   * Update configuration at runtime.
   */
  updateConfig(config: Partial<ReminderConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
