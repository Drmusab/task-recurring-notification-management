/**
 * Re-export from @shared/logging/logger for backward compatibility.
 * All new code should import from "@shared/logging/logger" directly.
 */
export { debug, info, warn, error, getRecentLogs, getErrorLogs, exportLogs, clearLogs } from "@shared/logging/logger";
export type { LogEntry } from "@shared/logging/logger";

