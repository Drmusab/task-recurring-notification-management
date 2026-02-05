import type {
  BlockActionTaskContext,
  BlockEvent,
  BlockTrigger,
  ConditionExpr,
} from "@backend/core/block-actions/BlockActionTypes";
import * as logger from "@shared/utils/misc/logger";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesRegex(content: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern, "m");
    return regex.test(content);
  } catch (error) {
    logger.warn("Invalid regex in block action trigger", { pattern, error });
    return false;
  }
}

export class BlockActionEvaluator {
  matchesTrigger(trigger: BlockTrigger, event: BlockEvent): boolean {
    switch (trigger.type) {
      case "contentMatches":
        if (event.type !== "contentChanged") return false;
        return matchesRegex(event.content, trigger.regex);
      case "contentNotMatches":
        if (event.type !== "contentChanged") return false;
        if (!event.previousContent) return false;
        return (
          matchesRegex(event.previousContent, trigger.regex) &&
          !matchesRegex(event.content, trigger.regex)
        );
      case "blockCompleted":
        if (event.type !== "contentChanged") return false;
        return /\[x\]/i.test(event.content);
      case "blockDeleted":
        return event.type === "deleted";
      case "blockEmpty":
        if (event.type !== "contentChanged") return false;
        return event.content.trim().length === 0;
      case "blockMoved":
        return event.type === "moved";
      case "blockCollapsed":
        return event.type === "collapsed" && event.collapsed;
      case "blockExpanded":
        return event.type === "collapsed" && !event.collapsed;
      case "contentHasTag":
        if (event.type !== "contentChanged") return false;
        if (!trigger.tag.trim()) return false;
        return new RegExp(`(^|\\s)#${escapeRegex(trigger.tag)}\\b`, "i").test(
          event.content
        );
      case "contentHasKeyword":
        if (event.type !== "contentChanged") return false;
        if (!trigger.keyword.trim()) return false;
        return new RegExp(`\\b${escapeRegex(trigger.keyword)}\\b`, "i").test(
          event.content
        );
      default:
        return false;
    }
  }

  matchesCondition(
    condition: ConditionExpr | undefined,
    task: BlockActionTaskContext
  ): boolean {
    if (!condition) return true;

    switch (condition.type) {
      case "all":
        return condition.conditions.every((expr) =>
          this.matchesCondition(expr, task)
        );
      case "any":
        return condition.conditions.some((expr) =>
          this.matchesCondition(expr, task)
        );
      case "not":
        return !this.matchesCondition(condition.condition, task);
      case "taskStatus":
        return (task.status ?? "todo") === condition.status;
      case "taskHasTag":
        return (task.tags ?? []).includes(condition.tag);
      case "taskPriority":
        return task.priority === condition.priority;
      default:
        return true;
    }
  }
}
