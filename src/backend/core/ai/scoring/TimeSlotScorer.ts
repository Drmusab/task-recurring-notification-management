/**
 * Time Slot Scorer - Weighted scoring algorithm for scheduling
 */

import type { Task } from '@backend/core/models/Task';
import type { SchedulingContext } from '../PredictiveScheduler';

/**
 * Scores time slots based on multiple factors
 */
export class TimeSlotScorer {
  private weights = {
    historicalSuccess: 0.35,      // Past completion rate at this time
    workloadBalance: 0.20,         // Avoid overloading specific times
    taskDensity: 0.15,             // Consider nearby tasks
    userPreference: 0.15,          // Respect working hours
    energyLevel: 0.10,             // Morning/afternoon preferences
    contextSwitching: 0.05,        // Minimize context switches
  };

  /**
   * Calculate overall score for a time slot
   */
  calculateScore(
    timeSlot: { hour: number; dayOfWeek: number },
    task: Task,
    context: SchedulingContext
  ): number {
    const scores = {
      historicalSuccess: this.scoreHistoricalSuccess(timeSlot, task),
      workloadBalance: this.scoreWorkloadBalance(timeSlot, context),
      taskDensity: this.scoreTaskDensity(timeSlot, context),
      userPreference: this.scoreUserPreference(timeSlot, context),
      energyLevel: this.scoreEnergyLevel(timeSlot, task),
      contextSwitching: this.scoreContextSwitching(timeSlot, task, context),
    };

    return Object.entries(this.weights).reduce(
      (total, [key, weight]) => total + scores[key as keyof typeof scores] * weight,
      0
    ) * 100;
  }

  /**
   * Get reasoning for the score
   */
  getReasoningForScore(
    timeSlot: { hour: number; dayOfWeek: number },
    task: Task,
    context: SchedulingContext
  ): string[] {
    const reasoning: string[] = [];

    // Historical success
    const histScore = this.scoreHistoricalSuccess(timeSlot, task);
    if (histScore > 0.7) {
      reasoning.push(`High success rate at this time (${Math.round(histScore * 100)}%)`);
    } else if (histScore < 0.3 && histScore > 0) {
      reasoning.push(`Low success rate at this time (${Math.round(histScore * 100)}%)`);
    }

    // Workload balance
    const workloadScore = this.scoreWorkloadBalance(timeSlot, context);
    if (workloadScore < 0.5) {
      reasoning.push('High workload at this time');
    } else if (workloadScore > 0.8) {
      reasoning.push('Light workload - good availability');
    }

    // User preference
    const prefScore = this.scoreUserPreference(timeSlot, context);
    if (prefScore > 0.8) {
      reasoning.push('Within preferred working hours');
    }

    // Energy level
    const energyScore = this.scoreEnergyLevel(timeSlot, task);
    if (energyScore > 0.7) {
      reasoning.push('Peak energy time for this type of task');
    }

    return reasoning;
  }

  /**
   * Score based on historical success
   */
  scoreHistoricalSuccess(
    timeSlot: { hour: number; dayOfWeek: number },
    task: Task
  ): number {
    // Analyze completionContexts to find success rate at this time
    const relevantCompletions = task.completionContexts?.filter(
      c => c.hourOfDay === timeSlot.hour && c.dayOfWeek === timeSlot.dayOfWeek
    ) || [];

    if (relevantCompletions.length === 0) return 0.5; // Neutral if no data

    const successfulCompletions = relevantCompletions.filter(c => !c.wasOverdue);
    return successfulCompletions.length / relevantCompletions.length;
  }

  /**
   * Score based on workload balance
   */
  private scoreWorkloadBalance(
    timeSlot: { hour: number; dayOfWeek: number },
    context: SchedulingContext
  ): number {
    const tasksAtTime = context.allTasks.filter(t => {
      const taskTime = new Date(t.dueAt);
      return taskTime.getHours() === timeSlot.hour && 
             taskTime.getDay() === timeSlot.dayOfWeek;
    });

    const taskCount = tasksAtTime.length;
    const maxTasks = context.constraints.maxTasksPerDay / 24; // Rough per-hour limit

    if (taskCount >= maxTasks) return 0;
    return 1 - (taskCount / maxTasks);
  }

