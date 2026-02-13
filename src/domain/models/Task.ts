/**
 * Task Model - Single Source of Truth
 * Consolidated from previous duplicate implementations
 * Version: 2.0.0 (Phase 1 - Obsidian Tasks Parity)
 */

import type { Recurrence } from './Recurrence';
import type { Frequency } from '../../backend/core/models/Frequency';

export type TaskStatus = 'todo' | 'done' | 'cancelled';
export type TaskPriority = 'highest' | 'high' | 'medium' | 'low' | 'lowest' | 'none';
export type CompletionAction = 'keep' | 'delete' | 'archive';

/**
 * Priority sorting weights (lower = higher priority)
 */
export const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  highest: 1,
  high: 2,
  medium: 3,
  none: 4,      // No priority sits between medium and low
  low: 5,
  lowest: 6,
};

// Re-export Frequency type for convenience
export type { Frequency };

/**
 * Custom action to take when task is completed
 */
export interface OnCompletionAction {
  action: CompletionAction;
  nextStatus?: TaskStatus | string;
  customHandler?: string;
}

/**
 * Completion history entry for analytics
 */
export interface CompletionHistoryEntry {
  completedAt: string;      // ISO timestamp
  delayMinutes?: number;    // How late was it?
  durationMinutes?: number; // How long did it take?
  context?: {
    dayOfWeek: number;
    hourOfDay: number;
    wasOverdue: boolean;
  };
}

/**
 * Smart recurrence configuration (ML-based pattern learning)
 */
export interface SmartRecurrence {
  enabled: boolean;
  autoAdjust: boolean;
  minDataPoints: number;
  confidenceThreshold: number; // 0-1
}

/**
 * Task entity representing a task with full Obsidian Tasks parity
 * 
 * Schema Version: 2
 * Migration: Version 1 tasks will be auto-migrated on load
 */
export interface Task {
  // ===== Core Identity =====
  /** Unique task identifier (UUID v4) */
  id: string;
  
  /** Task title/description */
  name: string;
  
  /** Schema version for migrations */
  version: number;
  
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;

  // ===== Status & Lifecycle =====
  /** Task status (replaces legacy 'enabled' field) */
  status: TaskStatus;
  
  /** The character inside checkbox (e.g., ' ', 'x', '/', '>') */
  statusSymbol?: string;
  
  /** Task completion timestamp (ISO 8601) */
  doneAt?: string;
  
  /** Task cancellation timestamp (ISO 8601) */
  cancelledAt?: string;
  
  /** LEGACY: Whether task is active (deprecated, use status) */
  enabled?: boolean;

  // ===== Dates (Obsidian Tasks Parity) =====
  /** Due date & time (ISO 8601) */
  dueAt?: string;
  
  /** Scheduled date (when to work on it) (ISO 8601) */
  scheduledAt?: string;
  
  /** Start date (earliest date task can begin) (ISO 8601) */
  startAt?: string;
  
  /** LEGACY: Last completion timestamp (deprecated, use doneAt) */
  lastCompletedAt?: string;

  // ===== Recurrence =====
  /** LEGACY: Recurrence rule definition (deprecated in favor of 'recurrence') */
  frequency?: Frequency;
  
  /** NEW: RRule-based recurrence (Phase 1: Dual-Engine Mode) */
  recurrence?: Recurrence;
  
  /** Human-readable recurrence string (e.g., "every week") */
  recurrenceText?: string;
  
  /** Calculate next recurrence from completion date instead of due date */
  whenDone?: boolean;
  
  /** Links recurring task instances in a series */
  seriesId?: string;
  
  /** Which instance in recurring series (0-based) */
  occurrenceIndex?: number;

  // ===== Priority & Organization =====
  /** Task priority for routing and sorting */
  priority?: TaskPriority;
  
  /** Tags for categorization and filtering */
  tags?: string[];
  
  /** Category for grouping */
  category?: string;
  
  /** Display order for manual task ordering (drag-to-reorder) */
  order?: number;

  // ===== Dependencies (Obsidian Tasks Parity) =====
  /** Unique task ID for dependency references */
  taskId?: string;
  
  /** Task IDs this task depends on (blocks this task) */
  dependsOn?: string[];
  
