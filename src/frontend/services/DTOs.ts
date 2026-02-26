/**
 * Frontend DTOs — Data Transfer Objects for UI consumption
 *
 * These are the ONLY data shapes that components may use.
 * Components must NEVER import domain types directly.
 *
 * Each DTO is a plain, read-only object — no methods, no class instances,
 * no branded types, no Object.freeze. Just serializable data.
 *
 * Produced by:
 *   - UIQueryService.selectDashboard() et al.
 *   - UITaskMutationService return values
 *   - UIEventService event payloads
 */

// ──────────────────────────────────────────────────────────────
// TaskDTO — Primary task representation for components
// ──────────────────────────────────────────────────────────────

export interface TaskDTO {
  /** Unique task ID */
  readonly id: string;

  /** Display name */
  readonly name: string;

  /** Current status: "todo" | "done" | "cancelled" */
  readonly status: string;

  /** Lifecycle state: "idle" | "due" | "overdue" | "missed" | "completed" | etc. */
  readonly lifecycleState: string;

  /** Whether task is enabled/active */
  readonly enabled: boolean;

  /** Due date (ISO string) */
  readonly dueAt?: string;

  /** Scheduled date (ISO string) */
  readonly scheduledAt?: string;

  /** Completion timestamp (ISO string) */
  readonly doneAt?: string;

  /** Priority level */
  readonly priority?: string;

  /** Tags array */
  readonly tags?: readonly string[];

  /** Category */
  readonly category?: string;

  /** Description/notes */
  readonly description?: string;

  /** Display order */
  readonly order?: number;

  // ── Computed display flags ──

  /** Whether this is a recurring task */
  readonly isRecurring: boolean;

  /** Whether task is blocked by unresolved dependencies */
  readonly isBlocked: boolean;

  /** Whether task is overdue */
  readonly isOverdue: boolean;

  // ── Analytics summary (pre-computed) ──

  /** Total completion count */
  readonly completionCount: number;

  /** Total miss count */
  readonly missCount: number;

  /** Current consecutive streak */
  readonly currentStreak: number;

  /** Health score (0-100) */
  readonly healthScore: number;

  // ── SiYuan binding (read-only for navigation) ──

  /** SiYuan block ID */
  readonly blockId?: string;

  /** Document path (for display) */
  readonly path?: string;

  /** Heading/section context */
  readonly heading?: string;

  // ── Recurrence info (display only) ──

  /** Human-readable recurrence text */
  readonly recurrenceText?: string;

  /** Series ID (if recurring child) */
  readonly seriesId?: string;

  /** Occurrence index in series */
  readonly occurrenceIndex?: number;

  // ── Status symbol for checkbox display ──
  readonly statusSymbol?: string;
}

// ──────────────────────────────────────────────────────────────
// ReminderDTO — Reminder item for ReminderPanel
// ──────────────────────────────────────────────────────────────

export interface ReminderDTO {
  /** Task ID */
  readonly taskId: string;

  /** Task name */
  readonly name: string;

  /** Due date (ISO string) */
  readonly dueAt: string;

  /** Priority */
  readonly priority?: string;

  /** Whether overdue */
  readonly isOverdue: boolean;

  /** Minutes since due (negative = overdue, positive = upcoming) */
  readonly minutesUntilDue: number;

  /** Recurrence text (if recurring) */
  readonly recurrenceText?: string;

  /** Tags for display */
  readonly tags?: readonly string[];

  /** Block ID for navigation */
  readonly blockId?: string;

  /** Snooze count for this occurrence */
  readonly snoozeCount: number;

  /** Max snoozes allowed */
  readonly maxSnoozes: number;
}

// ──────────────────────────────────────────────────────────────
// SuggestionDTO — AI suggestion for AISuggestionsPanel
// ──────────────────────────────────────────────────────────────

export interface SuggestionDTO {
  /** Unique suggestion ID */
  readonly id: string;

  /** Task this suggestion applies to */
  readonly taskId: string;

  /** Suggestion type: "abandon" | "reschedule" | "urgency" | "frequency" | "consolidate" | "delegate" */
  readonly type: string;

  /** Human-readable reason */
  readonly reason: string;

  /** Confidence score (0-1) */
  readonly confidence: number;

