/**
 * Parsers — Markdown, Attribute, and Date Parsing Utilities (§10)
 *
 * Pure functions for extracting task metadata from SiYuan blocks.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Pure functions (no side effects)
 *   ✔ Returns parsed results (never mutates)
 *   ❌ No SiYuan API calls
 *   ❌ No event emission
 *   ❌ No frontend imports
 */

// ──────────────────────────────────────────────────────────────
// Markdown Parser
// ──────────────────────────────────────────────────────────────

export interface ParsedTaskContent {
  readonly name: string;
  readonly statusSymbol?: string;
  readonly tags: string[];
  readonly priority?: string;
  readonly dueText?: string;
  readonly recurrenceText?: string;
  readonly raw: string;
}

/**
 * Parse a markdown line (task list item) into structured task content.
 *
 * Supports SiYuan task list format:
 *   `* [x] Task name #tag1 #tag2 @due(2024-01-01) @every(daily)`
 */
export function parseMarkdownTask(line: string): ParsedTaskContent | null {
  // Match task list items: `- [ ] text` or `* [x] text`
  const match = line.match(/^[\s]*[-*]\s*\[([ xX!/.])\]\s*(.+)$/);
  if (!match) return null;

  const statusSymbol = match[1];
  let remaining = match[2]!.trim();

  // Extract tags (#tag)
  const tags: string[] = [];
  remaining = remaining.replace(/#(\S+)/g, (_, tag) => {
    tags.push(tag);
    return "";
  });

  // Extract due date (@due(...) or 📅YYYY-MM-DD)
  let dueText: string | undefined;
  remaining = remaining.replace(/@due\(([^)]+)\)/i, (_, date) => {
    dueText = date;
    return "";
  });
  remaining = remaining.replace(/📅\s*(\d{4}-\d{2}-\d{2})/g, (_, date) => {
    dueText = date;
    return "";
  });

  // Extract recurrence (@every(...) or 🔁...)
  let recurrenceText: string | undefined;
  remaining = remaining.replace(/@every\(([^)]+)\)/i, (_, rule) => {
    recurrenceText = rule;
    return "";
  });
  remaining = remaining.replace(/🔁\s*([^\s]+(?:\s+[^\s#@📅]+)*)/g, (_, rule) => {
    recurrenceText = rule.trim();
    return "";
  });

  // Extract priority (!high, !low, etc. or ⏫⏬🔼🔽)
  let priority: string | undefined;
  remaining = remaining.replace(/!(highest|high|medium|low|lowest)/i, (_, p) => {
    priority = p.toLowerCase();
    return "";
  });
  // Emoji priorities
  const priorityEmojis: Record<string, string> = {
    "⏫": "highest",
    "🔼": "high",
    "🔽": "low",
    "⏬": "lowest",
  };
  for (const [emoji, p] of Object.entries(priorityEmojis)) {
    if (remaining.includes(emoji)) {
      priority = p;
      remaining = remaining.replace(emoji, "");
    }
  }

  const name = remaining.trim();
  if (!name) return null;

  return {
    name,
    statusSymbol: statusSymbol === " " ? undefined : statusSymbol,
    tags,
    priority,
    dueText,
    recurrenceText,
    raw: line,
  };
}

// ──────────────────────────────────────────────────────────────
// Attribute Extractor
// ──────────────────────────────────────────────────────────────

export interface ExtractedTaskAttributes {
  readonly taskId?: string;
  readonly status?: string;
  readonly dueAt?: string;
  readonly priority?: string;
  readonly recurrence?: string;
  readonly dependsOn?: string[];
  readonly tags?: string[];
  readonly category?: string;
}

/**
 * Extract task attributes from SiYuan block custom attributes.
 *
 * Maps custom-task-* attributes to structured data.
 */
export function extractTaskAttributes(
  attrs: Record<string, string>,
): ExtractedTaskAttributes {
  const result: Record<string, unknown> = {};

  if (attrs["custom-task-id"]) result.taskId = attrs["custom-task-id"];
  if (attrs["custom-task-status"]) result.status = attrs["custom-task-status"];
  if (attrs["custom-task-due"]) result.dueAt = attrs["custom-task-due"];
  if (attrs["custom-task-priority"]) result.priority = attrs["custom-task-priority"];
  if (attrs["custom-task-recurrence"]) result.recurrence = attrs["custom-task-recurrence"];
  if (attrs["custom-task-category"]) result.category = attrs["custom-task-category"];

  // Parse depends-on (comma-separated IDs)
  if (attrs["custom-task-depends-on"]) {
    result.dependsOn = attrs["custom-task-depends-on"]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Parse tags (comma-separated)
  if (attrs["custom-task-tags"]) {
    result.tags = attrs["custom-task-tags"]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return result as ExtractedTaskAttributes;
}

// ──────────────────────────────────────────────────────────────
// Date Resolver
// ──────────────────────────────────────────────────────────────

/**
 * Resolve a human-readable date string to an ISO date.
 *
 * Handles:
 *   - ISO dates: "2024-01-15"
 *   - Relative: "tomorrow", "next monday", "in 3 days"
 *   - Semantic: "end of week", "next month"
 *
 * Falls back to returning the input if parsing fails.
 */
export function resolveDate(
  input: string,
  referenceDate: Date = new Date(),
): string {
  const trimmed = input.trim().toLowerCase();

  // ISO date format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed;
  }

  // Relative dates
  const ref = new Date(referenceDate);
  switch (trimmed) {
    case "today":
      return formatDate(ref);
    case "tomorrow": {
      ref.setDate(ref.getDate() + 1);
      return formatDate(ref);
    }
    case "yesterday": {
      ref.setDate(ref.getDate() - 1);
      return formatDate(ref);
    }
    case "next week": {
      ref.setDate(ref.getDate() + 7);
      return formatDate(ref);
    }
    case "next month": {
      ref.setMonth(ref.getMonth() + 1);
      return formatDate(ref);
    }
    case "end of week": {
      const dayOfWeek = ref.getDay();
      const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      ref.setDate(ref.getDate() + daysToSunday);
      return formatDate(ref);
    }
  }

  // "in N days" pattern
  const inDaysMatch = trimmed.match(/^in\s+(\d+)\s+days?$/);
  if (inDaysMatch) {
    ref.setDate(ref.getDate() + parseInt(inDaysMatch[1]!, 10));
    return formatDate(ref);
  }

  // "in N hours" pattern
  const inHoursMatch = trimmed.match(/^in\s+(\d+)\s+hours?$/);
  if (inHoursMatch) {
    ref.setHours(ref.getHours() + parseInt(inHoursMatch[1]!, 10));
    return ref.toISOString();
  }

  // Day names: "next monday", "next tuesday", etc.
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const nextDayMatch = trimmed.match(
    /^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/,
  );
  if (nextDayMatch) {
    const targetDay = dayNames.indexOf(nextDayMatch[1]!);
    const currentDay = ref.getDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    ref.setDate(ref.getDate() + daysAhead);
    return formatDate(ref);
  }

  // Fallback: return input unchanged
  return input;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}
