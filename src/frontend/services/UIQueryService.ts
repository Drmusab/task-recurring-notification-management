/**
 * UIQueryService — Frontend Query Facade
 *
 * The ONLY way components should read task data.
 * Wraps the backend QueryService/TaskStorage and projects
 * results as DTOs — never exposing domain types to the UI.
 *
 * Components call:
 *   uiQueryService.selectDashboard()
 *   uiQueryService.selectUpcoming()
 *   uiQueryService.selectOverdue()
 *   uiQueryService.selectBlocked()
 *   uiQueryService.selectReminders()
 *   uiQueryService.selectById(id)
 *
 * Components NEVER call:
 *   ❌ TaskStorage.loadActive()
 *   ❌ TaskCache.get()
 *   ❌ QueryService.selectAll() (backend-only)
 *
 * REFACTORED (Session 25):
 *   All dynamic `import("@backend/...")` calls removed.
 *   Every backend capability is now injected via structural interfaces
 *   in `UIQueryServiceDeps.connect()`. The frontend services layer
 *   NEVER reaches into the backend module graph.
 *
 * FORBIDDEN:
 *   ❌ Import Svelte (this is a plain TS class)
 *   ❌ Trigger mutations (delegate to UITaskMutationService)
 *   ❌ Access DOM
 *   ❌ import("@backend/...")
 *   ❌ import("@domain/...")
 *   ❌ import("@shared/...")
 */

// ── No backend imports — structural typing only ────────────────

import type {
  TaskDTO,
  ReminderDTO,
  AnalyticsDTO,
  DependencyDTO,
  SavedQueryDTO,
  SavedQueryFolderDTO,
  SavedQueryStatsDTO,
  TaskTemplateDTO,
  QueryExplanationDTO,
  SuggestedFixDTO,
  SuggestionDTO,
} from "./DTOs";

// ──────────────────────────────────────────────────────────────
// Structural Interfaces (replace backend type imports)
// ──────────────────────────────────────────────────────────────

/**
 * Shape expected from backend task data source.
 * Mirrors the properties consumed by mapTaskToDTO without
 * importing the domain Task model.
 */
interface RawTaskShape {
  id: string;
  name?: string;
  status?: string;
  enabled?: boolean;
  dueAt?: string;
  priority?: string;
  tags?: readonly string[];
  category?: string;
  description?: string;
  recurrence?: unknown;
  blockId?: string;
  dependsOn?: string[];
  [key: string]: unknown;
}

/** Structural interface for the backend task data provider. */
interface TaskDataSource {
  getAllTasks(): RawTaskShape[];
}

/** Structural interface for the analytics calculator. */
interface AnalyticsCalculatorLike {
  calculateTaskAnalytics(tasks: RawTaskShape[]): Record<string, unknown>;
  getHealthBreakdown(tasks: RawTaskShape[]): { healthy: number; moderate: number; struggling: number };
}

/**
 * Structural interface for natural-language date parsing.
 * Replaces direct @domain/utils/DateCalculations import.
 */
interface DateParserLike {
  parseNaturalLanguageDate(input: string, referenceDate?: Date): Date | null;
  toISODateString(date: Date): string;
}

/**
 * Structural interface for human-readable recurrence rule parsing.
 * Replaces direct @domain/recurrence/RuleParser import.
 */
interface RecurrenceParserLike {
  parseRecurrenceRule(input: string): unknown;
  serializeRecurrenceRule(rule: unknown): string;
}

/**
 * Structural interface for file-level task replacement.
 * Used by replaceTaskInFile facade (mutation delegated via injected provider).
 */
interface FileReplacerLike {
  replaceTaskWithTasks(opts: { originalTask: unknown; newTasks: unknown }): Promise<void>;
}

// ── NEW: Injected backend capability interfaces ────────────────
//
// Every backend capability that was previously reached via
// dynamic import("@backend/...") is now a structural interface
// injected through connect().

/** Structural interface for the natural-language query engine. */
interface QueryEngineLike {
  executeQuery(queryString: string, tasks: RawTaskShape[], settings?: Record<string, unknown>): { tasks: RawTaskShape[] };
  executeQueryWithExplanation(queryString: string, tasks: RawTaskShape[], settings?: Record<string, unknown>): { result: { tasks: RawTaskShape[] }; explanation: unknown };
}

