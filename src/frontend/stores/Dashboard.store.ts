/**
 * Dashboard Store — Aggregated Runtime Projection Layer
 *
 * Provides the SINGLE source of truth for all dashboard components.
 * Consumes DashboardDTO / TaskDTO / ReminderDTO / SuggestionDTO
 * exclusively through UIQueryService and UIEventService.
 *
 * FORBIDDEN:
 *   ❌ Import domain types (Task, RecurrenceInstance, DependencyLink)
 *   ❌ Import TaskStorage / Cache / Scheduler
 *   ❌ Compute dependency chains locally
 *   ❌ Parse markdown or call SiYuan API
 *   ❌ Poll or debounce — all updates are event-driven
 *
 * LIFECYCLE:
 *   Dashboard.store mounts ONLY after runtimeReady === true.
 *   connect() is called from plugin index.ts after all services are initialized.
 *   disconnect() is called on plugin unload.
 *
 * RECURRING INSTANCE RULE:
 *   Shows the latest recurrence instance, NOT the parent template.
 *   Completed recurring parents are filtered out.
 *
 * DEPENDENCY RULE:
 *   Blocked status is read from TaskDTO.isBlocked (pre-computed by UIQueryService).
 *   No local dependency chain computation.
 */

import { writable, derived, get } from "svelte/store";
import type { Writable, Readable } from "svelte/store";
import type {
  TaskDTO,
  ReminderDTO,
  SuggestionDTO,
  AnalyticsDTO,
  DependencyDTO,
} from "../services/DTOs";
import { uiQueryService } from "../services/UIQueryService";
import { uiEventService } from "../services/UIEventService";

// ──────────────────────────────────────────────────────────────
// State Shape
// ──────────────────────────────────────────────────────────────

export interface DashboardState {
  /** All projected tasks (recurring-instance-aware) */
  readonly tasks: readonly TaskDTO[];

  /** Active reminders (overdue or due now) */
  readonly activeReminders: readonly ReminderDTO[];

  /** Upcoming reminders (due within next 24h) */
  readonly upcomingReminders: readonly ReminderDTO[];

  /** AI suggestions keyed by taskId */
  readonly suggestions: ReadonlyMap<string, readonly SuggestionDTO[]>;

  /** Pre-computed analytics snapshot */
  readonly analytics: AnalyticsDTO | null;

  /** Loading flag */
  readonly loading: boolean;

  /** Error message (null when OK) */
  readonly error: string | null;

  /** Last refresh timestamp */
  readonly lastUpdated: number;
}

function createInitialState(): DashboardState {
  return {
    tasks: [],
    activeReminders: [],
    upcomingReminders: [],
    suggestions: new Map(),
    analytics: null,
    loading: false,
    error: null,
    lastUpdated: 0,
  };
}

// ──────────────────────────────────────────────────────────────
// Recurring Instance Filter
// ──────────────────────────────────────────────────────────────

/**
 * Filter tasks so dashboard displays the latest recurrence instance
 * instead of completed recurring parent templates.
 *
 * Rules:
 * 1. Non-recurring tasks pass through unchanged.
 * 2. For each recurring series (grouped by seriesId):
 *    - Show only the latest (highest occurrenceIndex) non-completed instance.
 *    - If ALL instances are completed, show the most recently completed one.
 * 3. Tasks without a seriesId but marked isRecurring pass through
 *    unless they are completed parent templates (status === "done" AND no occurrenceIndex).
 */
function filterRecurringInstances(tasks: readonly TaskDTO[]): TaskDTO[] {
  const nonRecurring: TaskDTO[] = [];
  const seriesMap = new Map<string, TaskDTO[]>();
  const recurringNoSeries: TaskDTO[] = [];

  for (const task of tasks) {
    if (!task.isRecurring) {
      nonRecurring.push(task);
      continue;
    }

    if (task.seriesId) {
      const existing = seriesMap.get(task.seriesId) ?? [];
      existing.push(task);
      seriesMap.set(task.seriesId, existing);
    } else {
      // Recurring but no series ID — filter out completed parents
      if (task.status === "done" && task.occurrenceIndex == null) {
        continue; // Skip completed parent template
      }
      recurringNoSeries.push(task);
    }
  }

  // For each series, pick the latest active instance
  const seriesResults: TaskDTO[] = [];
  for (const [, instances] of seriesMap) {
    const active = instances.filter((t) => t.status !== "done" && t.status !== "cancelled");
    if (active.length > 0) {
      // Pick highest occurrence index among active instances
      active.sort((a, b) => (b.occurrenceIndex ?? 0) - (a.occurrenceIndex ?? 0));
      seriesResults.push(active[0]!);
    } else {
      // All completed — show the most recently completed
      instances.sort((a, b) => {
        const aTime = a.doneAt ? new Date(a.doneAt).getTime() : 0;
        const bTime = b.doneAt ? new Date(b.doneAt).getTime() : 0;
        return bTime - aTime;
      });
      if (instances[0]) {
        seriesResults.push(instances[0]);
      }
    }
  }

  return [...nonRecurring, ...seriesResults, ...recurringNoSeries];
}

