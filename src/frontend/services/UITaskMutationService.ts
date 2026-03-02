/**
 * UITaskMutationService — Frontend Mutation Facade
 *
 * The ONLY way components should mutate task state.
 * Wraps the backend TaskService and returns MutationResultDTO —
 * never exposing domain types or storage instances.
 *
 * Components call:
 *   result = await uiMutationService.completeTask(taskId)
 *   result = await uiMutationService.snoozeTask(taskId, 30)
 *   result = await uiMutationService.updateTask(taskId, { priority: "high" })
 *   result = await uiMutationService.deleteTask(taskId)
 *   result = await uiMutationService.createTask({ name, dueAt, ... })
 *
 * Components NEVER call:
 *   ❌ taskStorage.saveTask()
 *   ❌ taskStorage.deleteTask()
 *   ❌ task.status = "done"      (inline mutation)
 *   ❌ task.dueAt = newDate      (inline mutation)
 *
 * FORBIDDEN:
 *   ❌ Import Svelte (this is a plain TS class)
 *   ❌ Access DOM
 *   ❌ Bypass TaskService for persistence
 *   ❌ Emit events (TaskService handles event emission)
 */

// ── No backend imports — structural typing only ────────────────

import type { MutationResultDTO } from "./DTOs";

// ──────────────────────────────────────────────────────────────
// Structural Interfaces (replace backend type imports)
// ──────────────────────────────────────────────────────────────

/** Structural result shape returned by backend TaskService methods. */
interface TaskMutationResult {
  success: boolean;
  task?: { id: string; [key: string]: unknown };
  error?: string;
}

/** Structural interface for the backend TaskService. */
interface TaskServiceLike {
  createTask(input: Record<string, unknown>): Promise<TaskMutationResult>;
  updateTask(taskId: string, patch: Record<string, unknown>): Promise<TaskMutationResult>;
  completeTask(taskId: string): Promise<TaskMutationResult>;
  rescheduleTask(taskId: string, delayMinutes: number, reason?: string): Promise<TaskMutationResult>;
  deleteTask(taskId: string): Promise<TaskMutationResult>;
  linkDependency(sourceId: string, targetId: string, type: string): Promise<TaskMutationResult>;
  unlinkDependency(sourceId: string, targetId: string, type: string): Promise<TaskMutationResult>;
  generateRecurrence(taskId: string): Promise<TaskMutationResult>;
}

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface UITaskMutationServiceDeps {
  taskService: TaskServiceLike;
}

