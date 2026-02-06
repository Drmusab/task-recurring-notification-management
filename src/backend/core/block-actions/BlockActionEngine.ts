// @ts-nocheck
import type { RecurrenceEngineRRULE } from "@backend/core/engine/recurrence/RecurrenceEngineRRULE";
import type { PluginSettings } from "@backend/core/settings/PluginSettings";
import type { Task } from "@backend/core/models/Task";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskRepository";
import { CompletionHandler } from "@backend/core/actions/CompletionHandler";
import * as logger from "@backend/logging/logger";
import {
  type BlockActionExecutionResult,
  type BlockActionTaskContext,
  type BlockEvent,
  type TaskAction,
} from "@backend/core/block-actions/BlockActionTypes";
import { BlockActionEvaluator } from "@backend/core/block-actions/BlockActionEvaluator";
import { BlockActionExplainer } from "@backend/core/block-actions/BlockActionExplainer";

interface BlockActionEngineOptions {
  repository: TaskRepositoryProvider;
  settingsProvider: () => PluginSettings;
  recurrenceEngine?: RecurrenceEngineRRULE;
}

export class BlockActionEngine {
  private evaluator = new BlockActionEvaluator();
  private explainer = new BlockActionExplainer();
  private inFlightTasks = new Set<string>();

  constructor(private options: BlockActionEngineOptions) {}

  async handleBlockEvent(event: BlockEvent): Promise<BlockActionExecutionResult[]> {
    const settings = this.options.settingsProvider();
    if (!settings.blockActions.enabled) {
      return [];
    }

    if (event.source === "task-action") {
      return [];
    }

    const linkedTasks = this.options.repository
      .getAllTasks()
      .filter((task) => task.linkedBlockId === event.blockId);

    const results: BlockActionExecutionResult[] = [];

    for (const task of linkedTasks) {
      if (!task.blockActions || task.blockActions.length === 0) {
        continue;
      }

      for (const action of task.blockActions) {
        if (!action.enabled) {
          continue;
        }
        if (this.inFlightTasks.has(task.id)) {
          results.push({
            taskId: task.id,
            actionId: action.id,
            executed: false,
            warning: "Task already processing a block action",
          });
          continue;
        }

        const taskContext: BlockActionTaskContext = {
          status: task.status,
          tags: task.tags,
          priority: task.priority,
        };

        const triggerMatches = this.evaluator.matchesTrigger(action.trigger, event);
        const conditionMatches = this.evaluator.matchesCondition(
          action.condition,
          taskContext
        );

        if (!triggerMatches || !conditionMatches) {
          continue;
        }

        this.inFlightTasks.add(task.id);
        try {
          const explanation = this.explainer.explain(
            action.action,
            action.trigger,
            event,
            action.condition
          );
          const updatedTask = await this.applyAction(task, action.action, settings);
          if (updatedTask) {
            await this.options.repository.saveTask(updatedTask);
          }

          logger.info("Block-linked action executed", {
            taskId: task.id,
            blockId: event.blockId,
            actionId: action.id,
            summary: explanation.summary,
            reasons: explanation.reasons,
          });

          results.push({
            taskId: task.id,
            actionId: action.id,
            executed: true,
            reason: explanation.summary,
          });
        } catch (error) {
          logger.error("Failed to execute block-linked action", {
            taskId: task.id,
            blockId: event.blockId,
            actionId: action.id,
            error,
          });
          results.push({
            taskId: task.id,
            actionId: action.id,
            executed: false,
            warning: error instanceof Error ? error.message : "Unknown error",
          });
        } finally {
          this.inFlightTasks.delete(task.id);
        }
      }
    }

    return results;
  }

  private async applyAction(
    task: Task,
    action: TaskAction,
    settings: PluginSettings
  ): Promise<Task | null> {
    const now = new Date();
    const updated: Task = { ...task, updatedAt: now.toISOString() };

    switch (action.type) {
      case "setStatus": {
        if (action.status === "done") {
          updated.status = "done";
          updated.statusSymbol = "x";
          updated.doneAt = now.toISOString();
          updated.lastCompletedAt = now.toISOString();
          updated.cancelledAt = undefined;
        } else if (action.status === "cancelled") {
          updated.status = "cancelled";
          updated.statusSymbol = "-";
          updated.cancelledAt = now.toISOString();
          updated.doneAt = undefined;
        } else {
          updated.status = "todo";
          updated.statusSymbol = "/";
        }
        return updated;
      }
      case "reschedule": {
        if (action.mode === "absolute") {
          if (!action.at) {
            return updated;
          }
          const target = new Date(action.at);
          if (Number.isNaN(target.getTime())) {
            logger.warn("Invalid reschedule date", { action });
            return updated;
          }
          updated.dueAt = target.toISOString();
        } else {
          const base = new Date(task.dueAt || new Date().toISOString());
          const deltaMinutes = action.amountMinutes ?? 0;
          const deltaDays = action.amountDays ?? 0;
          const newDate = new Date(
            base.getTime() + deltaMinutes * 60000 + deltaDays * 86400000
          );
          updated.dueAt = newDate.toISOString();
        }
        return updated;
      }
      case "triggerNextRecurrence": {
        if (!this.options.recurrenceEngine) {
          logger.warn("Recurrence engine unavailable for block action", {
            taskId: task.id,
          });
          return updated;
        }
        const completionHandler = new CompletionHandler(
          this.options.repository,
          this.options.recurrenceEngine,
          settings
        );
        const completionDate = new Date();
        const completedTask = {
          ...updated,
          status: "done",
          statusSymbol: "x",
          lastCompletedAt: completionDate.toISOString(),
          doneAt: completionDate.toISOString(),
        };
        await completionHandler.onComplete(completedTask, completionDate);
        return completedTask;
      }
      case "pauseRecurrence": {
        updated.enabled = false;
        return updated;
      }
      case "addTag": {
        const tags = new Set(updated.tags ?? []);
        tags.add(action.tag);
        updated.tags = Array.from(tags);
        return updated;
      }
      case "removeTag": {
        updated.tags = (updated.tags ?? []).filter((tag) => tag !== action.tag);
        return updated;
      }
      case "changePriority": {
        updated.priority = action.priority;
        return updated;
      }
      case "addCompletionNote": {
        const note = action.note.trim();
        if (!note) return updated;
        const existing = updated.description?.trim();
        updated.description = existing ? `${existing}\n\n${note}` : note;
        return updated;
      }
      case "sendWebhook": {
        logger.warn("Webhook notifications are not yet wired for block actions", {
          taskId: task.id,
          url: action.url,
        });
        return updated;
      }
      case "notify": {
        logger.info("Block action notification", {
          taskId: task.id,
          message: action.message,
        });
        return updated;
      }
      default:
        return null;
    }
  }
}