// ──────────────────────────────────────────────────────────────
// Store Implementation
// ──────────────────────────────────────────────────────────────

class DashboardStore {
  private store: Writable<DashboardState> = writable(createInitialState());
  private eventCleanups: Array<() => void> = [];

  /** Svelte-compatible subscribe */
  subscribe = this.store.subscribe;

  // ── Lifecycle ──────────────────────────────────────────────

  /**
   * Connect to backend services via UIEventService.
   * Called after runtimeReady === true.
   */
  connect(): void {
    // 1. Subscribe to task refresh events
    this.eventCleanups.push(
      uiEventService.onTaskRefresh(() => {
        this.refresh();
      })
    );

    // 2. Subscribe to reminder events
    this.eventCleanups.push(
      uiEventService.onReminderDue((payload) => {
        this.handleReminderUpdate(payload.taskId);
      })
    );

    // 3. Subscribe to AI suggestion events
    this.eventCleanups.push(
      uiEventService.onAISuggestion((payload) => {
        this.handleSuggestionUpdate(payload.taskId, payload.suggestions);
      })
    );

    // 4. Subscribe to attention-filtered AI suggestions
    this.eventCleanups.push(
      uiEventService.onAttentionSuggestion((payload) => {
        this.handleSuggestionUpdate(payload.taskId, payload.suggestions);
      })
    );

    // 5. Subscribe to dependency resolution
    this.eventCleanups.push(
      uiEventService.onDependencyResolved(() => {
        this.refresh();
      })
    );

    // 6. Subscribe to task blocked/unblocked
    this.eventCleanups.push(
      uiEventService.onTaskBlocked(() => {
        this.refresh();
      })
    );
    this.eventCleanups.push(
      uiEventService.onTaskUnblocked(() => {
        this.refresh();
      })
    );

    // 7. Subscribe to cache invalidation
    this.eventCleanups.push(
      uiEventService.onCacheInvalidated(() => {
        this.refresh();
      })
    );

    // Initial load
    this.refresh();
  }

  /**
   * Disconnect all subscriptions and reset state.
   * Called on plugin unload.
   */
  disconnect(): void {
    for (const cleanup of this.eventCleanups) {
      try { cleanup(); } catch { /* already removed */ }
    }
    this.eventCleanups.length = 0;
    this.store.set(createInitialState());
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Refresh all dashboard data from UIQueryService.
   * This is the ONLY way data enters the store.
   */
  refresh(): void {
    this.store.update((s) => ({ ...s, loading: true, error: null }));

    try {
      // Read projected DTOs from UIQueryService
      const rawTasks = uiQueryService.selectDashboard();
      const tasks = filterRecurringInstances(rawTasks);
      const reminders = uiQueryService.selectReminders();
      const analytics = uiQueryService.selectAnalytics();

      this.store.update((s) => ({
        ...s,
        tasks,
        activeReminders: reminders.active,
        upcomingReminders: reminders.upcoming,
        analytics,
        loading: false,
        lastUpdated: Date.now(),
      }));
    } catch (err) {
      this.store.update((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Dashboard refresh failed",
      }));
    }
  }

  /**
   * Get current state snapshot (non-reactive).
   */
  getState(): DashboardState {
    return get(this.store);
  }

  // ── Private Handlers ───────────────────────────────────────

  private handleReminderUpdate(_taskId: string): void {
    // Re-fetch reminders from projection layer
    try {
      const reminders = uiQueryService.selectReminders();
      this.store.update((s) => ({
        ...s,
        activeReminders: reminders.active,
        upcomingReminders: reminders.upcoming,
      }));
    } catch {
      // Silently fail — next full refresh will fix it
    }
  }

