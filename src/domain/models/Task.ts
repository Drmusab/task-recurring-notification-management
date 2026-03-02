/**
 * Task Model — LEGACY (DEPRECATED)
 *
 * @deprecated This module is superseded by two canonical sources:
 *   - **Domain layer**: `@domain/DomainTask` — immutable entity with branded types
 *   - **Runtime layer**: `@backend/core/models/Task` — runtime model used by all services
 *
 * This file remains for backward compatibility with:
 *   - RecurrenceEngine (legacy Frequency types)
 *   - FrequencyConverter / RecurrenceMigrationHelper
 *   - TaskIndex
 *
 * Migration path:
 *   1. New code MUST import from `@domain/DomainTask` or `@backend/core/models/Task`
 *   2. Existing imports will be migrated incrementally
 *   3. `TaskPriority` here includes `'none'` — use `normalizePriority()` from
 *      `@backend/core/models/Task` which maps `'none' → 'normal'`
 *
 * Version: 2.1.0 (Phase 3 - Hardened with Value Objects)
 * Status: DEPRECATED — do not add new consumers
 */

import type { Recurrence } from './Recurrence';
import type { Frequency } from './Frequency';
import type { TaskId, ISODateString } from './ValueObjects';

/** @deprecated Use `TaskStatus` from `@domain/DomainTask` or `@backend/core/models/Task` */
export type TaskStatus = 'todo' | 'done' | 'cancelled';
/** @deprecated Use `TaskPriority` from `@domain/DomainTask` (no 'none' — uses 'normal' instead) */
export type TaskPriority = 'highest' | 'high' | 'medium' | 'low' | 'lowest' | 'none' | 'normal';
/** @deprecated Use `CompletionAction` from `@domain/DomainTask` */
export type CompletionAction = 'keep' | 'delete' | 'archive' | 'customTransition';

/**
 * Priority sorting weights (lower = higher priority)
 */
export const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  highest: 1,
  high: 2,
  medium: 3,
  normal: 4,    // Alias for 'none' — used by backend model
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
  readonly completedAt: ISODateString;  // ISO timestamp
  readonly delayMinutes?: number;       // How late was it?
  readonly durationMinutes?: number;    // How long did it take?
  readonly context?: {
    readonly dayOfWeek: number;
    readonly hourOfDay: number;
    readonly wasOverdue: boolean;
  };
}

/**
 * Smart recurrence configuration (ML-based pattern learning)
 */
export interface SmartRecurrence {
  readonly enabled: boolean;
  readonly autoAdjust: boolean;
  readonly minDataPoints: number;
  readonly confidenceThreshold: number; // 0-1
}

/**
 * Task entity representing a task with full Obsidian Tasks parity.
 *
 * @deprecated Use `DomainTask` from `@domain/DomainTask` for domain logic,
 * or `Task` from `@backend/core/models/Task` for runtime services.
 * This interface remains for backward compatibility with legacy modules.
 *
 * Schema Version: 2.2 (Phase 3 - Immutable)
 * Migration: Version 1-2 tasks will be auto-migrated on load
 *
 * ALL fields are now readonly. Mutations go through TaskFactory or
 * TaskService — NEVER via direct property assignment.
 */
export interface Task {
  // ===== Core Identity =====
  /** Unique task identifier (UUID v4) */
  readonly id: string;
  
  /** Task title/description */
  readonly name: string;
  
  /** Schema version for migrations */
  readonly version: number;
  
  /** Creation timestamp (ISO 8601) */
  readonly createdAt: string;
  
  /** Last update timestamp (ISO 8601) */
  readonly updatedAt: string;

  // ===== Status & Lifecycle =====
  /** Task status */
  readonly status: TaskStatus;
  
  /** The character inside checkbox (e.g., ' ', 'x', '/', '>') */
  readonly statusSymbol?: string;
  
  /** Task completion timestamp (ISO 8601) */
  readonly doneAt?: string;
  
  /** Task cancellation timestamp (ISO 8601) */
  readonly cancelledAt?: string;
  
  /** LEGACY: Whether task is active (deprecated, use status) */
  readonly enabled?: boolean;

  // ===== Dates (Obsidian Tasks Parity) =====
  /** Due date & time (ISO 8601) */
  readonly dueAt?: string;
  
  /** Scheduled date (when to work on it) (ISO 8601) */
  readonly scheduledAt?: string;
  
  /** Start date (earliest date task can begin) (ISO 8601) */
  readonly startAt?: string;
  
  /** LEGACY: Last completion timestamp (deprecated, use doneAt) */
  readonly lastCompletedAt?: string;

  // ===== Recurrence =====
  /** LEGACY: Recurrence rule definition (deprecated in favor of 'recurrence') */
  readonly frequency?: Frequency;
  
  /** NEW: RRule-based recurrence (Phase 1: Dual-Engine Mode) */
  readonly recurrence?: Recurrence;
  
  /** Human-readable recurrence string (e.g., "every week") */
  readonly recurrenceText?: string;
  
  /** Calculate next recurrence from completion date instead of due date */
  readonly whenDone?: boolean;
  
