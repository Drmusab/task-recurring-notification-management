/**
 * RecurrencePreviewService - Pre-compute task occurrences for calendar views
 * 
 * Efficiently generates occurrences for recurring tasks over date ranges,
 * with intelligent caching to support fast calendar rendering.
 * 
 * Phase 3: Calendar View
 * 
 * @module RecurrencePreviewService
 */

import { RecurrenceEngine } from "../recurrence/RecurrenceEngine";
import type { Task } from "../models/Task";

// Priority weights for sorting (higher value = higher priority)
const PRIORITY_WEIGHTS: Record<string,number> = {
  highest: 5,
  high: 4,
  normal: 3,
  medium: 2,
  low: 1,
  lowest: 0,
};

interface OccurrenceCache {
  /** Map of dateKey (YYYY-MM-DD) to task IDs */
  occurrencesByDate: Map<string, Set<string>>;
  /** Map of task ID to occurrence dates */
  occurrencesByTask: Map<string, Set<string>>;
  /** Timestamp when cache was generated */
  generatedAt: number;
  /** Month key (YYYY-MM) this cache covers */
  monthKey: string;
}

interface MonthOccurrences {
  /** Map of dateKey to tasks that occur on that date */
  tasksByDate: Map<string, Task[]>;
  /** Total number of occurrences */
  totalOccurrences: number;
  /** Number of unique tasks */
  uniqueTasks: number;
}

/**
 * Service for pre-computing and caching task occurrences
 */
