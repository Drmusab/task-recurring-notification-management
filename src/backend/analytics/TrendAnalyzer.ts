import type { Task } from '../core/models/Task';
import type { ProductivityMetrics } from './ProductivityAnalyzer';

/**
 * Trend direction
 */
export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'volatile';

/**
 * Data point for trend analysis
 */
export interface TrendDataPoint {
    date: Date;
    value: number;
    label?: string;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
    direction: TrendDirection;
    slope: number; // Rate of change
    confidence: number; // 0-1
    dataPoints: TrendDataPoint[];
    summary: string;
    predictions: TrendDataPoint[]; // Future predictions
}

/**
 * Multi-metric trend report
 */
export interface TrendReport {
    completionRate: TrendAnalysis;
    tasksPerDay: TrendAnalysis;
    productivityScore: TrendAnalysis;
    focusScore: TrendAnalysis;
    consistencyScore: TrendAnalysis;
    period: {
        start: Date;
        end: Date;
    };
    overallTrend: 'improving' | 'declining' | 'stable';
    insights: string[];
}

/**
 * Configuration for trend analysis
 */
export interface TrendAnalyzerConfig {
    minDataPoints: number;
    smoothingFactor: number; // 0-1 for moving average
    confidenceThreshold: number;
    volatilityThreshold: number;
    predictionDays: number;
}

/**
 * Analyzes trends in task completion data over time
 */
export class TrendAnalyzer {
    private config: TrendAnalyzerConfig;

    constructor(config?: Partial<TrendAnalyzerConfig>) {
        this.config = {
            minDataPoints: 5,
            smoothingFactor: 0.3,
            confidenceThreshold: 0.7,
            volatilityThreshold: 0.4,
            predictionDays: 7,
            ...config,
        };
    }

    /**
     * Analyze completion rate trend over time
     */
    analyzeCompletionRateTrend(tasks: Task[], start: Date, end: Date): TrendAnalysis {
        const dataPoints = this.calculateDailyCompletionRates(tasks, start, end);
        return this.analyzeTrend(dataPoints, 'Completion Rate');
    }

    /**
     * Analyze tasks per day trend
     */
    analyzeTasksPerDayTrend(tasks: Task[], start: Date, end: Date): TrendAnalysis {
        const dataPoints = this.calculateDailyTaskCounts(tasks, start, end);
        return this.analyzeTrend(dataPoints, 'Tasks Per Day');
    }

    /**
     * Analyze productivity score trend
     */
    analyzeProductivityScoreTrend(
        metricsHistory: ProductivityMetrics[]
    ): TrendAnalysis {
        const dataPoints: TrendDataPoint[] = metricsHistory.map(metrics => ({
            date: metrics.periodStart,
            value: metrics.productivityScore,
        }));

        return this.analyzeTrend(dataPoints, 'Productivity Score');
    }

    /**
     * Generate comprehensive trend report
     */
    generateTrendReport(
        tasks: Task[],
        metricsHistory: ProductivityMetrics[],
        start: Date,
        end: Date
    ): TrendReport {
        const completionRate = this.analyzeCompletionRateTrend(tasks, start, end);
        const tasksPerDay = this.analyzeTasksPerDayTrend(tasks, start, end);
        const productivityScore = this.analyzeProductivityScoreTrend(metricsHistory);

        const focusScore = this.analyzeTrend(
            metricsHistory.map(m => ({ date: m.periodStart, value: m.focusScore })),
            'Focus Score'
        );

        const consistencyScore = this.analyzeTrend(
            metricsHistory.map(m => ({
                date: m.periodStart,
                value: m.consistencyScore,
            })),
            'Consistency Score'
        );

        const overallTrend = this.determineOverallTrend([
            completionRate,
            tasksPerDay,
            productivityScore,
        ]);

        const insights = this.generateTrendInsights({
            completionRate,
            tasksPerDay,
            productivityScore,
            focusScore,
            consistencyScore,
        });

        return {
            completionRate,
            tasksPerDay,
            productivityScore,
            focusScore,
            consistencyScore,
            period: { start, end },
            overallTrend,
            insights,
        };
    }

