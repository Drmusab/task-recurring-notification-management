/**
 * BlockAttributeValidator — Runtime Block Validation Gate (§3.4, Stage 4)
 *
 * Before ANY runtime transition, verifies the task's SiYuan block:
 *   1. Block exists (getBlockAttrs returns valid response)
 *   2. Block is not completed (custom-task-status ≠ "done")
 *   3. Block is not archived (custom-task-status ≠ "archived")
 *   4. Block is not cancelled (custom-task-status ≠ "cancelled")
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Uses SiYuanApiAdapter for kernel calls
 *   ✔ Returns structured validation result
 *   ❌ No mutations
 *   ❌ No domain state changes
 */

import { siyuanApi } from "@infrastructure/SiYuanApiAdapter";
import type { DomainTask } from "@domain/DomainTask";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface BlockValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly failedCheck?:
    | "no_block_id"
    | "block_not_found"
    | "status_terminal"
    | "api_error";
}

/** Block statuses that are terminal — no runtime action allowed */
const TERMINAL_STATUSES = new Set(["done", "archived", "cancelled"]);

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

/**
 * Validates that a task's SiYuan block exists and is in a valid
 * runtime state. Called before every pipeline stage that would
 * take action on a task.
 *
 * Usage (in pipeline):
 * ```ts
 * const result = await blockValidator.validate(task);
 * if (!result.valid) {
 *   return; // skip this task silently
 * }
 * ```
 */
export class BlockAttributeValidator {
  // ── Stats (for monitoring) ──
  private totalChecks = 0;
  private totalValid = 0;
  private totalRejected = 0;

  /**
   * Validate that a task's block exists and is not terminal.
   *
   * Tasks WITHOUT a blockId are considered valid (non-block-linked).
   */
  async validate(task: DomainTask): Promise<BlockValidationResult> {
    this.totalChecks++;

    const blockId = task.blockId as string | undefined;

    // Tasks without a blockId are valid (non-block-linked tasks)
    if (!blockId) {
      this.totalValid++;
      return { valid: true };
    }

    try {
      const attrs = await siyuanApi.getBlockAttributes(blockId);

      // Block not found (empty result)
      if (!attrs || Object.keys(attrs).length === 0) {
        this.totalRejected++;
        return {
          valid: false,
          reason: `Block not found: ${blockId}`,
          failedCheck: "block_not_found",
        };
      }

      // Check terminal status from custom attribute
      const taskStatus = attrs.customStatus || "";
      if (TERMINAL_STATUSES.has(taskStatus)) {
        this.totalRejected++;
        return {
          valid: false,
          reason: `Block has terminal status: ${taskStatus}`,
          failedCheck: "status_terminal",
        };
      }

      this.totalValid++;
      return { valid: true };
    } catch (error) {
      // API error — treat as invalid for safety
      this.totalRejected++;
      return {
        valid: false,
        reason: `Block validation API error: ${error instanceof Error ? error.message : "unknown"}`,
        failedCheck: "api_error",
      };
    }
  }

  /**
   * Synchronous fast-path check: is the in-memory status terminal?
   * Does NOT call SiYuan API. Use validate() for authoritative check.
   */
  isTerminalInMemory(task: DomainTask): boolean {
    return task.status === "done" || task.status === "cancelled";
  }

  /**
   * Get validation stats for monitoring.
   */
  getStats(): {
    totalChecks: number;
    totalValid: number;
    totalRejected: number;
  } {
    return {
      totalChecks: this.totalChecks,
      totalValid: this.totalValid,
      totalRejected: this.totalRejected,
    };
  }
}
