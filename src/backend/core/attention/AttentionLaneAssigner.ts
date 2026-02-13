import type { Task } from "@backend/core/models/Task";
import type { AttentionLane, AttentionProfile } from "@backend/core/attention/AttentionEngine";
import type { AttentionSettings } from "@backend/core/settings/PluginSettings";

export function assignAttentionLane(
  task: Task,
  profile: AttentionProfile,
  settings: AttentionSettings
): AttentionLane {
  if (profile.dependency.isBlocked) {
    return "BLOCKED";
  }

  if (
    profile.dependency.isBlocking &&
    (profile.score >= settings.lanes.doNowThreshold ||
      profile.dependency.blockedCount >= settings.lanes.unblockCountThreshold)
  ) {
    return "UNBLOCK_FIRST";
  }

  if (profile.score >= settings.lanes.doNowThreshold) {
    return "DO_NOW";
  }

  if (
    profile.score >= settings.lanes.watchlistThreshold ||
    (settings.treatScheduledAsWatchlist && !!task.scheduledAt && !task.dueAt)
  ) {
    return "WATCHLIST";
  }

  return "WATCHLIST";
}
