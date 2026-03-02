/**
 * ServiceRegistry — Typed service container for the entire plugin.
 *
 * Holds references to ALL instantiated services. Created by the CompositionRoot,
 * consumed by plugin modules (docks, tabs, topbar, etc.) and the Plugin class.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Single source of truth for all service references
 *   ✔ Immutable after construction (readonly fields)
 *   ✔ Services are registered once during boot, never replaced
 *   ❌ NO business logic — just a typed bag of references
 */

import type { Plugin } from "siyuan";
import type { TaskStorage } from "@backend/core/storage/TaskStorage";
import type { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import type { Scheduler } from "@backend/core/engine/Scheduler";
import type { EventService } from "@backend/services/EventService";
import type { EventService as WebhookEventService } from "@backend/services/WebhookEventService";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { BlockMetadataService } from "@backend/core/api/BlockMetadataService";
import type { TaskCreationService } from "@backend/core/services/TaskCreationService";
import type { AutoMigrationService } from "@backend/core/services/AutoMigrationService";
import type { PluginSettings } from "@backend/core/settings/PluginSettings";
import type { SiYuanRuntimeBridge } from "@backend/runtime/SiYuanRuntimeBridge";
import type { ReactiveTaskManager } from "@backend/core/managers/ReactiveTaskManager";
import type { ReactiveBlockLayer } from "@backend/blocks/ReactiveBlockLayer";
import type { CommandRegistry } from "@backend/commands/CommandRegistry";
import type { TaskService } from "@backend/services/TaskService";
import type { SyncService } from "@backend/services/SyncService";
import type { TaskLifecycle } from "@backend/services/TaskLifecycle";
import type { BlockAttributeValidator } from "@backend/services/BlockAttributeValidator";
import type { RecurrenceResolver } from "@backend/services/RecurrenceResolver";
import type { MLRuntimeAdapter } from "@backend/services/MLRuntimeAdapter";
import type { CacheManager } from "@backend/cache/CacheManager";
import type { DependencyManager } from "@backend/dependencies/DependencyManager";
import type { EngineController } from "@backend/core/engine/EngineController";
import type { ReminderService } from "@backend/reminders/ReminderService";
import type { IntegrationManager } from "@backend/integrations/IntegrationManager";
import type { EscalationManager } from "@backend/events/EscalationManager";
import type { NotificationState } from "@backend/core/engine/NotificationState";
import type { TaskQueryEngine } from "@backend/query/TaskQueryEngine";
import type { ExecutionPipeline } from "@runtime/ExecutionPipeline";
import type { AIOrchestrator } from "@backend/core/ai/AIOrchestrator";
import type { AttentionGateFilter } from "@backend/core/attention/AttentionGateFilter";
import type { UrgencyDecayTracker } from "@backend/core/attention/UrgencyDecayTracker";
import type { MountService } from "@frontend/mounts/MountService";
import type { MountHandle } from "@frontend/mounts/types";
import type { PluginServices } from "@/plugin/types";
import type { WebhookServices } from "./WebhookBoot";

// ─── Core Services (constructed in onload) ──────────────────

export interface CoreServices {
  readonly plugin: Plugin;
  readonly pluginEventBus: PluginEventBus;
  readonly taskStorage: TaskStorage;
  readonly recurrenceEngine: RecurrenceEngine;
  readonly scheduler: Scheduler;
  readonly eventService: EventService;
  readonly webhookEventService: WebhookEventService;
  readonly blockMetadataService: BlockMetadataService;
  readonly taskCreationService: TaskCreationService;
  readonly autoMigrationService: AutoMigrationService;
  readonly settings: PluginSettings;
  readonly isMobile: boolean;
}

// ─── CQRS Layer (constructed in onload) ─────────────────────

export interface CQRSServices {
  readonly runtimeBridge: SiYuanRuntimeBridge;
  readonly reactiveTaskManager: ReactiveTaskManager;
  readonly reactiveBlockLayer: ReactiveBlockLayer;
  readonly commandRegistry: CommandRegistry;
  readonly taskService: TaskService;
  readonly syncService: SyncService;
}

// ─── Runtime Validation Layer (constructed in onLayoutReady) ─

export interface RuntimeValidationServices {
  readonly blockAttributeValidator: BlockAttributeValidator;
  readonly recurrenceResolver: RecurrenceResolver;
  readonly taskLifecycle: TaskLifecycle;
  readonly mlRuntimeAdapter: MLRuntimeAdapter;
}

// ─── Engine Layer (constructed in onLayoutReady) ─────────────

export interface EngineServices {
  readonly cacheManager: CacheManager;
  readonly dependencyManager: DependencyManager;
  readonly engineController: EngineController;
}

// ─── Pipeline Services (constructed in onLayoutReady) ────────

export interface PipelineServices {
  readonly reminderService: ReminderService;
  readonly integrationManager: IntegrationManager;
  readonly escalationManager: EscalationManager | null;
  readonly sharedNotificationState: NotificationState;
  readonly taskQueryEngine: TaskQueryEngine;
  readonly executionPipeline: ExecutionPipeline;
}

// ─── Intelligence Layer (constructed in onLayoutReady) ───────

export interface IntelligenceServices {
  readonly aiOrchestrator: AIOrchestrator;
  readonly attentionGateFilter: AttentionGateFilter | null;
  readonly urgencyDecayTracker: UrgencyDecayTracker;
}

// ─── UI Layer ────────────────────────────────────────────────

export interface UIServices {
  readonly mountService: MountService;
  reminderFloatHandle: MountHandle | null;
}

// ─── Full Registry ──────────────────────────────────────────

/**
 * Complete service registry holding ALL service references.
 * Populated incrementally by the CompositionRoot during boot phases.
 */
export interface ServiceRegistry {
  core: CoreServices | null;
  cqrs: CQRSServices | null;
  engine: EngineServices | null;
  runtimeValidation: RuntimeValidationServices | null;
  pipelines: PipelineServices | null;
  intelligence: IntelligenceServices | null;
  ui: UIServices | null;
  webhook: WebhookServices | null;
}

/**
 * Create an empty service registry.
 */
export function createServiceRegistry(): ServiceRegistry {
  return {
    core: null,
    cqrs: null,
    engine: null,
    runtimeValidation: null,
    pipelines: null,
    intelligence: null,
    ui: null,
    webhook: null,
  };
}

/**
 * Build the legacy PluginServices container from the registry.
 * Used for backward compatibility with existing dock/tab/topbar modules.
 */
export function toPluginServices(registry: ServiceRegistry): PluginServices {
  if (!registry.core) {
    throw new Error("ServiceRegistry.core not initialized");
  }
  const c = registry.core;
  return {
    plugin: c.plugin,
    taskStorage: c.taskStorage,
    recurrenceEngine: c.recurrenceEngine,
    scheduler: c.scheduler,
    eventService: c.eventService,
    pluginEventBus: c.pluginEventBus,
    blockMetadataService: c.blockMetadataService,
    taskCreationService: c.taskCreationService,
    autoMigrationService: c.autoMigrationService,
    settings: c.settings,
    isMobile: c.isMobile,
  };
}
