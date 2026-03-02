import type { Frequency } from "./Frequency";
import type { Recurrence } from "@domain/models/Recurrence";
import { isValidFrequency } from "./Frequency";
import { MAX_RECENT_COMPLETIONS, CURRENT_SCHEMA_VERSION } from "@shared/constants/misc-constants";
import type { BlockLinkedAction } from "@backend/core/block-actions/BlockActionTypes";

/**
 * Custom action to take when task is completed
 */
export interface OnCompletionAction {
  readonly action: 'keep' | 'delete' | 'archive' | 'customTransition';
  readonly nextStatus?: 'todo' | 'done' | 'cancelled' | string;
  readonly customHandler?: string;
}

/**
 * Task entity representing a recurring task
 * v3.0 — All fields readonly. Mutations via immutable factory functions.
 */
export interface Task {
  /** Unique task identifier */
  readonly id: string;
  
  /** Task title/name */
  readonly name: string;
  
  /** Timestamp of last completion (ISO string) */
  readonly lastCompletedAt?: string;
  
  /** Current due date & time (ISO string) */
  readonly dueAt: string;
  
  /** DEPRECATED: Legacy frequency-based recurrence (Phase 1-2 only, use 'recurrence' instead) */
  readonly frequency?: Frequency;
  
  /** NEW: RRule-based recurrence (Phase 3: Required for all tasks) */
  readonly recurrence?: Recurrence;
  
  /** Whether task is active */
  readonly enabled: boolean;

  /** Display order for manual task ordering (Phase 4: Drag-to-reorder) */
  readonly order?: number;

  // ─── Block-Aware Metadata (CQRS Phase) ─────────────────────

  /**
   * Canonical SiYuan block ID.
   * Primary identifier for block↔task binding.
   * Set when task is created from a block or linked to one.
   */
  readonly blockId?: string;

  /**
   * Root document ID containing this task's block.
   * Used for document-scoped queries and lifecycle tracking.
   */
  readonly rootId?: string;

  /**
   * SiYuan workspace identifier.
   * Ensures scheduler only processes tasks belonging to current workspace.
   */
  readonly workspaceId?: string;

  /**
   * Timestamp of the last block mutation affecting this task (epoch ms).
   * Used by the recurrence engine to detect stale tasks and prevent
   * ghost notifications when block content has changed externally.
   */
  readonly lastMutationTime?: number;

  // ─── Legacy Block Fields (kept for backward compat) ────────

  /** Linked block ID in Shehab-Note */
  readonly linkedBlockId?: string;

  /** Cached block content for quick access */
  readonly linkedBlockContent?: string;

  /** Block-linked smart actions */
  readonly blockActions?: readonly BlockLinkedAction[];

  /** Priority for routing */
  readonly priority?: TaskPriority;

  /** Tags for routing */
  readonly tags?: readonly string[];

  /** Notification channels (e.g., ["email", "slack"]) */
  readonly notificationChannels?: readonly string[];

  /** Timezone for scheduling */
  readonly timezone?: string;

  /** Category for grouping */
  readonly category?: string;

  /** Description/notes */
  readonly description?: string;

  /** Analytics: Number of completions */
  readonly completionCount?: number;

  /** Analytics: Number of misses */
  readonly missCount?: number;

  /** Analytics: Current completion streak */
  readonly currentStreak?: number;

  /** Analytics: Best completion streak */
  readonly bestStreak?: number;

  /** Recent completion timestamps (ISO strings) */
  readonly recentCompletions?: readonly string[];

  /** Snooze count for this occurrence */
  readonly snoozeCount?: number;

  /** Maximum number of snoozes allowed */
  readonly maxSnoozes?: number;

  /** Escalation policy for missed tasks */
  readonly escalationPolicy?: {
    readonly enabled: boolean;
    readonly levels: readonly {
      readonly missCount: number;
      readonly action: "notify" | "escalate" | "disable";
      readonly channels?: readonly string[];
    }[];
  };

  /** Schema version for migrations (REQUIRED for domain compatibility) */
  readonly version: number;
  
  /** Creation timestamp (ISO string) */
  readonly createdAt: string;
  
  /** Last update timestamp (ISO string) */
  readonly updatedAt: string;

  // New fields for -Tasks feature parity
  
  /** Task status (replaces boolean 'enabled' semantically) */
  readonly status: 'todo' | 'done' | 'cancelled';
  
  /** Human-readable recurrence string */
  readonly recurrenceText?: string;
  
  /** When to start working on task (ISO string) */
  readonly scheduledAt?: string;
  
