import type { Frequency } from "./Frequency";
import { isValidFrequency } from "./Frequency";
import { MAX_RECENT_COMPLETIONS, CURRENT_SCHEMA_VERSION } from "@shared/utils/misc/constants";
import { calculateUrgencyScore } from "@backend/core/urgency/UrgencyScoreCalculator";
import type { BlockLinkedAction } from "@backend/core/block-actions/BlockActionTypes";

/**
 * Custom action to take when task is completed
 */
export interface OnCompletionAction {
  action: 'keep' | 'delete' | 'archive' | 'customTransition';
  nextStatus?: 'todo' | 'done' | 'cancelled' | string;
  customHandler?: string;
}

/**
 * Task entity representing a recurring task
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  
  /** Task title/name */
  name: string;
  
  /** Timestamp of last completion (ISO string) */
  lastCompletedAt?: string;
  
  /** Current due date & time (ISO string) */
  dueAt: string;
  
  /** Recurrence rule definition */
  frequency: Frequency;
  
  /** Whether task is active */
  enabled: boolean;

  /** Display order for manual task ordering (Phase 4: Drag-to-reorder) */
  order?: number;

  /** Linked block ID in Shehab-Note */
  linkedBlockId?: string;

  /** Cached block content for quick access */
  linkedBlockContent?: string;

  /** Block-linked smart actions */
  blockActions?: BlockLinkedAction[];

  /** Priority for routing */
  priority?: TaskPriority;

  /** Tags for routing */
  tags?: string[];

  /** Notification channels (e.g., ["email", "slack"]) */
  notificationChannels?: string[];

  /** Timezone for scheduling */
  timezone?: string;

  /** Category for grouping */
  category?: string;

  /** Description/notes */
  description?: string;

  /** Analytics: Number of completions */
  completionCount?: number;

  /** Analytics: Number of misses */
  missCount?: number;

  /** Analytics: Current completion streak */
  currentStreak?: number;

  /** Analytics: Best completion streak */
  bestStreak?: number;

  /** Recent completion timestamps (ISO strings) */
  recentCompletions?: string[];

  /** Snooze count for this occurrence */
  snoozeCount?: number;

  /** Maximum number of snoozes allowed */
  maxSnoozes?: number;

  /** Escalation policy for missed tasks */
  escalationPolicy?: {
    enabled: boolean;
    levels: Array<{
      missCount: number;
      action: "notify" | "escalate" | "disable";
      channels?: string[];
    }>;
  };

  /** Schema version for migrations */
  version?: number;
  
  /** Creation timestamp (ISO string) */
  createdAt: string;
  
  /** Last update timestamp (ISO string) */
  updatedAt: string;

  // New fields for -Tasks feature parity
  
  /** Task status (replaces boolean 'enabled' semantically) */
  status?: 'todo' | 'done' | 'cancelled';
  
  /** Human-readable recurrence string */
  recurrenceText?: string;
  
  /** When to start working on task (ISO string) */
  scheduledAt?: string;
  
  /** Earliest date task can begin (ISO string) */
  startAt?: string;
  
  /** Task IDs this task depends on */
  dependsOn?: string[];
  
  /** Task IDs blocked by this task (derived, not stored) */
  blocks?: string[];

  /** Task IDs blocking this task */
  blockedBy?: string[];
  
  /** Links recurring task instances */
  seriesId?: string;
  
  /** Which instance in recurring series */
  occurrenceIndex?: number;
  
  /** Cancellation timestamp (ISO string) */
  cancelledAt?: string;

  /** Completion timestamp (ISO string) */
  doneAt?: string;

  /** Action to take when task is completed */
  onCompletion?: 'keep' | 'delete' | OnCompletionAction;

  /** Calculate next recurrence from completion date instead of due date */
  whenDone?: boolean;

  /** The character in the checkbox for line-based tasks */
  statusSymbol?: string;

  /** File path (for path-based filtering) */
  path?: string;

  /** Document heading/section where task is located */
  heading?: string;

  /** Unrecognized line metadata preserved for lossless serialization */
  unknownFields?: string[];

  // Phase 3: Smart Recurrence (ML-Based Pattern Learning)
  
  /** Historical completion data for pattern learning */
  completionHistory?: CompletionHistoryEntry[];
  
  /** Learning metrics from pattern analysis */
  learningMetrics?: {
    averageDelayMinutes: number;
    optimalHour: number;
    consistencyScore: number;
    lastLearningUpdate: string;
  };
  
  /** Smart recurrence configuration */
  smartRecurrence?: {
    enabled: boolean;
    autoAdjust: boolean;
    minDataPoints: number;  // minimum completions before suggestions
    confidenceThreshold: number; // 0-1
  };

  // AI-driven analytics (for Smart Suggestions)
  
  /** Unix timestamps of completions */
  completionTimes?: number[];
  
  /** Minutes to complete (if tracked) */
  completionDurations?: number[];
  
  /** Completion context data for predictive scheduling */
  completionContexts?: {
    dayOfWeek: number;
    hourOfDay: number;
    wasOverdue: boolean;
    delayMinutes?: number;
  }[];
  
  /** Suggestion interaction history */
  suggestionHistory?: {
    suggestionId: string;
    accepted: boolean;
    timestamp: string;
  }[];

  // Phase 3: Cross-Note Dependencies
  
  /** Dependencies on other SiYuan notes/blocks */
  crossNoteDependencies?: CrossNoteDependency[];

  // RRULE Migration Support
  
  /** Legacy recurrence data before RRULE migration (for rollback/debug) */
  legacyRecurrenceSnapshot?: {
    type: string;
    interval: number;
    weekdays?: number[];
    dayOfMonth?: number;
    month?: number;
    migratedAt: string; // ISO timestamp
  };
}

