/**
 * RuleParser — Domain-level recurrence rule parsing & serialization
 *
 * Converts between natural language recurrence strings and Frequency objects.
 * No backend dependencies — operates purely on the domain Frequency type.
 */
import type { Frequency } from "../models/Frequency";

/** Parse a natural language recurrence string into a Frequency, or null if invalid. */
export function parseRecurrenceRule(input: string): Frequency | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return null;

  // Must start with "every"
  const everyMatch = normalized.match(/^every\s+(.+)$/);
  if (!everyMatch?.[1]) return null;

  const rest = everyMatch[1];

  // "every day" / "every N days"
  const dailyMatch = rest.match(/^(\d+\s+)?days?$/);
  if (dailyMatch) {
    return {
      type: "daily",
      interval: dailyMatch[1] ? parseInt(dailyMatch[1]) : 1,
    };
  }

  // "every week" / "every N weeks [on <days>]"
  const weeklyMatch = rest.match(/^(\d+\s+)?weeks?(?:\s+on\s+(.+))?$/);
  if (weeklyMatch) {
    const interval = weeklyMatch[1] ? parseInt(weeklyMatch[1]) : 1;
    const daysOfWeek = weeklyMatch[2] ? parseDayNames(weeklyMatch[2]) : undefined;
    return { type: "weekly", interval, daysOfWeek };
  }

  // "every month" / "every N months [on the Nth]"
  const monthlyMatch = rest.match(
    /^(\d+\s+)?months?(?:\s+on\s+the\s+(\d+)(?:st|nd|rd|th)?)?$/,
  );
  if (monthlyMatch) {
    const interval = monthlyMatch[1] ? parseInt(monthlyMatch[1]) : 1;
    const dayOfMonth = monthlyMatch[2] ? parseInt(monthlyMatch[2]) : undefined;
    return { type: "monthly", interval, dayOfMonth };
  }

  // "every year" / "every N years"
  const yearlyMatch = rest.match(/^(\d+\s+)?years?$/);
  if (yearlyMatch) {
    return {
      type: "yearly",
      interval: yearlyMatch[1] ? parseInt(yearlyMatch[1]) : 1,
    };
  }

  // "every weekday"
  if (rest === "weekday" || rest === "weekdays") {
    return { type: "weekly", interval: 1, daysOfWeek: [1, 2, 3, 4, 5] };
  }

  // "every weekend"
  if (rest === "weekend" || rest === "weekends") {
    return { type: "weekly", interval: 1, daysOfWeek: [0, 6] };
  }

  return null;
}

/**
 * Parse a recurrence rule with strict validation — returns a result object.
 */
export function parseRecurrenceRuleStrict(
  input: string,
): { valid: boolean; frequency: Frequency | null; error?: string } {
  const frequency = parseRecurrenceRule(input);
  if (!frequency) {
    return { valid: false, frequency: null, error: "Unrecognized recurrence pattern" };
  }
  return { valid: true, frequency };
}

/** Convert a Frequency object to a human-readable recurrence string. */
export function serializeRecurrenceRule(frequency: Frequency): string {
  const { type, interval } = frequency;

  switch (type) {
    case "daily":
      return interval === 1 ? "every day" : `every ${interval} days`;

    case "weekly": {
      const base = interval === 1 ? "every week" : `every ${interval} weeks`;
      if (frequency.daysOfWeek && frequency.daysOfWeek.length > 0) {
        const names = frequency.daysOfWeek.map(dayName).join(", ");
        return `${base} on ${names}`;
      }
      return base;
    }

    case "monthly": {
      const base = interval === 1 ? "every month" : `every ${interval} months`;
      if (frequency.dayOfMonth !== undefined) {
        return `${base} on the ${ordinal(frequency.dayOfMonth)}`;
      }
      return base;
    }

    case "yearly":
      return interval === 1 ? "every year" : `every ${interval} years`;

    default:
      return "every day";
  }
}

/**
 * Validate a recurrence rule string.
 * Returns true if the string can be parsed into a valid Frequency.
 */
export function validateRecurrenceRule(input: string): boolean {
  return parseRecurrenceRule(input) !== null;
}

/**
 * Strict validation with detailed result.
 */
export function validateRecurrenceRuleStrict(
  input: string,
): { valid: boolean; error?: string } {
  const result = parseRecurrenceRuleStrict(input);
  return { valid: result.valid, error: result.error };
}

/**
 * Get a list of common recurrence examples for UI hints.
 */
export function getRecurrenceExamples(): Array<{ label: string; value: string }> {
  return [
    { label: "Every day", value: "every day" },
    { label: "Every 2 days", value: "every 2 days" },
    { label: "Every week", value: "every week" },
    { label: "Every 2 weeks", value: "every 2 weeks" },
    { label: "Every month", value: "every month" },
    { label: "Every year", value: "every year" },
    { label: "Every weekday", value: "every weekday" },
    { label: "Every week on Monday, Wednesday", value: "every week on Monday, Wednesday" },
  ];
}

// ── helpers ─────────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function parseDayNames(input: string): number[] {
  return input
    .split(",")
    .map((s) => DAY_MAP[s.trim().toLowerCase()])
    .filter((n): n is number => n !== undefined);
}

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

function dayName(dow: number): string {
  return DAY_NAMES[dow] ?? "Sunday";
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
