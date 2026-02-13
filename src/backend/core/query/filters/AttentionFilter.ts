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

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    const op = { is: '=', above: '>', below: '<', 'at-least': '>=', 'at-most': '<=' }[this.comparator];
    return `attention score ${op} ${this.targetScore.toFixed(1)}`;
  }

  explainMatch(task: { id: string; name?: string }): string {
    const profile = this.provider.getProfile(task.id);
    const score = profile ? profile.score.toFixed(1) : 'N/A';
    const opDesc = {
      is: 'equals',
      above: 'is greater than',
      below: 'is less than',
      'at-least': 'is at least',
      'at-most': 'is at most'
    }[this.comparator];
    const taskName = (task as any).name || task.id;
    return `Task "${taskName}" has attention score ${score} which ${opDesc} ${this.targetScore.toFixed(1)}`;
  }

  explainMismatch(task: { id: string; name?: string }): string {
    const profile = this.provider.getProfile(task.id);
    if (!profile) {
      const taskName = (task as any).name || task.id;
      return `Task "${taskName}" has no attention profile`;
    }
    const score = profile.score.toFixed(1);
    const opDesc = {
      is: 'does not equal',
      above: 'is not greater than',
      below: 'is not less than',
      'at-least': 'is less than',
      'at-most': 'is greater than'
    }[this.comparator];
    const taskName = (task as any).name || task.id;
    return `Task "${taskName}" has attention score ${score} which ${opDesc} ${this.targetScore.toFixed(1)}`;
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

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return `attention lane is "${this.lane}"`;
  }

  explainMatch(task: { id: string; name?: string }): string {
    const profile = this.provider.getProfile(task.id);
    const lane = profile ? profile.lane : 'N/A';
    const taskName = (task as any).name || task.id;
    return `Task "${taskName}" is in attention lane "${lane}"`;
  }

  explainMismatch(task: { id: string; name?: string }): string {
    const profile = this.provider.getProfile(task.id);
    if (!profile) {
      const taskName = (task as any).name || task.id;
      return `Task "${taskName}" has no attention profile`;
    }
    const lane = profile.lane;
    const taskName = (task as any).name || task.id;
    return `Task "${taskName}" is in attention lane "${lane}" (expected "${this.lane}")`;
  }
}
