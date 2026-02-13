/**
 * Plugin constants
 */

export const PLUGIN_NAME = "plugin-sample-shehab-note";

/**
 * @deprecated Use STORAGE_ACTIVE_KEY or STORAGE_LEGACY_KEY instead.
 */
export const STORAGE_KEY = "recurring-tasks-deprecated";
export const STORAGE_ACTIVE_KEY = "recurring-tasks-active";
export const STORAGE_ARCHIVE_KEY = "recurring-tasks-archive";
export const STORAGE_LEGACY_KEY = "recurring-tasks";
export const STORAGE_LEGACY_BACKUP_KEY = "recurring-tasks.json.bak";

export const SETTINGS_KEY = "n8n-event-settings";

export const EVENT_QUEUE_KEY = "n8n-event-queue";

export const NOTIFICATION_STATE_KEY = "notification-state";

export const DOCK_TYPE = "recurring-tasks-dock";

export const TOPBAR_ICON_ID = "recurring-tasks-topbar";

export const EMITTED_OCCURRENCES_KEY = "scheduler-emitted-occurrences";

/**
 * Schema version for data migrations
 * v5: RRULE migration - all tasks now use RFC 5545-compliant RRULE format
 */
export const CURRENT_SCHEMA_VERSION = 5;

/**
 * Default n8n event configuration
 */
export const DEFAULT_NOTIFICATION_CONFIG = {
  n8n: {
    webhookUrl: "",
    sharedSecret: "",
    enabled: false,
  },
};

/**
 * Scheduler interval (check every minute)
 */
export const SCHEDULER_INTERVAL_MS = 60 * 1000;

export const EVENT_QUEUE_INTERVAL_MS = 30 * 1000;

export const EVENT_DEDUPE_LIMIT = 2000;

export const PLUGIN_EVENT_SOURCE = "shehab-note-recurring-plugin";

export const PLUGIN_EVENT_VERSION = "1.0.0";

export const MISSED_GRACE_PERIOD_MS = 60 * 60 * 1000;

/**
 * Timeline days to show
 */
export const TIMELINE_DAYS = 30;

/**
 * Snooze settings
 */
export const DEFAULT_MAX_SNOOZES = 3;

export const DEFAULT_SNOOZE_MINUTES = 15;

export const MAX_RECENT_COMPLETIONS = 10;

/**
 * Safety limits for iteration loops
 */
export const MAX_RECURRENCE_ITERATIONS = 1000;

export const MAX_RECOVERY_ITERATIONS = 100;

export const SNOOZE_OPTIONS = [
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
];

export const POSTPONE_PRESETS = [
  { label: "+1 day", minutes: 60 * 24 },
  { label: "+3 days", minutes: 60 * 24 * 3 },
  { label: "+1 week", minutes: 60 * 24 * 7 },
];

/**
 * Priority colors
 */
export const PRIORITY_COLORS = {
  lowest: "#94a3b8",
  low: "#64748b",
  normal: "#3b82f6",
  medium: "#f59e0b",
  high: "#f97316",
  highest: "#ef4444",
};

/**
 * Frequency labels
 */
export const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

/**
 * Weekday names
 */
export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Last run timestamp key for missed task recovery
 */
export const LAST_RUN_TIMESTAMP_KEY = "last-run-timestamp";

/**
 * Block attribute keys for syncing tasks to blocks
 */
export const BLOCK_ATTR_TASK_ID = "custom-recurring-task-id";
export const BLOCK_ATTR_TASK_DUE = "custom-recurring-task-due";
export const BLOCK_ATTR_TASK_ENABLED = "custom-recurring-task-enabled";

/**
 * Block sync retry configuration
 */
export const MAX_SYNC_RETRIES = 3;
export const RETRY_DELAYS = [1000, 5000, 30000]; // Exponential backoff in ms
export const SYNC_RETRY_PROCESSOR_INTERVAL = 10000; // Check retry queue every 10s
