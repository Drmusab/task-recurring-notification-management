<!--
  AnalyticsDashboard.svelte — Analytics Component Stub
  
  Lightweight placeholder that redirects to the lazy-loaded analytics dialog.
  The full analytics are loaded on-demand via lazyMounts.ts to prevent
  heavy D3/chart dependencies during plugin startup.
  
  This stub exists to satisfy the import from AdvancedQueryDashboard.svelte.
-->
<script lang="ts">
  import type { Task } from "@backend/core/models/Task";
  import { taskAnalyticsStore } from "@stores/TaskAnalytics.store";

  // Props
  export let tasks: Task[] = [];

  // Computed analytics from store
  $: analytics = $taskAnalyticsStore;
</script>

<div class="analytics-dashboard">
  <div class="analytics-header">
    <h3>Task Analytics</h3>
  </div>
  
  <div class="analytics-grid">
    <div class="analytics-card">
      <div class="analytics-value">{analytics.totalTasks}</div>
      <div class="analytics-label">Total Tasks</div>
    </div>
    <div class="analytics-card">
      <div class="analytics-value">{analytics.activeTasks}</div>
      <div class="analytics-label">Active</div>
    </div>
    <div class="analytics-card">
      <div class="analytics-value">{analytics.completionRate.toFixed(1)}%</div>
      <div class="analytics-label">Completion Rate</div>
    </div>
    <div class="analytics-card">
      <div class="analytics-value">{analytics.overdueCount}</div>
      <div class="analytics-label">Overdue</div>
    </div>
    <div class="analytics-card">
      <div class="analytics-value">{analytics.bestCurrentStreak}</div>
      <div class="analytics-label">Current Streak</div>
    </div>
    <div class="analytics-card">
      <div class="analytics-value">{analytics.dueTodayCount}</div>
      <div class="analytics-label">Due Today</div>
    </div>
  </div>

  <div class="analytics-health">
    <h4>Health Breakdown</h4>
    <div class="health-bars">
      <div class="health-item">
        <span class="health-label">Healthy</span>
        <div class="health-bar">
          <div 
            class="health-fill health-fill--good" 
            style="width: {analytics.totalTasks > 0 ? (analytics.healthBreakdown.healthy / analytics.totalTasks * 100) : 0}%"
          ></div>
        </div>
        <span class="health-count">{analytics.healthBreakdown.healthy}</span>
      </div>
      <div class="health-item">
        <span class="health-label">Moderate</span>
        <div class="health-bar">
          <div 
            class="health-fill health-fill--moderate" 
            style="width: {analytics.totalTasks > 0 ? (analytics.healthBreakdown.moderate / analytics.totalTasks * 100) : 0}%"
          ></div>
        </div>
        <span class="health-count">{analytics.healthBreakdown.moderate}</span>
      </div>
      <div class="health-item">
        <span class="health-label">Struggling</span>
        <div class="health-bar">
          <div 
            class="health-fill health-fill--poor" 
            style="width: {analytics.totalTasks > 0 ? (analytics.healthBreakdown.struggling / analytics.totalTasks * 100) : 0}%"
          ></div>
        </div>
        <span class="health-count">{analytics.healthBreakdown.struggling}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .analytics-dashboard {
    padding: 16px;
    font-family: var(--b3-font-family);
  }

  .analytics-header h3 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .analytics-card {
    background: var(--b3-theme-surface);
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }

  .analytics-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--b3-theme-on-background);
  }

  .analytics-label {
    font-size: 11px;
    color: var(--b3-theme-on-surface-light);
    margin-top: 4px;
  }

  .analytics-health h4 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .health-bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .health-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .health-label {
    width: 70px;
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }

  .health-bar {
    flex: 1;
    height: 8px;
    background: var(--b3-theme-background);
    border-radius: 4px;
    overflow: hidden;
  }

  .health-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .health-fill--good {
    background: #22c55e;
  }

  .health-fill--moderate {
    background: #f59e0b;
  }

  .health-fill--poor {
    background: #ef4444;
  }

  .health-count {
    width: 30px;
    font-size: 12px;
    text-align: right;
    color: var(--b3-theme-on-surface-light);
  }
</style>
