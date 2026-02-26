/**
 * Tests for SmartSuggestionEngine (event-driven refactor)
 *
 * The engine is now synchronous and takes a trigger string instead of allTasks.
 * Cross-task patterns (consolidation/delegation) are handled by AIOrchestrator.
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
    it('should detect abandonment candidates on task:complete', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 5,
        completionCount: 0,
      });

      const suggestions = engine.analyzeTask(task, 'task:complete');

      expect(suggestions.length).toBeGreaterThan(0);
      const abandonSuggestion = suggestions.find(s => s.type === 'abandon');
      expect(abandonSuggestion).toBeDefined();
      expect(abandonSuggestion?.confidence).toBeGreaterThan(0.8);
      expect(abandonSuggestion?.triggeredBy).toBe('task:complete');
    });

    it('should detect abandonment on task:skip', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 5,
        completionCount: 0,
      });

      const suggestions = engine.analyzeTask(task, 'task:skip');

      const abandonSuggestion = suggestions.find(s => s.type === 'abandon');
      expect(abandonSuggestion).toBeDefined();
    });

    it('should detect abandonment on task:missed', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 5,
        completionCount: 0,
      });

      const suggestions = engine.analyzeTask(task, 'task:missed');

      const abandonSuggestion = suggestions.find(s => s.type === 'abandon');
      expect(abandonSuggestion).toBeDefined();
    });

    it('should suggest reschedule based on completion patterns', () => {
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

      const suggestions = engine.analyzeTask(task, 'task:complete');

      const rescheduleSuggestion = suggestions.find(s => s.type === 'reschedule');
      expect(rescheduleSuggestion).toBeDefined();
      expect(rescheduleSuggestion?.action.parameters.hour).toBe(9);
    });

    it('should suggest urgency for tasks with high miss count', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 3,
        priority: 'medium',
      });

      const suggestions = engine.analyzeTask(task, 'task:complete');

      const urgencySuggestion = suggestions.find(s => s.type === 'urgency');
      expect(urgencySuggestion).toBeDefined();
      expect(urgencySuggestion?.action.parameters.priority).toBe('high');
    });

    it('should not suggest urgency if already high priority', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 3,
        priority: 'high',
      });

      const suggestions = engine.analyzeTask(task, 'task:complete');

      const urgencySuggestion = suggestions.find(s => s.type === 'urgency');
      expect(urgencySuggestion).toBeUndefined();
    });

    it('should run all checks with manual trigger', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 5,
        completionCount: 0,
      });

      const suggestions = engine.analyzeTask(task, 'manual');

      // 'manual' runs all checks — should include abandon + urgency at minimum
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.find(s => s.type === 'abandon')).toBeDefined();
      expect(suggestions.find(s => s.type === 'urgency')).toBeDefined();
    });

    it('should only check urgency on task:overdue', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 5,
        completionCount: 0,
        priority: 'low',
      });

      const suggestions = engine.analyzeTask(task, 'task:overdue');

      // task:overdue only checks urgency
      expect(suggestions.every(s => s.type === 'urgency')).toBe(true);
    });

    it('should include applied=false and dismissed=false on new suggestions', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 5,
        completionCount: 0,
      });

      const suggestions = engine.analyzeTask(task, 'task:complete');

      for (const s of suggestions) {
        expect(s.applied).toBe(false);
        expect(s.dismissed).toBe(false);
        expect(s.triggeredBy).toBe('task:complete');
        expect(s.taskId).toBe(task.id);
        expect(s.createdAt).toBeDefined();
      }
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

      expect(engine.detectAbandonmentCandidate(task)).toBe(true);
    });

    it('should detect tasks with very low completion rate', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 18,
        completionCount: 1,
      });

      expect(engine.detectAbandonmentCandidate(task)).toBe(true);
    });

    it('should not flag tasks with good completion rate', () => {
      const engine = new SmartSuggestionEngine();
      const task = createMockTask({
        missCount: 2,
        completionCount: 10,
      });

      expect(engine.detectAbandonmentCandidate(task)).toBe(false);
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
      expect(similar[0]!.id).toBe('task-2');
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
});
