/**
 * RecurrenceRuleParser — Backend re-export facade
 *
 * Re-exports domain recurrence parsing functions so the frontend
 * service layer can reference `@backend/core/parsers/RecurrenceRuleParser`
 * instead of importing from `@domain/recurrence/RuleParser` directly.
 *
 * This preserves the rule: "Frontend must never import @domain".
 */
export {
  parseRecurrenceRule,
  serializeRecurrenceRule,
  validateRecurrenceRule,
  getRecurrenceExamples,
} from "@domain/recurrence/RuleParser";
