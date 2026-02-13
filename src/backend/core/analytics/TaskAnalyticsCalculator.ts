/**
 * Task Analytics Calculator
 * 
 * Pure calculation service for task statistics.
 * No side effects, no external dependencies - just math.
 * 
 * Used by dashboard to display:
 * - Completion Rate %
 * - Miss Rate %
 * - Current/Best Streaks
 * - Active/Overdue counts
 */

import type { Task } from '@backend/core/models/Task';

export interface TaskAnalytics {
  /** Total number of tasks */
  totalTasks: number;
  
  /** Tasks with enabled=true */
  activeTasks: number;
  
  /** Tasks with enabled=false */
  disabledTasks: number;
  
  /** Overall completion rate (0-100) */
  completionRate: number;
  
  /** Overall miss rate (0-100) */
  missRate: number;
  
  /** Total completions across all tasks */
  totalCompletions: number;
  
  /** Total misses across all tasks */
  totalMisses: number;
  
  /** Best current streak (any task) */
  bestCurrentStreak: number;
  
  /** Best all-time streak (any task) */
  bestOverallStreak: number;
  
  /** Tasks overdue (dueAt < now) */
  overdueCount: number;
  
  /** Tasks due today */
  dueTodayCount: number;
  
  /** Tasks due this week */
  dueThisWeekCount: number;
  
  /** Average task health (0-100) */
  averageHealth: number;
}

export interface TaskHealthBreakdown {
  /** Tasks with health >= 80 */
  healthy: number;
  
  /** Tasks with health 50-79 */
  moderate: number;
  
  /** Tasks with health < 50 */
  struggling: number;
}

/**
 * Calculate comprehensive task analytics
 */
export function calculateTaskAnalytics(tasks: Task[]): TaskAnalytics {
  if (tasks.length === 0) {
    return {
      totalTasks: 0,
      activeTasks: 0,
      disabledTasks: 0,
      completionRate: 0,
      missRate: 0,
      totalCompletions: 0,
      totalMisses: 0,
      bestCurrentStreak: 0,
      bestOverallStreak: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      dueThisWeekCount: 0,
      averageHealth: 0,
    };
  }
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  
  let activeTasks = 0;
  let disabledTasks = 0;
  let totalCompletions = 0;
  let totalMisses = 0;
  let bestCurrentStreak = 0;
  let bestOverallStreak = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;
  let dueThisWeekCount = 0;
  let totalHealth = 0;
  
  for (const task of tasks) {
    if (task.enabled) {
      activeTasks++;
    } else {
      disabledTasks++;
    }
    
    totalCompletions += task.completionCount || 0;
    totalMisses += task.missCount || 0;
    
    const currentStreak = task.currentStreak || 0;
    if (currentStreak > bestCurrentStreak) {
      bestCurrentStreak = currentStreak;
    }
    
    const bestStreak = task.bestStreak || 0;
    if (bestStreak > bestOverallStreak) {
      bestOverallStreak = bestStreak;
    }
    
    // Calculate health
    const health = calculateIndividualTaskHealth(task);
    totalHealth += health;
    
    // Check due dates
    if (task.dueAt) {
      const dueDate = new Date(task.dueAt);
      
      if (dueDate < now && task.status !== 'done') {
        overdueCount++;
      }
      
      if (dueDate >= todayStart && dueDate < todayEnd) {
        dueTodayCount++;
      }
      
      if (dueDate >= todayStart && dueDate < weekEnd) {
        dueThisWeekCount++;
      }
    }
  }
  
  const totalOccurrences = totalCompletions + totalMisses;
  const completionRate = totalOccurrences > 0 
    ? (totalCompletions / totalOccurrences) * 100 
    : 0;
  const missRate = totalOccurrences > 0 
    ? (totalMisses / totalOccurrences) * 100 
    : 0;
  
  const averageHealth = tasks.length > 0 ? totalHealth / tasks.length : 0;
  
  return {
    totalTasks: tasks.length,
    activeTasks,
    disabledTasks,
    completionRate: Math.round(completionRate * 10) / 10, // 1 decimal
    missRate: Math.round(missRate * 10) / 10,
    totalCompletions,
    totalMisses,
    bestCurrentStreak,
    bestOverallStreak,
    overdueCount,
    dueTodayCount,
    dueThisWeekCount,
    averageHealth: Math.round(averageHealth),
  };
}

