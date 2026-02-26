/**
 * AI Suggestion Types — shared type definitions for the event-driven AI layer.
 *
 * These types are consumed by:
 *   - SmartSuggestionEngine (produces suggestions)
 *   - AIOrchestrator (routes events → engine → store → frontend)
 *   - AISuggestionStore (persists suggestions)
 *   - AISuggestionsPanel.svelte (displays suggestions)
 *   - PluginEventMap (ai:suggestion event payload)
 */

// ─── Suggestion Types ─────────────────────────────────────────

/** All possible AI suggestion categories */
export type SuggestionType =
  | 'reschedule'
  | 'urgency'
  | 'consolidate'
  | 'delegate'
  | 'frequency'
  | 'abandon';

/** The action that a suggestion recommends applying */
export interface SuggestionAction {
  type: string;
  parameters: Record<string, unknown>;
}

/** Single AI-generated suggestion linked to a task */
export interface AISuggestion {
  /** Unique ID: `{taskId}-{type}-{timestamp}` */
  id: string;
  /** The task this suggestion targets */
  taskId: string;
  /** Category of the suggestion */
  type: SuggestionType;
  /** Confidence score 0–1 */
  confidence: number;
  /** Human-readable explanation */
  reason: string;
  /** Recommended action */
  action: SuggestionAction;
  /** ISO timestamp of creation */
  createdAt: string;
  /** Whether the user dismissed this suggestion */
  dismissed: boolean;
  /** Whether the user applied this suggestion */
  applied: boolean;
  /** Which event triggered this suggestion (e.g. 'task:complete') */
  triggeredBy?: string;
}

// ─── Persisted State ──────────────────────────────────────────

/** Schema for the persisted AI suggestion store */
export interface AISuggestionState {
  /** Schema version for forward-compatible reads */
  version: number;
  /** Map of taskId → suggestions for that task */
  suggestions: Record<string, AISuggestion[]>;
  /** ISO timestamp of last update */
  lastUpdatedAt: string;
}

/** Current schema version */
export const AI_SUGGESTION_STATE_VERSION = 1;

/** Empty initial state */
export function createEmptyAISuggestionState(): AISuggestionState {
  return {
    version: AI_SUGGESTION_STATE_VERSION,
    suggestions: {},
    lastUpdatedAt: new Date().toISOString(),
  };
}
