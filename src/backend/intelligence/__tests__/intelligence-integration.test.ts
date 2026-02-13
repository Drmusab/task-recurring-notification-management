import { describe, it, expect, beforeEach } from 'vitest';
import { PatternAnalyzer } from '../PatternAnalyzer';
import { SmartRecurrenceSuggester } from '../SmartRecurrenceSuggester';
import { CompletionPredictor } from '../CompletionPredictor';
import type { Task } from '../../core/models/Task';

describe('Intelligence Integration - Full Pipeline', () => {
    let analyzer: PatternAnalyzer;
    let suggester: SmartRecurrenceSuggester;
    let predictor: CompletionPredictor;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
        predictor = new CompletionPredictor(analyzer);
    });

    it('should analyze, suggest, and predict for daily task', () => {
        const task = createDailyTask();

        // Step 1: Analyze pattern
        const pattern = analyzer.analyzePattern(task);
        expect(pattern).not.toBeNull();
        expect(pattern?.type).toBe('daily');

        // Step 2: Generate suggestion
        const suggestion = suggester.suggestRecurrence(task);
        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toContain('FREQ=DAILY');

        // Step 3: Predict next completion
        const prediction = predictor.predict(task);
        expect(prediction).not.toBeNull();
        expect(prediction?.confidence).toBeGreaterThan(0.5);
    });

    it('should analyze, suggest, and predict for weekly task', () => {
        const task = createWeeklyTask();

        const pattern = analyzer.analyzePattern(task);
        expect(pattern?.type).toBe('weekly');

        const suggestion = suggester.suggestRecurrence(task);
        expect(suggestion?.rrule).toContain('FREQ=WEEKLY');
        expect(suggestion?.rrule).toContain('BYDAY');

        const prediction = predictor.predict(task);
        expect(prediction).not.toBeNull();
    });

    it('should analyze, suggest, and predict for monthly task', () => {
        const task = createMonthlyTask();

        const pattern = analyzer.analyzePattern(task);
        expect(pattern?.type).toBe('monthly');

        const suggestion = suggester.suggestRecurrence(task);
        expect(suggestion?.rrule).toContain('FREQ=MONTHLY');
        expect(suggestion?.rrule).toContain('BYMONTHDAY');

        const prediction = predictor.predict(task);
        expect(prediction).not.toBeNull();
    });
});

describe('Intelligence Integration - Multiple Tasks', () => {
    let analyzer: PatternAnalyzer;
    let suggester: SmartRecurrenceSuggester;
    let predictor: CompletionPredictor;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
        predictor = new CompletionPredictor(analyzer);
    });

    it('should handle mixed task patterns', () => {
        const tasks = [
            createDailyTask(),
            createWeeklyTask(),
            createMonthlyTask(),
        ];

        const patterns = tasks.map(t => analyzer.analyzePattern(t));
        expect(patterns[0]?.type).toBe('daily');
        expect(patterns[1]?.type).toBe('weekly');
        expect(patterns[2]?.type).toBe('monthly');

        const suggestions = tasks.map(t => suggester.suggestRecurrence(t));
        expect(suggestions).toHaveLength(3);
        suggestions.forEach(s => expect(s).not.toBeNull());

        const predictions = predictor.predictBatch(tasks);
        expect(predictions.size).toBe(3);
    });

    it('should handle tasks with varying quality data', () => {
        const tasks = [
            createHighQualityTask(),
            createMediumQualityTask(),
            createLowQualityTask(),
        ];

        const predictions = Array.from(predictor.predictBatch(tasks).values());
        
        // High quality should have higher confidence
        expect(predictions[0]?.confidence).toBeGreaterThan(predictions[2]?.confidence || 0);
    });
});

describe('Intelligence Integration - Confidence Correlation', () => {
    let analyzer: PatternAnalyzer;
    let suggester: SmartRecurrenceSuggester;
    let predictor: CompletionPredictor;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
        predictor = new CompletionPredictor(analyzer);
    });

    it('should correlate pattern confidence with suggestion confidence', () => {
        const task = createDailyTask();

        const pattern = analyzer.analyzePattern(task);
        const suggestion = suggester.suggestRecurrence(task);

        // Suggestion confidence should be influenced by pattern confidence
        if (pattern && suggestion) {
            // High pattern confidence should lead to reasonable suggestion confidence
            if (pattern.confidence > 0.8) {
                expect(suggestion.confidence).toBeGreaterThan(0.5);
            }
        }
    });

    it('should correlate statistics with prediction confidence', () => {
        const task = createHighQualityTask();
        
        task.completionCount = 20;
        task.missCount = 1; // Very high completion rate

        const stats = analyzer.calculateStats(task);
        const prediction = predictor.predict(task);

        // High completion rate should lead to higher confidence
        if (stats.completionRate > 0.9 && prediction) {
            expect(prediction.confidence).toBeGreaterThan(0.6);
        }
    });
});

