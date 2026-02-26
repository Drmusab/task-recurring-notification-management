import type { Plugin } from "siyuan";
import * as logger from "@backend/logging/logger";

const PATTERN_LEARNER_STORAGE_KEY = "pattern_learner_history";

// ──────────────────────────────────────────────────────────────
// ML Trigger Validation
// ──────────────────────────────────────────────────────────────

/**
 * Events that are ALLOWED to trigger ML pattern analysis.
 *
 * ALLOWED:
 *   - task:runtime:completed  (user finished the task — valid data point)
 *   - task:runtime:missed     (user missed the deadline — valid data point)
 *   - task:runtime:recurrence (new recurrence instance — valid data point)
 *
 * FORBIDDEN (explicitly blocked):
 *   - task:runtime:rescheduled (intentional user action, not a pattern)
 *   - task:runtime:postponed   (snooze, not useful for learning)
 *   - task:runtime:skipped     (user chose to skip, not a completion signal)
 *   - scheduler tick           (periodic check, no learning signal)
 */
export type MLTriggerEvent =
  | "task:runtime:completed"
  | "task:runtime:missed"
  | "task:runtime:recurrence";

const ALLOWED_ML_TRIGGERS = new Set<string>([
  "task:runtime:completed",
  "task:runtime:missed",
  "task:runtime:recurrence",
]);

/**
 * Validate that an event is allowed to trigger ML analysis.
 * Returns true if the event is a valid ML trigger.
 */
export function isValidMLTrigger(eventName: string): eventName is MLTriggerEvent {
  return ALLOWED_ML_TRIGGERS.has(eventName);
}

/**
 * Guard: assert that the caller provides a valid ML trigger event.
 * Logs a warning and returns false if the trigger is invalid.
 */
export function assertMLTrigger(eventName: string, operation: string): boolean {
  if (!isValidMLTrigger(eventName)) {
    logger.warn(
      `[PatternLearnerStore] ${operation} blocked — invalid trigger "${eventName}". ` +
      `Only ${[...ALLOWED_ML_TRIGGERS].join(", ")} are allowed.`
    );
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface PatternLearnerFeedback {
  suggestionId: string;
  accepted: boolean;
  timestamp: string;
  suggestedRRule: string;
  mode: "fixed" | "whenDone";
}

export interface TaskPatternHistory {
  taskId: string;
  completions: string[];
  feedback: PatternLearnerFeedback[];
  lastAnalysisAt?: string;
}

export interface PatternLearnerState {
  version: number;
  tasks: Record<string, TaskPatternHistory>;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class PatternLearnerStore {
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  async load(): Promise<PatternLearnerState> {
    try {
      const data = await this.plugin.loadData(PATTERN_LEARNER_STORAGE_KEY);
      if (data && typeof data === "object" && "tasks" in data) {
        return data as PatternLearnerState;
      }
    } catch (err) {
      logger.error("Failed to load pattern learner history", err);
    }

    return {
      version: 1,
      tasks: {},
    };
  }

  async save(state: PatternLearnerState): Promise<void> {
    try {
      await this.plugin.saveData(PATTERN_LEARNER_STORAGE_KEY, state);
    } catch (err) {
      logger.error("Failed to save pattern learner history", err);
      throw err;
    }
  }

  async clear(): Promise<void> {
    await this.save({ version: 1, tasks: {} });
  }

  /**
   * Record a completion event for ML analysis.
   * Only accepts valid ML trigger events.
   *
   * @param taskId   Task that triggered the event
   * @param trigger  The runtime event name
   * @returns true if the event was recorded, false if blocked
   */
  async recordEvent(
    taskId: string,
    trigger: string,
    timestamp?: string,
  ): Promise<boolean> {
    if (!assertMLTrigger(trigger, "recordEvent")) {
      return false;
    }

    const state = await this.load();
    if (!state.tasks[taskId]) {
      state.tasks[taskId] = {
        taskId,
        completions: [],
        feedback: [],
      };
    }

    state.tasks[taskId].completions.push(
      timestamp ?? new Date().toISOString()
    );
    state.tasks[taskId].lastAnalysisAt = new Date().toISOString();

    await this.save(state);
    return true;
  }
}