export interface CreateTaskDTO {
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

export interface UpdateTaskDTO {
  name?: string;
  dueAt?: string;
  enabled?: boolean;
  priority?: string;
  tags?: string[];
  category?: string;
  recurrence?: { rrule: string; dtstart?: string };
  blockId?: string;
  scheduledAt?: string;
  description?: string;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class UITaskMutationService {
  private taskService: TaskServiceLike | null = null;

  /**
   * Connect to backend TaskService.
   * Called from plugin index.ts after services are initialized.
   */
  connect(deps: UITaskMutationServiceDeps): void {
    this.taskService = deps.taskService;
  }

  /**
   * Disconnect from backend (plugin unload).
   */
  disconnect(): void {
    this.taskService = null;
  }

  // ── Mutation API (returns MutationResultDTO only) ────────────

  /**
   * Create a new task.
   * Delegates to TaskService.createTask() which handles:
   *   - ID generation
   *   - Persist via TaskStorage
   *   - Block sync via SyncService
   *   - Event emission
   */
  async createTask(input: CreateTaskDTO): Promise<MutationResultDTO> {
    if (!this.taskService) return this.disconnected("createTask");

    try {
      const result = await this.taskService.createTask(input as unknown as Record<string, unknown>);
      return {
        success: result.success,
        taskId: result.task?.id,
        error: result.error,
      };
    } catch (error) {
      return this.wrapError("createTask", error);
    }
  }

  /**
   * Update a task with a partial patch.
   * All field mutations route through here — components NEVER do:
   *   task.priority = "high"       ← FORBIDDEN
   *   task.dueAt = "2025-01-01"    ← FORBIDDEN
   */
  async updateTask(taskId: string, patch: UpdateTaskDTO): Promise<MutationResultDTO> {
    if (!this.taskService) return this.disconnected("updateTask");

    try {
      const result = await this.taskService.updateTask(taskId, patch as Record<string, unknown>);
      return {
        success: result.success,
        taskId: result.task?.id ?? taskId,
        error: result.error,
      };
    } catch (error) {
      return this.wrapError("updateTask", error);
    }
  }

  /**
   * Complete a task.
   * Delegates to TaskService.completeTask() which handles:
   *   - Status change to "done"
   *   - Recurrence generation for recurring tasks
   *   - Block sync & event emission
   */
  async completeTask(taskId: string): Promise<MutationResultDTO> {
    if (!this.taskService) return this.disconnected("completeTask");

    try {
      const result = await this.taskService.completeTask(taskId);
      return {
        success: result.success,
        taskId,
        error: result.error,
      };
    } catch (error) {
      return this.wrapError("completeTask", error);
    }
  }

  /**
   * Reschedule a task by a delay in minutes.
   * Uses TaskService.rescheduleTask() which shifts dueAt forward.
   */
  async rescheduleTask(taskId: string, delayMinutes: number, reason?: string): Promise<MutationResultDTO> {
    if (!this.taskService) return this.disconnected("rescheduleTask");

    try {
      const result = await this.taskService.rescheduleTask(taskId, delayMinutes, reason);
      return {
        success: result.success,
        taskId,
        error: result.error,
      };
    } catch (error) {
      return this.wrapError("rescheduleTask", error);
    }
  }

  /**
   * Snooze a task — convenience wrapper for rescheduleTask.
   * Shifts dueAt forward by the specified minutes.
   */
  async snoozeTask(taskId: string, minutes: number = 15): Promise<MutationResultDTO> {
    return this.rescheduleTask(taskId, minutes, "user:snooze");
  }

  /**
   * Delete a task.
   * Delegates to TaskService.deleteTask() which handles:
   *   - Storage removal
   *   - Block attribute cleanup
   *   - Event emission
   */
  async deleteTask(taskId: string): Promise<MutationResultDTO> {
    if (!this.taskService) return this.disconnected("deleteTask");

    try {
      const result = await this.taskService.deleteTask(taskId);
      return {
        success: result.success,
        taskId,
        error: result.error,
      };
    } catch (error) {
      return this.wrapError("deleteTask", error);
    }
  }

  /**
   * Toggle task enabled/disabled state.
   */
  async toggleEnabled(taskId: string, enabled: boolean): Promise<MutationResultDTO> {
    return this.updateTask(taskId, { enabled });
  }

  /**
   * Apply an AI suggestion to a task.
   * Translates suggestion action parameters into an updateTask patch.
   */
  async applySuggestion(
    taskId: string,
    action: { type: string; parameters: Record<string, unknown> },
  ): Promise<MutationResultDTO> {
    if (!this.taskService) return this.disconnected("applySuggestion");

    try {
      const patch: UpdateTaskDTO = {};

      switch (action.type) {
        case "reschedule":
          if (action.parameters.dueAt) patch.dueAt = String(action.parameters.dueAt);
          if (action.parameters.scheduledAt) patch.scheduledAt = String(action.parameters.scheduledAt);
          break;
        case "changePriority":
          patch.priority = String(action.parameters.priority ?? action.parameters.value);
          break;
        case "disable":
          patch.enabled = false;
          break;
        case "changeFrequency":
          if (action.parameters.rrule) {
            patch.recurrence = {
              rrule: String(action.parameters.rrule),
              dtstart: action.parameters.dtstart ? String(action.parameters.dtstart) : undefined,
            };
          }
          break;
        case "addTags":
          if (Array.isArray(action.parameters.tags)) {
            patch.tags = action.parameters.tags.map(String);
          }
          break;
        default:
          // Generic param copy for unknown action types
          Object.assign(patch, action.parameters);
          break;
      }

      return this.updateTask(taskId, patch);
    } catch (error) {
      return this.wrapError("applySuggestion", error);
    }
  }

  /**
   * Link a dependency between two tasks.
   * Routes through TaskService — modals NEVER push to dependsOn directly.
   */
  async linkDependency(sourceTaskId: string, targetTaskId: string, type: string = "blockedBy"): Promise<MutationResultDTO> {
    if (!this.taskService) return this.disconnected("linkDependency");

    try {
      const result = await this.taskService.linkDependency(sourceTaskId, targetTaskId, type);
      return {
        success: result.success,
        taskId: sourceTaskId,
        error: result.error,
      };
    } catch (error) {
      return this.wrapError("linkDependency", error);
    }
  }

  /**
   * Unlink a dependency between two tasks.
   * Routes through TaskService — modals NEVER filter dependsOn directly.
   */
  async unlinkDependency(sourceTaskId: string, targetTaskId: string, type: string = "blockedBy"): Promise<MutationResultDTO> {
    if (!this.taskService) return this.disconnected("unlinkDependency");

    try {
      const result = await this.taskService.unlinkDependency(sourceTaskId, targetTaskId, type);
      return {
        success: result.success,
        taskId: sourceTaskId,
        error: result.error,
      };
    } catch (error) {
      return this.wrapError("unlinkDependency", error);
    }
  }

  /**
   * Update recurrence rule for a task.
   * Routes through TaskService lifecycle — modals NEVER mutate recurrence directly.
   */
  async updateRecurrence(taskId: string, rule: string): Promise<MutationResultDTO> {
    if (!this.taskService) return this.disconnected("updateRecurrence");

    try {
      const recurrence = rule ? { rrule: rule } : undefined;
      const result = await this.taskService.updateTask(taskId, { recurrence } as Record<string, unknown>);
      return {
        success: result.success,
        taskId,
        error: result.error,
      };
    } catch (error) {
      return this.wrapError("updateRecurrence", error);
    }
  }

  /**
   * Apply an AI suggestion via the typed applySuggestion method.
   * Modals call this — NEVER modify analytics or compare due dates locally.
   */
  async applyAISuggestion(
    taskId: string,
    suggestion: { type: string; parameters: Record<string, unknown> },
  ): Promise<MutationResultDTO> {
    return this.applySuggestion(taskId, suggestion);
  }

  /**
   * Generate next recurrence for a recurring task.
   */
  async generateRecurrence(taskId: string): Promise<MutationResultDTO> {
    if (!this.taskService) return this.disconnected("generateRecurrence");

    try {
      const result = await this.taskService.generateRecurrence(taskId);
      return {
        success: result.success,
        taskId,
        error: result.error,
      };
    } catch (error) {
      return this.wrapError("generateRecurrence", error);
    }
  }

  // ── Private Helpers ──────────────────────────────────────────

  private disconnected(method: string): MutationResultDTO {
    return {
      success: false,
      error: `UITaskMutationService not connected (${method})`,
    };
  }

  private wrapError(method: string, error: unknown): MutationResultDTO {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `${method} failed: ${msg}`,
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const uiMutationService = new UITaskMutationService();
