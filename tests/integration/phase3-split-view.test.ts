/**
 * Phase 3 Integration Tests
 * Tests for split-view dashboard settings and integration
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from '@backend/core/settings/PluginSettings';

describe('Phase 3: Split-View Dashboard Settings', () => {
  describe('Default Settings', () => {
    it('should include split-view dashboard settings in defaults', () => {
      expect(DEFAULT_SETTINGS.splitViewDashboard).toBeDefined();
      expect(DEFAULT_SETTINGS.splitViewDashboard.useSplitViewDashboard).toBe(true);
      expect(DEFAULT_SETTINGS.splitViewDashboard.splitViewRatio).toBe(0.4);
      expect(DEFAULT_SETTINGS.splitViewDashboard.autoSaveDelay).toBe(500);
    });
  });

  describe('Settings Merging', () => {
    it('should merge split-view dashboard settings', () => {
      const userSettings = {
        splitViewDashboard: {
          useSplitViewDashboard: false,
          splitViewRatio: 0.5,
          autoSaveDelay: 1000,
        },
      };

      const merged = mergeSettings(userSettings);

      expect(merged.splitViewDashboard.useSplitViewDashboard).toBe(false);
      expect(merged.splitViewDashboard.splitViewRatio).toBe(0.5);
      expect(merged.splitViewDashboard.autoSaveDelay).toBe(1000);
    });

    it('should use defaults when split-view settings are not provided', () => {
      const userSettings = {};

      const merged = mergeSettings(userSettings);

      expect(merged.splitViewDashboard).toEqual(DEFAULT_SETTINGS.splitViewDashboard);
    });

    it('should merge partial split-view settings with defaults', () => {
      const userSettings = {
        splitViewDashboard: {
          useSplitViewDashboard: false,
        },
      };

      const merged = mergeSettings(userSettings as any);

      expect(merged.splitViewDashboard.useSplitViewDashboard).toBe(false);
      expect(merged.splitViewDashboard.splitViewRatio).toBe(0.4);
      expect(merged.splitViewDashboard.autoSaveDelay).toBe(500);
    });
  });

  describe('Settings Validation', () => {
    it('should have valid split ratio range', () => {
      const ratio = DEFAULT_SETTINGS.splitViewDashboard.splitViewRatio;
      expect(ratio).toBeGreaterThanOrEqual(0.2);
      expect(ratio).toBeLessThanOrEqual(0.6);
    });

    it('should have valid auto-save delay', () => {
      const delay = DEFAULT_SETTINGS.splitViewDashboard.autoSaveDelay;
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(2000);
    });
  });
});

describe('Debounce Utility', () => {
  it('should debounce function calls', async () => {
    const { debounce } = await import('@/utils/debounce');
    
    let callCount = 0;
    const increment = () => callCount++;
    
    const debouncedIncrement = debounce(increment, 100);
    
    // Call multiple times in quick succession
    debouncedIncrement();
    debouncedIncrement();
    debouncedIncrement();
    
    // Should not have been called yet
    expect(callCount).toBe(0);
    
    // Wait for debounce delay
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should have been called once
    expect(callCount).toBe(1);
  });
});
