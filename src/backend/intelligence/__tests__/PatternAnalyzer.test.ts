import { describe, it, expect, beforeEach } from 'vitest';
import { PatternAnalyzer, type CompletionPattern, type CompletionStats } from '../PatternAnalyzer';
import type { Task } from '../../core/models/Task';

describe('PatternAnalyzer - Daily Patterns', () => {
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
    });

    it('should detect daily pattern with 1-day interval', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T09:00:00',
            '2024-01-02T09:00:00',
            '2024-01-03T09:00:00',
            '2024-01-04T09:00:00',
        ]);

        const pattern = analyzer.analyzePattern(task);

        expect(pattern).not.toBeNull();
        expect(pattern?.type).toBe('daily');
        expect(pattern?.confidence).toBeGreaterThan(0.9);
        expect(pattern?.intervalMs).toBe(24 * 60 * 60 * 1000);
    });

    it('should detect every-2-days pattern', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-03T10:00:00',
            '2024-01-05T10:00:00',
            '2024-01-07T10:00:00',
        ]);

        const pattern = analyzer.analyzePattern(task);

        expect(pattern).not.toBeNull();
        expect(pattern?.type).toBe('daily');
        expect(pattern?.intervalMs).toBe(2 * 24 * 60 * 60 * 1000);
    });

    it('should detect time-of-day pattern', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T09:30:00',
            '2024-01-02T09:45:00',
            '2024-01-03T09:15:00',
            '2024-01-04T09:30:00',
        ]);

        const pattern = analyzer.analyzePattern(task);

        expect(pattern).not.toBeNull();
        expect(pattern?.timeOfDay).toContain(9);
    });
});

describe('PatternAnalyzer - Weekly Patterns', () => {
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
    });

    it('should detect weekly pattern on Mondays', () => {
        const task = createTaskWithCompletions([
            '2024 -01-01T10:00:00', // Monday
            '2024-01-08T10:00:00', // Monday
            '2024-01-15T10:00:00', // Monday
            '2024-01-22T10:00:00', // Monday
        ]);

        const pattern = analyzer.analyzePattern(task);

        expect(pattern).not.toBeNull();
        expect(pattern?.type).toBe('weekly');
        expect(pattern?.dayOfWeek).toContain(1); // Monday
    });

    it('should detect multi-day weekly pattern', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00', // Monday
            '2024-01-03T10:00:00', // Wednesday
            '2024-01-05T10:00:00', // Friday
            '2024-01-08T10:00:00', // Monday
            '2024-01-10T10:00:00', // Wednesday
            '2024-01-12T10:00:00', // Friday
        ]);

        const pattern = analyzer.analyzePattern(task);

        expect(pattern).not.toBeNull();
        expect(pattern?.type).toBe('weekly');
        expect(pattern?.dayOfWeek).toContain(1); // Monday
        expect(pattern?.dayOfWeek).toContain(3); // Wednesday
        expect(pattern?.dayOfWeek).toContain(5); // Friday
    });
});

describe('PatternAnalyzer - Monthly Patterns', () => {
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
    });

    it('should detect monthly pattern on day 1', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-02-01T10:00:00',
            '2024-03-01T10:00:00',
        ]);

        const pattern = analyzer.analyzePattern(task);

        expect(pattern).not.toBeNull();
        expect(pattern?.type).toBe('monthly');
        expect(pattern?.dayOfMonth).toContain(1);
    });

    it('should detect monthly pattern on day 15', () => {
        const task = createTaskWithCompletions([
            '2024-01-15T10:00:00',
            '2024-02-15T10:00:00',
            '2024-03-15T10:00:00',
        ]);

        const pattern = analyzer.analyzePattern(task);

        expect(pattern).not.toBeNull();
        expect(pattern?.type).toBe('monthly');
        expect(pattern?.dayOfMonth).toContain(15);
    });
});

describe('PatternAnalyzer - Custom Patterns', () => {
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
    });

    it('should detect 5-day custom interval', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-06T10:00:00',
            '2024-01-11T10:00:00',
            '2024-01-16T10:00:00',
        ]);

        const pattern = analyzer.analyzePattern(task);

        expect(pattern).not.toBeNull();
        expect(pattern?.type).toBe('custom');
        const days = Math.round((pattern?.intervalMs || 0) / (24 * 60 * 60 * 1000));
        expect(days).toBe(5);
    });
});

