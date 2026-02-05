/**
 * Inline Task Parser
 * 
 * Parses markdown task lines into structured task data and vice versa.
 * Supports rich metadata inline with natural markdown syntax.
 * 
 * @module InlineTaskParser
 */

import { parseNaturalLanguageDate } from '@shared/utils/misc/DateParser';
import { parseRecurrenceRule, rruleToText } from '@shared/utils/misc/RecurrenceParser';

/**
 * Task status enum
 */
export type TaskStatus = 'todo' | 'done' | 'cancelled';

/**
 * Task priority levels
 */
export type TaskPriority = 'high' | 'medium' | 'low';

/**
 * Structured task data extracted from inline markdown
 */
export interface ParsedTask {
  /** Task description (plain text without metadata) */
  description: string;
  
  /** Task status */
  status: TaskStatus;
  
  /** Due date in ISO format (YYYY-MM-DD) */
  dueDate?: string;
  
  /** Scheduled/start work date in ISO format */
  scheduledDate?: string;
  
  /** Task start date in ISO format */
  startDate?: string;
  
  /** Recurrence configuration */
  recurrence?: {
    rule: string; // RRULE string
    mode: 'scheduled' | 'done';
  };
  
  /** Priority level */
  priority?: TaskPriority;
  
  /** Unique task identifier */
  id?: string;
  
