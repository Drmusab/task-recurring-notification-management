<script lang="ts">
  /**
   * Accessible Task Summary Component
   * WCAG 2.1 AA Compliant
   * 
   * @accessibility
   * - role="region" for landmark navigation
   * - aria-label with descriptive summary
   * - Live region for dynamic updates
   * - Semantic HTML structure
   * - High contrast mode support
   * - Reduced motion support
   */

  import { onMount } from 'svelte';
  import { announceToScreenReader } from '@frontend/utils/accessibility';

  export let totalTasks = 0;
  export let completedTasks = 0;
  export let overdueTasks = 0;
  export let todayTasks = 0;
  export let upcomingTasks = 0;
  export let loading = false;

  $: incompleteTasks = totalTasks - completedTasks;
  $: completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  let previousTotal = totalTasks;

  // Announce changes to screen readers
  $: if (totalTasks !== previousTotal && !loading) {
    announceToScreenReader(
      `Task summary updated. ${totalTasks} total tasks, ${completedTasks} completed, ${incompleteTasks} remaining.`,
      'polite'
    );
    previousTotal = totalTasks;
  }
</script>

<section
  class="task-summary"
  aria-label="Task summary overview"
  aria-busy={loading}
>
  <h2 class="task-summary-title">Task Overview</h2>

  <div class="summary-grid">
    <!-- Total Tasks -->
    <div class="summary-card" role="group" aria-label="Total tasks">
      <div class="summary-icon" aria-hidden="true">📋</div>
      <div class="summary-content">
        <div class="summary-value" aria-label="{totalTasks} total tasks">
          {totalTasks}
        </div>
        <div class="summary-label">Total Tasks</div>
      </div>
    </div>

    <!-- Completed Tasks -->
    <div class="summary-card summary-card-success" role="group" aria-label="Completed tasks">
      <div class="summary-icon" aria-hidden="true">✓</div>
      <div class="summary-content">
        <div class="summary-value" aria-label="{completedTasks} completed tasks">
          {completedTasks}
        </div>
        <div class="summary-label">Completed</div>
        <div class="summary-percentage" aria-label="{completionRate}% completion rate">
          {completionRate}%
        </div>
      </div>
    </div>

    <!-- Overdue Tasks -->
    <div class="summary-card summary-card-danger" role="group" aria-label="Overdue tasks">
      <div class="summary-icon" aria-hidden="true">⚠</div>
      <div class="summary-content">
        <div class="summary-value" aria-label="{overdueTasks} overdue tasks">
          {overdueTasks}
        </div>
        <div class="summary-label">Overdue</div>
      </div>
    </div>

    <!-- Today Tasks -->
    <div class="summary-card summary-card-info" role="group" aria-label="Tasks due today">
      <div class="summary-icon" aria-hidden="true">📅</div>
      <div class="summary-content">
        <div class="summary-value" aria-label="{todayTasks} tasks due today">
          {todayTasks}
        </div>
        <div class="summary-label">Due Today</div>
      </div>
    </div>

    <!-- Upcoming Tasks -->
    <div class="summary-card" role="group" aria-label="Upcoming tasks">
      <div class="summary-icon" aria-hidden="true">🔜</div>
      <div class="summary-content">
        <div class="summary-value" aria-label="{upcomingTasks} upcoming tasks">
          {upcomingTasks}
        </div>
        <div class="summary-label">Upcoming</div>
      </div>
    </div>
  </div>

  <!-- Screen reader live region -->
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {#if loading}
      Loading task summary...
    {/if}
  </div>
</section>

<style>
  .task-summary {
    padding: 1.5rem;
    background: var(--background-primary, #ffffff);
    border-radius: 8px;
  }

  .task-summary-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--text-normal, #1f2937);
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .summary-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--background-secondary, #f9fafb);
    border: 1px solid var(--background-modifier-border, #e5e7eb);
    border-left: 4px solid var(--interactive-accent, #1976d2);
    border-radius: 6px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .summary-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .summary-card-success {
    border-left-color: var(--text-success, #10b981);
  }

  .summary-card-danger {
    border-left-color: var(--text-error, #ef4444);
  }

  .summary-card-info {
    border-left-color: var(--text-info, #3b82f6);
  }

  .summary-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .summary-content {
    flex: 1;
  }

  .summary-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-normal, #1f2937);
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .summary-label {
    font-size: 0.875rem;
    color: var(--text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .summary-percentage {
    font-size: 0.75rem;
    color: var(--text-success, #10b981);
    font-weight: 600;
    margin-top: 0.25rem;
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
    .summary-card {
      border-width: 2px;
      border-left-width: 4px;
    }
  }

  /* WCAG Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .summary-card {
      transition: none;
    }
    
    .summary-card:hover {
      transform: none;
    }
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .summary-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
