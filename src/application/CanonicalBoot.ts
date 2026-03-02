/**
 * CanonicalBoot — Initializes the spec-compliant canonical service graph.
 *
 * Runs alongside the legacy BootSequence to allow incremental migration.
 * All canonical services follow the layered architecture (spec §2–§10):
 *   EventBus → TaskCache → QueryEngine → Scheduler
 *   DependencyGraph → DependencyExecutionGuard
 *   TaskService, ReminderService, IntegrationService, SmartSuggestionEngine
 *
 * The canonical graph is stored in `CanonicalServiceRegistry` and can be
 * imported by new modules while legacy code continues using the existing
 * ServiceRegistry.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Pure construction — deterministic dependency order
 *   ✔ No duplicate singletons — reuses EventBus module-level singleton
 *   ✔ Independent of legacy ServiceRegistry
 *   ❌ Does NOT replace legacy BootSequence (yet)
 */

import * as pluginLogger from "@shared/logging/logger";

// ── Canonical Singletons ───────────────────────────────────
import { eventBus } from "@events/EventBus";
import { taskStore } from "@stores/TaskStore";

// ── Canonical Constructables ───────────────────────────────
import { TaskCache } from "@cache/TaskCache";
import { QueryEngine } from "@query/QueryEngine";
import { DependencyGraph } from "@dependencies/DependencyGraph";
import { RecurrenceResolver } from "@engine/RecurrenceResolver";
import { DependencyExecutionGuard } from "@engine/DependencyExecutionGuard";
import { BlockAttributeValidator } from "@engine/BlockAttributeValidator";
import { TaskService } from "@services/TaskService";
import { ReminderService } from "@reminders/ReminderService";
import { IntegrationService } from "@integrations/IntegrationService";
import { SmartSuggestionEngine } from "@escalation/SmartSuggestionEngine";
import { Scheduler } from "@runtime/Scheduler";
import { MountService } from "@mounts/MountService";

import type { EventBus } from "@events/EventBus";
import type { TaskStore } from "@stores/TaskStore";

// ═════════════════════════════════════════════════════════════
// Registry
// ═════════════════════════════════════════════════════════════

export interface CanonicalServiceRegistry {
  // Singletons
  readonly eventBus: EventBus;
  readonly taskStore: TaskStore;

  // Infrastructure
  readonly taskCache: TaskCache;
  readonly queryEngine: QueryEngine;
  readonly dependencyGraph: DependencyGraph;

  // Engine
  readonly recurrenceResolver: RecurrenceResolver;
  readonly dependencyGuard: DependencyExecutionGuard;
  readonly blockValidator: BlockAttributeValidator;

  // Services
  readonly taskService: TaskService;
  readonly reminderService: ReminderService;
  readonly integrationService: IntegrationService;
  readonly smartSuggestionEngine: SmartSuggestionEngine;

  // Runtime
  readonly scheduler: Scheduler;
  readonly mountService: MountService;
}

/** Module-level reference — set once during boot. */
let _registry: CanonicalServiceRegistry | null = null;

/**
 * Get the canonical service registry.
 * Throws if boot has not been called yet.
 */
export function getCanonicalRegistry(): CanonicalServiceRegistry {
  if (!_registry) {
    throw new Error(
      "[CanonicalBoot] Registry not initialized — call bootCanonicalServices() first",
    );
  }
  return _registry;
}

// ═════════════════════════════════════════════════════════════
// Boot
// ═════════════════════════════════════════════════════════════

export interface CanonicalBootDeps {
  /**
   * Callback to load a task from persistent storage by ID.
   * Typically wired to `taskStorage.getTask()` from the legacy layer.
   */
  readonly loadTask: (taskId: string) => import("@domain/DomainTask").DomainTask | undefined;

  /**
   * Callback to persist a task to storage.
   * Typically wired to `taskStorage.saveTask()` from the legacy layer.
   */
  readonly persistTask: (task: import("@domain/DomainTask").DomainTask) => Promise<void>;

  /**
   * Callback to remove a task from storage.
   * Typically wired to `taskStorage.deleteTask()` from the legacy layer.
   */
  readonly removeTask: (taskId: string) => Promise<void>;

  /**
   * Callback for the TaskStore to refresh its data from the query engine.
   * Typically wired to `() => queryEngine.query({})`.
   */
  readonly refreshTasks?: () => Promise<ReadonlyArray<import("@domain/DomainTask").DomainTask>>;
}

/**
 * Boot all canonical services in dependency order.
 *
 * Must be called AFTER legacy storage is initialized (Phase 1 of BootSequence)
 * so that `loadTask`, `persistTask`, and `removeTask` callbacks are valid.
 *
 * @returns The populated canonical service registry.
 */
export function bootCanonicalServices(deps: CanonicalBootDeps): CanonicalServiceRegistry {
  pluginLogger.info(`[CanonicalBoot] Starting canonical service graph...`);

  // ── Layer 1: No-dependency services ──────────────────────
  const dependencyGraph = new DependencyGraph();
  const blockValidator = new BlockAttributeValidator();
  const mountService = new MountService();
  const integrationService = new IntegrationService();
  const reminderService = new ReminderService();

  // ── Layer 2: EventBus-dependent ──────────────────────────
  const taskCache = new TaskCache(eventBus);

  // ── Layer 3: Cache-dependent ─────────────────────────────
  const queryEngine = new QueryEngine(taskCache);
  const recurrenceResolver = new RecurrenceResolver(taskCache);
  const smartSuggestionEngine = new SmartSuggestionEngine(taskCache);

  // ── Layer 4: Multi-dependency ────────────────────────────
  const dependencyGuard = new DependencyExecutionGuard({
    dependencyGraph,
    cache: taskCache,
  });

  const taskService = new TaskService({
    loadTask: deps.loadTask,
    persistTask: deps.persistTask,
    removeTask: deps.removeTask,
  });

  const scheduler = new Scheduler(queryEngine);

  pluginLogger.info(`[CanonicalBoot] All canonical services constructed`);

  // ── Assemble registry ────────────────────────────────────
  _registry = Object.freeze({
    eventBus,
    taskStore,
    taskCache,
    queryEngine,
    dependencyGraph,
    recurrenceResolver,
    dependencyGuard,
    blockValidator,
    taskService,
    reminderService,
    integrationService,
    smartSuggestionEngine,
    scheduler,
    mountService,
  });

  // ── Emit readiness event ─────────────────────────────────
  eventBus.emit("runtime:ready", {} as Record<string, never>);

  pluginLogger.info(`[CanonicalBoot] Canonical service graph ready ✓`);
  return _registry;
}

// ═════════════════════════════════════════════════════════════
// Shutdown
// ═════════════════════════════════════════════════════════════

/**
 * Tear down canonical services in reverse dependency order.
 * Safe to call even if boot was never called.
 */
export function shutdownCanonicalServices(): void {
  if (!_registry) return;

  pluginLogger.info(`[CanonicalBoot] Tearing down canonical services...`);

  const r = _registry;

  // Reverse order: runtime → services → engine → infrastructure → singletons
  try { r.scheduler.stop(); } catch { /* ignore */ }
  try { r.smartSuggestionEngine.stop(); } catch { /* ignore */ }
  try { r.integrationService.stop(); } catch { /* ignore */ }
  try { r.reminderService.stop(); } catch { /* ignore */ }
  try { r.taskCache.clear(); } catch { /* ignore */ }
  try { r.eventBus.clear(); } catch { /* ignore */ }

  _registry = null;
  pluginLogger.info(`[CanonicalBoot] Canonical teardown complete`);
}
