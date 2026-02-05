<script lang="ts">
  /**
   * Tracker & Analytics Dashboard
   * 
   * Live-updating dashboard showing task completion statistics:
   * - Completion Rate %
   * - Miss Rate %
   * - Current Streak 🔥
   * - Best Streak 🏆
   * - Active/Overdue counts
   * - Health breakdown
   * 
   * Subscribes to taskAnalyticsStore for reactive updates.
   */
  
  import { onMount, onDestroy } from 'svelte';
  import { 
    taskAnalyticsStore, 
    analyticsIsLoading,
    completionRateFormatted,
    missRateFormatted,
    healthSummary,
    overallHealthStatus,
    streakEmoji,
    type AnalyticsState
  } from '@stores/taskAnalyticsStore';
  import { t } from '@stores/i18nStore';
  
  export let onClose: () => void = () => {};
  
  let analytics: AnalyticsState;
  let isLoading: boolean = false;
  let completionRateStr: string = '0%';
  let missRateStr: string = '0%';
  let healthSummaryStr: string = '';
  let healthStatus: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
  let streakIcon: string = '✨';
  
  // Subscriptions
  const unsubAnalytics = taskAnalyticsStore.subscribe(value => {
    analytics = value;
  });
  
  const unsubLoading = analyticsIsLoading.subscribe(value => {
    isLoading = value;
  });
  
  const unsubCompletionRate = completionRateFormatted.subscribe(value => {
    completionRateStr = value;
  });
  
  const unsubMissRate = missRateFormatted.subscribe(value => {
    missRateStr = value;
  });
  
  const unsubHealthSummary = healthSummary.subscribe(value => {
    healthSummaryStr = value;
  });
  
  const unsubHealthStatus = overallHealthStatus.subscribe(value => {
    healthStatus = value;
  });
  
  const unsubStreakEmoji = streakEmoji.subscribe(value => {
    streakIcon = value;
  });
  
  onDestroy(() => {
    unsubAnalytics();
    unsubLoading();
    unsubCompletionRate();
    unsubMissRate();
    unsubHealthSummary();
    unsubHealthStatus();
    unsubStreakEmoji();
  });
  
  /**
   * Get color class for health status
   */
  function getHealthColor(status: typeof healthStatus): string {
    switch (status) {
      case 'excellent': return 'health-excellent';
      case 'good': return 'health-good';
      case 'fair': return 'health-fair';
      case 'poor': return 'health-poor';
      default: return 'health-good';
    }
  }
  
  /**
   * Get completion rate color (green if >= 80%, yellow if >= 60%, red otherwise)
   */
  function getCompletionRateColor(rate: number): string {
    if (rate >= 80) return 'rate-excellent';
    if (rate >= 60) return 'rate-good';
    return 'rate-poor';
  }
  
  /**
   * Get miss rate color (reverse of completion rate)
   */
  function getMissRateColor(rate: number): string {
    if (rate <= 20) return 'rate-excellent';
    if (rate <= 40) return 'rate-good';
    return 'rate-poor';
  }
</script>

