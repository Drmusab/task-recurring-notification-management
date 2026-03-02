/**
 * Services Layer — Single Mutation Authority
 *
 * TaskService is the ONLY module permitted to perform domain mutations.
 * All other services (Reminder, Integration, Sync) are orchestration services
 * that delegate mutations back to TaskService.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ All mutations go through TaskService
 *   ✔ Every mutation emits domain events
 *   ✔ Block sync happens after persistence
 *   ❌ No direct Task model mutation
 *   ❌ No SiYuan API calls (use infrastructure/)
 */

// ── Task Service (mutation gateway) ──────────────────────────
export { TaskService } from "@backend/services/TaskService";
export type {
  TaskServiceDeps,
  CreateTaskInput,
  UpdateTaskPatch,
  TaskMutationResult,
  CompletionResult,
} from "@backend/services/TaskService";

// ── Task Lifecycle (state machine) ───────────────────────────
export { TaskLifecycle } from "@backend/services/TaskLifecycle";
export type {
  TaskRuntimeState,
  TaskTransitionType,
  TransitionRequest,
  TransitionResult,
  TaskLifecycleDeps,
  TaskLifecycleStats,
} from "@backend/services/TaskLifecycle";

// ── Event Service ────────────────────────────────────────────
export { EventService } from "@backend/services/EventService";
export type {
  TaskEventType,
  N8nConfig,
  NotificationConfig,
  EventDelivery,
  EventContext,
  EventRouting,
  TaskSnapshot,
  TaskEventPayload,
  QueueItem,
} from "@backend/services/event-service.types";
export { createTaskSnapshot } from "@backend/services/event-service.types";

// ── Block Attribute Validator ────────────────────────────────
export { BlockAttributeValidator } from "@backend/services/BlockAttributeValidator";

// ── Recurrence Resolver ──────────────────────────────────────
export { RecurrenceResolver } from "@backend/services/RecurrenceResolver";

// ── Scheduler Service ────────────────────────────────────────
export { SchedulerService } from "@backend/services/SchedulerService";

// ── Sync Service ─────────────────────────────────────────────
export { SyncService } from "@backend/services/SyncService";

// ── Integration Service ──────────────────────────────────────
export { IntegrationService } from "@backend/services/IntegrationService";

// ── ML Runtime Adapter ───────────────────────────────────────
export { MLRuntimeAdapter } from "@backend/services/MLRuntimeAdapter";

// ── Webhook Event Service (legacy — prefer infrastructure/webhooks) ──
export { EventService as WebhookEventService } from "@backend/services/WebhookEventService";

// ── Webhook Infrastructure (canonical) ───────────────────────
export { WebhookManager } from "@infrastructure/webhooks/webhook-manager";
export type {
  WebhookEventType,
  WebhookPayload,
  WebhookEndpoint,
  WebhookSettings as WebhookSettingsConfig,
  WebhookRetryPolicy,
  DeliveryLogEntry,
} from "@infrastructure/webhooks/webhook-types";

// ── Query Service ────────────────────────────────────────────
export { QueryService } from "@backend/services/QueryService";

// ── Auth / API Key Service ───────────────────────────────────
export { ApiKeyManager } from "@backend/services/AuthService";

// ── Frontend Service Facades ─────────────────────────────────
export {
  UIQueryService,
  uiQueryService,
} from "@frontend/services/UIQueryService";
export type { UIQueryServiceDeps } from "@frontend/services/UIQueryService";

export {
  UIEventService,
  uiEventService,
} from "@frontend/services/UIEventService";
export type { UIEventServiceDeps } from "@frontend/services/UIEventService";

export {
  UITaskMutationService,
  uiMutationService,
} from "@frontend/services/UITaskMutationService";
export type { UITaskMutationServiceDeps } from "@frontend/services/UITaskMutationService";

// ── Canonical TaskService (Architecture Spec v3 §3.2) ──────
export { TaskService as CanonicalTaskService } from "./TaskService";
export type {
  TaskCreateInput as CanonicalCreateInput,
  TaskUpdatePatch as CanonicalUpdatePatch,
  MutationResult,
  CompletionResult as CanonicalCompletionResult,
  TaskServiceDeps as CanonicalTaskServiceDeps,
} from "./TaskService";
