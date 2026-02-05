import type { AttentionLane, AttentionProfile } from "@backend/core/attention/AttentionEngine";
import { Filter } from "@backend/core/query/filters/FilterBase";

export type AttentionComparator = "is" | "above" | "below" | "at-least" | "at-most";

export interface AttentionProfileProvider {
  getProfile(taskId: string): AttentionProfile | undefined;
}

export class AttentionScoreFilter extends Filter {
  constructor(
    private comparator: AttentionComparator,
    private targetScore: number,
    private provider: AttentionProfileProvider
  ) {
    super();
  }

  matches(task: { id: string }): boolean {
    const profile = this.provider.getProfile(task.id);
    if (!profile) {
      return false;
    }

    switch (this.comparator) {
      case "is":
        return profile.score === this.targetScore;
      case "above":
        return profile.score > this.targetScore;
      case "below":
        return profile.score < this.targetScore;
      case "at-least":
        return profile.score >= this.targetScore;
      case "at-most":
        return profile.score <= this.targetScore;
      default:
        return false;
    }
  }
}

export class AttentionLaneFilter extends Filter {
  constructor(private lane: AttentionLane, private provider: AttentionProfileProvider) {
    super();
  }

  matches(task: { id: string }): boolean {
    const profile = this.provider.getProfile(task.id);
    if (!profile) {
      return false;
    }
    return profile.lane === this.lane;
  }
}
