import type { Plugin } from "siyuan";
import * as logger from "@shared/utils/misc/logger";

const PATTERN_LEARNER_STORAGE_KEY = "pattern_learner_history";

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
}