  /** Task IDs that depend on this task (derived, computed) */
  blocks?: string[];
  
  /** Task IDs blocking this task (derived, computed) */
  blockedBy?: string[];

  // ===== Completion Actions =====
  /** Action to take when task is completed */
  onCompletion?: CompletionAction | OnCompletionAction;

  // ===== SiYuan Integration =====
  /** Linked block ID in SiYuan */
  linkedBlockId?: string;
  
  /** Cached block content for quick access */
  linkedBlockContent?: string;
  
  /** File path (for path-based filtering) */
  path?: string;
  
  /** Document heading/section where task is located */
  heading?: string;

  // ===== Metadata & Context =====
  /** Long description or notes */
  description?: string;
  
  /** Notification channels (e.g., ["email", "telegram"]) */
  notificationChannels?: string[];
  
  /** Timezone for scheduling (IANA timezone string) */
  timezone?: string;

  // ===== Analytics & Tracking =====
  /** Number of times task has been completed */
  completionCount?: number;
  
  /** Number of times task was missed */
  missCount?: number;
  
  /** Current completion streak */
  currentStreak?: number;
  
  /** Best completion streak achieved */
  bestStreak?: number;
  
  /** Recent completion timestamps (ISO 8601, limited to last N) */
  recentCompletions?: string[];
  
  /** Detailed completion history for pattern learning */
  completionHistory?: CompletionHistoryEntry[];
  
  /** Snooze count for this occurrence */
  snoozeCount?: number;
  
  /** Maximum number of snoozes allowed */
  maxSnoozes?: number;

  // ===== Smart Features =====
  /** Smart recurrence configuration (ML-based pattern learning) */
  smartRecurrence?: SmartRecurrence;
  
  /** Learning metrics from pattern analysis */
  learningMetrics?: {
    averageDelayMinutes: number;
    optimalHour: number;
    consistencyScore: number;
    lastLearningUpdate: string;
  };

  // ===== Lossless Parsing (CRITICAL) =====
  /** Unrecognized line metadata preserved for lossless serialization */
  unknownFields?: string[];
}

/**
 * Create a new task with defaults
 */
export function createTask(partial: Partial<Task>): Task {
  const now = new Date().toISOString();
  
  return {
    id: partial.id || generateTaskId(),
    name: partial.name || '',
    version: 2,
    createdAt: partial.createdAt || now,
    updatedAt: now,
    status: partial.status || 'todo',
    priority: partial.priority || 'none',
    tags: partial.tags || [],
    completionCount: 0,
    missCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    recentCompletions: [],
    ...partial,
  };
}

/**
 * Generate a short unique task ID (8 chars)
 */
export function generateTaskId(): string {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Normalize priority value to standard enum
 */
export function normalizePriority(priority: string | undefined): TaskPriority {
  if (!priority) return 'none';
  
  const normalized = priority.toLowerCase().trim();
  const validPriorities: TaskPriority[] = ['highest', 'high', 'medium', 'low', 'lowest', 'none'];
  
  if (validPriorities.includes(normalized as TaskPriority)) {
    return normalized as TaskPriority;
  }
  
  return 'none';
}

/**
 * Check if task is in a completed state
 */
export function isTaskCompleted(task: Task): boolean {
  return task.status === 'done' || task.status === 'cancelled';
}

/**
 * Check if task is overdue
 */
export function isTaskOverdue(task: Task): boolean {
  if (!task.dueAt || isTaskCompleted(task)) return false;
  
  const dueDate = new Date(task.dueAt);
  const now = new Date();
  
  return dueDate < now;
}

/**
 * Check if task has recurrence
 * Phase 1: Dual-Engine Mode - checks both old and new recurrence systems
 */
export function isRecurring(task: Task): boolean {
  return !!(task.recurrence || task.frequency || task.recurrenceText);
}

/**
 * Check if task is blocked by dependencies
 */
export function isBlocked(task: Task, allTasks: Map<string, Task>): boolean {
  if (!task.dependsOn || task.dependsOn.length === 0) return false;
  
  return task.dependsOn.some(depId => {
    const depTask = allTasks.get(depId);
    return depTask && !isTaskCompleted(depTask);
  });
}
