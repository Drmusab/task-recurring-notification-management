import type { Task } from "@backend/core/models/Task";

/**
 * Scheduler event payloads are semantic (task/when) and side-effect free.
 * Consumers decide what to do (notifications, analytics, etc.).
 */
export type TaskDueContext = "today" | "overdue";

export interface TaskDueEvent {
  taskId: string;
  dueAt: Date;
  context: TaskDueContext;
  task: Task;
}

export type SchedulerEventType = "task:due" | "task:overdue";

export type SchedulerEventListener = (payload: TaskDueEvent) => void | Promise<void>;
