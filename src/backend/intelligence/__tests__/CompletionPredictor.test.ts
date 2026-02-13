import { describe, it, expect, beforeEach } from 'vitest';
import { CompletionPredictor, type CompletionPrediction } from '../CompletionPredictor';
import { PatternAnalyzer } from '../PatternAnalyzer';
import type { Task } from '../../core/models/Task';

describe('CompletionPredictor - Basic Predictions', () => {
    let predictor: CompletionPredictor;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        predictor = new CompletionPredictor(analyzer);
    });

    it('should predict next completion for daily pattern', () => {
        const now = new Date('2024-01-05T00:00:00');
        const task = createTaskWithCompletions([
            '2024-01-01T09:00:00',
            '2024-01-02T09:00:00',
            '2024-01-03T09:00:00',
            '2024-01-04T09:00:00',
        ], new Date('2024-01-05T09:00:00'));

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.predictedDate).toBeInstanceOf(Date);
        expect(prediction?.confidence).toBeGreaterThan(0.5);
    });

    it('should predict with confidence score', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ], new Date('2024-01-04T10:00:00'));
        
        task.completionCount = 3;
        task.missCount = 0;

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.confidence).toBeGreaterThan(0);
        expect(prediction?.confidence).toBeLessThanOrEqual(1);
    });

    it('should calculate on-time likelihood', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T09:00:00',
            '2024-01-02T09:00:00',
            '2024-01-03T09:00:00',
        ], new Date('2024-01-04T09:00:00'));
        
        task.completionCount = 3;
        task.missCount = 1;
        task.currentStreak = 3;

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.onTimeLikelihood).toBeGreaterThan(0);
        expect(prediction?.onTimeLikelihood).toBeLessThanOrEqual(1);
    });
});

describe('CompletionPredictor - Prediction Window', () => {
    let predictor: CompletionPredictor;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        predictor = new CompletionPredictor(analyzer);
    });

    it('should provide earliest and latest completion times', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ], new Date('2024-01-04T10:00:00'));

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.window).toHaveProperty('earliest');
        expect(prediction?.window).toHaveProperty('latest');
        expect(prediction?.window.earliest).toBeInstanceOf(Date);
        expect(prediction?.window.latest).toBeInstanceOf(Date);
    });

    it('should have earliest before latest', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ], new Date('2024-01-04T10:00:00'));

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        if (prediction) {
            expect(prediction.window.earliest.getTime()).toBeLessThan(
                prediction.window.latest.getTime()
            );
        }
    });

    it('should center prediction within window', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ], new Date('2024-01-04T10:00:00'));

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        const predictedTime = prediction!.predictedDate.getTime();
        const earliestTime = prediction!.window.earliest.getTime();
        const latestTime = prediction!.window.latest.getTime();

        expect(predictedTime).toBeGreaterThanOrEqual(earliestTime);
        expect(predictedTime).toBeLessThanOrEqual(latestTime);
    });
});

describe('CompletionPredictor - Risk Factors', () => {
    let predictor: CompletionPredictor;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        predictor = new CompletionPredictor(analyzer);
    });

    it('should identify low completion rate risk', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
        ], new Date('2024-01-10T10:00:00'));
        
        task.completionCount = 1;
        task.missCount = 5; // Low completion rate

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.riskFactors).toContainEqual(
            expect.stringMatching(/completion rate|miss/i)
        );
    });

    it('should identify streak loss risk', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
        ], new Date('2024-01-03T10:00:00'));
        
        task.completionCount = 2;
        task.currentStreak = 0; // Lost streak
        task.bestStreak = 10; // Had a streak before

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.riskFactors).toContainEqual(
            expect.stringMatching(/streak/i)
        );
    });

    it('should identify irregular pattern risk', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-03T10:00:00',
            '2024-01-10T10:00:00',
        ], new Date('2024-01-25T10:00:00'));

        const prediction = predictor.predict(task);

        if (prediction) {
            // Should have some risk factor for inconsistency
            expect(prediction.riskFactors.length).toBeGreaterThan(0);
        }
    });

    it('should identify insufficient data risk', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
        ], new Date('2024-01-02T10:00:00'));

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.riskFactors).toContainEqual(
            expect.stringMatching(/history|data|insufficient/i)
        );
    });
});

