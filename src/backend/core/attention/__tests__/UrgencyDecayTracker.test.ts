/**
 * Tests for UrgencyDecayTracker — per-task ignore tracking and urgency decay.
 *
 * Covers:
 *   - recordIgnore: decay multiplier reduction
 *   - resetOnCompletion: full reset
 *   - resetOnSnooze: partial reset
 *   - getMultiplier: default 1.0 for unknown tasks
 *   - clear: full state wipe
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UrgencyDecayTracker } from '../UrgencyDecayTracker';
import { URGENCY_DECAY_FACTOR, URGENCY_DECAY_FLOOR } from '../AttentionGateTypes';

// Mock plugin with loadData/saveData
function createMockPlugin(initialData: Record<string, unknown> = {}) {
  const storage = new Map(Object.entries(initialData));
  return {
    loadData: vi.fn(async (key: string) => storage.get(key) ?? null),
    saveData: vi.fn(async (key: string, data: unknown) => {
      storage.set(key, data);
    }),
  } as any;
}

describe('UrgencyDecayTracker', () => {
  let tracker: UrgencyDecayTracker;
  let plugin: ReturnType<typeof createMockPlugin>;

  beforeEach(() => {
    plugin = createMockPlugin();
    tracker = new UrgencyDecayTracker(plugin);
  });

  describe('initial state', () => {
    it('should return 1.0 multiplier for unknown tasks', () => {
      expect(tracker.getMultiplier('unknown-task')).toBe(1.0);
    });

    it('should return undefined decay entry for unknown tasks', () => {
      expect(tracker.getDecayEntry('unknown-task')).toBeUndefined();
    });
  });

  describe('recordIgnore', () => {
    it('should reduce multiplier by decay factor', () => {
      tracker.recordIgnore('task-1');

      const entry = tracker.getDecayEntry('task-1');
      expect(entry).toBeDefined();
      expect(entry!.ignoreCount).toBe(1);
      expect(entry!.currentMultiplier).toBeCloseTo(1.0 * URGENCY_DECAY_FACTOR, 4);
    });

    it('should compound decay on repeated ignores', () => {
      tracker.recordIgnore('task-1');
      tracker.recordIgnore('task-1');
      tracker.recordIgnore('task-1');

      const entry = tracker.getDecayEntry('task-1');
      expect(entry!.ignoreCount).toBe(3);
      expect(entry!.currentMultiplier).toBeCloseTo(
        1.0 * URGENCY_DECAY_FACTOR * URGENCY_DECAY_FACTOR * URGENCY_DECAY_FACTOR,
        4
      );
    });

    it('should never decay below floor', () => {
      // Apply many ignores
      for (let i = 0; i < 50; i++) {
        tracker.recordIgnore('task-1');
      }

      const multiplier = tracker.getMultiplier('task-1');
      expect(multiplier).toBeGreaterThanOrEqual(URGENCY_DECAY_FLOOR);
    });

    it('should update lastIgnoredAt timestamp', () => {
      const now = 1700000000000;
      tracker.recordIgnore('task-1', now);

      const entry = tracker.getDecayEntry('task-1');
      expect(entry!.lastIgnoredAt).toBe(now);
    });
  });

  describe('resetOnCompletion', () => {
    it('should remove decay entry entirely', () => {
      tracker.recordIgnore('task-1');
      tracker.recordIgnore('task-1');

      tracker.resetOnCompletion('task-1');

      expect(tracker.getDecayEntry('task-1')).toBeUndefined();
      expect(tracker.getMultiplier('task-1')).toBe(1.0);
    });

    it('should be a no-op for tasks without decay', () => {
      tracker.resetOnCompletion('unknown-task');
      expect(tracker.getMultiplier('unknown-task')).toBe(1.0);
    });
  });

  describe('resetOnSnooze', () => {
    it('should partially restore multiplier', () => {
      tracker.recordIgnore('task-1');
      tracker.recordIgnore('task-1');
      tracker.recordIgnore('task-1');

      const before = tracker.getMultiplier('task-1');
      tracker.resetOnSnooze('task-1');
      const after = tracker.getMultiplier('task-1');

      // Snooze restores halfway: (before + 1.0) / 2
      expect(after).toBeCloseTo((before + 1.0) / 2, 4);
      expect(after).toBeGreaterThan(before);
    });

    it('should be a no-op for tasks without decay', () => {
      tracker.resetOnSnooze('unknown-task');
      expect(tracker.getMultiplier('unknown-task')).toBe(1.0);
    });
  });

  describe('remove', () => {
    it('should delete a specific task decay entry', () => {
      tracker.recordIgnore('task-1');
      tracker.recordIgnore('task-2');

      tracker.remove('task-1');

      expect(tracker.getDecayEntry('task-1')).toBeUndefined();
      expect(tracker.getDecayEntry('task-2')).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should wipe all decay state', () => {
      tracker.recordIgnore('task-1');
      tracker.recordIgnore('task-2');
      tracker.recordIgnore('task-3');

      tracker.clear();

      expect(tracker.getMultiplier('task-1')).toBe(1.0);
      expect(tracker.getMultiplier('task-2')).toBe(1.0);
      expect(tracker.getMultiplier('task-3')).toBe(1.0);
    });
  });

  describe('persistence', () => {
    it('should load from plugin storage', async () => {
      const stored = {
        'task-1': { ignoreCount: 3, currentMultiplier: 0.5, lastIgnoredAt: 1700000000000 },
      };
      const pluginWithData = createMockPlugin({ 'attention-urgency-decay': stored });
      const tracker2 = new UrgencyDecayTracker(pluginWithData);

      await tracker2.load();

      expect(tracker2.getMultiplier('task-1')).toBe(0.5);
      expect(tracker2.getDecayEntry('task-1')?.ignoreCount).toBe(3);
    });

    it('should save dirty state to plugin storage', async () => {
      tracker.recordIgnore('task-1');
      await tracker.save();

      expect(plugin.saveData).toHaveBeenCalledWith(
        'attention-urgency-decay',
        expect.objectContaining({
          'task-1': expect.objectContaining({ ignoreCount: 1 }),
        })
      );
    });

    it('should not save when not dirty', async () => {
      await tracker.save();
      expect(plugin.saveData).not.toHaveBeenCalled();
    });
  });
});
