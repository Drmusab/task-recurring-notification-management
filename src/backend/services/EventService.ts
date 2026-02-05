import type { Plugin } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import type { TaskDueEvent } from "@backend/core/engine/SchedulerEvents";
import type { Scheduler } from "@backend/core/engine/Scheduler";
import { NotificationState } from "@backend/core/engine/NotificationState";
import type { NotificationConfig, TaskEventPayload, TaskEventType, QueueItem } from "@backend/services/event-service.types";
import { createTaskSnapshot } from "@backend/services/event-service.types";
import {
  DEFAULT_NOTIFICATION_CONFIG,
  EVENT_DEDUPE_LIMIT,
  EVENT_QUEUE_INTERVAL_MS,
  EVENT_QUEUE_KEY,
  PLUGIN_EVENT_SOURCE,
  PLUGIN_EVENT_VERSION,
  NOTIFICATION_STATE_KEY,
  SETTINGS_KEY,
} from "@shared/constants/misc-constants";

const RETRY_BASE_DELAY_MS = 30 * 1000;
const RETRY_MAX_DELAY_MS = 30 * 60 * 1000;
const MAX_QUEUE_SIZE = 500;

type Fetcher = typeof fetch;

/**
 * EventService orchestrates side effects from semantic task events.
 * Scheduler emits "what happened"; EventService decides "what to do".
 */
export class EventService {
  private plugin: Plugin;
  private config: NotificationConfig;
  private queue: QueueItem[] = [];
  private dedupeKeys: Set<string> = new Set();
  private flushIntervalId: number | null = null;
  private fetcher: Fetcher;
  private notificationState: NotificationState;
  private schedulerUnsubscribe: Array<() => void> = [];

  constructor(
    plugin: Plugin,
    options: { fetcher?: Fetcher; notificationState?: NotificationState } = {}
  ) {
    this.plugin = plugin;
    this.fetcher = options.fetcher ?? fetch;
    this.config = { ...DEFAULT_NOTIFICATION_CONFIG };
    this.notificationState =
      options.notificationState ??
      new NotificationState(this.plugin, NOTIFICATION_STATE_KEY);
  }

  /**
   * Initialize the event service
   */
  async init(): Promise<void> {
    try {
      await this.notificationState.load();
    } catch (error) {
      logger.error('Failed to load notification state', error);
      // Continue with empty state rather than failing completely
    }
    
    try {
      await this.loadConfig();
    } catch (error) {
      logger.error('Failed to load event config', error);
      // Continue with default config
    }
    
    try {
      await this.loadQueue();
    } catch (error) {
      logger.error('Failed to load event queue', error);
      // Continue with empty queue
      this.queue = [];
      this.dedupeKeys = new Set();
    }
    
    try {
      await this.flushQueueOnStartup();
    } catch (error) {
      logger.error('Failed to flush queue on startup', error);
      // Non-fatal - queue will be processed later
    }
    
    this.startQueueWorker();
  }

  /**
   * Flush queue on startup to handle pending events from previous session
   */
  async flushQueueOnStartup(): Promise<void> {
    if (this.queue.length > 0) {
      console.log(`Found ${this.queue.length} pending events from previous session`);
      await this.flushQueue();
    }
  }

  /**
   * Load configuration from storage
   */
  private async loadConfig(): Promise<void> {
    try {
      const data = await this.plugin.loadData(SETTINGS_KEY);
      if (data) {
        this.config = { ...DEFAULT_NOTIFICATION_CONFIG, ...data };
      }
    } catch (err) {
      console.error("Failed to load event config:", err);
    }
  }

  /**
   * Save configuration to storage
   */
  async saveConfig(config: NotificationConfig): Promise<void> {
    this.config = config;
    await this.plugin.saveData(SETTINGS_KEY, config);
  }