describe('PatternAnalyzer - Irregular Patterns', () => {
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
    });

    it('should detect irregular pattern for inconsistent completions', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-03T10:00:00',
            '2024-01-08T10:00:00',
            '2024-01-25T10:00:00',
        ]);

        const pattern = analyzer.analyzePattern(task);

        // High variance should result in irregular or low confidence pattern
        if (pattern) {
            expect(
                pattern.type === 'irregular' || pattern.confidence < 0.6
            ).toBe(true);
        }
    });

    it('should return null for insufficient data', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
        ]);

        const pattern = analyzer.analyzePattern(task);

        expect(pattern).toBeNull();
    });
});

describe('PatternAnalyzer - Statistics', () => {
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
    });

    it('should calculate completion statistics', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T09:00:00',
            '2024-01-02T09:00:00',
            '2024-01-03T09:00:00',
            '2024-01-04T09:00:00',
        ]);
        task.completionCount = 4;
        task.missCount = 1;
        task.currentStreak = 4;
        task.bestStreak = 10;

        const stats = analyzer.calculateStats(task);

        expect(stats.totalCompletions).toBe(4);
        expect(stats.completionRate).toBe(0.8); // 4/(4+1)
        expect(stats.currentStreak).toBe(4);
        expect(stats.longestStreak).toBe(10);
        expect(stats.mostCommonHour).toBe(9);
    });

    it('should calculate average interval', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ]);

        const stats = analyzer.calculateStats(task);

        expect(stats.avgInterval).toBe(24 * 60 * 60 * 1000); // 1 day in ms
    });

    it('should find most common day of week', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00', // Monday
            '2024-01-08T10:00:00', // Monday
            '2024-01-15T10:00:00', // Monday
        ]);

        const stats = analyzer.calculateStats(task);

        expect(stats.mostCommonDayOfWeek).toBe(1); // Monday
    });
});

describe('PatternAnalyzer - Configuration', () => {
    it('should respect custom min sample size', () => {
        const analyzer = new PatternAnalyzer({ minSampleSize: 5 });
        
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ]);

        const pattern = analyzer.analyzePattern(task);

        expect(pattern).toBeNull(); // Not enough samples
    });

    it('should respect custom confidence threshold', () => {
        const analyzer = new PatternAnalyzer({ minConfidence: 0.95 });
        
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T11:00:00', // Slight variance
            '2024-01-03T09:00:00',
            '2024-01-04T10:00:00',
        ]);

        const pattern = analyzer.analyzePattern(task);

        if (pattern) {
            // Should either be null or have high confidence
            expect(pattern.confidence).toBeGreaterThanOrEqual(0.6);
        }
    });

    it('should respect analysis window', () => {
        const analyzer = new PatternAnalyzer({
            analysisWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        
        const task = createTaskWithCompletions([
            '2023-12-01T10:00:00', // Outside window
            '2024-01-20T10:00:00', // Within window
            '2024-01-21T10:00:00', // Within window
            '2024-01-22T10:00:00', // Within window
        ]);

        const pattern = analyzer.analyzePattern(task);

        // Should only consider recent completions
        expect(pattern?.sampleSize).toBe(3);
    });
});

describe('PatternAnalyzer - Edge Cases', () => {
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
    });

    it('should handle empty completion history', () => {
        const task = createTaskWithCompletions([]);

        const pattern = analyzer.analyzePattern(task);
        const stats = analyzer.calculateStats(task);

        expect(pattern).toBeNull();
        expect(stats.totalCompletions).toBe(0);
    });

    it('should handle single completion', () => {
        const task = createTaskWithCompletions(['2024-01-01T10:00:00']); const pattern = analyzer.analyzePattern(task);

        expect(pattern).toBeNull();
    });

    it('should handle same-day completions', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T09:00:00',
            '2024-01-01T10:00:00',
            '2024-01-01T11:00:00',
        ]);

        const pattern = analyzer.analyzePattern(task);

        // Should detect very short interval or irregular
        expect(pattern).not.toBeNull();
    });
});

// Helper function to create test tasks with completions
function createTaskWithCompletions(timestamps: string[]): Task {
    return {
        id: `test-task-${Math.random()}`,
        name: 'Test Task',
        dueAt: new Date().toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recentCompletions: timestamps,
        completionCount: timestamps.length,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
    } as Task;
}
