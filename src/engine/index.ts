/**
 * Engine Layer — Core Scheduling & Recurrence Processing
 *
 * Contains the Scheduler (tick-based execution), recurrence engine,
 * occurrence creator, completion handler, and event queue.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Scheduler orchestrates the tick pipeline
 *   ✔ Recurrence engine is pure — no side effects
 *   ✔ Completion handler delegates to TaskService for mutations
 *   ❌ No direct SiYuan API calls
 *   ❌ No direct cache writes — use service callbacks
 */

// ── Scheduler ────────────────────────────────────────────────
export { Scheduler } from "@backend/core/engine/Scheduler";
export { SchedulerTimer } from "@backend/core/engine/SchedulerTimer";
export type {
  TaskDueContext,
  TaskDueEvent,
  SchedulerEventType,
  SchedulerEventListener,
  DependencyGateResult,
} from "@backend/core/engine/SchedulerEvents";

// ── Engine Controller ────────────────────────────────────────
export { EngineController } from "@backend/core/engine/EngineController";
export type { EngineControllerDeps } from "@backend/core/engine/EngineController";

// ── Notification State ───────────────────────────────────────
export { NotificationState } from "@backend/core/engine/NotificationState";

// ── Occurrence Block Creator ─────────────────────────────────
export { OccurrenceBlockCreator } from "@backend/core/engine/OccurrenceBlockCreator";
export type { OccurrenceResult } from "@backend/core/engine/OccurrenceBlockCreator";

// ── Completion Handler ───────────────────────────────────────
export { OnCompletionHandler } from "@backend/core/engine/OnCompletion";
export type {
  OnCompletionAction,
  OnCompletionResult,
} from "@backend/core/engine/OnCompletion";

// ── Timezone Handler ─────────────────────────────────────────
export { TimezoneHandler } from "@backend/core/engine/TimezoneHandler";

// ── Event Queue ──────────────────────────────────────────────
export { EventQueue } from "@backend/core/engine/EventQueue";
export type {
  QueuedEvent,
  EventQueueStats,
  EventQueueDeps,
} from "@backend/core/engine/EventQueue";

// ── Recurrence Engine ────────────────────────────────────────
export {
  RecurrenceEngine,
  RecurrenceValidator,
  RecurrenceExplainer,
  RRuleCache,
  extractRRuleOptions,
  generateCacheKey,
} from "@backend/core/engine/recurrence";

export type {
  RecurrenceMode,
  MissPolicy,
  ValidationResult,
  RecurrenceExplanation,
  ExplanationStep,
  MissedOccurrencesResult,
  MissedOccurrenceOptions,
  CacheEntry,
  CacheStats,
  IRecurrenceEngine,
} from "@backend/core/engine/recurrence";

export type { CalculateNextOptions } from "@backend/core/engine/recurrence/RecurrenceEngine";

// ── Canonical Implementations (Architecture Spec v3) ─────────
export { RecurrenceResolver } from "./RecurrenceResolver";
export { DependencyExecutionGuard as CanonicalDependencyGuard } from "./DependencyExecutionGuard";
export type { CanExecuteResult, ExecutionGuardDeps as CanonicalExecutionGuardDeps } from "./DependencyExecutionGuard";
export { BlockAttributeValidator as CanonicalBlockValidator } from "./BlockAttributeValidator";
export type { BlockValidationResult } from "./BlockAttributeValidator";