export class RecurrencePreviewService {
  private cache: Map<string, OccurrenceCache> = new Map();
  private readonly MAX_CACHE_SIZE = 12; // Cache up to 12 months
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // RecurrenceEngine uses static methods, no instance needed
  }

  /**
   * Get all task occurrences for a specific month
   * 
   * @param yearMonth - Month in YYYY-MM format (e.g., "2024-01")
   * @param tasks - All tasks to check for occurrences
   * @returns Map of dateKey to tasks occurring on that date
   */
  getOccurrencesForMonth(yearMonth: string, tasks: Task[]): MonthOccurrences {
    const cached = this.getCachedOccurrences(yearMonth);
    
    if (cached) {
      // Build result from cache
      return this.buildMonthOccurrences(yearMonth, tasks, cached);
    }

    // Generate new occurrences
    const occurrenceCache = this.generateOccurrences(yearMonth, tasks);
    this.cache.set(yearMonth, occurrenceCache);
    this.evictOldCaches();

    return this.buildMonthOccurrences(yearMonth, tasks, occurrenceCache);
  }

  /**
   * Pre-cache occurrences for multiple months (current + adjacent)
   * 
   * @param centerMonth - Center month in YYYY-MM format
   * @param tasks - All tasks
   * @param adjacentMonths - Number of months before/after to cache (default: 1)
   */
  precacheMonths(centerMonth: string, tasks: Task[], adjacentMonths: number = 1): void {
    const parts = centerMonth.split('-');
    const year = parseInt(parts[0] || '2024', 10);
    const month = parseInt(parts[1] || '1', 10);
    
    // Cache center month
    this.getOccurrencesForMonth(centerMonth, tasks);

    // Cache adjacent months
    for (let offset = -adjacentMonths; offset <= adjacentMonths; offset++) {
      if (offset === 0) continue;
      
      const targetDate = new Date(year, month - 1 + offset, 1);
      const targetMonth = this.formatYearMonth(targetDate);
      this.getOccurrencesForMonth(targetMonth, tasks);
    }
  }

  /**
   * Invalidate cache for specific tasks (called on task update)
   * 
   * @param taskIds - IDs of tasks that were updated
   */
  invalidateForTasks(taskIds: string[]): void {
    const taskIdSet = new Set(taskIds);

    for (const [monthKey, cache] of this.cache.entries()) {
      let needsRegeneration = false;

      // Check if any cached task was updated
      for (const taskId of cache.occurrencesByTask.keys()) {
        if (taskIdSet.has(taskId)) {
          needsRegeneration = true;
          break;
        }
      }

      if (needsRegeneration) {
        this.cache.delete(monthKey);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    cachedMonths: number;
    totalOccurrences: number;
    oldestCache: string | null;
    newestCache: string | null;
  } {
    let totalOccurrences = 0;
    let oldestCache: string | null = null;
    let newestCache: string | null = null;
    let oldestTime = Infinity;
    let newestTime = 0;

    for (const [monthKey, cache] of this.cache.entries()) {
      totalOccurrences += cache.occurrencesByDate.size;

      if (cache.generatedAt < oldestTime) {
        oldestTime = cache.generatedAt;
        oldestCache = monthKey;
      }

      if (cache.generatedAt > newestTime) {
        newestTime = cache.generatedAt;
        newestCache = monthKey;
      }
    }

    return {
      cachedMonths: this.cache.size,
      totalOccurrences,
      oldestCache,
      newestCache,
    };
  }

  /**
   * Generate occurrences for a month
   */
  private generateOccurrences(yearMonth: string, tasks: Task[]): OccurrenceCache {
    const parts = yearMonth.split('-');
    const year = parseInt(parts[0] || '2024', 10);
    const month = parseInt(parts[1] || '1', 10);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month

    const occurrencesByDate = new Map<string, Set<string>>();
    const occurrencesByTask = new Map<string, Set<string>>();

    for (const task of tasks) {
      const occurrences: Date[] = [];

      // Get recurrence occurrences if task is recurring
      if (task.recurrence) {
        const recurrenceOccurrences = RecurrenceEngine.getOccurrences(
          task.recurrence,
          startDate,
          endDate
        );
        occurrences.push(...recurrenceOccurrences);
      }

      // Check if task has a single due date in this month
      if (task.dueAt && occurrences.length === 0) {
        const dueDate = new Date(task.dueAt);
        if (this.isDateInMonth(dueDate, year, month)) {
          occurrences.push(dueDate);
        }
      }

      // Store occurrences
      if (occurrences.length > 0) {
        const taskOccurrences = new Set<string>();

        for (const occurrence of occurrences) {
          const dateKey = this.formatDateKey(occurrence);
          
          // Add to date index
          if (!occurrencesByDate.has(dateKey)) {
            occurrencesByDate.set(dateKey, new Set());
          }
          occurrencesByDate.get(dateKey)!.add(task.id);

          // Add to task index
          taskOccurrences.add(dateKey);
        }

        occurrencesByTask.set(task.id, taskOccurrences);
      }
    }

    return {
      occurrencesByDate,
      occurrencesByTask,
      generatedAt: Date.now(),
      monthKey: yearMonth,
    };
  }

  /**
   * Build MonthOccurrences from cache
   */
  private buildMonthOccurrences(
    yearMonth: string,
    allTasks: Task[],
    cache: OccurrenceCache
  ): MonthOccurrences {
    const tasksByDate = new Map<string, Task[]>();
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    let totalOccurrences = 0;

    for (const [dateKey, taskIds] of cache.occurrencesByDate.entries()) {
      const tasks: Task[] = [];

      for (const taskId of taskIds) {
        const task = taskMap.get(taskId);
        if (task) {
          tasks.push(task);
          totalOccurrences++;
        }
      }

      if (tasks.length > 0) {
        // Sort by priority (high to low), then by name
        tasks.sort((a, b) => {
          const priorityA = PRIORITY_WEIGHTS[a.priority ?? ""] ?? 0;
          const priorityB = PRIORITY_WEIGHTS[b.priority ?? ""] ?? 0;
          if (priorityA !== priorityB) {
            return priorityB - priorityA;
          }
          return a.name.localeCompare(b.name);
        });

        tasksByDate.set(dateKey, tasks);
      }
    }

    return {
      tasksByDate,
      totalOccurrences,
      uniqueTasks: cache.occurrencesByTask.size,
    };
  }

  /**
   * Get cached occurrences if valid
   */
  private getCachedOccurrences(yearMonth: string): OccurrenceCache | null {
    const cached = this.cache.get(yearMonth);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    const age = Date.now() - cached.generatedAt;
    if (age > this.CACHE_TTL_MS) {
      this.cache.delete(yearMonth);
      return null;
    }

    return cached;
  }

  /**
   * Evict oldest caches when at capacity
   */
  private evictOldCaches(): void {
    if (this.cache.size <= this.MAX_CACHE_SIZE) {
      return;
    }

    // Find oldest cache
    let oldestMonth: string | null = null;
    let oldestTime = Infinity;

    for (const [monthKey, cache] of this.cache.entries()) {
      if (cache.generatedAt < oldestTime) {
        oldestTime = cache.generatedAt;
        oldestMonth = monthKey;
      }
    }

    if (oldestMonth) {
      this.cache.delete(oldestMonth);
    }
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format date as YYYY-MM
   */
  private formatYearMonth(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Check if date is in specific month
   */
  private isDateInMonth(date: Date, year: number, month: number): boolean {
    return date.getFullYear() === year && date.getMonth() === month - 1;
  }
}

/**
 * Global singleton instance
 */
export const globalRecurrencePreviewService = new RecurrencePreviewService();
