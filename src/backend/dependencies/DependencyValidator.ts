/**
 * DependencyValidator — Block-Attribute Validation for Dependencies
 *
 * Validates dependency state against SiYuan block attributes before
 * a task becomes executable. This is the "gate" that ensures no task
 * runs with stale dependency state.
 *
 * Validation flow:
 *   1. Fetch dependency block attrs via getBlockAttrs()
 *   2. Check completion status (custom-task-status = "done")
 *   3. Validate block exists (block may have been deleted)
 *   4. Validate recurrence instance (recurring deps may have new instance)
 *   5. Check circular chain (DependencyGraph.findCycleFrom)
 *
 * FORBIDDEN:
 *  - mutate task model
 *  - import frontend components
 *  - bypass block attribute validation
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskStorage";
import {
  getBlockAttrs,
} from "@backend/core/api/SiYuanApiClient";
import {
  BLOCK_ATTR_TASK_STATUS,
  BLOCK_ATTR_TASK_COMPLETED_AT,
  BLOCK_ATTR_TASK_DEPENDS_ON,
  BLOCK_ATTR_TASK_SERIES_ID,
} from "@shared/constants/misc-constants";
import type { DependencyGraph } from "./DependencyGraph";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ValidationResult {
  taskId: string;
  valid: boolean;
  blocked: boolean;
  reason?: string;
  /** IDs of incomplete dependencies. */
  incompleteDeps: string[];
  /** IDs of missing/deleted dependency blocks. */
  missingBlocks: string[];
  /** Cycle detected starting from this task. */
  cycle: string[];
}

export interface DependencyValidatorDeps {
  repository: TaskRepositoryProvider;
  graph: DependencyGraph;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class DependencyValidator {
  private readonly repository: TaskRepositoryProvider;
  private readonly graph: DependencyGraph;

  constructor(deps: DependencyValidatorDeps) {
    this.repository = deps.repository;
    this.graph = deps.graph;
  }

  /**
   * Full validation of a task's dependency state against block attributes.
   * This is the authoritative check before a task can be scheduled/executed.
   *
   * Steps:
   *  1. Quick check: no dependencies → valid
   *  2. Cycle check via DependencyGraph
   *  3. For each dependency:
   *     a. Check task exists in repository
   *     b. Fetch block attrs (if block-linked)
   *     c. Verify completion status
   *     d. Handle recurring dependency rebinding
   */
  async validate(taskId: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      taskId,
      valid: true,
      blocked: false,
      incompleteDeps: [],
      missingBlocks: [],
      cycle: [],
    };

    const task = this.repository.getTask(taskId);
    if (!task) {
      result.valid = false;
      result.reason = "Task not found in repository";
      return result;
    }

    const deps = task.dependsOn ?? [];
    if (deps.length === 0) return result;

    // Step 1: Cycle check
    const cycle = this.graph.findCycleFrom(taskId);
    if (cycle.length > 0) {
      result.valid = false;
      result.blocked = true;
      result.reason = `Circular dependency detected: ${cycle.join(" → ")}`;
      result.cycle = cycle;
      return result;
    }

    // Step 2: Validate each dependency
    for (const depId of deps) {
      const depTask = this.repository.getTask(depId);

      if (!depTask) {
        // Dependency task deleted from storage
        // Check if it's a recurring task that may have a new instance
        const reboundId = await this.tryRebindRecurringDep(depId);
        if (reboundId) {
          // Rebinding found. Check the rebound task instead.
          const reboundResult = await this.checkDepCompletion(reboundId);
          if (!reboundResult.complete) {
            result.incompleteDeps.push(reboundId);
          }
        }
        // If no rebound found, consider dep deleted → met
        continue;
      }

      const blockId = depTask.blockId ?? depTask.linkedBlockId;
      if (!blockId) {
        // No block link → use in-memory status
        if (depTask.status !== "done" && depTask.enabled !== false) {
          result.incompleteDeps.push(depId);
        }
        continue;
      }

      const blockResult = await this.checkDepCompletion(depId);
      if (blockResult.blockMissing) {
        result.missingBlocks.push(depId);
        // Block deleted → dep considered met
        continue;
      }
      if (!blockResult.complete) {
        result.incompleteDeps.push(depId);
      }
    }

    if (result.incompleteDeps.length > 0) {
      result.blocked = true;
      result.reason = `Blocked by ${result.incompleteDeps.length} incomplete dependency(ies): ${result.incompleteDeps.join(", ")}`;
    }

    if (result.missingBlocks.length > 0) {
      logger.warn("[DependencyValidator] Missing blocks for deps", {
        taskId,
        missing: result.missingBlocks,
      });
    }

    return result;
  }

  /**
   * Quick sync check — does NOT validate block attrs.
   * Use for bulk filtering (e.g., SmartSuggestionEngine).
   */
  isBlockedSync(taskId: string): boolean {
    return this.graph.isBlocked(taskId);
  }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Check if a dependency task is completed, using block attributes as source of truth.
   */
  private async checkDepCompletion(
    depId: string
  ): Promise<{ complete: boolean; blockMissing: boolean }> {
    const depTask = this.repository.getTask(depId);
    if (!depTask) return { complete: true, blockMissing: false }; // deleted → met

    const blockId = depTask.blockId ?? depTask.linkedBlockId;
    if (!blockId) {
      return {
        complete: depTask.status === "done" || depTask.enabled === false,
        blockMissing: false,
      };
    }

    try {
      const attrs = await getBlockAttrs(blockId);
      if (!attrs) {
        return { complete: true, blockMissing: true };
      }

      const status = attrs[BLOCK_ATTR_TASK_STATUS];
      const completedAt = attrs[BLOCK_ATTR_TASK_COMPLETED_AT];
      const complete = status === "done" || !!completedAt;
      return { complete, blockMissing: false };
    } catch {
      // API failure → fall back to in-memory
      return {
        complete: depTask.status === "done" || depTask.enabled === false,
        blockMissing: false,
      };
    }
  }

  /**
   * Try to find a new instance of a recurring task when the original dep is deleted.
   * Looks for tasks sharing the same seriesId.
   */
  private async tryRebindRecurringDep(depId: string): Promise<string | null> {
    const allTasks = this.repository.getAllTasks();
    
    // Find the original task's seriesId from the repository (may still be cached)
    const originalTask = allTasks.find(t => t.id === depId);
    if (!originalTask?.seriesId) return null;
    
    // Look for an active task in the same series that isn't the deleted one
    const replacement = allTasks.find(
      t => t.seriesId === originalTask.seriesId
        && t.id !== depId
        && t.enabled !== false
        && t.status !== 'done'
        && t.status !== 'cancelled'
    );
    
    return replacement?.id ?? null;
  }

  /**
   * Check if a task block had a certain seriesId via block attributes.
   * @deprecated — replaced by in-memory lookup in tryRebindRecurringDep
   */
  private async checkBlockForSeriesId(
    _taskId: string,
    _expectedSeriesId: string
  ): Promise<boolean> {
    return false;
  }
}
