import type { EscalationSettings } from "@backend/core/settings/PluginSettings";

export type EscalationLevel = 0 | 1 | 2 | 3;

export interface EscalationLevelDefinition {
  level: Exclude<EscalationLevel, 0>;
  label: string;
  minDaysOverdue: number;
  maxDaysOverdue?: number;
}

export interface EscalationPolicy {
  levels: EscalationLevelDefinition[];
}

export const DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
  levels: [
    { level: 1, label: "Warning", minDaysOverdue: 1, maxDaysOverdue: 2 },
    { level: 2, label: "Critical", minDaysOverdue: 3, maxDaysOverdue: 7 },
    { level: 3, label: "Severe", minDaysOverdue: 8 },
  ],
};

export function buildEscalationPolicy(settings?: EscalationSettings): EscalationPolicy {
  if (!settings) {
    return DEFAULT_ESCALATION_POLICY;
  }

  const { thresholds } = settings;
  return {
    levels: [
      {
        level: 1,
        label: "Warning",
        minDaysOverdue: thresholds.warning.minDays,
        maxDaysOverdue: thresholds.warning.maxDays,
      },
      {
        level: 2,
        label: "Critical",
        minDaysOverdue: thresholds.critical.minDays,
        maxDaysOverdue: thresholds.critical.maxDays,
      },
      {
        level: 3,
        label: "Severe",
        minDaysOverdue: thresholds.severe.minDays,
        maxDaysOverdue: thresholds.severe.maxDays,
      },
    ],
  };
}

export function resolveEscalationLevel(
  daysOverdue: number,
  policy: EscalationPolicy
): EscalationLevelDefinition | null {
  if (daysOverdue <= 0) {
    return null;
  }

  return (
    policy.levels.find((level) => {
      const meetsMin = daysOverdue >= level.minDaysOverdue;
      const meetsMax = level.maxDaysOverdue ? daysOverdue <= level.maxDaysOverdue : true;
      return meetsMin && meetsMax;
    }) ?? null
  );
}

export function describeEscalationLevel(level: EscalationLevelDefinition): string {
  if (level.maxDaysOverdue !== undefined) {
    return `${level.minDaysOverdue}–${level.maxDaysOverdue} days overdue`;
  }
  return `${level.minDaysOverdue}+ days overdue`;
}
