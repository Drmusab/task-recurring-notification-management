/**
 * Completion Predictor
 * Predicts task completion likelihood and timing based on historical patterns
 */

import type { Task } from '../core/models/Task';
import { PatternAnalyzer, type CompletionStats } from './PatternAnalyzer';

/**
 * Completion prediction with confidence and reasoning
 */
export interface CompletionPrediction {
    /** Predicted completion date/time */
    predictedDate: Date;
    
    /** Confidence score (0-1) */
    confidence: number;
    
    /** Likelihood of on-time completion (0-1) */
    onTimeLikelihood: number;
    
    /** Predicted completion window (earliest - latest) */
    window: {
        earliest: Date;
        latest: Date;
    };
    
    /** Reasoning for prediction */
    reasoning: string;
    
    /** Risk factors */
    riskFactors: string[];
    
    /** Positive factors */
    positiveFactors: string[];
}

/**
 * Completion Predictor Configuration
 */
export interface CompletionPredictorConfig {
    /** Minimum completions for reliable prediction */
    minCompletions: number;
    
    /** Weight of historical completion rate (0-1) */
    completionRateWeight: number;
    
    /** Weight of current streak (0-1) */
    streakWeight: number;
    
    /** Weight of time of day pattern (0-1) */
    timeOfDayWeight: number;
    
    /** Prediction window size (hours) */
    windowSizeHours: number;
}

const DEFAULT_CONFIG: CompletionPredictorConfig = {
    minCompletions: 3,
    completionRateWeight: 0.4,
    streakWeight: 0.3,
    timeOfDayWeight: 0.3,
    windowSizeHours: 24,
};

/**
 * Completion Predictor
 * Uses ML-inspired heuristics to predict task completion
 */
export class CompletionPredictor {
    private analyzer: PatternAnalyzer;
    private config: CompletionPredictorConfig;
    