  /** Earliest date task can begin (ISO string) */
  readonly startAt?: string;
  
  /** Task IDs this task depends on */
  readonly dependsOn?: readonly string[];
  
  /** Task IDs blocked by this task (derived, not stored) */
  readonly blocks?: readonly string[];

  /** Task IDs blocking this task */
  readonly blockedBy?: readonly string[];
  
  /** Links recurring task instances */
  readonly seriesId?: string;
  
  /** Which instance in recurring series */
  readonly occurrenceIndex?: number;
  
  /** Cancellation timestamp (ISO string) */
  readonly cancelledAt?: string;

  /** Completion timestamp (ISO string) */
  readonly doneAt?: string;

  /** Last generated occurrence timestamp (ISO string) — dedup guard for OccurrenceBlockCreator */
  readonly lastGeneratedAt?: string;

  /** Action to take when task is completed */
  readonly onCompletion?: 'keep' | 'delete' | OnCompletionAction;

  /** Calculate next recurrence from completion date instead of due date */
  readonly whenDone?: boolean;

  /** The character in the checkbox for line-based tasks */
  readonly statusSymbol?: string;

  /** File path (for path-based filtering) */
  readonly path?: string;

  /** Document heading/section where task is located */
  readonly heading?: string;

  /** Unrecognized line metadata preserved for lossless serialization */
  readonly unknownFields?: readonly string[];

  // Phase 3: Smart Recurrence (ML-Based Pattern Learning)
  
  /** Historical completion data for pattern learning */
  readonly completionHistory?: readonly CompletionHistoryEntry[];
  
  /** Learning metrics from pattern analysis */
  readonly learningMetrics?: {
    readonly averageDelayMinutes: number;
    readonly optimalHour: number;
    readonly consistencyScore: number;
    readonly lastLearningUpdate: string;
  };
  
  /** Smart recurrence configuration */
  readonly smartRecurrence?: {
    readonly enabled: boolean;
    readonly autoAdjust: boolean;
    readonly minDataPoints: number;  // minimum completions before suggestions
    readonly confidenceThreshold: number; // 0-1
  };

  // AI-driven analytics (for Smart Suggestions)
  
  /** Unix timestamps of completions */
  readonly completionTimes?: readonly number[];
  
  /** Minutes to complete (if tracked) */
  readonly completionDurations?: readonly number[];
  
  /** Completion context data for predictive scheduling */
  readonly completionContexts?: readonly {
    readonly dayOfWeek: number;
    readonly hourOfDay: number;
    readonly wasOverdue: boolean;
    readonly delayMinutes?: number;
  }[];
  
  /** Suggestion interaction history */
  readonly suggestionHistory?: readonly {
    readonly suggestionId: string;
    readonly accepted: boolean;
    readonly timestamp: string;
  }[];

  // Phase 3: Cross-Note Dependencies
  
  /** Dependencies on other SiYuan notes/blocks */
  readonly crossNoteDependencies?: readonly CrossNoteDependency[];

  // RRULE Migration Support
  
  /** Legacy recurrence data before RRULE migration (for rollback/debug) */
  readonly legacyRecurrenceSnapshot?: {
    readonly type: string;
    readonly interval: number;
    readonly weekdays?: readonly number[];
    readonly dayOfMonth?: number;
    readonly month?: number;
    readonly migratedAt: string; // ISO timestamp
  };
}

// ──────────────────────────────────────────────────────────────
// Immutability Types
// ──────────────────────────────────────────────────────────────

/**
 * Deep-readonly version of Task.
 *
 * Use ReadonlyTask in modules that should NEVER mutate task data:
 *   - Parsers (read block → produce task, never modify in-place)
 *   - ML analysis (read completionHistory, never mutate)
 *   - Integration dispatch (serialize for webhook, never mutate)
 *   - Navigation (display task list, never mutate)
 *   - Filtering (decide include/exclude, never mutate)
 *
 * Only TaskStorage, ReactiveTaskManager, and Scheduler should use
 * the mutable Task type.
 */
export type ReadonlyTask = Readonly<Task>;

/**
 * Completion history entry for pattern learning
 */
export interface CompletionHistoryEntry {
  readonly scheduledFor?: string;
  readonly completedAt: string;
  readonly delayMinutes?: number;
  readonly durationMinutes?: number; // How long did it take?
  readonly dayOfWeek?: number;
  readonly context?: {
    readonly dayOfWeek: number;
    readonly hourOfDay: number;
    readonly wasOverdue: boolean;
    readonly location?: string;
    readonly tags?: readonly string[];
    readonly relatedBlocks?: readonly string[];
  };
}