describe('CompletionPredictor - Positive Factors', () => {
    let predictor: CompletionPredictor;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        predictor = new CompletionPredictor(analyzer);
    });

    it('should identify high completion rate as positive', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ], new Date('2024-01-04T10:00:00'));
        
        task.completionCount = 10;
        task.missCount = 1; // High completion rate

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.positiveFactors).toContainEqual(
            expect.stringMatching(/completion rate|consistent/i)
        );
    });

    it('should identify active streak as positive', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ], new Date('2024-01-04T10:00:00'));
        
        task.currentStreak = 10; // Active streak

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.positiveFactors).toContainEqual(
            expect.stringMatching(/streak/i)
        );
    });

    it('should identify consistent pattern as positive', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T09:00:00',
            '2024-01-02T09:00:00',
            '2024-01-03T09:00:00',
            '2024-01-04T09:00:00',
        ], new Date('2024-01-05T09:00:00'));

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.positiveFactors).toContainEqual(
            expect.stringMatching(/pattern|consistent|regular/i)
        );
    });
});

describe('CompletionPredictor - Reasoning', () => {
    let predictor: CompletionPredictor;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        predictor = new CompletionPredictor(analyzer);
    });

    it('should provide human-readable reasoning', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ], new Date('2024-01-04T10:00:00'));

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.reasoning).toBeTruthy();
        expect(prediction?.reasoning.length).toBeGreaterThan(10);
    });

    it('should mention confidence in reasoning', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ], new Date('2024-01-04T10:00:00'));

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.reasoning).toMatch(/confidence|likely|expect/i);
    });
});

describe('CompletionPredictor - Health Score', () => {
    let predictor: CompletionPredictor;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        predictor = new CompletionPredictor(analyzer);
    });

    it('should calculate health score between 0 and 100', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
            '2024-01-03T10:00:00',
        ], new Date('2024-01-04T10:00:00'));
        
        task.completionCount = 3;
        task.missCount = 1;

        const score = predictor.calculateHealthScore(task);

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
    });

    it('should give high score for consistent task', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T09:00:00',
            '2024-01-02T09:00:00',
            '2024-01-03T09:00:00',
            '2024-01-04T09:00:00',
        ], new Date('2024-01-05T09:00:00'));
        
        task.completionCount = 10;
        task.missCount = 0;
        task.currentStreak = 10;

        const score = predictor.calculateHealthScore(task);

        expect(score).toBeGreaterThan(70);
    });

    it('should give low score for problematic task', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
        ], new Date('2024-01-10T10:00:00'));
        
        task.completionCount = 1;
        task.missCount = 10;
        task.currentStreak = 0;

        const score = predictor.calculateHealthScore(task);

        expect(score).toBeLessThan(50);
    });
});

describe('CompletionPredictor - Batch Predictions', () => {
    let predictor: CompletionPredictor;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        predictor = new CompletionPredictor(analyzer);
    });

    it('should predict multiple tasks at once', () => {
        const tasks = [
            createTaskWithCompletions([
                '2024-01-01T10:00:00',
                '2024-01-02T10:00:00',
            ], new Date('2024-01-03T10:00:00')),
            createTaskWithCompletions([
                '2024-01-01T11:00:00',
                '2024-01-08T11:00:00',
            ], new Date('2024-01-15T11:00:00')),
        ];

        const predictions = predictor.predictBatch(tasks);

        expect(predictions.size).toBe(2);
        expect(predictions.get(tasks[0].id)).not.toBeNull();
        expect(predictions.get(tasks[1].id)).not.toBeNull();
    });

    it('should handle empty batch', () => {
        const predictions = predictor.predictBatch([]);

        expect(predictions.size).toBe(0);
    });

    it('should handle batch with one task ', () => {
        const tasks = [
            createTaskWithCompletions([
                '2024-01-01T10:00:00',
            ], new Date('2024-01-02T10:00:00')),
        ];

        const predictions = predictor.predictBatch(tasks);

        expect(predictions.size).toBe(1);
    });
});

