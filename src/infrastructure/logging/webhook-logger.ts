/**
 * webhook-logger.ts — Webhook-Specific Structured Logger
 *
 * Provides structured logging for the entire webhook subsystem with:
 *  - Categorized log entries (delivery, security, queue, retry, config)
 *  - Delivery-specific metadata (endpoint, status code, duration)
 *  - Ring buffer with configurable max size
 *  - Export/filter/query capabilities for the debug panel
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Shared across all webhook modules
 *   ✔ No side effects beyond console output
 *   ✔ Thread-safe (single-threaded JS, but re-entrant safe)
 *   ❌ No frontend imports
 *   ❌ No HTTP calls
 *   ❌ No storage access (caller persists if needed)
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Log severity level. */
export type WebhookLogLevel = "debug" | "info" | "warn" | "error";

/** Log entry category for filtering. */
export type WebhookLogCategory =
  | "delivery"
  | "security"
  | "queue"
  | "retry"
  | "config"
  | "lifecycle"
  | "test"
  | "general";

/** A single webhook log entry. */
export interface WebhookLogEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly level: WebhookLogLevel;
  readonly category: WebhookLogCategory;
  readonly message: string;
  readonly endpointId?: string;
  readonly endpointName?: string;
  readonly eventType?: string;
  readonly taskId?: string;
  readonly deliveryId?: string;
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly attempt?: number;
  readonly error?: string;
  readonly context?: Record<string, unknown>;
}

/** Options for creating a log entry. */
export interface WebhookLogOptions {
  category?: WebhookLogCategory;
  endpointId?: string;
  endpointName?: string;
  eventType?: string;
  taskId?: string;
  deliveryId?: string;
  statusCode?: number;
  durationMs?: number;
  attempt?: number;
  error?: string;
  context?: Record<string, unknown>;
}

/** Filter criteria for querying log entries. */
export interface WebhookLogFilter {
  level?: WebhookLogLevel | WebhookLogLevel[];
  category?: WebhookLogCategory | WebhookLogCategory[];
  endpointId?: string;
  taskId?: string;
  since?: string;
  until?: string;
  limit?: number;
}

/** Summary statistics for the webhook log. */
export interface WebhookLogStats {
  total: number;
  byLevel: Record<WebhookLogLevel, number>;
  byCategory: Record<WebhookLogCategory, number>;
  oldestEntry: string | null;
  newestEntry: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const MAX_LOG_ENTRIES = 1000;
const LOG_PREFIX = "[Webhook]";

// ═══════════════════════════════════════════════════════════════
// Logger Implementation
// ═══════════════════════════════════════════════════════════════

/** In-memory ring buffer of webhook log entries. */
const entries: WebhookLogEntry[] = [];

/** Whether debug output to console is enabled. */
let debugEnabled = false;

/** Auto-incrementing ID counter. */
let idCounter = 0;

/**
 * Generate a unique log entry ID.
 */
function generateId(): string {
  return `wlog_${Date.now()}_${++idCounter}`;
}

/**
 * Create and store a log entry.
 */
function addEntry(
  level: WebhookLogLevel,
  message: string,
  options: WebhookLogOptions = {},
): WebhookLogEntry {
  const entry: WebhookLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    level,
    category: options.category ?? "general",
    message,
    endpointId: options.endpointId,
    endpointName: options.endpointName,
    eventType: options.eventType,
    taskId: options.taskId,
    deliveryId: options.deliveryId,
    statusCode: options.statusCode,
    durationMs: options.durationMs,
    attempt: options.attempt,
    error: options.error,
    context: options.context,
  };

  entries.push(entry);

  // Trim to max size
  if (entries.length > MAX_LOG_ENTRIES) {
    entries.splice(0, entries.length - MAX_LOG_ENTRIES);
  }

  // Console output
  emitToConsole(entry);

  return entry;
}

/**
 * Emit a log entry to the browser console.
 */
function emitToConsole(entry: WebhookLogEntry): void {
  const prefix = `${LOG_PREFIX} [${entry.category}]`;
  const meta = buildConsoleMeta(entry);

  switch (entry.level) {
    case "error":
      console.error(prefix, entry.message, meta);
      break;
    case "warn":
      console.warn(prefix, entry.message, meta);
      break;
    case "debug":
      if (debugEnabled) {
        console.debug(prefix, entry.message, meta);
      }
      break;
    case "info":
    default:
      console.log(prefix, entry.message, meta);
      break;
  }
}

/**
 * Build a metadata object for console output (omits undefined fields).
 */
