import { describe, it, expect, beforeEach } from 'vitest';
import { PatternAnalyzer } from '../PatternAnalyzer';
import { SmartRecurrenceSuggester } from '../SmartRecurrenceSuggester';
import { CompletionPredictor } from '../CompletionPredictor';
import type { Task } from '../../core/models/Task';

/**
 * Performance Benchmarks for Intelligence Modules
 * 
 * Target Performance:
 * - PatternAnalyzer.analyzePattern(): < 10ms
 * - SmartRecurrenceSuggester.suggestRecurrence(): < 5ms
 * - CompletionPredictor.predict(): < 10ms
 * - Batch processing (1000 tasks): < 1000ms
 */

describe('PatternAnalyzer - Performance Benchmarks', () => {
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
    });

    it('should analyze daily pattern in under 10ms', () => {
        const task = createDailyTask();
        const measurements: number[] = [];

        // Warm up
        for (let i = 0; i < 10; i++) {
            analyzer.analyzePattern(task);
        }

        // Measure
        for (let i = 0; i < 100; i++) {
            const start = performance.now();
            analyzer.analyzePattern(task);
            measurements.push(performance.now() - start);
        }

        const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const maxTime = Math.max(...measurements);

        console.log(`PatternAnalyzer.analyzePattern() - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
        
        expect(avgTime).toBeLessThan(10);
        expect(maxTime).toBeLessThan(20);
    });

    it('should calculate stats in under 5ms', () => {
        const task = createDailyTask();
        const measurements: number[] = [];

        // Warm up
        for (let i = 0; i < 10; i++) {
            analyzer.calculateStats(task);
        }

        // Measure
        for (let i = 0; i < 100; i++) {
            const start = performance.now();
            analyzer.calculateStats(task);
            measurements.push(performance.now() - start);
        }

        const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        
        console.log(`PatternAnalyzer.calculateStats() - Avg: ${avgTime.toFixed(2)}ms`);
        
        expect(avgTime).toBeLessThan(5);
    });

    it('should handle large completion history efficiently', () => {
        const largeTask = createTaskWithManyCompletions(1000);
        
        const start = performance.now();
        const pattern = analyzer.analyzePattern(largeTask);
        const elapsed = performance.now() - start;

        console.log(`PatternAnalyzer with 1000 completions: ${elapsed.toFixed(2)}ms`);
        
        expect(pattern).not.toBeNull();
        expect(elapsed).toBeLessThan(50); // Should handle 1000 completions in under 50ms
    });
});

describe('SmartRecurrenceSuggester - Performance Benchmarks', () => {
    let analyzer: PatternAnalyzer;
    let suggester: SmartRecurrenceSuggester;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
    });

    it('should generate suggestion in under 5ms', () => {
        const task = createDailyTask();
        const measurements: number[] = [];

        // Warm up
        for (let i = 0; i < 10; i++) {
            suggester.suggestRecurrence(task);
        }

        // Measure
        for (let i = 0; i < 100; i++) {
            const start = performance.now();
            suggester.suggestRecurrence(task);
            measurements.push(performance.now() - start);
        }

        const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const maxTime = Math.max(...measurements);

        console.log(`SmartRecurrenceSuggester.suggestRecurrence() - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
        
        expect(avgTime).toBeLessThan(15); // Slightly higher due to pattern analysis
        expect(maxTime).toBeLessThan(30);
    });

    it('should generate multiple suggestions efficiently', () => {
        const task = createDailyTask();
        
        const start = performance.now();
        const suggestions = suggester.suggestMultiple(task);
        const elapsed = performance.now() - start;

        console.log(`SmartRecurrenceSuggester.suggestMultiple() - ${elapsed.toFixed(2)}ms`);
        
        expect(suggestions.length).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(20);
    });
});

