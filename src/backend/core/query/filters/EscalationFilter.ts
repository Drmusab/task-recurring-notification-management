import type { Task } from "@backend/core/models/Task";
import type { EscalationSettings } from "@backend/core/settings/PluginSettings";
import { evaluateEscalation } from "@backend/core/escalation/EscalationEvaluator";
import { Filter } from "@backend/core/query/filters/FilterBase";

export type EscalationComparator = "is" | "above" | "below" | "at-least" | "at-most";

export class EscalationFilter extends Filter {
  constructor(
    private comparator: EscalationComparator,
    private targetLevel: number,
    private referenceDate: Date,
    private settings?: EscalationSettings
  ) {
    super();
  }

  matches(task: Task): boolean {
    const result = evaluateEscalation(task, {
      settings: this.settings,
      referenceDate: this.referenceDate,
    });

    switch (this.comparator) {
      case "is":
        return result.level === this.targetLevel;
      case "above":
        return result.level > this.targetLevel;
      case "below":
        return result.level < this.targetLevel;
      case "at-least":
        return result.level >= this.targetLevel;
      case "at-most":
        return result.level <= this.targetLevel;
      default:
        return false;
    }
  }
}
