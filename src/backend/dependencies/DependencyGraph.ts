/**
 * DependencyGraph — Block-Validated Dependency Graph
 *
 * Maintains a directed acyclic graph of task dependencies that validates
 * completion state against SiYuan block attributes (source of truth).
 *
 * Architecture: Block-Validated Dependency Graph (NOT Memory-Based Task Chain)
 *
 * Validation flow:
 *   1. Fetch dependency block attrs via getBlockAttrs()
 *   2. Check completion status
 *   3. Validate block existence
 *   4. Enforce cycle-free invariant
 *
 * Invalidation triggers:
 *   task:complete, task:updated, task:refresh,
 *   block:updated, block:deleted,
 *   task:recurrence:generated
 *
 * FORBIDDEN:
 *  - store markdown/DOM
 *  - bypass block attribute validation
 *  - mutate task model
 *  - import frontend components
 *  - initialize before plugin.onload()
 *  - survive plugin.onunload()
 *  - rebuild every scheduler tick
 *  - run at import time
 */

import type { Task } from "@backend/core/models/Task";
import { isTaskActive } from "@backend/core/models/Task";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskStorage";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import {
  getBlockAttrs,
} from "@backend/core/api/SiYuanApiClient";
import {
  BLOCK_ATTR_TASK_STATUS,
  BLOCK_ATTR_TASK_COMPLETED_AT,
  BLOCK_ATTR_TASK_DEPENDS_ON,
  BLOCK_ATTR_TASK_BLOCKED_BY,
} from "@shared/constants/misc-constants";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface DependencyNode {
  taskId: string;
  blockId?: string;
  /** Task IDs this task depends on (must complete before this task). */
  dependsOn: ReadonlySet<string>;
  /** Task IDs that depend on this task (reverse edge: this task blocks them). */
  dependents: ReadonlySet<string>;
  /** True if all dependencies are completed / satisfied. */
  ready: boolean;
  /** Epoch ms of last block-attribute validation. */
  lastValidated: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface DependencyGraphStats {
  nodes: number;
  edges: number;
  blockedTasks: number;
  readyTasks: number;
}

export interface DependencyGraphDeps {
  repository: TaskRepositoryProvider;
  pluginEventBus: PluginEventBus;
}

/** TTL for per-node block-attribute validation (ms). */
const VALIDATION_TTL_MS = 30_000;

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class DependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map();
  private active = false;

  private readonly repository: TaskRepositoryProvider;
  private readonly eventBus: PluginEventBus;
  private readonly unsubscribes: Array<() => void> = [];

  constructor(deps: DependencyGraphDeps) {
    this.repository = deps.repository;
    this.eventBus = deps.pluginEventBus;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    this.rebuild();
    this.subscribeEvents();
    logger.info("[DependencyGraph] Started", { nodes: this.nodes.size });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* noop */ }
    }
    this.unsubscribes.length = 0;
    this.nodes.clear();
    logger.info("[DependencyGraph] Stopped");
  }

  // ── Read API ─────────────────────────────────────────────────

  /** Get node for a task (sync, fast). */
  getNode(taskId: string): DependencyNode | undefined {
    return this.nodes.get(taskId);
  }

  /** Check if a task is blocked (sync). */
  isBlocked(taskId: string): boolean {
    const node = this.nodes.get(taskId);
    return node ? !node.ready : false;
  }

  /** Check if a task is blocking others (sync). */
  isBlocking(taskId: string): boolean {
    const node = this.nodes.get(taskId);
    if (!node) return false;
    for (const depId of node.dependents) {
      const depNode = this.nodes.get(depId);
      if (depNode && !depNode.ready) return true;
    }
    return false;
  }

  /** Get IDs of tasks that depend on the given task. */
  getDependents(taskId: string): string[] {
    const node = this.nodes.get(taskId);
    return node ? Array.from(node.dependents) : [];
  }

  /** Get IDs of tasks this task depends on. */
  getDependencies(taskId: string): string[] {
    const node = this.nodes.get(taskId);
    return node ? Array.from(node.dependsOn) : [];
  }

  /** Get all tasks currently blocked. */
  getBlockedTasks(): string[] {
    const blocked: string[] = [];
    for (const [tid, node] of this.nodes) {
      if (!node.ready && node.dependsOn.size > 0) blocked.push(tid);
    }
    return blocked;
  }

  /** Get all tasks that have dependencies but are all met. */
  getReadyTasks(): string[] {
    const ready: string[] = [];
    for (const [tid, node] of this.nodes) {
      if (node.ready && node.dependsOn.size > 0) ready.push(tid);
    }
    return ready;
  }

  /** Tasks that would become ready if `taskId` completes. */
  getUnblockCandidates(taskId: string): string[] {
    const node = this.nodes.get(taskId);
    if (!node) return [];
    const candidates: string[] = [];
    for (const dependentId of node.dependents) {
      const depNode = this.nodes.get(dependentId);
      if (!depNode || depNode.ready) continue;
      // Count remaining incomplete deps (excluding taskId)
      let remaining = 0;
      for (const depId of depNode.dependsOn) {
        if (depId === taskId) continue;
        const depTask = this.repository.getTask(depId);
        if (depTask && isTaskActive(depTask)) remaining++;
      }
      if (remaining === 0) candidates.push(dependentId);
    }
    return candidates;
  }

  /** Explain why a task is blocked. */
  explainBlocked(taskId: string): { blockers: string[]; chains: string[][] } {
    const node = this.nodes.get(taskId);
    if (!node || node.ready) return { blockers: [], chains: [] };
    const blockers: string[] = [];
    const chains: string[][] = [];
    for (const depId of node.dependsOn) {
      const depTask = this.repository.getTask(depId);
      if (depTask && isTaskActive(depTask)) {
        blockers.push(depId);
        chains.push(this.buildBlockerChain(depId, 5));
      }
    }
    return { blockers, chains };
  }

  /** Get all tasks as an array. */
  getAllNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  // ── Cycle Detection ──────────────────────────────────────────

  /**
   * Check if adding an edge from→to would create a cycle.
   * Returns the cycle chain if detected, empty array if safe.
   */
  wouldCreateCycle(fromTaskId: string, toTaskId: string): string[] {
    if (fromTaskId === toTaskId) return [fromTaskId, toTaskId];
    // Walk from toTaskId's dependencies to see if we can reach fromTaskId
    const visited = new Set<string>();
    const path: string[] = [];
    const found = this.dfsReachable(toTaskId, fromTaskId, visited, path);
    return found ? [fromTaskId, ...path] : [];
  }

  /**
   * Find cycle starting from a given task.
   * Returns cycle chain or empty array.
   */
  findCycleFrom(taskId: string): string[] {
    const visited = new Set<string>();
    const stack = new Set<string>();
    const path: string[] = [];
    if (this.dfsCycle(taskId, visited, stack, path)) {
      return [...path];
    }
    return [];
  }

  // ── Mutation API (with cycle guard) ──────────────────────────

  /**
   * Add a dependency edge: fromTaskId depends on toTaskId.
   * Returns false and emits dependency:cycle:detected if it would create a cycle.
   */
  addDependency(fromTaskId: string, toTaskId: string): boolean {
    const cycle = this.wouldCreateCycle(fromTaskId, toTaskId);
    if (cycle.length > 0) {
      this.eventBus.emit("dependency:cycle:detected", {
        chain: cycle,
        rejectedEdge: { from: fromTaskId, to: toTaskId },
      });
      logger.warn("[DependencyGraph] Circular dependency rejected", {
        from: fromTaskId,
        to: toTaskId,
        cycle,
      });
      return false;
    }

    // Add forward edge
    const fromNode = this.nodes.get(fromTaskId);
    if (fromNode) {
      (fromNode.dependsOn as Set<string>).add(toTaskId);
      this.recalcReady(fromTaskId);
    }

    // Add reverse edge
    const toNode = this.nodes.get(toTaskId);
    if (toNode) {
      (toNode.dependents as Set<string>).add(fromTaskId);
    }

    this.eventBus.emit("dependency:added", {
      fromTaskId,
      toTaskId,
    });

    return true;
  }

  /**
   * Remove a dependency edge.
   */
  removeDependency(fromTaskId: string, toTaskId: string): void {
    const fromNode = this.nodes.get(fromTaskId);
    if (fromNode) {
      (fromNode.dependsOn as Set<string>).delete(toTaskId);
      this.recalcReady(fromTaskId);
    }
    const toNode = this.nodes.get(toTaskId);
    if (toNode) {
      (toNode.dependents as Set<string>).delete(fromTaskId);
    }
    this.eventBus.emit("dependency:removed", {
      fromTaskId,
      toTaskId,
    });
  }

  // ── Block-Validated Read ─────────────────────────────────────

  /**
   * Validate a task's dependency state against SiYuan block attributes.
   * Returns true if the task is blocked (has incomplete deps).
   * Revalidates if the node is stale (beyond TTL).
   */
  async isBlockedValidated(taskId: string): Promise<boolean> {
    const node = this.nodes.get(taskId);
    if (!node) return false;
    if (node.dependsOn.size === 0) return false;

    const now = Date.now();
    if (now - node.lastValidated < VALIDATION_TTL_MS) {
      return !node.ready;
    }

    // Revalidate each dependency against block attrs
    let allMet = true;
    for (const depId of node.dependsOn) {
      const depTask = this.repository.getTask(depId);
      if (!depTask) continue; // dependency deleted → considered met
      const blockId = depTask.blockId ?? depTask.linkedBlockId;
      if (!blockId) {
        // No block → use in-memory status
        if (isTaskActive(depTask)) { allMet = false; break; }
        continue;
      }

      try {
        const attrs = await getBlockAttrs(blockId);
        if (!attrs) {
          // Block deleted → dependency met (task gone)
          continue;
        }
        const status = attrs[BLOCK_ATTR_TASK_STATUS];
        const completedAt = attrs[BLOCK_ATTR_TASK_COMPLETED_AT];

        if (status !== "done" && !completedAt) {
          allMet = false;
          break;
        }
      } catch {
        // API failure → fall back to in-memory
        if (isTaskActive(depTask)) { allMet = false; break; }
      }
    }

    // Update node
    (node as { lastValidated: number }).lastValidated = now;
    (node as { ready: boolean }).ready = allMet;

    return !allMet;
  }

  /**
   * Validate dependency edges against block attributes.
   * Detects if dependencies in block attrs diverge from memory.
   * Used during rebuild or on-demand revalidation.
   */
  async validateNodeAgainstBlock(taskId: string): Promise<void> {
    const task = this.repository.getTask(taskId);
    if (!task) return;
    const blockId = task.blockId ?? task.linkedBlockId;
    if (!blockId) return;

    try {
      const attrs = await getBlockAttrs(blockId);
      if (!attrs) {
        // Block deleted → evict
        this.evictNode(taskId);
        return;
      }

      // Check if dependsOn in block diverges from memory
      const blockDepsRaw = attrs[BLOCK_ATTR_TASK_DEPENDS_ON];
      if (blockDepsRaw) {
        const blockDeps = new Set(blockDepsRaw.split(",").map((s: string) => s.trim()).filter(Boolean));
        const memDeps = this.nodes.get(taskId)?.dependsOn ?? new Set<string>();
        // Sync: block attrs are source of truth for which deps exist
        if (!setsEqual(blockDeps, memDeps as Set<string>)) {
          logger.info("[DependencyGraph] Deps diverged from block", { taskId, block: Array.from(blockDeps), memory: Array.from(memDeps) });
          // Rebuild this node's edges
          const node = this.nodes.get(taskId);
          if (node) {
            // Remove old reverse edges
            for (const oldDep of node.dependsOn) {
              const depNode = this.nodes.get(oldDep);
              if (depNode) (depNode.dependents as Set<string>).delete(taskId);
            }
            // Set new deps — cast through unknown since dependsOn is ReadonlySet
            const mNode = node as unknown as { dependsOn: Set<string> };
            mNode.dependsOn = blockDeps;
            // Add new reverse edges
            for (const newDep of blockDeps) {
              const depNode = this.nodes.get(newDep);
              if (depNode) (depNode.dependents as Set<string>).add(taskId);
            }
            this.recalcReady(taskId);
          }
        }
      }
    } catch (err) {
      logger.warn("[DependencyGraph] Block validation failed", { taskId, err });
    }
  }

  // ── Rebuild / Invalidation ───────────────────────────────────

  rebuild(): void {
    const prevBlocked = new Set(this.getBlockedTasks());
    this.nodes.clear();

    const allTasks = this.repository.getAllTasks();
    const taskMap = new Map<string, Task>();
    for (const t of allTasks) taskMap.set(t.id, t);

    // Phase 1: Create all nodes
    for (const task of allTasks) {
      const dependsOn = new Set<string>();
      for (const depId of task.dependsOn ?? []) {
        if (taskMap.has(depId)) dependsOn.add(depId);
      }
      if (task.blockedBy) {
        for (const bId of task.blockedBy) {
          if (taskMap.has(bId)) dependsOn.add(bId);
        }
      }

      this.nodes.set(task.id, {
        taskId: task.id,
        blockId: task.blockId ?? task.linkedBlockId,
        dependsOn,
        dependents: new Set<string>(),
        ready: true, // computed below
        lastValidated: 0,
      });
    }

    // Phase 2: Populate reverse edges
    for (const [tid, node] of this.nodes) {
      for (const depId of node.dependsOn) {
        const depNode = this.nodes.get(depId);
        if (depNode) (depNode.dependents as Set<string>).add(tid);
      }
    }

    // Phase 3: Compute readiness
    for (const [tid] of this.nodes) {
      this.recalcReady(tid);
    }

    // Phase 4: Emit blocked/unblocked events for state changes
    const newBlocked = new Set(this.getBlockedTasks());
    this.emitStateChanges(prevBlocked, newBlocked);

    logger.info("[DependencyGraph] Rebuilt", { nodes: this.nodes.size });
  }

  /** Invalidate a single task and recompute. */
  invalidateTask(taskId: string): void {
    const prevBlocked = new Set(this.getBlockedTasks());
    // Full rebuild for correctness — cascading deps can ripple
    this.rebuild();
    const newBlocked = new Set(this.getBlockedTasks());
    this.emitStateChanges(prevBlocked, newBlocked);
  }

  /** Evict a node and clean up edges. */
  evictNode(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (!node) return;

    // Remove forward edges
    for (const depId of node.dependsOn) {
      const depNode = this.nodes.get(depId);
      if (depNode) (depNode.dependents as Set<string>).delete(taskId);
    }
    // Remove reverse edges
    for (const depId of node.dependents) {
      const depNode = this.nodes.get(depId);
      if (depNode) (depNode.dependsOn as Set<string>).delete(taskId);
    }
    this.nodes.delete(taskId);

    // Recompute readiness for affected nodes
    for (const depId of node.dependents) {
      this.recalcReady(depId);
    }
  }

  // ── Recurrence Inheritance ───────────────────────────────────

  /**
   * When a recurring task generates a new instance, inherit dependencies
   * from the original task and rebind to the latest instance of each parent.
   */
  inheritDependencies(newTaskId: string, originalTaskId: string): void {
    const origNode = this.nodes.get(originalTaskId);
    if (!origNode || origNode.dependsOn.size === 0) return;

    const newTask = this.repository.getTask(newTaskId);
    if (!newTask) return;

    // Ensure node exists for new task
    if (!this.nodes.has(newTaskId)) {
      this.nodes.set(newTaskId, {
        taskId: newTaskId,
        blockId: newTask.blockId ?? newTask.linkedBlockId,
        dependsOn: new Set<string>(),
        dependents: new Set<string>(),
        ready: true,
        lastValidated: 0,
      });
    }

    for (const depId of origNode.dependsOn) {
      // Find latest instance if dep is a recurring task
      const latestDepId = this.findLatestSeriesInstance(depId) ?? depId;
      this.addDependency(newTaskId, latestDepId);
    }

    logger.info("[DependencyGraph] Dependencies inherited", {
      newTaskId,
      originalTaskId,
      deps: Array.from(origNode.dependsOn),
    });
  }

  // ── Stats ────────────────────────────────────────────────────

  getStats(): DependencyGraphStats {
    let edges = 0;
    let blocked = 0;
    let ready = 0;
    for (const node of this.nodes.values()) {
      edges += node.dependsOn.size;
      if (!node.ready && node.dependsOn.size > 0) blocked++;
      if (node.ready && node.dependsOn.size > 0) ready++;
    }
    return { nodes: this.nodes.size, edges, blockedTasks: blocked, readyTasks: ready };
  }

  // ── Private Helpers ──────────────────────────────────────────

  private recalcReady(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (!node) return;
    if (node.dependsOn.size === 0) {
      (node as { ready: boolean }).ready = true;
      return;
    }
    let allMet = true;
    for (const depId of node.dependsOn) {
      const depTask = this.repository.getTask(depId);
      if (depTask && isTaskActive(depTask)) {
        allMet = false;
        break;
      }
    }
    (node as { ready: boolean }).ready = allMet;
  }

  private buildBlockerChain(startId: string, maxDepth: number): string[] {
    const chain: string[] = [startId];
    const visited = new Set([startId]);
    let current = startId;
    for (let i = 0; i < maxDepth; i++) {
      const node = this.nodes.get(current);
      if (!node) break;
      let next: string | null = null;
      for (const depId of node.dependsOn) {
        const depTask = this.repository.getTask(depId);
        if (depTask && isTaskActive(depTask) && !visited.has(depId)) {
          next = depId;
          break;
        }
      }
      if (!next) break;
      chain.push(next);
      visited.add(next);
      current = next;
    }
    return chain;
  }

  /**
   * DFS: check if `target` is reachable from `current` via dependsOn edges.
   */
  private dfsReachable(
    current: string,
    target: string,
    visited: Set<string>,
    path: string[]
  ): boolean {
    visited.add(current);
    path.push(current);
    const node = this.nodes.get(current);
    if (!node) { path.pop(); return false; }
    for (const depId of node.dependsOn) {
      if (depId === target) return true;
      if (visited.has(depId)) continue;
      if (this.dfsReachable(depId, target, visited, path)) return true;
    }
    path.pop();
    return false;
  }

  /**
   * DFS: find any cycle reachable from startId.
   */
  private dfsCycle(
    current: string,
    visited: Set<string>,
    stack: Set<string>,
    path: string[]
  ): boolean {
    visited.add(current);
    stack.add(current);
    path.push(current);
    const node = this.nodes.get(current);
    if (!node) { path.pop(); stack.delete(current); return false; }
    for (const depId of node.dependsOn) {
      if (!visited.has(depId)) {
        if (this.dfsCycle(depId, visited, stack, path)) return true;
      } else if (stack.has(depId)) {
        const idx = path.indexOf(depId);
        if (idx >= 0) path.splice(0, idx);
        return true;
      }
    }
    path.pop();
    stack.delete(current);
    return false;
  }

  /**
   * For a recurring task, find the latest series instance by seriesId.
   */
  private findLatestSeriesInstance(taskId: string): string | null {
    const task = this.repository.getTask(taskId);
    if (!task?.seriesId) return null;
    const allTasks = this.repository.getAllTasks();
    let latest: Task | null = null;
    for (const t of allTasks) {
      if (t.seriesId !== task.seriesId) continue;
      if (!latest || (t.occurrenceIndex ?? 0) > (latest.occurrenceIndex ?? 0)) {
        latest = t;
      }
    }
    return latest?.id !== taskId ? (latest?.id ?? null) : null;
  }

  /**
   * Emit blocked/unblocked events based on state changes.
   */
  private emitStateChanges(prevBlocked: Set<string>, newBlocked: Set<string>): void {
    // New blocked
    for (const tid of newBlocked) {
      if (!prevBlocked.has(tid)) {
        const node = this.nodes.get(tid);
        this.eventBus.emit("task:blocked", {
          taskId: tid,
          blockers: node ? Array.from(node.dependsOn) : [],
        });
      }
    }
    // Newly unblocked
    for (const tid of prevBlocked) {
      if (!newBlocked.has(tid)) {
        this.eventBus.emit("task:unblocked", { taskId: tid });
      }
    }
  }

  // ── Event Subscriptions ──────────────────────────────────────

  private subscribeEvents(): void {
    const bus = this.eventBus;

    this.unsubscribes.push(
      bus.on("task:complete", (p) => {
        const prevBlocked = new Set(this.getBlockedTasks());
        // Completing a task may unblock dependents
        this.recalcReadyForDependents(p.taskId);
        const newBlocked = new Set(this.getBlockedTasks());
        this.emitStateChanges(prevBlocked, newBlocked);

        // Emit dependency:resolved for each dependent that was waiting on this task
        const node = this.nodes.get(p.taskId);
        if (node) {
          for (const depId of node.dependents) {
            this.eventBus.emit("dependency:resolved", {
              taskId: depId,
              resolvedDepId: p.taskId,
            });
          }
        }
      }),

      bus.on("task:updated", (p) => this.invalidateTask(p.taskId)),

      bus.on("block:deleted", (p) => {
        for (const [tid, node] of this.nodes) {
          if (node.blockId === p.blockId) {
            this.evictNode(tid);
            break;
          }
        }
      }),

      bus.on("block:updated", (p) => {
        for (const [tid, node] of this.nodes) {
          if (node.blockId === p.blockId) {
            this.invalidateTask(tid);
            break;
          }
        }
      }),

      bus.on("task:refresh", () => this.rebuild()),

      bus.on("task:saved", (p) => {
        if (p.isNew) {
          // New task — add to graph
          this.rebuild();
        }
      }),
    );
  }

  private recalcReadyForDependents(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (!node) return;
    for (const depId of node.dependents) {
      this.recalcReady(depId);
    }
  }
}

// ── Utility ──────────────────────────────────────────────────

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}
