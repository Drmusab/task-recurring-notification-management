/**
 * TaskStore - Svelte store for task state management
 *
 * Phase 7: Synced with backend TaskStorage for SiYuan block persistence.
 * The store is the reactive cache; TaskStorage is the source of truth.
 *
 * Flow:
 *   UI action → taskStore.method() → TaskStorage.saveTask() → store.update()
 *   PluginEventBus "task:refresh" → taskStore.refreshFromBackend()
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { TaskIndex } from '@domain/index/TaskIndex';
import type { Task } from '@backend/core/models/Task';
import type { TaskStorage } from '@backend/core/storage/TaskStorage';
import type { BlockMetadataService } from '@backend/core/api/BlockMetadataService';
import type { PluginEventBus } from '@backend/core/events/PluginEventBus';

interface TaskStoreState {
  tasks: Map<string, Task>;
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  synced: boolean;
}

class TaskStore {
  private store: Writable<TaskStoreState>;
  private taskIndex: TaskIndex;
  private taskStorage: TaskStorage | null = null;
  private blockMetadataService: BlockMetadataService | null = null;
  private pluginEventBus: PluginEventBus | null = null;
  private eventCleanup: (() => void) | null = null;

  constructor() {
    this.store = writable<TaskStoreState>({
      tasks: new Map(),
      loading: false,
      error: null,
      lastUpdate: Date.now(),
      synced: false,
    });

    this.taskIndex = new TaskIndex();
  }

  /**
   * Connect the store to backend services.
   * Called from index.ts after services are initialized.
   */
  connectBackend(deps: {
    taskStorage: TaskStorage;
    blockMetadataService: BlockMetadataService;
    pluginEventBus: PluginEventBus;
  }): void {
    this.taskStorage = deps.taskStorage;
    this.blockMetadataService = deps.blockMetadataService;
    this.pluginEventBus = deps.pluginEventBus;

    // Auto-refresh when tasks change in the backend
    this.eventCleanup = this.pluginEventBus.on("task:refresh", () => {
      this.refreshFromBackend().catch((err) => {
        console.warn("[TaskStore] Auto-refresh failed:", err);
      });
    });

    // Initial load from backend
    this.refreshFromBackend().catch((err) => {
      console.warn("[TaskStore] Initial backend load failed:", err);
    });
  }

  /**
   * Disconnect from backend (called on plugin unload).
   */
  disconnectBackend(): void {
    if (this.eventCleanup) {
      this.eventCleanup();
      this.eventCleanup = null;
    }
    this.taskStorage = null;
    this.blockMetadataService = null;
    this.pluginEventBus = null;
  }

  /**
   * Subscribe to store updates
   */
  subscribe = this.store.subscribe;

  /**
   * Get all tasks as array
   */
  getAllTasks(): Task[] {
    const state = get(this.store);
    return Array.from(state.tasks.values());
  }

  /**
   * Get task by ID
   */
  getTask(id: string): Task | undefined {
    const state = get(this.store);
    return state.tasks.get(id);
  }

  /**
   * Refresh tasks from backend TaskStorage.
   * Replaces the old document-scan approach.
   */
  async refreshFromBackend(): Promise<void> {
    if (!this.taskStorage) {
      // Fallback to local index if not connected
      return this.refreshTasks();
    }

    this.store.update((state) => ({ ...state, loading: true, error: null }));

    try {
      const taskMap = await this.taskStorage.loadActive();
      const tasks = Array.from(taskMap.values());

      const newTaskMap = new Map<string, Task>();
      tasks.forEach((task) => {
        newTaskMap.set(task.id, task);
        this.taskIndex.add(task);
      });

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
   * Refresh tasks from local TaskIndex (fallback).
   */
  async refreshTasks(): Promise<void> {
    this.store.update((state: TaskStoreState) => ({ ...state, loading: true, error: null }));

    try {
      const tasks = this.taskIndex.getAllTasks();
      const taskMap = new Map<string, Task>();

      tasks.forEach((task: Task) => {
        taskMap.set(task.id, task);
      });

      this.store.update((state: TaskStoreState) => ({
        ...state,
        tasks: taskMap,
        loading: false,
        lastUpdate: Date.now(),
      }));
    } catch (error) {
      this.store.update((state: TaskStoreState) => ({
        ...state,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  /**
   * Toggle task status with backend persistence.
   */
  async toggleTaskStatus(taskId: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) return;

    try {
      // Simple toggle: todo ↔ done
      const newStatus = task.status === "done" ? "todo" : "done";
      const updates: Partial<Task> = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      if (newStatus === "done") {
        updates.doneAt = new Date().toISOString();
      } else {
        updates.doneAt = undefined;
      }

      // Update locally
      this.updateTaskLocal(taskId, updates);

      // Persist to backend
      const fullTask = this.getTask(taskId);
      if (fullTask && this.taskStorage) {
        await this.taskStorage.saveTask(fullTask);
        if (this.blockMetadataService) {
          await this.blockMetadataService.syncTaskToBlock(fullTask);
        }
        this.pluginEventBus?.emit("task:refresh", undefined);
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  }

  /**
   * Update task with backend persistence.
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    this.updateTaskLocal(taskId, updates);

    // Persist to backend
    const fullTask = this.getTask(taskId);
    if (fullTask && this.taskStorage) {
      try {
        await this.taskStorage.saveTask(fullTask);
        if (this.blockMetadataService) {
          await this.blockMetadataService.syncTaskToBlock(fullTask);
        }
        this.pluginEventBus?.emit("task:updated", { taskId });
      } catch (error) {
        console.error(`[TaskStore] Backend update failed for ${taskId}:`, error);
      }
    }
  }

  /**
   * Add new task with backend persistence.
   */
  async addTask(task: Task): Promise<void> {
    this.addTaskLocal(task);

    if (this.taskStorage) {
      try {
        await this.taskStorage.saveTask(task);
        if (this.blockMetadataService) {
          await this.blockMetadataService.syncTaskToBlock(task);
        }
        this.pluginEventBus?.emit("task:saved", { task, isNew: true });
      } catch (error) {
        console.error(`[TaskStore] Backend add failed for ${task.id}:`, error);
      }
    }
  }

  /**
   * Delete task with backend persistence.
   */
  async deleteTask(taskId: string): Promise<void> {
    this.deleteTaskLocal(taskId);

    if (this.taskStorage) {
      try {
        await this.taskStorage.deleteTask(taskId);
        this.pluginEventBus?.emit("task:refresh", undefined);
      } catch (error) {
        console.error(`[TaskStore] Backend delete failed for ${taskId}:`, error);
      }
    }
  }

  // ─── Local-only operations (no backend sync) ─────────────

  private updateTaskLocal(taskId: string, updates: Partial<Task>): void {
    this.store.update((state: TaskStoreState) => {
      const task = state.tasks.get(taskId);
      if (!task) return state;

      const updatedTask = { ...task, ...updates, updatedAt: new Date().toISOString() };
      const newTasks = new Map(state.tasks);
      newTasks.set(taskId, updatedTask);

      this.taskIndex.update(taskId, updatedTask);

      return {
        ...state,
        tasks: newTasks,
        lastUpdate: Date.now(),
      };
    });
  }

  private addTaskLocal(task: Task): void {
    this.store.update((state: TaskStoreState) => {
      const newTasks = new Map(state.tasks);
      newTasks.set(task.id, task);

      this.taskIndex.add(task);

      return {
        ...state,
        tasks: newTasks,
        lastUpdate: Date.now(),
      };
    });
  }

  private deleteTaskLocal(taskId: string): void {
    this.store.update((state: TaskStoreState) => {
      const newTasks = new Map(state.tasks);
      newTasks.delete(taskId);

      this.taskIndex.remove(taskId);

      return {
        ...state,
        tasks: newTasks,
        lastUpdate: Date.now(),
      };
    });
  }

  /**
   * Query tasks
   */
  query(queryString: string): Task[] {
    // TODO: Implement query parser integration
    return this.getAllTasks();
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: string): Task[] {
    return this.getAllTasks().filter((task) => task.status === status);
  }

  /**
   * Get tasks due today
   */
  getTasksDueToday(): Task[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getAllTasks().filter((task) => {
      if (!task.dueAt) return false;
      const dueDate = new Date(task.dueAt);
      return dueDate >= today && dueDate < tomorrow;
    });
  }

  /**
   * Get overdue tasks
   */
  getOverdueTasks(): Task[] {
    const now = new Date();

    return this.getAllTasks().filter((task) => {
      if (!task.dueAt || task.status === 'done' || task.status === 'cancelled') {
        return false;
      }

      const dueDate = new Date(task.dueAt);
      return dueDate < now;
    });
  }
}

// Create singleton instance
export const taskStore = new TaskStore();
