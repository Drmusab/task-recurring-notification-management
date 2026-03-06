export type TaskRecurringOperation =
  | 'createTask'
  | 'updateTask'
  | 'completeTask'
  | 'deleteTask'
  | 'getTask'
  | 'listTasks'
  | 'triggerRecurrence'
  | 'addReminder';

export interface TaskRecurringEnvelope<TData> {
  eventId: string;
  timestamp: string;
  source: 'n8n';
  operation: TaskRecurringOperation;
  data: TData;
}

export interface TaskRecurringApiResponse<TData = Record<string, unknown>> {
  success: boolean;
  data?: TData;
  error?: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  description?: string;
  dueAt?: string;
  tags?: string[];
  status?: string;
  recurrenceRule?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

export interface ListTasksFilter {
  status?: string;
  tag?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface CredentialConfig {
  baseUrl: string;
  apiKey: string;
  secret?: string;
  workspaceId?: string;
  authMode: 'apiKey' | 'bearerToken';
}
