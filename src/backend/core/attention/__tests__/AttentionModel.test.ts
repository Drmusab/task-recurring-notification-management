/**
 * Tests for AttentionModel — behavioral attention scoring for task events.
 *
 * Covers:
 *   - computeAttentionBreakdown: all 6 factors
 *   - computeAttentionScore: multiplicative composition
 *   - computeVerdict: emit/suppress/mute decisions
 *   - Abandonment detection (mute)
 *   - Urgency decay integration
 *   - Recurrence frequency dampening
 *   - Dependency blocking penalty
 */

import { describe, it, expect } from 'vitest';
import {
  computeAttentionBreakdown,
  computeAttentionScore,
  computeVerdict,
} from '../AttentionModel';
import type { Task } from '@backend/core/models/Task';
import type { UrgencyDecayEntry } from '../AttentionGateTypes';
import { ATTENTION_THRESHOLD } from '../AttentionGateTypes';

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-task-1',
  name: 'Test Task',
  dueAt: new Date('2024-01-15T09:00:00Z').toISOString(),
  frequency: { type: 'daily', interval: 1, time: '09:00' },
  enabled: true,
  createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  completionCount: 5,
  missCount: 1,
  version: 5,
  ...overrides,
});

describe('AttentionModel', () => {
  // ─── computeAttentionBreakdown ──────────────────────────

  describe('computeAttentionBreakdown', () => {
    it('should return all 6 factors in [0, 1] range', () => {
      const task = createMockTask();
      const breakdown = computeAttentionBreakdown(task);

      expect(breakdown.urgencyWeight).toBeGreaterThanOrEqual(0);
      expect(breakdown.urgencyWeight).toBeLessThanOrEqual(1);
      expect(breakdown.recencyWeight).toBeGreaterThanOrEqual(0);
      expect(breakdown.recencyWeight).toBeLessThanOrEqual(1);
      expect(breakdown.completionProbability).toBeGreaterThanOrEqual(0);
      expect(breakdown.completionProbability).toBeLessThanOrEqual(1);
      expect(breakdown.recurrenceFrequency).toBeGreaterThanOrEqual(0);
      expect(breakdown.recurrenceFrequency).toBeLessThanOrEqual(1);
      expect(breakdown.abandonmentRisk).toBeGreaterThanOrEqual(0);
      expect(breakdown.abandonmentRisk).toBeLessThanOrEqual(1);
      expect(breakdown.dependencyBlocking).toBeGreaterThanOrEqual(0);
      expect(breakdown.dependencyBlocking).toBeLessThanOrEqual(1);
    });

    it('should give higher urgency to high-priority tasks', () => {
      const highPriority = createMockTask({ priority: 'highest' });
      const lowPriority = createMockTask({ priority: 'lowest' });

      const highBreakdown = computeAttentionBreakdown(highPriority);
      const lowBreakdown = computeAttentionBreakdown(lowPriority);

      expect(highBreakdown.urgencyWeight).toBeGreaterThan(lowBreakdown.urgencyWeight);
    });

    it('should boost urgency for overdue tasks', () => {
      const now = new Date('2024-01-16T12:00:00Z');
      const overdueTask = createMockTask({
        dueAt: new Date('2024-01-15T09:00:00Z').toISOString(),
        priority: 'normal',
      });
      const futureTask = createMockTask({
        dueAt: new Date('2024-01-20T09:00:00Z').toISOString(),
        priority: 'normal',
      });

      const overdueBreakdown = computeAttentionBreakdown(overdueTask, undefined, now);
      const futureBreakdown = computeAttentionBreakdown(futureTask, undefined, now);

      expect(overdueBreakdown.urgencyWeight).toBeGreaterThan(futureBreakdown.urgencyWeight);
    });

    it('should apply urgency decay when provided', () => {
      const task = createMockTask({ priority: 'high' });
      const decayEntry: UrgencyDecayEntry = {
        ignoreCount: 3,
        currentMultiplier: 0.5,
        lastIgnoredAt: Date.now(),
      };

      const withDecay = computeAttentionBreakdown(task, decayEntry);
      const withoutDecay = computeAttentionBreakdown(task);

      expect(withDecay.urgencyWeight).toBeLessThan(withoutDecay.urgencyWeight);
    });

    it('should give low recency weight for recently completed tasks', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      const task = createMockTask({
        lastCompletedAt: new Date('2024-01-15T09:30:00Z').toISOString(),
      });

      const breakdown = computeAttentionBreakdown(task, undefined, now);
      expect(breakdown.recencyWeight).toBeLessThan(0.50);
    });

    it('should give high recency weight for tasks not completed recently', () => {
      const now = new Date('2024-01-20T10:00:00Z');
      const task = createMockTask({
        lastCompletedAt: new Date('2024-01-10T09:00:00Z').toISOString(),
      });

      const breakdown = computeAttentionBreakdown(task, undefined, now);
      expect(breakdown.recencyWeight).toBeGreaterThanOrEqual(0.80);
    });

    it('should give full recency weight for never-completed tasks', () => {
      const task = createMockTask({ lastCompletedAt: undefined });
      const breakdown = computeAttentionBreakdown(task);
      expect(breakdown.recencyWeight).toBe(1.0);
    });

    it('should compute completion probability from rate', () => {
      const healthyTask = createMockTask({ completionCount: 8, missCount: 2 });
      const unhealthyTask = createMockTask({ completionCount: 2, missCount: 8 });

      const healthyBreakdown = computeAttentionBreakdown(healthyTask);
      const unhealthyBreakdown = computeAttentionBreakdown(unhealthyTask);

      expect(healthyBreakdown.completionProbability).toBeGreaterThan(unhealthyBreakdown.completionProbability);
    });

    it('should give benefit of doubt to new tasks', () => {
      const newTask = createMockTask({ completionCount: 0, missCount: 0 });
      const breakdown = computeAttentionBreakdown(newTask);
      expect(breakdown.completionProbability).toBeGreaterThanOrEqual(0.70);
    });

    it('should dampen daily recurring tasks', () => {
      const dailyTask = createMockTask({
        recurrence: { rrule: 'FREQ=DAILY;INTERVAL=1' },
      });
      const monthlyTask = createMockTask({
        recurrence: { rrule: 'FREQ=MONTHLY;INTERVAL=1' },
      });

      const dailyBreakdown = computeAttentionBreakdown(dailyTask);
      const monthlyBreakdown = computeAttentionBreakdown(monthlyTask);

      expect(dailyBreakdown.recurrenceFrequency).toBeLessThan(monthlyBreakdown.recurrenceFrequency);
    });

    it('should give full frequency weight to non-recurring tasks', () => {
      const oneTimeTask = createMockTask({
        recurrence: undefined,
        frequency: undefined,
      });

      const breakdown = computeAttentionBreakdown(oneTimeTask);
      expect(breakdown.recurrenceFrequency).toBe(1.0);
    });

    it('should return 0 abandonment risk for abandoned tasks', () => {
      const abandonedTask = createMockTask({
        completionCount: 0,
        missCount: 5,
      });

      const breakdown = computeAttentionBreakdown(abandonedTask);
      expect(breakdown.abandonmentRisk).toBe(0);
    });

    it('should return 0 abandonment risk for very low completion rate', () => {
      const lowRateTask = createMockTask({
        completionCount: 0,
        missCount: 12,
      });

      const breakdown = computeAttentionBreakdown(lowRateTask);
      expect(breakdown.abandonmentRisk).toBe(0);
    });

    it('should penalize tasks with declared dependencies', () => {
      const blockedTask = createMockTask({
        blockedBy: ['task-a', 'task-b'],
      });
      const unblockedTask = createMockTask({
        blockedBy: undefined,
        dependsOn: undefined,
      });

      const blockedBreakdown = computeAttentionBreakdown(blockedTask);
      const unblockedBreakdown = computeAttentionBreakdown(unblockedTask);

      expect(blockedBreakdown.dependencyBlocking).toBeLessThan(unblockedBreakdown.dependencyBlocking);
      expect(unblockedBreakdown.dependencyBlocking).toBe(1.0);
    });
  });

  // ─── computeAttentionScore ──────────────────────────────

  describe('computeAttentionScore', () => {
    it('should return product of all factors', () => {
      const breakdown = {
        urgencyWeight: 0.5,
        recencyWeight: 0.8,
        completionProbability: 0.7,
        recurrenceFrequency: 0.9,
        abandonmentRisk: 1.0,
        dependencyBlocking: 1.0,
      };

      const score = computeAttentionScore(breakdown);
      const expected = 0.5 * 0.8 * 0.7 * 0.9 * 1.0 * 1.0;
      expect(score).toBeCloseTo(expected, 4);
    });

    it('should return 0 when any factor is 0', () => {
      const breakdown = {
        urgencyWeight: 0.8,
        recencyWeight: 0.9,
        completionProbability: 0.7,
        recurrenceFrequency: 0.6,
        abandonmentRisk: 0, // abandoned
        dependencyBlocking: 1.0,
      };

      expect(computeAttentionScore(breakdown)).toBe(0);
    });

    it('should clamp score to [0, 1]', () => {
      const highBreakdown = {
        urgencyWeight: 1.0,
        recencyWeight: 1.0,
        completionProbability: 1.0,
        recurrenceFrequency: 1.0,
        abandonmentRisk: 1.0,
        dependencyBlocking: 1.0,
      };

      expect(computeAttentionScore(highBreakdown)).toBeLessThanOrEqual(1.0);
      expect(computeAttentionScore(highBreakdown)).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── computeVerdict ─────────────────────────────────────

  describe('computeVerdict', () => {
    it('should emit for high-priority healthy tasks', () => {
      const task = createMockTask({
        priority: 'high',
        completionCount: 10,
        missCount: 1,
        dueAt: new Date('2024-01-14T09:00:00Z').toISOString(),
      });

      const now = new Date('2024-01-15T12:00:00Z');
      const verdict = computeVerdict(task, undefined, now);

      expect(verdict.action).toBe('emit');
      expect(verdict.score).toBeGreaterThanOrEqual(ATTENTION_THRESHOLD);
    });

    it('should mute abandoned tasks', () => {
      const task = createMockTask({
        completionCount: 0,
        missCount: 7,
      });

      const verdict = computeVerdict(task);

      expect(verdict.action).toBe('mute');
      expect(verdict.reason).toContain('muted');
    });

    it('should mute tasks with very low completion rate over many events', () => {
      const task = createMockTask({
        completionCount: 0,
        missCount: 15,
      });

      const verdict = computeVerdict(task);
      expect(verdict.action).toBe('mute');
    });

    it('should suppress low-priority frequently recurring tasks', () => {
      const task = createMockTask({
        priority: 'lowest',
        completionCount: 3,
        missCount: 3,
        recurrence: { rrule: 'FREQ=DAILY;INTERVAL=1' },
        // Recently completed — low recency weight
        lastCompletedAt: new Date('2024-01-15T08:00:00Z').toISOString(),
      });

      const now = new Date('2024-01-15T09:30:00Z');
      const verdict = computeVerdict(task, undefined, now);

      // This combination: low priority × recent completion × daily recurrence × 50% completion rate
      // Should result in very low score → suppress
      expect(verdict.action).toBe('suppress');
      expect(verdict.score).toBeLessThan(ATTENTION_THRESHOLD);
    });

    it('should include reason in verdict', () => {
      const task = createMockTask({
        completionCount: 0,
        missCount: 6,
      });

      const verdict = computeVerdict(task);
      expect(verdict.reason).toBeTruthy();
      expect(verdict.reason.length).toBeGreaterThan(0);
    });

    it('should apply decay entry to urgency calculation', () => {
      const task = createMockTask({
        priority: 'high',
        completionCount: 8,
        missCount: 2,
      });

      const heavyDecay: UrgencyDecayEntry = {
        ignoreCount: 10,
        currentMultiplier: 0.10,
        lastIgnoredAt: Date.now(),
      };

      const withDecay = computeVerdict(task, heavyDecay);
      const withoutDecay = computeVerdict(task);

      expect(withDecay.score).toBeLessThan(withoutDecay.score);
    });
  });
});
