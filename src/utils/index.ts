/**
 * Utils Layer — Shared Utilities
 *
 * Pure utility functions used across all layers. No domain logic,
 * no side effects, no SiYuan API calls.
 */

// ── Performance Monitor ──────────────────────────────────────
export {
  PerformanceMonitor,
  performanceMonitor,
  Measure,
  MeasureAsync,
} from "@shared/utils/PerformanceMonitor";

export type {
  PerformanceMetric,
  PerformanceStats,
} from "@shared/utils/PerformanceMonitor";

// ── SQL Sanitization ─────────────────────────────────────────
export {
  escapeSqlString,
  isValidBlockId,
  assertBlockId,
} from "@shared/utils/sql-sanitize";

// ── Date Utilities ───────────────────────────────────────────
export {
  parseTime,
  formatTime as formatTimeShared,
  isToday as isTodayShared,
  isPast as isPastShared,
  isOverdue as isOverdueShared,
  addDays as addDaysShared,
  addWeeks as addWeeksShared,
  addMonths as addMonthsShared,
  setTime,
  setTimeWithFallback,
  startOfDay as startOfDayShared,
  endOfDay as endOfDayShared,
  daysBetween as daysBetweenShared,
  getDateRange,
} from "@shared/utils/date/date";

// ── Timezone ─────────────────────────────────────────────────
export {
  toUTC,
  fromUTC,
  getUserTimezone,
  getDSTInfo,
  normalizeToUTC,
  denormalizeFromUTC,
} from "@shared/utils/date/timezone";

// ── Date Tools ───────────────────────────────────────────────
export {
  compareByDate,
  parseTypedDateForDisplayUsingFutureDate,
  parseTypedDateForSaving,
} from "@shared/utils/date/date-tools";

// ── Date Range ───────────────────────────────────────────────
export { DateRange } from "@shared/utils/date/date-range";

// ── Date Abbreviations ───────────────────────────────────────
export { doAutocomplete } from "@shared/utils/date/date-abbreviations";

// ── RRule Utilities ──────────────────────────────────────────
export {
  parseRRule,
  buildRRule,
  validateRRule as validateRRuleUtil,
  createEmptyRRule,
  WEEKDAY_LABELS,
  ALL_WEEKDAYS,
  ALL_FREQUENCIES,
} from "@shared/utils/recurrence/rrule-utils";

export type {
  RRuleFrequency,
  RRuleWeekDay,
  RRuleData,
} from "@shared/utils/recurrence/rrule-utils";

// ── Placeholder Resolver ─────────────────────────────────────
export {
  PlaceholderResolver,
  placeholderResolver,
} from "@shared/utils/string/placeholder-resolver";

export type { QueryContext } from "@shared/utils/string/placeholder-resolver";

// ── Link Resolver ────────────────────────────────────────────
export { LinkResolver } from "@shared/utils/task/link-resolver";
export type { GetFirstLinkpathDestFn } from "@shared/utils/task/link-resolver";

// ── Logging ──────────────────────────────────────────────────
export { logging, log } from "@shared/utils/lib/logging";
export type { LogLevel, LoggingOptions } from "@shared/utils/lib/logging";

// ── String Helpers ───────────────────────────────────────────
export { capitalizeFirstLetter } from "@shared/utils/lib/string-helpers";

// ── Priority Tools ───────────────────────────────────────────
export { PriorityTools } from "@shared/utils/lib/priority-tools";

// ── Markdown Table ───────────────────────────────────────────
export { MarkdownTable } from "@shared/utils/lib/markdown-table";

// ── HTML Character Entities ──────────────────────────────────
export {
  htmlEncodeCharacter,
  htmlEncodeString,
} from "@shared/utils/lib/html-character-entities";

// ── Property Category ────────────────────────────────────────
export { PropertyCategory } from "@shared/utils/lib/property-category";

// ── SiYuan Compat Layer ──────────────────────────────────────
export {
  MenuItem,
  Menu,
  Notice,
  prepareSimpleSearch,
} from "@shared/utils/compat/siyuan-compat";

export type {
  Reference,
  SearchResult,
  FuzzyMatch,
} from "@shared/utils/compat/siyuan-compat";

// ── Frontend Utils ───────────────────────────────────────────
export {
  formatDate as formatDateFrontend,
  formatDateShort,
  formatDateRelative,
  formatDateKey,
  formatDateForAria,
  formatTime as formatTimeFrontend,
  formatTimeRange,
  formatDateTime as formatDateTimeFrontend,
  parseDate,
  isSameDay,
  isToday as isTodayFrontend,
  isPast as isPastFrontend,
  isFuture,
} from "@frontend/utils/dateFormatters";

// ── Debounce / Throttle ──────────────────────────────────────
export {
  debounce,
  debounceAsync,
  throttle,
} from "@frontend/utils/debounce";

// ── Accessibility ────────────────────────────────────────────
export {
  getTaskAriaLabel,
  getStatusText,
  getPriorityText,
  formatDateForScreenReader,
  getTaskCountLabel,
  getTaskActionAnnouncement,
  getShortcutAriaLabel,
  isFocusable,
  trapFocus,
  announceToScreenReader,
  generateAriaId,
} from "@frontend/utils/accessibility";

// ── Lazy D3 ──────────────────────────────────────────────────
export { loadD3, getD3 } from "@frontend/utils/lazyD3";

// ── Keyboard Shortcuts ───────────────────────────────────────
export {
  SHORTCUT_DEFINITIONS,
  DEFAULT_SHORTCUT_SETTINGS,
  getShortcutDefinition,
  getAllShortcutDefinitions,
} from "@frontend/utils/keyboardShortcuts";

export type {
  ShortcutId,
  ShortcutDefinition,
  ShortcutSettings,
  KeyboardShortcutManager,
} from "@frontend/utils/keyboardShortcuts";

// ── Constants ────────────────────────────────────────────────
export {
  PLUGIN_NAME,
  STORAGE_ACTIVE_KEY,
  STORAGE_ARCHIVE_KEY,
  STORAGE_LEGACY_KEY,
  STORAGE_LEGACY_BACKUP_KEY,
  SETTINGS_KEY,
  EVENT_QUEUE_KEY,
  NOTIFICATION_STATE_KEY,
  DOCK_TYPE,
  TOPBAR_ICON_ID,
  EMITTED_OCCURRENCES_KEY,
} from "@shared/constants/misc-constants";

// ── Plugin Logger ────────────────────────────────────────────
export * as pluginLogger from "@shared/logging/logger";

// ── Canonical Error Hierarchy (Spec §12) ─────────────────────
export {
  SiYuanApiError,
  SiYuanCapabilityError,
  WebhookDeliveryError,
  CacheError,
  BootSequenceError,
  ServiceNotInitializedError,
} from "./errors";
