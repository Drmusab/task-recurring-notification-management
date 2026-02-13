/**
 * Smart Recurrence Suggester
 * Suggests recurrence rules based on detected task completion patterns
 */

import type { Task } from '../core/models/Task';
import { PatternAnalyzer, type CompletionPattern } from './PatternAnalyzer';

/**
 * Recurrence suggestion with confidence and reasoning
 */
export interface RecurrenceSuggestion {
    /** Suggested RRule string */
    rrule: string;
    
    /** Human-readable description */
    description: string;
    
    /** Confidence score (0-1) */
    confidence: number;
    
    /** Reasoning for suggestion */
    reasoning: string;
    
    /** Detected pattern used for suggestion */
    pattern: CompletionPattern;
    
    /** Alternative suggestions */
    alternatives?: RecurrenceSuggestion[];
}

/**
 * Smart Recurrence Suggester Configuration
 */
export interface SmartRecurrenceSuggesterConfig {
    /** Minimum completions to generate suggestions */
    minCompletions: number;
    
    /** Minimum confidence for primary suggestion */
    minConfidence: number;
    
    /** Number of alternative suggestions */
    maxAlternatives: number;
}

const DEFAULT_CONFIG: SmartRecurrenceSuggesterConfig = {
    minCompletions: 3,
    minConfidence: 0.7,
    maxAlternatives: 2,
};

/**
 * Smart Recurrence Suggester
 * Analyzes task history and suggests optimal recurrence rules
 */
export class SmartRecurrenceSuggester {
    private analyzer: PatternAnalyzer;
    private config: SmartRecurrenceSuggesterConfig;
    
