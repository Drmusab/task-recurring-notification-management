import type { Task } from "@backend/core/models/Task";
import type { AttentionProfile } from "@backend/core/attention/AttentionEngine";
import type { AttentionSettings, EscalationSettings } from "@backend/core/settings/PluginSettings";
import type { AttentionEngine } from "@backend/core/attention/AttentionEngine";

export interface AttentionQueryFields {
  profiles: Map<string, AttentionProfile>;
  getProfile(taskId: string): AttentionProfile | undefined;
}

export function buildAttentionQueryFields(
  engine: AttentionEngine,
  tasks: Task[],
  settings: AttentionSettings,
  escalationSettings: EscalationSettings,
  referenceDate: Date
): AttentionQueryFields {
  const profiles = engine.getAttentionProfiles(tasks, {
    attentionSettings: settings,
    escalationSettings,
    referenceDate,
  });
  return {
    profiles,
    getProfile: (taskId: string) => profiles.get(taskId),
  };
}
