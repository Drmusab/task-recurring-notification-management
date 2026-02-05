import { describe, it, expect } from 'vitest';
import { SmartRecurrenceEngine, PatternAnalyzer } from "@backend/core/ml/PatternLearner";
import type { Task, CompletionHistoryEntry } from '@backend/core/models/Task';
import type { Frequency } from '@backend/core/models/Frequency';

describe('SmartRecurrenceEngine', () => {
  const engine = new SmartRecurrenceEngine();

  function createMockTask(completionHistory: CompletionHistoryEntry[] = []): Task {
    const now = new Date().toISOString();
    return {
      id: 'test-task-1',
      name: 'Test Task',
      dueAt: now,
      frequency: { type: 'daily', interval: 1 },
      enabled: true,
      createdAt: now,
      updatedAt: now,
      completionHistory,
      completionCount: completionHistory.length,
      missCount: 0,
      smartRecurrence: {
        enabled: true,
        autoAdjust: false,
        minDataPoints: 10,
        confidenceThreshold: 0.7
      }
    };
  }

  function createCompletionHistory(
    count: number,
    avgDelayMinutes: number = 0,
    preferredHour: number = 9
  ): CompletionHistoryEntry[] {
    const history: CompletionHistoryEntry[] = [];
    const baseDate = new Date('2024-01-01T09:00:00Z');

    for (let i = 0; i < count; i++) {
      const scheduledDate = new Date(baseDate);
      scheduledDate.setDate(baseDate.getDate() + i);
      
      const completedDate = new Date(scheduledDate);
      completedDate.setHours(preferredHour);
      completedDate.setMinutes(avgDelayMinutes % 60);

      history.push({
        scheduledFor: scheduledDate.toISOString(),
        completedAt: completedDate.toISOString(),
        delayMinutes: avgDelayMinutes,
        dayOfWeek: completedDate.getDay(),
        context: {
          tags: [],
          relatedBlocks: []
        }
      });
    }

    return history;
  }

  describe('analyzeCompletionPatterns', () => {
    it('should return default insight for task with no history', () => {
      const task = createMockTask([]);
      const insight = engine.analyzeCompletionPatterns(task);

      expect(insight.confidence).toBe(0);
      expect(insight.suggestedAdjustment).toContain('Not enough data');
    });

    it('should detect preferred completion time', () => {
      const history = createCompletionHistory(15, 0, 14); // Complete at 2 PM
      const task = createMockTask(history);
      const insight = engine.analyzeCompletionPatterns(task);

      expect(insight.preferredTimeOfDay).toBe(14);
      expect(insight.confidence).toBeGreaterThan(0);
    });

    it('should calculate average delay correctly', () => {
      const history = createCompletionHistory(20, 120); // 2 hours delay
      const task = createMockTask(history);
      const insight = engine.analyzeCompletionPatterns(task);

      expect(insight.averageCompletionDelay).toBe(120);
    });

    it('should calculate consistency score', () => {
      const history = createCompletionHistory(15, 60, 10);
      const task = createMockTask(history);
      const insight = engine.analyzeCompletionPatterns(task);

      expect(insight.completionConsistency).toBeGreaterThan(0);
      expect(insight.completionConsistency).toBeLessThanOrEqual(1);
    });
  });

  describe('suggestScheduleOptimization', () => {
    it('should return null for insufficient data', () => {
      const history = createCompletionHistory(5);
      const task = createMockTask(history);
      const suggestion = engine.suggestScheduleOptimization(task);

      expect(suggestion).toBeNull();
    });

    it('should suggest time adjustment for consistent delays', () => {
      const history = createCompletionHistory(15, 180, 12); // 3 hours late, complete at noon
      const task = createMockTask(history);
      const suggestion = engine.suggestScheduleOptimization(task);

      expect(suggestion).toBeDefined();
      if (suggestion) {
        expect(suggestion.reason).toContain('12:00');
        expect(suggestion.confidence).toBeGreaterThan(0.5);
      }
    });
  });

  describe('detectAnomalies', () => {
    it('should return empty array for insufficient data', () => {
      const task = createMockTask(createCompletionHistory(3));
      const anomalies = engine.detectAnomalies(task);

      expect(anomalies).toEqual([]);
    });

    it('should detect consistently skipped tasks', () => {
      const task = createMockTask([]);
      task.completionCount = 5;
      task.missCount = 15;
      task.completionHistory = createCompletionHistory(5);
      
      const anomalies = engine.detectAnomalies(task);

      expect(anomalies.length).toBeGreaterThan(0);
    });
  });
});

describe('PatternAnalyzer', () => {
  const analyzer = new PatternAnalyzer();

  function createHistory(hours: number[]): CompletionHistoryEntry[] {
    return hours.map((hour, i) => {
      const date = new Date('2024-01-01T00:00:00Z');
      date.setDate(date.getDate() + i);
      date.setHours(hour);
      
      return {
        scheduledFor: date.toISOString(),
        completedAt: date.toISOString(),
        delayMinutes: 0,
        dayOfWeek: date.getDay(),
        context: { tags: [], relatedBlocks: [] }
      };
    });
  }

  describe('calculateOptimalTime', () => {
    it('should return default for empty history', () => {
      const result = analyzer.calculateOptimalTime([]);

      expect(result.hour).toBe(9);
      expect(result.confidence).toBe(0);
      expect(result.sampleSize).toBe(0);
    });

    it('should find most common hour', () => {
      const history = createHistory([9, 9, 9, 10, 11, 9, 9]);
      const result = analyzer.calculateOptimalTime(history);

      expect(result.hour).toBe(9);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.sampleSize).toBe(7);
    });

    it('should calculate confidence correctly', () => {
      const history = createHistory([14, 14, 14, 14, 14]); // 100% at 14:00
      const result = analyzer.calculateOptimalTime(history);

      expect(result.hour).toBe(14);
      expect(result.confidence).toBe(1);
    });
  });

  describe('findWeekdayPatterns', () => {
    it('should group completions by weekday', () => {
      const history: CompletionHistoryEntry[] = [];
      
      // Add completions for different days
      for (let i = 0; i < 14; i++) {
        const date = new Date('2024-01-01T09:00:00Z'); // Monday
        date.setDate(date.getDate() + i);
        
        history.push({
          scheduledFor: date.toISOString(),
          completedAt: date.toISOString(),
          delayMinutes: 0,
          dayOfWeek: date.getDay(),
          context: { tags: [], relatedBlocks: [] }
        });
      }

      const patterns = analyzer.findWeekdayPatterns(history);

      expect(patterns.size).toBeGreaterThan(0);
    });
  });

  describe('detectSkipPatterns', () => {
    function createTask(completionCount: number, missCount: number): Task {
      return {
        id: 'test',
        name: 'Test',
        dueAt: new Date().toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completionCount,
        missCount,
        currentStreak: 0
      };
    }

    it('should detect high skip rate', () => {
      const task = createTask(5, 15);
      const result = analyzer.detectSkipPatterns(task);

      expect(result.isAnomalous).toBe(true);
      expect(result.reason).toContain('skipped');
    });

    it('should not flag healthy tasks', () => {
      const task = createTask(15, 5);
      task.currentStreak = 3; // Has a healthy streak
      const result = analyzer.detectSkipPatterns(task);

      expect(result.isAnomalous).toBe(false);
    });
  });
});
