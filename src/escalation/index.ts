/**
 * Escalation Layer — Urgency Scoring, Escalation Policy & AI Suggestions
 *
 * Combines escalation policy evaluation, urgency score calculation,
 * and AI-powered smart suggestion generation.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Pure functions for scoring and evaluation
 *   ✔ AI suggestions are generated, never auto-applied
 *   ✔ Escalation levels are derived from policy + task state
 *   ❌ No task mutations
 *   ❌ No SiYuan API calls
 */

// ── Escalation Policy ────────────────────────────────────────
export {
  DEFAULT_ESCALATION_POLICY,
  buildEscalationPolicy,
  resolveEscalationLevel,
  describeEscalationLevel,
} from "@backend/core/escalation/EscalationPolicy";

export type {
  EscalationLevel,
  EscalationLevelDefinition,
  EscalationPolicy,
} from "@backend/core/escalation/EscalationPolicy";

// ── Escalation Evaluator ─────────────────────────────────────
export {
  getEscalationAnchorDate,
  evaluateEscalation,
  buildEscalationExplanation,
} from "@backend/core/escalation/EscalationEvaluator";

export type {
  EscalationResult,
  EscalationEvaluationOptions,
} from "@backend/core/escalation/EscalationEvaluator";

// ── Urgency Settings ─────────────────────────────────────────
export {
  DEFAULT_URGENCY_SETTINGS,
} from "@backend/core/urgency/UrgencySettings";

export type {
  UrgencyPriority,
  UrgencySettings,
} from "@backend/core/urgency/UrgencySettings";

// ── Urgency Score Calculator ─────────────────────────────────
export {
  calculateUrgencyScore,
  calculateUrgencyWithBreakdown,
} from "@backend/core/urgency/UrgencyScoreCalculator";

export type {
  UrgencyScoreOptions,
  UrgencyCalculation,
} from "@backend/core/urgency/UrgencyScoreCalculator";

// ── AI — Smart Suggestion Engine ─────────────────────────────
export { SmartSuggestionEngine } from "@backend/core/ai/SmartSuggestionEngine";
export type {
  TaskSuggestion,
  SuggestionType,
  SuggestionAction,
} from "@backend/core/ai/SmartSuggestionEngine";

// ── AI — Orchestrator ────────────────────────────────────────
export { AIOrchestrator } from "@backend/core/ai/AIOrchestrator";
export type { TaskResolver } from "@backend/core/ai/AIOrchestrator";

// ── AI — Suggestion Store ────────────────────────────────────
export { AISuggestionStore } from "@backend/core/ai/store/AISuggestionStore";

// ── AI — Suggestion Types ────────────────────────────────────
export {
  AI_SUGGESTION_STATE_VERSION,
  createEmptyAISuggestionState,
} from "@backend/core/ai/types/SuggestionTypes";

export type {
  AISuggestion,
  AISuggestionState,
} from "@backend/core/ai/types/SuggestionTypes";

// ── Canonical Smart Suggestion Engine (Spec §6) ─────────────
export {
  SmartSuggestionEngine as CanonicalSmartSuggestionEngine,
  type AISuggestion as CanonicalAISuggestion,
  type SmartSuggestionConfig,
} from "./SmartSuggestionEngine";