    /**
     * Detect anomalies in task completion patterns
     */
    detectAnomalies(
        tasks: Task[],
        start: Date,
        end: Date
    ): { date: Date; type: string; severity: 'low' | 'medium' | 'high'; description: string }[] {
        const anomalies: {
            date: Date;
            type: string;
            severity: 'low' | 'medium' | 'high';
            description: string;
        }[] = [];

        const dailyCompletions = this.calculateDailyTaskCounts(tasks, start, end);
        const values = dailyCompletions.map(dp => dp.value);
        const mean = this.calculateMean(values);
        const stdDev = this.calculateStdDev(values, mean);

        // Detect outliers (more than 2 standard deviations from mean)
        for (const point of dailyCompletions) {
            const zScore = Math.abs((point.value - mean) / stdDev);

            if (zScore > 2) {
                const severity: 'low' | 'medium' | 'high' =
                    zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low';

                anomalies.push({
                    date: point.date,
                    type: point.value > mean ? 'spike' : 'drop',
                    severity,
                    description:
                        point.value > mean
                            ? `Unusually high activity: ${point.value} tasks (${zScore.toFixed(1)}σ above average)`
                            : `Unusually low activity: ${point.value} tasks (${zScore.toFixed(1)}σ below average)`,
                });
            }
        }

        // Detect consecutive zero-completion days
        let zeroStreak = 0;
        for (const point of dailyCompletions) {
            if (point.value === 0) {
                zeroStreak++;
                if (zeroStreak >= 3) {
                    anomalies.push({
                        date: point.date,
                        type: 'inactivity',
                        severity: zeroStreak >= 7 ? 'high' : zeroStreak >= 5 ? 'medium' : 'low',
                        description: `${zeroStreak} consecutive days with no completions`,
                    });
                }
            } else {
                zeroStreak = 0;
            }
        }

        return anomalies;
    }

    /**
     * Predict future values based on trend
     */
    predictFutureTrend(
        dataPoints: TrendDataPoint[],
        daysToPredict: number = this.config.predictionDays
    ): TrendDataPoint[] {
        if (dataPoints.length < this.config.minDataPoints) {
            return [];
        }

        const smoothed = this.applyMovingAverage(dataPoints);
        const { slope, intercept } = this.calculateLinearRegression(smoothed);

        const predictions: TrendDataPoint[] = [];
        const lastPoint = dataPoints[dataPoints.length - 1];
        if (!lastPoint) return [];
        const lastDate = lastPoint.date;

        for (let i = 1; i <= daysToPredict; i++) {
            const futureDate = new Date(lastDate);
            futureDate.setDate(futureDate.getDate() + i);

            const x = dataPoints.length + i;
            const predictedValue = Math.max(0, slope * x + intercept);

            predictions.push({
                date: futureDate,
                value: predictedValue,
                label: 'predicted',
            });
        }

        return predictions;
    }

    // Private helper methods

    private analyzeTrend(dataPoints: TrendDataPoint[], metricName: string): TrendAnalysis {
        if (dataPoints.length < this.config.minDataPoints) {
            return {
                direction: 'stable',
                slope: 0,
                confidence: 0,
                dataPoints,
                summary: `Insufficient data for ${metricName} trend analysis`,
                predictions: [],
            };
        }

        const smoothed = this.applyMovingAverage(dataPoints);
        const { slope, rSquared } = this.calculateLinearRegression(smoothed);
        const volatility = this.calculateVolatility(smoothed);

        const direction = this.determineTrendDirection(slope, volatility);
        const confidence = this.calculateTrendConfidence(rSquared, volatility);
        const summary = this.generateTrendSummary(metricName, direction, slope, confidence);
        const predictions = this.predictFutureTrend(dataPoints);

        return {
            direction,
            slope,
            confidence,
            dataPoints: smoothed,
            summary,
            predictions,
        };
    }

