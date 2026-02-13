import type { Task } from "@backend/core/models/Task";

/**
 * Scheduler service interface for command handlers.
 */
export interface ISchedulerService {
  /** Schedule a task for notification */
  scheduleTask(task: Task): Promise<void>;
  /** Unschedule a task */
  unscheduleTask(taskId: string): Promise<void>;
  /** Reschedule a task (update timing) */
  rescheduleTask(task: Task): Promise<void>;
}
