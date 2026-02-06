/**
 * Optimistic Update Manager
 * 
 * Handles optimistic UI updates with automatic rollback on failure.
 * 
 * PATTERN:
 * 1. Apply optimistic update to UI immediately
 * 2. Execute actual operation (async)
 * 3. On success: commit the change
 * 4. On failure: rollback to previous state + show error
 * 
 * USAGE:
 * ```typescript
 * const updateManager = OptimisticUpdateManager.getInstance();
 * 
 * await updateManager.executeOptimistically(
 *   'task-123-status',
 *   () => { task.status = 'done'; renderTask(task); }, // optimistic
 *   () => api.updateTask(task),                        // actual
 *   (task) => { task.status = 'todo'; renderTask(task); } // rollback
 * );
 * ```
 */

import * as logger from "@backend/logging/logger";

export interface OptimisticUpdate<T = any> {
  /** Unique ID for this update operation */
  id: string;
  
  /** Original state before optimistic update */
  previousState: T;
  
  /** Timestamp when update was initiated */
  timestamp: number;
  
  /** Function to rollback the optimistic update */
  rollback: () => void;
  
  /** Optional cleanup function */
  cleanup?: () => void;
}

export interface OptimisticUpdateOptions {
  /** Timeout in ms before auto-rollback (default: 30000) */
  timeout?: number;
  
  /** Whether to show error message on failure (default: true) */
  showError?: boolean;
  
  /** Custom error message */
  errorMessage?: string;
  
  /** Retry count on failure (default: 0) */
  retryCount?: number;
  
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
}

/**
 * Manages optimistic updates with rollback capability
 */
export class OptimisticUpdateManager {
  private static instance: OptimisticUpdateManager | null = null;
  
  /** Active optimistic updates keyed by update ID */
  private activeUpdates: Map<string, OptimisticUpdate> = new Map();
  
  /** Timeout handles for auto-rollback */
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  
  /** Default timeout in milliseconds */
  private readonly DEFAULT_TIMEOUT = 30000;
  
  private constructor() {}
  
  public static getInstance(): OptimisticUpdateManager {
    if (!OptimisticUpdateManager.instance) {
      OptimisticUpdateManager.instance = new OptimisticUpdateManager();
    }
    return OptimisticUpdateManager.instance;
  }
  
