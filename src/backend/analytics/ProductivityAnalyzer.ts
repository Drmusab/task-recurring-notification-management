import type { Task } from '../core/models/Task';

/**
 * Productivity metrics for a specific time period
 */
export interface ProductivityMetrics {
    // Time period
    periodStart: Date;
    periodEnd: Date;
    durationDays: number;

    // Completion metrics
    totalCompletions: number;
    totalMisses: number;
    completionRate: number;
    averageCompletionsPerDay: number;

    // Streak metrics
    currentStreak: number;
    longestStreakInPeriod: number;
    streakDays: number[];

    // Time metrics
    averageCompletionTime: Date | null; // Time of day
    mostProductiveHour: number | null;
    mostProductiveDayOfWeek: number | null;

    // Task distribution
    completedByPriority: Map<string, number>;
    completedByTag: Map<string, number>;

    // Velocity
    tasksCompletedOnTime: number;
    tasksCompletedLate: number;
    averageDelayDays: number;

    // Focus metrics
    focusScore: number; // 0-100
    consistencyScore: number; // 0-100
    efficiencyScore: number; // 0-100

    // Overall
    productivityScore: number; // 0-100
}

/**
 * Comparison between two time periods
 */
export interface ProductivityComparison {
    current: ProductivityMetrics;
    previous: ProductivityMetrics;
    changes: {
        completionRate: number; // % change
        averageCompletionsPerDay: number;
        productivityScore: number;
        focusScore: number;
        consistencyScore: number;
    };
    insights: string[];
}

/**
 * Productivity insights for specific aspects
 */
export interface ProductivityInsights {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    trends: string[];
}

/**
 * Configuration for productivity analysis
 */
export interface ProductivityAnalyzerConfig {
    minTasksForInsights: number;
    comparisonPeriodDays: number;
    focusThresholdHours: number;
}

/**
 * Analyzes task completion data to provide productivity insights
 */
export class ProductivityAnalyzer {
    private config: ProductivityAnalyzerConfig;

    constructor(config?: Partial<ProductivityAnalyzerConfig>) {
        this.config = {
            minTasksForInsights: 5,
            comparisonPeriodDays: 30,
            focusThresholdHours: 4,
            ...config,
        };
    }