describe('CompletionPredictor - Configuration', () => {
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
    });

    it('should respect min completions setting', () => {
        const predictor = new CompletionPredictor(analyzer, {
            minCompletions: 5,
        });
        
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
        ], new Date('2024-01-03T10:00:00'));

        const prediction = predictor.predict(task);

        if (prediction) {
            // Should note insufficient data in risk factors
            expect(prediction.riskFactors).toContainEqual(
                expect.stringMatching(/history|data|insufficient/i)
            );
        }
    });

    it('should respect confidence weight configuration', () => {
        const predictor1 = new CompletionPredictor(analyzer, {
            completionRateWeight: 1.0,
            streakWeight: 0.0,
            timeOfDayWeight: 0.0,
        });
        
        const predictor2 = new CompletionPredictor(analyzer, {
            completionRateWeight: 0.0,
            streakWeight: 1.0,
            timeOfDayWeight: 0.0,
        });
        
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
        ], new Date('2024-01-03T10:00:00'));
        
        task.completionCount = 10;
        task.missCount = 1;
        task.currentStreak = 5;

        const pred1 = predictor1.predict(task);
        const pred2 = predictor2.predict(task);

        // Different weights should produce different confidence scores
        if (pred1 && pred2) {
            expect(pred1.confidence).not.toBe(pred2.confidence);
        }
    });

    it('should respect window size configuration', () => {
        const predictor = new CompletionPredictor(analyzer, {
            windowSizeHours: 48, // 2 days
        });
        
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
        ], new Date('2024-01-03T10:00:00'));

        const prediction = predictor.predict(task);

        if (prediction) {
            const windowSize = prediction.window.latest.getTime() - 
                             prediction.window.earliest.getTime();
            const expectedSize = 48 * 60 * 60 * 1000; // 48 hours
            
            expect(windowSize).toBe(expectedSize);
        }
    });
});

describe('CompletionPredictor - Edge Cases', () => {
    let predictor: CompletionPredictor;
    let analyzer: PatternAnalyzer;

    beforeEach(() => {
        analyzer = new PatternAnalyzer();
        predictor = new CompletionPredictor(analyzer);
    });

    it('should handle task with no completions', () => {
        const task = createTaskWithCompletions([], new Date('2024-01-01T10:00:00'));

        const prediction = predictor.predict(task);

        // Should provide fallback prediction
        expect(prediction).not.toBeNull();
    });

    it('should handle task with one completion', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
        ], new Date('2024-01-02T10:00:00'));

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.confidence).toBeLessThan(0.7); // Low confidence
    });

    it('should handle task with very old completions', () => {
        const task = createTaskWithCompletions([
            '2020-01-01T10:00:00',
            '2020-01-02T10:00:00',
        ], new Date('2024-01-01T10:00:00'));

        const prediction = predictor.predict(task);

        if (prediction) {
            // Should note old history in risk factors or reasoning
            expect(
                prediction.riskFactors.length > 0 || 
                prediction.reasoning.length > 0
            ).toBe(true);
        }
    });

    it('should handle task due in the past', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T10:00:00',
            '2024-01-02T10:00:00',
        ], new Date('2023-12-31T10:00:00')); // Due in past

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
    });

    it('should handle task with perfect completion record', () => {
        const task = createTaskWithCompletions([
            '2024-01-01T09:00:00',
            '2024-01-02T09:00:00',
            '2024-01-03T09:00:00',
            '2024-01-04T09:00:00',
        ], new Date('2024-01-05T09:00:00'));
        
        task.completionCount = 100;
        task.missCount = 0;
        task.currentStreak = 100;

        const prediction = predictor.predict(task);

        expect(prediction).not.toBeNull();
        expect(prediction?.confidence).toBeGreaterThan(0.8);
        expect(prediction?.onTimeLikelihood).toBeGreaterThan(0.8);
    });
});

// Helper function to create test tasks with completions
function createTaskWithCompletions(
    timestamps: string[],
    dueAt: Date
): Task {
    return {
        id: `test-task-${Math.random()}`,
        name: 'Test Task',
        dueAt: dueAt.toISOString(),
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
