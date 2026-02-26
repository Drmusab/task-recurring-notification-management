/**
 * AttentionGateTypes — Shared types for the Attention-Aware Event Filtering System.
 *
 * These types define the behavioral attention model that gates event emission:
 *   - AttentionScore: composite score from urgency, recency, completion, recurrence, abandonment, deps
 *   - AttentionVerdict: pass/suppress/mute decision for a given task event
 *   - AttentionBudget: per-window notification rate limiter
 *
 * IMPORTANT: This module has ZERO side effects. Importing it costs nothing at runtime.
 */

import type { Task } from "@backend/core/models/Task";

// ─── Constants ──────────────────────────────────────────────

/** Minimum attention score to emit a `task:attention:due` event (0-1) */
export const ATTENTION_THRESHOLD = 0.25;

/** Minimum attention score to push a kernel notification (0-1) */
export const NOTIFICATION_THRESHOLD = 0.50;

/** missCount at which a task is considered abandoned */
export const ABANDONMENT_MISS_THRESHOLD = 5;

/** completionRate below which a task is considered abandoned (over 10+ events) */
export const ABANDONMENT_RATE_THRESHOLD = 0.10;

/** Maximum notifications per sliding window */
export const NOTIFICATION_BUDGET_MAX = 5;

/** Sliding window size in milliseconds (30 minutes) */
export const NOTIFICATION_BUDGET_WINDOW_MS = 30 * 60 * 1000;

/** Decay factor applied to urgencyWeight each time a task is ignored (0-1) */
export const URGENCY_DECAY_FACTOR = 0.80;

/** Floor for decayed urgency weight — never drops below this */
export const URGENCY_DECAY_FLOOR = 0.10;

// ─── Score Breakdown ────────────────────────────────────────

export interface AttentionScoreBreakdown {
  /** Urgency weight (0-1): priority + overdue + escalation, decayed for ignored tasks */
  urgencyWeight: number;
  /** Recency weight (0-1): how recently the task was completed or interacted with */
  recencyWeight: number;
  /** Completion probability (0-1): likelihood user will actually complete this task */
  completionProbability: number;
  /** Recurrence frequency factor (0-1): frequent tasks get lower per-event weight */
  recurrenceFrequency: number;
  /** Abandonment risk (0-1): 0 = definitely abandoned → suppress; 1 = not abandoned */
  abandonmentRisk: number;
  /** Dependency blocking (0-1): 0 = blocked by incomplete deps → suppress; 1 = unblocked */
  dependencyBlocking: number;
}

// ─── Verdict ────────────────────────────────────────────────

export type AttentionAction = "emit" | "suppress" | "mute";

export interface AttentionVerdict {
  /** The computed composite attention score (0-1) */
  score: number;
  /** Breakdown of each factor for debugging / explainability */
  breakdown: AttentionScoreBreakdown;
  /** What the gate decided: emit (passes threshold), suppress (below threshold), mute (abandoned) */
  action: AttentionAction;
  /** Human-readable reason for the decision */
  reason: string;
}

// ─── Budget Tracker ─────────────────────────────────────────

export interface NotificationBudgetState {
  /** Timestamps (epoch ms) of recent notifications within the window */
  recentTimestamps: number[];
}

// ─── Decay State ────────────────────────────────────────────

export interface UrgencyDecayEntry {
  /** Number of times this task's due event was ignored/dismissed */
  ignoreCount: number;
  /** Current decay multiplier (starts at 1.0, decays by URGENCY_DECAY_FACTOR each ignore) */
  currentMultiplier: number;
  /** Timestamp of last ignore (epoch ms) */
  lastIgnoredAt: number;
}

export type UrgencyDecayMap = Record<string, UrgencyDecayEntry>;

// ─── Event Payloads ─────────────────────────────────────────

export interface AttentionDuePayload {
  taskId: string;
  task: Task;
  attentionScore: number;
  breakdown: AttentionScoreBreakdown;
}

export interface AttentionSuppressedPayload {
  taskId: string;
  task: Task;
  attentionScore: number;
  reason: string;
  action: "suppress" | "mute";
}

export interface AttentionSuggestionPayload {
  taskId: string;
  attentionScore: number;
  suggestions: unknown[];
}
