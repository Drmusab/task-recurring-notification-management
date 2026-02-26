/**
 * Task Analytics Store — Pure Reactive Observer
 *
 * Session 24 refactored: All backend analytics imports removed.
 * The store receives pre-computed AnalyticsDTO from UIQueryService —
 * it NEVER imports or calls backend analytics calculators.
 *
 * FORBIDDEN:
 *   ❌ import calculateTaskAnalytics from backend
 *   ❌ import getHealthBreakdown from backend
 *   ❌ Import Task / domain model
 *   ❌ Call backend calculation functions
 *
 * Components subscribe to this for live updates.
 */

import { writable, derived, type Readable } from 'svelte/store';
import type { AnalyticsDTO } from '../services/DTOs';
import { uiQueryService } from '../services/UIQueryService';

/**
 * Analytics state interface — mirrors AnalyticsDTO + UI metadata
 */
export interface AnalyticsState extends AnalyticsDTO {
  lastUpdated: number; // timestamp
  isStale: boolean; // true if tasks changed but analytics not recalculated
}

/**
 * Create initial empty state
 */
function createInitialState(): AnalyticsState {
  return {
    totalTasks: 0,
    activeTasks: 0,
    disabledTasks: 0,
    completionRate: 0,
    missRate: 0,
    totalCompletions: 0,
    totalMisses: 0,
    bestCurrentStreak: 0,
    bestOverallStreak: 0,
    overdueCount: 0,
    dueTodayCount: 0,
    dueThisWeekCount: 0,
    averageHealth: 0,
    healthBreakdown: {
      healthy: 0,
      moderate: 0,
      struggling: 0,
    },
    lastUpdated: Date.now(),
    isStale: false,
  };
}

/**
 * Internal writable store
 */
const { subscribe, set, update } = writable<AnalyticsState>(createInitialState());

/**
 * Task Analytics Store
 *
 * Exposed methods:
 * - subscribe: Subscribe to analytics updates
 * - recalculate: Refresh analytics from UIQueryService
 * - markStale: Mark analytics as stale (needs recalculation)
 * - reset: Reset to empty state
 */
export const taskAnalyticsStore = {
  subscribe,

  /**
   * Recalculate analytics by querying UIQueryService.
   * Accepts optional tasks parameter for backward compatibility,
   * but ignores it — always reads from UIQueryService.
   */
  recalculate(_tasks?: unknown[]): void {
    const analyticsDTO = uiQueryService.selectAnalytics();

    set({
      ...analyticsDTO,
      lastUpdated: Date.now(),
      isStale: false,
    });
  },

  /**
   * Mark analytics as stale (needs recalculation)
   */
  markStale(): void {
    update(state => ({
      ...state,
      isStale: true,
    }));
  },

  /**
   * Reset to initial empty state
   */
  reset(): void {
    set(createInitialState());
  },

  /**
   * Get current state snapshot (non-reactive)
   */
  getSnapshot(): AnalyticsState {
    let current: AnalyticsState;
    subscribe(value => { current = value; })();
    return current!;
  },
};

/**
 * Derived store: Is analytics loading/calculating
 */
export const analyticsIsLoading = writable<boolean>(false);

/**
 * Derived store: Completion rate formatted as percentage string
 */
export const completionRateFormatted: Readable<string> = derived(
  taskAnalyticsStore,
  $analytics => `${$analytics.completionRate.toFixed(1)}%`
);

/**
 * Derived store: Miss rate formatted as percentage string
 */
export const missRateFormatted: Readable<string> = derived(
  taskAnalyticsStore,
  $analytics => `${$analytics.missRate.toFixed(1)}%`
);

/**
 * Derived store: Health breakdown formatted
 */
export const healthSummary: Readable<string> = derived(
  taskAnalyticsStore,
  $analytics => {
    const { healthy, moderate, struggling } = $analytics.healthBreakdown;
    return `✅ ${healthy} | ⚠️ ${moderate} | 🔴 ${struggling}`;
  }
);

/**
 * Derived store: Overall health status
 */
export const overallHealthStatus: Readable<'excellent' | 'good' | 'fair' | 'poor'> = derived(
  taskAnalyticsStore,
  $analytics => {
    const avgHealth = $analytics.averageHealth;
    if (avgHealth >= 90) return 'excellent';
    if (avgHealth >= 70) return 'good';
    if (avgHealth >= 50) return 'fair';
    return 'poor';
  }
);

/**
 * Derived store: Streak status emoji
 */
export const streakEmoji: Readable<string> = derived(
  taskAnalyticsStore,
  $analytics => {
    const streak = $analytics.bestCurrentStreak;
    if (streak >= 30) return '🔥🔥🔥';
    if (streak >= 10) return '🔥🔥';
    if (streak >= 3) return '🔥';
    return '✨';
  }
);

/**
 * Helper: Update analytics when tasks change.
 * Accepts tasks parameter for backward compatibility (ignored).
 * Delegates to UIQueryService.selectAnalytics() internally.
 */
export function updateAnalyticsFromTasks(_tasks?: unknown[]): void {
  analyticsIsLoading.set(true);

  try {
    taskAnalyticsStore.recalculate();
  } catch (error) {
    console.error('Failed to recalculate analytics:', error);
    // Non-fatal - analytics can be stale, don't block UI
  } finally {
    analyticsIsLoading.set(false);
  }
}
