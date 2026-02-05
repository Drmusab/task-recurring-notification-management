/**
 * Task UI State Manager
 * 
 * Manages UI state for tasks with optimistic updates.
 * Keeps track of task states in the UI separate from persistence.
 * 
 * WHY:
 * - UI needs instant feedback
 * - Backend operations are async
 * - Need to rollback on failure without corrupting stored data
 */

import type { Task } from '@backend/core/models/Task';
import { OptimisticUpdateManager } from "@backend/core/ui/OptimisticUpdateManager";
import * as logger from '@shared/utils/misc/logger';

/**
 * UI-specific task state
 */
export interface TaskUIState {
  /** The task data */
  task: Task;
  
  /** Whether task is currently being updated */
  isUpdating: boolean;
  
  /** Whether task update failed */
  hasFailed: boolean;
  
  /** Error message if failed */
  errorMessage?: string;
  
  /** Timestamp of last UI update */
  lastUpdated: number;
  
  /** Whether this is an optimistic update pending confirmation */
  isOptimistic: boolean;
}

/**
 * Manages UI state for all tasks
 */
export class TaskUIStateManager {
  private static instance: TaskUIStateManager | null = null;
  
  /** UI state for each task, keyed by task ID */
  private states: Map<string, TaskUIState> = new Map();
  
  /** Update manager for optimistic updates */
  private updateManager: OptimisticUpdateManager;
  
  /** Subscribers for state changes */
  private subscribers: Map<string, Set<(state: TaskUIState) => void>> = new Map();
  
  private constructor() {
    this.updateManager = OptimisticUpdateManager.getInstance();
  }
  
  public static getInstance(): TaskUIStateManager {
    if (!TaskUIStateManager.instance) {
      TaskUIStateManager.instance = new TaskUIStateManager();
    }
    return TaskUIStateManager.instance;
  }
  
  /**
   * Get UI state for a task
   */
  public getState(taskId: string): TaskUIState | undefined {
    return this.states.get(taskId);
  }
  
  /**
   * Set UI state for a task
   */
  public setState(taskId: string, task: Task, partial?: Partial<Omit<TaskUIState, 'task'>>): void {
    const current = this.states.get(taskId);
    
    const newState: TaskUIState = {
      task,
      isUpdating: partial?.isUpdating ?? current?.isUpdating ?? false,
      hasFailed: partial?.hasFailed ?? current?.hasFailed ?? false,
      errorMessage: partial?.errorMessage ?? current?.errorMessage,
      lastUpdated: Date.now(),
      isOptimistic: partial?.isOptimistic ?? current?.isOptimistic ?? false,
    };
    
    this.states.set(taskId, newState);
    this.notifySubscribers(taskId, newState);
  }
  
  /**
   * Update task with optimistic UI update
   * 
   * @param taskId - Task ID
   * @param currentTask - Current task state
   * @param optimisticUpdate - Function to apply optimistic changes
   * @param persistFn - Function to persist changes (async)
   * @returns Updated task from persistence
   */
  public async updateOptimistically(
    taskId: string,
    currentTask: Task,
    optimisticUpdate: (task: Task) => Task,
    persistFn: (task: Task) => Promise<Task>
  ): Promise<Task> {
    // Create optimistic task
    const optimisticTask = optimisticUpdate({ ...currentTask });
    
    // Store original for rollback
    const originalTask = { ...currentTask };
    
    // Update UI state
    this.setState(taskId, optimisticTask, {
      isUpdating: true,
      isOptimistic: true,
      hasFailed: false,
      errorMessage: undefined,
    });
    
    try {
      // Execute with optimistic update manager
      const result = await this.updateManager.executeOptimistically(
        `task-${taskId}`,
        
        // Optimistic: Already applied above
        () => {},
        
        // Actual: Persist to backend
        () => persistFn(optimisticTask),
        
        // Rollback: Restore original state
        () => {
          this.setState(taskId, originalTask, {
            isUpdating: false,
            isOptimistic: false,
            hasFailed: true,
            errorMessage: 'Update failed - changes reverted',
          });
        },
        
        {
          timeout: 15000,
          retryCount: 2,
          retryDelay: 1000,
          showError: true,
          errorMessage: 'Failed to update task',
        }
      );
      
      // Success - update with confirmed state
      this.setState(taskId, result, {
        isUpdating: false,
        isOptimistic: false,
        hasFailed: false,
        errorMessage: undefined,
      });
      
      return result;
    } catch (error) {
      logger.error(`Task update failed: ${taskId}`, error);
      
      // Error state already set by rollback
      throw error;
    }
  }
  
  /**
   * Subscribe to state changes for a task
   */
  public subscribe(taskId: string, callback: (state: TaskUIState) => void): () => void {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }
    
    this.subscribers.get(taskId)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(taskId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(taskId);
        }
      }
    };
  }
  
  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(taskId: string, state: TaskUIState): void {
    const subs = this.subscribers.get(taskId);
    if (subs) {
      subs.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          logger.error(`Subscriber callback failed for task ${taskId}`, error);
        }
      });
    }
  }
  
  /**
   * Clear state for a task
   */
  public clearState(taskId: string): void {
    this.states.delete(taskId);
    this.subscribers.delete(taskId);
  }
  
  /**
   * Clear all states
   */
  public clearAll(): void {
    this.states.clear();
    this.subscribers.clear();
    this.updateManager.clearAll();
  }
  
  /**
   * Get all tasks currently being updated
   */
  public getUpdatingTasks(): string[] {
    return Array.from(this.states.entries())
      .filter(([_, state]) => state.isUpdating)
      .map(([id]) => id);
  }
  
  /**
   * Get all tasks with failed updates
   */
  public getFailedTasks(): string[] {
    return Array.from(this.states.entries())
      .filter(([_, state]) => state.hasFailed)
      .map(([id]) => id);
  }
}

/**
 * Convenience hook for task UI state
 */
export function useTaskUIState(taskId: string) {
  const manager = TaskUIStateManager.getInstance();
  
  return {
    getState: () => manager.getState(taskId),
    setState: (task: Task, partial?: Partial<Omit<TaskUIState, 'task'>>) => 
      manager.setState(taskId, task, partial),
    updateOptimistically: (
      currentTask: Task,
      optimisticUpdate: (task: Task) => Task,
      persistFn: (task: Task) => Promise<Task>
    ) => manager.updateOptimistically(taskId, currentTask, optimisticUpdate, persistFn),
    subscribe: (callback: (state: TaskUIState) => void) => manager.subscribe(taskId, callback),
    clear: () => manager.clearState(taskId),
  };
}
