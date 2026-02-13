/**
 * Event types that can be emitted
 */
export type EventType =
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'task.deleted'
  | 'task.due'
  | 'task.overdue'
  | 'recurrence.paused'
  | 'recurrence.resumed'
  | 'recurrence.regenerated'
  | 'recurrence.skipped'
  | 'notification.sent';

/**
 * Base event payload
 */
export interface BaseEventPayload {
  /** Event type */
  event: EventType;

  /** Task ID */
  taskId: string;

  /** Workspace ID */
  workspaceId: string;

  /** Event timestamp (ISO-8601) */
  timestamp: string;

  /** Event ID (for deduplication) */
  eventId: string;
}

/**
 * Task created event
 */
export interface TaskCreatedEvent extends BaseEventPayload {
  event: 'task.created';
  payload: {
    title: string;
    description?: string;
    dueDate: string | null;
    recurrencePattern: any | null;
    tags: string[];
    priority: string;
  };
}

/**
 * Task updated event
 */
export interface TaskUpdatedEvent extends BaseEventPayload {
  event: 'task.updated';
  payload: {
    title: string;
    updatedFields: string[];
    updatedAt: string;
  };
}

/**
 * Task completed event
 */
export interface TaskCompletedEvent extends BaseEventPayload {
  event: 'task.completed';
  payload: {
    title: string;
    completedAt: string;
    completionNotes?: string;
    isRecurring: boolean;
    nextDueDate?: string | null;
  };
}

/**
 * Task deleted event
 */
export interface TaskDeletedEvent extends BaseEventPayload {
  event: 'task.deleted';
  payload: {
    title: string;
    deletedAt: string;
    historyDeleted: boolean;
  };
}

/**
 * Task due event
 */
export interface TaskDueEvent extends BaseEventPayload {
  event: 'task.due';
  payload: {
    title: string;
    dueDate: string;
    priority: string;
  };
}

/**
 * Task overdue event
 */
export interface TaskOverdueEvent extends BaseEventPayload {
  event: 'task.overdue';
  payload: {
    title: string;
    dueDate: string;
    overdueMinutes: number;
    priority: string;
  };
}

/**
 * Recurrence paused event
 */
export interface RecurrencePausedEvent extends BaseEventPayload {
  event: 'recurrence.paused';
  payload: {
    title: string;
    pausedAt: string;
    reason?: string;
  };
}

/**
 * Recurrence resumed event
 */
export interface RecurrenceResumedEvent extends BaseEventPayload {
  event: 'recurrence.resumed';
  payload: {
    title: string;
    resumedAt: string;
    nextDueDate: string | null;
  };
}

/**
 * Recurrence regenerated event
 */
export interface RecurrenceRegeneratedEvent extends BaseEventPayload {
  event: 'recurrence.regenerated';
  payload: {
    title: string;
    previousDueDate: string;
    nextDueDate: string;
    regeneratedAt: string;
  };
}

/**
 * Recurrence skipped event
 */
export interface RecurrenceSkippedEvent extends BaseEventPayload {
  event: 'recurrence.skipped';
  payload: {
    title: string;
    skippedDates: string[];
    nextDueDate: string;
    reason?: string;
  };
}

/**
 * Notification sent event
 */
export interface NotificationSentEvent extends BaseEventPayload {
  event: 'notification.sent';
  payload: {
    title: string;
    notificationType: 'due' | 'overdue' | 'advance' | 'completed';
    sentAt: string;
  };
}

/**
 * Union type of all events
 */
export type WebhookEvent =
  | TaskCreatedEvent
  | TaskUpdatedEvent
  | TaskCompletedEvent
  | TaskDeletedEvent
  | TaskDueEvent
  | TaskOverdueEvent
  | RecurrencePausedEvent
  | RecurrenceResumedEvent
  | RecurrenceRegeneratedEvent
  | RecurrenceSkippedEvent
  | NotificationSentEvent;

/**
 * Event delivery record
 */
export interface EventDeliveryRecord {
  eventId: string;
  subscriptionId: string;
  url: string;
  event: WebhookEvent;
  attempts: number;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  status: 'pending' | 'delivered' | 'failed' | 'abandoned';
  lastError?: string;
  createdAt: string;
}
