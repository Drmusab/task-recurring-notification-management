/**
 * Completion Probability Calculator
 * 
 * Helper service for calculating real-time completion probabilities
 * and risk assessments for tasks.
 */

import type { Task } from '@backend/core/models/Task';
import { predictiveEngine, type CompletionProbability, type PredictiveInsights } from './PredictiveEngine';

export interface TaskRiskAssessment {
  taskId: string;
  taskName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  completionProbability: number;
  dueIn: number; // minutes until due
  recommendation: string;
  urgentAction: boolean;
}

export interface WeeklyComparison {
  currentWeek: WeekStats;
  lastWeek: WeekStats;
  change: {
    completions: number;
    completionRate: number;
    averageDelay: number;
    streakDays: number;
  };
  trend: 'improving' | 'declining' | 'stable';
}

export interface WeekStats {
  startDate: string;
  endDate: string;
  completions: number;
  misses: number;
  completionRate: number;
  averageDelayMinutes: number;
  streakDays: number;
  totalTasks: number;
}

/**
 * Calculate completion probability for all active tasks
 */
export function calculateTaskProbabilities(tasks: Task[]): Map<string, CompletionProbability> {
  const probabilities = new Map<string, CompletionProbability>();
  const now = new Date();
  
  for (const task of tasks) {
    if (task.enabled === false) continue;
    
    const probability = predictiveEngine.calculateCompletionProbability(task, now);
    probabilities.set(task.id, probability);
  }
  
  return probabilities;
}

/**
 * Identify tasks at risk of being missed
 */
export function identifyRiskyTasks(tasks: Task[], maxResults: number = 10): TaskRiskAssessment[] {
  const now = new Date();
  const assessments: TaskRiskAssessment[] = [];
  
  for (const task of tasks) {
    if (task.enabled === false || !task.dueAt) continue;
    
    const dueDate = new Date(task.dueAt);
    const dueIn = (dueDate.getTime() - now.getTime()) / (1000 * 60); // minutes
    
    // Only assess tasks due in the future
    if (dueIn < 0) continue;
    
    const probability = predictiveEngine.calculateCompletionProbability(task, now);
    
    // Calculate risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (probability.probability >= 0.7) {
      riskLevel = 'low';
    } else if (probability.probability >= 0.5) {
      riskLevel = 'medium';
    } else if (probability.probability >= 0.3) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }
    
    // Urgent action needed if high/critical risk and due soon
    const urgentAction = (riskLevel === 'high' || riskLevel === 'critical') && dueIn < 360; // 6 hours
    
    assessments.push({
      taskId: task.id,
      taskName: task.name,
      riskLevel,
      completionProbability: probability.probability,
      dueIn: Math.round(dueIn),
      recommendation: probability.recommendation,
      urgentAction,
    });
  }
  
  // Sort by risk (critical first) then by due time
  assessments.sort((a, b) => {
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    }
    return a.dueIn - b.dueIn;
  });
  
  return assessments.slice(0, maxResults);
}

/**
 * Calculate week-over-week comparison
 */
export function calculateWeeklyComparison(tasks: Task[]): WeeklyComparison {
  const now = new Date();
  
  // Current week: Last 7 days
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  currentWeekStart.setHours(0, 0, 0, 0);
  
  // Last week: 8-14 days ago
  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(lastWeekStart.getDate() - 14);
  lastWeekStart.setHours(0, 0, 0, 0);
  
  const lastWeekEnd = new Date(currentWeekStart);
  
  const currentWeek = calculateWeekStats(tasks, currentWeekStart, now);
  const lastWeek = calculateWeekStats(tasks, lastWeekStart, lastWeekEnd);
  
  // Calculate changes
  const completionsChange = currentWeek.completions - lastWeek.completions;
  const completionRateChange = currentWeek.completionRate - lastWeek.completionRate;
  const delayChange = currentWeek.averageDelayMinutes - lastWeek.averageDelayMinutes;
  const streakChange = currentWeek.streakDays - lastWeek.streakDays;
  
  // Determine trend
  let trend: 'improving' | 'declining' | 'stable';
  if (completionRateChange > 5) {
    trend = 'improving';
  } else if (completionRateChange < -5) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }
  
  return {
    currentWeek,
    lastWeek,
    change: {
      completions: completionsChange,
      completionRate: completionRateChange,
      averageDelay: delayChange,
      streakDays: streakChange,
    },
    trend,
  };
}