    /**
     * Analyze productivity for a specific time period
     */
    analyzeProductivity(
        tasks: Task[],
        startDate: Date,
        endDate: Date
    ): ProductivityMetrics {
        const periodTasks = this.filterTasksByPeriod(tasks, startDate, endDate);

        const completions = this.getCompletionsInPeriod(periodTasks, startDate, endDate);
        const misses = this.getMissesInPeriod(periodTasks, startDate, endDate);

        const durationDays = Math.ceil(
            (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
        );

        const totalCompletions = completions.length;
        const totalMisses = misses.length;
        const completionRate =
            totalCompletions + totalMisses > 0
                ? totalCompletions / (totalCompletions + totalMisses)
                : 0;

        const streakInfo = this.calculateStreaks(tasks, startDate, endDate);
        const timeMetrics = this.calculateTimeMetrics(completions);
        const distribution = this.calculateDistribution(
            periodTasks.filter(t => this.wasCompletedInPeriod(t, startDate, endDate))
        );

        const velocityMetrics = this.calculateVelocityMetrics(periodTasks, startDate, endDate);

        const focusScore = this.calculateFocusScore(completions, durationDays);
        const consistencyScore = this.calculateConsistencyScore(completions, durationDays);
        const efficiencyScore = this.calculateEfficiencyScore(
            totalCompletions,
            totalMisses,
            velocityMetrics.tasksCompletedOnTime
        );

        const productivityScore = this.calculateProductivityScore(
            focusScore,
            consistencyScore,
            efficiencyScore,
            completionRate
        );

        return {
            periodStart: startDate,
            periodEnd: endDate,
            durationDays,
            totalCompletions,
            totalMisses,
            completionRate,
            averageCompletionsPerDay: totalCompletions / durationDays,
            currentStreak: streakInfo.currentStreak,
            longestStreakInPeriod: streakInfo.longestStreak,
            streakDays: streakInfo.streakDays,
            averageCompletionTime: timeMetrics.averageTime,
            mostProductiveHour: timeMetrics.mostProductiveHour,
            mostProductiveDayOfWeek: timeMetrics.mostProductiveDayOfWeek,
            completedByPriority: distribution.byPriority,
            completedByTag: distribution.byTag,
            tasksCompletedOnTime: velocityMetrics.tasksCompletedOnTime,
            tasksCompletedLate: velocityMetrics.tasksCompletedLate,
            averageDelayDays: velocityMetrics.averageDelayDays,
            focusScore,
            consistencyScore,
            efficiencyScore,
            productivityScore,
        };
    }

    /**
     * Compare current period with previous period
     */
    compareProductivity(
        tasks: Task[],
        currentStart: Date,
        currentEnd: Date
    ): ProductivityComparison {
        const current = this.analyzeProductivity(tasks, currentStart, currentEnd);

        const periodDuration = currentEnd.getTime() - currentStart.getTime();
        const previousStart = new Date(currentStart.getTime() - periodDuration);
        const previousEnd = new Date(currentStart.getTime());

        const previous = this.analyzeProductivity(tasks, previousStart, previousEnd);

        const changes = {
            completionRate: this.calculatePercentChange(
                previous.completionRate,
                current.completionRate
            ),
            averageCompletionsPerDay: this.calculatePercentChange(
                previous.averageCompletionsPerDay,
                current.averageCompletionsPerDay
            ),
            productivityScore: this.calculatePercentChange(
                previous.productivityScore,
                current.productivityScore
            ),
            focusScore: this.calculatePercentChange(
                previous.focusScore,
                current.focusScore
            ),
            consistencyScore: this.calculatePercentChange(
                previous.consistencyScore,
                current.consistencyScore
            ),
        };

        const insights = this.generateComparisonInsights(current, previous, changes);

        return {
            current,
            previous,
            changes,
            insights,
        };
    }

    /**
     * Generate detailed productivity insights
     */
    generateInsights(tasks: Task[], startDate: Date, endDate: Date): ProductivityInsights {
        const metrics = this.analyzeProductivity(tasks, startDate, endDate);

        if (metrics.totalCompletions < this.config.minTasksForInsights) {
            return {
                strengths: [],
                weaknesses: [],
                recommendations: ['Complete more tasks to generate insights'],
                trends: [],
            };
        }

        const strengths = this.identifyStrengths(metrics);
        const weaknesses = this.identifyWeaknesses(metrics);
        const recommendations = this.generateRecommendations(metrics, weaknesses);
        const trends = this.identifyTrends(tasks, startDate, endDate);

        return {
            strengths,
            weaknesses,
            recommendations,
            trends,
        };
    }

    // Private helper methods

    private filterTasksByPeriod(tasks: Task[], start: Date, end: Date): Task[] {
        return tasks.filter(task => {
            const createdAt = new Date(task.createdAt);
            return createdAt <= end;
        });
    }

    private getCompletionsInPeriod(tasks: Task[], start: Date, end: Date): Date[] {
        const completions: Date[] = [];

        for (const task of tasks) {
            if (!task.recentCompletions) continue;

            for (const completion of task.recentCompletions) {
                const date = new Date(completion);
                if (date >= start && date <= end) {
                    completions.push(date);
                }
            }
        }

        return completions.sort((a, b) => a.getTime() - b.getTime());
    }

    private getMissesInPeriod(tasks: Task[], start: Date, end: Date): Date[] {
        const misses: Date[] = [];

        // Note: Task model doesn't have recentMisses array
        // Misses are tracked via missCount property
        // For historical miss dates, we'd need to add recentMisses to Task model
        
        return misses;
    }

    private wasCompletedInPeriod(task: Task, start: Date, end: Date): boolean {
        if (!task.recentCompletions) return false;

        return task.recentCompletions.some(completion => {
            const date = new Date(completion);
            return date >= start && date <= end;
        });
    }

    private calculateStreaks(tasks: Task[], start: Date, end: Date): {
        currentStreak: number;
        longestStreak: number;
        streakDays: number[];
    } {
        const allCompletions = this.getCompletionsInPeriod(tasks, start, end);
        if (allCompletions.length === 0) {
            return { currentStreak: 0, longestStreak: 0, streakDays: [] };
        }

        // Group by day
        const completionDays = new Set<string>();
        for (const completion of allCompletions) {
            const dayKey = completion.toISOString().split('T')[0];
            if (dayKey) {
                completionDays.add(dayKey);
            }
        }

        const sortedDays = Array.from(completionDays).sort();

        // Calculate streaks
        let currentStreak = 1;
        let longestStreak = 1;
        let streakDays: number[] = [1];

        for (let i = 1; i < sortedDays.length; i++) {
            const prevDay = sortedDays[i - 1];
            const currDay = sortedDays[i];
            if (!prevDay || !currDay) continue;
            
            const prevDate = new Date(prevDay);
            const currDate = new Date(currDay);
            const daysDiff = Math.round(
                (currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000)
            );

            if (daysDiff === 1) {
                currentStreak++;
                streakDays.push(currentStreak);
            } else {
                longestStreak = Math.max(longestStreak, currentStreak);
                currentStreak = 1;
                streakDays.push(1);
            }
        }

        longestStreak = Math.max(longestStreak, currentStreak);

        return { currentStreak, longestStreak, streakDays };
    }

    private calculateTimeMetrics(completions: Date[]): {
        averageTime: Date | null;
        mostProductiveHour: number | null;
        mostProductiveDayOfWeek: number | null;
    } {
        if (completions.length === 0) {
            return {
                averageTime: null,
                mostProductiveHour: null,
                mostProductiveDayOfWeek: null,
            };
        }

        // Average time of day
        const totalMinutes = completions.reduce((sum, date) => {
            return sum + date.getHours() * 60 + date.getMinutes();
        }, 0);
        const avgMinutes = totalMinutes / completions.length;
        const avgDate = new Date();
        avgDate.setHours(Math.floor(avgMinutes / 60));
        avgDate.setMinutes(Math.floor(avgMinutes % 60));

        // Most productive hour
        const hourCounts = new Map<number, number>();
        for (const date of completions) {
            const hour = date.getHours();
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        }
        const mostProductiveHour = Array.from(hourCounts.entries()).reduce(
            (max, [hour, count]) => (count > (max[1] || 0) ? [hour, count] : max),
            [0, 0] as [number, number]
        )[0];

        // Most productive day of week
        const dayOfWeekCounts = new Map<number, number>();
        for (const date of completions) {
            const day = date.getDay();
            dayOfWeekCounts.set(day, (dayOfWeekCounts.get(day) || 0) + 1);
        }
        const mostProductiveDayOfWeek = Array.from(dayOfWeekCounts.entries()).reduce(
            (max, [day, count]) => (count > (max[1] || 0) ? [day, count] : max),
            [0, 0] as [number, number]
        )[0];

        return {
            averageTime: avgDate,
            mostProductiveHour,
            mostProductiveDayOfWeek,
        };
    }

    private calculateDistribution(tasks: Task[]): {
        byPriority: Map<string, number>;
        byTag: Map<string, number>;
    } {
        const byPriority = new Map<string, number>();
        const byTag = new Map<string, number>();

        for (const task of tasks) {
            // Priority distribution
            const priority = task.priority || 'none';
            byPriority.set(priority, (byPriority.get(priority) || 0) + 1);

            // Tag distribution
            if (task.tags) {
                for (const tag of task.tags) {
                    byTag.set(tag, (byTag.get(tag) || 0) + 1);
                }
            }
        }

        return { byPriority, byTag };
    }

    private calculateVelocityMetrics(tasks: Task[], start: Date, end: Date): {
        tasksCompletedOnTime: number;
        tasksCompletedLate: number;
        averageDelayDays: number;
    } {
        let onTime = 0;
        let late = 0;
        let totalDelayDays = 0;

        for (const task of tasks) {
            if (!this.wasCompletedInPeriod(task, start, end)) continue;
            if (!task.dueAt || !task.doneAt) continue;

            const dueDate = new Date(task.dueAt);
            const doneDate = new Date(task.doneAt);
            const delayDays = Math.ceil(
                (doneDate.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)
            );

            if (delayDays <= 0) {
                onTime++;
            } else {
                late++;
                totalDelayDays += delayDays;
            }
        }

        return {
            tasksCompletedOnTime: onTime,
            tasksCompletedLate: late,
            averageDelayDays: late > 0 ? totalDelayDays / late : 0,
        };
    }

    private calculateFocusScore(completions: Date[], durationDays: number): number {
        if (completions.length === 0) return 0;

        // Focus score based on consistency of completion times
        const completionDays = new Set<string>();
        for (const completion of completions) {
            const day = completion.toISOString().split('T')[0];
            if (day) {
                completionDays.add(day);
            }
        }

        const activeDays = completionDays.size;
        const coverageRatio = activeDays / durationDays;

        return Math.min(100, coverageRatio * 100);
    }

    private calculateConsistencyScore(completions: Date[], durationDays: number): number {
        if (completions.length < 2) return 0;

        // Calculate variance in daily completions
        const dailyCounts = new Map<string, number>();
        for (const completion of completions) {
            const day = completion.toISOString().split('T')[0];
            if (day) {
                dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
            }
        }

        const counts = Array.from(dailyCounts.values());
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance =
            counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
        const stdDev = Math.sqrt(variance);

        // Lower variance = higher consistency
        const consistencyRatio = Math.max(0, 1 - stdDev / (mean + 1));

        return Math.min(100, consistencyRatio * 100);
    }

    private calculateEfficiencyScore(
        completions: number,
        misses: number,
        onTime: number
    ): number {
        if (completions === 0) return 0;

        const completionRate = completions / (completions + misses);
        const onTimeRate = onTime / completions;

        return Math.min(100, (completionRate * 0.6 + onTimeRate * 0.4) * 100);
    }

    private calculateProductivityScore(
        focus: number,
        consistency: number,
        efficiency: number,
        completionRate: number
    ): number {
        return Math.min(
            100,
            focus * 0.25 + consistency * 0.25 + efficiency * 0.3 + completionRate * 100 * 0.2
        );
    }

    private calculatePercentChange(previous: number, current: number): number {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    }

    private generateComparisonInsights(
        current: ProductivityMetrics,
        previous: ProductivityMetrics,
        changes: ProductivityComparison['changes']
    ): string[] {
        const insights: string[] = [];

        if (changes.productivityScore > 10) {
            insights.push(
                `📈 Great progress! Productivity increased by ${changes.productivityScore.toFixed(1)}%`
            );
        } else if (changes.productivityScore < -10) {
            insights.push(
                `📉 Productivity decreased by ${Math.abs(changes.productivityScore).toFixed(1)}%`
            );
        }

        if (changes.completionRate > 10) {
            insights.push(
                `✅ Completion rate improved by ${changes.completionRate.toFixed(1)}%`
            );
        }

        if (current.currentStreak > previous.longestStreakInPeriod) {
            insights.push(`🔥 New streak record: ${current.currentStreak} days!`);
        }

        if (changes.focusScore > 15) {
            insights.push('🎯 Focus has significantly improved');
        }

        return insights;
    }

    private identifyStrengths(metrics: ProductivityMetrics): string[] {
        const strengths: string[] = [];

        if (metrics.completionRate >= 0.8) {
            strengths.push(
                `Excellent completion rate: ${(metrics.completionRate * 100).toFixed(1)}%`
            );
        }

        if (metrics.currentStreak >= 7) {
            strengths.push(`Strong ${metrics.currentStreak}-day streak`);
        }

        if (metrics.focusScore >= 75) {
            strengths.push('Highly focused work pattern');
        }

        if (metrics.consistencyScore >= 75) {
            strengths.push('Very consistent task completion');
        }

        if (metrics.tasksCompletedOnTime / (metrics.totalCompletions || 1) >= 0.8) {
            strengths.push('Great time management - most tasks completed on time');
        }

        return strengths;
    }

    private identifyWeaknesses(metrics: ProductivityMetrics): string[] {
        const weaknesses: string[] = [];

        if (metrics.completionRate < 0.6) {
            weaknesses.push(
                `Low completion rate: ${(metrics.completionRate * 100).toFixed(1)}%`
            );
        }

        if (metrics.currentStreak === 0 && metrics.totalCompletions > 0) {
            weaknesses.push('Streak has been broken');
        }

        if (metrics.focusScore < 50) {
            weaknesses.push('Limited focus - tasks spread across too many days');
        }

        if (metrics.consistencyScore < 50) {
            weaknesses.push('Inconsistent task completion pattern');
        }

        if (metrics.tasksCompletedLate / (metrics.totalCompletions || 1) > 0.5) {
            weaknesses.push('Many tasks completed late');
        }

        return weaknesses;
    }

    private generateRecommendations(
        metrics: ProductivityMetrics,
        weaknesses: string[]
    ): string[] {
        const recommendations: string[] = [];

        if (weaknesses.some(w => w.includes('completion rate'))) {
            recommendations.push('Review and adjust recurring task schedules');
            recommendations.push('Consider reducing task load');
        }

        if (weaknesses.some(w => w.includes('focus'))) {
            recommendations.push('Try time-blocking to consolidate task work');
            recommendations.push('Focus on completing tasks on fewer, more productive days');
        }

        if (weaknesses.some(w => w.includes('late'))) {
            recommendations.push('Set more realistic due dates');
            recommendations.push('Enable notifications to stay on track');
        }

        if (metrics.mostProductiveHour !== null) {
            recommendations.push(
                `Schedule important tasks around ${metrics.mostProductiveHour}:00 (your most productive hour)`
            );
        }

        return recommendations;
    }

    private identifyTrends(tasks: Task[], start: Date, end: Date): string[] {
        const trends: string[] = [];

        // Analyze weekly progression
        const weeklyMetrics = this.getWeeklyMetrics(tasks, start, end);

        if (weeklyMetrics.length >= 2) {
            const firstWeek = weeklyMetrics[0];
            const lastWeek = weeklyMetrics[weeklyMetrics.length - 1];

            if (firstWeek && lastWeek) {
                if (lastWeek.completions > firstWeek.completions * 1.2) {
                    trends.push('📈 Increasing productivity trend week-over-week');
                } else if (lastWeek.completions < firstWeek.completions * 0.8) {
                    trends.push('📉 Decreasing productivity trend week-over-week');
                }
            }
        }

        return trends;
    }

    private getWeeklyMetrics(
        tasks: Task[],
        start: Date,
        end: Date
    ): { weekStart: Date; completions: number }[] {
        const weeks: { weekStart: Date; completions: number }[] = [];
        let currentWeekStart = new Date(start);

        while (currentWeekStart <= end) {
            const weekEnd = new Date(currentWeekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            const completions = this.getCompletionsInPeriod(
                tasks,
                currentWeekStart,
                weekEnd > end ? end : weekEnd
            );

            weeks.push({
                weekStart: new Date(currentWeekStart),
                completions: completions.length,
            });

            currentWeekStart = weekEnd;
        }

        return weeks;
    }
}
