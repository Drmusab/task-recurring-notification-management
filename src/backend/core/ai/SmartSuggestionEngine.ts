// @ts-nocheck
/**
 * Smart Suggestion Engine - AI-driven task recommendations
 */

import type { Task } from '@backend/core/models/Task';

export type SuggestionType = 'reschedule' | 'urgency' | 'consolidate' | 'delegate' | 'frequency' | 'abandon';

export interface TaskSuggestion {
  id: string;
  taskId: string;
  type: SuggestionType;
  confidence: number; // 0-1 score
  reason: string;
  action: SuggestionAction;
  createdAt: string;
  dismissed: boolean;
}

export interface SuggestionAction {
  type: string;
  parameters: Record<string, any>;
}

/**
 * Smart Suggestion Engine analyzes task patterns and generates recommendations
 */
export class SmartSuggestionEngine {
  /**
   * Analyze single task patterns and generate suggestions
   */
  async analyzeTask(task: Task, allTasks: Task[]): Promise<TaskSuggestion[]> {
    const suggestions: TaskSuggestion[] = [];

    // Check for abandonment candidate
    if (this.detectAbandonmentCandidate(task)) {
      suggestions.push({
        id: `${task.id}-abandon-${Date.now()}`,
        taskId: task.id,
        type: 'abandon',
        confidence: 0.85,
        reason: `This task has never been completed in ${task.missCount || 0} occurrences. Consider removing it.`,
        action: {
          type: 'disable',
          parameters: { taskId: task.id }
        },
        createdAt: new Date().toISOString(),
        dismissed: false
      });
    }

    // Check for reschedule opportunity
    const bestTime = this.predictBestTime(task);
    if (bestTime.confidence > 0.7) {
      const currentHour = task.dueAt ? new Date(task.dueAt).getHours() : 0;
      if (Math.abs(currentHour - bestTime.hour) >= 2) {
        suggestions.push({
          id: `${task.id}-reschedule-${Date.now()}`,
          taskId: task.id,
          type: 'reschedule',
          confidence: bestTime.confidence,
          reason: `You usually complete this task around ${this.formatHour(bestTime.hour)}. Consider moving it from ${this.formatHour(currentHour)}.`,
          action: {
            type: 'updateTime',
            parameters: { hour: bestTime.hour, taskId: task.id }
          },
          createdAt: new Date().toISOString(),
          dismissed: false
        });
      }
    }

    // Check for urgency alerts
    if ((task.missCount || 0) >= 3 && task.priority !== 'high') {
      suggestions.push({
        id: `${task.id}-urgency-${Date.now()}`,
        taskId: task.id,
        type: 'urgency',
        confidence: 0.9,
        reason: `This recurring task has missed ${task.missCount} occurrences. Consider marking as high priority.`,
        action: {
          type: 'setPriority',
          parameters: { priority: 'high', taskId: task.id }
        },
        createdAt: new Date().toISOString(),
        dismissed: false
      });
    }

    // Check for frequency optimization
    const completionRate = this.calculateCompletionRate(task);
    if (completionRate > 1.5 && task.frequency.type !== 'custom') {
      suggestions.push({
        id: `${task.id}-frequency-${Date.now()}`,
        taskId: task.id,
        type: 'frequency',
        confidence: 0.75,
        reason: `You complete this ${task.frequency.type} task ${completionRate.toFixed(1)}x more often than scheduled. Consider increasing frequency.`,
        action: {
          type: 'adjustFrequency',
          parameters: { multiplier: Math.floor(completionRate), taskId: task.id }
        },
        createdAt: new Date().toISOString(),
        dismissed: false
      });
    }

    return suggestions;
  }

  /**
   * Analyze cross-task patterns for consolidation and delegation
   */
  async analyzeCrossTaskPatterns(tasks: Task[]): Promise<TaskSuggestion[]> {
    const suggestions: TaskSuggestion[] = [];

    // Find similar tasks for consolidation
    for (const task of tasks) {
      const similarTasks = this.findSimilarTasks(task, tasks);
      if (similarTasks.length >= 2) {
        // Check if they're on the same day
        const sameDayTasks = similarTasks.filter(t => {
          const taskDate = new Date(task.dueAt).toDateString();
          const otherDate = new Date(t.dueAt).toDateString();
          return taskDate === otherDate;
        });

        if (sameDayTasks.length >= 2) {
          suggestions.push({
            id: `${task.id}-consolidate-${Date.now()}`,
            taskId: task.id,
            type: 'consolidate',
            confidence: 0.65,
            reason: `You have ${sameDayTasks.length + 1} similar tasks on the same day. Consider combining them.`,
            action: {
              type: 'consolidateTasks',
              parameters: {
                taskIds: [task.id, ...sameDayTasks.map(t => t.id)]
              }
            },
            createdAt: new Date().toISOString(),
            dismissed: false
          });
        }
      }
    }

    // Detect delegation opportunities based on tags
    const tagDelayMap = new Map<string, number[]>();
    for (const task of tasks) {
      if (task.tags && task.completionTimes && task.completionContexts) {
        for (const tag of task.tags) {
          if (!tagDelayMap.has(tag)) {
            tagDelayMap.set(tag, []);
          }
          const delays = task.completionContexts
            .filter(c => c.delayMinutes !== undefined)
            .map(c => c.delayMinutes!);
          tagDelayMap.get(tag)!.push(...delays);
        }
      }
    }

    // Check for consistently delayed tags
    for (const [tag, delays] of tagDelayMap.entries()) {
      if (delays.length >= 5) {
        const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
        if (avgDelay > 60) { // More than 1 hour average delay
          const affectedTasks = tasks.filter(t => t.tags?.includes(tag));
          for (const task of affectedTasks) {
            suggestions.push({
              id: `${task.id}-delegate-${Date.now()}`,
              taskId: task.id,
              type: 'delegate',
              confidence: 0.7,
              reason: `Tasks with tag #${tag} are often delayed by ${Math.round(avgDelay / 60)} hours. Consider delegating.`,
              action: {
                type: 'suggestDelegation',
                parameters: { tag, taskId: task.id }
              },
              createdAt: new Date().toISOString(),
              dismissed: false
            });
          }
          break; // Only suggest once per tag
        }
      }
    }

    return suggestions;
  }

