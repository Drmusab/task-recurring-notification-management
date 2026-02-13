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

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    const op = { is: '=', above: '>', below: '<', 'at-least': '>=', 'at-most': '<=' }[this.comparator];
    return `escalation ${op} ${this.targetLevel}`;
  }

  explainMatch(task: Task): string {
    const result = evaluateEscalation(task, {
      settings: this.settings,
      referenceDate: this.referenceDate,
    });
    const opDesc = {
      is: 'equals',
      above: 'is greater than',
      below: 'is less than',
      'at-least': 'is at least',
      'at-most': 'is at most'
    }[this.comparator];
    return `Task "${task.name}" has escalation level ${result.level} which ${opDesc} ${this.targetLevel}`;
  }

  explainMismatch(task: Task): string {
    const result = evaluateEscalation(task, {
      settings: this.settings,
      referenceDate: this.referenceDate,
    });
    const opDesc = {
      is: 'does not equal',
      above: 'is not greater than',
      below: 'is not less than',
      'at-least': 'is less than',
      'at-most': 'is greater than'
    }[this.comparator];
    return `Task "${task.name}" has escalation level ${result.level} which ${opDesc} ${this.targetLevel}`;
  }
}
