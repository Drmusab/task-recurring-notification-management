import type { Task } from "@backend/core/models/Task";
import { isTaskActive, normalizePriority } from "@backend/core/models/Task";
import type { EscalationSettings, AttentionSettings } from "@backend/core/settings/PluginSettings";
import { evaluateEscalation } from "@backend/core/escalation/EscalationEvaluator";
import { DependencyIndex } from "@backend/core/dependencies/DependencyIndex";
import { BlockedStateEvaluator } from "@backend/core/dependencies/BlockedStateEvaluator";
import { CycleDetector } from "@backend/core/dependencies/CycleDetector";
import { calculateAttentionScore, type AttentionPriorityLevel } from "@backend/core/attention/AttentionScoring";
import { assignAttentionLane } from "@backend/core/attention/AttentionLaneAssigner";
import { buildAttentionReasons } from "@backend/core/attention/AttentionExplainer";

export type AttentionLane = "DO_NOW" | "UNBLOCK_FIRST" | "BLOCKED" | "WATCHLIST";

export interface AttentionProfile {
  taskId: string;
  escalation: { level: 0 | 1 | 2 | 3; daysOverdue: number; label: string };
  priority: { level: AttentionPriorityLevel; weight: number };
  dependency: {
    isBlocked: boolean;
    isBlocking: boolean;
    blockers: string[];
    blockedCount: number;
    cycle?: { detected: boolean; members: string[] };
  };
  score: number;
  lane: AttentionLane;
  reasons: string[];
}

export interface AttentionEngineOptions {
  attentionSettings: AttentionSettings;
  escalationSettings: EscalationSettings;
  referenceDate?: Date;
}

export class AttentionEngine {
  private cachedKey: string | null = null;
  private cachedProfiles: Map<string, AttentionProfile> = new Map();

  getAttentionProfiles(tasks: Task[], options: AttentionEngineOptions): Map<string, AttentionProfile> {
    const referenceDate = options.referenceDate ?? new Date();
    const cacheKey = this.buildCacheKey(tasks, options.attentionSettings, options.escalationSettings, referenceDate);

    if (this.cachedKey === cacheKey) {
      return this.cachedProfiles;
    }

    const dependencyIndex = new DependencyIndex();
    dependencyIndex.build(tasks);
    const blockedEvaluator = new BlockedStateEvaluator(dependencyIndex);
    const cycleDetector = new CycleDetector(dependencyIndex);
    const profiles = new Map<string, AttentionProfile>();

    for (const task of tasks) {
      if (options.attentionSettings.hideCompleted && !isTaskActive(task)) {
        continue;
      }

      const escalation = evaluateEscalation(task, {
        settings: options.escalationSettings,
        referenceDate,
      });

      const priority = this.evaluatePriority(task);
      const blockers = dependencyIndex.getBlockers(task.id).filter((id) => !dependencyIndex.isCompleted(id));
      const blockedCount = dependencyIndex
        .getBlocked(task.id)
        .filter((id) => !dependencyIndex.isCompleted(id)).length;
      const isBlocked = blockers.length > 0 && blockedEvaluator.isBlocked(task.id);
      const isBlocking = blockedCount > 0 && blockedEvaluator.isBlocking(task.id);

      const cycleMembers = cycleDetector.findCycleFrom(task.id);

      const scoreBreakdown = calculateAttentionScore(
        escalation.level,
        escalation.daysOverdue,
        priority.level,
        blockedCount,
        options.attentionSettings
      );

      const profile: AttentionProfile = {
        taskId: task.id,
        escalation: {
          level: escalation.level,
          daysOverdue: escalation.daysOverdue,
          label: escalation.label,
        },
        priority,
        dependency: {
          isBlocked,
          isBlocking,
          blockers,
          blockedCount,
          cycle: cycleMembers.length > 0 ? { detected: true, members: cycleMembers } : undefined,
        },
        score: scoreBreakdown.total,
        lane: "WATCHLIST",
        reasons: [],
      };

      profile.lane = assignAttentionLane(task, profile, options.attentionSettings);
      profile.reasons = buildAttentionReasons(profile, scoreBreakdown);

      profiles.set(task.id, profile);
    }

    this.cachedKey = cacheKey;
    this.cachedProfiles = profiles;
    return profiles;
  }

  private evaluatePriority(task: Task): { level: AttentionPriorityLevel; weight: number } {
    const normalized = normalizePriority(task.priority);
    const priorityLevel = this.mapPriority(normalized);
    const weightMap: Record<AttentionPriorityLevel, number> = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
      urgent: 4,
    };

    return {
      level: priorityLevel,
      weight: weightMap[priorityLevel] ?? 0,
    };
  }

  private mapPriority(priority: string | undefined): AttentionPriorityLevel {
    switch (priority) {
      case "highest":
        return "urgent";
      case "high":
        return "high";
      case "medium":
        return "medium";
      case "low":
      case "lowest":
        return "low";
      default:
        return "none";
    }
  }

  private buildCacheKey(
    tasks: Task[],
    attentionSettings: AttentionSettings,
    escalationSettings: EscalationSettings,
    referenceDate: Date
  ): string {
    const dayKey = referenceDate.toISOString().slice(0, 10);
    const settingsKey = JSON.stringify({ attentionSettings, escalationSettings });
    let hash = 0;
    for (const task of tasks) {
      hash = this.hashString(`${hash}|${task.id}|${task.updatedAt}|${task.status}|${task.dueAt}|${task.scheduledAt}|${task.priority}|${(task.dependsOn ?? []).join(",")}`);
    }
    return `${dayKey}::${settingsKey}::${hash}`;
  }

  private hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
