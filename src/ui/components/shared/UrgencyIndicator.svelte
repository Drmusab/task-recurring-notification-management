<script lang="ts">
  import type { Task } from '@backend/core/models/Task';
  import { calculateUrgencyWithBreakdown } from '@backend/core/urgency/UrgencyScoreCalculator';
  import { DEFAULT_URGENCY_SETTINGS } from '@backend/core/urgency/UrgencySettings';

  export let task: Task;
  export let showBreakdown = false;
  export let showTooltip = true;
  
  $: calculation = calculateUrgencyWithBreakdown(task, {
    now: new Date(),
    settings: DEFAULT_URGENCY_SETTINGS
  });
  
  $: urgencyClass = getUrgencyClass(calculation.score);
  
  function getUrgencyClass(score: number): string {
    if (score >= 15) return 'urgency-critical';
    if (score >= 10) return 'urgency-high';
    if (score >= 5) return 'urgency-medium';
    return 'urgency-low';
  }
  
  function getUrgencyLabel(score: number): string {
    if (score >= 15) return 'Critical';
    if (score >= 10) return 'High';
    if (score >= 5) return 'Medium';
    return 'Low';
  }
</script>

<div class="urgency-indicator {urgencyClass}" title={showTooltip ? `Urgency: ${calculation.score}` : undefined}>
  <div class="urgency-score">{calculation.score.toFixed(1)}</div>
  {#if showBreakdown}
    <div class="urgency-label">{getUrgencyLabel(calculation.score)}</div>
  {/if}
</div>

{#if showBreakdown}
  <div class="urgency-breakdown">
    <div class="breakdown-title">Urgency Breakdown:</div>
    <div class="breakdown-items">
      {#if calculation.breakdown.priorityContribution > 0}
        <div class="breakdown-item">
          <span class="breakdown-label">Priority:</span>
          <span class="breakdown-value">+{calculation.breakdown.priorityContribution.toFixed(1)}</span>
        </div>
      {/if}
      {#if calculation.breakdown.dueDateContribution > 0}
        <div class="breakdown-item">
          <span class="breakdown-label">Due Date:</span>
          <span class="breakdown-value">+{calculation.breakdown.dueDateContribution.toFixed(1)}</span>
        </div>
      {/if}
      {#if calculation.breakdown.overdueContribution > 0}
        <div class="breakdown-item urgency-critical">
          <span class="breakdown-label">Overdue:</span>
          <span class="breakdown-value">+{calculation.breakdown.overdueContribution.toFixed(1)}</span>
        </div>
      {/if}
      {#if calculation.breakdown.scheduledContribution > 0}
        <div class="breakdown-item">
          <span class="breakdown-label">Scheduled:</span>
          <span class="breakdown-value">+{calculation.breakdown.scheduledContribution.toFixed(1)}</span>
        </div>
      {/if}
      {#if calculation.breakdown.startContribution > 0}
        <div class="breakdown-item">
          <span class="breakdown-label">Can Start:</span>
          <span class="breakdown-value">+{calculation.breakdown.startContribution.toFixed(1)}</span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .urgency-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    transition: all 0.2s ease;
  }
  
  .urgency-score {
    font-variant-numeric: tabular-nums;
  }
  
  .urgency-label {
    font-size: 0.625rem;
    font-weight: 500;
    opacity: 0.9;
  }
  
  /* Urgency level colors */
  .urgency-critical {
    background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
    color: white;
    box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);
  }
  
  .urgency-high {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
  }
  
  .urgency-medium {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
  }
  
  .urgency-low {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
  }
  
  .urgency-breakdown {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--background-secondary);
    border-radius: 0.25rem;
    font-size: 0.75rem;
  }
  
  .breakdown-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
    color: var(--text-muted);
  }
  
  .breakdown-items {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  
  .breakdown-item {
    display: flex;
    justify-content: space-between;
    padding: 0.125rem 0;
  }
  
  .breakdown-label {
    color: var(--text-normal);
  }
  
  .breakdown-value {
    font-weight: 600;
    color: var(--text-accent);
    font-variant-numeric: tabular-nums;
  }
  
  .breakdown-item.urgency-critical .breakdown-value {
    color: #dc2626;
  }
</style>