describe('Intelligence Integration - Error Handling', () => {
    let analyzer: PatternAnalyzer;
    let suggester: SmartRecurrenceSuggester;
    let predictor: CompletionPredictor;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
        predictor = new CompletionPredictor(analyzer);
    });

    it('should gracefully handle insufficient data', () => {
        const task = createMinimalTask();

        const pattern = analyzer.analyzePattern(task);
        const suggestion = suggester.suggestRecurrence(task);
        const prediction = predictor.predict(task);

        // All should return results (possibly with low confidence or fallbacks)
        expect(suggestion).not.toBeNull();
        expect(prediction).not.toBeNull();
        
        // Confidence should reflect data quality
        if (prediction) {
            expect(prediction.confidence).toBeLessThan(0.7);
        }
    });

    it('should handle empty completions gracefully', () => {
        const task = createEmptyTask();

        expect(() => {
            analyzer.analyzePattern(task);
            suggester.suggestRecurrence(task);
            predictor.predict(task);
        }).not.toThrow();
    });

    it('should handle irregular patterns gracefully', () => {
        const task = createIrregularTask();

        const pattern = analyzer.analyzePattern(task);
        const suggestion = suggester.suggestRecurrence(task);
        const prediction = predictor.predict(task);

        // Should provide results even for irregular patterns
        expect(suggestion).not.toBeNull();
        expect(prediction).not.toBeNull();
    });
});

describe('Intelligence Integration - Real-World Scenarios', () => {
    let analyzer: PatternAnalyzer;
    let suggester: SmartRecurrenceSuggester;
    let predictor: CompletionPredictor;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
        predictor = new CompletionPredictor(analyzer);
    });

    it('should handle morning workout routine', () => {
        const task: Task = {
            id: 'workout',
            name: 'Morning Workout',
            dueAt: new Date('2024-01-08T07:00:00').toISOString(),
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recentCompletions: [
                '2024-01-01T07:15:00', // Monday
                '2024-01-03T07:20:00', // Wednesday
                '2024-01-05T07:10:00', // Friday
            ],
            completionCount: 3,
            missCount: 0,
            currentStreak: 3,
            bestStreak: 3,
        } as Task;

        const suggestion = suggester.suggestRecurrence(task);
        expect(suggestion?.rrule).toContain('FREQ=WEEKLY');
        expect(suggestion?.rrule).toContain('BYDAY');
        
        const prediction = predictor.predict(task);
        if (prediction) {
            // Should predict around 7am
            expect(prediction.predictedDate.getHours()).toBeGreaterThanOrEqual(6);
            expect(prediction.predictedDate.getHours()).toBeLessThanOrEqual(8);
        }
    });

    it('should handle monthly bill payment', () => {
        const task: Task = {
            id: 'bill',
            name: 'Pay Electric Bill',
            dueAt: new Date('2024-04-01T10:00:00').toISOString(),
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recentCompletions: [
                '2024-01-01T10:30:00',
                '2024-02-01T10:15:00',
                '2024-03-01T10:45:00',
            ],
            completionCount: 3,
            missCount: 0,
            currentStreak: 3,
            bestStreak: 3,
        } as Task;

        const suggestion = suggester.suggestRecurrence(task);
        expect(suggestion?.rrule).toContain('FREQ=MONTHLY');
        expect(suggestion?.rrule).toContain('BYMONTHDAY=1');
        
        const prediction = predictor.predict(task);
        if (prediction) {
            expect(prediction.predictedDate.getDate()).toBe(1);
        }
    });

    it('should handle medication reminder', () => {
        const task: Task = {
            id: 'medication',
            name: 'Take Medication',
            dueAt: new Date('2024-01-05T09:00:00').toISOString(),
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            recentCompletions: [
                '2024-01-01T09:05:00',
                '2024-01-02T09:00:00',
                '2024-01-03T09:10:00',
                '2024-01-04T09:02:00',
            ],
            completionCount: 4,
            missCount: 0,
            currentStreak: 4,
            bestStreak: 4,
        } as Task;

        const suggestion = suggester.suggestRecurrence(task);
        expect(suggestion?.rrule).toBe('FREQ=DAILY');
        
        const prediction = predictor.predict(task);
        if (prediction) {
            // Very consistent, should have high confidence
            expect(prediction.confidence).toBeGreaterThan(0.7);
            expect(prediction.positiveFactors).toContainEqual(
                expect.stringMatching(/streak|pattern|consistent/i)
            );
        }
    });
});

