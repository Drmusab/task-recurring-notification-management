/**
 * Models Layer — Domain Models & DTOs
 *
 * Canonical domain types and data transfer objects.
 * Domain models are IMMUTABLE (frozen). DTOs are read-only views.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Domain models are created via TaskFactory only
 *   ✔ DTOs are created via DomainMapper.toDTO()
 *   ✔ All model interfaces are readonly
 *   ❌ No direct construction of domain models
 *   ❌ No mutations on model instances
 */

// ── Domain Task (immutable, frozen) ──────────────────────────
export {
  isDomainTask,
  isTerminal,
  isRecurring as isDomainRecurring,
  isOverdue as isDomainOverdue,
  isDependencyBlocked,
} from "@domain/DomainTask";

export type {
  DomainTask,
  SmartRecurrenceConfig,
} from "@domain/DomainTask";

// ── Task Factory ─────────────────────────────────────────────
export {
  create as createTask,
  fromBlockAttrs,
  fromStorage,
  fromLegacy,
  fromRecurrenceInstance,
  patch as patchTask,
  duplicate as duplicateTask,
  withAnalytics,
  withDependencyLinks,
  applyTransition,
} from "@domain/TaskFactory";

export type { CreateTaskInput } from "@domain/TaskFactory";

// ── Domain Mapper (persistence ↔ domain ↔ DTO) ──────────────
export {
  toPersistence,
  fromPersistence,
  toPersistenceBatch,
  fromPersistenceBatch,
  toDTO,
} from "@domain/DomainMapper";

export type { PersistedTask, TaskDTO } from "@domain/DomainMapper";

// ── Task Lifecycle State Machine ─────────────────────────────
export {
  VALID_TRANSITIONS,
  ACTION_TARGET_MAP,
  TERMINAL_STATES,
  ACTIVE_STATES,
  ANALYTICS_TRIGGER_STATES,
  ANALYTICS_EXCLUDED_STATES,
  canTransition,
  canApplyAction,
  deriveStatus,
  deriveLifecycleState,
  applyTransition as applyLifecycleTransition,
  getAvailableActions,
} from "@domain/TaskLifecycleState";

export type {
  TaskLifecycleStateValue,
  TransitionAction,
  TransitionResult as LifecycleTransitionResult,
} from "@domain/TaskLifecycleState";

// ── Task Completion Context ──────────────────────────────────
export {
  createCompletionContext,
  isCompletionContext,
} from "@domain/TaskCompletionContext";

export type {
  TaskCompletionContext,
  CompletionTrigger,
} from "@domain/TaskCompletionContext";

// ── Task Analytics Snapshot ──────────────────────────────────
export {
  createEmptyAnalytics,
  recordCompletion,
  recordMiss,
  withLearningMetrics,
  calculateHealthScore,
  isTaskAnalyticsSnapshot,
  MAX_RECENT_COMPLETIONS,
  MAX_COMPLETION_HISTORY,
  MAX_COMPLETION_CONTEXTS,
} from "@domain/TaskAnalytics";

export type {
  TaskAnalyticsSnapshot,
  CompletionHistoryEntry,
  CompletionContextDetail,
  CompletionContextEntry,
  LearningMetrics,
} from "@domain/TaskAnalytics";

// ── Recurrence Instance ──────────────────────────────────────
export {
  createRecurrenceInstance,
  isRecurringTemplate,
  isRecurrenceChild,
  isRecurrenceInstance,
} from "@domain/RecurrenceInstance";

export type { RecurrenceInstance } from "@domain/RecurrenceInstance";

// ── Dependency Link ──────────────────────────────────────────
export {
  createDependencyLink,
  createInstanceDependencyLink,
  markSatisfied,
  getBlockingLinks,
  getDependentLinks,
  wouldCreateCycle,
  isDependencyLink,
} from "@domain/DependencyLink";

export type {
  DependencyType,
  DependencyLink,
  CreateDependencyLinkParams,
} from "@domain/DependencyLink";

// ── Domain Version ───────────────────────────────────────────
export {
  CURRENT_DOMAIN_VERSION,
  MIN_SUPPORTED_VERSION,
  needsMigration,
  isVersionSupported,
  isCurrentVersion,
  VERSION_CHANGELOG,
} from "@domain/DomainVersion";

export type {
  DomainVersion,
  VersionChangelogEntry,
} from "@domain/DomainVersion";

// ── Value Objects ────────────────────────────────────────────
export {
  isISODateString,
  isTaskId,
  unsafeTaskId,
  unsafeISODateString,
} from "@domain/models/ValueObjects";

export type {
  TaskId,
  ISODateString,
} from "@domain/models/ValueObjects";

// ── Domain Model Types ───────────────────────────────────────
export type {
  TaskStatus,
  TaskPriority,
  CompletionAction,
} from "@domain/models/Task";

export { PRIORITY_WEIGHTS } from "@domain/models/Task";

// ── Frequency ────────────────────────────────────────────────
export type { Frequency } from "@domain/models/Frequency";
export { isValidFrequency, frequencyToRRule } from "@domain/models/Frequency";

// ── Settings ─────────────────────────────────────────────────
export {
  getDefaultSettings,
  validateSettings,
} from "@domain/models/Settings";

export type {
  DateFormat,
  GroupByOption,
  SortByOption,
  SortDirection,
  Settings,
} from "@domain/models/Settings";

// ── Status Registry ──────────────────────────────────────────
export { StatusRegistry, DEFAULT_STATUSES, StatusType } from "@domain/models/TaskStatus";
export type { Status } from "@domain/models/TaskStatus";

// ── Recurrence Model ─────────────────────────────────────────
export {
  createRecurrence,
  isRecurrence,
  validateRRule,
  cloneRecurrence,
  mergeRecurrence,
} from "@domain/models/Recurrence";

export type {
  Recurrence,
  RecurrenceResult,
  RecurrenceValidation,
} from "@domain/models/Recurrence";

// ── Backend Task Model (extended, for storage compatibility) ─
export type {
  Task as BackendTask,
  ReadonlyTask,
  CrossNoteDependency,
  DependencyCondition,
} from "@backend/core/models/Task";

export {
  createTask as createBackendTask,
  normalizePriority as normalizeBackendPriority,
  duplicateTask as duplicateBackendTask,
  isTask,
  recordCompletion as recordBackendCompletion,
  recordMiss as recordBackendMiss,
  isBlocked as isBackendBlocked,
  isBlocking,
  isTaskActive,
  isOverdue as isBackendOverdue,
  isDueToday,
} from "@backend/core/models/Task";

// ── Canonical DTOs (Spec §7) ─────────────────────────────────
export type {
  DashboardSummaryDTO,
  ReminderDTO,
  AISuggestionDTO,
  DependencyNodeDTO,
  TaskTimelineDTO,
  CalendarEventDTO,
  TaskExportDTO,
} from "./DTOs";