  private handleSuggestionUpdate(taskId: string, suggestions: SuggestionDTO[]): void {
    this.store.update((s) => {
      const newMap = new Map(s.suggestions);
      newMap.set(taskId, suggestions);
      return { ...s, suggestions: newMap };
    });
  }
}

// ──────────────────────────────────────────────────────────────
// Singleton + Derived Stores
// ──────────────────────────────────────────────────────────────

export const dashboardStore = new DashboardStore();

/** All dashboard tasks (recurring-instance-filtered) */
export const dashboardTasks: Readable<readonly TaskDTO[]> = derived(
  dashboardStore,
  ($state) => $state.tasks
);

/** Active (open) tasks — not done, not cancelled */
export const inboxTasks: Readable<readonly TaskDTO[]> = derived(
  dashboardStore,
  ($state) => $state.tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled"
  )
);

/** Tasks due today (reads lifecycleState from DTO — no local date computation) */
export const todayTasks: Readable<readonly TaskDTO[]> = derived(
  dashboardStore,
  ($state) =>
    $state.tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.status !== "cancelled" &&
        t.lifecycleState === "due"
    )
);

/** Upcoming tasks — not overdue, not due today, not done, have a future dueAt */
export const upcomingTasksView: Readable<readonly TaskDTO[]> = derived(
  dashboardStore,
  ($state) =>
    $state.tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.status !== "cancelled" &&
        !t.isOverdue &&
        t.lifecycleState !== "due" &&
        t.lifecycleState !== "blocked" &&
        t.dueAt != null
    )
);

/** Completed tasks (most recent first, capped at 100) */
export const doneTasks: Readable<readonly TaskDTO[]> = derived(
  dashboardStore,
  ($state) =>
    $state.tasks
      .filter((t) => t.status === "done")
      .sort((a, b) => {
        const aTime = a.doneAt ? new Date(a.doneAt).getTime() : 0;
        const bTime = b.doneAt ? new Date(b.doneAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 100)
);

/** Blocked tasks (dependency-aware, reads isBlocked from DTO) */
export const blockedTasks: Readable<readonly TaskDTO[]> = derived(
  dashboardStore,
  ($state) => $state.tasks.filter((t) => t.isBlocked)
);

/** Overdue tasks (reads isOverdue from DTO) */
export const overdueDashboardTasks: Readable<readonly TaskDTO[]> = derived(
  dashboardStore,
  ($state) =>
    $state.tasks.filter(
      (t) => t.isOverdue && t.status !== "done" && t.status !== "cancelled"
    )
);

/** Active reminders (reactive via event subscription) */
export const activeReminders: Readable<readonly ReminderDTO[]> = derived(
  dashboardStore,
  ($state) => $state.activeReminders
);

/** Upcoming reminders */
export const upcomingReminders: Readable<readonly ReminderDTO[]> = derived(
  dashboardStore,
  ($state) => $state.upcomingReminders
);

/** AI suggestions for all tasks */
export const allSuggestions: Readable<ReadonlyMap<string, readonly SuggestionDTO[]>> = derived(
  dashboardStore,
  ($state) => $state.suggestions
);

/** Analytics snapshot */
export const dashboardAnalytics: Readable<AnalyticsDTO | null> = derived(
  dashboardStore,
  ($state) => $state.analytics
);

/** Dashboard loading state */
export const dashboardLoading: Readable<boolean> = derived(
  dashboardStore,
  ($state) => $state.loading
);

/** Migration stats derived from task DTOs */
export const migrationStats: Readable<{ migratable: number; alreadyMigrated: number }> = derived(
  dashboardStore,
  ($state) => ({
    migratable: $state.tasks.filter((t) => t.isRecurring && !t.recurrenceText).length,
    alreadyMigrated: $state.tasks.filter((t) => t.isRecurring && !!t.recurrenceText).length,
  })
);

/** Tab counts for DockPanel badges */
export const tabCounts: Readable<{
  inbox: number;
  today: number;
  upcoming: number;
  done: number;
  blocked: number;
  overdue: number;
}> = derived(
  [inboxTasks, todayTasks, upcomingTasksView, doneTasks, blockedTasks, overdueDashboardTasks],
  ([$inbox, $today, $upcoming, $done, $blocked, $overdue]) => ({
    inbox: $inbox.length,
    today: $today.length,
    upcoming: $upcoming.length,
    done: $done.length,
    blocked: $blocked.length,
    overdue: $overdue.length,
  })
);