describe('Intelligence Integration - Performance', () => {
    let analyzer: PatternAnalyzer;
    let suggester: SmartRecurrenceSuggester;
    let predictor: CompletionPredictor;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
        predictor = new CompletionPredictor(analyzer);
    });

    it('should process single task quickly', () => {
        const task = createDailyTask();
        const start = Date.now();

        analyzer.analyzePattern(task);
        suggester.suggestRecurrence(task);
        predictor.predict(task);

        const elapsed = Date.now() - start;
        
        // Full pipeline should complete in under 50ms
        expect(elapsed).toBeLessThan(50);
    });

    it('should batch process tasks efficiently', () => {
        const tasks = Array.from({ length: 10 }, () => createDailyTask());
        const start = Date.now();

        predictor.predictBatch(tasks);

        const elapsed = Date.now() - start;
        
        // Should process 10 tasks in under 100ms
        expect(elapsed).toBeLessThan(100);
    });
});

// Helper functions to create test tasks

function createDailyTask(): Task {
    return {
        id: `daily-${Math.random()}`,
        name: 'Daily Task',
        dueAt: new Date('2024-01-05T09:00:00').toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recentCompletions: [
            '2024-01-01T09:00:00',
            '2024-01-02T09:00:00',
            '2024-01-03T09:00:00',
            '2024-01-04T09:00:00',
        ],
        completionCount: 4,
        missCount: 0,
        currentStreak: 4,
        bestStreak: 4,
    } as Task;
}

function createWeeklyTask(): Task {
    return {
        id: `weekly-${Math.random()}`,
        name: 'Weekly Task',
        dueAt: new Date('2024-01-08T10:00:00').toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recentCompletions: [
            '2024-01-01T10:00:00', // Monday
            '2024-01-03T10:00:00', // Wednesday
            '2024-01-05T10:00:00', // Friday
        ],
        completionCount: 3,
        missCount: 0,
        currentStreak: 3,
        bestStreak: 3,
    } as Task;
}

function createMonthlyTask(): Task {
    return {
        id: `monthly-${Math.random()}`,
        name: 'Monthly Task',
        dueAt: new Date('2024-04-01T10:00:00').toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recentCompletions: [
            '2024-01-01T10:00:00',
            '2024-02-01T10:00:00',
            '2024-03-01T10:00:00',
        ],
        completionCount: 3,
        missCount: 0,
        currentStreak: 3,
        bestStreak: 3,
    } as Task;
}

function createHighQualityTask(): Task {
    const task = createDailyTask();
    task.completionCount = 20;
    task.missCount = 1;
    task.currentStreak = 10;
    task.bestStreak = 15;
    return task;
}

function createMediumQualityTask(): Task {
    const task = createDailyTask();
    task.completionCount = 10;
    task.missCount = 5;
    task.currentStreak = 2;
    task.bestStreak = 5;
    return task;
}

function createLowQualityTask(): Task {
    return {
        id: `low-quality-${Math.random()}`,
        name: 'Low Quality Task',
        dueAt: new Date('2024-01-05T10:00:00').toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recentCompletions: [
            '2024-01-01T10:00:00',
        ],
        completionCount: 1,
        missCount: 5,
        currentStreak: 0,
        bestStreak: 1,
    } as Task;
}

function createMinimalTask(): Task {
    return {
        id: `minimal-${Math.random()}`,
        name: 'Minimal Task',
        dueAt: new Date('2024-01-02T10:00:00').toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recentCompletions: [
            '2024-01-01T10:00:00',
        ],
        completionCount: 1,
        missCount: 0,
        currentStreak: 1,
        bestStreak: 1,
    } as Task;
}

function createEmptyTask(): Task {
    return {
        id: `empty-${Math.random()}`,
        name: 'Empty Task',
        dueAt: new Date('2024-01-01T10:00:00').toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recentCompletions: [],
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
    } as Task;
}

function createIrregularTask(): Task {
    return {
        id: `irregular-${Math.random()}`,
        name: 'Irregular Task',
        dueAt: new Date('2024-02-01T10:00:00').toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recentCompletions: [
            '2024-01-01T10:00:00',
            '2024-01-03T10:00:00',
            '2024-01-10T10:00:00',
            '2024-01-25T10:00:00',
        ],
        completionCount: 4,
        missCount: 2,
        currentStreak: 1,
        bestStreak: 2,
    } as Task;
}
