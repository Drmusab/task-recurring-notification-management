export type UrgencyPriority = "lowest" | "low" | "normal" | "medium" | "high" | "highest";

/**
 * Urgency scoring settings.
 */
export interface UrgencySettings {
  /** Maximum base score for tasks due today */
  dueSoonScoreMax: number;

  /** Minimum base score for tasks with future due dates */
  dueSoonScoreMin: number;

  /** Score reduction per day until due */
  dueDateWeight: number;

  /** Base score added once a task is overdue */
  overdueBaseScore: number;

  /** Score added per overdue day */
  overduePenaltyWeight: number;

  /** Baseline score for tasks without due dates */
  noDueDateScore: number;

  /** Priority multipliers applied to the final score */
  priorityMultipliers: Record<UrgencyPriority, number>;

  /** Optional maximum urgency cap */
  maxUrgency?: number;

  /** Minimum urgency score after rounding */
  minUrgency: number;
}

export const DEFAULT_URGENCY_SETTINGS: UrgencySettings = {
  dueSoonScoreMax: 100,
  dueSoonScoreMin: 0,
  dueDateWeight: 10,
  overdueBaseScore: 110,
  overduePenaltyWeight: 15,
  noDueDateScore: 0,
  priorityMultipliers: {
    lowest: 0.8,
    low: 1.0,
    normal: 1.1,
    medium: 1.2,
    high: 1.5,
    highest: 2.0,
  },
  maxUrgency: 200,
  minUrgency: 0,
};