  /**
   * Load queued events and dedupe keys from storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const data = await this.plugin.loadData(EVENT_QUEUE_KEY);
      if (data) {
        this.queue = Array.isArray(data.queue) ? data.queue : [];
        const dedupe = Array.isArray(data.dedupeKeys) ? data.dedupeKeys : [];
        this.dedupeKeys = new Set(dedupe);
        if (this.queue.length > MAX_QUEUE_SIZE) {
          const dropped = this.queue.length - MAX_QUEUE_SIZE;
          this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
          console.warn(`Event queue trimmed to ${MAX_QUEUE_SIZE} entries (dropped ${dropped}).`);
        }
      }
    } catch (err) {
      console.error("Failed to load event queue:", err);
      this.queue = [];
      this.dedupeKeys = new Set();
    }
  }

  /**
   * Persist queue and dedupe keys
   */
  private async persistQueue(): Promise<void> {
    const dedupeKeys = Array.from(this.dedupeKeys).slice(-EVENT_DEDUPE_LIMIT);
    await this.plugin.saveData(EVENT_QUEUE_KEY, {
      queue: this.queue,
      dedupeKeys,
    });
  }

  /**
   * Start queue worker to retry failed events
   */
  private startQueueWorker(): void {
    if (this.flushIntervalId !== null) {
      return;
    }

    this.flushQueue();
    // Cast to number for cross-environment compatibility (NodeJS.Timeout vs number)
    this.flushIntervalId = globalThis.setInterval(() => {
      this.flushQueue();
    }, EVENT_QUEUE_INTERVAL_MS) as number;
  }

