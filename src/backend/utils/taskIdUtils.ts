/**
 * taskIdUtils — Deterministic Task Identity Generation
 *
 * Generates stable, deterministic task IDs based on:
 *   blockId + recurrence instance timestamp
 *
 * This replaces the non-deterministic `task_${Date.now()}_${random}`
 * pattern. The new scheme ensures:
 *   - Same block + same recurrence instance → same ID (idempotent)
 *   - Different instances of same recurring task → different IDs
 *   - Non-recurring tasks → unique ID from blockId alone
 *
 * Prevents:
 *   - Duplicate recurring task IDs
 *   - Scheduler double-scheduling
 *   - Cache key collision
 *   - Storage duplicate entries
 *
 * PURE FUNCTIONS — no state, no side effects, no DOM access.
 *
 * FORBIDDEN:
 *   ❌ mutate model
 *   ❌ access storage
 *   ❌ fire event
 *   ❌ call integration
 *   ❌ parse markdown
 *   ❌ access DOM
 *   ❌ hold global state
 */

import { normalizeDueDate } from "./dateUtils";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** Branded task ID for type safety */
export type TaskId = string & { readonly __brand?: "TaskId" };

/** Components of a task identity */
export interface TaskIdentityComponents {
  readonly blockId: string;
  readonly instanceTimestamp: string | null;
  readonly isRecurring: boolean;
}

// ──────────────────────────────────────────────────────────────
// Deterministic ID Generation
// ──────────────────────────────────────────────────────────────

/**
 * Generate a deterministic task ID from blockId + recurrence instance.
 *
 * Formula:
 *   Recurring:     `task_{blockId}_{instanceISO}`
 *   Non-recurring: `task_{blockId}`
 *
 * The instance timestamp is truncated to minute precision to avoid
 * sub-minute jitter creating duplicate IDs.
 *
 * @param blockId  SiYuan block ID
 * @param instanceDueAt  Resolved due date for this recurrence instance (optional)
 * @returns Deterministic task ID
 */
export function generateDeterministicId(
  blockId: string,
  instanceDueAt?: string | Date | null,
): TaskId {
  if (!blockId) {
    // Fallback: legacy non-deterministic ID for tasks without blockId
    return generateFallbackId() as TaskId;
  }

  const sanitizedBlock = sanitizeForId(blockId);

  if (instanceDueAt) {
    const normalized = normalizeDueDate(instanceDueAt);
    if (normalized) {
      // Truncate to minute precision
      const truncated = new Date(normalized.getTime());
      truncated.setSeconds(0, 0);
      const isoKey = truncated.toISOString().replace(/[:.]/g, "-");
      return `task_${sanitizedBlock}_${isoKey}` as TaskId;
    }
  }

  return `task_${sanitizedBlock}` as TaskId;
}

/**
 * Generate a legacy fallback ID (non-deterministic).
 * Used only when blockId is unavailable.
 * Matches the existing pattern: `task_${Date.now()}_${random}`
 */
export function generateFallbackId(): TaskId {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}` as TaskId;
}

// ──────────────────────────────────────────────────────────────
// Identity Decomposition
// ──────────────────────────────────────────────────────────────

/**
 * Extract components from a deterministic task ID.
 * Returns null for legacy/unrecognized IDs.
 */
export function decomposeTaskId(taskId: string): TaskIdentityComponents | null {
  if (!taskId.startsWith("task_")) return null;

  const rest = taskId.slice(5); // strip "task_"

  // Check for recurring pattern: {blockId}_{isoTimestamp}
  // ISO timestamps are encoded with dashes replacing colons/dots
  const recurringMatch = rest.match(/^(.+?)_(\d{4}-\d{2}-\d{2}T.+)$/);
  if (recurringMatch && recurringMatch[1] && recurringMatch[2]) {
    const blockId = recurringMatch[1];
    const rawTs = recurringMatch[2].replace(/-/g, (match, offset: number) => {
      // Only restore colons after the date portion (T delimiter at position ~10)
      if (offset > 10) return ":";
      return match;
    });
    return {
      blockId,
      instanceTimestamp: rawTs,
      isRecurring: true,
    };
  }

  // Non-recurring: just blockId (or legacy random suffix)
  // Distinguish from legacy: legacy has `_${epoch}_${random}` pattern
  const legacyMatch = rest.match(/^(\d{13,})_([a-z0-9]+)$/);
  if (legacyMatch) {
    // This is a legacy non-deterministic ID
    return null;
  }

  return {
    blockId: rest,
    instanceTimestamp: null,
    isRecurring: false,
  };
}

/**
 * Check if a task ID is deterministic (new format) vs legacy.
 */
export function isDeterministicId(taskId: string): boolean {
  return decomposeTaskId(taskId) !== null;
}

// ──────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────

/**
 * Validate a task ID is non-empty and well-formed.
 */
export function isValidTaskId(taskId: unknown): taskId is TaskId {
  return typeof taskId === "string" && taskId.length > 0 && taskId.startsWith("task_");
}

/**
 * Check if two task IDs refer to the same task identity.
 * For deterministic IDs, compares blockId component.
 * For all IDs, falls back to exact string match.
 */
export function isSameTaskIdentity(idA: string, idB: string): boolean {
  if (idA === idB) return true;

  // Try decomposing both to compare by blockId
  const decompA = decomposeTaskId(idA);
  const decompB = decomposeTaskId(idB);
  if (decompA && decompB) {
    return decompA.blockId === decompB.blockId;
  }

  return false;
}

// ──────────────────────────────────────────────────────────────
// Internal
// ──────────────────────────────────────────────────────────────

/**
 * Sanitize a blockId for use in a task ID.
 * Removes characters that would break parsing.
 */
function sanitizeForId(blockId: string): string {
  // SiYuan block IDs are typically safe alphanumeric + hyphens
  return blockId.replace(/[^a-zA-Z0-9\-]/g, "");
}
