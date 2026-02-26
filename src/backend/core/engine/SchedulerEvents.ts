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

/**
 * Extended event types for the event-driven engine runtime.
 * - task:due / task:overdue — legacy Scheduler events (kept for EventService compatibility)
 * - task:runtime:*          — fine-grained runtime signals for AI / analytics
 * - engine:tick:complete    — scheduler health heartbeat
 */
export type SchedulerEventType = "task:due" | "task:overdue";

export type SchedulerEventListener = (payload: TaskDueEvent) => void | Promise<void>;

/**
 * Result of a dependency check before event emission.
 */
export interface DependencyGateResult {
  allowed: boolean;
  reason?: string;
  blockers?: string[];
}
