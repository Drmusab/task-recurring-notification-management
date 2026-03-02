/**
 * TaskStore — Svelte Reactive State Layer (Pure Observer)
 *
 * Session 24 refactored: All backend coupling removed.
 * The store is a pure reactive cache that:
 *   - Reads via UIQueryService (selectDashboard → TaskDTO[])
 *   - Mutates via UITaskMutationService (completeTask, updateTask, etc.)
 *   - Subscribes to events via UIEventService (onTaskRefresh, etc.)
 *
 * FORBIDDEN:
 *   ❌ Import TaskStorage, BlockMetadataService, PluginEventBus
 *   ❌ Call taskStorage.saveTask() or loadActive()
 *   ❌ Inline task field mutations (task.status = "done")
 *   ❌ Emit events directly
 *
 * Flow:
 *   UI action → taskStore.method() → UITaskMutationService → (backend handles persist + events)
 *   Backend event → UIEventService.onTaskRefresh() → taskStore.refreshFromBackend()
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { TaskDTO } from '../services/DTOs';
import { uiQueryService } from '../services/UIQueryService';
import { uiMutationService, type UpdateTaskDTO } from '../services/UITaskMutationService';
import { uiEventService } from '../services/UIEventService';
import * as logger from "@shared/logging/logger";

interface TaskStoreState {
  tasks: Map<string, TaskDTO>;
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  synced: boolean;
}

class TaskStore {
  private store: Writable<TaskStoreState> = writable<TaskStoreState>({
    tasks: new Map(),
    loading: false,
    error: null,
    lastUpdate: Date.now(),
    synced: false,
  });
  private eventCleanup: (() => void) | null = null;

  /**
   * Connect the store to frontend service singletons.
   * Called from index.ts after services are initialized.
   *
   * NOTE: No backend types in the signature — only frontend services
   * are used (they are already connected by this point).
   */
  connectBackend(_deps?: Record<string, unknown>): void {
    // Auto-refresh when tasks change in the backend
    this.eventCleanup = uiEventService.onTaskRefresh(() => {
      this.refreshFromBackend().catch((err) => {
        logger.warn("[TaskStore] Auto-refresh failed", { error: err });
      });
    });

    // Initial load from backend via UIQueryService
    this.refreshFromBackend().catch((err) => {
      logger.warn("[TaskStore] Initial backend load failed", { error: err });
    });
  }

  /**
   * Disconnect from backend (called on plugin unload).
   * Clears ALL internal state to prevent leaks across hot-reloads.
   */
  disconnectBackend(): void {
    if (this.eventCleanup) {
      this.eventCleanup();
      this.eventCleanup = null;
    }
    // Reset the Svelte store to empty state
    this.store.set({
      tasks: new Map(),
      loading: false,
      error: null,
      lastUpdate: Date.now(),
      synced: false,
    });
  }

  /**
   * Subscribe to store updates
   */
  subscribe = this.store.subscribe;

  /**
   * Get all tasks as array (TaskDTO)
   */
  getAllTasks(): TaskDTO[] {
    const state = get(this.store);
    return Array.from(state.tasks.values());
  }

  /**
   * Get task by ID (TaskDTO)
   */
  getTask(id: string): TaskDTO | undefined {
    const state = get(this.store);
    return state.tasks.get(id);
  }

  /**
   * Refresh tasks from backend via UIQueryService.
   * Reads TaskDTO[] from selectDashboard() — no direct storage access.
   */
  async refreshFromBackend(): Promise<void> {
    this.store.update((state) => ({ ...state, loading: true, error: null }));

    try {
      const taskDTOs = uiQueryService.selectDashboard();

      const newTaskMap = new Map<string, TaskDTO>();
      for (const dto of taskDTOs) {
        newTaskMap.set(dto.id, dto);
      }

      this.store.update((state) => ({
        ...state,
        tasks: newTaskMap,
        loading: false,
        lastUpdate: Date.now(),
        synced: true,
      }));
    } catch (error) {
      this.store.update((state) => ({
        ...state,
        loading: false,
        error: error instanceof Error ? error.message : 'Backend load failed',
      }));
    }
  }

  /**
   * Toggle task status via UITaskMutationService.
   * Delegates to completeTask (if todo→done) or updateTask (if done→todo).
   */
  async toggleTaskStatus(taskId: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) return;

    try {
      if (task.status === "done") {
        // Reopen: set status back to todo
        await uiMutationService.updateTask(taskId, { enabled: true });
      } else {
        // Complete the task
        await uiMutationService.completeTask(taskId);
      }

      // Refresh to get updated state from backend
      await this.refreshFromBackend();
    } catch (error) {
      logger.error('Failed to toggle task', { error: error });
    }
  }

  /**
   * Update task via UITaskMutationService.
   * All field changes route through the mutation service —
   * NEVER mutate fields inline.
   */
  async updateTask(taskId: string, updates: UpdateTaskDTO): Promise<void> {
    try {
      const result = await uiMutationService.updateTask(taskId, updates);
      if (result.success) {
        await this.refreshFromBackend();
      } else {
        logger.error(`[TaskStore] Update failed for ${taskId}:`, { error: result.error });
      }
    } catch (error) {
      logger.error(`[TaskStore] Update failed for ${taskId}:`, { error: error });
    }
  }

  /**
   * Add new task via UITaskMutationService.
   */
  async addTask(task: { name: string; dueAt: string; [key: string]: unknown }): Promise<void> {
    try {
      const result = await uiMutationService.createTask({
        name: task.name,
        dueAt: task.dueAt,
        priority: task.priority as string | undefined,
        tags: task.tags as string[] | undefined,
        category: task.category as string | undefined,
        enabled: task.enabled as boolean | undefined,
        blockId: task.blockId as string | undefined,
        rootId: task.rootId as string | undefined,
        workspaceId: task.workspaceId as string | undefined,
      });

      if (result.success) {
        await this.refreshFromBackend();
      } else {
        logger.error(`[TaskStore] Add failed:`, { error: result.error });
      }
    } catch (error) {
      logger.error(`[TaskStore] Add failed:`, { error: error });
    }
  }

  /**
   * Delete task via UITaskMutationService.
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      const result = await uiMutationService.deleteTask(taskId);
      if (result.success) {
        await this.refreshFromBackend();
      } else {
        logger.error(`[TaskStore] Delete failed for ${taskId}:`, { error: result.error });
      }
    } catch (error) {
      logger.error(`[TaskStore] Delete failed for ${taskId}:`, { error: error });
    }
  }

  /**
   * Query tasks (filters from DTO cache)
   */
  query(_queryString: string): TaskDTO[] {
    // TODO: Implement query parser integration
    return this.getAllTasks();
  }

  /**
   * Get tasks by status (from DTO cache)
   */
  getTasksByStatus(status: string): TaskDTO[] {
    return this.getAllTasks().filter((task) => task.status === status);
  }

  /**
   * Get tasks due today (delegates to UIQueryService)
   */
  getTasksDueToday(): TaskDTO[] {
    return uiQueryService.selectDueToday();
  }

  /**
   * Get overdue tasks (delegates to UIQueryService)
   */
  getOverdueTasks(): TaskDTO[] {
    return uiQueryService.selectOverdue();
  }
}

