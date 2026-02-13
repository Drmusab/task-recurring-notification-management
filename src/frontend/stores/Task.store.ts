/**
 * TaskStore - Svelte store for task state management
 * Handles CRUD operations and integrates with TaskIndex
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { TaskIndex } from '../domain/index/TaskIndex';
import { toggleTaskStatus, markTaskDone } from '../application/actions/CompletionHandler';
import type { Task } from '../domain/models/Task';
import { Settings } from '../domain/models/Settings';

interface TaskStoreState {
  tasks: Map<string, Task>;
  loading: boolean;
  error: string | null;
  lastUpdate: number;
}

class TaskStore {
  private store: Writable<TaskStoreState>;
  private taskIndex: TaskIndex;

  constructor() {
    this.store = writable<TaskStoreState>({
      tasks: new Map(),
      loading: false,
      error: null,
      lastUpdate: Date.now(),
    });

    this.taskIndex = new TaskIndex();
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
   * Refresh tasks from document
   */
  async refreshTasks(): Promise<void> {
    this.store.update((state: TaskStoreState) => ({ ...state, loading: true, error: null }));

    try {
      // In a real implementation, this would scan documents for tasks
      // For now, we'll use the task index
      
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
   * Toggle task status
   */
  async toggleTaskStatus(taskId: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) return;

    try {
      const result = toggleTaskStatus(task, {
        recurrenceFromCompletion: true,
        autoCreateNextTask: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      // Update current task
      this.updateTask(taskId, result.updatedTask);

      // Add next instance if exists
      if (result.nextInstance) {
        this.addTask(result.nextInstance);
      }

      // Delete if requested
      if (result.shouldDelete) {
        this.deleteTask(taskId);
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  }

  /**
   * Update task
   */
  updateTask(taskId: string, updates: Partial<Task>): void {
    this.store.update((state: TaskStoreState) => {
      const task = state.tasks.get(taskId);
      if (!task) return state;

      const updatedTask = { ...task, ...updates, updatedAt: new Date().toISOString() };
      const newTasks = new Map(state.tasks);
      newTasks.set(taskId, updatedTask);

      // Update index
      this.taskIndex.update(taskId, updatedTask);

      return {
        ...state,
        tasks: newTasks,
        lastUpdate: Date.now(),
      };
    });
  }

  /**
   * Add new task
   */
  addTask(task: Task): void {
    this.store.update((state: TaskStoreState) => {
      const newTasks = new Map(state.tasks);
      newTasks.set(task.id, task);

      // Add to index
      this.taskIndex.add(task);

      return {
        ...state,
        tasks: newTasks,
        lastUpdate: Date.now(),
      };
    });
  }

  /**
   * Delete task
   */
  deleteTask(taskId: string): void {
    this.store.update((state: TaskStoreState) => {
      const newTasks = new Map(state.tasks);
      newTasks.delete(taskId);

      // Remove from index
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
