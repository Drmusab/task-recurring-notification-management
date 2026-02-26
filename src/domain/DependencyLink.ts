/**
 * DependencyLink — Immutable Task Dependency Edge
 *
 * Stores:
 *   blockID + recurrenceInstanceID
 *
 * Prevents:
 *   Recurring children inheriting template dependency state
 *
 * A DependencyLink represents a directed edge in the task dependency graph:
 *   sourceTaskId → targetTaskId
 *   "sourceTask DEPENDS ON targetTask"
 *   (sourceTask is blocked until targetTask is completed)
 *
 * Each link carries:
 *   1. Task IDs (source and target)
 *   2. Block IDs (for SiYuan block-level resolution)
 *   3. Recurrence instance IDs (to prevent template leakage)
 *   4. Link metadata (type, creation time)
 *
 * RULES:
 *   ✔ DependencyLink carries recurrenceInstanceId so children don't
 *     inherit the parent template's dependency state
 *   ✔ Fully immutable — Object.freeze at creation
 *   ✔ Used by DependencyExecutionGuard and TaskIndex
 *
 * FORBIDDEN:
 *   ❌ Import Scheduler, Storage, EventBus, SiYuan API, DOM, Integration, Service
 *   ❌ Mutate any field after construction
 */

import type { TaskId, ISODateString } from "./DomainTask";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** The type of dependency relationship */
export type DependencyType =
  | "dependsOn"     // Standard: sourceTask depends on targetTask
  | "blockedBy"     // Reverse view: sourceTask is blocked by targetTask
  | "crossNote";    // Cross-note dependency (SiYuan block in different doc)

/**
 * Immutable directed dependency edge between two tasks.
 */
export interface DependencyLink {
  /** Unique link identifier */
  readonly id: string;

  // ── Endpoints ──

  /** The task that HAS the dependency (the dependent / blocked task) */
  readonly sourceTaskId: TaskId;

  /** The task that MUST be completed first (the prerequisite) */
  readonly targetTaskId: TaskId;

  // ── Block Binding ──

  /** SiYuan block ID for the source task (if block-linked) */
  readonly sourceBlockId?: string;

  /** SiYuan block ID for the target task (if block-linked) */
  readonly targetBlockId?: string;

  // ── Recurrence Instance Isolation ──

  /**
   * Recurrence instance ID for the SOURCE task.
   *
   * When a recurring task produces instances, each instance gets its own
   * dependency links. This prevents instance A's completion from
   * incorrectly unblocking instance B.
   *
   * undefined = link applies to the template (all instances).
   */
  readonly sourceRecurrenceInstanceId?: string;

  /**
   * Recurrence instance ID for the TARGET task.
   *
   * undefined = any instance of the target completing satisfies this link.
   */
  readonly targetRecurrenceInstanceId?: string;

  // ── Metadata ──

  /** The type of dependency */
  readonly type: DependencyType;

  /** When this link was established */
  readonly createdAt: ISODateString;

  /**
   * Whether this link is currently satisfied (target completed).
   * Recomputed by DependencyExecutionGuard — never mutated directly.
   */
  readonly satisfied: boolean;
}

// ──────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────

/** Parameters for creating a new DependencyLink */
export interface CreateDependencyLinkParams {
  sourceTaskId: TaskId;
  targetTaskId: TaskId;
  sourceBlockId?: string;
  targetBlockId?: string;
  sourceRecurrenceInstanceId?: string;
  targetRecurrenceInstanceId?: string;
  type?: DependencyType;
}

/**
 * Create an immutable DependencyLink.
 *
 * Generates a unique ID and freezes the result.
 * The source and target IDs MUST NOT be equal (self-dependency).
 */
export function createDependencyLink(params: CreateDependencyLinkParams): DependencyLink {
  if (params.sourceTaskId === params.targetTaskId) {
    throw new Error(
      `Self-dependency not allowed: sourceTaskId === targetTaskId (${params.sourceTaskId})`,
    );
  }

  const link: DependencyLink = {
    id: `dep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    sourceTaskId: params.sourceTaskId,
    targetTaskId: params.targetTaskId,
    sourceBlockId: params.sourceBlockId,
    targetBlockId: params.targetBlockId,
    sourceRecurrenceInstanceId: params.sourceRecurrenceInstanceId,
    targetRecurrenceInstanceId: params.targetRecurrenceInstanceId,
    type: params.type ?? "dependsOn",
    createdAt: new Date().toISOString() as ISODateString,
    satisfied: false,
  };

  return Object.freeze(link);
}

/**
 * Create a DependencyLink with recurrence isolation for a specific instance.
 *
 * This is the CORRECT way to create links for recurring child tasks.
 * It ensures the sourceRecurrenceInstanceId is set, preventing template leakage.
 */
export function createInstanceDependencyLink(
  params: CreateDependencyLinkParams & {
    sourceRecurrenceInstanceId: string;
  },
): DependencyLink {
  return createDependencyLink(params);
}

/**
 * Create a new DependencyLink with `satisfied` set to a new value.
 * Returns a NEW frozen object.
 */
export function markSatisfied(link: DependencyLink, satisfied: boolean): DependencyLink {
  if (link.satisfied === satisfied) return link; // No change needed

  return Object.freeze({
    ...link,
    satisfied,
  });
}

// ──────────────────────────────────────────────────────────────
// Queries (Pure Functions)
// ──────────────────────────────────────────────────────────────

/**
 * Given a set of links and a task ID, find all unsatisfied dependencies
 * that BLOCK this task.
 */
export function getBlockingLinks(
  links: readonly DependencyLink[],
  taskId: TaskId,
): readonly DependencyLink[] {
  return links.filter(
    (link) => link.sourceTaskId === taskId && !link.satisfied,
  );
}

/**
 * Given a set of links and a task ID, find all links where this task
 * is the TARGET (other tasks depend on it).
 */
export function getDependentLinks(
  links: readonly DependencyLink[],
  taskId: TaskId,
): readonly DependencyLink[] {
  return links.filter((link) => link.targetTaskId === taskId);
}

/**
 * Check if adding a link from `source → target` would create a cycle.
 *
 * Uses DFS from target to see if source is reachable.
 * Pure function — no side effects.
 */
export function wouldCreateCycle(
  existingLinks: readonly DependencyLink[],
  sourceTaskId: TaskId,
  targetTaskId: TaskId,
): boolean {
  // Build adjacency map: taskId → set of tasks it depends on
  const adjacency = new Map<string, Set<string>>();
  for (const link of existingLinks) {
    const deps = adjacency.get(link.sourceTaskId as string) ?? new Set();
    deps.add(link.targetTaskId as string);
    adjacency.set(link.sourceTaskId as string, deps);
  }

  // Add the proposed link
  const deps = adjacency.get(sourceTaskId as string) ?? new Set();
  deps.add(targetTaskId as string);
  adjacency.set(sourceTaskId as string, deps);

  // DFS from source: can we reach source again?
  const visited = new Set<string>();
  const stack = [targetTaskId as string];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === (sourceTaskId as string)) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = adjacency.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        stack.push(neighbor);
      }
    }
  }

  return false;
}

// ──────────────────────────────────────────────────────────────
// Type Guard
// ──────────────────────────────────────────────────────────────

export function isDependencyLink(value: unknown): value is DependencyLink {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.sourceTaskId === "string" &&
    typeof v.targetTaskId === "string" &&
    typeof v.type === "string" &&
    typeof v.createdAt === "string" &&
    typeof v.satisfied === "boolean"
  );
}