  /**
   * Stop queue worker
   */
  stopQueueWorker(): void {
    if (this.flushIntervalId !== null) {
      globalThis.clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }

  /**
   * Graceful shutdown for side-effect state (queue + notification state).
   */
  async shutdown(): Promise<void> {
    this.stopQueueWorker();
    
    try {
      await this.notificationState.forceSave();
    } catch (error) {
      logger.error('Failed to save notification state during shutdown', error);
    }
    
    try {
      await this.persistQueue();
    } catch (error) {
      logger.error('Failed to persist queue during shutdown', error);
    }
  }

  /**
   * Wire scheduler events into the event pipeline.
   * This keeps scheduler time-focused while centralizing side effects here.
   */
  bindScheduler(scheduler: Scheduler): void {
    this.unbindScheduler();
    this.schedulerUnsubscribe = [
      scheduler.on("task:due", (payload) => {
        // Handle async error properly instead of void
        this.handleTaskDue(payload).catch((error) => {
          logger.error("Failed to handle task due event", error);
        });
      }),
      scheduler.on("task:overdue", (payload) => {
        // Handle async error properly instead of void
        this.handleTaskOverdue(payload).catch((error) => {
          logger.error("Failed to handle task overdue event", error);
        });
      }),
    ];
  }

  /**
   * Remove scheduler listeners (useful for tests or teardown).
   */
  unbindScheduler(): void {
    this.schedulerUnsubscribe.forEach((unsubscribe) => unsubscribe());
    this.schedulerUnsubscribe = [];
  }

  /**
   * Handle a task completion event and reset escalation policy.
   */
  async handleTaskCompleted(task: Task): Promise<void> {
    await this.emitTaskEvent("task.completed", task, 0);
    this.notificationState.resetEscalation(task.id);
    await this.notificationState.save();
  }

  /**
   * Handle a task snooze event.
   */
  async handleTaskSnoozed(task: Task): Promise<void> {
    await this.emitTaskEvent("task.snoozed", task, 0);
  }

  private async handleTaskDue(event: TaskDueEvent): Promise<void> {
    const taskKey = this.notificationState.generateTaskKey(
      event.taskId,
      event.dueAt.toISOString()
    );
    if (this.notificationState.hasNotified(taskKey)) {
      return;
    }

    const escalationLevel = this.notificationState.getEscalationLevel(event.taskId);
    await this.emitTaskEvent("task.due", event.task, escalationLevel);
    this.notificationState.markNotified(taskKey);
    // Save state with error handling
    this.notificationState.save().catch((error) => {
      logger.error("Failed to save notification state after task due", error);
    });
  }

  private async handleTaskOverdue(event: TaskDueEvent): Promise<void> {
    const taskKey = this.notificationState.generateTaskKey(
      event.taskId,
      event.dueAt.toISOString()
    );
    if (this.notificationState.hasMissed(taskKey)) {
      return;
    }

    const escalationLevel = this.notificationState.getEscalationLevel(event.taskId);
    await this.emitTaskEvent("task.missed", event.task, escalationLevel);
    this.notificationState.markMissed(taskKey);
    this.notificationState.incrementEscalation(event.taskId);
    // Save state with error handling
    this.notificationState.save().catch((error) => {
      logger.error("Failed to save notification state after task overdue", error);
    });
  }

  /**
   * Emit a task event to n8n
   */
  async emitTaskEvent(event: TaskEventType, task: Task, escalationLevel: number = 0): Promise<void> {
    if (!this.config.n8n.enabled || !this.config.n8n.webhookUrl) {
      return;
    }

    const dedupeKey = this.buildDedupeKey(event, task);
    if (this.isDuplicate(dedupeKey)) {
      return;
    }

    const payload = this.buildPayload(event, task, dedupeKey, 1, escalationLevel);
    const success = await this.sendPayload(payload);

    if (success) {
      this.markDelivered(dedupeKey);
      await this.persistQueue();
    } else {
      this.enqueue(payload);
    }
  }

  /**
   * Test connection with n8n webhook
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.config.n8n.enabled || !this.config.n8n.webhookUrl) {
      return { success: false, message: 'n8n webhook not configured' };
    }

    try {
      const dedupeKey = `test.ping:${new Date().toISOString()}`;
      const payload: TaskEventPayload = {
        event: "test.ping",
        source: PLUGIN_EVENT_SOURCE,
        version: PLUGIN_EVENT_VERSION,
        occurredAt: new Date().toISOString(),
        delivery: {
          dedupeKey,
          attempt: 1,
        },
      };

      const response = await this.fetcher(this.config.n8n.webhookUrl, {
        method: 'POST',
        headers: await this.buildHeaders(payload),
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return { success: true, message: 'Connection successful' };
      } else {
        return { 
          success: false, 
          message: `HTTP ${response.status}: ${response.statusText}` 
        };
      }
    } catch (err: any) {
      return { 
        success: false, 
        message: `Connection failed: ${err.message}` 
      };
    }
  }

  /**
   * Flush queued events
   */
  async flushQueue(): Promise<void> {
    if (!this.config.n8n.enabled || !this.config.n8n.webhookUrl) {
      return;
    }

    const now = Date.now();
    let updated = false;
    const remaining: QueueItem[] = [];

    for (const item of this.queue) {
      if (new Date(item.nextAttemptAt).getTime() > now) {
        remaining.push(item);
        continue;
      }

      const payload = {
        ...item.payload,
        delivery: {
          ...item.payload.delivery,
          attempt: item.attempt,
        },
      };

      try {
        const success = await this.sendPayload(payload);
        if (success) {
          this.markDelivered(payload.delivery.dedupeKey);
          updated = true;
        } else {
          const nextAttempt = item.attempt + 1;
          const nextDelay = this.getRetryDelay(nextAttempt);
          remaining.push({
            ...item,
            attempt: nextAttempt,
            nextAttemptAt: new Date(now + nextDelay).toISOString(),
          });
          updated = true;
        }
      } catch (error) {
        logger.error('Error sending queued event', {
          event: payload.event,
          taskId: payload.task?.id,
          attempt: payload.delivery.attempt,
          error: error instanceof Error ? error.message : String(error)
        });
        // Add back to queue for retry
        const nextAttempt = item.attempt + 1;
        const nextDelay = this.getRetryDelay(nextAttempt);
        remaining.push({
          ...item,
          attempt: nextAttempt,
          nextAttemptAt: new Date(now + nextDelay).toISOString(),
        });
        updated = true;
      }
    }

    if (updated) {
      this.queue = remaining;
      try {
        await this.persistQueue();
      } catch (error) {
        logger.error('Failed to persist queue after flush', error);
        // Non-fatal - will be persisted on next flush
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  private buildPayload(
    event: TaskEventType,
    task: Task,
    dedupeKey: string,
    attempt: number,
    escalationLevel: number = 0
  ): TaskEventPayload {
    const now = new Date();
    const dueDate = new Date(task.dueAt);
    const delayMs = now.getTime() - dueDate.getTime();

    return {
      event,
      source: PLUGIN_EVENT_SOURCE,
      version: PLUGIN_EVENT_VERSION,
      occurredAt: now.toISOString(),
      task: createTaskSnapshot(task),
      context: {
        timezone: task.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        delayMs: delayMs > 0 ? delayMs : undefined,
        previousDueAt: task.lastCompletedAt,
        nextDueAt: undefined, // Can be set after reschedule
      },
      routing: {
        escalationLevel,
        channels: task.notificationChannels || [],
      },
      delivery: {
        dedupeKey,
        attempt,
      },
    };
  }

  private buildDedupeKey(event: TaskEventType, task: Task): string {
    const dueAtKey = new Date(task.dueAt).toISOString().slice(0, 16);
    return `${event}:${task.id}:${dueAtKey}`;
  }

  private isDuplicate(dedupeKey: string): boolean {
    if (this.dedupeKeys.has(dedupeKey)) {
      return true;
    }

    return this.queue.some(
      (item) => item.payload.delivery.dedupeKey === dedupeKey
    );
  }

  private markDelivered(dedupeKey: string): void {
    this.dedupeKeys.add(dedupeKey);
    if (this.dedupeKeys.size > EVENT_DEDUPE_LIMIT) {
      const keys = Array.from(this.dedupeKeys).slice(-EVENT_DEDUPE_LIMIT);
      this.dedupeKeys = new Set(keys);
    }
  }

  private enqueue(payload: TaskEventPayload): void {
    const now = Date.now();
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      const overflow = this.queue.length - MAX_QUEUE_SIZE + 1;
      this.queue.splice(0, overflow);
      console.warn(
        `Event queue capped at ${MAX_QUEUE_SIZE}. Dropped ${overflow} oldest entr${overflow === 1 ? "y" : "ies"}.`
      );
    }
    this.queue.push({
      id: `${payload.delivery.dedupeKey}:${payload.delivery.attempt}`,
      payload,
      attempt: payload.delivery.attempt,
      nextAttemptAt: new Date(now + this.getRetryDelay(payload.delivery.attempt)).toISOString(),
    });
    // Persist queue with error handling
    this.persistQueue().catch((error) => {
      logger.error("Failed to persist event queue", error);
    });
  }

  private getRetryDelay(attempt: number): number {
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    return Math.min(delay, RETRY_MAX_DELAY_MS);
  }

  /**
   * Generate HMAC signature for payload
   */
  private async generateSignature(payload: string, secret: string): Promise<string> {
    try {
      // Use Web Crypto API if available
      if (typeof crypto !== "undefined" && crypto.subtle) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(payload);
        
        const key = await crypto.subtle.importKey(
          "raw",
          keyData,
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        
        const signature = await crypto.subtle.sign("HMAC", key, messageData);
        const hashArray = Array.from(new Uint8Array(signature));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      }
      
      // If crypto API is not available, fail gracefully
      console.warn("Web Crypto API not available - signature generation disabled");
      return "";
    } catch (err) {
      console.error("Failed to generate signature:", err);
      return "";
    }
  }

  /**
   * Build headers for webhook request
   */
  private async buildHeaders(payload: TaskEventPayload): Promise<Record<string, string>> {
    const payloadStr = JSON.stringify(payload);
    const timestamp = new Date().toISOString();
    
    // Generate HMAC signature if secret is configured
    let signature = "";
    if (this.config.n8n.sharedSecret) {
      signature = await this.generateSignature(
        payloadStr + timestamp,
        this.config.n8n.sharedSecret
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Shehab-Event": payload.event,
      "X-Shehab-Timestamp": timestamp,
    };

    if (signature) {
      headers["X-Shehab-Signature"] = signature;
    }

    // Legacy header for backward compatibility
    if (this.config.n8n.sharedSecret) {
      headers["X-Shehab-Note-Secret"] = this.config.n8n.sharedSecret;
    }

    return headers;
  }

  private async sendPayload(
    payload: TaskEventPayload,
    expectOkResponse = false
  ): Promise<boolean> {
    try {
      const payloadStr = JSON.stringify(payload);
      const headers = await this.buildHeaders(payload);

      const response = await this.fetcher(this.config.n8n.webhookUrl, {
        method: "POST",
        headers,
        body: payloadStr,
      });

      if (!response.ok) {
        console.error("n8n webhook failed:", response.statusText);
        return false;
      }

      if (expectOkResponse) {
        const data = await response.json().catch(() => null);
        return Boolean(data && data.ok);
      }

      return true;
    } catch (error) {
      console.error("Failed to send n8n event:", error);
      return false;
    }
  }
}