/** Structural interface for the saved query persistence layer. */
interface SavedQueryStoreLike {
  load(): SavedQueryDTO[];
  get(queryId: string): SavedQueryDTO | null;
  save(query: unknown): void;
  update(queryId: string, updates: unknown): void;
  delete(queryId: string): void;
  recordUse(queryId: string): void;
  duplicate(queryId: string): SavedQueryDTO | null;
  getStats(): SavedQueryStatsDTO;
  getMostUsed(limit: number): SavedQueryDTO[];
  getRecentlyUsed(limit: number): SavedQueryDTO[];
  getPinned(): SavedQueryDTO[];
  search(searchTerm: string): SavedQueryDTO[];
  getByFolder(folderId: string | null): SavedQueryDTO[];
  saveAll(queries: unknown): void;
  export(): string;
  import(json: string, overwrite?: boolean): { imported: number; skipped: number; errors: string[] };
  createTemplate(name?: string): SavedQueryDTO;
  clear(): void;
  getFolders(): SavedQueryFolderDTO[];
  saveFolder(folder: unknown): void;
  deleteFolder(folderId: string): void;
}

/** Structural interface for query explanation formatter. */
interface QueryExplainerLike {
  explainAsMarkdown(explanation: unknown): string;
}

/** Structural interface for query suggestion fix generator. */
interface SuggestedFixGeneratorLike {
  generateFixes(queryAST: unknown): SuggestedFixDTO[];
}

/** Structural interface for CSV export. */
interface CSVExporterLike {
  exportAndDownload(tasks: unknown[], filename?: string): void;
}

/** Structural interface for AI analysis engine. */
interface AIAnalyzerLike {
  analyzeTask(task: unknown, trigger: string): Array<Record<string, unknown>>;
}

/** Structural interface for task template persistence. */
interface TaskTemplateStoreLike {
  loadTaskTemplates(): Promise<TaskTemplateDTO[]> | TaskTemplateDTO[];
  saveTaskTemplate(template: unknown): void;
  deleteTaskTemplate(templateId: string): void;
}

/** Structural interface for frequency → RRule conversion. */
interface FrequencyConverterLike {
  previewConversion(task: unknown): unknown;
  updateTaskRecurrence(task: unknown, persist: boolean): unknown | null;
}

/** Structural interface for task grouping. */
interface GrouperLike {
  new (...args: unknown[]): unknown;
  [key: string]: unknown;
}