/**
 * Calculate health score for individual task (0-100)
 */
function calculateIndividualTaskHealth(task: Task): number {
  const completions = task.completionCount || 0;
  const misses = task.missCount || 0;
  const total = completions + misses;
  
  if (total === 0) {
    return 100; // New task, optimistic
  }
  
  // Base score from completion rate (70% weight)
  const completionRate = completions / total;
  let score = completionRate * 70;
  
  // Bonus from current streak (up to 30 points)
  const streak = task.currentStreak || 0;
  const streakBonus = Math.min(30, streak * 3);
  score += streakBonus;
  
  return Math.round(Math.min(100, score));
}

/**
 * Get health breakdown by category
 */
export function getHealthBreakdown(tasks: Task[]): TaskHealthBreakdown {
  let healthy = 0;
  let moderate = 0;
  let struggling = 0;
  
  for (const task of tasks) {
    const health = calculateIndividualTaskHealth(task);
    
    if (health >= 80) {
      healthy++;
    } else if (health >= 50) {
      moderate++;
    } else {
      struggling++;
    }
  }
  
  return { healthy, moderate, struggling };
}

/**
 * Get top performing tasks by health
 */
export function getTopPerformingTasks(tasks: Task[], limit: number = 5): Array<{task: Task, health: number}> {
  const tasksWithHealth = tasks.map(task => ({
    task,
    health: calculateIndividualTaskHealth(task),
  }));
  
  return tasksWithHealth
    .sort((a, b) => b.health - a.health)
    .slice(0, limit);
}

/**
 * Get struggling tasks that need attention
 */
export function getStrugglingTasks(tasks: Task[], healthThreshold: number = 50): Array<{task: Task, health: number}> {
  const tasksWithHealth = tasks.map(task => ({
    task,
    health: calculateIndividualTaskHealth(task),
  }));
  
  return tasksWithHealth
    .filter(item => item.health < healthThreshold)
    .sort((a, b) => a.health - b.health); // Worst first
}

/**
 * Calculate analytics for specific time period
 */
export function calculatePeriodAnalytics(
  tasks: Task[], 
  startDate: Date, 
  endDate: Date
): Pick<TaskAnalytics, 'totalCompletions' | 'totalMisses' | 'completionRate' | 'missRate'> {
  let totalCompletions = 0;
  let totalMisses = 0;
  
  for (const task of tasks) {
    if (!task.recentCompletions) continue;
    
    const periodCompletions = task.recentCompletions.filter(dateStr => {
      const date = new Date(dateStr);
      return date >= startDate && date <= endDate;
    });
    
    totalCompletions += periodCompletions.length;
  }
  
  // For misses, would need completion history to be more precise
  // For now, use proportion based on overall miss rate
  const overallTotal = tasks.reduce((sum, t) => 
    sum + (t.completionCount || 0) + (t.missCount || 0), 0);
  const overallMisses = tasks.reduce((sum, t) => sum + (t.missCount || 0), 0);
  
  if (overallTotal > 0 && totalCompletions > 0) {
    const missRateRatio = overallMisses / overallTotal;
    totalMisses = Math.round(totalCompletions * missRateRatio);
  }
  
  const total = totalCompletions + totalMisses;
  const completionRate = total > 0 ? (totalCompletions / total) * 100 : 0;
  const missRate = total > 0 ? (totalMisses / total) * 100 : 0;
  
  return {
    totalCompletions,
    totalMisses,
    completionRate: Math.round(completionRate * 10) / 10,
    missRate: Math.round(missRate * 10) / 10,
  };
}
