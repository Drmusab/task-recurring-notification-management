/**
 * TaskAnalytics — Immutable Analytics Snapshot
 *
 * Read-only analytics data attached to a DomainTask.
 * Updated ONLY after specific lifecycle events:
 *
 *   ✅ task:runtime:completed → increment completionCount, update streaks
 *   ✅ task:runtime:missed    → increment missCount, reset streak
 *
 *   ❌ task:runtime:rescheduled → MUST NOT update (prevents false urgency)
 *   ❌ task:runtime:postponed   → MUST NOT update (prevents false urgency)
 *
 * This prevents SmartSuggestionEngine from generating false urgency spikes
 * when a user legitimately reschedules or postpones a task.
 *
 * Analytics are NEVER mutated in place. Instead:
 *   1. Read current snapshot from DomainTask.analytics
 *   2. Create new snapshot via recordCompletion() or recordMiss()
 *   3. Attach to new DomainTask via TaskFactory.withAnalytics()
 *
 * FORBIDDEN:
 *   ❌ Import Scheduler, Storage, EventBus, SiYuan API, DOM, Integration, Service
 *   ❌ Mutate any field after construction
 *   ❌ Update on reschedule/postpone events
 */

import type { ISODateString } from "./DomainTask";

// ──────────────────────────────────────────────────────────────
// Snapshot (attached to DomainTask)
// ──────────────────────────────────────────────────────────────

/**
 * Immutable analytics data for a single task.
 *
 * This is the ONLY analytics structure stored on DomainTask.
 * SmartSuggestionEngine reads this but MUST NOT write to it directly.
 */
export interface TaskAnalyticsSnapshot {
  /** Total number of completions */
  readonly completionCount: number;

  /** Total number of misses */
  readonly missCount: number;

  /** Current completion streak */
  readonly currentStreak: number;

  /** Best completion streak ever achieved */
  readonly bestStreak: number;

  /** Recent completion timestamps (ISO strings, capped at MAX_RECENT) */
  readonly recentCompletions: readonly string[];

  /** Detailed completion history for pattern learning (capped at MAX_HISTORY) */
  readonly completionHistory: readonly CompletionHistoryEntry[];

  /** Completion context data for predictive scheduling (capped at MAX_CONTEXTS) */
  readonly completionContexts: readonly CompletionContextEntry[];

  /** ML learning metrics (optional, populated by SmartSuggestionEngine) */
  readonly learningMetrics?: LearningMetrics;

  /** Last analytics update timestamp */
  readonly lastUpdatedAt: ISODateString;
}

// ──────────────────────────────────────────────────────────────
// Sub-types
// ──────────────────────────────────────────────────────────────

/** A single completion history entry for pattern learning */
export interface CompletionHistoryEntry {
  readonly scheduledFor?: string;
  readonly completedAt: string;
  readonly delayMinutes?: number;
  readonly durationMinutes?: number;
  readonly dayOfWeek?: number;
  readonly context?: CompletionContextDetail;
}

/** Contextual detail for a single completion */
export interface CompletionContextDetail {
  readonly dayOfWeek: number;
  readonly hourOfDay: number;
  readonly wasOverdue: boolean;
  readonly location?: string;
  readonly tags?: readonly string[];
  readonly relatedBlocks?: readonly string[];
}

/** Context entry for predictive scheduling */
export interface CompletionContextEntry {
  readonly dayOfWeek: number;
  readonly hourOfDay: number;
  readonly wasOverdue: boolean;
  readonly delayMinutes?: number;
}

/** ML learning metrics from pattern analysis */
export interface LearningMetrics {
  readonly averageDelayMinutes: number;
  readonly optimalHour: number;
  readonly consistencyScore: number;
  readonly lastLearningUpdate: string;
}

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

/** Maximum recent completion timestamps to retain */
export const MAX_RECENT_COMPLETIONS = 20;

/** Maximum completion history entries for pattern learning */
export const MAX_COMPLETION_HISTORY = 100;

/** Maximum completion context entries for predictive scheduling */
export const MAX_COMPLETION_CONTEXTS = 50;

// ──────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────

/**
 * Create an empty analytics snapshot (for new tasks).
 */
export function createEmptyAnalytics(): TaskAnalyticsSnapshot {
  return Object.freeze({
    completionCount: 0,
    missCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    recentCompletions: [],
    completionHistory: [],
    completionContexts: [],
    learningMetrics: undefined,
    lastUpdatedAt: new Date().toISOString() as ISODateString,
  });
}

/**
 * Record a completion — returns a NEW analytics snapshot.
 *
 * ALLOWED events: task:runtime:completed
 * FORBIDDEN events: task:runtime:rescheduled, task:runtime:postponed
 *
 * This function:
 *   1. Increments completionCount
 *   2. Updates streaks
 *   3. Adds to recentCompletions (capped)
 *   4. Adds to completionHistory (capped, if dueAt provided)
 *   5. Adds to completionContexts (capped)
 *
 * The original snapshot is NEVER mutated.
 */
