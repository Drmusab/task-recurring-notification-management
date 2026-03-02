/**
 * Stores Layer — Svelte 5 Reactive State
 *
 * Frontend reactive stores for UI state. These consume DTOs from
 * the query layer and NEVER import backend modules directly.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Stores hold DTOs, never domain models
 *   ✔ Mutations go through UIQueryService → services/
 *   ✔ Svelte 5 runes ($state, $derived)
 *   ❌ No backend imports
 *   ❌ No direct SiYuan API calls
 */

// ── Task Store ───────────────────────────────────────────────
export {
  taskStore,
  allTasks,
  tasksDueToday,
  overdueTasks,
  taskCount,
  isLoading,
} from "@frontend/stores/Task.store";

// ── Dashboard Store ──────────────────────────────────────────
export {
  dashboardStore,
  dashboardTasks,
  inboxTasks,
  todayTasks,
  upcomingTasksView,
  doneTasks,
  blockedTasks,
  overdueDashboardTasks,
  activeReminders,
  upcomingReminders,
  allSuggestions,
  dashboardAnalytics,
  dashboardLoading,
  migrationStats,
  tabCounts,
} from "@frontend/stores/Dashboard.store";

export type { DashboardState } from "@frontend/stores/Dashboard.store";

// ── Task Analytics Store ─────────────────────────────────────
export {
  taskAnalyticsStore,
  analyticsIsLoading,
  completionRateFormatted,
  missRateFormatted,
  healthSummary,
  overallHealthStatus,
  streakEmoji,
  updateAnalyticsFromTasks,
} from "@frontend/stores/TaskAnalytics.store";

export type { AnalyticsState } from "@frontend/stores/TaskAnalytics.store";

// ── Task Order Store ─────────────────────────────────────────
export {
  taskOrderStore,
  reorderTasks,
  sortTasksByOrder,
  initializeTaskOrder,
} from "@frontend/stores/TaskOrder.store";

// ── Settings Store ───────────────────────────────────────────
export {
  settingsStore,
  initSettingsStore,
  resetSettingsStore,
} from "@frontend/stores/Settings.store";

// ── Search Store ─────────────────────────────────────────────
export {
  searchStore,
  calculateFilterCounts,
} from "@frontend/stores/Search.store";

export type { SmartFilter } from "@frontend/stores/Search.store";

// ── Runtime Ready Store ──────────────────────────────────────
export {
  runtimeReady,
  reminderReady,
  aiPanelReady,
  modalReady,
  navigationReady,
  markPluginLoaded,
  markBootComplete,
  markStorageLoaded,
  markBlockAttrsValidated,
  markCacheRebuilt,
  markSchedulerSynced,
  markAnalyticsLoaded,
  markDependencyGraphReady,
  markDomainMapperReady,
  markTaskLifecycleReady,
  markRuntimeReady,
  isRuntimeReady,
  getLifecycleSnapshot,
  resetRuntimeReady,
} from "@frontend/stores/RuntimeReady.store";

// ── Keyboard Shortcuts Store ─────────────────────────────────
export {
  DEFAULT_SHORTCUTS,
  keyboardShortcutsStore,
  resetKeyboardShortcutActions,
} from "@frontend/stores/KeyboardShortcuts.store";

// ── Bulk Selection Store ─────────────────────────────────────
export {
  bulkSelectionStore,
  selectedCount,
} from "@frontend/stores/BulkSelection.store";

// ── I18n Store ───────────────────────────────────────────────
export {
  i18nStore,
  messages,
  locale,
  t,
  formatDate,
  formatTime,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  getTranslation,
  getCurrentLocale,
  hasTranslation,
} from "@frontend/stores/I18n.store";

export type {
  I18nMessages,
  I18nLocale,
  I18nConfig,
} from "@frontend/stores/I18n.store";

// ── Canonical Task Store (Spec §8) ──────────────────────────
export {
  TaskStore as CanonicalTaskStore,
  taskStore as canonicalTaskStore,
  type TaskStoreState,
  type SortField,
  type SortDirection,
} from "./TaskStore";
