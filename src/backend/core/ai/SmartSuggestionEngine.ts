/**
 * Smart Suggestion Engine — Event-driven AI task analysis.
 *
 * This engine is STATELESS and PURE:
 *   - analyzeTask(task, trigger) → AISuggestion[]   (single-task, O(1) per event)
 *   - No constructor side-effects, no polling, no scanning all tasks
 *   - Called ONLY by AIOrchestrator in response to PluginEventBus events
 *
 * Trigger map:
 *   task:complete    → abandonment, reschedule, urgency, frequency
 *   task:reschedule  → reschedule, urgency
 *   task:skip        → abandonment, urgency
 *   task:missed      → abandonment, urgency
 *   task:overdue     → urgency
 */

import type { Task } from "@backend/core/models/Task";
import type {
  AISuggestion,
  SuggestionType,
  SuggestionAction,
} from "@backend/core/ai/types/SuggestionTypes";

// Re-export types for backward compatibility with existing imports
export type { AISuggestion as TaskSuggestion, SuggestionType, SuggestionAction };

export class SmartSuggestionEngine {
  // ─── Single-Task Analysis (event-driven) ──────────────────

  /**
   * Analyze a single task in response to a lifecycle event.
   * Returns only the suggestions relevant to the trigger.
   *
   * @param task – the task that triggered the event
   * @param trigger – which event caused this analysis (default: 'manual')
   */
  analyzeTask(
    task: Task,
    trigger: string = "manual"
  ): AISuggestion[] {
    const suggestions: AISuggestion[] = [];

    switch (trigger) {
      case "task:complete":
        this.checkAbandonment(task, trigger, suggestions);
        this.checkReschedule(task, trigger, suggestions);
        this.checkUrgency(task, trigger, suggestions);
        this.checkFrequency(task, trigger, suggestions);
        break;

      case "task:reschedule":
        this.checkReschedule(task, trigger, suggestions);
        this.checkUrgency(task, trigger, suggestions);
        break;

      case "task:skip":
      case "task:missed":
        this.checkAbandonment(task, trigger, suggestions);
        this.checkUrgency(task, trigger, suggestions);
        break;

      case "task:overdue":
        this.checkUrgency(task, trigger, suggestions);
        break;

      default:
        // 'manual' or unknown trigger — run all checks
        this.checkAbandonment(task, trigger, suggestions);
        this.checkReschedule(task, trigger, suggestions);
        this.checkUrgency(task, trigger, suggestions);
        this.checkFrequency(task, trigger, suggestions);
        break;
    }

    return suggestions;
  }

  /**
   * Predict the optimal time for a task based on completion history.
   * Public so the UI can display the prediction.
   */
  predictBestTime(task: Task): { hour: number; dayOfWeek: number; confidence: number } {
    if (!task.completionContexts || task.completionContexts.length < 3) {
      return { hour: 9, dayOfWeek: 1, confidence: 0 };
    }

    const hourCounts = new Map<number, number>();
    const dayOfWeekCounts = new Map<number, number>();

    for (const ctx of task.completionContexts) {
      if (!ctx.wasOverdue) {
        hourCounts.set(ctx.hourOfDay, (hourCounts.get(ctx.hourOfDay) ?? 0) + 1);
        dayOfWeekCounts.set(ctx.dayOfWeek, (dayOfWeekCounts.get(ctx.dayOfWeek) ?? 0) + 1);
      }
    }

    let bestHour = 9;
    let maxCount = 0;
    for (const [hour, count] of hourCounts) {
      if (count > maxCount) {
        maxCount = count;
        bestHour = hour;
      }
    }

    let bestDayOfWeek = 1;
    let maxDayCount = 0;
    for (const [day, count] of dayOfWeekCounts) {
      if (count > maxDayCount) {
        maxDayCount = count;
        bestDayOfWeek = day;
      }
    }

    const confidence = Math.min(maxCount / task.completionContexts.length, 1);
    return { hour: bestHour, dayOfWeek: bestDayOfWeek, confidence };
  }

  /**
   * Detect if a task is an abandonment candidate.
   * Public so tests can call it directly.
   */
  detectAbandonmentCandidate(task: Task): boolean {
    const missCount = task.missCount ?? 0;
    const completionCount = task.completionCount ?? 0;

    if (missCount >= 5 && completionCount === 0) return true;
    if (missCount + completionCount >= 10) {
      return completionCount / (missCount + completionCount) < 0.1;
    }
    return false;
  }

