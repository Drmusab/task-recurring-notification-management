import type { AttentionSettings } from "@backend/core/settings/PluginSettings";

export type AttentionPriorityLevel = "none" | "low" | "medium" | "high" | "urgent";

export interface AttentionScoreBreakdown {
  escalationBase: number;
  escalationOverdueBoost: number;
  escalationScore: number;
  priorityScore: number;
  dependencyScore: number;
  total: number;
}

const ESCALATION_BASE_POINTS: Record<number, number> = {
  0: 0,
  1: 15,
  2: 30,
  3: 50,
};

const PRIORITY_POINTS: Record<AttentionPriorityLevel, number> = {
  none: 0,
  low: 5,
  medium: 12,
  high: 20,
  urgent: 30,
};

export function calculateAttentionScore(
  escalationLevel: number,
  daysOverdue: number,
  priorityLevel: AttentionPriorityLevel,
  blockedCount: number,
  settings: AttentionSettings
): AttentionScoreBreakdown {
  const escalationBase = ESCALATION_BASE_POINTS[escalationLevel] ?? 0;
  const escalationOverdueBoost = daysOverdue > 0
    ? Math.min(settings.scoring.overdueMaxBoost, daysOverdue * settings.scoring.overduePerDay)
    : 0;
  const escalationScore = (escalationBase + escalationOverdueBoost) * settings.scoring.weights.escalation;

  const priorityScore = (PRIORITY_POINTS[priorityLevel] ?? 0) * settings.scoring.weights.priority;

  const dependencyScore = Math.min(
    settings.scoring.blockingMax,
    blockedCount * settings.scoring.blockingPerTask
  ) * settings.scoring.weights.blocking;

  const total = Math.max(0, Math.min(100, Math.round(escalationScore + priorityScore + dependencyScore)));

  return {
    escalationBase,
    escalationOverdueBoost,
    escalationScore,
    priorityScore,
    dependencyScore,
    total,
  };
}