    private calculateDailyCompletionRates(
        tasks: Task[],
        start: Date,
        end: Date
    ): TrendDataPoint[] {
        const dailyData = new Map<string, { completions: number; total: number }>();

        // Initialize all days
        const current = new Date(start);
        while (current <= end) {
            const key = current.toISOString().split('T')[0];
            if (key) {
                dailyData.set(key, { completions: 0, total: 0 });
            }
            current.setDate(current.getDate() + 1);
        }

        // Count completions and misses
        for (const task of tasks) {
            if (task.recentCompletions) {
                for (const completion of task.recentCompletions) {
                    const date = new Date(completion);
                    if (date >= start && date <= end) {
                        const key = date.toISOString().split('T')[0];
                        if (key) {
                            const data = dailyData.get(key);
                            if (data) {
                                data.completions++;
                                data.total++;
                            }
                        }
                    }
                }
            }

            // Count misses by checking missCount vs completionCount
            if (task.missCount && task.missCount > 0) {
                // Distribute misses across the period (estimation)
                // In a real implementation, you'd need actual miss timestamps
            }
        }

        // Convert to data points
        const dataPoints: TrendDataPoint[] = [];
        for (const [dateStr, data] of dailyData) {
            const rate = data.total > 0 ? data.completions / data.total : 0;
            dataPoints.push({
                date: new Date(dateStr),
                value: rate * 100, // Convert to percentage
            });
        }

        return dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    private calculateDailyTaskCounts(
        tasks: Task[],
        start: Date,
        end: Date
    ): TrendDataPoint[] {
        const dailyCounts = new Map<string, number>();

        // Initialize all days
        const current = new Date(start);
        while (current <= end) {
            const key = current.toISOString().split('T')[0];
            if (key) {
                dailyCounts.set(key, 0);
            }
            current.setDate(current.getDate() + 1);
        }

        // Count completions per day
        for (const task of tasks) {
            if (!task.recentCompletions) continue;

            for (const completion of task.recentCompletions) {
                const date = new Date(completion);
                if (date >= start && date <= end) {
                    const key = date.toISOString().split('T')[0];
                    if (key) {
                        dailyCounts.set(key, (dailyCounts.get(key) || 0) + 1);
                    }
                }
            }
        }

        // Convert to data points
        const dataPoints: TrendDataPoint[] = [];
        for (const [dateStr, count] of dailyCounts) {
            dataPoints.push({
                date: new Date(dateStr),
                value: count,
            });
        }

        return dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    private applyMovingAverage(dataPoints: TrendDataPoint[]): TrendDataPoint[] {
        if (dataPoints.length < 3) return dataPoints;

        const windowSize = Math.min(7, Math.floor(dataPoints.length / 3));
        const smoothed: TrendDataPoint[] = [];

        for (let i = 0; i < dataPoints.length; i++) {
            const point = dataPoints[i];
            if (!point) continue;
            
            const start = Math.max(0, i - Math.floor(windowSize / 2));
            const end = Math.min(dataPoints.length, i + Math.ceil(windowSize / 2));
            const window = dataPoints.slice(start, end);
            const average = window.reduce((sum, dp) => sum + dp.value, 0) / window.length;

            smoothed.push({
                date: point.date,
                value: average,
                label: point.label,
            });
        }

        return smoothed;
    }

    private calculateLinearRegression(dataPoints: TrendDataPoint[]): {
        slope: number;
        intercept: number;
        rSquared: number;
    } {
        const n = dataPoints.length;
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumX2 = 0;
        let sumY2 = 0;

        for (let i = 0; i < n; i++) {
            const point = dataPoints[i];
            if (!point) continue;
            
            const x = i;
            const y = point.value;
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
            sumY2 += y * y;
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate R-squared
        const yMean = sumY / n;
        let ssTotal = 0;
        let ssResidual = 0;

        for (let i = 0; i < n; i++) {
            const point = dataPoints[i];
            if (!point) continue;
            
            const y = point.value;
            const yPredicted = slope * i + intercept;
            ssTotal += Math.pow(y - yMean, 2);
            ssResidual += Math.pow(y - yPredicted, 2);
        }

        const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

        return { slope, intercept, rSquared: Math.max(0, Math.min(1, rSquared)) };
    }

    private calculateVolatility(dataPoints: TrendDataPoint[]): number {
        if (dataPoints.length < 2) return 0;

        const values = dataPoints.map(dp => dp.value);
        const mean = this.calculateMean(values);
        const stdDev = this.calculateStdDev(values, mean);

        // Coefficient of variation
        return mean > 0 ? stdDev / mean : 0;
    }

    private calculateMean(values: number[]): number {
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    private calculateStdDev(values: number[], mean: number): number {
        const variance =
            values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    private determineTrendDirection(slope: number, volatility: number): TrendDirection {
        // High volatility = volatile trend
        if (volatility > this.config.volatilityThreshold) {
            return 'volatile';
        }

        // Slope thresholds (adjust based on metric scale)
        const threshold = 0.01;

        if (slope > threshold) return 'increasing';
        if (slope < -threshold) return 'decreasing';
        return 'stable';
    }

    private calculateTrendConfidence(rSquared: number, volatility: number): number {
        // Confidence based on R-squared and inverse of volatility
        const rSquaredComponent = rSquared;
        const volatilityComponent = Math.max(0, 1 - volatility);

        return (rSquaredComponent * 0.7 + volatilityComponent * 0.3);
    }

    private generateTrendSummary(
        metricName: string,
        direction: TrendDirection,
        slope: number,
        confidence: number
    ): string {
        const confidenceLevel =
            confidence > 0.8 ? 'strong' : confidence > 0.6 ? 'moderate' : 'weak';

        switch (direction) {
            case 'increasing':
                return `${metricName} shows a ${confidenceLevel} increasing trend (${(slope * 100).toFixed(2)}% per day)`;
            case 'decreasing':
                return `${metricName} shows a ${confidenceLevel} decreasing trend (${(Math.abs(slope) * 100).toFixed(2)}% per day)`;
            case 'stable':
                return `${metricName} is ${confidenceLevel}ly stable`;
            case 'volatile':
                return `${metricName} shows high volatility with no clear trend`;
        }
    }

    private determineOverallTrend(
        trends: TrendAnalysis[]
    ): 'improving' | 'declining' | 'stable' {
        const improvingCount = trends.filter(
            t => t.direction === 'increasing' && t.confidence > this.config.confidenceThreshold
        ).length;
        const decliningCount = trends.filter(
            t => t.direction === 'decreasing' && t.confidence > this.config.confidenceThreshold
        ).length;

        if (improvingCount > decliningCount) return 'improving';
        if (decliningCount > improvingCount) return 'declining';
        return 'stable';
    }

    private generateTrendInsights(trends: {
        completionRate: TrendAnalysis;
        tasksPerDay: TrendAnalysis;
        productivityScore: TrendAnalysis;
        focusScore: TrendAnalysis;
        consistencyScore: TrendAnalysis;
    }): string[] {
        const insights: string[] = [];

        // Completion rate insights
        if (
            trends.completionRate.direction === 'increasing' &&
            trends.completionRate.confidence > 0.7
        ) {
            insights.push('📈 Completion rate is steadily improving');
        } else if (
            trends.completionRate.direction === 'decreasing' &&
            trends.completionRate.confidence > 0.7
        ) {
            insights.push('⚠️ Completion rate is declining - consider reviewing task load');
        }

        // Volume insights
        if (
            trends.tasksPerDay.direction === 'increasing' &&
            trends.tasksPerDay.confidence > 0.7
        ) {
            insights.push('💪 Taking on more tasks over time');
        }

        // Productivity score insights
        if (
            trends.productivityScore.direction === 'increasing' &&
            trends.productivityScore.confidence > 0.7
        ) {
            insights.push ('🎯 Overall productivity is trending upward');
        }

        // Focus and consistency
        if (
            trends.focusScore.direction === 'increasing' &&
            trends.consistencyScore.direction === 'increasing'
        ) {
            insights.push('✨ Both focus and consistency are improving - great work!');
        }

        // Volatility warnings
        if (trends.completionRate.direction === 'volatile') {
            insights.push('⚡ Completion patterns are irregular - consider a more consistent schedule');
        }

        return insights;
    }
}