function buildConsoleMeta(entry: WebhookLogEntry): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (entry.endpointId) meta.endpoint = entry.endpointName ?? entry.endpointId;
  if (entry.eventType) meta.event = entry.eventType;
  if (entry.taskId) meta.taskId = entry.taskId;
  if (entry.deliveryId) meta.deliveryId = entry.deliveryId;
  if (entry.statusCode !== undefined) meta.status = entry.statusCode;
  if (entry.durationMs !== undefined) meta.durationMs = entry.durationMs;
  if (entry.attempt !== undefined) meta.attempt = entry.attempt;
  if (entry.error) meta.error = entry.error;
  if (entry.context) Object.assign(meta, entry.context);
  return meta;
}

// ═══════════════════════════════════════════════════════════════
// Public API — Logging Functions
// ═══════════════════════════════════════════════════════════════

/** Log a debug message. */
export function debug(message: string, options?: WebhookLogOptions): WebhookLogEntry {
  return addEntry("debug", message, options);
}

/** Log an info message. */
export function info(message: string, options?: WebhookLogOptions): WebhookLogEntry {
  return addEntry("info", message, options);
}

/** Log a warning message. */
export function warn(message: string, options?: WebhookLogOptions): WebhookLogEntry {
  return addEntry("warn", message, options);
}

/** Log an error message. */
export function error(message: string, options?: WebhookLogOptions): WebhookLogEntry {
  return addEntry("error", message, options);
}

// ═══════════════════════════════════════════════════════════════
// Public API — Delivery-Specific Logging
// ═══════════════════════════════════════════════════════════════

/**
 * Log a successful webhook delivery.
 */
export function deliverySuccess(
  endpointId: string,
  endpointName: string,
  eventType: string,
  taskId: string | null,
  statusCode: number,
  durationMs: number,
  deliveryId: string,
): WebhookLogEntry {
  return info(`Delivered ${eventType} to "${endpointName}"`, {
    category: "delivery",
    endpointId,
    endpointName,
    eventType,
    taskId: taskId ?? undefined,
    statusCode,
    durationMs,
    deliveryId,
  });
}

/**
 * Log a failed webhook delivery.
 */
export function deliveryFailure(
  endpointId: string,
  endpointName: string,
  eventType: string,
  taskId: string | null,
  statusCode: number | null,
  errorMessage: string,
  durationMs: number,
  deliveryId: string,
  attempt: number,
): WebhookLogEntry {
  return error(`Delivery failed for ${eventType} to "${endpointName}": ${errorMessage}`, {
    category: "delivery",
    endpointId,
    endpointName,
    eventType,
    taskId: taskId ?? undefined,
    statusCode: statusCode ?? undefined,
    durationMs,
    deliveryId,
    attempt,
    error: errorMessage,
  });
}

/**
 * Log a retry attempt.
 */
export function retryAttempt(
  deliveryId: string,
  endpointName: string,
  attempt: number,
  nextRetryAt: string,
  taskId: string,
): WebhookLogEntry {
  return info(`Scheduling retry #${attempt} for "${endpointName}" at ${nextRetryAt}`, {
    category: "retry",
    deliveryId,
    endpointName,
    attempt,
    taskId,
    context: { nextRetryAt },
  });
}

/**
 * Log a retry exhaustion (max retries reached).
 */
export function retryExhausted(
  deliveryId: string,
  endpointName: string,
  maxAttempts: number,
  taskId: string,
): WebhookLogEntry {
  return warn(`Abandoned delivery to "${endpointName}" after ${maxAttempts} attempts`, {
    category: "retry",
    deliveryId,
    endpointName,
    attempt: maxAttempts,
    taskId,
  });
}

/**
 * Log a security event (signing, domain validation, rate limit).
 */
export function securityEvent(
  message: string,
  context?: Record<string, unknown>,
): WebhookLogEntry {
  return info(message, { category: "security", context });
}

/**
 * Log a configuration change.
 */
export function configChange(
  message: string,
  context?: Record<string, unknown>,
): WebhookLogEntry {
  return info(message, { category: "config", context });
}

/**
 * Log a lifecycle event (start, stop, initialize).
 */
export function lifecycle(
  message: string,
  context?: Record<string, unknown>,
): WebhookLogEntry {
  return info(message, { category: "lifecycle", context });
}

/**
 * Log a rate limit hit.
 */
export function rateLimited(
  endpointName: string,
  retryAfterMs: number,
): WebhookLogEntry {
  return warn(`Rate limited — "${endpointName}" deferred by ${retryAfterMs}ms`, {
    category: "security",
    endpointName,
    context: { retryAfterMs },
  });
}

