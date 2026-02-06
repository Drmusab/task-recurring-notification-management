// @ts-nocheck
/**
 * Predictive Scheduler - ML-based best time suggestions
 */

import type { Task } from '@backend/core/models/Task';
import { TimeSlotScorer } from './scoring/TimeSlotScorer';

export interface TimeSlotScore {
  hour: number;
  dayOfWeek: number;
  score: number; // 0-100
  reasoning: string[];
  historicalSuccessRate: number;
  contextFactors: {
    averageDelay: number; // minutes
    completionProbability: number;
    conflictCount: number;
  };
}

export interface SchedulingContext {
  allTasks: Task[];
  userPreferences: {
    workingHours: { start: number; end: number };
    preferredDays: number[];
    avoidDays: number[];
  };
  constraints: {
    maxTasksPerDay: number;
    minGapBetweenTasks: number; // minutes
  };
}

/**
 * Predictive Scheduler predicts optimal scheduling times
 */
export class PredictiveScheduler {
  private scorer: TimeSlotScorer;

  constructor() {
    this.scorer = new TimeSlotScorer();
  }

  /**
   * Score all possible time slots for a task
   */
  async scoreTimeSlots(task: Task, context: SchedulingContext): Promise<TimeSlotScore[]> {
    const scores: TimeSlotScore[] = [];

    // Score each hour of each day of the week
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      // Skip avoided days
      if (context.userPreferences.avoidDays.includes(dayOfWeek)) {
        continue;
      }

      for (let hour = 0; hour < 24; hour++) {
        // Skip hours outside working hours
        if (hour < context.userPreferences.workingHours.start || 
            hour >= context.userPreferences.workingHours.end) {
          continue;
        }

        const timeSlot = { hour, dayOfWeek };
        const score = this.scorer.calculateScore(timeSlot, task, context);
        const reasoning = this.scorer.getReasoningForScore(timeSlot, task, context);
        const historicalSuccess = this.scorer.scoreHistoricalSuccess(timeSlot, task);
        const contextFactors = this.calculateContextFactors(timeSlot, task, context);

        scores.push({
          hour,
          dayOfWeek,
          score,
          reasoning,
          historicalSuccessRate: historicalSuccess,
          contextFactors
        });
      }
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Get best N time slots
   */
  async suggestBestTimes(task: Task, count: number = 3): Promise<TimeSlotScore[]> {
    const context = this.createDefaultContext();
    const allScores = await this.scoreTimeSlots(task, context);
    return allScores.slice(0, count);
  }

  /**
   * Predict if current schedule is optimal
   */
  async evaluateCurrentSchedule(task: Task): Promise<{
    isOptimal: boolean;
    currentScore: number;
    bestAlternative?: TimeSlotScore;
  }> {
    const context = this.createDefaultContext();
    const allScores = await this.scoreTimeSlots(task, context);

    const currentTime = new Date(task.dueAt);
    const currentHour = currentTime.getHours();
    const currentDay = currentTime.getDay();

    const currentSlot = allScores.find(
      s => s.hour === currentHour && s.dayOfWeek === currentDay
    );

    const currentScore = currentSlot?.score || 0;
    const bestScore = allScores[0];

    return {
      isOptimal: currentScore >= bestScore.score * 0.9, // Within 90% of best
      currentScore,
      bestAlternative: currentScore < bestScore.score * 0.9 ? bestScore : undefined
    };
  }

  /**
   * Calculate context factors for a time slot
   */
  private calculateContextFactors(
    timeSlot: { hour: number; dayOfWeek: number },
    task: Task,
    context: SchedulingContext
  ): TimeSlotScore['contextFactors'] {
    // Calculate average delay for this time slot
    let totalDelay = 0;
    let delayCount = 0;

    if (task.completionContexts) {
      for (const ctx of task.completionContexts) {
        if (ctx.hourOfDay === timeSlot.hour && ctx.dayOfWeek === timeSlot.dayOfWeek) {
          if (ctx.delayMinutes !== undefined) {
            totalDelay += ctx.delayMinutes;
            delayCount++;
          }
        }
      }
    }

    const averageDelay = delayCount > 0 ? totalDelay / delayCount : 0;

    // Calculate completion probability
    const totalAttempts = task.completionContexts?.filter(
      ctx => ctx.hourOfDay === timeSlot.hour && ctx.dayOfWeek === timeSlot.dayOfWeek
    ).length || 0;

    const successfulAttempts = task.completionContexts?.filter(
      ctx => ctx.hourOfDay === timeSlot.hour && 
             ctx.dayOfWeek === timeSlot.dayOfWeek && 
             !ctx.wasOverdue
    ).length || 0;

    const completionProbability = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0.5;

    // Calculate conflict count
    const conflictCount = this.countConflicts(timeSlot, context);

    return {
      averageDelay,
      completionProbability,
      conflictCount
    };
  }

  /**
   * Count scheduling conflicts at a given time slot
   */
  private countConflicts(
    timeSlot: { hour: number; dayOfWeek: number },
    context: SchedulingContext
  ): number {
    let conflicts = 0;

    for (const task of context.allTasks) {
      const taskTime = new Date(task.dueAt);
      const taskHour = taskTime.getHours();
      const taskDay = taskTime.getDay();

      if (taskHour === timeSlot.hour && taskDay === timeSlot.dayOfWeek) {
        conflicts++;
      }
    }

    return conflicts;
  }

  /**
   * Create default scheduling context
   */
  private createDefaultContext(): SchedulingContext {
    return {
      allTasks: [],
      userPreferences: {
        workingHours: { start: 6, end: 22 },
        preferredDays: [1, 2, 3, 4, 5], // Monday-Friday
        avoidDays: []
      },
      constraints: {
        maxTasksPerDay: 20,
        minGapBetweenTasks: 15
      }
    };
  }
}
