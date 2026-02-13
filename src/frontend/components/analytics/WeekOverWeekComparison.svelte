<script lang="ts">
  import type { Task } from "@backend/core/models/Task";
  import { calculateWeeklyComparison, type WeeklyComparison } from "@backend/core/analytics/CompletionProbabilityCalculator";
  
  export let tasks: Task[] = [];
  
  let comparison: WeeklyComparison | null = null;
  
  $: {
    comparison = calculateWeeklyComparison(tasks);
  }
  
  function getTrendIcon(trend: string): string {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      case 'stable': return '➡️';
      default: return '📊';
    }
  }
  
  function getTrendColor(trend: string): string {
    switch (trend) {
      case 'improving': return '#10b981';
      case 'declining': return '#ef4444';
      case 'stable': return '#f59e0b';
      default: return '#6b7280';
    }
  }
  
  function formatChange(value: number, suffix: string = ''): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}${suffix}`;
  }
  
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

{#if comparison}
  <div class="week-over-week-comparison">
    <div class="comparison-header">
      <h3>📅 Week-over-Week Comparison</h3>
      <div class="trend-badge" style="background-color: {getTrendColor(comparison.trend)};">
        <span class="trend-icon">{getTrendIcon(comparison.trend)}</span>
        <span class="trend-text">{comparison.trend}</span>
      </div>
    </div>
    
    <!-- Week Stats Cards -->
    <div class="weeks-grid">
      <!-- Current Week -->
      <div class="week-card current">
        <div class="week-header">
          <h4>Current Week</h4>
          <span class="week-dates">
            {formatDate(comparison.currentWeek.startDate)} - {formatDate(comparison.currentWeek.endDate)}
          </span>
        </div>
        
        <div class="stats-list">
          <div class="stat-item">
            <span class="stat-label">Completions</span>
            <span class="stat-value">{comparison.currentWeek.completions}</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Completion Rate</span>
            <span class="stat-value">{comparison.currentWeek.completionRate}%</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Streak Days</span>
            <span class="stat-value">{comparison.currentWeek.streakDays}</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Avg Delay</span>
            <span class="stat-value">{comparison.currentWeek.averageDelayMinutes}m</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Active Tasks</span>
            <span class="stat-value">{comparison.currentWeek.totalTasks}</span>
          </div>
        </div>
      </div>
      
      <!-- Last Week -->
      <div class="week-card last">
        <div class="week-header">
          <h4>Last Week</h4>
          <span class="week-dates">
            {formatDate(comparison.lastWeek.startDate)} - {formatDate(comparison.lastWeek.endDate)}
          </span>
        </div>
        
        <div class="stats-list">
          <div class="stat-item">
            <span class="stat-label">Completions</span>
            <span class="stat-value">{comparison.lastWeek.completions}</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Completion Rate</span>
            <span class="stat-value">{comparison.lastWeek.completionRate}%</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Streak Days</span>
            <span class="stat-value">{comparison.lastWeek.streakDays}</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Avg Delay</span>
            <span class="stat-value">{comparison.lastWeek.averageDelayMinutes}m</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">Active Tasks</span>
            <span class="stat-value">{comparison.lastWeek.totalTasks}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Change Indicators -->
    <div class="changes-section">
      <h4>📊 Changes</h4>
      <div class="changes-grid">
        <div class="change-card" class:positive={comparison.change.completions > 0} class:negative={comparison.change.completions < 0}>
          <span class="change-label">Completions</span>
          <span class="change-value">{formatChange(comparison.change.completions)}</span>
        </div>
        
        <div class="change-card" class:positive={comparison.change.completionRate > 0} class:negative={comparison.change.completionRate < 0}>
          <span class="change-label">Completion Rate</span>
          <span class="change-value">{formatChange(comparison.change.completionRate, '%')}</span>
        </div>
        
        <div class="change-card" class:positive={comparison.change.streakDays > 0} class:negative={comparison.change.streakDays < 0}>
          <span class="change-label">Streak Days</span>
          <span class="change-value">{formatChange(comparison.change.streakDays)}</span>
        </div>
        
        <div class="change-card" class:positive={comparison.change.averageDelay < 0} class:negative={comparison.change.averageDelay > 0}>
          <span class="change-label">Avg Delay</span>
          <span class="change-value">{formatChange(comparison.change.averageDelay, 'm')}</span>
        </div>
      </div>
    </div>
    
    <!-- Insights -->
    <div class="insights-section">
      {#if comparison.trend === 'improving'}
        <div class="insight positive">
          🎉 Great progress! Your completion rate improved by {formatChange(comparison.change.completionRate, '%')} this week. Keep up the momentum!
        </div>
      {:else if comparison.trend === 'declining'}
        <div class="insight negative">
          ⚠️ Performance dipped this week. Completion rate decreased by {formatChange(comparison.change.completionRate, '%')}. Review your schedule and task priorities.
        </div>
      {:else}
        <div class="insight neutral">
          ➡️ Consistent performance. Maintain your current routine to build long-term habits.
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .week-over-week-comparison {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    margin-bottom: 20px;
  }
  
  .comparison-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 2px solid #e5e7eb;
  }
  
  .comparison-header h3 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: #1f2937;
  }
  
  .trend-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
  }
  
  .trend-icon {
    font-size: 1rem;
  }
  
  .trend-text {
    text-transform: capitalize;
  }
  
  .weeks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
  }
  
  .week-card {
    background: #f9fafb;
    border-radius: 8px;
    padding: 16px;
    border: 2px solid #e5e7eb;
    transition: transform 0.2s;
  }
  
  .week-card:hover {
    transform: translateY(-2px);
  }
  
  .week-card.current {
    border-color: #3b82f6;
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  }
  
  .week-card.last {
    border-color: #d1d5db;
  }
  
  .week-header {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
  
  .week-header h4 {
    margin: 0 0 4px 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
  }
  
  .week-dates {
    font-size: 0.75rem;
    color: #6b7280;
  }
  
  .stats-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
  }
  
  .stat-label {
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .stat-value {
    font-size: 1rem;
    font-weight: 700;
    color: #1f2937;
  }
  
  .changes-section {
    margin-bottom: 20px;
  }
  
  .changes-section h4 {
    margin: 0 0 12px 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
  }
  
  .changes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  
  .change-card {
    padding: 14px;
    border-radius: 8px;
    background: #f3f4f6;
    border: 2px solid #e5e7eb;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: all 0.2s;
  }
  
  .change-card.positive {
    border-color: #10b981;
    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  }
  
  .change-card.negative {
    border-color: #ef4444;
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  }
  
  .change-label {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 600;
  }
  
  .change-value {
    font-size: 1.2rem;
    font-weight: 700;
    color: #1f2937;
  }
  
  .insights-section {
    padding: 16px;
    background: #fffbeb;
    border-radius: 8px;
    border-left: 4px solid #f59e0b;
  }
  
  .insight {
    font-size: 0.95rem;
    line-height: 1.6;
    color: #1f2937;
  }
  
  .insight.positive {
    background: #d1fae5;
    padding: 12px;
    border-radius: 6px;
    border-left-color: #10b981;
  }
  
  .insight.negative {
    background: #fee2e2;
    padding: 12px;
    border-radius: 6px;
    border-left-color: #ef4444;
  }
  
  .insight.neutral {
    padding: 12px;
  }
  
  @media (max-width: 768px) {
    .comparison-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
    
    .weeks-grid {
      grid-template-columns: 1fr;
    }
    
    .changes-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
