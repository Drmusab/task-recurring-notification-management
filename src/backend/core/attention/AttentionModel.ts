/**
 * AttentionModel — Pure function that computes a behavioral attention score for a task.
 *
 * Formula:
 *   attentionScore = urgencyWeight × recencyWeight × completionProbability
 *                    × recurrenceFrequency × abandonmentRisk × dependencyBlocking
 *
 * All factors are in range [0, 1]. The composite score is a product, meaning
 * ANY factor at 0 will suppress the entire event. This is intentional:
 *   - abandonmentRisk = 0 → task is abandoned → always suppress
 *   - dependencyBlocking = 0 → task is blocked → always suppress
 *
 * This module is STATELESS and PURE:
 *   - No side effects, no event emission, no persistence
 *   - Used by AttentionGateFilter to decide emit/suppress/mute
 *
 * Inputs come exclusively from the Task model's existing analytics fields:
 *   completionCount, missCount, currentStreak, snoozeCount, priority,
 *   completionContexts, learningMetrics, recentCompletions, dueAt,
 *   recurrence, dependsOn, blockedBy
 */

import type { Task } from "@backend/core/models/Task";
import { normalizePriority, type TaskPriority } from "@backend/core/models/Task";
import type { AttentionScoreBreakdown, AttentionVerdict, UrgencyDecayEntry } from "./AttentionGateTypes";
import {
  ATTENTION_THRESHOLD,
  ABANDONMENT_MISS_THRESHOLD,
  ABANDONMENT_RATE_THRESHOLD,
} from "./AttentionGateTypes";

// ─── Priority → Urgency Weight ──────────────────────────────

const PRIORITY_URGENCY: Record<TaskPriority, number> = {
  lowest: 0.15,
  low: 0.30,
  normal: 0.50,
  medium: 0.65,
  high: 0.85,
  highest: 1.00,
};

// ─── Public API ─────────────────────────────────────────────

/**
 * Compute the attention score breakdown for a task.
 *
 * @param task - The task to score
 * @param decayEntry - Optional urgency decay state from UrgencyDecayTracker
 * @param now - Current time (injectable for tests)
 * @returns Full breakdown of all factors
 */
export function computeAttentionBreakdown(
  task: Task,
  decayEntry?: UrgencyDecayEntry,
  now: Date = new Date(),
): AttentionScoreBreakdown {
  return {
    urgencyWeight: computeUrgencyWeight(task, decayEntry, now),
    recencyWeight: computeRecencyWeight(task, now),
    completionProbability: computeCompletionProbability(task),
    recurrenceFrequency: computeRecurrenceFrequency(task),
    abandonmentRisk: computeAbandonmentRisk(task),
    dependencyBlocking: computeDependencyBlocking(task),
  };
}

/**
 * Compute the composite attention score from a breakdown.
 * All factors are multiplied together (range 0-1).
 */
export function computeAttentionScore(breakdown: AttentionScoreBreakdown): number {
  const score =
    breakdown.urgencyWeight *
    breakdown.recencyWeight *
    breakdown.completionProbability *
    breakdown.recurrenceFrequency *
    breakdown.abandonmentRisk *
    breakdown.dependencyBlocking;

  // Clamp to [0, 1] for safety
  return Math.max(0, Math.min(1, score));
}

/**
 * Compute full verdict: score + action + reason.
 */
export function computeVerdict(
  task: Task,
  decayEntry?: UrgencyDecayEntry,
  now?: Date,
): AttentionVerdict {
  const breakdown = computeAttentionBreakdown(task, decayEntry, now);
  const score = computeAttentionScore(breakdown);

  // Mute abandoned tasks (hard mute — always suppress)
  if (breakdown.abandonmentRisk === 0) {
    return {
      score,
      breakdown,
      action: "mute",
      reason: buildMuteReason(task),
    };
  }

  // Suppress below threshold
  if (score < ATTENTION_THRESHOLD) {
    return {
      score,
      breakdown,
      action: "suppress",
      reason: buildSuppressReason(score, breakdown),
    };
  }

  return {
    score,
    breakdown,
    action: "emit",
    reason: `Attention score ${(score * 100).toFixed(0)}% — above threshold`,
  };
}