/** Structural interface for task model adapter. */
interface TaskModelAdapterLike {
  siyuanToUnified(task: unknown): unknown;
  unifiedToSiyuan(task: unknown): unknown;
}

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface UIQueryServiceDeps {
  taskStorage: TaskDataSource;
  pluginEventBus?: unknown;
  analyticsCalculator?: AnalyticsCalculatorLike;
  /** Natural-language date parsing provider. */
  dateParser?: DateParserLike;
  /** Human-readable recurrence rule parser/serializer. */
  recurrenceParser?: RecurrenceParserLike;
  /** File-level task replacer (block mutation). */
  fileReplacer?: FileReplacerLike;
  /** Query engine for NL query execution. */
  queryEngine?: QueryEngineLike;
  /** Saved query persistence store. */
  savedQueryStore?: SavedQueryStoreLike;
  /** Query explanation formatter. */
  queryExplainer?: QueryExplainerLike;
  /** Suggested fix generator. */
  suggestedFixGenerator?: SuggestedFixGeneratorLike;
  /** CSV exporter. */
  csvExporter?: CSVExporterLike;
  /** AI analysis engine. */
  aiAnalyzer?: AIAnalyzerLike;
  /** Task template persistence. */
  taskTemplateStore?: TaskTemplateStoreLike;
  /** Frequency converter. */
  frequencyConverter?: FrequencyConverterLike;
  /** Task grouper class. */
  grouperClass?: GrouperLike;
  /** Task model adapter. */
  taskModelAdapter?: TaskModelAdapterLike;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class UIQueryService {
  private taskStorage: TaskDataSource | null = null;
  private analyticsCalculator: AnalyticsCalculatorLike | null = null;
  private dateParser: DateParserLike | null = null;
  private recurrenceParser: RecurrenceParserLike | null = null;
  private fileReplacer: FileReplacerLike | null = null;
  private queryEngine: QueryEngineLike | null = null;
  private savedQueryStore: SavedQueryStoreLike | null = null;
  private queryExplainer: QueryExplainerLike | null = null;
  private suggestedFixGenerator: SuggestedFixGeneratorLike | null = null;
  private csvExporter: CSVExporterLike | null = null;
  private aiAnalyzer: AIAnalyzerLike | null = null;
  private taskTemplateStore: TaskTemplateStoreLike | null = null;
  private frequencyConverter: FrequencyConverterLike | null = null;
  private grouperClass: GrouperLike | null = null;
  private taskModelAdapter: TaskModelAdapterLike | null = null;

  /**
   * Connect to backend services.
   * Called from plugin index.ts after services are initialized.
   */
  connect(deps: UIQueryServiceDeps): void {
    this.taskStorage = deps.taskStorage;
    this.analyticsCalculator = deps.analyticsCalculator ?? null;
    this.dateParser = deps.dateParser ?? null;
    this.recurrenceParser = deps.recurrenceParser ?? null;
    this.fileReplacer = deps.fileReplacer ?? null;
    this.queryEngine = deps.queryEngine ?? null;
    this.savedQueryStore = deps.savedQueryStore ?? null;
    this.queryExplainer = deps.queryExplainer ?? null;
    this.suggestedFixGenerator = deps.suggestedFixGenerator ?? null;
    this.csvExporter = deps.csvExporter ?? null;
    this.aiAnalyzer = deps.aiAnalyzer ?? null;
    this.taskTemplateStore = deps.taskTemplateStore ?? null;
    this.frequencyConverter = deps.frequencyConverter ?? null;
    this.grouperClass = deps.grouperClass ?? null;
    this.taskModelAdapter = deps.taskModelAdapter ?? null;
  }

  /**
   * Disconnect from backend (plugin unload).
   */
  disconnect(): void {
    this.taskStorage = null;
    this.analyticsCalculator = null;
    this.dateParser = null;
    this.recurrenceParser = null;
    this.fileReplacer = null;
    this.queryEngine = null;
    this.savedQueryStore = null;
    this.queryExplainer = null;
    this.suggestedFixGenerator = null;
    this.csvExporter = null;
    this.aiAnalyzer = null;
    this.taskTemplateStore = null;
    this.frequencyConverter = null;
    this.grouperClass = null;
    this.taskModelAdapter = null;
  }

  // ── Query API (returns DTOs only) ──────────────────────────

  /**
   * Select all active tasks projected as TaskDTOs.
   * Primary entry point for dashboard rendering.
   */
  selectDashboard(): TaskDTO[] {
    const tasks = this.getAllTasks();
    return tasks.map((t) => this.mapTaskToDTO(t));
  }

  /**
   * Select tasks due within the next N hours.
   */
  selectUpcoming(hoursAhead: number = 24): TaskDTO[] {
    const tasks = this.getAllTasks();
    const now = Date.now();
    const cutoff = now + hoursAhead * 60 * 60 * 1000;

    return tasks
      .filter((t) => {
        if (!t.dueAt || t.status === "done" || t.status === "cancelled") return false;
        const dueMs = new Date(t.dueAt).getTime();
        return dueMs > now && dueMs <= cutoff;
      })
      .map((t) => this.mapTaskToDTO(t));
  }

  /**
   * Select overdue tasks.
   */
  selectOverdue(): TaskDTO[] {
    const tasks = this.getAllTasks();
    const now = Date.now();

    return tasks
      .filter((t) => {
        if (!t.dueAt || t.status === "done" || t.status === "cancelled") return false;
        return new Date(t.dueAt).getTime() < now;
      })
      .map((t) => this.mapTaskToDTO(t));
  }

  /**
   * Select tasks blocked by dependencies.
   */
  selectBlocked(): TaskDTO[] {
    const tasks = this.getAllTasks();
    return tasks
      .filter((t) => {
        if (!t.dependsOn || t.dependsOn.length === 0) return false;
        const allTasks = this.getAllTasks();
        return t.dependsOn.some((depId) => {
          const dep = allTasks.find((d) => d.id === depId);
          return dep && dep.status !== "done";
        });
      })
      .map((t) => this.mapTaskToDTO(t));
  }

  /**
   * Select tasks due today.
   */
  selectDueToday(): TaskDTO[] {
    const tasks = this.getAllTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrowMs = today.getTime() + 86_400_000;

    return tasks
      .filter((t) => {
        if (!t.dueAt) return false;
        const dueMs = new Date(t.dueAt).getTime();
        return dueMs >= today.getTime() && dueMs < tomorrowMs;
      })
      .map((t) => this.mapTaskToDTO(t));
  }

  /**
   * Select active and upcoming reminders.
   */
  selectReminders(): { active: ReminderDTO[]; upcoming: ReminderDTO[] } {
    const tasks = this.getAllTasks();
    const now = new Date();
    const nowMs = now.getTime();
    const tomorrowMs = nowMs + 24 * 60 * 60 * 1000;

    const active: ReminderDTO[] = [];
    const upcoming: ReminderDTO[] = [];

    for (const t of tasks) {
      if (!t.enabled || t.status === "done" || t.status === "cancelled") continue;
      if (!t.dueAt) continue;

      const dueMs = new Date(t.dueAt).getTime();
      const minutesUntilDue = (dueMs - nowMs) / 60_000;

      const dto: ReminderDTO = {
        taskId: t.id,
        name: t.name || "Untitled",
        dueAt: t.dueAt,
        priority: t.priority as string | undefined,
        isOverdue: dueMs <= nowMs,
        minutesUntilDue: Math.round(minutesUntilDue),
        recurrenceText: (t as any).recurrenceText ?? (t.recurrence ? "Recurring" : undefined),
        tags: t.tags as readonly string[] | undefined,
        blockId: t.blockId ?? (t as any).linkedBlockId,
        snoozeCount: (t as any).snoozeCount ?? 0,
        maxSnoozes: (t as any).maxSnoozes ?? 3,
      };

      if (dueMs <= nowMs) {
        active.push(dto);
      } else if (dueMs <= tomorrowMs) {
        upcoming.push(dto);
      }
    }

    // Sort: most overdue first for active, soonest first for upcoming
    active.sort((a, b) => a.minutesUntilDue - b.minutesUntilDue);
    upcoming.sort((a, b) => a.minutesUntilDue - b.minutesUntilDue);

    return { active, upcoming };
  }

  /**
   * Get analytics summary as DTO.
   */
  selectAnalytics(): AnalyticsDTO {
    const tasks = this.getAllTasks();

    if (this.analyticsCalculator) {
      try {
        const raw = this.analyticsCalculator.calculateTaskAnalytics(tasks);
        const breakdown = this.analyticsCalculator.getHealthBreakdown(tasks);
        return {
          totalTasks: (raw.totalTasks as number) ?? 0,
          activeTasks: (raw.activeTasks as number) ?? 0,
          disabledTasks: (raw.disabledTasks as number) ?? 0,
          completionRate: (raw.completionRate as number) ?? 0,
          missRate: (raw.missRate as number) ?? 0,
          totalCompletions: (raw.totalCompletions as number) ?? 0,
          totalMisses: (raw.totalMisses as number) ?? 0,
          bestCurrentStreak: (raw.bestCurrentStreak as number) ?? 0,
          bestOverallStreak: (raw.bestOverallStreak as number) ?? 0,
          overdueCount: (raw.overdueCount as number) ?? 0,
          dueTodayCount: (raw.dueTodayCount as number) ?? 0,
          dueThisWeekCount: (raw.dueThisWeekCount as number) ?? 0,
          averageHealth: (raw.averageHealth as number) ?? 0,
          healthBreakdown: breakdown,
        };
      } catch { /* fallthrough to manual calculation */ }
    }

    // Manual fallback analytics
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrowMs = today.getTime() + 86_400_000;
    const endOfWeekMs = today.getTime() + 7 * 86_400_000;

    const active = tasks.filter((t) => t.enabled !== false && t.status !== "done" && t.status !== "cancelled");
    const overdue = active.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < now);
    const dueToday = tasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() >= today.getTime() && new Date(t.dueAt).getTime() < tomorrowMs);
    const dueThisWeek = tasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() >= today.getTime() && new Date(t.dueAt).getTime() < endOfWeekMs);

    let totalCompletions = 0;
    let totalMisses = 0;
    let bestStreak = 0;
    let currentStreak = 0;
    for (const t of tasks) {
      totalCompletions += (t as any).completionCount ?? 0;
      totalMisses += (t as any).missCount ?? 0;
      const streak = (t as any).currentStreak ?? 0;
      if (streak > currentStreak) currentStreak = streak;
      const best = (t as any).bestStreak ?? 0;
      if (best > bestStreak) bestStreak = best;
    }

    const total = totalCompletions + totalMisses;
    return {
      totalTasks: tasks.length,
      activeTasks: active.length,
      disabledTasks: tasks.length - active.length,
      completionRate: total > 0 ? (totalCompletions / total) * 100 : 0,
      missRate: total > 0 ? (totalMisses / total) * 100 : 0,
      totalCompletions,
      totalMisses,
      bestCurrentStreak: currentStreak,
      bestOverallStreak: bestStreak,
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      dueThisWeekCount: dueThisWeek.length,
      averageHealth: total > 0 ? Math.round((totalCompletions / total) * 100) : 100,
      healthBreakdown: { healthy: 0, moderate: 0, struggling: 0 },
    };
  }

  /**
   * Get a single task by ID as DTO.
   */
  selectById(taskId: string): TaskDTO | undefined {
    const tasks = this.getAllTasks();
    const task = tasks.find((t) => t.id === taskId);
    return task ? this.mapTaskToDTO(task) : undefined;
  }

  /**
   * Select tasks within a date range (for calendar views).
   */
  selectInRange(start: Date, end: Date): TaskDTO[] {
    const tasks = this.getAllTasks();
    const startMs = start.getTime();
    const endMs = end.getTime();

    return tasks
      .filter((t) => {
        if (!t.dueAt) return false;
        const dueMs = new Date(t.dueAt).getTime();
        return dueMs >= startMs && dueMs <= endMs;
      })
      .map((t) => this.mapTaskToDTO(t));
  }

  /**
   * Get dependency info for a task as DTOs.
   */
  selectDependencies(taskId: string): DependencyDTO[] {
    const tasks = this.getAllTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.dependsOn || task.dependsOn.length === 0) return [];

    return task.dependsOn.map((depId) => {
      const dep = tasks.find((t) => t.id === depId);
      return {
        id: `dep_${taskId}_${depId}`,
        sourceTaskId: taskId,
        sourceTaskName: task.name || "Unknown",
        targetTaskId: depId,
        targetTaskName: dep?.name || "Unknown",
        isSatisfied: dep ? dep.status === "done" : false,
        isBlocked: dep ? dep.status !== "done" : true,
        type: "dependsOn",
      };
    });
  }

  // ── Natural-Language Query API ─────────────────────────────
  //
  // Delegates to injected queryEngine — NEVER imports backend modules.

  /**
   * Execute a natural-language query string and return matching TaskDTOs.
   * Routes through the injected QueryEngineLike provider.
   */
  async executeQuery(
    queryString: string,
    settingsOverride?: Record<string, unknown>
  ): Promise<TaskDTO[]> {
    if (!this.queryEngine) {
      console.warn("[UIQueryService] executeQuery: queryEngine not connected — returning all tasks");
      return this.selectDashboard();
    }

    const tasks = this.getAllTasks();
    const result = this.queryEngine.executeQuery(queryString, tasks, settingsOverride);
    return (result.tasks || []).map((t) => this.mapTaskToDTO(t));
  }

  /**
   * Execute a query AND return a human-readable explanation DTO.
   */
  async executeQueryWithExplanation(
    queryString: string,
    settingsOverride?: Record<string, unknown>
  ): Promise<{ results: TaskDTO[]; explanation: unknown }> {
    if (!this.queryEngine) {
      console.warn("[UIQueryService] executeQueryWithExplanation: queryEngine not connected");
      return { results: this.selectDashboard(), explanation: null };
    }

    const tasks = this.getAllTasks();
    const { result, explanation } = this.queryEngine.executeQueryWithExplanation(queryString, tasks, settingsOverride);
    return {
      results: (result.tasks || []).map((t) => this.mapTaskToDTO(t)),
      explanation,
    };
  }

  // ── Private Helpers ──────────────────────────────────────────

  private getAllTasks(): RawTaskShape[] {
    if (!this.taskStorage) return [];
    return this.taskStorage.getAllTasks();
  }

  /**
   * Map a backend task shape to a TaskDTO.
   * This is the SINGLE projection point — all domain knowledge
   * is encapsulated here.
   */
  private mapTaskToDTO(task: RawTaskShape): TaskDTO {
    const now = Date.now();
    const dueMs = task.dueAt ? new Date(task.dueAt).getTime() : undefined;
    const isOverdue = !!dueMs && dueMs < now && task.status !== "done" && task.status !== "cancelled";

    // Dependency blocked check
    const allTasks = this.getAllTasks();
    let isBlocked = false;
    if (task.dependsOn && task.dependsOn.length > 0) {
      isBlocked = task.dependsOn.some((depId) => {
        const dep = allTasks.find((d) => d.id === depId);
        return dep && dep.status !== "done";
      });
    }

    // Derive lifecycle state
    let lifecycleState = "idle";
    if (task.status === "done") lifecycleState = "completed";
    else if (task.status === "cancelled") lifecycleState = "cancelled";
    else if (isBlocked) lifecycleState = "blocked";
    else if (isOverdue) lifecycleState = "overdue";
    else if (dueMs && dueMs - now < 60 * 60 * 1000) lifecycleState = "due"; // within 1 hour

    const completionCount = (task as any).completionCount ?? 0;
    const missCount = (task as any).missCount ?? 0;
    const total = completionCount + missCount;

    return {
      id: task.id,
      name: task.name || "",
      status: task.status || "todo",
      lifecycleState,
      enabled: task.enabled !== false,
      dueAt: task.dueAt,
      scheduledAt: (task as any).scheduledAt,
      doneAt: (task as any).doneAt,
      priority: task.priority as string | undefined,
      tags: task.tags as readonly string[] | undefined,
      category: task.category as string | undefined,
      description: task.description as string | undefined,
      order: (task as any).order,
      isRecurring: !!(task.recurrence || (task as any).recurrenceText || (task as any).frequency),
      isBlocked,
      isOverdue,
      completionCount,
      missCount,
      currentStreak: (task as any).currentStreak ?? 0,
      healthScore: total > 0 ? Math.round((completionCount / total) * 100) : 100,
      blockId: task.blockId ?? (task as any).linkedBlockId,
      path: (task as any).path,
      heading: (task as any).heading,
      recurrenceText: (task as any).recurrenceText,
      seriesId: (task as any).seriesId,
      occurrenceIndex: (task as any).occurrenceIndex,
      statusSymbol: (task as any).statusSymbol,
    };
  }

  // ── Saved Query Facade ───────────────────────────────────────
  //
  // Routes through injected savedQueryStore — NEVER imports backend.

  /** Load all saved queries as DTOs. */
  async selectSavedQueries(): Promise<SavedQueryDTO[]> {
    if (!this.savedQueryStore) return [];
    return this.savedQueryStore.load();
  }

  /** Get a single saved query by ID. */
  async selectSavedQueryById(queryId: string): Promise<SavedQueryDTO | null> {
    if (!this.savedQueryStore) return null;
    return this.savedQueryStore.get(queryId);
  }

  /** Save (create or update) a saved query. */
  async saveSavedQuery(query: SavedQueryDTO): Promise<void> {
    if (!this.savedQueryStore) return;
    this.savedQueryStore.save(query);
  }

  /** Partially update a saved query. */
  async updateSavedQuery(queryId: string, updates: Partial<SavedQueryDTO>): Promise<void> {
    if (!this.savedQueryStore) return;
    this.savedQueryStore.update(queryId, updates);
  }

  /** Delete a saved query. */
  async deleteSavedQuery(queryId: string): Promise<void> {
    if (!this.savedQueryStore) return;
    this.savedQueryStore.delete(queryId);
  }

  /** Record a query use (increments count). */
  async recordQueryUse(queryId: string): Promise<void> {
    if (!this.savedQueryStore) return;
    this.savedQueryStore.recordUse(queryId);
  }

  /** Duplicate a saved query. */
  async duplicateSavedQuery(queryId: string): Promise<SavedQueryDTO | null> {
    if (!this.savedQueryStore) return null;
    return this.savedQueryStore.duplicate(queryId);
  }

  /** Get saved query statistics. */
  async selectSavedQueryStats(): Promise<SavedQueryStatsDTO> {
    if (!this.savedQueryStore) return { totalQueries: 0, totalFolders: 0, totalUses: 0, averageUsesPerQuery: 0, oldestQuery: null, newestQuery: null };
    return this.savedQueryStore.getStats();
  }

  /** Get most-used saved queries. */
  async selectMostUsedQueries(limit: number = 5): Promise<SavedQueryDTO[]> {
    if (!this.savedQueryStore) return [];
    return this.savedQueryStore.getMostUsed(limit);
  }

  /** Get recently-used saved queries. */
  async selectRecentlyUsedQueries(limit: number = 5): Promise<SavedQueryDTO[]> {
    if (!this.savedQueryStore) return [];
    return this.savedQueryStore.getRecentlyUsed(limit);
  }

  /** Get pinned saved queries. */
  async selectPinnedQueries(): Promise<SavedQueryDTO[]> {
    if (!this.savedQueryStore) return [];
    return this.savedQueryStore.getPinned();
  }

  /** Search saved queries by term. */
  async searchSavedQueries(searchTerm: string): Promise<SavedQueryDTO[]> {
    if (!this.savedQueryStore) return [];
    return this.savedQueryStore.search(searchTerm);
  }

  /** Get queries in a specific folder. */
  async selectQueriesByFolder(folderId: string | null): Promise<SavedQueryDTO[]> {
    if (!this.savedQueryStore) return [];
    return this.savedQueryStore.getByFolder(folderId);
  }

  /** Batch update multiple saved queries. */
  async saveAllQueries(queries: SavedQueryDTO[]): Promise<void> {
    if (!this.savedQueryStore) return;
    this.savedQueryStore.saveAll(queries);
  }

  /** Export saved queries as JSON string. */
  async exportSavedQueries(): Promise<string> {
    if (!this.savedQueryStore) return "[]";
    return this.savedQueryStore.export();
  }

  /** Import saved queries from JSON string. */
  async importSavedQueries(json: string, overwrite?: boolean): Promise<{ imported: number; skipped: number; errors: string[] }> {
    if (!this.savedQueryStore) return { imported: 0, skipped: 0, errors: ["SavedQueryStore not connected"] };
    return this.savedQueryStore.import(json, overwrite);
  }

  /** Create a new empty query template object. */
  async createSavedQueryTemplate(name?: string): Promise<SavedQueryDTO> {
    if (!this.savedQueryStore) {
      return { id: "", name: name ?? "", queryString: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
    return this.savedQueryStore.createTemplate(name);
  }

  /** Clear all saved queries. */
  async clearSavedQueries(): Promise<void> {
    if (!this.savedQueryStore) return;
    this.savedQueryStore.clear();
  }

  // ── Saved Query Folder Facade ────────────────────────────────

  /** Get all folders. */
  async selectSavedQueryFolders(): Promise<SavedQueryFolderDTO[]> {
    if (!this.savedQueryStore) return [];
    return this.savedQueryStore.getFolders();
  }

  /** Save (create or update) a folder. */
  async saveSavedQueryFolder(folder: SavedQueryFolderDTO): Promise<void> {
    if (!this.savedQueryStore) return;
    this.savedQueryStore.saveFolder(folder);
  }

  /** Delete a folder (moves queries to root). */
  async deleteSavedQueryFolder(folderId: string): Promise<void> {
    if (!this.savedQueryStore) return;
    this.savedQueryStore.deleteFolder(folderId);
  }

  // ── Query Explanation Facade ─────────────────────────────────

  /** Convert an Explanation into markdown string. */
  async explainAsMarkdown(explanation: unknown): Promise<string> {
    if (!this.queryExplainer) return "";
    return this.queryExplainer.explainAsMarkdown(explanation);
  }

  // ── Suggested Fix Facade ─────────────────────────────────────

  /** Generate suggested fixes for a query AST. */
  async generateSuggestedFixes(queryAST: unknown): Promise<SuggestedFixDTO[]> {
    if (!this.suggestedFixGenerator) return [];
    return this.suggestedFixGenerator.generateFixes(queryAST);
  }

  // ── CSV Export Facade ────────────────────────────────────────

  /** Export task data as CSV and trigger download. */
  async exportTasksAsCSV(tasks: TaskDTO[], filename?: string): Promise<void> {
    if (!this.csvExporter) {
      console.warn("[UIQueryService] exportTasksAsCSV: csvExporter not connected");
      return;
    }
    this.csvExporter.exportAndDownload(tasks, filename);
  }

  // ── AI Analysis Facade ───────────────────────────────────────
  //
  // Routes through injected aiAnalyzer — NEVER imports backend.

  /** On-demand AI analysis for a single task (manual trigger). */
  async requestAIAnalysis(task: TaskDTO, trigger: string = "manual"): Promise<SuggestionDTO[]> {
    if (!this.aiAnalyzer) {
      console.warn("[UIQueryService] requestAIAnalysis: aiAnalyzer not connected");
      return [];
    }

    const suggestions = this.aiAnalyzer.analyzeTask(task, trigger);
    return suggestions.map((s: Record<string, unknown>) => ({
      id: (s.id as string) ?? `sug_${Math.random().toString(36).slice(2, 9)}`,
      taskId: task.id,
      type: (s.type as string) ?? "general",
      reason: (s.reason as string) ?? (s.description as string) ?? "",
      confidence: (s.confidence as number) ?? 0,
      dismissed: false,
      action: {
        type: ((s.action as any)?.type as string) ?? "none",
        label: ((s.action as any)?.label as string) ?? ((s.action as any)?.description as string) ?? "No action",
        parameters: ((s.action as any)?.parameters as Record<string, unknown>) ?? {},
      },
    }));
  }

  /** Check if a task has enough AI data for analysis. */
  hasAIData(task: TaskDTO): boolean {
    return (task.completionCount ?? 0) > 0 || (task.missCount ?? 0) > 0;
  }

  // ── Task Template Facade ─────────────────────────────────────

  /** Load all task templates. */
  async selectTaskTemplates(): Promise<TaskTemplateDTO[]> {
    if (!this.taskTemplateStore) return [];
    const result = this.taskTemplateStore.loadTaskTemplates();
    return result instanceof Promise ? await result : result;
  }

  /** Save a task template. */
  async saveTaskTemplate(template: TaskTemplateDTO): Promise<void> {
    if (!this.taskTemplateStore) return;
    this.taskTemplateStore.saveTaskTemplate(template);
  }

  /** Delete a task template by ID. */
  async deleteTaskTemplate(templateId: string): Promise<void> {
    if (!this.taskTemplateStore) return;
    this.taskTemplateStore.deleteTaskTemplate(templateId);
  }

  // ── Recurrence Conversion Facade ─────────────────────────────

  /** Preview a legacy frequency → RRule conversion. */
  async previewRecurrenceConversion(task: TaskDTO): Promise<unknown> {
    if (!this.frequencyConverter) return null;
    return this.frequencyConverter.previewConversion(task);
  }

  /** Upgrade a task from legacy frequency to RRule. */
  async upgradeTaskRecurrence(task: TaskDTO): Promise<TaskDTO | null> {
    if (!this.frequencyConverter) return null;
    const migrated = this.frequencyConverter.updateTaskRecurrence(task, true);
    return migrated ? this.mapTaskToDTO(migrated as RawTaskShape) : null;
  }

  // ── File Replacement Facade ──────────────────────────────────

  /**
   * Replace one task with zero or more new tasks (file-level).
   * Delegates to injected fileReplacer (no direct backend import).
   */
  async replaceTaskInFile(originalTask: TaskDTO, newTasks: TaskDTO | TaskDTO[]): Promise<void> {
    if (!this.fileReplacer) {
      console.warn("[UIQueryService] replaceTaskInFile: not connected");
      return;
    }
    await this.fileReplacer.replaceTaskWithTasks({
      originalTask: originalTask as unknown,
      newTasks: newTasks as unknown,
    });
  }

  // ── Grouper Facade ───────────────────────────────────────────

  /** Get the Grouper class (injected). */
  async getGrouperClass(): Promise<any> {
    if (!this.grouperClass) {
      console.warn("[UIQueryService] getGrouperClass: grouperClass not connected");
      return null;
    }
    return this.grouperClass;
  }

  // ── Form Utility Facades ─────────────────────────────────────
  //
  // Delegates to injected structural providers — never imports @domain.

  /** Parse a natural language date string. */
  async parseNaturalDate(input: string, referenceDate?: Date): Promise<Date | null> {
    if (!this.dateParser) return null;
    return this.dateParser.parseNaturalLanguageDate(input, referenceDate);
  }

  /** Convert a Date to ISO date string (YYYY-MM-DD). */
  async toISODate(date: Date): Promise<string> {
    if (this.dateParser) return this.dateParser.toISODateString(date);
    // Inline fallback — pure formatting, no domain dependency.
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /** Parse a recurrence rule string (e.g. "every 2 weeks"). */
  async parseRecurrenceRule(ruleString: string): Promise<unknown> {
    if (!this.recurrenceParser) return null;
    return this.recurrenceParser.parseRecurrenceRule(ruleString);
  }

  /** Serialize a recurrence rule to human-readable string. */
  async serializeRecurrenceRule(rule: unknown): Promise<string> {
    if (!this.recurrenceParser) return "";
    return this.recurrenceParser.serializeRecurrenceRule(rule);
  }

  // ── Task Model Adapter Facade ────────────────────────────────
  //
  // Routes through injected taskModelAdapter — NEVER imports backend.

  /** Convert an adapter-compatible task to unified format. */
  async toUnifiedTask(task: TaskDTO): Promise<unknown> {
    if (!this.taskModelAdapter) {
      console.warn("[UIQueryService] toUnifiedTask: taskModelAdapter not connected");
      return task;
    }
    return this.taskModelAdapter.siyuanToUnified(task);
  }

  /** Convert a unified task back to SiYuan format. */
  async fromUnifiedTask(unifiedTask: unknown): Promise<TaskDTO> {
    if (!this.taskModelAdapter) {
      console.warn("[UIQueryService] fromUnifiedTask: taskModelAdapter not connected");
      return unifiedTask as TaskDTO;
    }
    const siyuan = this.taskModelAdapter.unifiedToSiyuan(unifiedTask);
    return this.mapTaskToDTO(siyuan as RawTaskShape);
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const uiQueryService = new UIQueryService();