    constructor(
        analyzer?: PatternAnalyzer,
        config: Partial<CompletionPredictorConfig> = {}
    ) {
        this.analyzer = analyzer || new PatternAnalyzer();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    
    /**
     * Predict when task will be completed
     */
    predict(task: Task): CompletionPrediction | null {
        if ((task.completionCount || 0) < this.config.minCompletions) {
            return null;
        }
        
        const stats = this.analyzer.calculateStats(task);
        const pattern = this.analyzer.analyzePattern(task);
        
        // Base prediction on due date
        const dueDate = task.dueAt ? new Date(task.dueAt) : new Date();
        
        // Adjust based on historical completion time
        const predictedDate = this.adjustForHistory(dueDate, stats, pattern);
        
        // Calculate confidence
        const confidence = this.calculateConfidence(stats, pattern);
        
        // Calculate on-time likelihood
        const onTimeLikelihood = this.calculateOnTimeLikelihood(stats, task);
        
        // Calculate prediction window
        const window = this.calculateWindow(predictedDate, stats);
        
        // Identify risk and positive factors
        const riskFactors = this.identifyRiskFactors(task, stats);
        const positiveFactors = this.identifyPositiveFactors(task, stats);
        
        // Generate reasoning
        const reasoning = this.generateReasoning(stats, pattern, confidence);
        
        return {
            predictedDate,
            confidence,
            onTimeLikelihood,
            window,
            reasoning,
            riskFactors,
            positiveFactors,
        };
    }
    
    /**
     * Predict completion for multiple tasks and sort by urgency
     */
    predictBatch(tasks: Task[]): Map<string, CompletionPrediction> {
        const predictions = new Map<string, CompletionPrediction>();
        
        tasks.forEach(task => {
            const prediction = this.predict(task);
            if (prediction) {
                predictions.set(task.id, prediction);
            }
        });
        
        return predictions;
    }
    
    /**
     * Adjust prediction date based on historical patterns
     */
    private adjustForHistory(
        baseDate: Date,
        stats: CompletionStats,
        pattern: any
    ): Date {
        let adjusted = new Date(baseDate);
        
        // If user typically completes early, adjust earlier
        if (stats.completionRate > 0.8) {
            // High completion rate suggests early completion
            adjusted = new Date(adjusted.getTime() - 2 * 60 * 60 * 1000); // 2 hours earlier
        }
        
        // Adjust to most common hour of completion
        if (stats.mostCommonHour !== null) {
            adjusted.setHours(stats.mostCommonHour);
        }
        
        // Adjust to most common day of week if weekly pattern
        if (pattern?.type === 'weekly' && pattern.dayOfWeek?.length) {
            const targetDay = pattern.dayOfWeek[0];
            const currentDay = adjusted.getDay();
            const dayDiff = targetDay - currentDay;
            
            if (dayDiff !== 0) {
                adjusted = new Date(adjusted.getTime() + dayDiff * 24 * 60 * 60 * 1000);
            }
        }
        
        return adjusted;
    }
    
    /**
     * Calculate prediction confidence
     */
    private calculateConfidence(stats: CompletionStats, pattern: any): number {
        let confidence = 0;
        
        // Factor 1: Completion rate
        confidence += stats.completionRate * this.config.completionRateWeight;
        
        // Factor 2: Current streak
        const streakScore = Math.min(stats.currentStreak / 10, 1); // Cap at 10 streak
        confidence += streakScore * this.config.streakWeight;
        
        // Factor 3: Pattern consistency
        const patternScore = pattern?.confidence || 0.5;
        confidence += patternScore * 0.3;
        
        // Normalize to 0-1
        return Math.min(Math.max(confidence, 0), 1);
    }
    
    /**
     * Calculate likelihood of on-time completion
     */
    private calculateOnTimeLikelihood(stats: CompletionStats, task: Task): number {
        let likelihood = stats.completionRate;
        
        // Boost for current streak
        if (stats.currentStreak >= 3) {
            likelihood = Math.min(likelihood + 0.1, 1);
        }
        
        // Reduce for recent misses
        const missCount = task.missCount || 0;
        if (missCount > 0) {
            const recentMissRate = missCount / Math.max(task.completionCount || 1, 1);
            likelihood = likelihood * (1 - recentMissRate * 0.5);
        }
        
        return Math.min(Math.max(likelihood, 0), 1);
    }
    
    /**
     * Calculate prediction window (earliest - latest)
     */
    private calculateWindow(
        predictedDate: Date,
        stats: CompletionStats
    ): { earliest: Date; latest: Date } {
        const windowMs = this.config.windowSizeHours * 60 * 60 * 1000;
        
        // Use interval standard deviation to size window
        const stdDevHours = stats.intervalStdDev / (60 * 60 * 1000);
        const adaptiveWindowMs = Math.max(
            windowMs,
            stdDevHours * 60 * 60 * 1000
        );
        
        const earliest = new Date(predictedDate.getTime() - adaptiveWindowMs / 2);
        const latest = new Date(predictedDate.getTime() + adaptiveWindowMs / 2);
        
        return { earliest, latest };
    }
    
    /**
     * Identify risk factors for completion
     */
    private identifyRiskFactors(task: Task, stats: CompletionStats): string[] {
        const risks: string[] = [];
        
        if (stats.completionRate < 0.5) {
            risks.push('Low historical completion rate (<50%)');
        }
        
        if (stats.currentStreak === 0) {
            risks.push('No current streak - may be harder to start');
        }
        
        if ((task.missCount || 0) > (task.completionCount || 0)) {
            risks.push('More misses than completions');
        }
        
        if (task.dependsOn && task.dependsOn.length > 0) {
            risks.push(`Depends on ${task.dependsOn.length} other task(s)`);
        }
        
        const now = new Date();
        const dueDate = task.dueAt ? new Date(task.dueAt) : null;
        if (dueDate && dueDate.getTime() < now.getTime()) {
            const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
            risks.push(`Already ${daysOverdue} day(s) overdue`);
        }
        
        return risks;
    }
    
    /**
     * Identify positive factors for completion
     */
    private identifyPositiveFactors(task: Task, stats: CompletionStats): string[] {
        const positives: string[] = [];
        
        if (stats.completionRate >= 0.8) {
            positives.push(`High completion rate (${Math.round(stats.completionRate * 100)}%)`);
        }
        
        if (stats.currentStreak >= 3) {
            positives.push(`Strong current streak (${stats.currentStreak} completions)`);
        }
        
        if (stats.longestStreak >= 7) {
            positives.push(`Best streak: ${stats.longestStreak} completions`);
        }
        
        if (task.priority && ['HIGH', 'URGENT'].includes(task.priority)) {
            positives.push('High priority - likely to be addressed');
        }
        
        const now = new Date();
        const dueDate = task.dueAt ? new Date(task.dueAt) : null;
        if (dueDate && dueDate.getTime() > now.getTime()) {
            const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            if (daysUntilDue >= 2) {
                positives.push(`${daysUntilDue} day(s) until due - adequate time`);
            }
        }
        
        return positives;
    }
    
    /**
     * Generate human-readable reasoning
     */
    private generateReasoning(
        stats: CompletionStats,
        pattern: any,
        confidence: number
    ): string {
        const parts: string[] = [];
        
        if (stats.totalCompletions > 0) {
            parts.push(`Based on ${stats.totalCompletions} historical completions`);
        }
        
        if (stats.completionRate >= 0.7) {
            parts.push(`typically completes on time (${Math.round(stats.completionRate * 100)}% rate)`);
        } else if (stats.completionRate < 0.5) {
            parts.push(`historically challenging (${Math.round(stats.completionRate * 100)}% completion rate)`);
        }
        
        if (pattern && pattern.type !== 'irregular') {
            parts.push(`follows ${pattern.type} pattern`);
        }
        
        if (stats.mostCommonHour !== null) {
            const hour = stats.mostCommonHour;
            const timeStr = hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
            parts.push(`usually completed around ${timeStr}`);
        }
        
        if (confidence >= 0.8) {
            parts.push('high confidence prediction');
        } else if (confidence < 0.5) {
            parts.push('low confidence - limited data');
        }
        
        return parts.join(', ') + '.';
    }
    
    /**
     * Calculate overall task health score (0-100)
     */
    calculateHealthScore(task: Task): number {
        const stats = this.analyzer.calculateStats(task);
        
        let score = 0;
        
        // Completion rate (40 points)
        score += stats.completionRate * 40;
        
        // Current streak (30 points)
        score += Math.min(stats.currentStreak / 10, 1) * 30;
        
        // Miss rate penalty (-20 points)
        const missRate = (task.missCount || 0) / Math.max((task.completionCount || 0), 1);
        score -= missRate * 20;
        
        // Consistency bonus (20 points)
        const pattern = this.analyzer.analyzePattern(task);
        if (pattern && pattern.type !== 'irregular') {
            score += pattern.confidence * 20;
        }
        
        // Normalize to 0-100
        return Math.min(Math.max(Math.round(score), 0), 100);
    }
}
