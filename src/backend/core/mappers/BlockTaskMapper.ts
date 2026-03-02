/**
 * BlockTaskMapper — Maps between SiYuan block attributes and Task objects.
 *
 * Extracted from BlockMetadataService to separate domain reconstruction
 * logic (defaults, fallbacks, schema bridging) from the API layer.
 *
 * FORBIDDEN:
 *  - make HTTP calls (use BlockMetadataService for that)
 *  - import frontend
 *  - mutate Task objects
 */

import type { Task } from "@backend/core/models/Task";
import {
  BLOCK_ATTR_TASK_ID,
  BLOCK_ATTR_TASK_DUE,
  BLOCK_ATTR_TASK_STATUS,
  BLOCK_ATTR_TASK_PRIORITY,
  BLOCK_ATTR_TASK_RECURRENCE,
  BLOCK_ATTR_TASK_ENABLED,
  BLOCK_ATTR_TASK_TAGS,
  BLOCK_ATTR_TASK_DATA,
  BLOCK_ATTR_TASK_CATEGORY,
  BLOCK_ATTR_TASK_CREATED,
  BLOCK_ATTR_TASK_UPDATED,
} from "@shared/constants/misc-constants";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Task → Block Attrs (serialize)
// ──────────────────────────────────────────────────────────────

/**
 * Build a SiYuan block-attribute dictionary from a Task.
 * Only includes populated optional fields.
 */
export function taskToBlockAttrs(task: Task): Record<string, string> {
  const attrs: Record<string, string> = {
    [BLOCK_ATTR_TASK_ID]: task.id,
    [BLOCK_ATTR_TASK_STATUS]: task.status || "todo",
    [BLOCK_ATTR_TASK_PRIORITY]: task.priority || "medium",
    [BLOCK_ATTR_TASK_ENABLED]: String(task.enabled !== false),
    [BLOCK_ATTR_TASK_CREATED]: task.createdAt || new Date().toISOString(),
    [BLOCK_ATTR_TASK_UPDATED]: new Date().toISOString(),
  };

  if (task.dueAt) {
    attrs[BLOCK_ATTR_TASK_DUE] =
      typeof task.dueAt === "string"
        ? task.dueAt
        : new Date(task.dueAt).toISOString();
  }

  if (task.recurrence?.rrule) {
    attrs[BLOCK_ATTR_TASK_RECURRENCE] = task.recurrence.rrule;
  }

  if (task.tags && task.tags.length > 0) {
    attrs[BLOCK_ATTR_TASK_TAGS] = task.tags.join(",");
  }

  if (task.category) {
    attrs[BLOCK_ATTR_TASK_CATEGORY] = task.category;
  }

  // Full JSON blob for round-trip fidelity
  try {
    attrs[BLOCK_ATTR_TASK_DATA] = JSON.stringify(task);
  } catch {
    // Non-serializable task — skip blob
  }

  return attrs;
}

// ──────────────────────────────────────────────────────────────
// Block Attrs → Task (deserialize)
// ──────────────────────────────────────────────────────────────

/**
 * Reconstruct a Task from SiYuan block attributes.
 *
 * Strategy:
 *  1. Try the `custom-task-data` JSON blob (full fidelity).
 *  2. Fall back to individual attributes (partial reconstruction).
 *
 * Returns `null` if the block isn't a task block.
 * Returned Task is frozen (immutable).
 */
export function taskFromBlockAttrs(
  blockId: string,
  attrs: Record<string, string>,
): Task | null {
  const taskId = attrs[BLOCK_ATTR_TASK_ID];
  if (!taskId) return null;

  // ── Primary: full JSON blob ────────────────────────────────
  const dataBlob = attrs[BLOCK_ATTR_TASK_DATA];
  if (dataBlob) {
    try {
      const task = JSON.parse(dataBlob) as Task;
      const result = task.linkedBlockId ? task : { ...task, linkedBlockId: blockId };
      return Object.freeze(result) as Task;
    } catch {
      logger.warn("[BlockTaskMapper] Failed to parse task data blob", { blockId, taskId });
    }
  }

  // ── Fallback: individual attributes ────────────────────────
  const task: Task = {
    id: taskId,
    name: `Task ${taskId.slice(0, 8)}`,
    dueAt: attrs[BLOCK_ATTR_TASK_DUE] || new Date().toISOString(),
    enabled: attrs[BLOCK_ATTR_TASK_ENABLED] !== "false",
    status: (attrs[BLOCK_ATTR_TASK_STATUS] as Task["status"]) || "todo",
    priority: (attrs[BLOCK_ATTR_TASK_PRIORITY] as Task["priority"]) || "medium",
    tags: attrs[BLOCK_ATTR_TASK_TAGS] ? attrs[BLOCK_ATTR_TASK_TAGS].split(",") : [],
    category: attrs[BLOCK_ATTR_TASK_CATEGORY] || "",
    linkedBlockId: blockId,
    version: 5,
    createdAt: attrs[BLOCK_ATTR_TASK_CREATED] || new Date().toISOString(),
    updatedAt: attrs[BLOCK_ATTR_TASK_UPDATED] || new Date().toISOString(),
    ...(attrs[BLOCK_ATTR_TASK_RECURRENCE]
      ? { recurrence: { rrule: attrs[BLOCK_ATTR_TASK_RECURRENCE] } }
      : {}),
  } as Task;

  return Object.freeze(task) as Task;
}

// ──────────────────────────────────────────────────────────────
// IAL parser
// ──────────────────────────────────────────────────────────────

/**
 * Parse SiYuan's IAL string into a key-value map.
 *
 * IAL format: `{: key="value" key2="value2" }`
 * Returns `null` if the string is empty or unparseable.
 */
export function parseIal(ial: string): Record<string, string> | null {
  if (!ial) return null;

  const attrs: Record<string, string> = {};
  const pairRegex = /(\S+?)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = pairRegex.exec(ial)) !== null) {
    const key = match[1];
    const val = match[2];
    if (key !== undefined && val !== undefined) {
      attrs[key] = val;
    }
  }

  return Object.keys(attrs).length > 0 ? attrs : null;
}
