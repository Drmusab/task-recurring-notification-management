import type { Task } from "@backend/core/models/Task";
import type { TaskStatsData, TaskStatsResult } from "@backend/commands/types/BulkCommandTypes";

/**
 * Calculates statistics from task data.
 */
export class TaskStatsCalculator {
  /**
   * Calculate stats from tasks based on the provided criteria.
   */
  calculate(tasks: Task[], data: TaskStatsData): TaskStatsResult {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter by time range if provided
    let filteredTasks = tasks;
    if (data.timeRange) {
      const start = new Date(data.timeRange.start);
      const end = new Date(data.timeRange.end);
      filteredTasks = tasks.filter((t) => {
        const created = new Date(t.createdAt);
        return created >= start && created <= end;
      });
    }

    const enabled = filteredTasks.filter((t) => t.enabled);
    const disabled = filteredTasks.filter((t) => !t.enabled);
    const recurring = filteredTasks.filter((t) => t.frequency);
    const overdue = enabled.filter((t) => new Date(t.dueAt) < now);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcoming = enabled.filter((t) => {
      const due = new Date(t.dueAt);
      return due >= now && due <= nextWeek;
    });

    // Completion counts
    const completedThisWeek = filteredTasks.filter(
      (t) => t.lastCompletedAt && new Date(t.lastCompletedAt) >= weekAgo
    );
    const completedThisMonth = filteredTasks.filter(
      (t) => t.lastCompletedAt && new Date(t.lastCompletedAt) >= monthAgo
    );

    // By priority
    const byPriority: Record<string, number> = {};
    filteredTasks.forEach((t) => {
      const p = t.priority || "normal";
      byPriority[p] = (byPriority[p] || 0) + 1;
    });

    // Tag distribution
    const tagCounts = new Map<string, number>();
    filteredTasks.forEach((t) => {
      t.tags?.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Upcoming by day
    const byDay: Record<string, number> = {};
    upcoming.forEach((t) => {
      const day = new Date(t.dueAt).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });

    const totalCompletions = filteredTasks.reduce((sum, t) => sum + (t.completionCount || 0), 0);

    return {
      totalTasks: filteredTasks.length,
      byStatus: {
        active: enabled.length,
        inactive: disabled.length,
      },
      byPriority,
      recurring: {
        total: recurring.length,
        active: recurring.filter((t) => t.enabled).length,
        paused: recurring.filter((t) => !t.enabled).length,
      },
      completion: {
        total: totalCompletions,
        thisWeek: completedThisWeek.length,
        thisMonth: completedThisMonth.length,
        averagePerDay: totalCompletions > 0 ? totalCompletions / 30 : 0,
      },
      overdue: {
        count: overdue.length,
        taskIds: overdue.map((t) => t.id),
      },
      upcoming: {
        count: upcoming.length,
        byDay,
      },
      topTags,
      ...(data.timeRange ? { timeRange: data.timeRange } : {}),
      ...(data.includeTrends
        ? {
            trends: {
              completionRate: filteredTasks.length > 0 ? totalCompletions / filteredTasks.length : 0,
              averageCompletionTime: 0,
              missedRate: filteredTasks.length > 0 ? overdue.length / filteredTasks.length : 0,
            },
          }
        : {}),
    };
  }
}
