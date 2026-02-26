/**
 * Frontend Services — Barrel Export
 *
 * Re-exports all frontend service facades and their singletons.
 * Components import from here:
 *
 *   import { uiQueryService, uiEventService, uiMutationService } from "@frontend/services";
 *   import type { TaskDTO, ReminderDTO } from "@frontend/services";
 */

// ── DTOs (types only — no runtime) ────────────────────────────
export type {
  TaskDTO,
  ReminderDTO,
  SuggestionDTO,
  SuggestionActionDTO,
  DependencyDTO,
  RecurrenceDTO,
  AnalyticsDTO,
  DashboardDTO,
  MutationResultDTO,
} from "./DTOs";

// ── UIQueryService ─────────────────────────────────────────────
export { UIQueryService, uiQueryService } from "./UIQueryService";
export type { UIQueryServiceDeps } from "./UIQueryService";

// ── UIEventService ─────────────────────────────────────────────
export { UIEventService, uiEventService } from "./UIEventService";
export type {
  UIEventServiceDeps,
  TaskRefreshPayload,
  TaskCompletedPayload,
  TaskRescheduledPayload,
  TaskSavedPayload,
  TaskUpdatedPayload,
  ReminderDuePayload,
  AISuggestionPayload,
  DependencyResolvedPayload,
  DependencyBlockedPayload,
  EscalationPayload,
} from "./UIEventService";

// ── UITaskMutationService ──────────────────────────────────────
export { UITaskMutationService, uiMutationService } from "./UITaskMutationService";
export type {
  UITaskMutationServiceDeps,
  CreateTaskDTO,
  UpdateTaskDTO,
} from "./UITaskMutationService";
