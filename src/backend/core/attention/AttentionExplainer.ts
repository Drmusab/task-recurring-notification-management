import type { AttentionProfile } from "@backend/core/attention/AttentionEngine";
import type { AttentionScoreBreakdown } from "@backend/core/attention/AttentionScoring";

export function buildAttentionReasons(
  profile: AttentionProfile,
  breakdown: AttentionScoreBreakdown
): string[] {
  const reasons: string[] = [];

  if (profile.escalation.level > 0) {
    reasons.push(`${profile.escalation.label} overdue (+${Math.round(breakdown.escalationBase)})`);
  } else {
    reasons.push("On-time (+0)");
  }

  if (breakdown.escalationOverdueBoost > 0) {
    reasons.push(`Overdue ${profile.escalation.daysOverdue}d (+${Math.round(breakdown.escalationOverdueBoost)})`);
  }

  if (profile.priority.level !== "none") {
    reasons.push(`Priority ${profile.priority.level} (+${Math.round(breakdown.priorityScore)})`);
  }

  if (profile.dependency.isBlocking && breakdown.dependencyScore > 0) {
    reasons.push(`Blocks ${profile.dependency.blockedCount} task(s) (+${Math.round(breakdown.dependencyScore)})`);
  }

  if (profile.dependency.isBlocked) {
    reasons.push(`Blocked by ${profile.dependency.blockers.length} task(s)`);
  }

  if (profile.dependency.cycle?.detected) {
    reasons.push("Dependency cycle detected");
  }

  switch (profile.lane) {
    case "DO_NOW":
      reasons.push("Not blocked → DO_NOW lane");
      break;
    case "UNBLOCK_FIRST":
      reasons.push("Blocking others → UNBLOCK_FIRST lane");
      break;
    case "BLOCKED":
      reasons.push("Blocked → BLOCKED lane");
      break;
    case "WATCHLIST":
      reasons.push("Monitoring → WATCHLIST lane");
      break;
  }

  return reasons;
}