  /** Links recurring task instances in a series */
  readonly seriesId?: string;
  
  /** Which instance in recurring series (0-based) */
  readonly occurrenceIndex?: number;

  // ===== Priority & Organization =====
  /** Task priority for routing and sorting */
  readonly priority?: TaskPriority;
  
  /** Tags for categorization and filtering */
  readonly tags?: readonly string[];
  
  /** Category for grouping */
  readonly category?: string;
  
  /** Display order for manual task ordering (drag-to-reorder) */
  readonly order?: number;

  // ===== Dependencies (Obsidian Tasks Parity) =====
  /** Unique task ID for dependency references */
  readonly taskId?: string;
  
  /** Task IDs this task depends on (blocks this task) */
  readonly dependsOn?: readonly string[];
  
  /** Task IDs that depend on this task (derived, computed) */
  readonly blocks?: readonly string[];
  
  /** Task IDs blocking this task (derived, computed) */
  readonly blockedBy?: readonly string[];

  // ===== Completion Actions =====
  /** Action to take when task is completed */
  readonly onCompletion?: CompletionAction | OnCompletionAction;

  // ===== SiYuan Integration =====
  /** Linked block ID in SiYuan */
  readonly linkedBlockId?: string;
  
  /** Cached block content for quick access */
  readonly linkedBlockContent?: string;
  
  /** File path (for path-based filtering) */
  readonly path?: string;
  
  /** Document heading/section where task is located */
  readonly heading?: string;

  // ===== Metadata & Context =====
  /** Long description or notes */
  readonly description?: string;
  
  /** Notification channels (e.g., ["email", "telegram"]) */
  readonly notificationChannels?: readonly string[];
  
  /** Timezone for scheduling (IANA timezone string) */
  readonly timezone?: string;

  // ===== Analytics & Tracking =====
  /** Number of times task has been completed */
  readonly completionCount?: number;
  
  /** Number of times task was missed */
  readonly missCount?: number;
  
  /** Current completion streak */
  readonly currentStreak?: number;
  
  /** Best completion streak achieved */
  readonly bestStreak?: number;
  
  /** Recent completion timestamps (ISO 8601, limited to last N) */
  readonly recentCompletions?: readonly string[];
  
  /** Detailed completion history for pattern learning */
  readonly completionHistory?: readonly CompletionHistoryEntry[];
  
  /** Snooze count for this occurrence */
  readonly snoozeCount?: number;
  
  /** Maximum number of snoozes allowed */
  readonly maxSnoozes?: number;

  // ===== Smart Features =====
  /** Smart recurrence configuration (ML-based pattern learning) */
  readonly smartRecurrence?: SmartRecurrence;
  
  /** Learning metrics from pattern analysis */
  readonly learningMetrics?: {
    readonly averageDelayMinutes: number;
    readonly optimalHour: number;
    readonly consistencyScore: number;
    readonly lastLearningUpdate: string;
  };

  // ===== Lossless Parsing (CRITICAL) =====
  /** Unrecognized line metadata preserved for lossless serialization */
  readonly unknownFields?: readonly string[];
}

/**
 * Create a new task with defaults and validation.
 *
 * @deprecated Use `TaskFactory.create()` from `@domain/TaskFactory` for domain entities,
 * or `TaskCreationService` from `@backend/core/services/TaskCreationService` for runtime tasks.
 *
 * @param partial - Partial task data
 * @returns Validated task with defaults
 * @throws Error if validation fails
 */
export function createTask(partial: Partial<Task>): Task {
  const now = new Date().toISOString();
  
  // Validate required fields
  if (partial.name !== undefined && partial.name.trim().length === 0) {
    throw new Error('Task name cannot be empty');
  }
  
  // Validate dates if provided
  if (partial.dueAt && !isValidISODate(partial.dueAt)) {
    throw new Error(`Invalid dueAt date: ${partial.dueAt}`);
  }
  
  if (partial.scheduledAt && !isValidISODate(partial.scheduledAt)) {
    throw new Error(`Invalid scheduledAt date: ${partial.scheduledAt}`);
  }
  
  if (partial.startAt && !isValidISODate(partial.startAt)) {
    throw new Error(`Invalid startAt date: ${partial.startAt}`);
  }
  
  const task: Task = {
    id: partial.id || generateTaskId(),
    name: partial.name || '',
    version: 2,
    createdAt: partial.createdAt || now,
    updatedAt: now,
    status: partial.status || 'todo',
    priority: partial.priority || 'none',
    tags: partial.tags ? Object.freeze([...partial.tags]) : Object.freeze([] as string[]),
    completionCount: 0,
    missCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    recentCompletions: Object.freeze([] as string[]),
    ...partial,
  };
  
  return Object.freeze(task);
}

/**
 * Validate ISO date string (simple check)
 */
function isValidISODate(dateStr: string): boolean {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!iso8601Regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Generate a short unique task ID (8 chars)
 */
export function generateTaskId(): string {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Normalize priority value to standard enum.
 *
 * @deprecated Use `normalizePriority()` from `@backend/core/models/Task`
 * which maps `'none' → 'normal'` (DomainTask-compatible).
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