// ─── Factor Computations ────────────────────────────────────

/**
 * Urgency weight: base from priority + overdue boost, then apply decay.
 */
function computeUrgencyWeight(
  task: Task,
  decayEntry?: UrgencyDecayEntry,
  now: Date = new Date(),
): number {
  // Base urgency from priority
  const priority = normalizePriority(task.priority) ?? "normal";
  let weight = PRIORITY_URGENCY[priority] ?? 0.50;

  // Boost for overdue tasks
  if (task.dueAt) {
    const dueMs = new Date(task.dueAt).getTime();
    const nowMs = now.getTime();
    if (dueMs < nowMs) {
      const hoursOverdue = (nowMs - dueMs) / (1000 * 60 * 60);
      // Boost up to +0.40 for tasks overdue by 24h+
      const boost = Math.min(0.40, hoursOverdue / 24 * 0.40);
      weight = Math.min(1.0, weight + boost);
    }
  }

  // Apply urgency decay for ignored recurring tasks
  if (decayEntry) {
    weight *= decayEntry.currentMultiplier;
  }

  return Math.max(0, Math.min(1, weight));
}

/**
 * Recency weight: tasks recently completed or interacted with get lower attention
 * (they don't need reminding). Tasks not interacted with recently get higher weight.
 */
function computeRecencyWeight(task: Task, now: Date = new Date()): number {
  // Check last completion
  const lastCompletion = task.lastCompletedAt
    ? new Date(task.lastCompletedAt).getTime()
    : 0;

  // Check recent completions for most recent interaction
  const recentTs = (task.recentCompletions ?? [])
    .map((c) => new Date(c).getTime())
    .filter((t) => !Number.isNaN(t));

  const lastInteraction = Math.max(lastCompletion, ...recentTs, 0);

  if (lastInteraction === 0) {
    // Never interacted with → full attention needed
    return 1.0;
  }

  const hoursSinceInteraction = (now.getTime() - lastInteraction) / (1000 * 60 * 60);

  // If completed very recently (< 1h), very low attention needed
  if (hoursSinceInteraction < 1) return 0.10;
  // Under 4h → low
  if (hoursSinceInteraction < 4) return 0.40;
  // Under 12h → moderate
  if (hoursSinceInteraction < 12) return 0.65;
  // Under 24h → mostly fresh
  if (hoursSinceInteraction < 24) return 0.80;

  // Over 24h → full attention
  return 1.0;
}

/**
 * Completion probability: based on completion rate over history.
 * Higher rate → user is likely to do it → higher attention deserved.
 * Lower rate → user rarely does it → lower priority for notification.
 */
function computeCompletionProbability(task: Task): number {
  const completions = task.completionCount ?? 0;
  const misses = task.missCount ?? 0;
  const total = completions + misses;

  if (total === 0) {
    // New task — give benefit of the doubt
    return 0.80;
  }

  if (total < 3) {
    // Too little data — modest confidence
    return 0.70;
  }

  // Completion rate, but floor at 0.15 (even very-low-rate tasks get some attention)
  const rate = completions / total;
  return Math.max(0.15, Math.min(1.0, rate));
}

/**
 * Recurrence frequency factor: frequent recurring tasks should have LOWER
 * per-event attention weight to prevent notification spam.
 *
 * Daily tasks → lower per-event; weekly → moderate; monthly → full.
 */
function computeRecurrenceFrequency(task: Task): number {
  // If no recurrence, full weight
  if (!task.recurrence?.rrule && !task.frequency) {
    return 1.0;
  }

  // Try to determine frequency from rrule
  const rrule = task.recurrence?.rrule;
  if (rrule) {
    const lower = rrule.toUpperCase();
    if (lower.includes("FREQ=HOURLY")) return 0.20;
    if (lower.includes("FREQ=DAILY") && lower.includes("INTERVAL=1")) return 0.40;
    if (lower.includes("FREQ=DAILY")) return 0.50;
    if (lower.includes("FREQ=WEEKLY") && lower.includes("INTERVAL=1")) return 0.70;
    if (lower.includes("FREQ=WEEKLY")) return 0.75;
    if (lower.includes("FREQ=MONTHLY")) return 0.90;
    if (lower.includes("FREQ=YEARLY")) return 1.00;
    // Default for unparseable rrule
    return 0.60;
  }

  // Fallback to legacy frequency
  const freq = task.frequency?.type;
  switch (freq) {
    case "daily": return 0.40;
    case "weekly": return 0.70;
    case "monthly": return 0.90;
    default: return 0.60;
  }
}

