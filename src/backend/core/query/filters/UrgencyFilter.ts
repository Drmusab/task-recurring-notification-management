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
}
