/**
 * TaskService — Central Task Mutation Gateway (§3.2)
 *
 * The ONLY module permitted to perform domain mutations.
 * Every write operation flows through this service to guarantee:
 *   1. Domain validation via TaskFactory
 *   2. Event emission via EventBus
 *   3. Cache invalidation
 *   4. Block attribute sync via SiYuanApiAdapter
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Creates DomainTask via TaskFactory exclusively
 *   ✔ Emits domain events after every mutation
 *   ✔ Returns immutable DomainTask (frozen)
 *   ❌ No direct block reads
 *   ❌ No frontend imports
 *   ❌ No direct cache manipulation
 */

import type { DomainTask, ISODateString, TaskPriority } from "@domain/DomainTask";
import { create, patch } from "@domain/TaskFactory";
import { eventBus } from "@events/EventBus";
import { siyuanApi } from "@infrastructure/SiYuanApiAdapter";
import {
  TaskNotFoundError,
  InvalidTaskStateError,
} from "@domain/errors";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface TaskCreateInput {
  readonly name: string;
  readonly dueAt?: string;
  readonly priority?: TaskPriority;
  readonly tags?: readonly string[];
  readonly category?: string;
  readonly blockId?: string;
  readonly rootId?: string;
  readonly recurrenceText?: string;
}

export interface TaskUpdatePatch {
  readonly name?: string;
  readonly dueAt?: ISODateString;
  readonly priority?: TaskPriority;
  readonly tags?: readonly string[];
  readonly category?: string;
}

export interface MutationResult {
  readonly success: boolean;
  readonly task?: DomainTask;
  readonly error?: string;
}

export interface CompletionResult extends MutationResult {
  readonly nextDueAt?: string;
  readonly recurrenceGenerated: boolean;
}