  /** Whether this suggestion has been dismissed */
  readonly dismissed: boolean;

  /** Action to take */
  readonly action: SuggestionActionDTO;
}

export interface SuggestionActionDTO {
  /** Action type */
  readonly type: string;

  /** Display label for the action button */
  readonly label: string;

  /** Action parameters (varies by type) */
  readonly parameters: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────────
// DependencyDTO — Dependency info for NavigationPanel
// ──────────────────────────────────────────────────────────────

export interface DependencyDTO {
  /** Dependency link ID */
  readonly id: string;

  /** Source task ID */
  readonly sourceTaskId: string;

  /** Source task name (resolved for display) */
  readonly sourceTaskName: string;

  /** Target task ID */
  readonly targetTaskId: string;

  /** Target task name (resolved for display) */
  readonly targetTaskName: string;

  /** Whether the dependency is satisfied */
  readonly isSatisfied: boolean;

  /** Whether the dependent task is blocked */
  readonly isBlocked: boolean;

  /** Dependency type */
  readonly type: string;
}

// ──────────────────────────────────────────────────────────────
// RecurrenceDTO — Recurrence info for RecurrenceEditorModal
// ──────────────────────────────────────────────────────────────

export interface RecurrenceDTO {
  /** Task ID this recurrence belongs to */
  readonly taskId: string;

  /** Human-readable rule string (e.g., "every day", "every 2 weeks") */
  readonly rule: string;

  /** RRule string if available */
  readonly rrule?: string;

  /** Series ID (for recurring children) */
  readonly seriesId?: string;

  /** Whether this is a recurring parent */
  readonly isParent: boolean;

  /** Occurrence index (if child) */
  readonly occurrenceIndex?: number;

