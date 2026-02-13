/**
 * Tests for SmartSuggestionEngine
 */

import { describe, it, expect } from 'vitest';
import { SmartSuggestionEngine } from '../SmartSuggestionEngine';
import type { Task } from '@backend/core/models/Task';

describe('SmartSuggestionEngine', () => {
  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'test-task-1',
    name: 'Test Task',
    dueAt: new Date('2024-01-15T09:00:00Z').toISOString(),
    frequency: { type: 'daily', interval: 1, time: '09:00' },
    enabled: true,
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    completionCount: 0,
    missCount: 0,
    ...overrides,
  });

  describe('analyzeTask', () => {
    it('should detect abandonment candidates', async () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 5,
        completionCount: 0,
      });

      const suggestions = await engine.analyzeTask(task, []);

      expect(suggestions.length).toBeGreaterThan(0);
      const abandonSuggestion = suggestions.find(s => s.type === 'abandon');
      expect(abandonSuggestion).toBeDefined();
      expect(abandonSuggestion?.confidence).toBeGreaterThan(0.8);
    });

    it('should suggest reschedule based on completion patterns', async () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        dueAt: new Date('2024-01-15T20:00:00Z').toISOString(),
        completionContexts: [
          { dayOfWeek: 1, hourOfDay: 9, wasOverdue: false },
          { dayOfWeek: 2, hourOfDay: 9, wasOverdue: false },
          { dayOfWeek: 3, hourOfDay: 9, wasOverdue: false },
          { dayOfWeek: 4, hourOfDay: 9, wasOverdue: false },
        ],
      });

      const suggestions = await engine.analyzeTask(task, []);

      const rescheduleSuggestion = suggestions.find(s => s.type === 'reschedule');
      expect(rescheduleSuggestion).toBeDefined();
      expect(rescheduleSuggestion?.action.parameters.hour).toBe(9);
    });

    it('should suggest urgency for tasks with high miss count', async () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 3,
        priority: 'medium',
      });

      const suggestions = await engine.analyzeTask(task, []);

      const urgencySuggestion = suggestions.find(s => s.type === 'urgency');
      expect(urgencySuggestion).toBeDefined();
      expect(urgencySuggestion?.action.parameters.priority).toBe('high');
    });

    it('should not suggest urgency if already high priority', async () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 3,
        priority: 'high',
      });

      const suggestions = await engine.analyzeTask(task, []);

      const urgencySuggestion = suggestions.find(s => s.type === 'urgency');
      expect(urgencySuggestion).toBeUndefined();
    });
  });

  describe('predictBestTime', () => {
    it('should return low confidence with insufficient data', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        completionContexts: [
          { dayOfWeek: 1, hourOfDay: 9, wasOverdue: false },
        ],
      });

      const result = engine.predictBestTime(task);

      expect(result.confidence).toBe(0);
    });

    it('should predict best time based on historical data', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        completionContexts: [
          { dayOfWeek: 1, hourOfDay: 9, wasOverdue: false },
          { dayOfWeek: 2, hourOfDay: 9, wasOverdue: false },
          { dayOfWeek: 3, hourOfDay: 9, wasOverdue: false },
          { dayOfWeek: 4, hourOfDay: 10, wasOverdue: false },
          { dayOfWeek: 5, hourOfDay: 9, wasOverdue: false },
        ],
      });

      const result = engine.predictBestTime(task);

      expect(result.hour).toBe(9);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should ignore overdue completions', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        completionContexts: [
          { dayOfWeek: 1, hourOfDay: 9, wasOverdue: false },
          { dayOfWeek: 2, hourOfDay: 9, wasOverdue: false },
          { dayOfWeek: 3, hourOfDay: 15, wasOverdue: true },
          { dayOfWeek: 4, hourOfDay: 16, wasOverdue: true },
        ],
      });

      const result = engine.predictBestTime(task);

      expect(result.hour).toBe(9);
    });
  });

  describe('detectAbandonmentCandidate', () => {
    it('should detect never-completed tasks', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 5,
        completionCount: 0,
      });

      const result = engine.detectAbandonmentCandidate(task);

      expect(result).toBe(true);
    });

    it('should detect tasks with very low completion rate', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 18,
        completionCount: 1,
      });

      const result = engine.detectAbandonmentCandidate(task);

      expect(result).toBe(true);
    });

    it('should not flag tasks with good completion rate', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 2,
        completionCount: 10,
      });

      const result = engine.detectAbandonmentCandidate(task);

      expect(result).toBe(false);
    });
  });

  describe('findSimilarTasks', () => {
    it('should find tasks with similar names', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        name: 'Review weekly reports',
      });
      const allTasks = [
        createMockTask({ id: 'task-2', name: 'Review monthly reports' }),
        createMockTask({ id: 'task-3', name: 'Send email' }),
        createMockTask({ id: 'task-4', name: 'Review quarterly reports' }),
      ];

      const similar = engine.findSimilarTasks(task, allTasks);

      expect(similar.length).toBeGreaterThan(0);
      expect(similar.some(t => t.name.includes('Review'))).toBe(true);
    });

    it('should find tasks with overlapping tags', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        name: 'Task A',
        tags: ['work', 'urgent', 'review'],
      });
      const allTasks = [
        createMockTask({ id: 'task-2', name: 'Task B', tags: ['work', 'urgent'] }),
        createMockTask({ id: 'task-3', name: 'Task C', tags: ['personal'] }),
      ];

      const similar = engine.findSimilarTasks(task, allTasks);

      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].id).toBe('task-2');
    });

    it('should find tasks in same category', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        name: 'Project update',
        category: 'work',
      });
      const allTasks = [
        createMockTask({ id: 'task-2', name: 'Project review', category: 'work' }),
        createMockTask({ id: 'task-3', name: 'Shopping', category: 'personal' }),
      ];

      const similar = engine.findSimilarTasks(task, allTasks);

      expect(similar.some(t => t.category === 'work')).toBe(true);
    });
  });

  describe('analyzeCrossTaskPatterns', () => {
    it('should suggest consolidation for similar tasks on same day', async () => {
      const engine = new SmartSuggestionEngine();
      const sameDay = new Date('2024-01-15T09:00:00Z').toISOString();
      const tasks = [
        createMockTask({ id: 'task-1', name: 'Review report A', dueAt: sameDay }),
        createMockTask({ id: 'task-2', name: 'Review report B', dueAt: sameDay }),
        createMockTask({ id: 'task-3', name: 'Review report C', dueAt: sameDay }),
      ];

      const suggestions = await engine.analyzeCrossTaskPatterns(tasks);

      const consolidateSuggestion = suggestions.find(s => s.type === 'consolidate');
      expect(consolidateSuggestion).toBeDefined();
    });

    it('should suggest delegation for consistently delayed tags', async () => {
      const engine = new SmartSuggestionEngine();
      const tasks = [
        createMockTask({
          id: 'task-1',
          tags: ['review'],
          completionTimes: [Date.now()],
          completionContexts: [
            { dayOfWeek: 1, hourOfDay: 9, wasOverdue: false, delayMinutes: 120 },
            { dayOfWeek: 2, hourOfDay: 9, wasOverdue: false, delayMinutes: 150 },
            { dayOfWeek: 3, hourOfDay: 9, wasOverdue: false, delayMinutes: 180 },
            { dayOfWeek: 4, hourOfDay: 9, wasOverdue: false, delayMinutes: 140 },
            { dayOfWeek: 5, hourOfDay: 9, wasOverdue: false, delayMinutes: 160 },
          ],
        }),
      ];

      const suggestions = await engine.analyzeCrossTaskPatterns(tasks);

      const delegateSuggestion = suggestions.find(s => s.type === 'delegate');
      expect(delegateSuggestion).toBeDefined();
      expect(delegateSuggestion?.reason).toContain('review');
    });
  });
});
