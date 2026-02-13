<script lang="ts">
  /**
   * Accessible Task Statistics Component
   * WCAG 2.1 AA Compliant
   * 
   * @accessibility
   * - role="region" for landmark navigation
   * - Semantic table structure with proper headers
   * - aria-label for data visualizations
   * - Text alternatives for charts
   * - High contrast mode support
   * - Screen reader friendly data presentation
   */

  import { onMount } from 'svelte';
  import { announceToScreenReader } from '@frontend/utils/accessibility';

  export let stats: {
    completedToday: number;
    completedThisWeek: number;
    completedThisMonth: number;
    averageCompletionTime?: number; // in hours
    mostProductiveDay?: string;
    totalActiveStreak?: number; // in days
  } = {
    completedToday: 0,
    completedThisWeek: 0,
    completedThisMonth: 0
  };
  export let loading = false;

  let previousWeeklyTotal = stats.completedThisWeek;

  // Announce significant stat changes
  $: if (stats.completedThisWeek !== previousWeeklyTotal && !loading) {
    announceToScreenReader(
      `Weekly statistics updated. ${stats.completedThisWeek} tasks completed this week.`,
      'polite'
    );
    previousWeeklyTotal = stats.completedThisWeek;
  }

  function formatHours(hours?: number): string {
    if (!hours) return 'N/A';
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    return `${hours.toFixed(1)} hrs`;
  }
</script>

<section
  class="task-stats"
  aria-label="Task statistics and productivity metrics"
  aria-busy={loading}
>
  <h2 class="stats-title">Productivity Stats</h2>

  <!-- Completion Statistics Table -->
  <div class="stats-section">
    <h3 class="section-title">Completion Summary</h3>
    <table class="stats-table" aria-label="Task completion statistics">
      <thead>
        <tr>
          <th scope="col" class="table-header">Period</th>
          <th scope="col" class="table-header table-header-number">Completed</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row" class="table-cell">Today</th>
          <td class="table-cell table-cell-number">
            <span aria-label="{stats.completedToday} tasks completed today">
              {stats.completedToday}
            </span>
          </td>
        </tr>
        <tr>
          <th scope="row" class="table-cell">This Week</th>
          <td class="table-cell table-cell-number">
            <span aria-label="{stats.completedThisWeek} tasks completed this week">
              {stats.completedThisWeek}
            </span>
          </td>
        </tr>
        <tr>
          <th scope="row" class="table-cell">This Month</th>
          <td class="table-cell table-cell-number">
            <span aria-label="{stats.completedThisMonth} tasks completed this month">
              {stats.completedThisMonth}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Additional Metrics -->
  <div class="stats-section">
    <h3 class="section-title">Insights</h3>
    <div class="metrics-grid">
      {#if stats.averageCompletionTime !== undefined}
        <div class="metric-card" role="group" aria-label="Average completion time">
          <div class="metric-icon" aria-hidden="true">⏱</div>
          <div class="metric-content">
            <div class="metric-value">
              {formatHours(stats.averageCompletionTime)}
            </div>
            <div class="metric-label">Avg. Completion Time</div>
          </div>
        </div>
      {/if}

      {#if stats.mostProductiveDay}
        <div class="metric-card" role="group" aria-label="Most productive day">
          <div class="metric-icon" aria-hidden="true">🏆</div>
          <div class="metric-content">
            <div class="metric-value">{stats.mostProductiveDay}</div>
            <div class="metric-label">Most Productive Day</div>
          </div>
        </div>
      {/if}

      {#if stats.totalActiveStreak !== undefined}
        <div class="metric-card" role="group" aria-label="Active streak">
          <div class="metric-icon" aria-hidden="true">🔥</div>
          <div class="metric-content">
            <div class="metric-value">
              {stats.totalActiveStreak} {stats.totalActiveStreak === 1 ? 'day' : 'days'}
            </div>
            <div class="metric-label">Active Streak</div>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Visual Progress Bar (with text alternative) -->
  <div class="stats-section">
    <h3 class="section-title">Weekly Progress</h3>
    <div 
      class="progress-bar" 
      role="progressbar" 
      aria-label="Weekly task completion progress"
      aria-valuenow={stats.completedThisWeek}
      aria-valuemin={0}
      aria-valuemax={50}
      aria-valuetext="{stats.completedThisWeek} of 50 tasks completed"
    >
      <div 
        class="progress-fill" 
        style="width: {Math.min((stats.completedThisWeek / 50) * 100, 100)}%"
        aria-hidden="true"
      ></div>
    </div>
    <div class="progress-text">
      <span>{stats.completedThisWeek}</span>
      <span class="progress-total">/ 50 tasks</span>
    </div>
  </div>

  <!-- Screen reader live region -->
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {#if loading}
      Loading task statistics...
    {/if}
  </div>
</section>

<style>
  .task-stats {
    padding: 1.5rem;
    background: var(--background-primary, #ffffff);
    border-radius: 8px;
  }

  .stats-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1.5rem 0;
    color: var(--text-normal, #1f2937);
  }

  .stats-section {
    margin-bottom: 1.5rem;
  }

  .stats-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.75rem 0;
    color: var(--text-normal, #1f2937);
  }

  /* Table Styles */
  .stats-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--background-secondary, #f9fafb);
    border-radius: 6px;
    overflow: hidden;
  }

  .table-header {
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-muted, #6b7280);
    background: var(--background-modifier-border, #e5e7eb);
    border-bottom: 2px solid var(--background-modifier-border, #d1d5db);
  }

  .table-header-number {
    text-align: right;
  }

  .table-cell {
    padding: 0.75rem 1rem;
    font-size: 0.9375rem;
    color: var(--text-normal, #1f2937);
    border-bottom: 1px solid var(--background-modifier-border, #e5e7eb);
  }

  .table-cell-number {
    text-align: right;
    font-weight: 600;
    color: var(--interactive-accent, #1976d2);
  }

  tbody tr:last-child .table-cell {
    border-bottom: none;
  }

  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }

  .metric-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--background-secondary, #f9fafb);
    border: 1px solid var(--background-modifier-border, #e5e7eb);
    border-radius: 6px;
  }

  .metric-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .metric-content {
    flex: 1;
    min-width: 0;
  }

  .metric-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-normal, #1f2937);
    line-height: 1.2;
    margin-bottom: 0.125rem;
  }

  .metric-label {
    font-size: 0.75rem;
    color: var(--text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Progress Bar */
  .progress-bar {
    height: 24px;
    background: var(--background-secondary, #e5e7eb);
    border-radius: 12px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, 
      var(--interactive-accent, #1976d2) 0%, 
      var(--text-success, #10b981) 100%
    );
    border-radius: 12px;
    transition: width 0.5s ease;
  }

  .progress-text {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-normal, #1f2937);
    font-weight: 600;
  }

  .progress-total {
    color: var(--text-muted, #6b7280);
    font-weight: 400;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  /* WCAG High Contrast Mode */
  @media (prefers-contrast: high) {
    .stats-table,
    .metric-card {
      border-width: 2px;
    }

    .table-header {
      border-bottom-width: 3px;
    }
  }

  /* WCAG Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .progress-fill {
      transition: none;
    }
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .metrics-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
