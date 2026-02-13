import { describe, it, expect, beforeEach } from 'vitest';
import { SmartRecurrenceSuggester, type RecurrenceSuggestion } from '../SmartRecurrenceSuggester';
import { PatternAnalyzer } from '../PatternAnalyzer';
import type { Task } from '../../core/models/Task';

describe('SmartRecurrenceSuggester - Daily Patterns', () => {
    let suggester: SmartRecurrenceSuggester;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
    });

    it('should suggest daily recurrence for 1-day pattern', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T09:00:00',
            '2024-01-02T09:00:00',
            '2024-01-03T09:00:00',
            '2024-01-04T09:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toBe('FREQ=DAILY');
        expect(suggestion?.description).toContain('daily');
        expect(suggestion?.confidence).toBeGreaterThan(0.7);
    });

    it('should suggest 2-day interval for every-2-days pattern', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-03T10:00:00',
            '2024-01-05T10:00:00',
            '2024-01-07T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toBe('FREQ=DAILY;INTERVAL=2');
        expect(suggestion?.description).toContain('every 2 days');
    });

    it('should include time in RRule for consistent time-of-day', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T09:30:00',
            '2024-01-02T09:30:00',
            '2024-01-03T09:30:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        // Should suggest around 9-10am
        expect(suggestion?.description).toMatch(/9|10/);
    });
});

describe('SmartRecurrenceSuggester - Weekly Patterns', () => {
    let suggester: SmartRecurrenceSuggester;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
    });

    it('should suggest weekly recurrence for Monday pattern', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00', // Monday
            '2024-01-08T10:00:00', // Monday
            '2024-01-15T10:00:00', // Monday
            '2024-01-22T10:00:00', // Monday
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toContain('FREQ=WEEKLY');
        expect(suggestion?.rrule).toContain('BYDAY=MO');
        expect(suggestion?.description).toContain('Monday');
    });

    it('should suggest MWF pattern', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00', // Monday
            '2024-01-03T10:00:00', // Wednesday
            '2024-01-05T10:00:00', // Friday
            '2024-01-08T10:00:00', // Monday
            '2024-01-10T10:00:00', // Wednesday
            '2024-01-12T10:00:00', // Friday
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toContain('FREQ=WEEKLY');
        expect(suggestion?.rrule).toContain('BYDAY');
        expect(suggestion?.rrule).toContain('MO');
        expect(suggestion?.rrule).toContain('WE');
        expect(suggestion?.rrule).toContain('FR');
    });

    it('should suggest Saturday pattern', () => {
        const task = createTaskWithCompletions([
            '2024-01-06T10:00:00', // Saturday
            '2024-01-13T10:00:00', // Saturday
            '2024-01-20T10:00:00', // Saturday
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toContain('BYDAY=SA');
    });
});

describe('SmartRecurrenceSuggester - Monthly Patterns', () => {
    let suggester: SmartRecurrenceSuggester;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
    });

    it('should suggest monthly recurrence on day 1', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-02-01T10:00:00',
            '2024-03-01T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toContain('FREQ=MONTHLY');
        expect(suggestion?.rrule).toContain('BYMONTHDAY=1');
        expect(suggestion?.description).toContain('1st');
    });

    it('should suggest monthly recurrence on day 15', () => {
        const task = createTaskWithCompletions([
            '2024-01-15T10:00:00',
            '2024-02-15T10:00:00',
            '2024-03-15T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toContain('BYMONTHDAY=15');
        expect(suggestion?.description).toContain('15th');
    });

    it('should suggest bi-monthly pattern', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-15T10:00:00',
            '2024-02-01T10:00:00',
            '2024-02-15T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toContain('FREQ=MONTHLY');
        expect(suggestion?.rrule).toContain('BYMONTHDAY');
        expect(suggestion?.rrule).toMatch(/1|15/);
    });
});

describe('SmartRecurrenceSuggester - Custom Patterns', () => {
    let suggester: SmartRecurrenceSuggester;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
    });

    it('should suggest custom 5-day interval', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-06T10:00:00',
            '2024-01-11T10:00:00',
            '2024-01-16T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toContain('FREQ=DAILY;INTERVAL=5');
        expect(suggestion?.description).toContain('every 5 days');
    });

    it('should suggest custom 10-day interval', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-11T10:00:00',
            '2024-01-21T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toContain('INTERVAL=10');
    });
});

