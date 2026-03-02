import { describe, expect, it } from "vitest";
import { calculateUrgencyScore } from "@backend/core/urgency/UrgencyScoreCalculator";
import { createTask } from "@backend/core/models/Task";

const baseFrequency = { type: "daily", interval: 1, time: "09:00" } as const;

/** Create an unfrozen mutable task for testing (createTask returns freeze). */
function mutableTask(name: string, overrides?: Record<string, unknown>) {
  return { ...createTask(name, baseFrequency), ...overrides };
}

describe("UrgencyScoreCalculator", () => {
  it("ranks high-priority overdue tasks above low-priority due-today tasks", () => {
    const now = new Date("2024-06-01T12:00:00Z");

    const overdueHigh = mutableTask("Overdue High", {
      dueAt: new Date("2024-05-30T09:00:00Z").toISOString(),
      priority: "high",
    });

    const dueTodayLow = mutableTask("Due Today Low", {
      dueAt: new Date("2024-06-01T18:00:00Z").toISOString(),
      priority: "low",
    });

    const overdueScore = calculateUrgencyScore(overdueHigh, { now });
    const dueTodayScore = calculateUrgencyScore(dueTodayLow, { now });

    expect(overdueScore).toBeGreaterThan(dueTodayScore);
  });

  it("ranks due-today tasks above due-next-week tasks", () => {
    const now = new Date("2024-06-01T08:00:00Z");

    const dueToday = mutableTask("Due Today", {
      dueAt: new Date("2024-06-01T21:00:00Z").toISOString(),
    });

    const dueNextWeek = mutableTask("Due Next Week", {
      dueAt: new Date("2024-06-08T09:00:00Z").toISOString(),
    });

    const dueTodayScore = calculateUrgencyScore(dueToday, { now });
    const dueNextWeekScore = calculateUrgencyScore(dueNextWeek, { now });

    expect(dueTodayScore).toBeGreaterThan(dueNextWeekScore);
  });

  it("treats tasks without due dates as lowest urgency", () => {
    const now = new Date("2024-06-01T08:00:00Z");

    const noDueDate = mutableTask("No Due Date", { dueAt: "" });

    const dueLater = mutableTask("Due Later", {
      dueAt: new Date("2024-06-05T09:00:00Z").toISOString(),
    });

    expect(calculateUrgencyScore(noDueDate, { now })).toBeLessThan(
      calculateUrgencyScore(dueLater, { now })
    );
  });

  it("handles missing priority by keeping it below explicit high priority", () => {
    const now = new Date("2024-06-01T08:00:00Z");

    const missingPriority = mutableTask("Missing Priority", {
      priority: undefined,
      dueAt: new Date("2024-06-02T09:00:00Z").toISOString(),
    });

    const highPriority = mutableTask("High Priority", {
      priority: "highest",
      dueAt: missingPriority.dueAt,
    });

    expect(calculateUrgencyScore(highPriority, { now })).toBeGreaterThan(
      calculateUrgencyScore(missingPriority, { now })
    );
  });

  it("treats invalid due dates as lowest urgency", () => {
    const now = new Date("2024-06-01T08:00:00Z");

    const invalidDue = mutableTask("Invalid Due", { dueAt: "not-a-date" });

    const dueToday = mutableTask("Due Today", {
      dueAt: new Date("2024-06-01T15:00:00Z").toISOString(),
    });

    expect(calculateUrgencyScore(invalidDue, { now })).toBeLessThan(
      calculateUrgencyScore(dueToday, { now })
    );
  });

  it("handles large overdue values without reversing ordering", () => {
    const now = new Date("2024-06-01T08:00:00Z");

    const overdueLong = mutableTask("Overdue Long", {
      dueAt: new Date("2023-06-01T08:00:00Z").toISOString(),
    });

    const overdueShort = mutableTask("Overdue Short", {
      dueAt: new Date("2024-05-30T08:00:00Z").toISOString(),
    });

    expect(calculateUrgencyScore(overdueLong, { now })).toBeGreaterThanOrEqual(
      calculateUrgencyScore(overdueShort, { now })
    );
  });

  it("respects timezone boundaries when computing day deltas", () => {
    const now = new Date("2024-05-01T23:30:00Z");

    const dueTomorrow = mutableTask("Due Tomorrow", {
      dueAt: new Date("2024-05-02T00:15:00Z").toISOString(),
    });

    const dueNextWeek = mutableTask("Due Next Week", {
      dueAt: new Date("2024-05-08T09:00:00Z").toISOString(),
    });

    expect(calculateUrgencyScore(dueTomorrow, { now })).toBeGreaterThan(
      calculateUrgencyScore(dueNextWeek, { now })
    );
  });
});
