/**
 * Structured logging utility for debugging and diagnostics
 */

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: unknown;
}

const MAX_LOG_ENTRIES = 500;
const logEntries: LogEntry[] = [];

// Enable debug logging based on environment or build flag
// In browser environments, this will always be false unless explicitly set
const DEBUG_ENABLED = (() => {
  try {
    // Check if we're in a Node.js environment
    if (typeof process !== "undefined" && process.env) {
      return process.env.DEBUG === "true";
    }
  } catch (err) {
    // Ignore errors in browser environment
  }
  return false;
})();

/**
 * Add a log entry
 */
function addLogEntry(level: LogEntry["level"], message: string, context?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  logEntries.push(entry);

  // Keep only the most recent entries
  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries.shift();
  }

  // Console output
  const prefix = `[${level.toUpperCase()}] [${entry.timestamp}]`;
  if (level === "error") {
    console.error(prefix, message, context || "");
  } else if (level === "warn") {
    console.warn(prefix, message, context || "");
  } else if (level === "debug" && DEBUG_ENABLED) {
    console.debug(prefix, message, context || "");
  } else if (level === "info") {
    console.log(prefix, message, context || "");
  }
}

/**
 * Log debug message (only if DEBUG=true)
 */
export function debug(message: string, context?: unknown): void {
  addLogEntry("debug", message, context);
}

/**
 * Log info message
 */
export function info(message: string, context?: unknown): void {
  addLogEntry("info", message, context);
}

/**
 * Log warning message
 */
export function warn(message: string, context?: unknown): void {
  addLogEntry("warn", message, context);
}

/**
 * Log error message
 */
export function error(message: string, context?: unknown): void {
  addLogEntry("error", message, context);
}

/**
 * Get recent log entries
 */
export function getRecentLogs(count: number = 100): LogEntry[] {
  return logEntries.slice(-count);
}

/**
 * Get error logs only
 */
export function getErrorLogs(): LogEntry[] {
  return logEntries.filter((entry) => entry.level === "error");
}

/**
 * Export all logs as JSON string
 */
export function exportLogs(): string {
  return JSON.stringify(logEntries, null, 2);
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logEntries.length = 0;
}