/**
 * Cross-note dependency configuration
 */
export interface CrossNoteDependency {
  readonly id: string;
  readonly type: 'blockExists' | 'blockContent' | 'noteAttribute' | 'tagPresence' | 'backlinks';
  readonly target: {
    readonly blockId?: string;
    readonly notePath?: string;
    readonly attribute?: string;
    readonly tag?: string;
  };
  readonly condition: DependencyCondition;
  readonly status: 'met' | 'unmet' | 'checking';
  readonly lastChecked: string;
}

/**
 * Dependency condition for evaluation
 */
export interface DependencyCondition {
  readonly operator: 'exists' | 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'matches';
  readonly value?: string | number;
  readonly caseSensitive?: boolean;
}

/**
 * Creates a new task with default values
 * Phase 3: Now uses Recurrence (RRule) as the primary recurrence mechanism
 * 
 * @deprecated Use TaskCreationService.createTask() instead for Phase 2+ support
 */
export function createTask(
  name: string,
  frequency: Frequency,
  dueAt?: Date
): Task {
  const now = new Date().toISOString();
  const dueDate = dueAt || new Date();
  
  return Object.freeze({
    id: generateTaskId(),
    name,
    lastCompletedAt: undefined,
    dueAt: dueDate.toISOString(),
    frequency,
    enabled: true,
    status: 'todo' as const,
    priority: "normal",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    completionCount: 0,
    missCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    recentCompletions: Object.freeze([] as string[]),
    snoozeCount: 0,
    maxSnoozes: 3,
    version: CURRENT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  });
}

export type TaskPriority = "lowest" | "low" | "normal" | "medium" | "high" | "highest";

const PRIORITY_LEVELS: TaskPriority[] = ["lowest", "low", "normal", "medium", "high", "highest"];

export function normalizePriority(priority?: string | null): TaskPriority | undefined {
  if (!priority) {
    return undefined;
  }
  const key = priority.toLowerCase();
  if (key === "urgent") {
    return "highest";
  }
  if (key === "none") {
    return "normal";
  }
  if (PRIORITY_LEVELS.includes(key as TaskPriority)) {
    return key as TaskPriority;
  }
  return undefined;
}

/**
 * Generates a unique task ID
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create a duplicate task with a new ID and timestamps.
 */
export function duplicateTask(task: Task, overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  const clone: Task = {
    ...task,
    id: generateTaskId(),
    createdAt: now,
    updatedAt: now,
    lastCompletedAt: undefined,
    completionCount: 0,
    missCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    recentCompletions: Object.freeze([] as string[]),
    snoozeCount: 0,
  };

  return Object.freeze({
    ...clone,
    ...overrides,
  });
}

/**
 * Type guard to check if an object is a valid Task
 */