export interface TaskServiceDeps {
  /** Load a task by ID (typically from cache or storage) */
  readonly loadTask: (taskId: string) => DomainTask | undefined;
  /** Persist a task to storage */
  readonly persistTask: (task: DomainTask) => Promise<void>;
  /** Remove a task from storage */
  readonly removeTask: (taskId: string) => Promise<void>;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class TaskService {
  private readonly deps: TaskServiceDeps;
  private active = false;

  constructor(deps: TaskServiceDeps) {
    this.deps = deps;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    this.active = true;
  }

  stop(): void {
    this.active = false;
  }

  // ── Mutation API ─────────────────────────────────────────────

  /**
   * Create a new task.
   * Flow: validate → create() → persist → sync block → emit
   */
  async createTask(input: TaskCreateInput): Promise<MutationResult> {
    this.requireActive("createTask");

    try {
      const task = create({
        name: input.name,
        dueAt: input.dueAt,
        priority: input.priority,
        tags: input.tags ? [...input.tags] : undefined,
        category: input.category,
        blockId: input.blockId,
        rootId: input.rootId,
        recurrenceText: input.recurrenceText,
      });

      await this.deps.persistTask(task);

      // Sync block attributes if block-linked
      if (input.blockId) {
        await this.syncBlockAttributes(task);
      }

      eventBus.emit("task:runtime:created", {
        task,
        source: "TaskService.createTask",
      });

      return { success: true, task };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update an existing task with a partial patch.
   * Flow: load → patch() → persist → sync block → emit
   */
  async updateTask(
    taskId: string,
    updates: TaskUpdatePatch,
  ): Promise<MutationResult> {
    this.requireActive("updateTask");

    try {
      const existing = this.deps.loadTask(taskId);
      if (!existing) {
        throw new TaskNotFoundError(taskId);
      }

      const previousDue = existing.dueAt
        ? (existing.dueAt as string)
        : null;

      const updated = patch(existing, updates);
      await this.deps.persistTask(updated);

      // Sync block if linked
      if (updated.blockId) {
        await this.syncBlockAttributes(updated);
      }

      // If dueAt changed, emit rescheduled event
      if (
        updates.dueAt &&
        previousDue !== (updates.dueAt as string)
      ) {
        eventBus.emit("task:runtime:rescheduled", {
          task: updated,
          previousDue,
          newDue: updates.dueAt as string,
        });
      } else {
        // Emit created with update source for other changes
        eventBus.emit("task:runtime:created", {
          task: updated,
          source: "TaskService.updateTask",
        });
      }

      return { success: true, task: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Complete a task.
   * Flow: load → validate state → applyTransition → persist → emit
   */
  async completeTask(taskId: string): Promise<CompletionResult> {
    this.requireActive("completeTask");

    try {
      const task = this.deps.loadTask(taskId);
      if (!task) {
        throw new TaskNotFoundError(taskId);
      }

      if (task.status === "done") {
        throw new InvalidTaskStateError(
          taskId,
          task.status,
          "complete",
        );
      }

      // Use applyTransition from TaskFactory for proper lifecycle
      const { applyTransition } = await import("@domain/TaskFactory");
      const result = applyTransition(task, "complete");

      if (!result.success) {
        throw new InvalidTaskStateError(taskId, task.status, "complete");
      }

      await this.deps.persistTask(result.task);

      eventBus.emit("task:runtime:completed", {
        task: result.task,
        previousStatus: task.status,
      });

      return {
        success: true,
        task: result.task,
        recurrenceGenerated: false,
      };
    } catch (error) {
      return {
        success: false,
        recurrenceGenerated: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Reschedule a task by delay in minutes.
   * Flow: load → compute new dueAt → patch() → persist → emit
   */
  async rescheduleTask(
    taskId: string,
    delayMinutes: number,
    _reason: string = "user_reschedule",
  ): Promise<MutationResult> {
    this.requireActive("rescheduleTask");

    try {
      const task = this.deps.loadTask(taskId);
      if (!task) {
        throw new TaskNotFoundError(taskId);
      }

      const oldDueAt = task.dueAt ? (task.dueAt as string) : null;
      const dueDate = new Date(oldDueAt || Date.now());
      dueDate.setMinutes(dueDate.getMinutes() + delayMinutes);
      const newDueAt = dueDate.toISOString() as ISODateString;

      const updated = patch(task, { dueAt: newDueAt });
      await this.deps.persistTask(updated);

      eventBus.emit("task:runtime:rescheduled", {
        task: updated,
        previousDue: oldDueAt,
        newDue: newDueAt as string,
      });

      return { success: true, task: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Delete a task permanently.
   * Flow: load → clear block → remove → emit
   */
  async deleteTask(taskId: string): Promise<MutationResult> {
    this.requireActive("deleteTask");

    try {
      const task = this.deps.loadTask(taskId);
      if (!task) {
        throw new TaskNotFoundError(taskId);
      }

      // Clear block attributes before deletion
      if (task.blockId) {
        await this.clearBlockAttributes(task.blockId as string);
      }

      await this.deps.removeTask(taskId);

      eventBus.emit("task:runtime:deleted", {
        taskId: task.id as string,
        task,
      });

      return { success: true, task };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ── Block Sync (private) ─────────────────────────────────────

  private async syncBlockAttributes(task: DomainTask): Promise<void> {
    const blockId = task.blockId as string;
    if (!blockId) return;

    try {
      await siyuanApi.setBlockAttributes(blockId, {
        "custom-task-id": task.id as string,
        "custom-task-status": task.status,
        "custom-task-due": (task.dueAt as string) || "",
        "custom-task-priority": task.priority || "",
      });
    } catch {
      // Block sync is best-effort — don't fail the mutation
    }
  }

  private async clearBlockAttributes(blockId: string): Promise<void> {
    try {
      await siyuanApi.setBlockAttributes(blockId, {
        "custom-task-id": "",
        "custom-task-status": "",
        "custom-task-due": "",
        "custom-task-priority": "",
      });
    } catch {
      // Best-effort
    }
  }

  // ── Guards ───────────────────────────────────────────────────

  private requireActive(method: string): void {
    if (!this.active) {
      throw new Error(`[TaskService] Not started — cannot call ${method}()`);
    }
  }
}