    constructor(
        analyzer?: PatternAnalyzer,
        config: Partial<SmartRecurrenceSuggesterConfig> = {}
    ) {
        this.analyzer = analyzer || new PatternAnalyzer();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    
    /**
     * Suggest recurrence rule for task based on completion history
     */
    suggestRecurrence(task: Task): RecurrenceSuggestion | null {
        // Check if task has enough history
        if ((task.completionCount || 0) < this.config.minCompletions) {
            return null;
        }
        
        // Analyze pattern
        const pattern = this.analyzer.analyzePattern(task);
        if (!pattern || pattern.confidence < this.config.minConfidence) {
            return null;
        }
        
        // Generate suggestion based on pattern type
        const suggestion = this.generateSuggestionFromPattern(pattern, task);
        if (!suggestion) {
            return null;
        }
        
        // Generate alternatives
        suggestion.alternatives = this.generateAlternatives(pattern, task);
        
        return suggestion;
    }
    
    /**
     * Generate multiple suggestions for user to choose from
     */
    suggestMultiple(task: Task): RecurrenceSuggestion[] {
        const primary = this.suggestRecurrence(task);
        if (!primary) {
            return this.generateFallbackSuggestions(task);
        }
        
        const suggestions = [primary];
        if (primary.alternatives) {
            suggestions.push(...primary.alternatives);
        }
        
        return suggestions;
    }
    
    /**
     * Generate suggestion from detected pattern
     */
    private generateSuggestionFromPattern(
        pattern: CompletionPattern,
        task: Task
    ): RecurrenceSuggestion | null {
        switch (pattern.type) {
            case 'daily':
                return this.generateDailySuggestion(pattern, task);
            
            case 'weekly':
                return this.generateWeeklySuggestion(pattern, task);
            
            case 'monthly':
                return this.generateMonthlySuggestion(pattern, task);
            
            case 'custom':
                return this.generateCustomSuggestion(pattern, task);
            
            default:
                return null;
        }
    }
    
    /**
     * Generate daily recurrence suggestion
     */
    private generateDailySuggestion(
        pattern: CompletionPattern,
        task: Task
    ): RecurrenceSuggestion {
        const days = pattern.intervalMs 
            ? Math.round(pattern.intervalMs / (24 * 60 * 60 * 1000))
            : 1;
        
        const rrule = days === 1
            ? 'FREQ=DAILY'
            : `FREQ=DAILY;INTERVAL=${days}`;
        
        const description = days === 1
            ? 'Every day'
            : `Every ${days} days`;
        
        // Add time of day if available
        const timeClause = this.generateTimeClause(pattern.timeOfDay);
        
        return {
            rrule: timeClause ? `${rrule};${timeClause}` : rrule,
            description,
            confidence: pattern.confidence,
            reasoning: `Based on ${pattern.sampleSize} completions with ${Math.round(pattern.confidence * 100)}% consistency`,
            pattern,
        };
    }
    
    /**
     * Generate weekly recurrence suggestion
     */
    private generateWeeklySuggestion(
        pattern: CompletionPattern,
        task: Task
    ): RecurrenceSuggestion {
        const days = pattern.dayOfWeek || [1]; // Default to Monday
        const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const dayList = days.map(d => dayNames[d] || 'MO').join(',');
        
        const rrule = `FREQ=WEEKLY;BYDAY=${dayList}`;
        
        const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const firstDay = days[0];
        const description = days.length === 1 && firstDay !== undefined
            ? `Every ${fullDayNames[firstDay] || 'week'}`
            : `Every ${days.map(d => fullDayNames[d] || '').filter(Boolean).join(', ')}`;
        
        return {
            rrule,
            description,
            confidence: pattern.confidence,
            reasoning: `Consistently completed on ${description.toLowerCase()} (${pattern.sampleSize} instances)`,
            pattern,
        };
    }
    
    /**
     * Generate monthly recurrence suggestion
     */
    private generateMonthlySuggestion(
        pattern: CompletionPattern,
        task: Task
    ): RecurrenceSuggestion {
        const days = pattern.dayOfMonth || [1];
        const dayList = days.join(',');
        
        const rrule = `FREQ=MONTHLY;BYMONTHDAY=${dayList}`;
        
        const description = days.length === 1
            ? `On day ${days[0]} of every month`
            : `On days ${dayList} of every month`;
        
        return {
            rrule,
            description,
            confidence: pattern.confidence,
            reasoning: `Pattern detected across ${pattern.sampleSize} months`,
            pattern,
        };
    }
    
    /**
     * Generate custom interval suggestion
     */
    private generateCustomSuggestion(
        pattern: CompletionPattern,
        task: Task
    ): RecurrenceSuggestion {
        const days = pattern.intervalMs
            ? Math.round(pattern.intervalMs / (24 * 60 * 60 * 1000))
            : 7;
        
        const rrule = `FREQ=DAILY;INTERVAL=${days}`;
        const description = `Every ${days} days`;
        
        return {
            rrule,
            description,
            confidence: pattern.confidence,
            reasoning: `Average interval of ${days} days detected`,
            pattern,
        };
    }
    
    /**
     * Generate alternative suggestions
     */
    private generateAlternatives(
        pattern: CompletionPattern,
        task: Task
    ): RecurrenceSuggestion[] {
        const alternatives: RecurrenceSuggestion[] = [];
        
        // For daily patterns, suggest weekly alternative
        if (pattern.type === 'daily') {
            const stats = this.analyzer.calculateStats(task);
            const weeklyAlt = {
                rrule: `FREQ=WEEKLY;BYDAY=${['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][stats.mostCommonDayOfWeek]}`,
                description: `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][stats.mostCommonDayOfWeek]}`,
                confidence: pattern.confidence * 0.8,
                reasoning: 'Most common completion day of week',
                pattern,
            };
            alternatives.push(weeklyAlt);
        }
        
        // For weekly patterns, suggest daily alternative if high frequency
        if (pattern.type === 'weekly' && pattern.dayOfWeek && pattern.dayOfWeek.length >= 5) {
            const dailyAlt = {
                rrule: 'FREQ=DAILY',
                description: 'Every day',
                confidence: pattern.confidence * 0.9,
                reasoning: 'High weekly frequency suggests daily recurrence',
                pattern,
            };
            alternatives.push(dailyAlt);
        }
        
        return alternatives.slice(0, this.config.maxAlternatives);
    }
    
    /**
     * Generate fallback suggestions when no pattern detected
     */
    private generateFallbackSuggestions(task: Task): RecurrenceSuggestion[] {
        const stats = this.analyzer.calculateStats(task);
        
        // If task has minimal history, suggest common patterns
        return [
            {
                rrule: 'FREQ=DAILY',
                description: 'Every day',
                confidence: 0.5,
                reasoning: 'Common daily task pattern',
                pattern: {
                    type: 'daily',
                    confidence: 0.5,
                    description: 'Suggested pattern',
                    sampleSize: 0,
                },
            },
            {
                rrule: `FREQ=WEEKLY;BYDAY=${['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][stats.mostCommonDayOfWeek]}`,
                description: `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][stats.mostCommonDayOfWeek]}`,
                confidence: 0.4,
                reasoning: 'Common weekly task pattern',
                pattern: {
                    type: 'weekly',
                    confidence: 0.4,
                    description: 'Suggested pattern',
                    sampleSize: 0,
                },
            },
            {
                rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
                description: 'First day of every month',
                confidence: 0.3,
                reasoning: 'Common monthly task pattern',
                pattern: {
                    type: 'monthly',
                    confidence: 0.3,
                    description: 'Suggested pattern',
                    sampleSize: 0,
                },
            },
        ];
    }
    
    /**
     * Generate time clause from time of day pattern
     */
    private generateTimeClause(timeOfDay?: number[]): string | null {
        if (!timeOfDay || timeOfDay.length === 0) {
            return null;
        }
        
        const hour = timeOfDay[0];
        if (hour === undefined) {
            return null;
        }
        
        // Format as BYHOUR in RRule
        return `BYHOUR=${hour}`;
    }
    
    /**
     * Validate suggested RRule
     */
    validateSuggestion(suggestion: RecurrenceSuggestion): boolean {
        try {
            // Basic RRule validation
            return suggestion.rrule.startsWith('FREQ=') && suggestion.confidence > 0;
        } catch {
            return false;
        }
    }
}