/**
 * Log a test ping result.
 */
export function testResult(
  endpointName: string,
  success: boolean,
  statusCode: number | null,
  durationMs: number,
  errorMsg?: string,
): WebhookLogEntry {
  if (success) {
    return info(`Test ping to "${endpointName}" succeeded (${statusCode}, ${durationMs}ms)`, {
      category: "test",
      endpointName,
      statusCode: statusCode ?? undefined,
      durationMs,
    });
  }
  return error(`Test ping to "${endpointName}" failed: ${errorMsg ?? `HTTP ${statusCode}`}`, {
    category: "test",
    endpointName,
    statusCode: statusCode ?? undefined,
    durationMs,
    error: errorMsg,
  });
}

// ═══════════════════════════════════════════════════════════════
// Public API — Query & Filter
// ═══════════════════════════════════════════════════════════════

/**
 * Get all log entries (most recent last).
 */
export function getEntries(): readonly WebhookLogEntry[] {
  return entries;
}

/**
 * Get the most recent N entries.
 */
export function getRecent(count: number): WebhookLogEntry[] {
  return entries.slice(-count);
}

/**
 * Query log entries with filters.
 */
export function query(filter: WebhookLogFilter): WebhookLogEntry[] {
  let result = [...entries];

  // Filter by level
  if (filter.level) {
    const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
    result = result.filter((e) => levels.includes(e.level));
  }

  // Filter by category
  if (filter.category) {
    const cats = Array.isArray(filter.category) ? filter.category : [filter.category];
    result = result.filter((e) => cats.includes(e.category));
  }

  // Filter by endpoint
  if (filter.endpointId) {
    result = result.filter((e) => e.endpointId === filter.endpointId);
  }

  // Filter by task
  if (filter.taskId) {
    result = result.filter((e) => e.taskId === filter.taskId);
  }

  // Filter by time range
  if (filter.since) {
    result = result.filter((e) => e.timestamp >= filter.since!);
  }
  if (filter.until) {
    result = result.filter((e) => e.timestamp <= filter.until!);
  }

  // Apply limit
  if (filter.limit && filter.limit > 0) {
    result = result.slice(-filter.limit);
  }

  return result;
}

/**
 * Get log statistics.
 */
export function getStats(): WebhookLogStats {
  const byLevel: Record<WebhookLogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
  const byCategory: Record<WebhookLogCategory, number> = {
    delivery: 0, security: 0, queue: 0, retry: 0,
    config: 0, lifecycle: 0, test: 0, general: 0,
  };

  for (const entry of entries) {
    byLevel[entry.level]++;
    byCategory[entry.category]++;
  }

  return {
    total: entries.length,
    byLevel,
    byCategory,
    oldestEntry: entries.length > 0 ? entries[0]!.timestamp : null,
    newestEntry: entries.length > 0 ? entries[entries.length - 1]!.timestamp : null,
  };
}

/**
 * Get only error entries.
 */
export function getErrors(): WebhookLogEntry[] {
  return entries.filter((e) => e.level === "error");
}

/**
 * Get delivery log entries only.
 */
export function getDeliveryLog(): WebhookLogEntry[] {
  return entries.filter((e) => e.category === "delivery");
}

// ═══════════════════════════════════════════════════════════════
// Public API — Management
// ═══════════════════════════════════════════════════════════════

/**
 * Enable or disable debug console output.
 */
export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
}

/**
 * Check if debug output is enabled.
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * Clear all log entries.
 */
export function clear(): void {
  entries.length = 0;
  idCounter = 0;
}

/**
 * Export all log entries as a JSON string.
 */
export function exportAsJson(): string {
  return JSON.stringify(entries, null, 2);
}

/**
 * Export log entries as a CSV string.
 */
export function exportAsCsv(): string {
  const headers = [
    "timestamp", "level", "category", "message",
    "endpointId", "eventType", "taskId", "deliveryId",
    "statusCode", "durationMs", "attempt", "error",
  ];
  const lines = [headers.join(",")];

  for (const entry of entries) {
    const row = [
      entry.timestamp,
      entry.level,
      entry.category,
      `"${entry.message.replace(/"/g, '""')}"`,
      entry.endpointId ?? "",
      entry.eventType ?? "",
      entry.taskId ?? "",
      entry.deliveryId ?? "",
      entry.statusCode?.toString() ?? "",
      entry.durationMs?.toString() ?? "",
      entry.attempt?.toString() ?? "",
      entry.error ? `"${entry.error.replace(/"/g, '""')}"` : "",
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
}