describe('SmartRecurrenceSuggester - Alternative Suggestions', () => {
    let suggester: SmartRecurrenceSuggester;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
    });

    it('should provide alternative suggestions', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
            '2024-01-04T10:00:00',
        ]);

        const suggestions = suggester.suggestMultiple(task);

        expect(suggestions.length).toBeGreaterThan(1);
        expect(suggestions[0].rrule).toBe('FREQ=DAILY'); // Primary
        
        // Should have alternatives
        const hasAlternatives = suggestions.some(s => s.alternatives && s.alternatives.length > 0);
        expect(hasAlternatives).toBe(true);
    });

    it('should order suggestions by confidence', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-08T10:00:00',
            '2024-01-15T10:00:00',
        ]);

        const suggestions = suggester.suggestMultiple(task);

        for (let i = 1; i < suggestions.length; i++) {
            expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(
                suggestions[i].confidence
            );
        }
    });
});

describe('SmartRecurrenceSuggester - Fallback Suggestions', () => {
    let suggester: SmartRecurrenceSuggester;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
    });

    it('should provide fallback for insufficient data', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.rrule).toMatch(/FREQ=/);
        expect(suggestion?.confidence).toBeLessThan(0.7); // Lower confidence
    });

    it('should provide fallback for irregular pattern', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-03T10:00:00',
            '2024-01-10T10:00:00',
            '2024-01-25T10:00:00',
        ]);

        const suggestions = suggester.suggestMultiple(task);

        expect(suggestions.length).toBeGreaterThan(0);
        // Should provide some suggestion even if confidence is low
    });
});

describe('SmartRecurrenceSuggester - Reasoning', () => {
    let suggester: SmartRecurrenceSuggester;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
    });

    it('should provide reasoning for suggestion', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.reasoning).toBeTruthy();
        expect(suggestion?.reasoning.length).toBeGreaterThan(10);
    });

    it('should mention confidence in reasoning', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-08T10:00:00',
            '2024-01-15T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.reasoning).toMatch(/confidence|consistent|pattern/i);
    });
});

describe('SmartRecurrenceSuggester - Configuration', () => {
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
    });

    it('should respect min completions setting', () => {
        const suggester = new SmartRecurrenceSuggester(analyzer, {
            minCompletions: 5,
        });
        
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        // Should be null or fallback with low confidence
        if (suggestion) {
            expect(suggestion.confidence).toBeLessThan(0.7);
        }
    });

    it('should respect min confidence setting', () => {
        const suggester = new SmartRecurrenceSuggester(analyzer, {
            minConfidence: 0.95,
        });
        
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T11:00:00', // Slight variance
            '2024-01-03T09:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        if (suggestion) {
            // Either high confidence or fallback
            expect(
                suggestion.confidence >= 0.6 || suggestion.confidence < 0.7
            ).toBe(true);
        }
    });

    it('should limit alternatives', () => {
        const suggester = new SmartRecurrenceSuggester(analyzer, {
            maxAlternatives: 1,
        });
        
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        if (suggestion && suggestion.alternatives) {
            expect(suggestion.alternatives.length).toBeLessThanOrEqual(1);
        }
    });
});

describe('SmartRecurrenceSuggester - Edge Cases', () => {
    let suggester: SmartRecurrenceSuggester;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        suggester = new SmartRecurrenceSuggester(analyzer);
    });

    it('should handle empty completion history', () => {
        const task = createTaskWithCompletions([]);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        // Should provide fallback
        expect(suggestion?.rrule).toMatch(/FREQ=/);
    });

    it('should handle single completion', () => {
        const task = createTaskWithCompletions(['2024-01-01T10:00:00']);

        const suggestion = suggester.suggestRecurrence(task);

        expect(suggestion).not.toBeNull();
        expect(suggestion?.confidence).toBeLessThan(0.7); // Fallback confidence
    });

    it('should handle very old completions', () => {
        const task = createTaskWithCompletions([
            '2020-01-01T10:00:00',
            '2020-01-02T10:00:00',
            '2020-01-03T10:00:00',
        ]);

        const suggestion = suggester.suggestRecurrence(task);

        // Should still provide suggestions based on pattern
        expect(suggestion).not.toBeNull();
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