/**
 * Calculate statistics for a specific week
 */
function calculateWeekStats(tasks: Task[], startDate: Date, endDate: Date): WeekStats {
  let completions = 0;
  let misses = 0;
  let totalDelayMinutes = 0;
  let delayCount = 0;
  const tasksInPeriod = new Set<string>();
  
  for (const task of tasks) {
    const history = task.completionHistory || [];
    
    for (const entry of history) {
      const completedAt = new Date(entry.completedAt);
      
      if (completedAt >= startDate && completedAt < endDate) {
        completions++;
        tasksInPeriod.add(task.id);
        
        if (entry.delayMinutes !== undefined) {
          totalDelayMinutes += entry.delayMinutes;
          delayCount++;
        }
        
        if (entry.context?.wasOverdue) {
          misses++;
        }
      }
    }
  }
  
  const completionRate = completions + misses > 0
    ? (completions / (completions + misses)) * 100
    : 0;
  
  const averageDelayMinutes = delayCount > 0
    ? totalDelayMinutes / delayCount
    : 0;
  
  // Calculate streak days (consecutive days with at least 1 completion)
  const daysWithCompletions = new Set<string>();
  for (const task of tasks) {
    const history = task.completionHistory || [];
    for (const entry of history) {
      const completedAt = new Date(entry.completedAt);
      if (completedAt >= startDate && completedAt < endDate) {
        const dateKey = completedAt.toISOString().slice(0, 10);
        daysWithCompletions.add(dateKey);
      }
    }
  }
  
  // Count consecutive days
  let streakDays = 0;
  let currentDate = new Date(endDate);
  currentDate.setDate(currentDate.getDate() - 1);
  
  while (currentDate >= startDate) {
    const dateKey = currentDate.toISOString().slice(0, 10);
    if (daysWithCompletions.has(dateKey)) {
      streakDays++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    completions,
    misses,
    completionRate: Math.round(completionRate * 10) / 10,
    averageDelayMinutes: Math.round(averageDelayMinutes),
    streakDays,
    totalTasks: tasksInPeriod.size,
  };
}

/**
 * Get task health breakdown
 */
export function calculateHealthBreakdown(tasks: Task[]): {
  healthy: Task[];
  moderate: Task[];
  struggling: Task[];
} {
  const healthy: Task[] = [];
  const moderate: Task[] = [];
  const struggling: Task[] = [];
  
  for (const task of tasks) {
    if (task.enabled === false) continue;
    
    const health = calculateTaskHealth(task);
    
    if (health >= 80) {
      healthy.push(task);
    } else if (health >= 50) {
      moderate.push(task);
    } else {
      struggling.push(task);
    }
  }
  
  return { healthy, moderate, struggling };
}

/**
 * Calculate individual task health score (0-100)
 */
export function calculateTaskHealth(task: Task): number {
  let score = 50; // Baseline
  
  // Completion rate contribution (0-30 points)
  const completionCount = task.completionCount || 0;
  const missCount = task.missCount || 0;
  const total = completionCount + missCount;
  
  if (total > 0) {
    const completionRate = completionCount / total;
    score += completionRate * 30;
  }
  
  // Streak contribution (0-20 points)
  const currentStreak = task.currentStreak || 0;
  const bestStreak = task.bestStreak || 1;
  const streakRatio = currentStreak / bestStreak;
  score += streakRatio * 20;
  
  // Consistency contribution (0-20 points)
  const insights = predictiveEngine.generateInsights(task);
  if (insights) {
    score += (insights.consistencyScore / 100) * 20;
  }
  
  // Lateness penalty (0-30 points)
  if (insights) {
    const latenessPenalty = insights.latenessRisk * 30;
    score -= latenessPenalty;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}
