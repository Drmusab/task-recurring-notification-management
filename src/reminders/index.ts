/**
 * Reminders Layer — Due-Event Emission & Reminder Delivery
 *
 * Manages the full reminder lifecycle: policy evaluation, queueing,
 * dispatching (via infrastructure/ notifications), and retry logic.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ ReminderPolicy decides IF a reminder fires
 *   ✔ ReminderQueue manages pending reminders
 *   ✔ ReminderDispatcher sends via infrastructure/
 *   ✔ DueEventEmitter bridges engine → reminders
 *   ❌ No direct SiYuan API calls
 *   ❌ No task mutations — delegates to services/
 */

export {
  // ── Reminder Service ───────────────────────────────────────
  ReminderService,
  type ReminderServiceDeps,
  type ReminderServiceStats,

  // ── Reminder Policy ────────────────────────────────────────
  ReminderPolicy,
  type ReminderPolicyDeps,
  type PolicyRejectionReason,
  type PolicyEvaluationResult,
  type ReminderPolicyStats,

  // ── Reminder Queue ─────────────────────────────────────────
  ReminderQueue,
  type ReminderQueueEntry,
  type ReminderQueueStats,

  // ── Reminder Dispatcher ────────────────────────────────────
  ReminderDispatcher,
  type ReminderDispatcherDeps,
  type DispatchResult,
  type ReminderDispatcherStats,

  // ── Reminder Retry Manager ─────────────────────────────────
  ReminderRetryManager,
  type ReminderRetryManagerDeps,
  type ReminderRetryManagerStats,

  // ── Due Event Emitter ──────────────────────────────────────
  DueEventEmitter,
  type DueEventEmitterDeps,
  type DueEventEmitterStats,
} from "@backend/reminders";

// ── Canonical ReminderService (Architecture Spec v3 §5.1) ───
export { ReminderService as CanonicalReminderService } from "./ReminderService";
export type { ReminderConfig } from "./ReminderService";
