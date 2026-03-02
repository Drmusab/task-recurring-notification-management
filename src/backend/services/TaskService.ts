/**
 * TaskService — Central Task Mutation Gateway
 *
 * The ONLY module allowed to create, update, complete, reschedule,
 * delete, or generate recurrence for tasks. Every mutation MUST flow
 * through this service to guarantee:
 *
 *   1. Consistent event emission via EventService
 *   2. Block attribute sync via SyncService
 *   3. Cache invalidation via EventService.emitCacheInvalidation()
 *   4. Recurrence generation via RecurrenceEngine
 *   5. Audit trail via logger
 *
 * Operations:
 *   createTask(data)          → validate → persist → sync block → emit saved
 *   updateTask(taskId, patch) → load → merge → persist → sync block → emit updated
 *   completeTask(taskId)      → load → mark done → gen next → persist → emit completed
 *   rescheduleTask(id, delay) → load → shift dueAt → persist → emit rescheduled
 *   deleteTask(taskId)        → load → remove → clear block → emit deleted
 *   generateRecurrence(task)  → RecurrenceEngine.next() → persist new dueAt
 *
 * Integration points:
 *   EventService    — emit typed lifecycle + runtime events
 *   TaskStorage     — persist/load task data
 *   RecurrenceEngine — compute next occurrence
 *   SyncService     — write block attributes after mutation
 *
 * Lifecycle:
 *   - Constructed (no side effects)
 *   - start() → mark active
 *   - stop()  → mark inactive
 *
 * FORBIDDEN:
 *   - Parse markdown
 *   - Access DOM
 *   - Fire webhook directly (delegate to IntegrationService)
 *   - Scan all blocks
 *   - Bypass TaskStorage for persistence
 *   - Import frontend / Svelte
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskStorage } from "@backend/core/storage/TaskStorage";
import type { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import type { EventService } from "./EventService";
import type { SyncService } from "./SyncService";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface TaskServiceDeps {
  taskStorage: TaskStorage;
  recurrenceEngine: RecurrenceEngine;
  eventService: EventService;
  syncService: SyncService;
}

export interface CreateTaskInput {
  name: string;
  dueAt: string;
  recurrence?: { rrule: string; dtstart?: string };
  enabled?: boolean;
  priority?: string;
  tags?: string[];
  category?: string;
  blockId?: string;
  rootId?: string;
  workspaceId?: string;
}

export interface UpdateTaskPatch {
  name?: string;
  dueAt?: string;
  enabled?: boolean;
  priority?: string;
  tags?: string[];
  category?: string;
  recurrence?: { rrule: string; dtstart?: string };
  blockId?: string;
}

export interface TaskMutationResult {
  success: boolean;
  task?: Task;
  error?: string;
}

export interface CompletionResult extends TaskMutationResult {
  nextDueAt?: string;
  recurrenceGenerated: boolean;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class TaskService {
  private readonly storage: TaskStorage;
  private readonly recurrenceEngine: RecurrenceEngine;
  private readonly eventService: EventService;
  private readonly syncService: SyncService;
  private active = false;

  constructor(deps: TaskServiceDeps) {
    this.storage = deps.taskStorage;
    this.recurrenceEngine = deps.recurrenceEngine;
    this.eventService = deps.eventService;
    this.syncService = deps.syncService;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[TaskService] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    logger.info("[TaskService] Stopped");
  }

  // ── Mutation API ─────────────────────────────────────────────

  /**
   * Create a new task from input data.
   *
   * Flow: validate → persist → sync block attrs → emit task:saved
   */
  async createTask(input: CreateTaskInput): Promise<TaskMutationResult> {
    this.requireActive("createTask");

    try {
      const now = new Date().toISOString();
      const task: Task = {
        id: this.generateId(),
        name: input.name,
        dueAt: input.dueAt,
        enabled: input.enabled ?? true,
        priority: (input.priority || "medium") as Task["priority"],
        tags: input.tags || [],
        category: input.category || "",
        recurrence: input.recurrence ? {
          rrule: input.recurrence.rrule,
          dtstart: input.recurrence.dtstart || input.dueAt,
        } : undefined,
        blockId: input.blockId,
        rootId: input.rootId,
        workspaceId: input.workspaceId,
        createdAt: now,
        status: "todo",
      } as unknown as Task;

      await this.storage.saveTask(task);

      // Sync block attributes if block-linked
      if (task.blockId) {
        await this.syncService.syncTaskToBlock(task, task.blockId);
      }

      this.eventService.emitTaskSaved(task, true);
      this.eventService.emitCacheInvalidation("single", task.id);
      this.eventService.emitQueryInvalidation("single", "task:created", task.id);
      this.eventService.emitRefresh();

      logger.info("[TaskService] Task created", { taskId: task.id, name: task.name });
      return { success: true, task };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error("[TaskService] createTask failed", { error: msg, input });
      return { success: false, error: msg };
    }
  }

  /**
   * Update an existing task with a partial patch.
   *
   * Flow: load → merge → persist → sync block → emit updated
   */
  async updateTask(taskId: string, patch: UpdateTaskPatch): Promise<TaskMutationResult> {
    this.requireActive("updateTask");

    try {
      const existing = this.storage.getTask(taskId);
      if (!existing) {
        return { success: false, error: `Task not found: ${taskId}` };
      }

      const previousDueAt = existing.dueAt;
      const merged: Task = { ...existing, ...patch } as Task;

      await this.storage.saveTask(merged);

      // Sync block attributes if block-linked
      const blockId = merged.blockId || merged.linkedBlockId;
      if (blockId) {
        await this.syncService.syncTaskToBlock(merged, blockId);
      }

      this.eventService.emitTaskSaved(merged, false);
      this.eventService.emitTaskUpdated(taskId);
      this.eventService.emitCacheInvalidation("single", taskId);
      this.eventService.emitQueryInvalidation("single", "task:updated", taskId);
      this.eventService.emitRefresh();

      // If dueAt changed, emit runtime rescheduled
      if (patch.dueAt && patch.dueAt !== previousDueAt) {
        this.eventService.emitRuntimeRescheduled(
          taskId,
          previousDueAt,
          patch.dueAt,
          "manual_update",
        );
      }

      logger.info("[TaskService] Task updated", { taskId, patchKeys: Object.keys(patch) });
      return { success: true, task: merged };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error("[TaskService] updateTask failed", { error: msg, taskId });
      return { success: false, error: msg };
    }
  }

  /**
   * Complete a task and generate next recurrence if applicable.
   *
   * Flow: load → mark done → generate next occurrence → persist → sync block → emit
   */
  async completeTask(taskId: string): Promise<CompletionResult> {
    this.requireActive("completeTask");

    try {
      const task = this.storage.getTask(taskId);
      if (!task) {
        return { success: false, recurrenceGenerated: false, error: `Task not found: ${taskId}` };
      }

      const now = new Date();
      const completedAt = now.toISOString();
      let nextDueAt: string | undefined;
      let recurrenceGenerated = false;

      // Build update via immutable spread — no direct mutation
      let updated: Task = { ...task, lastCompletedAt: completedAt, status: "done" as Task["status"] };

      // Generate next occurrence if recurring
      if (task.recurrence?.rrule) {
        const nextDate = this.recurrenceEngine.next(task as never, now);
        if (nextDate) {
          nextDueAt = nextDate.toISOString();
          updated = { ...updated, dueAt: nextDueAt, status: "todo" as Task["status"] };
          recurrenceGenerated = true;
        }
      }

      await this.storage.saveTask(updated);

      // Sync block attributes
      const blockId = updated.blockId || updated.linkedBlockId;
      if (blockId) {
        if (recurrenceGenerated) {
          await this.syncService.syncTaskToBlock(updated, blockId);
        } else {
          await this.syncService.markBlockCompleted(blockId, taskId);
        }
      }

      // Emit events
      this.eventService.emitTaskCompleted(taskId, updated);
      this.eventService.emitRuntimeCompleted(taskId, completedAt, nextDueAt);
      this.eventService.emitCacheInvalidation("single", taskId);
      this.eventService.emitRefresh();

      if (recurrenceGenerated && nextDueAt && task.recurrence?.rrule) {
        this.eventService.emitRuntimeRecurrence(taskId, nextDueAt, task.recurrence.rrule);
      }

      // Emit escalation resolved
      this.eventService.emitEscalationResolved(taskId, "completed");

      logger.info("[TaskService] Task completed", {
        taskId,
        recurrenceGenerated,
        nextDueAt,
      });

      return { success: true, task, nextDueAt, recurrenceGenerated };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error("[TaskService] completeTask failed", { error: msg, taskId });
      return { success: false, recurrenceGenerated: false, error: msg };
    }
  }

  /**
   * Reschedule a task by delaying its dueAt.
   *
   * Flow: load → compute new dueAt → persist → sync block → emit
   */
  async rescheduleTask(
    taskId: string,
    delayMinutes: number,
    reason: string = "user_reschedule",
  ): Promise<TaskMutationResult> {
    this.requireActive("rescheduleTask");

    try {
      const task = this.storage.getTask(taskId);
      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }

      const previousDueAt = task.dueAt;
      const dueDate = new Date(task.dueAt);
      dueDate.setMinutes(dueDate.getMinutes() + delayMinutes);
      const newDueAt = dueDate.toISOString();

      // Immutable update — no direct mutation
      const updated: Task = { ...task, dueAt: newDueAt };
      await this.storage.saveTask(updated);

      // Sync block attributes
      const blockId = updated.blockId || updated.linkedBlockId;
      if (blockId) {
        await this.syncService.syncTaskToBlock(updated, blockId);
      }

      this.eventService.emitRuntimeRescheduled(taskId, previousDueAt, newDueAt, reason);
      this.eventService.emitTaskSaved(updated, false);
      this.eventService.emitTaskUpdated(taskId);
      this.eventService.emitCacheInvalidation("single", taskId);
      this.eventService.emitEscalationResolved(taskId, "rescheduled");
      this.eventService.emitRefresh();

      logger.info("[TaskService] Task rescheduled", {
        taskId,
        delayMinutes,
        reason,
        newDueAt,
      });

      return { success: true, task };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error("[TaskService] rescheduleTask failed", { error: msg, taskId });
      return { success: false, error: msg };
    }
  }

  /**
   * Delete a task permanently.
   *
   * Flow: load → clear block attrs → remove from storage → emit
   */
  async deleteTask(taskId: string): Promise<TaskMutationResult> {
    this.requireActive("deleteTask");

    try {
      const task = this.storage.getTask(taskId);
      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }

      // Clear block attributes before deletion
      const blockId = task.blockId || task.linkedBlockId;
      if (blockId) {
        await this.syncService.clearTaskAttributes(blockId);
      }

      await this.storage.deleteTask(taskId);

      this.eventService.emitCacheInvalidation("single", taskId);
      this.eventService.emitQueryInvalidation("single", "task:deleted", taskId);
      this.eventService.emitEscalationResolved(taskId, "deleted");
      this.eventService.emitRuntimeDeleted(taskId, task);
      this.eventService.emitRefresh();

      logger.info("[TaskService] Task deleted", { taskId });
      return { success: true, task };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error("[TaskService] deleteTask failed", { error: msg, taskId });
      return { success: false, error: msg };
    }
  }

  /**
   * Generate the next recurrence for a task without completing it.
   * Used by scheduler when advancing to next occurrence after miss.
   */
  async generateRecurrence(taskId: string): Promise<TaskMutationResult> {
    this.requireActive("generateRecurrence");

    try {
      const task = this.storage.getTask(taskId);
      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }

      if (!task.recurrence?.rrule) {
        return { success: false, error: `Task has no recurrence rule: ${taskId}` };
      }

      const refDate = new Date(task.dueAt);
      const nextDate = this.recurrenceEngine.next(task as never, refDate);
      if (!nextDate) {
        return { success: false, error: `No more occurrences for: ${taskId}` };
      }

      const previousDueAt = task.dueAt;
      const nextDueAt = nextDate.toISOString();

      // Immutable update — no direct mutation
      const updated: Task = { ...task, dueAt: nextDueAt };
      await this.storage.saveTask(updated);

      // Sync block
      const blockId = updated.blockId || updated.linkedBlockId;
      if (blockId) {
        await this.syncService.syncTaskToBlock(updated, blockId);
      }

      this.eventService.emitRuntimeRecurrence(taskId, nextDueAt, task.recurrence.rrule);
      this.eventService.emitRuntimeRescheduled(taskId, previousDueAt, nextDueAt, "recurrence_advance");
      this.eventService.emitTaskSaved(updated, false);
      this.eventService.emitTaskUpdated(taskId);
      this.eventService.emitCacheInvalidation("single", taskId);
      this.eventService.emitRefresh();

      logger.info("[TaskService] Recurrence generated", { taskId, nextDueAt });
      return { success: true, task };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error("[TaskService] generateRecurrence failed", { error: msg, taskId });
      return { success: false, error: msg };
    }
  }

  // ── Dependency Management ─────────────────────────────────────

  /**
   * Link a dependency between two tasks.
   *
   * Flow: load source → add target to dependsOn → persist → emit
   */
  async linkDependency(
    sourceTaskId: string,
    targetTaskId: string,
    type: string = "blockedBy",
  ): Promise<TaskMutationResult> {
    this.requireActive("linkDependency");

    try {
      const source = this.storage.getTask(sourceTaskId);
      if (!source) {
        return { success: false, error: `Source task not found: ${sourceTaskId}` };
      }

      const target = this.storage.getTask(targetTaskId);
      if (!target) {
        return { success: false, error: `Target task not found: ${targetTaskId}` };
      }

      // Immutable update — no direct mutation
      const deps: readonly string[] = source.dependsOn ?? [];
      if (deps.includes(targetTaskId)) {
        return { success: true, task: source }; // Already linked
      }
      const updated: Task = { ...source, dependsOn: [...deps, targetTaskId] };

      await this.storage.saveTask(updated);

      this.eventService.emitCacheInvalidation("single", sourceTaskId);
      this.eventService.emitTaskUpdated(sourceTaskId);
      this.eventService.emitRefresh();

      logger.info("[TaskService] Dependency linked", { sourceTaskId, targetTaskId, type });
      return { success: true, task: updated };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error("[TaskService] linkDependency failed", { error: msg, sourceTaskId, targetTaskId });
      return { success: false, error: msg };
    }
  }

  /**
   * Unlink a dependency between two tasks.
   *
   * Flow: load source → remove target from dependsOn → persist → emit
   */
  async unlinkDependency(
    sourceTaskId: string,
    targetTaskId: string,
    type: string = "blockedBy",
  ): Promise<TaskMutationResult> {
    this.requireActive("unlinkDependency");

    try {
      const source = this.storage.getTask(sourceTaskId);
      if (!source) {
        return { success: false, error: `Source task not found: ${sourceTaskId}` };
      }

      // Immutable update — no direct mutation
      const deps: readonly string[] = source.dependsOn ?? [];
      const updated: Task = { ...source, dependsOn: deps.filter((id) => id !== targetTaskId) };

      await this.storage.saveTask(updated);

      this.eventService.emitCacheInvalidation("single", sourceTaskId);
      this.eventService.emitTaskUpdated(sourceTaskId);
      this.eventService.emitRefresh();

      logger.info("[TaskService] Dependency unlinked", { sourceTaskId, targetTaskId, type });
      return { success: true, task: updated };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error("[TaskService] unlinkDependency failed", { error: msg, sourceTaskId, targetTaskId });
      return { success: false, error: msg };
    }
  }

  // ── Read API (delegates to storage) ──────────────────────────

  /**
   * Get a task by ID (readonly access through TaskService).
   * For bulk queries, use QueryService instead.
   */
  getTask(taskId: string): Task | undefined {
    return this.storage.getTask(taskId);
  }

  // ── Private Helpers ──────────────────────────────────────────

  private requireActive(method: string): void {
    if (!this.active) {
      throw new Error(`[TaskService] Not started — cannot call ${method}()`);
    }
  }

  private generateId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
