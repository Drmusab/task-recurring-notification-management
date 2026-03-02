/**
 * TaskStore — Reactive Frontend Store (§8)
 *
 * Consumes TaskDTO objects (never DomainTask) and provides
 * Svelte 5 reactive state for UI components.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Consumes TaskDTO only (from QueryEngine via DomainMapper)
 *   ✔ Subscribes to EventBus for cache invalidation
 *   ✔ Exposes $state / $derived compatible reactive arrays
 *   ❌ No domain imports (except types)
 *   ❌ No SiYuan API calls
 *   ❌ No task mutations (delegate to TaskService)
 */

import type { TaskDTO } from "@domain/DomainMapper";
import { eventBus } from "@events/EventBus";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type SortField = "dueAt" | "priority" | "name" | "status" | "createdAt";
export type SortDirection = "asc" | "desc";
export type FilterStatus = "all" | "todo" | "done" | "overdue" | "cancelled";

export interface TaskStoreFilters {
  status: FilterStatus;
  search: string;
  tags: string[];
  category: string;
  sortBy: SortField;
  sortDir: SortDirection;
}

export interface DashboardSummary {
  total: number;
  due: number;
  overdue: number;
  completed: number;
  blocked: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

/**
 * Reactive task store for Svelte 5 frontend.
 *
 * Usage in Svelte component:
 * ```svelte
 * <script>
 * import { taskStore } from '@stores/TaskStore';
 * const { tasks, summary } = taskStore;
 * </script>
 * {#each tasks as task}
 *   <TaskCard {task} />
 * {/each}
 * ```
 */
export class TaskStore {
  /** All tasks currently in the store */
  tasks: TaskDTO[] = [];

  /** Current filter state */
  filters: TaskStoreFilters = {
    status: "all",
    search: "",
    tags: [],
    category: "",
    sortBy: "dueAt",
    sortDir: "asc",
  };

  /** Dashboard summary (computed from tasks) */
  summary: DashboardSummary = {
    total: 0,
    due: 0,
    overdue: 0,
    completed: 0,
    blocked: 0,
  };

  /** Loading state */
  loading = false;

  /** Error state */
  error: string | null = null;

  private unsubscribers: Array<() => void> = [];
  private refreshCallback: (() => Promise<TaskDTO[]>) | null = null;

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Initialize the store with a data loader and start listening.
   */
  start(refreshCallback: () => Promise<TaskDTO[]>): void {
    this.refreshCallback = refreshCallback;

    // Subscribe to invalidation events
    this.unsubscribers.push(
      eventBus.on("task:runtime:created", () => void this.refresh()),
      eventBus.on("task:runtime:completed", () => void this.refresh()),
      eventBus.on("task:runtime:rescheduled", () => void this.refresh()),
      eventBus.on("task:runtime:deleted", () => void this.refresh()),
      eventBus.on("task:runtime:recurrenceGenerated", () => void this.refresh()),
      eventBus.on("plugin:storage:reload", () => void this.refresh()),
    );

    // Initial load
    void this.refresh();
  }

  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.refreshCallback = null;
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Refresh all tasks from the data source.
   */
  async refresh(): Promise<void> {
    if (!this.refreshCallback) return;

    this.loading = true;
    this.error = null;

    try {
      const allTasks = await this.refreshCallback();
      this.tasks = allTasks;
      this.recomputeSummary();
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load tasks";
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get filtered and sorted tasks.
   */
  getFiltered(): TaskDTO[] {
    let result = [...this.tasks];

    // Apply status filter
    if (this.filters.status !== "all") {
      result = result.filter((t) => t.status === this.filters.status);
    }

    // Apply search filter
    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q),
      );
    }

    // Apply tag filter
    if (this.filters.tags.length > 0) {
      result = result.filter((t) =>
        this.filters.tags.some((tag) => t.tags?.includes(tag)),
      );
    }

    // Apply category filter
    if (this.filters.category) {
      result = result.filter((t) => t.category === this.filters.category);
    }

    // Sort
    result.sort((a, b) => {
      const dir = this.filters.sortDir === "asc" ? 1 : -1;
      const aVal = (a as unknown as Record<string, unknown>)[this.filters.sortBy];
      const bVal = (b as unknown as Record<string, unknown>)[this.filters.sortBy];
      if (aVal === bVal) return 0;
      if (aVal == null) return dir;
      if (bVal == null) return -dir;
      return aVal < bVal ? -dir : dir;
    });

    return result;
  }

  /**
   * Update filters and trigger re-render.
   */
  setFilters(partial: Partial<TaskStoreFilters>): void {
    this.filters = { ...this.filters, ...partial };
  }

  // ── Internal ─────────────────────────────────────────────────

  private recomputeSummary(): void {
    const now = new Date();
    this.summary = {
      total: this.tasks.length,
      due: this.tasks.filter(
        (t) => t.status === "todo" && t.dueAt && new Date(t.dueAt) <= now,
      ).length,
      overdue: this.tasks.filter(
        (t) =>
          t.status === "todo" &&
          t.dueAt &&
          new Date(t.dueAt) < new Date(now.getTime() - 60 * 60 * 1000),
      ).length,
      completed: this.tasks.filter((t) => t.status === "done").length,
      blocked: 0, // TODO: integrate with dependency graph
    };
  }
}

/** Singleton store instance */
export const taskStore = new TaskStore();