  /**
   * Calculate optimal time based on completion history
   */
  predictBestTime(task: Task): { hour: number; dayOfWeek: number; confidence: number } {
    if (!task.completionContexts || task.completionContexts.length < 3) {
      return { hour: 9, dayOfWeek: 1, confidence: 0 };
    }

    // Count completions by hour
    const hourCounts = new Map<number, number>();
    for (const context of task.completionContexts) {
      if (!context.wasOverdue) {
        const count = hourCounts.get(context.hourOfDay) || 0;
        hourCounts.set(context.hourOfDay, count + 1);
      }
    }

    // Find most common hour
    let bestHour = 9;
    let maxCount = 0;
    for (const [hour, count] of hourCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        bestHour = hour;
      }
    }

    // Count completions by day of week
    const dayOfWeekCounts = new Map<number, number>();
    for (const context of task.completionContexts) {
      if (!context.wasOverdue) {
        const count = dayOfWeekCounts.get(context.dayOfWeek) || 0;
        dayOfWeekCounts.set(context.dayOfWeek, count + 1);
      }
    }

    let bestDayOfWeek = 1;
    let maxDayCount = 0;
    for (const [day, count] of dayOfWeekCounts.entries()) {
      if (count > maxDayCount) {
        maxDayCount = count;
        bestDayOfWeek = day;
      }
    }

    const confidence = Math.min(maxCount / task.completionContexts.length, 1);
    
    return {
      hour: bestHour,
      dayOfWeek: bestDayOfWeek,
      confidence
    };
  }

  /**
   * Detect if task should be abandoned (never completed)
   */
  detectAbandonmentCandidate(task: Task): boolean {
    const missCount = task.missCount || 0;
    const completionCount = task.completionCount || 0;
    
    // Task has been missed at least 5 times and never completed
    if (missCount >= 5 && completionCount === 0) {
      return true;
    }

    // Task has very low completion rate (less than 10%)
    if (missCount + completionCount >= 10) {
      const completionRate = completionCount / (missCount + completionCount);
      if (completionRate < 0.1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find similar tasks for consolidation
   */
  findSimilarTasks(task: Task, allTasks: Task[]): Task[] {
    const similar: Task[] = [];

    for (const other of allTasks) {
      if (other.id === task.id) continue;

      // Check name similarity (simple word overlap)
      const similarity = this.calculateNameSimilarity(task.name, other.name);
      if (similarity > 0.5) {
        similar.push(other);
        continue;
      }

      // Check tag overlap
      if (task.tags && other.tags) {
        const commonTags = task.tags.filter(t => other.tags!.includes(t));
        if (commonTags.length >= 2) {
          similar.push(other);
          continue;
        }
      }

      // Check category match
      if (task.category && task.category === other.category) {
        const nameSim = this.calculateNameSimilarity(task.name, other.name);
        if (nameSim > 0.3) {
          similar.push(other);
        }
      }
    }

    return similar;
  }

  /**
   * Calculate completion rate (completions per scheduled occurrence)
   */
  private calculateCompletionRate(task: Task): number {
    const completionCount = task.completionCount || 0;
    const missCount = task.missCount || 0;
    const totalOccurrences = completionCount + missCount;

    if (totalOccurrences === 0) return 1;

    // Calculate how many times task was completed vs expected
    if (task.frequency.type === 'daily') {
      // For daily tasks, check if completing more than once per day on average
      const recentCompletions = task.recentCompletions || [];
      if (recentCompletions.length < 2) return 1;

      // Calculate average days between completions
      const dates = recentCompletions.map(c => new Date(c).getTime()).sort((a, b) => a - b);
      const intervals: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      }

      if (intervals.length === 0) return 1;
      const avgDaysBetween = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      return 1 / avgDaysBetween; // If completing every 0.5 days, rate is 2
    }

    return completionCount / totalOccurrences;
  }

  /**
   * Calculate name similarity using simple word overlap
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const words1 = name1.toLowerCase().split(/\s+/);
    const words2 = name2.toLowerCase().split(/\s+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    let overlap = 0;
    for (const word of set1) {
      if (set2.has(word) && word.length > 3) { // Only count significant words
        overlap++;
      }
    }

    const maxSize = Math.max(set1.size, set2.size);
    if (maxSize === 0) return 0;

    return overlap / maxSize;
  }

  /**
   * Format hour for display
   */
  private formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}${period}`;
  }
}