export function isTask(obj: unknown): obj is Task {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  
  const candidate = obj as Record<string, unknown>;
  
  // Phase 3: Accept tasks with either frequency OR recurrence (prefer recurrence)
  const hasRecurrence = candidate.recurrence !== undefined;
  const hasFrequency = candidate.frequency !== undefined && isValidFrequency(candidate.frequency);

  // Validate version field (required for schema migration)
  const hasValidVersion = typeof candidate.version === "number" && candidate.version > 0;

  // Validate status if present (optional field, but must be valid when set)
  const VALID_STATUSES = new Set(["todo", "done", "cancelled", "in_progress"]);
  const hasValidStatus = candidate.status === undefined || (
    typeof candidate.status === "string" && VALID_STATUSES.has(candidate.status)
  );
  
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    typeof candidate.dueAt === "string" &&
    typeof candidate.enabled === "boolean" &&
    hasValidVersion &&
    hasValidStatus &&
    (hasRecurrence || hasFrequency) && // Accept either, but recurrence is preferred
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

/**
 * Record a task completion — IMMUTABLE.
 * Returns a new Task with updated analytics. Does NOT mutate the input.
 */
export function recordCompletion(task: Task): Task {
  const nowDate = new Date();
  const now = nowDate.toISOString();
  
  // Analytics
  const newCompletionCount = (task.completionCount || 0) + 1;
  const newCurrentStreak = (task.currentStreak || 0) + 1;
  const newBestStreak = Math.max(task.bestStreak || 0, newCurrentStreak);
  
  // Recent completions (capped)
  const prevRecent = task.recentCompletions ? [...task.recentCompletions] : [];
  prevRecent.push(now);
  const newRecentCompletions = prevRecent.length > MAX_RECENT_COMPLETIONS
    ? prevRecent.slice(-MAX_RECENT_COMPLETIONS)
    : prevRecent;
  
  // Phase 3: Completion history for pattern learning
  let newCompletionHistory = task.completionHistory ? [...task.completionHistory] : [];
  if (task.smartRecurrence?.enabled) {
    const scheduledDate = new Date(task.dueAt);
    const delayMinutes = Math.round((nowDate.getTime() - scheduledDate.getTime()) / (1000 * 60));
    
    const historyEntry: CompletionHistoryEntry = {
      scheduledFor: task.dueAt,
      completedAt: now,
      delayMinutes,
      dayOfWeek: nowDate.getDay(),
      context: {
        dayOfWeek: nowDate.getDay(),
        hourOfDay: nowDate.getHours(),
        wasOverdue: delayMinutes > 0,
        tags: task.tags ? [...task.tags] : [],
        relatedBlocks: task.linkedBlockId ? [task.linkedBlockId] : [],
      },
    };
    
    newCompletionHistory.push(historyEntry);
    if (newCompletionHistory.length > 100) {
      newCompletionHistory = newCompletionHistory.slice(-100);
    }
  }
  
  // Completion contexts for AI analysis (always recorded)
  const scheduledForCtx = task.dueAt ? new Date(task.dueAt) : nowDate;
  const ctxDelayMinutes = Math.round(
    (nowDate.getTime() - scheduledForCtx.getTime()) / (1000 * 60)
  );
  const prevContexts = task.completionContexts ? [...task.completionContexts] : [];
  prevContexts.push({
    dayOfWeek: nowDate.getDay(),
    hourOfDay: nowDate.getHours(),
    wasOverdue: ctxDelayMinutes > 0,
    delayMinutes: ctxDelayMinutes,
  });
  const newCompletionContexts = prevContexts.length > 50
    ? prevContexts.slice(-50)
    : prevContexts;

  return {
    ...task,
    completionCount: newCompletionCount,
    currentStreak: newCurrentStreak,
    bestStreak: newBestStreak,
    recentCompletions: newRecentCompletions,
    completionHistory: newCompletionHistory,
    completionContexts: newCompletionContexts,
    snoozeCount: 0,
    lastCompletedAt: now,
    updatedAt: now,
  };
}

/**
 * Record a task miss — IMMUTABLE.
 * Returns a new Task with updated miss analytics. Does NOT mutate the input.
 */
export function recordMiss(task: Task): Task {
  return {
    ...task,
    missCount: (task.missCount || 0) + 1,
    currentStreak: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Check if task is blocked by dependencies
 */
export function isBlocked(task: Task, allTasks: Task[]): boolean {
  const blockingIds = new Set([...(task.blockedBy ?? []), ...(task.dependsOn ?? [])]);
  if (blockingIds.size === 0) {
    return false;
  }
  
  // Check if any blocking task is not completed
  const blockingTasks = allTasks.filter((t) => blockingIds.has(t.id));
  return blockingTasks.some((t) => isTaskActive(t));
}

/**
 * Check if task is blocking any other active task
 */
export function isBlocking(task: Task, allTasks: Task[]): boolean {
  return allTasks.some((candidate) => {
    if (candidate.id === task.id) {
      return false;
    }
    const blockingIds = new Set([...(candidate.blockedBy ?? []), ...(candidate.dependsOn ?? [])]);
    if (!blockingIds.has(task.id)) {
      return false;
    }
    return isTaskActive(candidate);
  });
}

/**
 * Check if task is active/incomplete (helper for backward compatibility)
 */
export function isTaskActive(task: Task): boolean {
  // Check new status field first, fallback to enabled for backward compatibility
  if (task.status) {
    return task.status === 'todo';
  }
  return task.enabled;
}

/**
 * Check if task is overdue
 */
export function isOverdue(task: Task): boolean {
  const now = new Date();
  const dueDate = new Date(task.dueAt);
  
  // Task must be active/incomplete to be overdue
  if (!isTaskActive(task)) {
    return false;
  }
  
  return dueDate < now;
}

/**
 * Check if task is due today
 */
export function isDueToday(task: Task): boolean {
  const now = new Date();
  const dueDate = new Date(task.dueAt);
  
  return (
    dueDate.getFullYear() === now.getFullYear() &&
    dueDate.getMonth() === now.getMonth() &&
    dueDate.getDate() === now.getDate()
  );
}
