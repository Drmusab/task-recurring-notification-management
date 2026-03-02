/**
 * webhook-types.ts — Canonical Webhook Type Definitions
 *
 * Strongly-typed webhook events, payloads, configurations, and delivery records.
 * This is the SINGLE SOURCE OF TRUTH for all webhook type definitions.
 *
 * Payload format follows the n8n-compatible structure:
 *   { event, timestamp, source, version, task, metadata }
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ All types are readonly / immutable
 *   ✔ No side effects — pure type definitions
 *   ✔ Compatible with n8n Webhook node
 *   ❌ No runtime logic
 *   ❌ No imports from frontend
 */

// ═══════════════════════════════════════════════════════════════
// Webhook Event Types
// ═══════════════════════════════════════════════════════════════

/**
 * All supported webhook event types.
 * Uses dot-notation for n8n compatibility.
 */
export type WebhookEventType =
  | "task.created"
  | "task.completed"
  | "task.deleted"
  | "task.updated"
  | "task.due"
  | "task.overdue"
  | "task.missed"
  | "recurring.triggered"
  | "reminder.triggered"
  | "task.escalated"
  | "task.rescheduled"
  | "test.ping";

/**
 * Human-readable labels for webhook event types.
 */
export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
  "task.created": "Task Created",
  "task.completed": "Task Completed",
  "task.deleted": "Task Deleted",
  "task.updated": "Task Updated",
  "task.due": "Task Due",
  "task.overdue": "Task Overdue",
  "task.missed": "Task Missed",
  "recurring.triggered": "Recurring Triggered",
  "reminder.triggered": "Reminder Triggered",
  "task.escalated": "Task Escalated",
  "task.rescheduled": "Task Rescheduled",
  "test.ping": "Test Ping",
};

// ═══════════════════════════════════════════════════════════════
// Standard Payload Structure (n8n-Compatible)
// ═══════════════════════════════════════════════════════════════

/**
 * Task snapshot embedded in webhook payload.
 * Contains only the fields relevant to external automation.
 */
export interface WebhookTaskSnapshot {
  readonly id: string;
  readonly title: string;
  readonly due: string | null;
  readonly recurrence: string | null;
  readonly tags: readonly string[];
  readonly status: string;
  readonly priority: string;
  readonly description?: string;
  readonly blockId?: string;
  readonly completionCount?: number;
  readonly missCount?: number;
  readonly currentStreak?: number;
}

/**
 * Metadata attached to every webhook payload.
 */
export interface WebhookMetadata {
  readonly triggeredBy: "user" | "system" | "scheduler" | "recurrence";
  readonly workspaceId?: string;
  readonly blockId?: string;
  readonly escalationLevel?: number;
  readonly overdueMinutes?: number;
  readonly previousDue?: string;
  readonly nextDue?: string;
  readonly recurrenceInstance?: string;
}

/**
 * The canonical webhook payload envelope.
 * This is the exact JSON structure delivered to webhook endpoints.
 */
export interface WebhookPayload {
  /** n8n-compatible event type (dot-notation) */
  readonly event: WebhookEventType;
  /** ISO-8601 timestamp of when the event occurred */
  readonly timestamp: string;
  /** Plugin identifier */
  readonly source: "siyuan-task-plugin";
  /** Payload schema version */
  readonly version: "2.0.0";
  /** Task data snapshot (null for test.ping) */
  readonly task: WebhookTaskSnapshot | null;
  /** Contextual metadata */
  readonly metadata: WebhookMetadata;
  /** Delivery information for dedup + idempotency */
  readonly delivery: WebhookDeliveryInfo;
}

/**
 * Delivery envelope for deduplication and idempotency.
 */
export interface WebhookDeliveryInfo {
  /** Unique event ID — used as X-Event-ID header */
  readonly eventId: string;
  /** Deduplication key: event:taskId:timestamp_minute */
  readonly dedupeKey: string;
  /** Delivery attempt number (1-based) */
  readonly attempt: number;
}

// ═══════════════════════════════════════════════════════════════
// Webhook Endpoint Configuration
// ═══════════════════════════════════════════════════════════════

/**
 * Configuration for a single webhook endpoint.
 */
export interface WebhookEndpoint {
  /** Unique endpoint identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Target URL (must be HTTPS unless localhost explicitly allowed) */
  readonly url: string;
  /** Whether this endpoint is active */
  readonly enabled: boolean;
  /** HMAC-SHA256 shared secret (empty string = unsigned) */
  readonly secret: string;
  /** Event types this endpoint subscribes to (empty = all) */
  readonly events: readonly WebhookEventType[];
  /** Additional HTTP headers to include */
  readonly headers: Readonly<Record<string, string>>;
  /** Retry policy override (null = use global defaults) */
  readonly retryPolicy: WebhookRetryPolicy | null;
  /** ISO-8601 timestamp when endpoint was created */
  readonly createdAt: string;
  /** ISO-8601 timestamp of last successful delivery */
  readonly lastSuccessAt: string | null;
  /** ISO-8601 timestamp of last failed delivery */
  readonly lastFailureAt: string | null;
  /** Count of consecutive failures (resets on success) */
  readonly consecutiveFailures: number;
}

