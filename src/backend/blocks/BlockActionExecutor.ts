/**
 * BlockActionExecutor — Lifecycle-safe block action execution engine
 *
 * Replaces BlockActionEngine as the canonical action executor with:
 *   1. Lifecycle guard: no execution before activate() (onLayoutReady)
 *   2. Deterministic serial execution: one event at a time per task
 *   3. EventBus emission after every action (task:updated, task:complete)
 *   4. Retry integration: failed attribute writes go to BlockRetryQueue
 *   5. Proper CompletionHandler injection (no per-action instantiation)
 *
 * Required Execution Flow:
 *   BlockEventHandler
 *     → BlockActionExecutor.handleBlockEvent()
 *       → evaluator.matchesTrigger() + evaluator.matchesCondition()
 *       → applyAction()
 *       → repository.saveTask()
 *       → blockAttributeSync.syncTaskToBlock()
 *       → pluginEventBus.emit("task:updated" | "task:complete")
 *
 * FORBIDDEN:
 *   - Modifying markdown, DOM, or kramdown
 *   - Scanning all blocks
 *   - Bypassing TaskService (repository)
 *   - Importing Svelte
 *
 * Lifecycle:
 *   - Constructed in onload()
 *   - activate()   → called in onLayoutReady() after all deps are ready
 *   - deactivate() → called in onunload()
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskStorage";
import type { PluginSettings } from "@backend/core/settings/PluginSettings";
import type { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { BlockAttributeSync } from "@backend/blocks/BlockAttributeSync";
import { CompletionHandler } from "@backend/core/actions/CompletionHandler";
import { BlockActionEvaluator } from "@backend/core/block-actions/BlockActionEvaluator";
import { BlockActionExplainer } from "@backend/core/block-actions/BlockActionExplainer";
import type {
  BlockActionExecutionResult,
  BlockActionTaskContext,
  BlockEvent,
  TaskAction,
} from "@backend/core/block-actions/BlockActionTypes";
import * as logger from "@backend/logging/logger";

// ── Configuration ───────────────────────────────────────────

export interface BlockActionExecutorDeps {
  repository: TaskRepositoryProvider;
  settingsProvider: () => PluginSettings;
  pluginEventBus: PluginEventBus;
  blockAttributeSync: BlockAttributeSync;
  recurrenceEngine?: RecurrenceEngine;
}

// ── Implementation ──────────────────────────────────────────

export class BlockActionExecutor {
  private readonly repository: TaskRepositoryProvider;
  private readonly settingsProvider: () => PluginSettings;
  private readonly pluginEventBus: PluginEventBus;
  private readonly blockAttributeSync: BlockAttributeSync;
  private readonly recurrenceEngine?: RecurrenceEngine;

  private readonly evaluator = new BlockActionEvaluator();
  private readonly explainer = new BlockActionExplainer();

  /** Dedup: prevent concurrent action execution on the same task */
  private readonly inFlight = new Set<string>();

  /** Lifecycle gate: no execution permitted before activate() */
  private ready = false;

  /** Cached CompletionHandler — created once at activate(), not per-action */
  private completionHandler: CompletionHandler | null = null;

  constructor(deps: BlockActionExecutorDeps) {
    this.repository = deps.repository;
    this.settingsProvider = deps.settingsProvider;
    this.pluginEventBus = deps.pluginEventBus;
    this.blockAttributeSync = deps.blockAttributeSync;
    this.recurrenceEngine = deps.recurrenceEngine;
  }

  /**
   * Mark executor as ready for action processing.
   * MUST be called in onLayoutReady() after all dependencies are initialized.
   */
  activate(): void {
    this.ready = true;
    logger.info("[BlockActionExecutor] Activated — ready for block events");
  }

  /**
   * Stop processing and reject new events.
   * Call in onunload().
   */
  deactivate(): void {
    this.ready = false;
    this.inFlight.clear();
    this.completionHandler = null;
    logger.info("[BlockActionExecutor] Deactivated");
  }

  /**
   * Process a block event: find linked tasks, evaluate triggers + conditions,
   * execute matching actions, sync attributes, emit events.
   *
   * Returns empty array if executor is not active or block actions are disabled.
   */
  async handleBlockEvent(event: BlockEvent): Promise<BlockActionExecutionResult[]> {
    // ── Lifecycle guard ──
    if (!this.ready) {
      logger.debug("[BlockActionExecutor] Event rejected — not active", {
        eventType: event.type,
        blockId: event.blockId,
      });
      return [];
    }

    // ── Settings guard ──
    const settings = this.settingsProvider();
    if (!settings.blockActions?.enabled) {
      return [];
    }

    // ── Ignore self-triggered events (prevent loops) ──
    if (event.source === "task-action") {
      return [];
    }

    // ── Find linked tasks via O(1) index lookup ──
    const linkedTask = this.repository.getTaskByBlockId(event.blockId);
    if (!linkedTask || !linkedTask.blockActions || linkedTask.blockActions.length === 0) {
      return [];
    }

    // ── Deterministic serial execution on one task ──
    return this.executeForTask(linkedTask, event, settings);
  }

  // ── Private: Per-task execution ─────────────────────────────

  private async executeForTask(
    task: Task,
    event: BlockEvent,
    settings: PluginSettings
  ): Promise<BlockActionExecutionResult[]> {
    // Dedup guard
    if (this.inFlight.has(task.id)) {
      return [{
        taskId: task.id,
        actionId: "",
        executed: false,
        warning: "Task already processing a block action",
      }];
    }

    this.inFlight.add(task.id);
    const results: BlockActionExecutionResult[] = [];

    try {
      for (const action of task.blockActions!) {
        if (!action.enabled) continue;

        const taskContext: BlockActionTaskContext = {
          status: task.status,
          tags: task.tags,
          priority: task.priority,
        };

        // Evaluate trigger + condition
        const triggerMatch = this.evaluator.matchesTrigger(action.trigger, event);
        const conditionMatch = this.evaluator.matchesCondition(action.condition, taskContext);

        if (!triggerMatch || !conditionMatch) continue;

        // Generate human-readable explanation for logging
        const explanation = this.explainer.explain(
          action.action,
          action.trigger,
          event,
          action.condition
        );

        try {
          // ── Execute the action ──
          const updatedTask = await this.applyAction(task, action.action, settings);

          if (updatedTask) {
            // ── Persist to TaskService ──
            await this.repository.saveTask(updatedTask);

            // ── Sync attributes to block (with retry on failure) ──
            const blockId = updatedTask.linkedBlockId || updatedTask.blockId;
            if (blockId) {
              await this.blockAttributeSync.syncTaskToBlock(updatedTask, blockId);
            }

            // ── Emit PluginEventBus events for frontend reactivity ──
            this.emitEvents(updatedTask, action.action);
          }

          logger.info("[BlockActionExecutor] Action executed", {
            taskId: task.id,
            blockId: event.blockId,
            actionId: action.id,
            summary: explanation.summary,
          });

          results.push({
            taskId: task.id,
            actionId: action.id,
            executed: true,
            reason: explanation.summary,
          });
        } catch (error) {
          logger.error("[BlockActionExecutor] Action failed", {
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
        }
      }
    } finally {
      this.inFlight.delete(task.id);
    }

    return results;
  }

  // ── Action Application ──────────────────────────────────────

  private async applyAction(
    task: Task,
    action: TaskAction,
    settings: PluginSettings
  ): Promise<Task | null> {
    const now = new Date();
    const base: Task = { ...task, updatedAt: now.toISOString() };

    switch (action.type) {
      case "setStatus": {
        if (action.status === "done") {
          return {
            ...base,
            status: "done" as const,
            statusSymbol: "x",
            doneAt: now.toISOString(),
            lastCompletedAt: now.toISOString(),
            cancelledAt: undefined,
          };
        } else if (action.status === "cancelled") {
          return {
            ...base,
            status: "cancelled" as const,
            statusSymbol: "-",
            cancelledAt: now.toISOString(),
            doneAt: undefined,
          };
        } else {
          return {
            ...base,
            status: "todo" as const,
            statusSymbol: "/",
          };
        }
      }

      case "reschedule": {
        if (action.mode === "absolute") {
          if (!action.at) return base;
          const target = new Date(action.at);
          if (Number.isNaN(target.getTime())) {
            logger.warn("[BlockActionExecutor] Invalid reschedule date", { action });
            return base;
          }
          return { ...base, dueAt: target.toISOString() };
        } else {
          const baseDate = new Date(task.dueAt || new Date().toISOString());
          const deltaMinutes = action.amountMinutes ?? 0;
          const deltaDays = action.amountDays ?? 0;
          return {
            ...base,
            dueAt: new Date(
              baseDate.getTime() + deltaMinutes * 60000 + deltaDays * 86400000
            ).toISOString(),
          };
        }
      }

      case "triggerNextRecurrence": {
        const handler = this.getCompletionHandler(settings);
        if (!handler) {
          logger.warn("[BlockActionExecutor] RecurrenceEngine unavailable", {
            taskId: task.id,
          });
          return base;
        }
        const completionDate = new Date();
        const completedTask: Task = {
          ...base,
          status: "done" as const,
          statusSymbol: "x",
          lastCompletedAt: completionDate.toISOString(),
          doneAt: completionDate.toISOString(),
        };
        await handler.onComplete(completedTask, completionDate);
        return completedTask;
      }

      case "pauseRecurrence": {
        return { ...base, enabled: false };
      }

      case "addTag": {
        const tags = new Set(base.tags ?? []);
        tags.add(action.tag);
        return { ...base, tags: Array.from(tags) };
      }

      case "removeTag": {
        return { ...base, tags: (base.tags ?? []).filter((tag) => tag !== action.tag) };
      }

      case "changePriority": {
        return { ...base, priority: action.priority };
      }

      case "addCompletionNote": {
        const note = action.note.trim();
        if (!note) return base;
        const existing = base.description?.trim();
        return { ...base, description: existing ? `${existing}\n\n${note}` : note };
      }

      case "sendWebhook": {
        logger.warn("[BlockActionExecutor] Webhook not yet implemented", {
          taskId: task.id,
          url: action.url,
        });
        return base;
      }

      case "notify": {
        logger.info("[BlockActionExecutor] Notification", {
          taskId: task.id,
          message: action.message,
        });
        return base;
      }

      default:
        return null;
    }
  }

  // ── Event Emission ──────────────────────────────────────────

  /**
   * Emit appropriate PluginEventBus events based on the action type.
   */
  private emitEvents(task: Task, action: TaskAction): void {
    // Always emit task:updated for any mutation
    this.pluginEventBus.emit("task:updated", { taskId: task.id });

    // Emit specific events for completion and rescheduling
    switch (action.type) {
      case "setStatus":
        if (action.status === "done") {
          this.pluginEventBus.emit("task:complete", { taskId: task.id, task });
        }
        break;

      case "triggerNextRecurrence":
        this.pluginEventBus.emit("task:complete", { taskId: task.id, task });
        break;

      case "reschedule":
        this.pluginEventBus.emit("task:reschedule", {
          taskId: task.id,
          delayMinutes: 0, // Block-action-driven reschedule
          task,
        });
        break;
    }

    // Always request a frontend refresh
    this.pluginEventBus.emit("task:refresh", undefined as unknown as void);
  }

  // ── Helpers ─────────────────────────────────────────────────

  /**
   * Get or create the CompletionHandler (cached, not per-action).
   * Returns null if RecurrenceEngine is not available.
   */
  private getCompletionHandler(settings: PluginSettings): CompletionHandler | null {
    if (!this.recurrenceEngine) return null;

    if (!this.completionHandler) {
      this.completionHandler = new CompletionHandler(
        this.repository, // TaskRepositoryProvider structurally satisfies CompletionHandler.TaskStorage
        this.recurrenceEngine,
        settings
      );
    }

    return this.completionHandler;
  }
}