/**
 * Completion history entry for pattern learning
 */
export interface CompletionHistoryEntry {
  scheduledFor: string;
  completedAt: string;
  delayMinutes: number;
  dayOfWeek: number;
  context: {
    location?: string;
    tags: string[];
    relatedBlocks: string[];
  };
}

/**
 * Cross-note dependency configuration
 */
export interface CrossNoteDependency {
  id: string;
  type: 'blockExists' | 'blockContent' | 'noteAttribute' | 'tagPresence' | 'backlinks';
  target: {
    blockId?: string;
    notePath?: string;
    attribute?: string;
    tag?: string;
  };
  condition: DependencyCondition;
  status: 'met' | 'unmet' | 'checking';
  lastChecked: string;
}

/**
 * Dependency condition for evaluation
 */
export interface DependencyCondition {
  operator: 'exists' | 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'matches';
  value?: string | number;
  caseSensitive?: boolean;
}

/**
 * Creates a new task with default values
 */
export function createTask(
  name: string,
  frequency: Frequency,
  dueAt?: Date
): Task {
  const now = new Date().toISOString();
  const dueDate = dueAt || new Date();
  
  return {
    id: generateTaskId(),
    name,
    lastCompletedAt: undefined,
    dueAt: dueDate.toISOString(),
    frequency,
    enabled: true,
    priority: "normal",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    completionCount: 0,
    missCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    recentCompletions: [],
    snoozeCount: 0,
    maxSnoozes: 3,
    version: CURRENT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
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
    recentCompletions: [],
    snoozeCount: 0,
  };

  return {
    ...clone,
    ...overrides,
  };
}

/**
 * Type guard to check if an object is a valid Task
 */
export function isTask(obj: unknown): obj is Task {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  
  const candidate = obj as Record<string, unknown>;
  
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    typeof candidate.dueAt === "string" &&
    typeof candidate.enabled === "boolean" &&
    candidate.frequency !== undefined &&
    isValidFrequency(candidate.frequency as any) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

/**
 * Record a task completion
 */
export function recordCompletion(task: Task): void {
  const nowDate = new Date();
  const now = nowDate.toISOString();
  
  // Update completion count
  task.completionCount = (task.completionCount || 0) + 1;
  
  // Update streaks
  task.currentStreak = (task.currentStreak || 0) + 1;
  task.bestStreak = Math.max(task.bestStreak || 0, task.currentStreak);
  
  // Add to recent completions
  if (!task.recentCompletions) {
    task.recentCompletions = [];
  }
  task.recentCompletions.push(now);
  
  // Keep only the most recent completions
  if (task.recentCompletions.length > MAX_RECENT_COMPLETIONS) {
    task.recentCompletions = task.recentCompletions.slice(-MAX_RECENT_COMPLETIONS);
  }
  
  // Phase 3: Track completion history for pattern learning
  if (task.smartRecurrence?.enabled) {
    if (!task.completionHistory) {
      task.completionHistory = [];
    }
    
    const scheduledDate = new Date(task.dueAt);
    const delayMinutes = Math.round((nowDate.getTime() - scheduledDate.getTime()) / (1000 * 60));
    
    const historyEntry: CompletionHistoryEntry = {
      scheduledFor: task.dueAt,
      completedAt: now,
      delayMinutes,
      dayOfWeek: nowDate.getDay(),
      context: {
        tags: task.tags || [],
        relatedBlocks: task.linkedBlockId ? [task.linkedBlockId] : []
      }
    };
    
    task.completionHistory.push(historyEntry);
    
    // Keep only the most recent 100 entries to avoid bloat
    if (task.completionHistory.length > 100) {
      task.completionHistory = task.completionHistory.slice(-100);
    }
  }
  
  // Reset snooze count
  task.snoozeCount = 0;
  
  // Update timestamps
  task.lastCompletedAt = now;
  task.updatedAt = now;
}

/**
 * Record a task miss
 */
export function recordMiss(task: Task): void {
  // Update miss count
  task.missCount = (task.missCount || 0) + 1;
  
  // Reset current streak
  task.currentStreak = 0;
  
  // Update timestamp
  task.updatedAt = new Date().toISOString();
}

/**
 * Calculate task health score (0-100)
 * Based on completion rate and streak
 */
export function calculateTaskHealth(task: Task): number {
  const completions = task.completionCount || 0;
  const misses = task.missCount || 0;
  const total = completions + misses;
  
  if (total === 0) {
    return 100; // New task, optimistic
  }
  
  // Base score from completion rate
  const completionRate = completions / total;
  let score = completionRate * 70; // 70% weight
  
  // Bonus from current streak (up to 30 points)
  const streak = task.currentStreak || 0;
  const streakBonus = Math.min(30, streak * 3);
  score += streakBonus;
  
  return Math.round(Math.min(100, score));
}

/**
 * Calculate task urgency score (configurable range).
 * Based on due date proximity, priority, and overdue penalties.
 */
export function calculateTaskUrgency(task: Task, now: Date = new Date()): number {
  return calculateUrgencyScore(task, { now });
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