  /**
   * Find tasks similar to the given task (name/tag/category overlap).
   * Used by AIOrchestrator for limited cross-task checks.
   */
  findSimilarTasks(task: Task, allTasks: Task[]): Task[] {
    const similar: Task[] = [];
    for (const other of allTasks) {
      if (other.id === task.id) continue;
      if (this.calculateNameSimilarity(task.name, other.name) > 0.5) {
        similar.push(other);
        continue;
      }
      if (task.tags && other.tags) {
        const commonTags = task.tags.filter((t) => other.tags!.includes(t));
        if (commonTags.length >= 2) {
          similar.push(other);
          continue;
        }
      }
      if (task.category && task.category === other.category) {
        if (this.calculateNameSimilarity(task.name, other.name) > 0.3) {
          similar.push(other);
        }
      }
    }
    return similar;
  }

  // ─── Individual checks ────────────────────────────────────

  private checkAbandonment(
    task: Task,
    trigger: string,
    out: AISuggestion[]
  ): void {
    if (!this.detectAbandonmentCandidate(task)) return;
    out.push(
      this.makeSuggestion(task, "abandon", 0.85, trigger, {
        reason: `This task has never been completed in ${task.missCount ?? 0} occurrences. Consider removing it.`,
        action: { type: "disable", parameters: { taskId: task.id } },
      })
    );
  }

  private checkReschedule(
    task: Task,
    trigger: string,
    out: AISuggestion[]
  ): void {
    const best = this.predictBestTime(task);
    if (best.confidence <= 0.7) return;
    const currentHour = task.dueAt ? new Date(task.dueAt).getHours() : 0;
    if (Math.abs(currentHour - best.hour) < 2) return;

    out.push(
      this.makeSuggestion(task, "reschedule", best.confidence, trigger, {
        reason: `You usually complete this task around ${this.formatHour(best.hour)}. Consider moving it from ${this.formatHour(currentHour)}.`,
        action: { type: "updateTime", parameters: { hour: best.hour, taskId: task.id } },
      })
    );
  }

  private checkUrgency(
    task: Task,
    trigger: string,
    out: AISuggestion[]
  ): void {
    if ((task.missCount ?? 0) < 3 || task.priority === "high") return;
    out.push(
      this.makeSuggestion(task, "urgency", 0.9, trigger, {
        reason: `This recurring task has missed ${task.missCount} occurrences. Consider marking as high priority.`,
        action: { type: "setPriority", parameters: { priority: "high", taskId: task.id } },
      })
    );
  }

  private checkFrequency(
    task: Task,
    trigger: string,
    out: AISuggestion[]
  ): void {
    const rate = this.calculateCompletionRate(task);
    if (rate <= 1.5 || task.frequency?.type === "custom") return;
    out.push(
      this.makeSuggestion(task, "frequency", 0.75, trigger, {
        reason: `You complete this ${task.frequency?.type ?? "recurring"} task ${rate.toFixed(1)}x more often than scheduled. Consider increasing frequency.`,
        action: { type: "adjustFrequency", parameters: { multiplier: Math.floor(rate), taskId: task.id } },
      })
    );
  }

  // ─── Helpers ──────────────────────────────────────────────

  private makeSuggestion(
    task: Task,
    type: SuggestionType,
    confidence: number,
    trigger: string,
    extra: { reason: string; action: SuggestionAction }
  ): AISuggestion {
    return {
      id: `${task.id}-${type}-${Date.now()}`,
      taskId: task.id,
      type,
      confidence,
      reason: extra.reason,
      action: extra.action,
      createdAt: new Date().toISOString(),
      dismissed: false,
      applied: false,
      triggeredBy: trigger,
    };
  }

  private calculateCompletionRate(task: Task): number {
    const completionCount = task.completionCount ?? 0;
    const missCount = task.missCount ?? 0;
    const total = completionCount + missCount;
    if (total === 0) return 1;

    if (task.frequency?.type === "daily") {
      const recent = task.recentCompletions ?? [];
      if (recent.length < 2) return 1;
      const dates = recent
        .map((c) => new Date(c).getTime())
        .sort((a, b) => a - b);
      const intervals: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        const curr = dates[i]!;
        const prev = dates[i - 1]!;
        intervals.push((curr - prev) / (1000 * 60 * 60 * 24));
      }
      if (intervals.length === 0) return 1;
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      return 1 / avg;
    }

    return completionCount / total;
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    const set1 = new Set(name1.toLowerCase().split(/\s+/));
    const set2 = new Set(name2.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const word of set1) {
      if (set2.has(word) && word.length > 3) overlap++;
    }
    const maxSize = Math.max(set1.size, set2.size);
    return maxSize === 0 ? 0 : overlap / maxSize;
  }

  private formatHour(hour: number): string {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}${period}`;
  }
}
