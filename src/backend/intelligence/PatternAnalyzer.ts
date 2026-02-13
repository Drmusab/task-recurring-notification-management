/**
 * Pattern Analysis Engine
 * Analyzes task completion patterns to enable smart suggestions and predictions
 * 
 * Uses heuristic-based pattern recognition rather than heavy ML models
 * for lightweight, fast, and interpretable results.
 */

import type { Task } from '../core/models/Task';

/**
 * Detected pattern in task completion behavior
 */
export interface CompletionPattern {
    /** Pattern type */
    type: 'daily' | 'weekly' | 'monthly' | 'custom' | 'irregular';
    
    /** Confidence score (0-1) */
    confidence: number;
    
    /** Detected interval in milliseconds */
    intervalMs?: number;
    
    /** Day of week pattern (0-6, Sunday=0) for weekly patterns */
    dayOfWeek?: number[];
    
    /** Day of month pattern (1-31) for monthly patterns */
    dayOfMonth?: number[];
    
    /** Time of day pattern (hour 0-23) */
    timeOfDay?: number[];
    
    /** Human-readable description */
    description: string;
    
    /** Number of data points used */
    sampleSize: number;
}

/**
 * Task completion statistics
 */
export interface CompletionStats {
    /** Total completions */
    totalCompletions: number;
    
    /** Average time to complete (ms) */
    avgTimeToComplete: number;
    
    /** Completion rate (0-1) */
    completionRate: number;
    
    /** Average interval between completions (ms) */
    avgInterval: number;
    
    /** Standard deviation of intervals (ms) */
    intervalStdDev: number;
    
    /** Most common completion hour (0-23) */
    mostCommonHour: number;
    
    /** Most common day of week (0-6) */
    mostCommonDayOfWeek: number;
    
    /** Streak information */
    currentStreak: number;
    longestStreak: number;
}

/**
 * Pattern Analysis Configuration
 */
export interface PatternAnalyzerConfig {
    /** Minimum completions required to detect pattern */
    minSampleSize: number;
    
    /** Minimum confidence threshold (0-1) */
    minConfidence: number;
    
    /** Maximum interval variance to consider regular (0-1) */
    maxVariance: number;
    
    /** Time window for pattern analysis (ms) */
    analysisWindowMs: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: PatternAnalyzerConfig = {
    minSampleSize: 3,
    minConfidence: 0.6,
    maxVariance: 0.3,
    analysisWindowMs: 90 * 24 * 60 * 60 * 1000, // 90 days
};

/**
 * Pattern Analyzer
 * Detects patterns in task completion behavior using statistical analysis
 */
export class PatternAnalyzer {
    private config: PatternAnalyzerConfig;
    