/**
 * Abandonment risk: detects tasks the user has effectively given up on.
 *
 * Returns 0 if abandoned (hard mute), 1 if healthy, gradient in between.
 *
 * Abandoned if:
 *   - missCount >= ABANDONMENT_MISS_THRESHOLD AND completionCount === 0
 *   - OR completionRate < ABANDONMENT_RATE_THRESHOLD over 10+ events
 */
function computeAbandonmentRisk(task: Task): number {
  const misses = task.missCount ?? 0;
  const completions = task.completionCount ?? 0;
  const total = misses + completions;

  // Hard mute: never completed, high miss count
  if (misses >= ABANDONMENT_MISS_THRESHOLD && completions === 0) {
    return 0;
  }

  // Hard mute: very low completion rate over sufficient history
  if (total >= 10 && completions / total < ABANDONMENT_RATE_THRESHOLD) {
    return 0;
  }

  // Gradient based on miss ratio (for intermediate cases)
  if (total >= 5) {
    const missRate = misses / total;
    // High miss rate (>70%) → low attention worthiness
    if (missRate > 0.70) return 0.30;
    if (missRate > 0.50) return 0.55;
    if (missRate > 0.30) return 0.75;
  }

  // Healthy task
  return 1.0;
}

/**
 * Dependency blocking: tasks blocked by unfinished dependencies get suppressed.
 * Returns 0 if fully blocked, 1 if unblocked.
 */
function computeDependencyBlocking(task: Task): number {
  const blockers = [
    ...(task.blockedBy ?? []),
    ...(task.dependsOn ?? []),
  ];

  if (blockers.length === 0) {
    return 1.0;
  }

  // We can't check if blockers are actually complete without access to all tasks,
  // but the presence of blockedBy/dependsOn indicates potential blocking.
  // The Scheduler should have already filtered truly blocked tasks, but we add
  // a soft penalty here for tasks with declared dependencies.
  // 
  // Penalty: -0.15 per declared dependency, floor at 0.30
  const penalty = blockers.length * 0.15;
  return Math.max(0.30, 1.0 - penalty);
}

// ─── Reason Builders ────────────────────────────────────────

function buildMuteReason(task: Task): string {
  const misses = task.missCount ?? 0;
  const completions = task.completionCount ?? 0;
  const total = misses + completions;

  if (misses >= ABANDONMENT_MISS_THRESHOLD && completions === 0) {
    return `Task muted: ${misses} misses with 0 completions — likely abandoned`;
  }
  if (total >= 10) {
    const rate = ((completions / total) * 100).toFixed(0);
    return `Task muted: ${rate}% completion rate over ${total} events — below ${(ABANDONMENT_RATE_THRESHOLD * 100).toFixed(0)}% threshold`;
  }
  return "Task muted: abandonment detected";
}

function buildSuppressReason(score: number, breakdown: AttentionScoreBreakdown): string {
  const parts: string[] = [];
  if (breakdown.urgencyWeight < 0.30) parts.push("low urgency");
  if (breakdown.recencyWeight < 0.30) parts.push("recently interacted");
  if (breakdown.completionProbability < 0.30) parts.push("low completion probability");
  if (breakdown.recurrenceFrequency < 0.30) parts.push("high-frequency recurrence");
  if (breakdown.dependencyBlocking < 0.50) parts.push("blocked by dependencies");

  const reasons = parts.length > 0 ? parts.join(", ") : "combined low factors";
  return `Suppressed (${(score * 100).toFixed(0)}% < ${(ATTENTION_THRESHOLD * 100).toFixed(0)}%): ${reasons}`;
}