  /**
   * Score based on task density (nearby tasks)
   */
  private scoreTaskDensity(
    timeSlot: { hour: number; dayOfWeek: number },
    context: SchedulingContext
  ): number {
    const nearbyTasks = context.allTasks.filter(t => {
      const taskTime = new Date(t.dueAt);
      const hourDiff = Math.abs(taskTime.getHours() - timeSlot.hour);
      return taskTime.getDay() === timeSlot.dayOfWeek && hourDiff <= 2;
    });

    // Prefer moderate density (not too sparse, not too dense)
    const optimalDensity = 3;
    const densityScore = 1 - Math.abs(nearbyTasks.length - optimalDensity) / optimalDensity;
    return Math.max(0, Math.min(1, densityScore));
  }

  /**
   * Score based on user preferences
   */
  private scoreUserPreference(
    timeSlot: { hour: number; dayOfWeek: number },
    context: SchedulingContext
  ): number {
    // Check if within working hours
    if (timeSlot.hour < context.userPreferences.workingHours.start ||
        timeSlot.hour >= context.userPreferences.workingHours.end) {
      return 0;
    }

    // Check if on preferred day
    if (context.userPreferences.preferredDays.length > 0 &&
        !context.userPreferences.preferredDays.includes(timeSlot.dayOfWeek)) {
      return 0.5;
    }

    // Prefer middle of working hours
    const workingStart = context.userPreferences.workingHours.start;
    const workingEnd = context.userPreferences.workingHours.end;
    const workingMid = (workingStart + workingEnd) / 2;
    const distanceFromMid = Math.abs(timeSlot.hour - workingMid);
    const maxDistance = (workingEnd - workingStart) / 2;

    return 1 - (distanceFromMid / maxDistance);
  }

  /**
   * Score based on energy level
   */
  private scoreEnergyLevel(
    timeSlot: { hour: number; dayOfWeek: number },
    task: Task
  ): number {
    // Morning hours (6-12) - good for focused work
    if (timeSlot.hour >= 6 && timeSlot.hour < 12) {
      return task.priority === 'high' ? 1.0 : 0.8;
    }

    // Afternoon hours (12-17) - moderate energy
    if (timeSlot.hour >= 12 && timeSlot.hour < 17) {
      return 0.7;
    }

    // Evening hours (17-22) - lower energy
    if (timeSlot.hour >= 17 && timeSlot.hour < 22) {
      return task.priority === 'low' ? 0.8 : 0.5;
    }

    // Late night/early morning
    return 0.3;
  }

  /**
   * Score based on context switching
   */
  private scoreContextSwitching(
    timeSlot: { hour: number; dayOfWeek: number },
    task: Task,
    context: SchedulingContext
  ): number {
    // Find tasks at nearby times
    const nearbyTasks = context.allTasks.filter(t => {
      const taskTime = new Date(t.dueAt);
      const hourDiff = Math.abs(taskTime.getHours() - timeSlot.hour);
      return taskTime.getDay() === timeSlot.dayOfWeek && hourDiff === 1;
    });

    if (nearbyTasks.length === 0) return 0.5;

    // Count tasks with similar categories/tags
    let similarCount = 0;
    for (const nearby of nearbyTasks) {
      if (task.category && task.category === nearby.category) {
        similarCount++;
      } else if (task.tags && nearby.tags) {
        const commonTags = task.tags.filter(t => nearby.tags!.includes(t));
        if (commonTags.length > 0) {
          similarCount++;
        }
      }
    }

    // Higher score if nearby tasks are similar (less context switching)
    return similarCount / nearbyTasks.length;
  }
}
