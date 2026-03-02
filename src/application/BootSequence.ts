/**
 * BootSequence — Deterministic service construction & startup.
 *
 * Extracts the ~400 lines of service construction from index.ts into
 * a structured, testable boot pipeline. Each phase produces a typed
 * service group that feeds into the next.
 *
 * Boot Phases:
 *   Phase 1 (onload):  Core services — storage, recurrence, scheduler, event bus
 *   Phase 2 (onload):  CQRS layer — runtime bridge, reactive managers, task service
 *   Phase 3 (onload):  Migration + store init + frontend wiring
 *   Phase 4 (layout):  Engine — cache, dependency graph, engine controller
 *   Phase 5 (layout):  Runtime validation — block validator, lifecycle, ML adapter
 *   Phase 6 (layout):  Pipelines — reminders, escalation, integration
 *   Phase 7 (layout):  Intelligence — AI orchestrator, attention gate
 *   Phase 8 (layout):  CQRS start — bridge, reactive manager, block layer, commands
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Each phase is a pure function (input → services)
 *   ✔ Dependency order is enforced by type system
 *   ✔ Lifecycle markers emitted at phase boundaries
 *   ❌ No UI logic — that stays in index.ts
 */

import type { Plugin } from "siyuan";
import { getFrontend } from "siyuan";
import * as pluginLogger from "@shared/logging/logger";

