import type { TaskPriority } from "@backend/core/models/Task";

export type BlockTrigger =
  | { type: "contentMatches"; regex: string }
  | { type: "contentNotMatches"; regex: string }
  | { type: "blockCompleted" }
  | { type: "blockDeleted" }
  | { type: "blockEmpty" }
  | { type: "blockMoved" }
  | { type: "blockCollapsed" }
  | { type: "blockExpanded" }
  | { type: "contentHasTag"; tag: string }
  | { type: "contentHasKeyword"; keyword: string };

export type TaskAction =
  | { type: "setStatus"; status: "done" | "in_progress" | "cancelled" }
  | {
      type: "reschedule";
      mode: "relative" | "absolute";
      amountMinutes?: number;
      amountDays?: number;
      at?: string;
    }
  | { type: "triggerNextRecurrence" }
  | { type: "pauseRecurrence" }
  | { type: "addTag"; tag: string }
  | { type: "removeTag"; tag: string }
  | { type: "changePriority"; priority: TaskPriority }
  | { type: "addCompletionNote"; note: string }
  | { type: "sendWebhook"; url: string; payloadTemplate?: string }
  | { type: "notify"; message: string };

export type ConditionExpr =
  | { type: "all"; conditions: ConditionExpr[] }
  | { type: "any"; conditions: ConditionExpr[] }
  | { type: "not"; condition: ConditionExpr }
  | { type: "taskStatus"; status: "todo" | "done" | "cancelled" | "in_progress" }
  | { type: "taskHasTag"; tag: string }
  | { type: "taskPriority"; priority: TaskPriority };

export interface BlockLinkedAction {
  id: string;
  trigger: BlockTrigger;
  condition?: ConditionExpr;
  action: TaskAction;
  enabled: boolean;
}

export interface BlockActionTaskContext {
  status?: string;
  tags?: string[];
  priority?: TaskPriority;
}

export type BlockEvent =
  | {
      type: "contentChanged";
      blockId: string;
      content: string;
      previousContent?: string;
      timestamp: string;
      source?: "editor" | "system" | "task-action";
    }
  | {
      type: "deleted";
      blockId: string;
      timestamp: string;
      source?: "editor" | "system" | "task-action";
    }
  | {
      type: "moved";
      blockId: string;
      fromParentId?: string;
      toParentId?: string;
      fromDocumentId?: string;
      toDocumentId?: string;
      timestamp: string;
      source?: "editor" | "system" | "task-action";
    }
  | {
      type: "collapsed";
      blockId: string;
      collapsed: boolean;
      timestamp: string;
      source?: "editor" | "system" | "task-action";
    };

export interface BlockActionExecutionResult {
  taskId: string;
  actionId: string;
  executed: boolean;
  reason?: string;
  warning?: string;
}
