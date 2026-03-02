/**
 * QueryEngine — Read-Only Data Access (§4.1)
 *
 * Provides a clean read interface to the Cache layer. Applies filters,
 * sorting, and pagination without ever touching storage directly.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Read ONLY from Cache, never from TaskStorage
 *   ✔ Validate block existence before returning results
 *   ✔ Exclude completed tasks from due queries
 *   ✔ Exclude blocked tasks from execution queries
 *   ✔ Resolve latest recurrence instance automatically
 *   ❌ No mutations
 *   ❌ No direct TaskStorage read access
 *   ❌ No SiYuan API calls
 */

import type { DomainTask } from "@domain/DomainTask";
import { isTerminal, isOverdue, isDependencyBlocked } from "@domain/DomainTask";
import type { TaskCache } from "@cache/TaskCache";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface QueryEngineOptions {
  /** Include completed/cancelled tasks */
  includeTerminal?: boolean;
  /** Include blocked tasks */
  includeBlocked?: boolean;
  /** Filter by tags */
  tags?: readonly string[];
  /** Filter by priority */
  priority?: string;
  /** Filter by category */
  category?: string;
  /** Sort field */
  sortBy?: "dueAt" | "priority" | "name" | "createdAt" | "updatedAt";
  /** Sort direction */
  sortDirection?: "asc" | "desc";
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface QueryResult {
  readonly tasks: readonly DomainTask[];
  readonly total: number;
  readonly filtered: number;
}

// ──────────────────────────────────────────────────────────────
// Priority Weight Map (for sorting)
// ──────────────────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<string, number> = {
  highest: 6,
  high: 5,
  medium: 4,
  normal: 3,
  low: 2,
  lowest: 1,
};

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

/**
 * Read-only query engine that reads from the TaskCache.
 *
 * Usage:
 * ```ts
 * const engine = new QueryEngine(cache);
 * const dueTasks = engine.selectDue();
 * const task = engine.selectById("task-123");
 * ```
 */
export class QueryEngine {
  constructor(private readonly cache: TaskCache) {}

  // ──────────────────────────────────────────────────────────
  // Specialized Queries
  // ──────────────────────────────────────────────────────────

  /**
   * Select all tasks that are currently due or overdue.
   *
   * Excludes:
   *   - Completed/cancelled tasks
   *   - Blocked tasks (dependency-gated)
   */
  selectDue(refDate: Date = new Date()): readonly DomainTask[] {
    return this.cache
      .getAll()
      .filter((task) => !isTerminal(task))
      .filter((task) => !isDependencyBlocked(task))
      .filter((task) => this.isDueOrOverdue(task, refDate));
  }

  /**
   * Select all overdue tasks.
   */
  selectOverdue(refDate: Date = new Date()): readonly DomainTask[] {
    return this.cache
      .getAll()
      .filter((task) => !isTerminal(task))
      .filter((task) => isOverdue(task, refDate));
  }

  /**
   * Select tasks due today.
   */
  selectDueToday(refDate: Date = new Date()): readonly DomainTask[] {
    const todayStart = new Date(refDate);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(refDate);
    todayEnd.setHours(23, 59, 59, 999);

    return this.cache
      .getAll()
      .filter((task) => !isTerminal(task))
      .filter((task) => {
        if (!task.dueAt) return false;
        const due = new Date(task.dueAt);
        return due >= todayStart && due <= todayEnd;
      });
  }

  /**
   * Select upcoming tasks (due within N days).
   */
  selectUpcoming(
    days: number = 7,
    refDate: Date = new Date(),
  ): readonly DomainTask[] {
    const futureLimit = new Date(refDate);
    futureLimit.setDate(futureLimit.getDate() + days);

    return this.cache
      .getAll()
      .filter((task) => !isTerminal(task))
      .filter((task) => {
        if (!task.dueAt) return false;
        const due = new Date(task.dueAt);
        return due > refDate && due <= futureLimit;
      })
      .sort((a, b) => {
        const aDate = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const bDate = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        return aDate - bDate;
      });
  }

  /**
   * Select blocked tasks (dependency-gated).
   */
  selectBlocked(): readonly DomainTask[] {
    return this.cache
      .getAll()
      .filter((task) => !isTerminal(task))
      .filter((task) => isDependencyBlocked(task));
  }

  // ──────────────────────────────────────────────────────────
  // Single-Item Queries
  // ──────────────────────────────────────────────────────────

  /**
   * Get a task by its domain ID.
   */
  selectById(id: string): DomainTask | null {
    return this.cache.getById(id);
  }

  /**
   * Get a task by its SiYuan block ID.
   */
  selectByBlockId(blockId: string): DomainTask | null {
    return this.cache.getByBlockId(blockId);
  }

  // ──────────────────────────────────────────────────────────
  // Filtered Query
  // ──────────────────────────────────────────────────────────

  /**
   * Execute a filtered, sorted, paginated query.
   */
  query(options: QueryEngineOptions = {}): QueryResult {
    let tasks = Array.from(this.cache.getAll());
    const total = tasks.length;

    // Filter: terminal
    if (!options.includeTerminal) {
      tasks = tasks.filter((t) => !isTerminal(t));
    }

    // Filter: blocked
    if (!options.includeBlocked) {
      tasks = tasks.filter((t) => !isDependencyBlocked(t));
    }

    // Filter: tags
    if (options.tags && options.tags.length > 0) {
      const tagSet = new Set(options.tags);
      tasks = tasks.filter((t) =>
        t.tags?.some((tag) => tagSet.has(tag)),
      );
    }

    // Filter: priority
    if (options.priority) {
      tasks = tasks.filter((t) => t.priority === options.priority);
    }

    // Filter: category
    if (options.category) {
      tasks = tasks.filter((t) => t.category === options.category);
    }

    // Sort
    if (options.sortBy) {
      const dir = options.sortDirection === "desc" ? -1 : 1;
      tasks.sort((a, b) => {
        const cmp = this.compareByField(a, b, options.sortBy!);
        return cmp * dir;
      });
    }

    const filtered = tasks.length;

    // Pagination
    if (options.offset !== undefined && options.offset > 0) {
      tasks = tasks.slice(options.offset);
    }
    if (options.limit !== undefined && options.limit > 0) {
      tasks = tasks.slice(0, options.limit);
    }

    return { tasks, total, filtered };
  }

  // ──────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────

  private isDueOrOverdue(task: DomainTask, refDate: Date): boolean {
    if (!task.dueAt) return false;
    return new Date(task.dueAt) <= refDate;
  }

  private compareByField(
    a: DomainTask,
    b: DomainTask,
    field: string,
  ): number {
    switch (field) {
      case "dueAt": {
        const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        return aTime - bTime;
      }
      case "priority": {
        const aWeight = PRIORITY_WEIGHT[a.priority ?? "normal"] ?? 3;
        const bWeight = PRIORITY_WEIGHT[b.priority ?? "normal"] ?? 3;
        return bWeight - aWeight; // Higher priority first
      }
      case "name":
        return a.name.localeCompare(b.name);
      case "createdAt":
        return (a.createdAt as string).localeCompare(b.createdAt as string);
      case "updatedAt":
        return (a.updatedAt as string).localeCompare(b.updatedAt as string);
      default:
        return 0;
    }
  }
}
