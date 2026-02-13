import type { Task } from "@backend/core/models/Task";
import type { UrgencySettings } from "@backend/core/urgency/UrgencySettings";
import { calculateUrgencyScore } from "@backend/core/urgency/UrgencyScoreCalculator";
import { Filter } from "@backend/core/query/filters/FilterBase";

export type UrgencyComparator = "is" | "above" | "below";

export class UrgencyFilter extends Filter {
  constructor(
    private comparator: UrgencyComparator,
    private threshold: number,
    private referenceDate: Date,
    private settings: UrgencySettings
  ) {
    super();
  }

  matches(task: Task): boolean {
    const score = calculateUrgencyScore(task, {
      now: this.referenceDate,
      settings: this.settings,
    });

    switch (this.comparator) {
      case "above":
        return score > this.threshold;
      case "below":
        return score < this.threshold;
      case "is":
        return score === this.threshold;
      default:
        return false;
    }
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    const op = { is: '=', above: '>', below: '<' }[this.comparator];
    return `urgency ${op} ${this.threshold.toFixed(1)}`;
  }

  explainMatch(task: Task): string {
    const score = calculateUrgencyScore(task, {
      now: this.referenceDate,
      settings: this.settings,
    });
    const opDesc = { is: 'equals', above: 'is greater than', below: 'is less than' }[this.comparator];
    return `Task "${task.name}" has urgency score ${score.toFixed(1)} which ${opDesc} ${this.threshold.toFixed(1)}`;
  }

  explainMismatch(task: Task): string {
    const score = calculateUrgencyScore(task, {
      now: this.referenceDate,
      settings: this.settings,
    });
    const opDesc = { is: 'does not equal', above: 'is not greater than', below: 'is not less than' }[this.comparator];
    return `Task "${task.name}" has urgency score ${score.toFixed(1)} which ${opDesc} ${this.threshold.toFixed(1)}`;
  }
}