/**
 * Retry policy configuration.
 */
export interface WebhookRetryPolicy {
  /** Maximum number of retry attempts (default: 5) */
  readonly maxRetries: number;
  /** Base delay in milliseconds (default: 2000) */
  readonly baseDelayMs: number;
  /** Backoff strategy */
  readonly strategy: "exponential" | "linear" | "fixed";
  /** Maximum delay cap in milliseconds (default: 300000 = 5 min) */
  readonly maxDelayMs: number;
}

/**
 * Global webhook system configuration.
 * Stored in plugin storage under WEBHOOK_SETTINGS_KEY.
 */
export interface WebhookSettings {
  /** Whether the webhook system is globally enabled */
  readonly enabled: boolean;
  /** Registered webhook endpoints */
  readonly endpoints: readonly WebhookEndpoint[];
  /** Default retry policy (used when endpoint has no override) */
  readonly defaultRetryPolicy: WebhookRetryPolicy;
  /** Domain whitelist (empty = allow all) */
  readonly allowedDomains: readonly string[];
  /** Whether localhost URLs are allowed (default: false) */
  readonly allowLocalhost: boolean;
  /** Rate limit: max events per minute (0 = unlimited) */
  readonly rateLimitPerMinute: number;
  /** Whether to include task description in payloads */
  readonly includeDescription: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Queue & Delivery Records
// ═══════════════════════════════════════════════════════════════

/**
 * Status of a queued webhook delivery.
 */
export type DeliveryStatus = "pending" | "delivered" | "failed" | "abandoned" | "rate_limited";

/**
 * A queued webhook delivery item.
 */
export interface QueuedDelivery {
  /** Unique delivery ID */
  readonly id: string;
  /** Target endpoint ID */
  readonly endpointId: string;
  /** Target URL */
  readonly url: string;
  /** The complete webhook payload */
  readonly payload: WebhookPayload;
  /** Current delivery status */
  status: DeliveryStatus;
  /** Number of delivery attempts made */
  attempts: number;
  /** ISO-8601 timestamp when item was enqueued */
  readonly enqueuedAt: string;
  /** ISO-8601 timestamp for next retry attempt */
  nextRetryAt: string;
  /** ISO-8601 timestamp of last attempt */
  lastAttemptAt: string | null;
  /** Last HTTP status code received (null if no response) */
  lastStatusCode: number | null;
  /** Last error message */
  lastError: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Delivery Log (for frontend inspection)
// ═══════════════════════════════════════════════════════════════

/**
 * A completed delivery log entry.
 */
export interface DeliveryLogEntry {
  readonly id: string;
  readonly endpointId: string;
  readonly endpointName: string;
  readonly event: WebhookEventType;
  readonly taskId: string | null;
  readonly status: DeliveryStatus;
  readonly statusCode: number | null;
  readonly attempts: number;
  readonly timestamp: string;
  readonly durationMs: number;
  readonly error: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Test Result
// ═══════════════════════════════════════════════════════════════

/**
 * Result of a manual webhook test.
 */
export interface WebhookTestResult {
  readonly success: boolean;
  readonly statusCode: number | null;
  readonly responseBody: string | null;
  readonly durationMs: number;
  readonly error: string | null;
  readonly timestamp: string;
}

// ═══════════════════════════════════════════════════════════════
// Defaults
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_RETRY_POLICY: WebhookRetryPolicy = {
  maxRetries: 5,
  baseDelayMs: 2000,
  strategy: "exponential",
  maxDelayMs: 300_000,
};

export const DEFAULT_WEBHOOK_SETTINGS: WebhookSettings = {
  enabled: false,
  endpoints: [],
  defaultRetryPolicy: DEFAULT_RETRY_POLICY,
  allowedDomains: [],
  allowLocalhost: false,
  rateLimitPerMinute: 60,
  includeDescription: false,
};

export const WEBHOOK_SETTINGS_KEY = "webhook-settings";
export const WEBHOOK_QUEUE_KEY = "webhook-queue";
export const WEBHOOK_LOG_KEY = "webhook-delivery-log";
export const WEBHOOK_SOURCE = "siyuan-task-plugin" as const;
export const WEBHOOK_VERSION = "2.0.0" as const;
