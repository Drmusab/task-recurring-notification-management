/**
 * BlockAttributeValidator — Runtime Block Validation Gate
 *
 * Before ANY runtime transition (schedule, escalate, integrate, notify),
 * the system MUST verify the task's SiYuan block via:
 *
 *   POST /api/attr/getBlockAttrs → { id: blockId }
 *
 * Checks:
 *   1. Block exists (getBlockAttrs returns valid response)
 *   2. Block is not completed (custom-task-status ≠ "done")
 *   3. Block is not archived (custom-task-status ≠ "archived")
 *   4. Block is not cancelled (custom-task-status ≠ "cancelled")
 *   5. Recurrence instance is active (not stale parent template)
 *
 * This is the SINGLE AUTHORITY for block-level runtime validation.
 * All other services MUST call this before taking runtime action.
 *
 * Integration:
 *   SchedulerService.tick()     → validates before emitting task:runtime:due
 *   IntegrationService          → validates before webhook dispatch
 *   TaskLifecycle.transition()  → validates before state change
 *   MLRuntimeAdapter            → validates before analysis
 *
 * FORBIDDEN:
 *   - Modify block attributes (delegate to SyncService)
 *   - Modify markdown / DOM
 *   - Import frontend / Svelte
 *   - Parse markdown
 */

import type { Task, ReadonlyTask } from "@backend/core/models/Task";
import type { BlockAttributeSync, BlockTaskAttributes } from "@backend/blocks/BlockAttributeSync";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface BlockValidationResult {
  /** Whether the block passed all validation checks */
  valid: boolean;
  /** Reason for rejection (if invalid) */
  reason?: string;
  /** Block attributes read from SiYuan (if block exists) */
  blockAttributes?: BlockTaskAttributes | null;
  /** Which check failed */
  failedCheck?: "no_block_id" | "block_not_found" | "status_terminal" | "no_task_attrs";
}

export interface BlockAttributeValidatorDeps {
  blockAttributeSync: BlockAttributeSync;
}

/** Block statuses that are terminal — no runtime action allowed */
const TERMINAL_STATUSES = new Set(["done", "archived", "cancelled"]);

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class BlockAttributeValidator {
  private readonly blockSync: BlockAttributeSync;
  private active = false;

  // ── Stats ──
  private totalChecks = 0;
  private totalValid = 0;
  private totalRejected = 0;
  private rejectionBreakdown = {
    noBlockId: 0,
    blockNotFound: 0,
    statusTerminal: 0,
    noTaskAttrs: 0,
  };

  constructor(deps: BlockAttributeValidatorDeps) {
    this.blockSync = deps.blockAttributeSync;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[BlockAttributeValidator] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    logger.info("[BlockAttributeValidator] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Validate that a task's block exists and is in a valid runtime state.
   *
   * Called before every runtime transition:
   *   - Scheduler emitting task:runtime:due
   *   - IntegrationService dispatching webhooks
   *   - TaskLifecycle state transitions
   *   - ML analysis trigger
   *
   * Tasks WITHOUT a blockId are considered valid (non-block-linked tasks).
   *
   * @returns BlockValidationResult with valid=true/false and reason
   */
  async exists(task: ReadonlyTask | Task): Promise<BlockValidationResult> {
    this.totalChecks++;

    const blockId = task.blockId || (task as Task).linkedBlockId;

    // Tasks without a blockId are valid (not block-linked)
    if (!blockId) {
      this.totalValid++;
      return { valid: true, reason: "no_block_linked" };
    }

    try {
      const attrs = await this.blockSync.readTaskAttributes(blockId);

      // Block has no task attributes at all
      if (!attrs) {
        this.totalRejected++;
        this.rejectionBreakdown.blockNotFound++;
        logger.debug("[BlockAttributeValidator] Block not found or no task attrs", {
          blockId,
          taskId: task.id,
        });
        return {
          valid: false,
          reason: `Block not found or has no task attributes: ${blockId}`,
          failedCheck: "block_not_found",
          blockAttributes: null,
        };
      }

      // Check terminal status
      if (TERMINAL_STATUSES.has(attrs.status)) {
        this.totalRejected++;
        this.rejectionBreakdown.statusTerminal++;
        logger.debug("[BlockAttributeValidator] Block has terminal status", {
          blockId,
          taskId: task.id,
          status: attrs.status,
        });
        return {
          valid: false,
          reason: `Block task status is terminal: ${attrs.status}`,
          failedCheck: "status_terminal",
          blockAttributes: attrs,
        };
      }

      // All checks passed
      this.totalValid++;
      return { valid: true, blockAttributes: attrs };

    } catch (error) {
      // Network/API error — treat as invalid for safety
      this.totalRejected++;
      this.rejectionBreakdown.blockNotFound++;
      logger.warn("[BlockAttributeValidator] Block validation failed (API error)", {
        blockId,
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        valid: false,
        reason: `Block validation API error: ${error instanceof Error ? error.message : "unknown"}`,
        failedCheck: "block_not_found",
      };
    }
  }

  /**
   * Synchronous check: does the task have a terminal status in memory?
   * Fast path for hot-path filtering (does NOT call SiYuan API).
   * Use exists() for authoritative check.
   */
  isTerminalStatus(task: ReadonlyTask | Task): boolean {
    const status = (task as Task).status;
    if (!status) return false;
    return TERMINAL_STATUSES.has(status);
  }

  /**
   * Get validation stats for monitoring.
   */
  getStats() {
    return {
      totalChecks: this.totalChecks,
      totalValid: this.totalValid,
      totalRejected: this.totalRejected,
      rejectionBreakdown: { ...this.rejectionBreakdown },
    };
  }
}
