/**
 * SmartSuggestionEngine — AI-Driven Task Intelligence (§6)
 *
 * Only triggers after task:runtime:completed and task:runtime:missed.
 * Generates contextual suggestions for task optimization.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Subscribes to EventBus events only
 *   ✔ Reads from cache only (no API calls for suggestions)
 *   ✔ Returns AISuggestionDTO (never emits mutations)
 *   ❌ No task mutations
 *   ❌ No SiYuan API calls
 *   ❌ No frontend imports
 */

import type { DomainTask } from "@domain/DomainTask";
import { eventBus } from "@events/EventBus";
import type { TaskCache } from "@cache/TaskCache";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface AISuggestion {
  readonly id: string;
  readonly taskId: string;
  readonly type:
    | "reschedule"
    | "priority_change"
    | "dependency_add"
    | "recurrence_adjust"
    | "split_task";
  readonly confidence: number; // 0-1
  readonly summary: string;
  readonly detail?: string;
  readonly suggestedValue?: string;
  readonly createdAt: string;
}

export interface SmartSuggestionConfig {
  readonly enabled: boolean;
  /** Minimum confidence to surface a suggestion (0-1) */
  readonly minConfidence: number;
  /** Maximum suggestions to generate per event */
  readonly maxSuggestions: number;
}

const DEFAULT_CONFIG: SmartSuggestionConfig = {
  enabled: true,
  minConfidence: 0.5,
  maxSuggestions: 3,
};

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class SmartSuggestionEngine {
  private config: SmartSuggestionConfig;
  private cache: TaskCache;
  private suggestions: Map<string, AISuggestion[]> = new Map();
  private unsubscribers: Array<() => void> = [];

  constructor(cache: TaskCache, config: Partial<SmartSuggestionConfig> = {}) {
    this.cache = cache;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (!this.config.enabled) return;

    this.unsubscribers.push(
      eventBus.on("task:runtime:completed", ({ task }) => {
        this.analyzeCompletion(task);
      }),
      eventBus.on("task:runtime:missed", ({ task }) => {
        this.analyzeMiss(task);
      }),
    );
  }

  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.suggestions.clear();
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Get suggestions for a specific task.
   */
  getSuggestions(taskId: string): readonly AISuggestion[] {
    return this.suggestions.get(taskId) ?? [];
  }

  /**
   * Get all pending suggestions across all tasks.
   */
  getAllSuggestions(): readonly AISuggestion[] {
    const all: AISuggestion[] = [];
    for (const list of this.suggestions.values()) {
      all.push(...list);
    }
    return all.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Dismiss a suggestion by ID.
   */
  dismissSuggestion(suggestionId: string): void {
    for (const [taskId, list] of this.suggestions.entries()) {
      const filtered = list.filter((s) => s.id !== suggestionId);
      if (filtered.length !== list.length) {
        this.suggestions.set(taskId, filtered);
        break;
      }
    }
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<SmartSuggestionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ── Analysis (Internal) ──────────────────────────────────────

  /**
   * Analyze a completed task for optimization suggestions.
   */
  private analyzeCompletion(task: DomainTask): void {
    const taskId = task.id as string;
    const results: AISuggestion[] = [];

    // Pattern: Task completed long after due date → suggest recurrence adjustment
    if (task.dueAt && task.doneAt) {
      const dueTime = new Date(task.dueAt as string).getTime();
      const doneTime = new Date(task.doneAt as string).getTime();
      const delayMs = doneTime - dueTime;

      if (delayMs > 24 * 60 * 60 * 1000) {
        // Completed > 24h late
        results.push(
          this.createSuggestion(taskId, "reschedule", 0.7, {
            summary: `Task "${task.name}" was completed ${Math.round(delayMs / (60 * 60 * 1000))}h after due date`,
            detail: "Consider scheduling more buffer time or adjusting priority",
          }),
        );
      }
    }

    // Pattern: Recurring task frequently completed late → suggest time adjustment
    if (task.recurrence && task.analytics?.missCount) {
      const missRate = task.analytics.missCount / 
        Math.max(1, (task.analytics.completionCount ?? 0) + task.analytics.missCount);
      if (missRate > 0.3) {
        results.push(
          this.createSuggestion(taskId, "recurrence_adjust", 0.65, {
            summary: `"${task.name}" is missed ${Math.round(missRate * 100)}% of the time`,
            detail: "Consider adjusting the recurrence schedule or time of day",
          }),
        );
      }
    }

    this.storeSuggestions(taskId, results);
  }

  /**
   * Analyze a missed task for optimization suggestions.
   */
  private analyzeMiss(task: DomainTask): void {
    const taskId = task.id as string;
    const results: AISuggestion[] = [];

    // Check if task has many dependencies that might be blocking progress
    if (task.dependsOn && task.dependsOn.length > 2) {
      results.push(
        this.createSuggestion(taskId, "split_task", 0.6, {
          summary: `"${task.name}" has ${task.dependsOn.length} dependencies`,
          detail: "Consider splitting into smaller tasks for easier completion",
        }),
      );
    }

    // Check priority: missed low-priority might need attention
    if (task.priority === "low" || task.priority === "lowest") {
      results.push(
        this.createSuggestion(taskId, "priority_change", 0.55, {
          summary: `Low-priority task "${task.name}" was missed`,
          detail: "Consider elevating priority or removing if not important",
        }),
      );
    }

    // Suggest reschedule if no recurrence
    if (!task.recurrence) {
      results.push(
        this.createSuggestion(taskId, "reschedule", 0.8, {
          summary: `"${task.name}" was missed and has no recurrence`,
          detail: "Reschedule to a more realistic time",
        }),
      );
    }

    this.storeSuggestions(taskId, results);
  }

  // ── Helpers ──────────────────────────────────────────────────

  private createSuggestion(
    taskId: string,
    type: AISuggestion["type"],
    confidence: number,
    details: { summary: string; detail?: string; suggestedValue?: string },
  ): AISuggestion {
    return {
      id: `suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      taskId,
      type,
      confidence,
      summary: details.summary,
      detail: details.detail,
      suggestedValue: details.suggestedValue,
      createdAt: new Date().toISOString(),
    };
  }

  private storeSuggestions(taskId: string, results: AISuggestion[]): void {
    const filtered = results
      .filter((s) => s.confidence >= this.config.minConfidence)
      .slice(0, this.config.maxSuggestions);

    if (filtered.length > 0) {
      const existing = this.suggestions.get(taskId) ?? [];
      this.suggestions.set(taskId, [...existing, ...filtered]);
    }
  }
}
