/**
 * Domain Layer — Public API
 *
 * Single entry point for domain imports.
 * Only re-exports from modules that actually exist in the domain layer.
 *
 * NOTE: Most consumers import via deep paths (e.g. @domain/models/Task).
 *       This barrel exists for convenience but is NOT required.
 */

// ===================================================================
// ===== NEW Immutable Domain Layer (Session 23) =====================
// ===================================================================

// ── DomainTask (canonical immutable entity) ──
export type {
  DomainTask,
  TaskId,
  ISODateString,
  TaskPriority as DomainTaskPriority,
  TaskStatus as DomainTaskStatus,
  CompletionAction as DomainCompletionAction,
  OnCompletionAction as DomainOnCompletionAction,
  SmartRecurrenceConfig,
  EscalationLevel,
  EscalationPolicy,
} from "./DomainTask";

export {
  isDomainTask,
  isTerminal,
  isRecurring as isDomainRecurring,
  isOverdue as isDomainOverdue,
  isDependencyBlocked,
} from "./DomainTask";

// ── TaskLifecycleState (pure state machine) ──
export type {
  TaskLifecycleStateValue,
  TransitionAction,
} from "./TaskLifecycleState";

export {
  VALID_TRANSITIONS,
  ACTION_TARGET_MAP,
  TERMINAL_STATES,
  ACTIVE_STATES,
  ANALYTICS_TRIGGER_STATES,
  ANALYTICS_EXCLUDED_STATES,
  canTransition,
  canApplyAction,
  applyTransition,
  deriveStatus,
  deriveLifecycleState,
  getAvailableActions,
} from "./TaskLifecycleState";

// ── RecurrenceInstance (immutable recurring child) ──
export type { RecurrenceInstance } from "./RecurrenceInstance";
export {
  createRecurrenceInstance,
  isRecurringTemplate,
  isRecurrenceChild,
  isRecurrenceInstance,
} from "./RecurrenceInstance";

// ── DependencyLink (immutable graph edge) ──
export type { DependencyLink, DependencyType } from "./DependencyLink";
export {
  createDependencyLink,
  createInstanceDependencyLink,
  markSatisfied,
  getBlockingLinks,
  getDependentLinks,
  wouldCreateCycle,
  isDependencyLink,
} from "./DependencyLink";

// ── TaskAnalytics (immutable snapshot) ──
export type {
  TaskAnalyticsSnapshot,
  CompletionHistoryEntry as DomainCompletionHistoryEntry,
  CompletionContextDetail,
  CompletionContextEntry,
  LearningMetrics,
} from "./TaskAnalytics";

export {
  createEmptyAnalytics,
  recordCompletion,
  recordMiss,
  withLearningMetrics,
  calculateHealthScore,
} from "./TaskAnalytics";

// ── TaskCompletionContext ──
export type {
  TaskCompletionContext,
  CompletionTrigger,
} from "./TaskCompletionContext";

export { createCompletionContext } from "./TaskCompletionContext";

// ── DomainVersion ──
export type { DomainVersion } from "./DomainVersion";
export {
  CURRENT_DOMAIN_VERSION,
  MIN_SUPPORTED_VERSION,
  needsMigration,
  isVersionSupported,
  isCurrentVersion,
  VERSION_CHANGELOG,
} from "./DomainVersion";

// ── TaskFactory (the ONLY way to construct DomainTask) ──
export type { CreateTaskInput } from "./TaskFactory";
export {
  create as createDomainTask,
  fromBlockAttrs,
  fromStorage,
  fromLegacy,
  fromRecurrenceInstance,
  applyTransition as applyTaskTransition,
  withAnalytics,
  withDependencyLinks,
  patch as patchDomainTask,
  duplicate as duplicateDomainTask,
} from "./TaskFactory";

// ── DomainMapper (persistence serialization) ──
export type { PersistedTask, TaskDTO } from "./DomainMapper";
export {
  toPersistence,
  fromPersistence,
  toPersistenceBatch,
  fromPersistenceBatch,
  toDTO,
} from "./DomainMapper";

// ===================================================================
// ===== Legacy Models (backward compatibility) ======================
// ===================================================================

// ── models/Task (V2.1 — partially mutable, to be phased out) ──
export type {
  Task,
  TaskStatus,
  TaskPriority,
  CompletionAction,
  OnCompletionAction,
  CompletionHistoryEntry,
  SmartRecurrence,
} from "./models/Task";

export {
  PRIORITY_WEIGHTS,
  createTask,
  normalizePriority,
  isTaskCompleted,
  isTaskOverdue,
  isRecurring,
  isBlocked,
} from "./models/Task";

export type { Status, StatusType } from "./models/TaskStatus";
export { DEFAULT_STATUSES, StatusRegistry } from "./models/TaskStatus";

export type { Recurrence, RecurrenceResult, RecurrenceValidation } from "./models/Recurrence";
export { createRecurrence, validateRRule, isRecurrence, cloneRecurrence, mergeRecurrence } from "./models/Recurrence";

export type { Frequency } from "./models/Frequency";
export { isValidFrequency, frequencyToRRule } from "./models/Frequency";

// ===== Index =====
export { TaskIndex } from "./index/TaskIndex";
export type { IndexStructure } from "./index/TaskIndex";

// ===== Dependencies =====
export type { IDependencyChecker } from "./dependencies/IDependencyChecker";
export { NullDependencyChecker } from "./dependencies/IDependencyChecker";

// ===== Recurrence (RuleParser) =====
export {
  parseRecurrenceRule,
  parseRecurrenceRuleStrict,
  serializeRecurrenceRule,
  validateRecurrenceRule,
  validateRecurrenceRuleStrict,
  getRecurrenceExamples,
} from "./recurrence/RuleParser";

// ===== Date Utilities =====
export {
  parseNaturalDate,
  toISODate,
  toISODateTime,
  parseISODate,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  getNextWeekday,
  getNextDayOfMonth,
  isLeapYear,
  getLastDayOfMonth,
  compareDates,
  isBefore,
  isAfter,
  isSameDay,
  daysBetween,
  isPastRelativeTo,
  isFutureRelativeTo,
  isTodayRelativeTo,
  getTimezoneOffset,
  startOfDay,
  endOfDay,
} from "./utils/DateCalculations";

