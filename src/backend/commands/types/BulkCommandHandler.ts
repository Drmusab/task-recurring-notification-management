/**
 * Bulk complete data
 */
export interface BulkCompleteData {
  /** Task IDs to complete */
  taskIds: string[];

  /** Completion timestamp (applied to all) */
  completionTimestamp?: string; // ISO-8601

  /** Optional notes (applied to all) */
  notes?: string;

  /** Stop on first error or continue */
  continueOnError?: boolean; // Default: true
}

/**
 * Bulk reschedule data
 */
export interface BulkRescheduleData {
  /** Task IDs to reschedule */
  taskIds: string[];

  /** New due date (applied to all) */
  dueDate?: string; // ISO-8601

  /** Or relative offset */
  offset?: {
    amount: number;
    unit: 'minutes' | 'hours' | 'days' | 'weeks';
    direction: 'forward' | 'backward';
  };

  /** Continue on error */
  continueOnError?: boolean;
}

/**
 * Bulk delete data
 */
export interface BulkDeleteData {
  /** Task IDs to delete */
  taskIds: string[];

  /** Delete history */
  deleteHistory?: boolean;

  /** Continue on error */
  continueOnError?: boolean;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  /** Total tasks attempted */
  total: number;

  /** Successfully processed */
  successful: number;

  /** Failed to process */
  failed: number;

  /** Success details */
  successes: BulkOperationSuccess[];

  /** Failure details */
  failures: BulkOperationFailure[];

  /** Whether operation completed fully */
  completedFully: boolean;
}

/**
 * Bulk operation success entry
 */
export interface BulkOperationSuccess {
  taskId: string;
  result: any; // Operation-specific result
}

/**
 * Bulk operation failure entry
 */
export interface BulkOperationFailure {
  taskId: string;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Advanced search data
 */
export interface SearchTasksData {
  /** Text search query */
  query?: string;

  /** Search fields */
  searchFields?: ('title' | 'description' | 'tags')[];

  /** Advanced filters */
  filters?: {
    status?: string[];
    tags?: string[];
    priority?: ('low' | 'medium' | 'high')[];
    hasRecurrence?: boolean;
    dueBefore?: string;
    dueAfter?: string;
    createdBefore?: string;
    createdAfter?: string;
    completedBefore?: string;
    completedAfter?: string;
  };

  /** Sort configuration */
  sort?: {
    field: 'dueDate' | 'createdAt' | 'completedAt' | 'priority' | 'title' | 'relevance';
    order: 'asc' | 'desc';
  };

  /** Pagination */
  pagination?: {
    limit: number;
    offset: number;
  };
}

/**
 * Task statistics data
 */
export interface TaskStatsData {
  /** Time range for stats */
  timeRange?: {
    start: string; // ISO-8601
    end: string; // ISO-8601
  };

  /** Group by dimension */
  groupBy?: 'status' | 'priority' | 'tag' | 'recurrence' | 'day' | 'week' | 'month';

  /** Include trends */
  includeTrends?: boolean;
}

/**
 * Task statistics result
 */
export interface TaskStatsResult {
  /** Total task count */
  totalTasks: number;

  /** By status */
  byStatus: Record<string, number>;

  /** By priority */
  byPriority: Record<string, number>;

  /** Recurring vs non-recurring */
  recurring: {
    total: number;
    active: number;
    paused: number;
  };

  /** Completion stats */
  completion: {
    total: number;
    thisWeek: number;
    thisMonth: number;
    averagePerDay: number;
  };

  /** Overdue */
  overdue: {
    count: number;
    taskIds: string[];
  };

  /** Upcoming (next 7 days) */
  upcoming: {
    count: number;
    byDay: Record<string, number>;
  };

  /** Tag distribution */
  topTags: Array<{ tag: string; count: number }>;

  /** Time range analyzed */
  timeRange?: {
    start: string;
    end: string;
  };

  /** Trends (if requested) */
  trends?: {
    completionRate: number; // Tasks completed / total tasks
    averageCompletionTime: number; // Hours from creation to completion
    missedRate: number; // Overdue tasks / total tasks
  };
}
