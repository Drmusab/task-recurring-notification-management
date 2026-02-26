/**
 * Reminder Pipeline barrel — Runtime-Validated Reminder Subsystem
 *
 * Exports all reminder pipeline modules that form the backend reminder
 * layer ON TOP of Session 19's runtime validation (BlockAttributeValidator,
 * RecurrenceResolver, DependencyExecutionGuard).
 *
 * Pipeline:
 *   DueEventEmitter → ReminderPolicy → ReminderQueue → ReminderDispatcher
 *   ReminderRetryManager (cross-cutting)
 *   ReminderService (orchestrator)
 *
 * Session 20.
 */

// ─── Orchestrator ─────────────────────────────────────────────
export { ReminderService } from "./ReminderService";
export type { ReminderServiceDeps, ReminderServiceStats } from "./ReminderService";

// ─── Policy ───────────────────────────────────────────────────
export { ReminderPolicy } from "./ReminderPolicy";
export type {
  ReminderPolicyDeps,
  ReminderPolicyStats,
  PolicyEvaluationResult,
  PolicyRejectionReason,
} from "./ReminderPolicy";

// ─── Queue ────────────────────────────────────────────────────
export { ReminderQueue } from "./ReminderQueue";
export type {
  ReminderQueueEntry,
  ReminderQueueStats,
} from "./ReminderQueue";

// ─── Dispatcher ───────────────────────────────────────────────
export { ReminderDispatcher } from "./ReminderDispatcher";
export type {
  ReminderDispatcherDeps,
  ReminderDispatcherStats,
  DispatchResult,
} from "./ReminderDispatcher";

// ─── Retry Manager ───────────────────────────────────────────
export { ReminderRetryManager } from "./ReminderRetryManager";
export type {
  ReminderRetryManagerDeps,
  ReminderRetryManagerStats,
} from "./ReminderRetryManager";

// ─── Due Event Emitter ───────────────────────────────────────
export { DueEventEmitter } from "./DueEventEmitter";
export type {
  DueEventEmitterDeps,
  DueEventEmitterStats,
} from "./DueEventEmitter";