  /** Task IDs this task depends on */
  dependsOn?: string[];
  
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Parse error with details
 */
export interface ParseError {
  error: true;
  message: string;
  position?: number; // Character offset where error occurred
  token?: string; // The problematic token
}

/**
 * Result of parsing operation
 */
export type ParseResult = ParsedTask | ParseError;

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Regex patterns for parsing
const STATUS_REGEX = /^-\s*\[\s*([ x\-])\s*\]/i;
const DUE_DATE_REGEX = /📅\s+([^🔁🔼🔺🔽🆔⛔⏳🛫#]+?)(?=\s*(?:🔁|🔼|🔺|🔽|🆔|⛔|⏳|🛫|#|$))/;
const SCHEDULED_DATE_REGEX = /⏳\s+([^🔁🔼🔺🔽🆔⛔📅🛫#]+?)(?=\s*(?:🔁|🔼|🔺|🔽|🆔|⛔|📅|🛫|#|$))/;
const START_DATE_REGEX = /🛫\s+([^🔁🔼🔺🔽🆔⛔📅⏳#]+?)(?=\s*(?:🔁|🔼|🔺|🔽|🆔|⛔|📅|⏳|#|$))/;
const RECURRENCE_REGEX = /🔁\s+(.+?)(?=\s*(?:🔼|🔺|🔽|🆔|⛔|#|$))/;
const PRIORITY_HIGH_REGEX = /🔺/;
const PRIORITY_MED_REGEX = /🔼/;
const PRIORITY_LOW_REGEX = /🔽/;
const ID_REGEX = /🆔\s+([a-zA-Z0-9\-_]+)/;
const DEPENDS_ON_REGEX = /⛔\s+([a-zA-Z0-9\-_,\s]+)/;
const TAG_REGEX = /#([a-zA-Z0-9\-_]+)/g;

/**
 * Parse a single line of markdown text into structured task data
 * 
 * @param text - Raw markdown line (e.g., "- [ ] Buy milk 📅 tomorrow #home")
 * @returns ParsedTask on success, ParseError on failure
 * 
 * @example
 * parseInlineTask("- [ ] Review PR 📅 2026-01-25 🔼 #dev")
 * // Returns: { description: "Review PR", dueDate: "2026-01-25", priority: "medium", tags: ["dev"], status: "todo" }
 */
export function parseInlineTask(text: string): ParseResult {
  if (!text || typeof text !== 'string') {
    return {
      error: true,
      message: 'Invalid input: text must be a non-empty string'
    };
  }

  const trimmed = text.trim();
  
  // Step 1: Extract checkbox status
  const statusMatch = trimmed.match(STATUS_REGEX);
  if (!statusMatch) {
    return {
      error: true,
      message: 'Not a checklist item: must start with "- [ ]", "- [x]", or "- [-]"',
      position: 0
    };
  }

  const statusSymbol = statusMatch[1].toLowerCase();
  const status: TaskStatus = 
    statusSymbol === 'x' ? 'done' :
    statusSymbol === '-' ? 'cancelled' :
    'todo';

  // Step 2: Remove checkbox from text
  let remaining = trimmed.substring(statusMatch[0].length).trim();

  // Step 3: Extract metadata tokens
  const task: ParsedTask = {
    description: '',
    status
  };

  // Extract due date
  const dueDateMatch = remaining.match(DUE_DATE_REGEX);
  if (dueDateMatch) {
    const dateStr = dueDateMatch[1].trim();
    const dateResult = parseNaturalLanguageDate(dateStr);
    if (dateResult.error) {
      return {
        error: true,
        message: `Invalid due date: ${dateResult.message}`,
        token: dateStr
      };
    }
    task.dueDate = dateResult.date;
    remaining = remaining.replace(dueDateMatch[0], '');
  }

  // Extract scheduled date
  const scheduledMatch = remaining.match(SCHEDULED_DATE_REGEX);
  if (scheduledMatch) {
    const dateStr = scheduledMatch[1].trim();
    const dateResult = parseNaturalLanguageDate(dateStr);
    if (dateResult.error) {
      return {
        error: true,
        message: `Invalid scheduled date: ${dateResult.message}`,
        token: dateStr
      };
    }
    task.scheduledDate = dateResult.date;
    remaining = remaining.replace(scheduledMatch[0], '');
  }

  // Extract start date
  const startMatch = remaining.match(START_DATE_REGEX);
  if (startMatch) {
    const dateStr = startMatch[1].trim();
    const dateResult = parseNaturalLanguageDate(dateStr);
    if (dateResult.error) {
      return {
        error: true,
        message: `Invalid start date: ${dateResult.message}`,
        token: dateStr
      };
    }
    task.startDate = dateResult.date;
    remaining = remaining.replace(startMatch[0], '');
  }

  // Extract recurrence
  const recurrenceMatch = remaining.match(RECURRENCE_REGEX);
  if (recurrenceMatch) {
    const recurrenceText = recurrenceMatch[1].trim();
    const recurrenceResult = parseRecurrenceRule(recurrenceText);
    if (recurrenceResult.error) {
      return {
        error: true,
        message: `Invalid recurrence: ${recurrenceResult.message}`,
        token: recurrenceText
      };
    }
    task.recurrence = {
      rule: recurrenceResult.rule!,
      mode: recurrenceResult.mode!
    };
    remaining = remaining.replace(recurrenceMatch[0], '');
  }

  // Extract priority (check all, last one wins)
  if (PRIORITY_HIGH_REGEX.test(remaining)) {
    task.priority = 'high';
    remaining = remaining.replace(PRIORITY_HIGH_REGEX, '');
  }
  if (PRIORITY_MED_REGEX.test(remaining)) {
    task.priority = 'medium';
    remaining = remaining.replace(PRIORITY_MED_REGEX, '');
  }
  if (PRIORITY_LOW_REGEX.test(remaining)) {
    task.priority = 'low';
    remaining = remaining.replace(PRIORITY_LOW_REGEX, '');
  }

  // Extract ID
  const idMatch = remaining.match(ID_REGEX);
  if (idMatch) {
    task.id = idMatch[1];
    remaining = remaining.replace(idMatch[0], '');
  }

  // Extract dependencies
  const depsMatch = remaining.match(DEPENDS_ON_REGEX);
  if (depsMatch) {
    const depsList = depsMatch[1].split(',').map(d => d.trim()).filter(d => d.length > 0);
    if (depsList.length > 0) {
      task.dependsOn = depsList;
    }
    remaining = remaining.replace(depsMatch[0], '');
  }

  // Extract tags
  const tags: string[] = [];
  const tagMatches = remaining.matchAll(TAG_REGEX);
  for (const match of tagMatches) {
    tags.push(match[1]);
  }
  if (tags.length > 0) {
    task.tags = tags;
    remaining = remaining.replace(TAG_REGEX, '');
  }

  // Step 4: What remains is the description
  task.description = remaining.trim();

  return task;
}

/**
 * Convert a ParsedTask object back to canonical inline markdown format
 * 
 * @param task - Structured task data
 * @returns Normalized markdown string
 * 
 * @example
 * normalizeTask({ description: "Task", dueDate: "2026-01-25", priority: "high", status: "todo" })
 * // Returns: "- [ ] Task 📅 2026-01-25 🔺"
 */
export function normalizeTask(task: ParsedTask): string {
  const parts: string[] = [];

  // Status checkbox
  const statusSymbol = 
    task.status === 'done' ? 'x' :
    task.status === 'cancelled' ? '-' :
    ' ';
  parts.push(`- [${statusSymbol}]`);

  // Description
  parts.push(task.description);

  // Due date
  if (task.dueDate) {
    parts.push(`📅 ${task.dueDate}`);
  }

  // Scheduled date
  if (task.scheduledDate) {
    parts.push(`⏳ ${task.scheduledDate}`);
  }

  // Start date
  if (task.startDate) {
    parts.push(`🛫 ${task.startDate}`);
  }

  // Recurrence
  if (task.recurrence) {
    // Convert RRULE back to human-readable text for lossless round-trip
    const humanText = rruleToText(task.recurrence.rule);
    const modeText = task.recurrence.mode === 'done' ? ' when done' : '';
    parts.push(`🔁 ${humanText}${modeText}`);
  }

  // Priority
  if (task.priority === 'high') {
    parts.push('🔺');
  } else if (task.priority === 'medium') {
    parts.push('🔼');
  } else if (task.priority === 'low') {
    parts.push('🔽');
  }

  // ID
  if (task.id) {
    parts.push(`🆔 ${task.id}`);
  }

  // Dependencies
  if (task.dependsOn && task.dependsOn.length > 0) {
    parts.push(`⛔ ${task.dependsOn.join(',')}`);
  }

  // Tags
  if (task.tags && task.tags.length > 0) {
    parts.push(...task.tags.map(tag => `#${tag}`));
  }

  return parts.join(' ');
}

/**
 * Validate syntax without full parsing (lightweight pre-check)
 * 
 * @param text - Raw markdown line
 * @returns Validation result with specific error messages
 */
export function validateSyntax(text: string): ValidationResult {
  const errors: string[] = [];

  if (!text || typeof text !== 'string') {
    errors.push('Invalid input: text must be a non-empty string');
    return { valid: false, errors };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    errors.push('Empty input');
    return { valid: false, errors };
  }

  // Check for checklist format
  const statusMatch = trimmed.match(STATUS_REGEX);
  if (!statusMatch) {
    errors.push('Not a checklist item');
    return { valid: false, errors };
  }

  // Check for invalid status symbols
  const statusSymbol = statusMatch[1];
  if (!/^[ x\-]$/i.test(statusSymbol)) {
    errors.push(`Invalid status symbol: "${statusSymbol}". Must be space, 'x', or '-'`);
  }

  // Basic checks for date tokens (just presence, not validity)
  const remaining = trimmed.substring(statusMatch[0].length);
  
  // Check for duplicate emojis (basic heuristic)
  const dueDateCount = (remaining.match(/📅/g) || []).length;
  if (dueDateCount > 1) {
    errors.push('Multiple due date tokens found');
  }

  const scheduledCount = (remaining.match(/⏳/g) || []).length;
  if (scheduledCount > 1) {
    errors.push('Multiple scheduled date tokens found');
  }

  const startCount = (remaining.match(/🛫/g) || []).length;
  if (startCount > 1) {
    errors.push('Multiple start date tokens found');
  }

  const recurrenceCount = (remaining.match(/🔁/g) || []).length;
  if (recurrenceCount > 1) {
    errors.push('Multiple recurrence tokens found');
  }

  const idCount = (remaining.match(/🆔/g) || []).length;
  if (idCount > 1) {
    errors.push('Multiple ID tokens found');
  }

  const depsCount = (remaining.match(/⛔/g) || []).length;
  if (depsCount > 1) {
    errors.push('Multiple dependency tokens found');
  }

  return { valid: errors.length === 0, errors };
}