export function recordCompletion(
  current: TaskAnalyticsSnapshot,
  params: {
    completedAt?: Date;
    scheduledFor?: string;
    tags?: readonly string[];
    relatedBlocks?: readonly string[];
  } = {},
): TaskAnalyticsSnapshot {
  const now = params.completedAt ?? new Date();
  const nowISO = now.toISOString();

  // Streaks
  const newCompletionCount = current.completionCount + 1;
  const newStreak = current.currentStreak + 1;
  const newBestStreak = Math.max(current.bestStreak, newStreak);

  // Recent completions (capped)
  const newRecentCompletions = [...current.recentCompletions, nowISO]
    .slice(-MAX_RECENT_COMPLETIONS);

  // Completion history (capped)
  let newHistory = current.completionHistory;
  if (params.scheduledFor) {
    const scheduledDate = new Date(params.scheduledFor);
    const delayMinutes = Math.round(
      (now.getTime() - scheduledDate.getTime()) / (1000 * 60),
    );

    const entry: CompletionHistoryEntry = {
      scheduledFor: params.scheduledFor,
      completedAt: nowISO,
      delayMinutes,
      dayOfWeek: now.getDay(),
      context: {
        dayOfWeek: now.getDay(),
        hourOfDay: now.getHours(),
        wasOverdue: delayMinutes > 0,
        tags: params.tags,
        relatedBlocks: params.relatedBlocks,
      },
    };

    newHistory = [...current.completionHistory, entry]
      .slice(-MAX_COMPLETION_HISTORY);
  }

  // Completion contexts (capped)
  const ctxScheduledDate = params.scheduledFor ? new Date(params.scheduledFor) : now;
  const ctxDelayMinutes = Math.round(
    (now.getTime() - ctxScheduledDate.getTime()) / (1000 * 60),
  );
  const contextEntry: CompletionContextEntry = {
    dayOfWeek: now.getDay(),
    hourOfDay: now.getHours(),
    wasOverdue: ctxDelayMinutes > 0,
    delayMinutes: ctxDelayMinutes,
  };

  const newContexts = [...current.completionContexts, contextEntry]
    .slice(-MAX_COMPLETION_CONTEXTS);

  return Object.freeze({
    completionCount: newCompletionCount,
    missCount: current.missCount,
    currentStreak: newStreak,
    bestStreak: newBestStreak,
    recentCompletions: newRecentCompletions,
    completionHistory: newHistory,
    completionContexts: newContexts,
    learningMetrics: current.learningMetrics,
    lastUpdatedAt: nowISO as ISODateString,
  });
}

/**
 * Record a miss — returns a NEW analytics snapshot.
 *
 * ALLOWED events: task:runtime:missed
 * FORBIDDEN events: task:runtime:rescheduled, task:runtime:postponed
 *
 * This function:
 *   1. Increments missCount
 *   2. Resets currentStreak to 0
 *
 * The original snapshot is NEVER mutated.
 */
export function recordMiss(current: TaskAnalyticsSnapshot): TaskAnalyticsSnapshot {
  return Object.freeze({
    ...current,
    missCount: current.missCount + 1,
    currentStreak: 0,
    lastUpdatedAt: new Date().toISOString() as ISODateString,
  });
}

/**
 * Update learning metrics — returns a NEW analytics snapshot.
 *
 * Called by SmartSuggestionEngine AFTER analysis completes.
 */
export function withLearningMetrics(
  current: TaskAnalyticsSnapshot,
  metrics: LearningMetrics,
): TaskAnalyticsSnapshot {
  return Object.freeze({
    ...current,
    learningMetrics: metrics,
    lastUpdatedAt: new Date().toISOString() as ISODateString,
  });
}

/**
 * Calculate task health score (0-100) from analytics.
 * Pure function — no side effects.
 */
export function calculateHealthScore(analytics: TaskAnalyticsSnapshot): number {
  const total = analytics.completionCount + analytics.missCount;
  if (total === 0) return 100; // New task — optimistic

  const completionRate = analytics.completionCount / total;
  let score = completionRate * 70; // 70% weight from completion rate

  // Bonus from current streak (up to 30 points)
  const streakBonus = Math.min(30, analytics.currentStreak * 3);
  score += streakBonus;

  return Math.round(Math.min(100, score));
}

// ──────────────────────────────────────────────────────────────
// Type Guard
// ──────────────────────────────────────────────────────────────

export function isTaskAnalyticsSnapshot(value: unknown): value is TaskAnalyticsSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.completionCount === "number" &&
    typeof v.missCount === "number" &&
    typeof v.currentStreak === "number" &&
    typeof v.bestStreak === "number" &&
    Array.isArray(v.recentCompletions) &&
    typeof v.lastUpdatedAt === "string"
  );
}
