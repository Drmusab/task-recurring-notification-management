/**
 * Parsers Layer — Date, Recurrence & Task Serialization
 *
 * Pure parser functions for dates, recurrence rules, and task
 * line serialization. No side effects.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Pure functions — no side effects
 *   ✔ Used by services/ and engine/ for parsing input
 *   ❌ No SiYuan API calls
 *   ❌ No mutations
 */

// ── Date Parser ──────────────────────────────────────────────
export { DateParser } from "@backend/core/parsers/DateParser";
export type {
  ParsedDate,
  DateSuggestion,
} from "@backend/core/parsers/DateParser";

// ── Task Line Serializer ─────────────────────────────────────
export { TaskLineSerializer } from "@backend/core/parsers/TaskLineSerializer";
export type { SerializeOptions } from "@backend/core/parsers/TaskLineSerializer";

// ── Recurrence Rule Parser (delegating to domain) ────────────
export {
  parseRecurrenceRule,
  serializeRecurrenceRule,
  validateRecurrenceRule,
  getRecurrenceExamples,
} from "@backend/core/parsers/RecurrenceRuleParser";

// ── Domain Recurrence Rule Parser (strict variants) ──────────
export {
  parseRecurrenceRuleStrict,
  validateRecurrenceRuleStrict,
} from "@domain/recurrence/RuleParser";

// ── Canonical Parsers (Spec §10) ─────────────────────────────
export {
  parseMarkdownTask,
  extractTaskAttributes,
  resolveDate,
  type ParsedMarkdownTask,
  type ExtractedAttributes,
  type DateResolution,
} from "./Parsers";