  /** Start date for the recurrence (ISO string) */
  readonly dtstart?: string;
}

// ──────────────────────────────────────────────────────────────
// AnalyticsDTO — Analytics summary for dashboard/tracker
// ──────────────────────────────────────────────────────────────

export interface AnalyticsDTO {
  readonly totalTasks: number;
  readonly activeTasks: number;
  readonly disabledTasks: number;
  readonly completionRate: number;
  readonly missRate: number;
  readonly totalCompletions: number;
  readonly totalMisses: number;
  readonly bestCurrentStreak: number;
  readonly bestOverallStreak: number;
  readonly overdueCount: number;
  readonly dueTodayCount: number;
  readonly dueThisWeekCount: number;
  readonly averageHealth: number;
  readonly healthBreakdown: {
    readonly healthy: number;
    readonly moderate: number;
    readonly struggling: number;
  };
}

// ──────────────────────────────────────────────────────────────
// Dashboard Result DTOs
// ──────────────────────────────────────────────────────────────

export interface DashboardDTO {
  readonly tasks: readonly TaskDTO[];
  readonly analytics: AnalyticsDTO;
  readonly reminders: {
    readonly active: readonly ReminderDTO[];
    readonly upcoming: readonly ReminderDTO[];
  };
  readonly lastUpdated: number;
}

// ──────────────────────────────────────────────────────────────
// Mutation Result DTOs
// ──────────────────────────────────────────────────────────────

export interface MutationResultDTO {
  readonly success: boolean;
  readonly taskId?: string;
  readonly error?: string;
}

// ──────────────────────────────────────────────────────────────
// SettingsDTO — Plugin settings projected for UI consumption
// ──────────────────────────────────────────────────────────────

export interface SettingsDTO {
  // General
  readonly version: string;
  readonly debugMode: boolean;
  readonly timezone: string;
  // Display
  readonly dateFormat: string;
  readonly showRelativeDates: boolean;
  readonly showPath: boolean;
  readonly showHeading: boolean;
  readonly showDescriptionPopover: boolean;
  readonly virtualScrollThreshold: number;
  // Task Format
  readonly preferredFormat: "emoji" | "text";
  readonly customStatuses: readonly { readonly symbol: string; readonly name: string; readonly type: string }[];
  readonly defaultPriority: string;
  readonly useFilenameAsDate: boolean;
  readonly filenameDatePattern: string;
  // Query & Filter
  readonly defaultQuery: string;
  readonly groupBy: string;
  readonly sortBy: string;
  readonly sortDirection: string;
  readonly hideCompleted: boolean;
  readonly autoHideCompletedDays: number;
  // Recurrence
  readonly recurrenceFromCompletion: boolean;
  readonly autoCreateNextTask: boolean;
  readonly keepCompletedRecurring: boolean;
  // Dependency
  readonly enableDependencies: boolean;
  readonly showDependencyWarnings: boolean;
  readonly autoHideBlockedTasks: boolean;
  // Notification
  readonly enableNotifications: boolean;
  readonly notificationChannels: readonly string[];
  readonly notificationLeadMinutes: number;
  readonly notifyOverdue: boolean;
  // Performance
  readonly enableIndexing: boolean;
  readonly enableQueryCache: boolean;
  readonly queryCacheTTL: number;
  readonly saveDebounceDuration: number;
  readonly autoArchiveDays: number;
  // Storage
  readonly storageFilePath: string;
  readonly archiveDirectoryPath: string;
  readonly enablePartitionedStorage: boolean;
  readonly partitionBy: "month" | "year";
  // Advanced
  readonly enableExperimentalFeatures: boolean;
  readonly enableAISuggestions: boolean;
  readonly enableSmartRecurrence: boolean;
  readonly smartRecurrenceConfidence: number;
  // Allow extensibility
  readonly [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────
// SavedQueryDTO — Saved query projected for UI consumption
// ──────────────────────────────────────────────────────────────

export interface SavedQueryDTO {
  readonly id: string;
  readonly name: string;
  readonly queryString: string;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tags?: readonly string[];
  readonly folder?: string;
  readonly useCount?: number;
  readonly lastUsedAt?: string;
  readonly color?: string;
  readonly pinned?: boolean;
}

export interface SavedQueryFolderDTO {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly color?: string;
  readonly icon?: string;
}

export interface SavedQueryStatsDTO {
  readonly totalQueries: number;
  readonly totalFolders: number;
  readonly totalUses: number;
  readonly averageUsesPerQuery: number;
  readonly oldestQuery: string | null;
  readonly newestQuery: string | null;
}

// ──────────────────────────────────────────────────────────────
// TaskTemplateDTO — Task template projected for UI consumption
// ──────────────────────────────────────────────────────────────

export interface TaskTemplateDTO {
  readonly id: string;
  readonly label: string;
  readonly name: string;
  readonly description?: string;
  readonly priority?: string;
  readonly tags?: readonly string[];
  readonly recurrence?: string;
  readonly category?: string;
  readonly notes?: string;
}

// ──────────────────────────────────────────────────────────────
// QueryExplanationDTO — Query explanation projected for UI
// ──────────────────────────────────────────────────────────────

export interface FilterExplanationDTO {
  readonly filterDescription: string;
  readonly reason: string;
  readonly matched: boolean;
}

export interface QueryExplanationDTO {
  readonly matchCount: number;
  readonly totalCount: number;
  readonly queryString: string;
  readonly taskExplanations: readonly TaskExplanationDTO[];
  readonly markdown?: string;
}

export interface TaskExplanationDTO {
  readonly task: { readonly name: string; readonly id?: string };
  readonly matched: boolean;
  readonly filterExplanations: readonly FilterExplanationDTO[];
  readonly mismatchReasons: readonly string[];
}

/** Opaque AST node — components only pass this through, never inspect it */
export type QueryASTDTO = Record<string, unknown> | null;

// ──────────────────────────────────────────────────────────────
// SuggestedFixDTO — Query suggestion fix for UI
// ──────────────────────────────────────────────────────────────

export interface SuggestedFixDTO {
  readonly taskId: string;
  readonly patch: Record<string, unknown>;
  readonly description: string;
  readonly confidence: number;
  readonly original?: string;
  readonly suggestion?: string;
}

// ──────────────────────────────────────────────────────────────
// PluginSettingsDTO — Opaque settings passthrough for dashboard
// ──────────────────────────────────────────────────────────────
//
// The real PluginSettings is a deeply nested interface.
// Dashboard components only pass it through to SettingsView — they
// never inspect individual fields. This opaque DTO keeps the
// dashboard decoupled from the backend settings schema.

export type PluginSettingsDTO = Record<string, unknown>;
