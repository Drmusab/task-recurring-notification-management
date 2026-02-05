import type { Task } from "@backend/core/models/Task";
import * as logger from "@shared/utils/misc/logger";

export interface TaskState {
  tasks: Task[];
}

export interface TaskStateWriter {
  write(state: TaskState): Promise<void>;
}

/**
 * TaskPersistenceController serializes disk writes and guarantees latest-state persistence.
 *
 * Concurrency guarantees:
 * - Only one write executes at a time (single in-flight writer).
 * - Rapid save requests are coalesced; only the newest pending state is persisted.
 * - Writes are ordered and never overlap, preventing stale overwrites.
 *
 * Performance notes:
 * - requestSave is fire-and-forget and never blocks the UI.
 * - Writes are debounced to limit disk churn during rapid interactions.
 */
export class TaskPersistenceController {
  private pendingState: TaskState | null = null;
  private writeInProgress = false;
  private scheduledTimer: ReturnType<typeof setTimeout> | null = null;
  private flushResolvers: Array<() => void> = [];

  constructor(
    private writer: TaskStateWriter,
    private debounceMs = 50
  ) {}

  /**
   * Request a debounced save of the latest task state.
   */
  requestSave(state: TaskState): void {
    this.pendingState = state;

    if (this.writeInProgress || this.scheduledTimer) {
      return;
    }

    this.scheduledTimer = setTimeout(() => {
      this.scheduledTimer = null;
      void this.drainQueue();
    }, this.debounceMs);
  }

  /**
   * Flush any pending writes and resolve when persistence is complete.
   */
  async flush(): Promise<void> {
    if (!this.pendingState && !this.writeInProgress && !this.scheduledTimer) {
      return;
    }

    return new Promise((resolve) => {
      this.flushResolvers.push(resolve);
      if (!this.writeInProgress && !this.scheduledTimer && this.pendingState) {
        void this.drainQueue();
      }
    });
  }

  private async drainQueue(): Promise<void> {
    if (this.writeInProgress) {
      return;
    }

    this.writeInProgress = true;

    try {
      while (this.pendingState) {
        const stateToWrite = this.pendingState;
        this.pendingState = null;

        const success = await this.writeWithRetry(stateToWrite);
        if (!success) {
          this.pendingState = stateToWrite;
          break;
        }
      }
    } finally {
      this.writeInProgress = false;

      if (!this.pendingState) {
        this.resolveFlushes();
      }

      if (this.pendingState && !this.scheduledTimer) {
        this.scheduledTimer = setTimeout(() => {
          this.scheduledTimer = null;
          void this.drainQueue();
        }, this.debounceMs);
      }
    }
  }

  private async writeWithRetry(state: TaskState): Promise<boolean> {
    try {
      await this.writer.write(state);
      return true;
    } catch (err) {
      logger.error("Task persistence write failed, retrying once", err);
    }

    try {
      await this.writer.write(state);
      return true;
    } catch (err) {
      logger.error("Task persistence write failed after retry", err);
      return false;
    }
  }

  private resolveFlushes(): void {
    if (this.flushResolvers.length === 0) {
      return;
    }
    const resolvers = [...this.flushResolvers];
    this.flushResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }
}