// Create singleton instance
export const taskStore = new TaskStore();

/**
 * Derived stores for commonly queried task views.
 * These use Svelte's `derived()` to automatically cache filtered results
 * and only recompute when the source store changes — avoiding repeated
 * full scans on every component access.
 *
 * All derived stores yield TaskDTO[] — NEVER domain Task.
 */

/** All tasks as a flat array (cached) */
export const allTasks = derived(taskStore, ($state) =>
  Array.from($state.tasks.values())
);

/** Tasks due today — filters on DTO.dueAt (presentation date bucketing, not lifecycle logic) */
export const tasksDueToday = derived(taskStore, ($state) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrowMs = today.getTime() + 86_400_000;
  const todayMs = today.getTime();
  const result: TaskDTO[] = [];
  for (const task of $state.tasks.values()) {
    if (task.dueAt && task.status !== "done" && task.status !== "cancelled") {
      const dueMs = new Date(task.dueAt).getTime();
      if (dueMs >= todayMs && dueMs < tomorrowMs) {
        result.push(task);
      }
    }
  }
  return result;
});

/** Overdue tasks (reads isOverdue from DTO — no local date computation) */
export const overdueTasks = derived(taskStore, ($state) => {
  const result: TaskDTO[] = [];
  for (const task of $state.tasks.values()) {
    if (task.isOverdue && task.status !== "done" && task.status !== "cancelled") {
      result.push(task);
    }
  }
  return result;
});

/** Task count (avoids allocating arrays just to count) */
export const taskCount = derived(taskStore, ($state) => $state.tasks.size);

/** Loading state */
export const isLoading = derived(taskStore, ($state) => $state.loading);
