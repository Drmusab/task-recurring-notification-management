import type { Task } from "@backend/core/models/Task";
import { startOfDay } from "@shared/utils/misc/date";
import type { EscalationSettings } from "@backend/core/settings/PluginSettings";
import {
  buildEscalationPolicy,
  DEFAULT_ESCALATION_POLICY,
  describeEscalationLevel,
  resolveEscalationLevel,
  type EscalationLevel,
  type EscalationPolicy,
} from "@backend/core/escalation/EscalationPolicy";

export interface EscalationResult {
  level: EscalationLevel;
  daysOverdue: number;
  label: string;
}

export interface EscalationEvaluationOptions {
  referenceDate?: Date;
  settings?: EscalationSettings;
  policy?: EscalationPolicy;
}

export function getEscalationAnchorDate(
  task: Task,
  settings?: EscalationSettings
): Date | null {
  if (task.status === "done" || task.status === "cancelled") {
    return null;
  }

  const dueDate = task.dueAt ? new Date(task.dueAt) : null;
  if (dueDate && !Number.isNaN(dueDate.getTime())) {
    return dueDate;
  }

  const includeScheduled = settings?.includeScheduled ?? true;

  if (includeScheduled && task.scheduledAt) {
    const scheduledDate = new Date(task.scheduledAt);
    if (!Number.isNaN(scheduledDate.getTime())) {
      return scheduledDate;
    }
  }

  return null;
}

export function evaluateEscalation(
  task: Task,
  options: EscalationEvaluationOptions = {}
): EscalationResult {
  const referenceDate = options.referenceDate ?? new Date();
  const settings = options.settings;
  const policy = options.policy ?? buildEscalationPolicy(settings) ?? DEFAULT_ESCALATION_POLICY;
  const anchorDate = getEscalationAnchorDate(task, settings);

  if (!anchorDate) {
    return { level: 0, daysOverdue: 0, label: "On-time" };
  }

  const dayStart = startOfDay(referenceDate);
  const dueStart = startOfDay(anchorDate);
  const diffMs = dayStart.getTime() - dueStart.getTime();
  const daysOverdue = diffMs > 0 ? Math.floor(diffMs / (24 * 60 * 60 * 1000)) : 0;

  if (daysOverdue <= 0) {
    return { level: 0, daysOverdue, label: "On-time" };
  }

  const resolved = resolveEscalationLevel(daysOverdue, policy);

  if (!resolved) {
    const fallback = policy.levels[policy.levels.length - 1];
    if (fallback) {
      return { level: fallback.level, daysOverdue, label: fallback.label };
    }
    return { level: 0, daysOverdue, label: "On-time" };
  }

  return {
    level: resolved.level,
    daysOverdue,
    label: resolved.label,
  };
}

export function buildEscalationExplanation(
  task: Task,
  result: EscalationResult,
  options: EscalationEvaluationOptions = {}
): string {
  if (result.level === 0) {
    return "On-time: due date is today or later.";
  }

  const policy = options.policy ?? buildEscalationPolicy(options.settings) ?? DEFAULT_ESCALATION_POLICY;
  const levelDefinition = policy.levels.find((level) => level.level === result.level);
  const anchorDate = getEscalationAnchorDate(task, options.settings);
  const anchorText = anchorDate ? anchorDate.toLocaleDateString() : "unknown date";
  const rangeText = levelDefinition ? describeEscalationLevel(levelDefinition) : "Overdue";

  return `${result.label}: ${result.daysOverdue} days overdue (due ${anchorText}). Threshold: ${rangeText}.`;
}