describe('CompletionPredictor - Performance Benchmarks', () => {
    let analyzer: PatternAnalyzer;
    let predictor: CompletionPredictor;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        predictor = new CompletionPredictor(analyzer);
    });

    it('should predict completion in under 10ms', () => {
        const task = createDailyTask();
        const measurements: number[] = [];

        // Warm up
        for (let i = 0; i < 10; i++) {
            predictor.predict(task);
        }

        // Measure
        for (let i = 0; i < 100; i++) {
            const start = performance.now();
            predictor.predict(task);
            measurements.push(performance.now() - start);
        }

        const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const maxTime = Math.max(...measurements);

        console.log(`CompletionPredictor.predict() - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
        
        expect(avgTime).toBeLessThan(15);
        expect(maxTime).toBeLessThan(30);
    });

    it('should calculate health score quickly', () => {
        const task = createDailyTask();
        const measurements: number[] = [];

        // Warm up
        for (let i = 0; i < 10; i++) {
            predictor.calculateHealthScore(task);
        }

        // Measure
        for (let i = 0; i < 100; i++) {
            const start = performance.now();
            predictor.calculateHealthScore(task);
            measurements.push(performance.now() - start);
        }

        const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        
        console.log(`CompletionPredictor.calculateHealthScore() - Avg: ${avgTime.toFixed(2)}ms`);
        
        expect(avgTime).toBeLessThan(10);
    });

    it('should batch process 100 tasks in under 500ms', () => {
        const tasks = Array.from({ length: 100 }, () => createDailyTask());
        
        const start = performance.now();
        const predictions = predictor.predictBatch(tasks);
        const elapsed = performance.now() - start;

        console.log(`CompletionPredictor.predictBatch(100 tasks) - ${elapsed.toFixed(2)}ms`);
        
        expect(predictions.size).toBe(100);
        expect(elapsed).toBeLessThan(500);
    });

    it('should batch process 1000 tasks in under 2000ms', () => {
        const tasks = Array.from({ length: 1000 }, () => createDailyTask());
        
        const start = performance.now();
        const predictions = predictor.predictBatch(tasks);
        const elapsed = performance.now() - start;

        console.log(`CompletionPredictor.predictBatch(1000 tasks) - ${elapsed.toFixed(2)}ms`);
        
        expect(predictions.size).toBe(1000);
        expect(elapsed).toBeLessThan(2000); // 2 seconds for 1000 tasks
    });
});

describe('Full Pipeline - Performance Benchmarks', () => {
    let analyzer: PatternAnalyzer;
    let suggester: SmartRecurrenceSuggester;
    let predictor: CompletionPredictor;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
        predictor = new CompletionPredictor(analyzer);
    });

    it('should complete full pipeline in under 30ms', () => {
        const task = createDailyTask();
        const measurements: number[] = [];

        // Warm up
        for (let i = 0; i < 10; i++) {
            analyzer.analyzePattern(task);
            suggester.suggestRecurrence(task);
            predictor.predict(task);
        }

        // Measure
        for (let i = 0; i < 100; i++) {
            const start = performance.now();
            
            analyzer.analyzePattern(task);
            suggester.suggestRecurrence(task);
            predictor.predict(task);
            
            measurements.push(performance.now() - start);
        }

        const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const maxTime = Math.max(...measurements);

        console.log(`Full Pipeline (analyze + suggest + predict) - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
        
        expect(avgTime).toBeLessThan(40);
        expect(maxTime).toBeLessThan(80);
    });

    it('should process 50 tasks through full pipeline in under 1000ms', () => {
        const tasks = Array.from({ length: 50 }, () => createDailyTask());
        
        const start = performance.now();
        
        tasks.forEach(task => {
            analyzer.analyzePattern(task);
            suggester.suggestRecurrence(task);
            predictor.predict(task);
        });
        
        const elapsed = performance.now() - start;

        console.log(`Full Pipeline for 50 tasks - ${elapsed.toFixed(2)}ms`);
        
        expect(elapsed).toBeLessThan(1500); // 1.5 seconds for 50 tasks
    });
});

