/**
 * CSVExporter - Export task analytics to CSV format
 * Provides comprehensive analytics data export for external analysis
 */

import type { Task } from "@backend/core/models/Task";
import { calculateTaskAnalytics } from "@backend/core/analytics/TaskAnalyticsCalculator";

export interface CSVExportOptions {
  /** Include individual task rows */
  includeTasks?: boolean;
  
  /** Include summary statistics */
  includeSummary?: boolean;
  
  /** Include completion history */
  includeCompletionHistory?: boolean;
  
  /** Date range filter (start) */
  startDate?: Date;
  
  /** Date range filter (end) */
  endDate?: Date;
}

/**
 * Export analytics data to CSV string
 */
export function exportAnalyticsToCSV(
  tasks: Task[],
  options: CSVExportOptions = {}
): string {
  const {
    includeTasks = true,
    includeSummary = true,
    includeCompletionHistory = false,
    startDate,
    endDate,
  } = options;
  
  const lines: string[] = [];
  
  // Filter tasks by date range if specified
  let filteredTasks = tasks;
  if (startDate || endDate) {
    filteredTasks = tasks.filter(task => {
      const createdAt = new Date(task.createdAt);
      if (startDate && createdAt < startDate) return false;
      if (endDate && createdAt > endDate) return false;
      return true;
    });
  }
  
  // Add summary section
  if (includeSummary) {
    const analytics = calculateTaskAnalytics(filteredTasks);
    
    lines.push("=== ANALYTICS SUMMARY ===");
    lines.push("");
    lines.push("Metric,Value");
    lines.push(`Total Tasks,${analytics.totalTasks}`);
    lines.push(`Active Tasks,${analytics.activeTasks}`);
    lines.push(`Disabled Tasks,${analytics.disabledTasks}`);
    lines.push(`Completion Rate,${analytics.completionRate.toFixed(1)}%`);
    lines.push(`Miss Rate,${analytics.missRate.toFixed(1)}%`);
    lines.push(`Total Completions,${analytics.totalCompletions}`);
    lines.push(`Total Misses,${analytics.totalMisses}`);
    lines.push(`Best Current Streak,${analytics.bestCurrentStreak}`);
    lines.push(`Best Overall Streak,${analytics.bestOverallStreak}`);
    lines.push(`Overdue Count,${analytics.overdueCount}`);
    lines.push(`Due Today,${analytics.dueTodayCount}`);
    lines.push(`Due This Week,${analytics.dueThisWeekCount}`);
    lines.push(`Average Health,${analytics.averageHealth}`);
    lines.push("");
    lines.push("");
  }
  
  // Add task details section
  if (includeTasks) {
    lines.push("=== TASK DETAILS ===");
    lines.push("");
    lines.push([
      "Task ID",
      "Name",
      "Status",
      "Priority",
      "Completion Count",
      "Miss Count",
      "Current Streak",
      "Best Streak",
      "Last Completed",
      "Due At",
      "Created At",
      "Tags",
      "Category",
    ].join(","));
    
    for (const task of filteredTasks) {
      const row = [
        escapeCSV(task.id),
        escapeCSV(task.name),
        escapeCSV(task.status || (task.enabled ? "todo" : "disabled")),
        escapeCSV(task.priority?.toString() || ""),
        task.completionCount || 0,
        task.missCount || 0,
        task.currentStreak || 0,
        task.bestStreak || 0,
        escapeCSV(task.lastCompletedAt || ""),
        escapeCSV(task.dueAt),
        escapeCSV(task.createdAt),
        escapeCSV((task.tags || []).join("; ")),
        escapeCSV(task.category || ""),
      ].join(",");
      
      lines.push(row);
    }
    
    lines.push("");
    lines.push("");
  }
  
  // Add completion history section
  if (includeCompletionHistory) {
    lines.push("=== COMPLETION HISTORY ===");
    lines.push("");
    lines.push([
      "Task ID",
      "Task Name",
      "Completion Date",
      "Was Overdue",
      "Delay Days",
    ].join(","));
    
    for (const task of filteredTasks) {
      if (!task.recentCompletions) continue;
      
      for (const completionDate of task.recentCompletions) {
        const completion = new Date(completionDate);
        const due = task.dueAt ? new Date(task.dueAt) : null;
        const wasOverdue = due && completion > due;
        const delayDays = due ? Math.floor((completion.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        
        const row = [
          escapeCSV(task.id),
          escapeCSV(task.name),
          completionDate,
          wasOverdue ? "Yes" : "No",
          delayDays,
        ].join(",");
        
        lines.push(row);
      }
    }
    
    lines.push("");
  }
  
  return lines.join("\n");
}

/**
 * Download CSV file to user's computer
 */
export function downloadCSV(csvContent: string, filename: string = "task-analytics.csv"): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export analytics and trigger download
 */
export function exportAndDownload(tasks: Task[], options: CSVExportOptions = {}): void {
  const csvContent = exportAnalyticsToCSV(tasks, options);
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `task-analytics-${timestamp}.csv`;
  downloadCSV(csvContent, filename);
}

/**
 * Escape CSV values (handle commas, quotes, newlines)
 */
function escapeCSV(value: string | number | boolean): string {
  if (typeof value !== "string") {
    return value.toString();
  }
  
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}

/**
 * Generate streak data for analytics (for TaskStatsCalculator extension)
 */
export interface StreakData {
  currentStreak: number;
  bestStreak: number;
  streakHistory: Array<{
    startDate: string;
    endDate: string;
    length: number;
  }>;
}

export function getStreakData(task: Task): StreakData {
  return {
    currentStreak: task.currentStreak || 0,
    bestStreak: task.bestStreak || 0,
    streakHistory: [], // Would require detailed history tracking
  };
}

/**
 * Generate completion trend data (for TaskStatsCalculator extension)
 */
export interface TrendData {
  dates: string[];
  completions: number[];
  average: number;
  trend: "increasing" | "decreasing" | "stable";
}

export function getCompletionTrend(tasks: Task[], days: number = 30): TrendData {
  const now = new Date();
  const dates: string[] = [];
  const completions: number[] = [];
  
  // Generate date range
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().slice(0, 10));
    completions.push(0);
  }
  
  // Count completions per day
  for (const task of tasks) {
    if (!task.recentCompletions) continue;
    
    for (const completionISO of task.recentCompletions) {
      const dateStr = completionISO.slice(0, 10);
      const index = dates.indexOf(dateStr);
      if (index !== -1 && completions[index] !== undefined) {
        completions[index]++;
      }
    }
  }
  
  // Calculate average
  const sum = completions.reduce((a, b) => a + b, 0);
  const average = completions.length > 0 ? sum / completions.length : 0;
  
  // Determine trend (simple linear regression)
  let trend: "increasing" | "decreasing" | "stable" = "stable";
  if (completions.length >= 7) {
    const firstHalf = completions.slice(0, Math.floor(completions.length / 2));
    const secondHalf = completions.slice(Math.floor(completions.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.1) trend = "increasing";
    else if (secondAvg < firstAvg * 0.9) trend = "decreasing";
  }
  
  return {
    dates,
    completions,
    average,
    trend,
  };
}