  /**
   * Execute an operation optimistically with automatic rollback on failure
   * 
   * @param updateId - Unique ID for this update (e.g., 'task-123-status')
   * @param optimisticFn - Function to apply optimistic update
   * @param actualFn - Async function to perform actual operation
   * @param rollbackFn - Function to rollback optimistic update
   * @param options - Additional options
   * @returns Promise resolving to the actual operation result
   */
  async executeOptimistically<T>(
    updateId: string,
    optimisticFn: () => void,
    actualFn: () => Promise<T>,
    rollbackFn: () => void,
    options: OptimisticUpdateOptions = {}
  ): Promise<T> {
    const {
      timeout = this.DEFAULT_TIMEOUT,
      showError = true,
      errorMessage = 'Operation failed',
      retryCount = 0,
      retryDelay = 1000,
    } = options;
    
    // Cancel any existing update with same ID
    this.cancelUpdate(updateId);
    
    // Capture state before optimistic update
    const previousState = this.captureState();
    
    // Apply optimistic update immediately
    try {
      optimisticFn();
      logger.debug(`Optimistic update applied: ${updateId}`);
    } catch (error) {
      logger.error(`Failed to apply optimistic update: ${updateId}`, error);
      throw error;
    }
    
    // Register the update
    const update: OptimisticUpdate = {
      id: updateId,
      previousState,
      timestamp: Date.now(),
      rollback: rollbackFn,
    };
    
    this.activeUpdates.set(updateId, update);
    
    // Set timeout for auto-rollback
    const timeoutHandle = setTimeout(() => {
      logger.warn(`Optimistic update timeout: ${updateId}`);
      this.rollbackUpdate(updateId, 'Operation timed out');
    }, timeout);
    
    this.timeouts.set(updateId, timeoutHandle);
    
    // Execute actual operation with retries
    try {
      const result = await this.executeWithRetry(actualFn, retryCount, retryDelay);
      
      // Success - commit the update
      this.commitUpdate(updateId);
      
      return result;
    } catch (error) {
      // Failure - rollback
      logger.error(`Actual operation failed: ${updateId}`, error);
      
      this.rollbackUpdate(updateId, showError ? (errorMessage || String(error)) : undefined);
      
      throw error;
    }
  }
  
  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryCount: number,
    retryDelay: number
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < retryCount) {
          logger.debug(`Retry attempt ${attempt + 1}/${retryCount} after ${retryDelay}ms`);
          await this.delay(retryDelay);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Commit an optimistic update (called on success)
   */
  private commitUpdate(updateId: string): void {
    const update = this.activeUpdates.get(updateId);
    
    if (!update) {
      logger.warn(`Attempted to commit non-existent update: ${updateId}`);
      return;
    }
    
    // Clear timeout
    const timeoutHandle = this.timeouts.get(updateId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeouts.delete(updateId);
    }
    
    // Cleanup
    if (update.cleanup) {
      try {
        update.cleanup();
      } catch (error) {
        logger.error(`Cleanup failed for update: ${updateId}`, error);
      }
    }
    
    // Remove from active updates
    this.activeUpdates.delete(updateId);
    
    logger.debug(`Optimistic update committed: ${updateId}`);
  }
  
  /**
   * Rollback an optimistic update (called on failure)
   */
  private rollbackUpdate(updateId: string, errorMessage?: string): void {
    const update = this.activeUpdates.get(updateId);
    
    if (!update) {
      logger.warn(`Attempted to rollback non-existent update: ${updateId}`);
      return;
    }
    
    // Clear timeout
    const timeoutHandle = this.timeouts.get(updateId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeouts.delete(updateId);
    }
    
    // Execute rollback
    try {
      update.rollback();
      logger.info(`Rolled back optimistic update: ${updateId}`);
    } catch (error) {
      logger.error(`Rollback failed for update: ${updateId}`, error);
    }
    
    // Show error message if provided
    if (errorMessage) {
      this.showErrorToast(errorMessage);
    }
    
    // Cleanup
    if (update.cleanup) {
      try {
        update.cleanup();
      } catch (error) {
        logger.error(`Cleanup failed during rollback: ${updateId}`, error);
      }
    }
    
    // Remove from active updates
    this.activeUpdates.delete(updateId);
  }
  
  /**
   * Cancel a pending optimistic update
   */
  public cancelUpdate(updateId: string): void {
    const update = this.activeUpdates.get(updateId);
    
    if (!update) return;
    
    // Clear timeout
    const timeoutHandle = this.timeouts.get(updateId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeouts.delete(updateId);
    }
    
    // Don't rollback, just remove tracking
    this.activeUpdates.delete(updateId);
    
    logger.debug(`Cancelled optimistic update: ${updateId}`);
  }
  
  /**
   * Get all active update IDs
   */
  public getActiveUpdates(): string[] {
    return Array.from(this.activeUpdates.keys());
  }
  
  /**
   * Check if an update is currently pending
   */
  public isPending(updateId: string): boolean {
    return this.activeUpdates.has(updateId);
  }
  
  /**
   * Clear all pending updates (emergency cleanup)
   */
  public clearAll(): void {
    // Clear all timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
    
    // Clear all updates
    this.activeUpdates.clear();
    
    logger.info('Cleared all pending optimistic updates');
  }
  
  /**
   * Capture current state (placeholder - override in specific implementations)
   */
  private captureState(): { timestamp: number } {
    return {
      timestamp: Date.now(),
    };
  }
  
  /**
   * Show error toast notification
   */
  private showErrorToast(message: string): void {
    // Try to use SiYuan's showMessage if available
    const g = globalThis as Record<string, unknown>;
    if (typeof g.showMessage === 'function') {
      (g.showMessage as (msg: string, timeout: number, type: string) => void)(message, 5000, 'error');
    } else {
      console.error(message);
    }
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get statistics about optimistic updates
   */
  public getStats(): {
    activeCount: number;
    oldestUpdateAge: number | null;
    pendingUpdateIds: string[];
  } {
    const now = Date.now();
    const updates = Array.from(this.activeUpdates.values());
    
    return {
      activeCount: updates.length,
      oldestUpdateAge: updates.length > 0 
        ? Math.max(...updates.map(u => now - u.timestamp))
        : null,
      pendingUpdateIds: Array.from(this.activeUpdates.keys()),
    };
  }
}

/**
 * Convenience function for optimistic updates
 */
export async function withOptimisticUpdate<T>(
  updateId: string,
  optimisticFn: () => void,
  actualFn: () => Promise<T>,
  rollbackFn: () => void,
  options?: OptimisticUpdateOptions
): Promise<T> {
  const manager = OptimisticUpdateManager.getInstance();
  return manager.executeOptimistically(updateId, optimisticFn, actualFn, rollbackFn, options);
}
