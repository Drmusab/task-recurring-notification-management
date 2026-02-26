/**
 * Services barrel — Runtime-Orchestration Gateway
 *
 * Exports all service-layer modules that form the gateway between
 * Parser, Engine, Cache, ML, Integrations, Navigation, and Frontend.
 *
 * Service contracts:
 *   EventService              — Runtime signal hub (typed emit/subscribe)
 *   TaskService               — Central task mutation gateway (ONLY mutator)
 *   QueryService              — Query selector facade (over TaskQueryEngine)
 *   SchedulerService          — Scheduler read gateway + tick() (canonical flow)
 *   SyncService               — Block attribute sync (SiYuan API only)
 *   IntegrationService        — Integration guard layer (dep guard + block check + fire-once)
 *   ServiceNotificationService — Notification dispatch (routes to integrations)
 *   BlockAttributeValidator   — Runtime block validation gate (Session 19)
 *   RecurrenceResolver        — Recurrence instance resolver (Session 19)
 *   TaskLifecycle             — Runtime-validated state machine (Session 19)
 *   MLRuntimeAdapter          — AI/ML analysis gate (Session 19)
 *
 * Preserved modules:
 *   WebhookEventService       — Legacy n8n webhook dispatcher (deprecated)
 *   TaskAdapterService        — Obsidian↔SiYuan task model adapter
 *   AuthService               — API key management
 *   batch-config              — Batch operation defaults
 *   event-service.types       — Legacy event types
 */

// ─── New Service Layer ────────────────────────────────────────
export { EventService } from "./EventService";
export type { EventServiceDeps } from "./EventService";

export { TaskService } from "./TaskService";
export type { TaskServiceDeps, CreateTaskInput, UpdateTaskPatch, TaskMutationResult, CompletionResult } from "./TaskService";

export { QueryService } from "./QueryService";
export type { QueryServiceDeps, DueTasksResult } from "./QueryService";

export { SchedulerService } from "./SchedulerService";
export type { SchedulerServiceDeps, SchedulerServiceStats, ISchedulerService } from "./SchedulerService";

export { SyncService } from "./SyncService";
export type { SyncServiceDeps, BatchSyncResult } from "./SyncService";

export { IntegrationService } from "./IntegrationService";
export type { IntegrationServiceDeps, DispatchGuardResult, IntegrationDispatchResult, IntegrationServiceStats } from "./IntegrationService";

export { ServiceNotificationService } from "./NotificationService";
export type { ServiceNotificationDeps, NotificationRecord, NotificationServiceStats } from "./NotificationService";

// ─── Runtime Validation Layer (Session 19) ────────────────────
export { BlockAttributeValidator } from "./BlockAttributeValidator";
export type { BlockAttributeValidatorDeps, BlockValidationResult } from "./BlockAttributeValidator";

export { RecurrenceResolver } from "./RecurrenceResolver";
export type { RecurrenceResolverDeps, ResolveResult } from "./RecurrenceResolver";

export { TaskLifecycle } from "./TaskLifecycle";
export type {
  TaskLifecycleDeps,
  TaskRuntimeState,
  TaskTransitionType,
  TransitionRequest,
  TransitionResult,
  TaskLifecycleStats,
} from "./TaskLifecycle";

export { MLRuntimeAdapter } from "./MLRuntimeAdapter";
export type { MLRuntimeAdapterDeps, MLRuntimeAdapterStats, MLAnalysisTrigger, MLAnalysisCallback } from "./MLRuntimeAdapter";

// ─── Preserved Modules ────────────────────────────────────────
export { TaskModelAdapter, type UnifiedTask } from "./TaskAdapterService";
export { ApiKeyManager } from "./AuthService";
export { type BatchConfig, DEFAULT_BATCH_CONFIGS } from "./batch-config";

// ─── Legacy (deprecated — use IntegrationService instead) ─────
export { EventService as WebhookEventService } from "./WebhookEventService";