    constructor(config: Partial<PatternAnalyzerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    
    /**
     * Analyze task completion pattern
     */
    analyzePattern(task: Task): CompletionPattern | null {
        const completions = this.getRecentCompletions(task);
        
        if (completions.length < this.config.minSampleSize) {
            return null;
        }
        
        // Try to detect different pattern types
        const dailyPattern = this.detectDailyPattern(completions);
        if (dailyPattern && dailyPattern.confidence >= this.config.minConfidence) {
            return dailyPattern;
        }
        
        const weeklyPattern = this.detectWeeklyPattern(completions);
        if (weeklyPattern && weeklyPattern.confidence >= this.config.minConfidence) {
            return weeklyPattern;
        }
        
        const monthlyPattern = this.detectMonthlyPattern(completions);
        if (monthlyPattern && monthlyPattern.confidence >= this.config.minConfidence) {
            return monthlyPattern;
        }
        
        const customPattern = this.detectCustomPattern(completions);
        if (customPattern && customPattern.confidence >= this.config.minConfidence) {
            return customPattern;
        }
        
        // No regular pattern detected
        return {
            type: 'irregular',
            confidence: 0.5,
            description: 'No regular pattern detected',
            sampleSize: completions.length,
        };
    }
    
    /**
     * Calculate completion statistics
     */
    calculateStats(task: Task): CompletionStats {
        const completions = this.getRecentCompletions(task);
        const intervals = this.calculateIntervals(completions);
        
        return {
            totalCompletions: task.completionCount || 0,
            avgTimeToComplete: this.calculateAvgTimeToComplete(task),
            completionRate: this.calculateCompletionRate(task),
            avgInterval: this.mean(intervals),
            intervalStdDev: this.standardDeviation(intervals),
            mostCommonHour: this.findMostCommonHour(completions),
            mostCommonDayOfWeek: this.findMostCommonDayOfWeek(completions),
            currentStreak: task.currentStreak || 0,
            longestStreak: task.bestStreak || 0,
        };
    }
    
    /**
     * Detect daily pattern (every 1-3 days)
     */
    private detectDailyPattern(completions: Date[]): CompletionPattern | null {
        const intervals = this.calculateIntervals(completions);
        const avgInterval = this.mean(intervals);
        const oneDayMs = 24 * 60 * 60 * 1000;
        
        // Check if average is close to 1, 2, or 3 days
        for (let days = 1; days <= 3; days++) {
            const targetMs = days * oneDayMs;
            const variance = this.calculateVariance(intervals, targetMs);
            
            if (variance <= this.config.maxVariance) {
                const confidence = 1 - variance;
                const timeOfDay = this.extractTimeOfDay(completions);
                
                return {
                    type: 'daily',
                    confidence,
                    intervalMs: targetMs,
                    timeOfDay,
                    description: days === 1 
                        ? 'Completed daily' 
                        : `Completed every ${days} days`,
                    sampleSize: completions.length,
                };
            }
        }
        
        return null;
    }
    
    /**
     * Detect weekly pattern (specific days of week)
     */
    private detectWeeklyPattern(completions: Date[]): CompletionPattern | null {
        if (completions.length < 4) return null;
        
        const daysOfWeek = completions.map(d => d.getDay());
        const dayFrequency = this.countFrequencies(daysOfWeek);
        
        // Find dominant day(s)
        const maxFreq = Math.max(...Array.from(dayFrequency.values()));
        const dominantDays = Array.from(dayFrequency.entries())
            .filter(([_, freq]) => freq >= maxFreq * 0.7)
            .map(([day, _]) => day);
        
        if (dominantDays.length === 0) return null;
        
        // Calculate confidence based on consistency
        const confidence = maxFreq / completions.length;
        
        if (confidence < 0.6) return null;
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const firstDay = dominantDays[0];
        const description = dominantDays.length === 1 && firstDay !== undefined
            ? `Completed every ${dayNames[firstDay]}`
            : `Completed on ${dominantDays.map(d => dayNames[d] || 'Unknown').join(', ')}`;
        
        return {
            type: 'weekly',
            confidence,
            dayOfWeek: dominantDays,
            intervalMs: 7 * 24 * 60 * 60 * 1000,
            timeOfDay: this.extractTimeOfDay(completions),
            description,
            sampleSize: completions.length,
        };
    }
    
    /**
     * Detect monthly pattern (specific days of month)
     */
    private detectMonthlyPattern(completions: Date[]): CompletionPattern | null {
        if (completions.length < 3) return null;
        
        const daysOfMonth = completions.map(d => d.getDate());
        const dayFrequency = this.countFrequencies(daysOfMonth);
        
        const maxFreq = Math.max(...Array.from(dayFrequency.values()));
        const dominantDays = Array.from(dayFrequency.entries())
            .filter(([_, freq]) => freq >= maxFreq * 0.7)
            .map(([day, _]) => day);
        
        if (dominantDays.length === 0) return null;
        
        const confidence = maxFreq / completions.length;
        
        if (confidence < 0.6) return null;
        
        const description = dominantDays.length === 1
            ? `Completed on day ${dominantDays[0]} of the month`
            : `Completed on days ${dominantDays.join(', ')} of the month`;
        
        return {
            type: 'monthly',
            confidence,
            dayOfMonth: dominantDays,
            intervalMs: 30 * 24 * 60 * 60 * 1000, // Approximate
            timeOfDay: this.extractTimeOfDay(completions),
            description,
            sampleSize: completions.length,
        };
    }
    
    /**
     * Detect custom interval pattern
     */
    private detectCustomPattern(completions: Date[]): CompletionPattern | null {
        const intervals = this.calculateIntervals(completions);
        if (intervals.length < 2) return null;
        
        const avgInterval = this.mean(intervals);
        const variance = this.calculateVariance(intervals, avgInterval);
        
        if (variance > this.config.maxVariance) return null;
        
        const confidence = 1 - variance;
        const days = Math.round(avgInterval / (24 * 60 * 60 * 1000));
        
        return {
            type: 'custom',
            confidence,
            intervalMs: avgInterval,
            description: `Completed every ${days} days on average`,
            sampleSize: completions.length,
        };
    }
    
    /**
     * Get recent completions within analysis window
     */
    private getRecentCompletions(task: Task): Date[] {
        if (!task.recentCompletions || task.recentCompletions.length === 0) {
            return [];
        }
        
        const now = Date.now();
        const cutoff = now - this.config.analysisWindowMs;
        
        return task.recentCompletions
            .map(ts => new Date(ts))
            .filter(date => date.getTime() >= cutoff)
            .sort((a, b) => a.getTime() - b.getTime());
    }
    
    /**
     * Calculate intervals between completions
     */
    private calculateIntervals(completions: Date[]): number[] {
        const intervals: number[] = [];
        
        for (let i = 1; i < completions.length; i++) {
            const current = completions[i];
            const previous = completions[i - 1];
            
            if (current && previous) {
                const interval = current.getTime() - previous.getTime();
                intervals.push(interval);
            }
        }
        
        return intervals;
    }
    
    /**
     * Calculate variance of intervals relative to target
     */
    private calculateVariance(intervals: number[], target: number): number {
        if (intervals.length === 0) return 1;
        
        const deviations = intervals.map(interval => Math.abs(interval - target) / target);
        return this.mean(deviations);
    }
    
    /**
     * Extract time of day pattern (hours)
     */
    private extractTimeOfDay(completions: Date[]): number[] {
        const hours = completions.map(d => d.getHours());
        const hourFrequency = this.countFrequencies(hours);
        
        const maxFreq = Math.max(...Array.from(hourFrequency.values()));
        return Array.from(hourFrequency.entries())
            .filter(([_, freq]) => freq >= maxFreq * 0.7)
            .map(([hour, _]) => hour);
    }
    
    /**
     * Find most common hour
     */
    private findMostCommonHour(completions: Date[]): number {
        if (completions.length === 0) return 9; // Default to 9 AM
        
        const hours = completions.map(d => d.getHours());
        const frequency = this.countFrequencies(hours);
        
        let maxFreq = 0;
        let mostCommon = 9;
        
        frequency.forEach((freq, hour) => {
            if (freq > maxFreq) {
                maxFreq = freq;
                mostCommon = hour;
            }
        });
        
        return mostCommon;
    }
    
    /**
     * Find most common day of week
     */
    private findMostCommonDayOfWeek(completions: Date[]): number {
        if (completions.length === 0) return 1; // Default to Monday
        
        const days = completions.map(d => d.getDay());
        const frequency = this.countFrequencies(days);
        
        let maxFreq = 0;
        let mostCommon = 1;
        
        frequency.forEach((freq, day) => {
            if (freq > maxFreq) {
                maxFreq = freq;
                mostCommon = day;
            }
        });
        
        return mostCommon;
    }
    
    /**
     * Calculate average time to complete
     */
    private calculateAvgTimeToComplete(task: Task): number {
        // Placeholder - would need creation → completion time tracking
        return 0;
    }
    
    /**
     * Calculate completion rate (completed vs missed)
     */
    private calculateCompletionRate(task: Task): number {
        const completed = task.completionCount || 0;
        const missed = task.missCount || 0;
        const total = completed + missed;
        
        return total > 0 ? completed / total : 0;
    }
    
    /**
     * Count frequency of values
     */
    private countFrequencies<T>(values: T[]): Map<T, number> {
        const frequency = new Map<T, number>();
        
        values.forEach(value => {
            frequency.set(value, (frequency.get(value) || 0) + 1);
        });
        
        return frequency;
    }
    
    /**
     * Calculate mean of numbers
     */
    private mean(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    }
    
    /**
     * Calculate standard deviation
     */
    private standardDeviation(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        
        const avg = this.mean(numbers);
        const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2));
        const variance = this.mean(squaredDiffs);
        
        return Math.sqrt(variance);
    }
}