// ── Core Services ──────────────────────────────────────────
import { TaskStorage } from "@backend/core/storage/TaskStorage";
import { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import { Scheduler } from "@backend/core/engine/Scheduler";
import { OccurrenceBlockCreator } from "@backend/core/engine/OccurrenceBlockCreator";
import { EventService } from "@backend/services/EventService";
import { EventService as WebhookEventService } from "@backend/services/WebhookEventService";
import { pluginEventBus } from "@backend/core/events/PluginEventBus";
import { BlockMetadataService } from "@backend/core/api/BlockMetadataService";
import { TaskCreationService } from "@backend/core/services/TaskCreationService";
import { AutoMigrationService } from "@backend/core/services/AutoMigrationService";
import { mergeSettings, type PluginSettings } from "@backend/core/settings/PluginSettings";
import { NotificationState } from "@backend/core/engine/NotificationState";
import { STORAGE_NAME } from "@/plugin/constants";
import { NOTIFICATION_STATE_KEY } from "@shared/constants/misc-constants";

// ── CQRS Layer ─────────────────────────────────────────────
import { SiYuanRuntimeBridge } from "@backend/runtime/SiYuanRuntimeBridge";
import { ReactiveTaskManager } from "@backend/core/managers/ReactiveTaskManager";
import { ReactiveBlockLayer } from "@backend/blocks/ReactiveBlockLayer";
import { CommandRegistry } from "@backend/commands/CommandRegistry";
import { TaskService } from "@backend/services/TaskService";
import { SyncService } from "@backend/services/SyncService";

// ── Engine Layer ───────────────────────────────────────────
import { CacheManager } from "@backend/cache/CacheManager";
import { DependencyManager } from "@backend/dependencies/DependencyManager";
import { EngineController } from "@backend/core/engine/EngineController";

// ── Runtime Validation Layer ───────────────────────────────
import { BlockAttributeValidator } from "@backend/services/BlockAttributeValidator";
import { RecurrenceResolver } from "@backend/services/RecurrenceResolver";
import { TaskLifecycle } from "@backend/services/TaskLifecycle";
import { MLRuntimeAdapter } from "@backend/services/MLRuntimeAdapter";

// ── Pipeline Services ──────────────────────────────────────
import { ReminderService } from "@backend/reminders/ReminderService";
import { IntegrationManager } from "@backend/integrations/IntegrationManager";
import { EscalationManager } from "@backend/events/EscalationManager";

// ── Query & Execution Pipeline ─────────────────────────────
import { TaskQueryEngine } from "@backend/query/TaskQueryEngine";
import { ExecutionPipeline } from "@runtime/ExecutionPipeline";

// ── Intelligence Layer ─────────────────────────────────────
import { AIOrchestrator } from "@backend/core/ai/AIOrchestrator";
import { AttentionGateFilter } from "@backend/core/attention/AttentionGateFilter";
import { UrgencyDecayTracker } from "@backend/core/attention/UrgencyDecayTracker";

// ── Lifecycle Markers ──────────────────────────────────────
import {
  markPluginLoaded,
  markStorageLoaded,
  markBlockAttrsValidated,
  markCacheRebuilt,
  markSchedulerSynced,
  markDependencyGraphReady,
  markDomainMapperReady,
  markTaskLifecycleReady,
} from "@frontend/stores/RuntimeReady.store";

// ── Service Registry Types ─────────────────────────────────
import type {
  CoreServices,
  CQRSServices,
  EngineServices,
  RuntimeValidationServices,
  PipelineServices,
  IntelligenceServices,
} from "./ServiceRegistry";

// ── Canonical Service Graph (spec §2–§10) ──────────────────
import { bootCanonicalServices, type CanonicalServiceRegistry } from "./CanonicalBoot";

// ═════════════════════════════════════════════════════════════
// Phase 1: Core Services (onload)
// ═════════════════════════════════════════════════════════════

export async function bootCoreServices(plugin: Plugin): Promise<CoreServices> {
  pluginLogger.info(`[BootSequence] Phase 1: Core services`);

  // Detect platform
  const frontend = getFrontend();
  const isMobile = frontend === "mobile" || frontend === "browser-mobile";

  // Load settings
  const userSettings = (await plugin.loadData(STORAGE_NAME)) || {};
  const settings: PluginSettings = mergeSettings(userSettings);
  pluginLogger.info(`[BootSequence] Settings loaded. RRule default:`, settings.recurrence.useRRuleByDefault);

  // Construct core services (dependency order)
  const bus = pluginEventBus;
  const recurrenceEngine = new RecurrenceEngine();
  const blockMetadataService = new BlockMetadataService();

  const taskStorage = new TaskStorage(plugin);
  await taskStorage.init();

  const sharedNotificationState = new NotificationState(plugin, NOTIFICATION_STATE_KEY);

  const scheduler = new Scheduler(taskStorage, undefined, plugin);

  const eventService = new EventService({ pluginEventBus: bus });
  await eventService.init();

  // Legacy webhook event service (n8n direct)
  const webhookEventService = new WebhookEventService(plugin, {
    notificationState: sharedNotificationState,
  });
  await webhookEventService.init();
  webhookEventService.bindScheduler(scheduler);

  // Wire occurrence block creator for recurring tasks
  const occurrenceCreator = new OccurrenceBlockCreator(plugin, taskStorage, blockMetadataService);
  webhookEventService.setOccurrenceCreator(occurrenceCreator);

  const taskCreationService = new TaskCreationService(settings);
  const autoMigrationService = new AutoMigrationService(settings);

  markPluginLoaded();
  markStorageLoaded();

  return {
    plugin,
    pluginEventBus: bus,
    taskStorage,
    recurrenceEngine,
    scheduler,
    eventService,
    webhookEventService,
    blockMetadataService,
    taskCreationService,
    autoMigrationService,
    settings,
    isMobile,
  };
}

// ═════════════════════════════════════════════════════════════
// Phase 2: CQRS Layer (onload)
// ═════════════════════════════════════════════════════════════

export function bootCQRSLayer(core: CoreServices): CQRSServices {
  pluginLogger.info(`[BootSequence] Phase 2: CQRS layer`);

  const runtimeBridge = new SiYuanRuntimeBridge(core.plugin, core.pluginEventBus);

  const reactiveTaskManager = new ReactiveTaskManager({
    storage: core.taskStorage,
    scheduler: core.scheduler,
    pluginEventBus: core.pluginEventBus,
    runtimeBridge,
    blockMetadataService: core.blockMetadataService,
  });

  const reactiveBlockLayer = new ReactiveBlockLayer({
    runtimeBridge,
    pluginEventBus: core.pluginEventBus,
    repository: core.taskStorage,
    settingsProvider: () => core.settings,
    recurrenceEngine: core.recurrenceEngine,
  });

  const commandRegistry = new CommandRegistry();

  const syncService = new SyncService({
    blockAttributeSync: reactiveBlockLayer.attributeSync,
    blockMetadataService: core.blockMetadataService,
    eventService: core.eventService,
  });
  syncService.start();

  const taskService = new TaskService({
    taskStorage: core.taskStorage,
    recurrenceEngine: core.recurrenceEngine,
    eventService: core.eventService,
    syncService,
  });
  taskService.start();

  pluginLogger.info(`[BootSequence] CQRS layer initialized`);
  return { runtimeBridge, reactiveTaskManager, reactiveBlockLayer, commandRegistry, taskService, syncService };
}

// ═════════════════════════════════════════════════════════════
// Phase 3: Migration (onload)
// ═════════════════════════════════════════════════════════════

export async function runMigration(
  core: CoreServices,
): Promise<{ migrated: number }> {
  pluginLogger.info(`[BootSequence] Phase 3: Migration check`);

  const tasks = await core.taskStorage.loadActive();
  const tasksArray = Array.from(tasks.values());

  const needsCount = core.autoMigrationService.getTasksNeedingMigrationCount(tasksArray);
  if (needsCount === 0) return { migrated: 0 };

  pluginLogger.info(`[BootSequence] ${needsCount} tasks require migration`);

  const result = await core.autoMigrationService.migrateAll(
    tasksArray,
    async (migratedTask) => {
      await core.taskStorage.saveTask(migratedTask);
    },
  );

  if (result.failed > 0) {
    pluginLogger.warn(`[BootSequence] Migration: ${result.failed} failures`, result.errors);
  }

  return { migrated: result.migrated };
}

// ═════════════════════════════════════════════════════════════
// Phase 4: Engine Layer (onLayoutReady)
// ═════════════════════════════════════════════════════════════

export function bootEngineLayer(core: CoreServices): EngineServices {
  pluginLogger.info(`[BootSequence] Phase 4: Engine layer`);

  markBlockAttrsValidated();

  const cacheManager = new CacheManager({
    repository: core.taskStorage,
    pluginEventBus: core.pluginEventBus,
    computeNextOccurrence: (task) => {
      try {
        const ref = task.dueAt ? new Date(task.dueAt) : new Date();
        const next = core.recurrenceEngine.next(task, ref);
        return next ? next.toISOString() : null;
      } catch {
        return null;
      }
    },
  });

  const dependencyManager = new DependencyManager({
    repository: core.taskStorage,
    pluginEventBus: core.pluginEventBus,
  });

  const engineController = new EngineController({
    scheduler: core.scheduler,
    cacheManager,
    dependencyManager,
    pluginEventBus: core.pluginEventBus,
  });

  return { cacheManager, dependencyManager, engineController };
}

/**
 * Start the engine controller and emit lifecycle markers.
 * Returns a promise that resolves when the engine is fully booted.
 */
export async function startEngineController(engine: EngineServices): Promise<void> {
  try {
    await engine.engineController.start();
    markCacheRebuilt();
    markSchedulerSynced();
    markDependencyGraphReady();
    pluginLogger.info(`[BootSequence] EngineController started — lifecycle gates marked`);
  } catch (err) {
    pluginLogger.error(`[BootSequence] EngineController start failed:`, err);
    // Mark anyway to unblock UI (degraded mode)
    markCacheRebuilt();
    markSchedulerSynced();
    markDependencyGraphReady();
  }
}

// ═════════════════════════════════════════════════════════════
// Phase 5: Runtime Validation (onLayoutReady)
// ═════════════════════════════════════════════════════════════

export function bootRuntimeValidation(
  core: CoreServices,
  cqrs: CQRSServices,
  engine: EngineServices,
): RuntimeValidationServices | null {
  pluginLogger.info(`[BootSequence] Phase 5: Runtime validation layer`);

  const blockAttributeValidator = new BlockAttributeValidator({
    blockAttributeSync: cqrs.reactiveBlockLayer.attributeSync,
  });

  const recurrenceResolver = new RecurrenceResolver({
    recurrenceEngine: core.recurrenceEngine,
  });

  const taskLifecycle = new TaskLifecycle({
    dependencyGuard: engine.dependencyManager.guard,
    blockValidator: blockAttributeValidator,
    recurrenceResolver,
    eventService: core.eventService,
  });
  taskLifecycle.start();

  markDomainMapperReady();
  markTaskLifecycleReady();

  const mlRuntimeAdapter = new MLRuntimeAdapter({
    eventService: core.eventService,
    blockValidator: blockAttributeValidator,
    getTask: (taskId: string) => core.taskStorage.getTask(taskId),
  });
  mlRuntimeAdapter.start();

  pluginLogger.info(`[BootSequence] Runtime validation layer started`);
  return { blockAttributeValidator, recurrenceResolver, taskLifecycle, mlRuntimeAdapter };
}

// ═════════════════════════════════════════════════════════════
// Phase 6: Pipeline Services (onLayoutReady)
// ═════════════════════════════════════════════════════════════

export function bootPipelines(
  core: CoreServices,
  cqrs: CQRSServices,
  engine: EngineServices,
  rv: RuntimeValidationServices,
  notificationState: NotificationState,
): PipelineServices {
  pluginLogger.info(`[BootSequence] Phase 6: Pipeline services`);

  // Reminder service
  const reminderService = new ReminderService({
    eventService: core.eventService,
    dependencyGuard: engine.dependencyManager.guard,
    blockValidator: rv.blockAttributeValidator,
    recurrenceResolver: rv.recurrenceResolver,
    getTask: (taskId: string) => core.taskStorage.getTask(taskId),
  });
  reminderService.start();

  // Integration manager
  const integrationManager = new IntegrationManager(
    {
      pluginEventBus: core.pluginEventBus,
      blockAttributeSync: cqrs.reactiveBlockLayer.attributeSync,
    },
    { workspaceId: "" },
  );
  integrationManager.start();

  // Escalation manager (needs event queue from engine controller)
  let escalationManager: EscalationManager | null = null;
  const eventQueue = engine.engineController.getEventQueue();
  if (eventQueue) {
    escalationManager = new EscalationManager({
      pluginEventBus: core.pluginEventBus,
      dependencyGuard: engine.dependencyManager.guard,
      blockAttributeSync: cqrs.reactiveBlockLayer.attributeSync,
      notificationState,
      eventQueue,
      integrationManager,
      getTask: async (taskId) => core.taskStorage.getTask(taskId),
    });
    escalationManager.start();
    pluginLogger.info(`[BootSequence] EscalationManager started`);
  }

  pluginLogger.info(`[BootSequence] Pipeline services started`);

  // TaskQueryEngine — wires all caches + selectors into a single query entry point
  const taskQueryEngine = new TaskQueryEngine({
    taskCache: engine.cacheManager.taskCache,
    recurrenceCache: engine.cacheManager.recurrenceCache,
    analyticsCache: engine.cacheManager.analyticsCache,
    dependencyGuard: engine.dependencyManager.guard,
    blockAttributeSync: cqrs.reactiveBlockLayer.attributeSync,
    recurrenceEngine: core.recurrenceEngine,
    pluginEventBus: core.pluginEventBus,
  });
  taskQueryEngine.start();
  pluginLogger.info(`[BootSequence] TaskQueryEngine started`);

  // ExecutionPipeline — deterministic post-tick task processing (§3.4)
  const executionPipeline = new ExecutionPipeline({
    queryEngine: taskQueryEngine,
    dependencyGuard: engine.dependencyManager.guard,
    recurrenceResolver: rv.recurrenceResolver,
    blockValidator: rv.blockAttributeValidator,
    taskLifecycle: rv.taskLifecycle,
    pluginEventBus: core.pluginEventBus,
    reminderService,
    integrationManager,
    // aiEngine: intelligence layer not yet available at this phase
  });
  executionPipeline.start();
  pluginLogger.info(`[BootSequence] ExecutionPipeline started`);

  return { reminderService, integrationManager, escalationManager, sharedNotificationState: notificationState, taskQueryEngine, executionPipeline };
}

// ═════════════════════════════════════════════════════════════
// Phase 7: Intelligence Layer (onLayoutReady)
// ═════════════════════════════════════════════════════════════

export async function bootIntelligence(
  core: CoreServices,
): Promise<IntelligenceServices> {
  pluginLogger.info(`[BootSequence] Phase 7: Intelligence layer`);

  const aiOrchestrator = new AIOrchestrator(
    core.plugin,
    (taskId: string) => core.taskStorage.getTask(taskId),
  );
  await aiOrchestrator.init().catch((err) => {
    pluginLogger.warn(`[BootSequence] AI Orchestrator init failed:`, err);
  });

  const urgencyDecayTracker = new UrgencyDecayTracker(core.plugin);
  let attentionGateFilter: AttentionGateFilter | null = null;

  try {
    await urgencyDecayTracker.load();
    attentionGateFilter = new AttentionGateFilter(urgencyDecayTracker);
    attentionGateFilter.bind(core.scheduler);
    pluginLogger.info(`[BootSequence] AttentionGateFilter bound to scheduler`);
  } catch (err) {
    pluginLogger.warn(`[BootSequence] AttentionGateFilter init failed:`, err);
  }

  return { aiOrchestrator, attentionGateFilter, urgencyDecayTracker };
}

// ═════════════════════════════════════════════════════════════
// Phase 8: Start CQRS runtime (onLayoutReady)
// ═════════════════════════════════════════════════════════════

export interface CQRSStartOptions {
  plugin: Plugin;
  openQuickTaskEditor: () => void;
  openTaskEditorForBlock: (blockId: string, blockContent: string) => void;
  showTodayTasks: () => void;
}

export function startCQRSRuntime(
  core: CoreServices,
  cqrs: CQRSServices,
  opts: CQRSStartOptions,
): void {
  pluginLogger.info(`[BootSequence] Phase 8: Starting CQRS runtime`);

  cqrs.runtimeBridge.start();
  cqrs.reactiveTaskManager.wire();
  cqrs.reactiveBlockLayer.start();

  cqrs.commandRegistry.register({
    plugin: opts.plugin,
    pluginEventBus: core.pluginEventBus,
    scheduler: core.scheduler,
    runtimeBridge: cqrs.runtimeBridge,
    openQuickTaskEditor: opts.openQuickTaskEditor,
    openTaskEditorForBlock: opts.openTaskEditorForBlock,
    showTodayTasks: opts.showTodayTasks,
  });

  // Emit runtime:ready — all services are initialized (spec §6, §7)
  core.pluginEventBus.emit("runtime:ready", {} as Record<string, never>);

  pluginLogger.info(`[BootSequence] CQRS runtime started — runtime:ready emitted`);
}

// ═════════════════════════════════════════════════════════════
// Phase 9: Canonical Service Graph (spec §2–§10)
// ═════════════════════════════════════════════════════════════

/**
 * Boot the spec-compliant canonical services alongside the legacy graph.
 * Call this after Phase 1 (core) so that storage callbacks are available.
 */
export function bootCanonicalPhase(core: CoreServices): CanonicalServiceRegistry {
  pluginLogger.info(`[BootSequence] Phase 9: Canonical service graph`);

  return bootCanonicalServices({
    loadTask: (taskId) => core.taskStorage.getTask(taskId),
    persistTask: (task) => core.taskStorage.saveTask(task),
    removeTask: (taskId) => core.taskStorage.deleteTask(taskId),
  });
}
