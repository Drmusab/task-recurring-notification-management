/**
 * Command result envelope
 */
export interface CommandResult<T = any> {
  status: 'success' | 'error';
  result: T | null;
  error: ErrorInfo | null;
}

export interface ErrorInfo {
  code: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Task creation data
 */
export interface CreateTaskData {
  title: string;
  description?: string;
  recurrencePattern?: RecurrencePattern;
  tags?: string[];
  notificationSettings?: NotificationSettings;
  dueDate?: string; // ISO-8601
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Recurrence pattern definition
 */
export interface RecurrencePattern {
  type: 'interval' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  unit?: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';
  daysOfWeek?: string[]; // For weekly: ['monday', 'wednesday']
  dayOfMonth?: number; // For monthly: 1-31
  monthOfYear?: number; // For yearly: 1-12
  startDate?: string; // ISO-8601
  endDate?: string; // ISO-8601 (optional end)
  horizonDays?: number; // Override default horizon
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  advanceWarning?: number; // Seconds before due
  onDue?: boolean;
  onComplete?: boolean;
  onOverdue?: boolean;
}

/**
 * Task update data
 */
export interface UpdateTaskData {
  taskId: string;
  title?: string;
  description?: string;
  tags?: string[];
  notificationSettings?: NotificationSettings;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Task completion data
 */
export interface CompleteTaskData {
  taskId: string;
  completionTimestamp?: string; // ISO-8601
  notes?: string;
}

/**
 * Task deletion data
 */
export interface DeleteTaskData {
  taskId: string;
  deleteHistory?: boolean; // Delete all history or just current
}

/**
 * Task retrieval data
 */
export interface GetTaskData {
  taskId: string;
  includeHistory?: boolean;
}

/**
 * Task list filters
 */
export interface ListTasksData {
  filters?: {
    status?: TaskStatus[];
    tags?: string[];
    dueBefore?: string; // ISO-8601
    dueAfter?: string; // ISO-8601
    priority?: ('low' | 'medium' | 'high')[];
    hasRecurrence?: boolean;
  };
  sort?: {
    field: 'dueDate' | 'createdAt' | 'priority' | 'title';
    order: 'asc' | 'desc';
  };
  pagination?: {
    limit: number;
    offset: number;
  };
}

/**
 * Task status enum
 */
export type TaskStatus =
  | 'created'
  | 'active'
  | 'due'
  | 'completed'
  | 'paused'
  | 'skipped'
  | 'archived'
  | 'deleted';

/**
 * Task entity (returned from commands)
 */
export interface Task {
  taskId: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  dueDate: string | null;
  nextDueDate: string | null;
  recurrencePattern: RecurrencePattern | null;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  notificationSettings: NotificationSettings;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  lastCompletedAt: string | null;
}

/**
 * Task list response
 */
export interface TaskListResult {
  tasks: Task[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