<div class="tracker-dashboard">
  <div class="tracker-header">
    <h2>📊 {$t('analytics.trackerAndAnalytics')}</h2>
    {#if analytics.isStale}
      <span class="stale-indicator" title={$t('analytics.recalculate')}>
        ⚠️ {$t('analytics.staleData')}
      </span>
    {/if}
    <button class="close-button" on:click={onClose} aria-label={$t('close')}>
      ✕
    </button>
  </div>
  
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>{$t('analytics.calculating')}</p>
    </div>
  {:else}
    <div class="tracker-content">
      <!-- Key Metrics Grid -->
      <div class="metrics-grid">
        <!-- Completion Rate -->
        <div class="metric-card {getCompletionRateColor(analytics.completionRate)}">
          <div class="metric-icon">✅</div>
          <div class="metric-value">{completionRateStr}</div>
          <div class="metric-label">{$t('analytics.completionRate')}</div>
          <div class="metric-detail">
            {analytics.totalCompletions} completions
          </div>
        </div>
        
        <!-- Miss Rate -->
        <div class="metric-card {getMissRateColor(analytics.missRate)}">
          <div class="metric-icon">❌</div>
          <div class="metric-value">{missRateStr}</div>
          <div class="metric-label">{$t('analytics.missRate')}</div>
          <div class="metric-detail">
            {analytics.totalMisses} misses
          </div>
        </div>
        
        <!-- Current Streak -->
        <div class="metric-card streak-card">
          <div class="metric-icon">{streakIcon}</div>
          <div class="metric-value">{analytics.bestCurrentStreak}</div>
          <div class="metric-label">{$t('analytics.currentStreak')}</div>
          <div class="metric-detail">
            Best: {analytics.bestOverallStreak} 🏆
          </div>
        </div>
        
        <!-- Health Score -->
        <div class="metric-card {getHealthColor(healthStatus)}">
          <div class="metric-icon">💪</div>
          <div class="metric-value">{analytics.averageHealth}</div>
          <div class="metric-label">{$t('analytics.avgHealthScore')}</div>
          <div class="metric-detail">
            {healthSummaryStr}
          </div>
        </div>
      </div>
      
      <!-- Task Counts -->
      <div class="task-counts">
        <h3>{$t('analytics.taskOverview')}</h3>
        <div class="counts-grid">
          <div class="count-item">
            <span class="count-value">{analytics.totalTasks}</span>
            <span class="count-label">{$t('analytics.totalTasks')}</span>
          </div>
          <div class="count-item">
            <span class="count-value">{analytics.activeTasks}</span>
            <span class="count-label">{$t('analytics.activeTasks')}</span>
          </div>
          <div class="count-item">
            <span class="count-value">{analytics.disabledTasks}</span>
            <span class="count-label">{$t('analytics.disabledTasks')}</span>
          </div>
          <div class="count-item overdue-item">
            <span class="count-value">{analytics.overdueCount}</span>
            <span class="count-label">{$t('analytics.overdueTasks')}</span>
          </div>
        </div>
      </div>
      
      <!-- Due Dates -->
      <div class="due-dates">
        <h3>{$t('tasks.upcoming')}</h3>
        <div class="due-dates-grid">
          <div class="due-item">
            <span class="due-icon">📅</span>
            <span class="due-count">{analytics.dueTodayCount}</span>
            <span class="due-label">{$t('tasks.dueToday')}</span>
          </div>
          <div class="due-item">
            <span class="due-icon">📆</span>
            <span class="due-count">{analytics.dueThisWeekCount}</span>
            <span class="due-label">{$t('tasks.dueThisWeek')}</span>
          </div>
        </div>
      </div>
      
      <!-- Health Breakdown -->
      <div class="health-breakdown">
        <h3>{$t('analytics.healthDistribution')}</h3>
        <div class="health-bar">
          <div 
            class="health-segment health-segment-excellent" 
            style="width: {analytics.totalTasks > 0 ? (analytics.healthBreakdown.healthy / analytics.totalTasks) * 100 : 0}%"
            title="{analytics.healthBreakdown.healthy} healthy tasks"
          >
            {analytics.healthBreakdown.healthy > 0 ? analytics.healthBreakdown.healthy : ''}
          </div>
          <div 
            class="health-segment health-segment-moderate" 
            style="width: {analytics.totalTasks > 0 ? (analytics.healthBreakdown.moderate / analytics.totalTasks) * 100 : 0}%"
            title="{analytics.healthBreakdown.moderate} moderate tasks"
          >
            {analytics.healthBreakdown.moderate > 0 ? analytics.healthBreakdown.moderate : ''}
          </div>
          <div 
            class="health-segment health-segment-poor" 
            style="width: {analytics.totalTasks > 0 ? (analytics.healthBreakdown.struggling / analytics.totalTasks) * 100 : 0}%"
            title="{analytics.healthBreakdown.struggling} struggling tasks"
          >
            {analytics.healthBreakdown.struggling > 0 ? analytics.healthBreakdown.struggling : ''}
          </div>
        </div>
        <div class="health-legend">
          <span class="legend-item">
            <span class="legend-color legend-color-excellent"></span>
            {$t('analytics.healthyRange')}: {analytics.healthBreakdown.healthy}
          </span>
          <span class="legend-item">
            <span class="legend-color legend-color-moderate"></span>
            {$t('analytics.moderateRange')}: {analytics.healthBreakdown.moderate}
          </span>
          <span class="legend-item">
            <span class="legend-color legend-color-poor"></span>
            {$t('analytics.strugglingRange')}: {analytics.healthBreakdown.struggling}
          </span>
        </div>
      </div>
      
      <!-- Last Updated -->
      <div class="tracker-footer">
        <small>Last updated: {new Date(analytics.lastUpdated).toLocaleString()}</small>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .tracker-dashboard {
    padding: 20px;
    max-width: 900px;
    margin: 0 auto;
  }
  
  .tracker-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    
    h2 {
      margin: 0;
      flex: 1;
      font-size: 24px;
    }
    
    .stale-indicator {
      color: #ff9800;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      background: #fff3e0;
    }
    
    .close-button {
      background: transparent;
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 4px 8px;
      opacity: 0.6;
      
      &:hover {
        opacity: 1;
      }
    }
  }
  
  .loading-state {
    text-align: center;
    padding: 60px 20px;
    
    .spinner {
      width: 40px;
      height: 40px;
      margin: 0 auto 16px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  
  .metric-card {
    padding: 20px;
    border-radius: 8px;
    background: #ffffff;
    border: 2px solid #e0e0e0;
    text-align: center;
    transition: transform 0.2s, box-shadow 0.2s;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .metric-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }
    
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .metric-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }
    
    .metric-detail {
      font-size: 12px;
      color: #999;
    }
    
    &.rate-excellent {
      border-color: #4caf50;
      .metric-value { color: #4caf50; }
    }
    
    &.rate-good {
      border-color: #ff9800;
      .metric-value { color: #ff9800; }
    }
    
    &.rate-poor {
      border-color: #f44336;
      .metric-value { color: #f44336; }
    }
    
    &.health-excellent {
      border-color: #4caf50;
      background: linear-gradient(135deg, #e8f5e9 0%, #ffffff 100%);
    }
    
    &.health-good {
      border-color: #8bc34a;
      background: linear-gradient(135deg, #f1f8e9 0%, #ffffff 100%);
    }
    
    &.health-fair {
      border-color: #ff9800;
      background: linear-gradient(135deg, #fff3e0 0%, #ffffff 100%);
    }
    
    &.health-poor {
      border-color: #f44336;
      background: linear-gradient(135deg, #ffebee 0%, #ffffff 100%);
    }
    
    &.streak-card {
      border-color: #ff5722;
      background: linear-gradient(135deg, #ffccbc 0%, #ffffff 100%);
      .metric-value { color: #ff5722; }
    }
  }
  
  .task-counts, .due-dates, .health-breakdown {
    margin-bottom: 24px;
    padding: 16px;
    background: #fafafa;
    border-radius: 8px;
    
    h3 {
      margin: 0 0 12px 0;
      font-size: 16px;
      color: #333;
    }
  }
  
  .counts-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  
  .count-item {
    text-align: center;
    padding: 12px;
    background: white;
    border-radius: 6px;
    
    .count-value {
      display: block;
      font-size: 24px;
      font-weight: bold;
      color: #333;
      margin-bottom: 4px;
    }
    
    .count-label {
      display: block;
      font-size: 12px;
      color: #666;
    }
    
    &.overdue-item {
      border: 2px solid #f44336;
      .count-value { color: #f44336; }
    }
  }
  
  .due-dates-grid {
    display: flex;
    gap: 12px;
  }
  
  .due-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: white;
    border-radius: 6px;
    
    .due-icon {
      font-size: 24px;
    }
    
    .due-count {
      font-size: 20px;
      font-weight: bold;
      color: #2196f3;
    }
    
    .due-label {
      font-size: 12px;
      color: #666;
    }
  }
  
  .health-bar {
    display: flex;
    height: 40px;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  
  .health-segment {
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 14px;
    transition: width 0.3s ease;
    
    &.health-segment-excellent {
      background: #4caf50;
    }
    
    &.health-segment-moderate {
      background: #ff9800;
    }
    
    &.health-segment-poor {
      background: #f44336;
    }
  }
  
  .health-legend {
    display: flex;
    gap: 16px;
    font-size: 12px;
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      
      &.legend-color-excellent {
        background: #4caf50;
      }
      
      &.legend-color-moderate {
        background: #ff9800;
      }
      
      &.legend-color-poor {
        background: #f44336;
      }
    }
  }
  
  .tracker-footer {
    text-align: center;
    padding-top: 16px;
    color: #999;
  }
</style>
