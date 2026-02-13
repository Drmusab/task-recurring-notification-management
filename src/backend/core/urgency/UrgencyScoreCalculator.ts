import type { Task, TaskPriority } from "@backend/core/models/Task";
import { isTaskActive, normalizePriority } from "@backend/core/models/Task";
import { DEFAULT_URGENCY_SETTINGS, type UrgencySettings } from "@backend/core/urgency/UrgencySettings";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface UrgencyScoreOptions {
  now?: Date;
  settings?: UrgencySettings;
}

export interface UrgencyCalculation {
  score: number;
  breakdown: {
    /** Contribution from task priority (weighted by 3) */
    priorityContribution: number;
    /** Contribution from due date proximity (weighted by 2) */
    dueDateContribution: number;
    /** Contribution from being overdue (weighted by 5) */
    overdueContribution: number;
    /** Contribution from scheduled date (weighted by 1.5, max 7.5 points) */
    scheduledContribution: number;
    /** Contribution from start date (5 points when task can start) */
    startContribution: number;
  };
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDayDelta = (from: Date, to: Date): number => {
  const fromStart = startOfDay(from);
  const toStart = startOfDay(to);
  return Math.round((toStart.getTime() - fromStart.getTime()) / MS_PER_DAY);
};

const getPriorityMultiplier = (
  priority: TaskPriority,
  settings: UrgencySettings
): number => settings.priorityMultipliers[priority] ?? 1;

/**
 * Calculate task urgency score.
 *
 * Formula (1 Tasks compatible):
 *   urgencyScore = (priorityScore × 3) + (dueScore × 2) + (scheduledScore × 1.5) + startScore + (overdueScore × 5)
 *
 * Priority scoring:
 *   - Multiplied by settings-provided multipliers per priority level
 *
 * Due date scoring:
 *   - No due date: noDueDateScore
 *   - Due today or sooner: dueSoonScoreMax
 *   - Otherwise: clamp(dueSoonScoreMax - daysUntilDue × dueDateWeight, dueSoonScoreMin, dueSoonScoreMax)
 *
 * Scheduled date scoring:
 *   - Scheduled today or past: 7.5 points
 *   - Within next 7 days: (7 - daysUntilScheduled) × 1.5
 *
 * Start date scoring:
 *   - Can start now (start date is today or past): 5 points
 *   - Otherwise: 0 points
 *
 * Overdue penalty:
 *   - 0 when not overdue
 *   - overdueBaseScore + (daysOverdue × overduePenaltyWeight) when overdue
 */
export function calculateUrgencyScore(task: Task, options: UrgencyScoreOptions = {}): number {
  const calculation = calculateUrgencyWithBreakdown(task, options);
  return calculation.score;
}

/**
 * Calculate task urgency score with detailed breakdown
 */
export function calculateUrgencyWithBreakdown(task: Task, options: UrgencyScoreOptions = {}): UrgencyCalculation {
  const now = options.now ?? new Date();
  const settings = options.settings ?? DEFAULT_URGENCY_SETTINGS;

  if (!isTaskActive(task)) {
    return {
      score: 0,
      breakdown: {
        priorityContribution: 0,
        dueDateContribution: 0,
        overdueContribution: 0,
        scheduledContribution: 0,
        startContribution: 0
      }
    };
  }

  const normalizedPriority = normalizePriority(task.priority) ?? "normal";
  const priorityMultiplier = getPriorityMultiplier(normalizedPriority, settings);

  // Calculate priority contribution (weighted by 3)
  const priorityBase = 5; // Base score for priority
  const priorityContribution = priorityBase * priorityMultiplier * 3;
  
  // Calculate due date contribution
  let dueDateContribution = 0;
  let overdueContribution = 0;
  
  if (task.dueAt) {
    const dueDate = new Date(task.dueAt);
    if (!Number.isNaN(dueDate.getTime())) {
      const isOverdue = dueDate.getTime() < now.getTime();
      const daysUntilDue = getDayDelta(now, dueDate);
      const daysOverdue = isOverdue
        ? Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / MS_PER_DAY))
        : 0;

      if (isOverdue) {
        overdueContribution = (settings.overdueBaseScore + daysOverdue * settings.overduePenaltyWeight) * 5;
      } else {
        const baseDueScore = clamp(
          settings.dueSoonScoreMax - daysUntilDue * settings.dueDateWeight,
          settings.dueSoonScoreMin,
          settings.dueSoonScoreMax
        );
        dueDateContribution = baseDueScore * 2;
      }
    }
  } else {
    // No due date: use a minimal base score
    dueDateContribution = settings.noDueDateScore;
  }
  
  // Calculate scheduled date contribution (weighted by 1.5)
  let scheduledContribution = 0;
  if (task.scheduledAt) {
    const scheduledDate = new Date(task.scheduledAt);
    if (!Number.isNaN(scheduledDate.getTime())) {
      const daysUntilScheduled = getDayDelta(now, scheduledDate);
      
      if (daysUntilScheduled <= 0) {
        // Scheduled today or in the past
        scheduledContribution = 7.5;
      } else if (daysUntilScheduled <= 7) {
        // Scheduled within next week
        scheduledContribution = (7 - daysUntilScheduled) * 1.5;
      }
    }
  }
  
  // Calculate start date contribution
  let startContribution = 0;
  if (task.startAt) {
    const startDate = new Date(task.startAt);
    if (!Number.isNaN(startDate.getTime())) {
      const daysUntilStart = getDayDelta(now, startDate);
      
      if (daysUntilStart <= 0) {
        // Can start now
        startContribution = 5;
      }
    }
  }
  
  // Total score
  const totalScore = priorityContribution + dueDateContribution + overdueContribution + scheduledContribution + startContribution;
  
  return {
    score: applyUrgencyCaps(totalScore, settings),
    breakdown: {
      priorityContribution,
      dueDateContribution,
      overdueContribution,
      scheduledContribution,
      startContribution
    }
  };
}

function applyUrgencyCaps(score: number, settings: UrgencySettings): number {
  const capped =
    settings.maxUrgency !== undefined
      ? Math.min(settings.maxUrgency, score)
      : score;
  return Math.round(Math.max(settings.minUrgency, capped));
}
