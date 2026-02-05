import type {
  BlockEvent,
  BlockTrigger,
  ConditionExpr,
  TaskAction,
} from "@backend/core/block-actions/BlockActionTypes";

export interface BlockActionExplanation {
  summary: string;
  reasons: string[];
}

function describeTrigger(trigger: BlockTrigger): string {
  switch (trigger.type) {
    case "contentMatches":
      return `Block content matched regex ${trigger.regex}`;
    case "contentNotMatches":
      return `Block content no longer matched regex ${trigger.regex}`;
    case "blockCompleted":
      return "Block checkbox marked completed";
    case "blockDeleted":
      return "Linked block was deleted";
    case "blockEmpty":
      return "Block content became empty";
    case "blockMoved":
      return "Linked block moved";
    case "blockCollapsed":
      return "Block collapsed";
    case "blockExpanded":
      return "Block expanded";
    case "contentHasTag":
      return `Block content contains tag #${trigger.tag}`;
    case "contentHasKeyword":
      return `Block content contains keyword "${trigger.keyword}"`;
    default:
      return "Block trigger matched";
  }
}

function describeCondition(condition?: ConditionExpr): string | null {
  if (!condition) return null;

  switch (condition.type) {
    case "all":
      return `All conditions met (${condition.conditions.length})`;
    case "any":
      return `Any condition met (${condition.conditions.length})`;
    case "not":
      return "Negated condition matched";
    case "taskStatus":
      return `Task status is ${condition.status}`;
    case "taskHasTag":
      return `Task has tag ${condition.tag}`;
    case "taskPriority":
      return `Task priority is ${condition.priority}`;
    default:
      return null;
  }
}

function describeAction(action: TaskAction): string {
  switch (action.type) {
    case "setStatus":
      return `Task marked ${action.status.replace("_", " ")}`;
    case "reschedule":
      return action.mode === "absolute"
        ? `Task rescheduled to ${action.at ?? "(missing date)"}`
        : `Task rescheduled by ${action.amountDays ?? 0} days and ${action.amountMinutes ?? 0} minutes`;
    case "triggerNextRecurrence":
      return "Next recurrence triggered immediately";
    case "pauseRecurrence":
      return "Recurrence paused";
    case "addTag":
      return `Tag added: ${action.tag}`;
    case "removeTag":
      return `Tag removed: ${action.tag}`;
    case "changePriority":
      return `Priority set to ${action.priority}`;
    case "addCompletionNote":
      return "Completion note added";
    case "sendWebhook":
      return "Webhook notification sent";
    case "notify":
      return "User notification sent";
    default:
      return "Task action executed";
  }
}

export class BlockActionExplainer {
  explain(
    action: TaskAction,
    trigger: BlockTrigger,
    event: BlockEvent,
    condition?: ConditionExpr
  ): BlockActionExplanation {
    const reasons = [
      describeTrigger(trigger),
      `Block event: ${event.type}`,
    ];
    const conditionDescription = describeCondition(condition);
    if (conditionDescription) {
      reasons.push(conditionDescription);
    }

    return {
      summary: describeAction(action),
      reasons,
    };
  }
}