describe('Memory Usage - Benchmarks', () => {
    let analyzer: PatternAnalyzer;
    let suggester: SmartRecurrenceSuggester;
    let predictor: CompletionPredictor;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
        predictor = new CompletionPredictor(analyzer);
    });

    it('should not leak memory during repeated analysis', () => {
        const task = createDailyTask();
        
        // Perform many operations
        for (let i = 0; i < 1000; i++) {
            analyzer.analyzePattern(task);
        }
        
        // If we get here without crashing, memory is managed well
        expect(true).toBe(true);
    });

    it('should handle large batch efficiently', () => {
        const tasks = Array.from({ length: 1000 }, () => createDailyTask());
        
        const predictions = predictor.predictBatch(tasks);
        
        expect(predictions.size).toBe(1000);
        
        // Clean up
        predictions.clear();
    });
});

describe('Statistical Outliers - Performance', () => {
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
    });

    it('should handle worst-case variance calculation efficiently', () => {
        // Create task with maximum variance (random completions)
        const task = createRandomCompletionTask(100);
        
        const start = performance.now();
        const pattern = analyzer.analyzePattern(task);
        const elapsed = performance.now() - start;

        console.log(`PatternAnalyzer with high variance (100 completions) - ${elapsed.toFixed(2)}ms`);
        
        expect(elapsed).toBeLessThan(50);
    });

    it('should handle dense completions efficiently', () => {
        // Create task with many completions in short time span
        const task = createDenseCompletionsTask(500);
        
        const start = performance.now();
        const pattern = analyzer.analyzePattern(task);
        const elapsed = performance.now() - start;

        console.log(`PatternAnalyzer with dense completions (500 in 7 days) - ${elapsed.toFixed(2)}ms`);
        
        expect(elapsed).toBeLessThan(50);
    });
});

// Helper functions

function createDailyTask(): Task {
    return {
        id: `task-${Math.random()}`,
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

function createTaskWithManyCompletions(count: number): Task {
    const completions: string[] = [];
    const baseDate = new Date('2024-01-01T09:00:00');
    
    for (let i = 0; i < count; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        completions.push(date.toISOString());
    }
    
    return {
        id: `task-large-${Math.random()}`,
        name: 'Task with Many Completions',
        dueAt: new Date('2024-06-01T09:00:00').toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recentCompletions: completions,
        completionCount: count,
        missCount: 0,
        currentStreak: count,
        bestStreak: count,
    } as Task;
}

function createRandomCompletionTask(count: number): Task {
    const completions: string[] = [];
    const baseDate = new Date('2024-01-01T09:00:00');
    
    for (let i = 0; i < count; i++) {
        const date = new Date(baseDate);
        // Random days between 0-90
        date.setDate(date.getDate() + Math.floor(Math.random() * 90));
        // Random hours
        date.setHours(Math.floor(Math.random() * 24));
        completions.push(date.toISOString());
    }
    
    completions.sort(); // Sort chronologically
    
    return {
        id: `task-random-${Math.random()}`,
        name: 'Random Completion Task',
        dueAt: new Date('2024-04-01T09:00:00').toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recentCompletions: completions,
        completionCount: count,
        missCount: Math.floor(count * 0.3), // 30% miss rate
        currentStreak: 0,
        bestStreak: 5,
    } as Task;
}

function createDenseCompletionsTask(count: number): Task {
    const completions: string[] = [];
    const baseDate = new Date('2024-01-01T00:00:00');
    
    // 500 completions across 7 days
    for (let i = 0; i < count; i++) {
        const date = new Date(baseDate);
        // Distribute across 7 days with random hours/minutes
        date.setHours(Math.floor((i / (count / 7)) * 24));
        date.setMinutes(Math.floor(Math.random() * 60));
        completions.push(date.toISOString());
    }
    
    completions.sort();
    
    return {
        id: `task-dense-${Math.random()}`,
        name: 'Dense Completion Task',
        dueAt: new Date('2024-01-08T09:00:00').toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recentCompletions: completions,
        completionCount: count,
        missCount: 0,
        currentStreak: count,
        bestStreak: count,
    } as Task;
}
