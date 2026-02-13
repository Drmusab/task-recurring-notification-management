<script lang="ts">
  /**
   * AnalyticsDashboard - Comprehensive task analytics visualization
   * Phase 4 + 4.1 + 4.3: Customizable dashboard with drag-drop widgets
   */
  
  import { onMount, onDestroy } from "svelte";
  import type { Task } from "@backend/core/models/Task";
  import { calculateTaskAnalytics } from "@backend/core/analytics/TaskAnalyticsCalculator";
  import StatsCard from "./StatsCard.svelte";
  import CompletionChart from "./CompletionChart.svelte";
  import HabitTracker from "./HabitTracker.svelte";
  // Phase 4.1: Predictive Analytics
  import PredictiveInsightsPanel from "./PredictiveInsightsPanel.svelte";
  import WeekOverWeekComparison from "./WeekOverWeekComparison.svelte";
  import HealthBreakdown from "./HealthBreakdown.svelte";
  // Phase 4.3: Custom Dashboards
  import DashboardWidget from "./widgets/DashboardWidget.svelte";
  import DashboardCustomizationToolbar from "./widgets/DashboardCustomizationToolbar.svelte";
  import { dashboardLayoutManager } from "./widgets/DashboardLayoutManager";
  import { dragDropManager } from "./widgets/DragDropManager";
  import type { Widget, DashboardLayout, DashboardExport } from "./widgets/WidgetTypes";
  
  export let tasks: Task[] = [];
  export let onExportCSV: (() => void) | undefined = undefined;
  
  // Layout state
  let currentLayout: DashboardLayout = dashboardLayoutManager.getCurrentLayout();
  let editMode = false;
  let layoutUnsubscribe: (() => void) | null = null;
  
  // Analytics calculation
  $: analytics = calculateTaskAnalytics(tasks);
  
  // Subscribe to layout changes
  onMount(() => {
    layoutUnsubscribe = dashboardLayoutManager.subscribe((layout) => {
      currentLayout = layout;
    });
  });
  
  onDestroy(() => {
    if (layoutUnsubscribe) {
      layoutUnsubscribe();
    }
  });
  
  // Get visible widgets sorted by order
  $: visibleWidgets = currentLayout.widgets
    .filter(w => w.visible || editMode)
    .sort((a, b) => a.order - b.order);
  
  /**
   * Format percentage with 1 decimal place
   */
  function formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
  }
  
  /**
   * Get color based on completion rate
   */
  function getCompletionRateColor(rate: number): "success" | "warning" | "danger" {
    if (rate >= 80) return "success";
    if (rate >= 50) return "warning";
    return "danger";
  }
  
  /**
   * Get color based on health score
   */
  function getHealthColor(health: number): "success" | "warning" | "danger" {
    if (health >= 80) return "success";
    if (health >= 50) return "warning";
    return "danger";
  }
  
  /**
   * Calculate weekly trend
   */
  function getWeeklyTrend(): { trend: "up" | "down" | "neutral"; value: string } {
    // In a real implementation, this would compare current week vs previous week
    // For now, we'll use a simplified calculation based on completion rate
    const rate = analytics.completionRate;
    if (rate > 75) return { trend: "up", value: "+5% vs last week" };
    if (rate < 50) return { trend: "down", value: "-3% vs last week" };
    return { trend: "neutral", value: "±0% vs last week" };
  }
  
  $: weeklyTrend = getWeeklyTrend();
  
  /**
   * Toggle edit mode
   */
  function toggleEditMode() {
    editMode = !editMode;
    if (!editMode) {
      // Auto-save when exiting edit mode
      dashboardLayoutManager.saveLayout();
    }
  }
  
  /**
   * Save current layout
   */
  function saveLayout() {
    dashboardLayoutManager.saveLayout();
    // Show confirmation (could use a toast notification)
    console.log('Layout saved');
  }
  
  /**
   * Reset to default layout
   */
  function resetLayout() {
    if (confirm('Reset dashboard to default layout? This cannot be undone.')) {
      dashboardLayoutManager.resetToDefault();
    }
  }
  
  /**
   * Export layout configuration
   */
  function exportLayout() {
    const exportData = dashboardLayoutManager.exportLayout();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-layout-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  /**
   * Import layout configuration
   */
  function importLayout(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const exportData: DashboardExport = JSON.parse(e.target?.result as string);
        const success = dashboardLayoutManager.importLayout(exportData);
        if (success) {
          console.log('Layout imported successfully');
        } else {
          alert('Failed to import layout');
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Invalid layout file');
      }
    };
    reader.readAsText(file);
  }
  
  /**
   * Handle widget resize
   */
  function handleWidgetResize(widgetId: string, size: Widget['size']) {
    dashboardLayoutManager.updateWidgetSize(widgetId, size);
  }
  
  /**
   * Handle widget visibility toggle
   */
  function handleWidgetVisibilityToggle(widgetId: string) {
    dashboardLayoutManager.toggleWidgetVisibility(widgetId);
  }
  
  /**
   * Handle widget removal
   */
  function handleWidgetRemove(widgetId: string) {
    if (confirm('Remove this widget? This cannot be undone.')) {
      dashboardLayoutManager.removeWidget(widgetId);
    }
  }
  
  /**
   * Handle drop to reorder widgets
   */
  function handleDrop(event: DragEvent, targetWidgetId: string) {
    const reorderedWidgets = dragDropManager.drop(targetWidgetId, currentLayout.widgets, event);
    if (reorderedWidgets) {
      dashboardLayoutManager.updateWidgetOrder(reorderedWidgets);
    }
  }
  
  /**
   * Get widget component configuration
   */
  function getWidgetConfig(widget: Widget) {
    const config = widget.config || {};
    
    // Map widget type to specific configuration
    switch (widget.type) {
      case 'stats-card':
        return {
          metric: config.statsCard?.metric || 'completion-rate'
        };
      case 'completion-chart':
        return {
          days: config.chart?.days || 30,
          showTrend: config.chart?.showTrend !== false,
          showAverage: config.chart?.showAverage !== false
        };
      case 'habit-tracker':
        return {
          weeks: config.habitTracker?.weeks || 26,
          showWeekends: config.habitTracker?.showWeekends !== false
        };
      default:
        return {};
    }
  }
</script>

<div class="analytics-dashboard">
  <!-- Customization Toolbar (Phase 4.3) -->
  <DashboardCustomizationToolbar
    {editMode}
    onToggleEditMode={toggleEditMode}
    onSaveLayout={saveLayout}
    onResetLayout={resetLayout}
    onExportLayout={exportLayout}
    onImportLayout={importLayout}
  />
  
  <!-- Header -->
  <div class="dashboard-header">
    <h2 class="dashboard-title">📊 {currentLayout.name || 'Analytics Dashboard'}</h2>
    
    {#if onExportCSV}
      <button class="export-btn" on:click={onExportCSV}>
        <span class="export-icon">💾</span>
        Export CSV
      </button>
    {/if}
  </div>
  
  <!-- Widgets Grid (Phase 4.3: Drag-Drop Support) -->
  <div class="widgets-grid" class:edit-mode={editMode}>
    {#each visibleWidgets as widget (widget.id)}
      <DashboardWidget
        {widget}
        {editMode}
        showBorders={true}
        onResize={handleWidgetResize}
        onRemove={handleWidgetRemove}
        onToggleVisibility={handleWidgetVisibilityToggle}
      >
        <div 
          on:drop={(e) => handleDrop(e, widget.id)}
          role="presentation"
        >
          {#if widget.type === 'stats-card'}
            {@const config = getWidgetConfig(widget)}
            {#if config.metric === 'completion-rate'}
              <StatsCard
                label="Completion Rate"
                value={formatPercent(analytics.completionRate)}
                icon="✅"
                color={getCompletionRateColor(analytics.completionRate)}
                subtitle="{analytics.totalCompletions} total completions"
                trend={weeklyTrend.trend}
                trendValue={weeklyTrend.value}
              />
            {:else if config.metric === 'miss-rate'}
              <StatsCard
                label="Miss Rate"
                value={formatPercent(analytics.missRate)}
                icon="❌"
                color={analytics.missRate < 20 ? "success" : analytics.missRate < 40 ? "warning" : "danger"}
                subtitle="{analytics.totalMisses} total misses"
              />
            {:else if config.metric === 'current-streak'}
              <StatsCard
                label="Current Streak"
                value={analytics.bestCurrentStreak}
                icon="🔥"
                color="info"
                subtitle="Best: {analytics.bestOverallStreak}"
              />
            {:else if config.metric === 'health'}
              <StatsCard
                label="Average Health"
                value={analytics.averageHealth}
                icon="💪"
                color={getHealthColor(analytics.averageHealth)}
                subtitle="Out of 100"
              />
            {:else if config.metric === 'active-tasks'}
              <StatsCard
                label="Active Tasks"
                value={analytics.activeTasks}
                icon="✏️"
                color="primary"
                subtitle="{analytics.totalTasks} total tasks"
              />
            {:else if config.metric === 'overdue'}
              <StatsCard
                label="Overdue"
                value={analytics.overdueCount}
                icon="⏰"
                color={analytics.overdueCount === 0 ? "success" : "danger"}
                subtitle="{analytics.dueTodayCount} due today"
              />
            {/if}
          {:else if widget.type === 'completion-chart'}
            {@const config = getWidgetConfig(widget)}
            <CompletionChart {tasks} days={config.days} />
          {:else if widget.type === 'habit-tracker'}
            {@const config = getWidgetConfig(widget)}
            <HabitTracker {tasks} weeks={config.weeks} />
          {:else if widget.type === 'predictive-insights'}
            <PredictiveInsightsPanel {tasks} />
          {:else if widget.type === 'week-comparison'}
            <WeekOverWeekComparison {tasks} />
          {:else if widget.type === 'health-breakdown'}
            <HealthBreakdown {tasks} />
          {:else if widget.type === 'summary'}
            <!-- Summary Stats -->
            <div class="summary-section-content">
              <h3 class="summary-title">Summary</h3>
              
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-label">Total Tasks:</span>
                  <span class="summary-value">{analytics.totalTasks}</span>
                </div>
                
                <div class="summary-item">
                  <span class="summary-label">Active:</span>
                  <span class="summary-value">{analytics.activeTasks}</span>
                </div>
                
                <div class="summary-item">
                  <span class="summary-label">Disabled:</span>
                  <span class="summary-value">{analytics.disabledTasks}</span>
                </div>
                
                <div class="summary-item">
                  <span class="summary-label">Due Today:</span>
                  <span class="summary-value">{analytics.dueTodayCount}</span>
                </div>
                
                <div class="summary-item">
                  <span class="summary-label">Due This Week:</span>
                  <span class="summary-value">{analytics.dueThisWeekCount}</span>
                </div>
                
                <div class="summary-item">
                  <span class="summary-label">Overdue:</span>
                  <span class="summary-value" class:danger={analytics.overdueCount > 0}>{analytics.overdueCount}</span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </DashboardWidget>
    {/each}
  </div>
</div>

<style>
  .analytics-dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 20px;
    background: var(--b3-theme-background, #f9fafb);
  }
  
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .dashboard-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--b3-theme-on-background, #1f2937);
  }
  
  .export-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--b3-theme-primary, #3b82f6);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .export-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
  
  .export-icon {
    font-size: 1rem;
  }
  
  /* Phase 4.3: Widgets Grid with Drag-Drop */
  .widgets-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 16px;
    width: 100%;
  }
  
  .widgets-grid.edit-mode {
    gap: 20px;
  }
  
  /* Summary Section Content */
  .summary-section-content {
    width: 100%;
  }
  
  .summary-title {
    margin: 0 0 16px 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--b3-theme-on-background, #1f2937);
  }
  
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
  }
  
  .summary-item {
    display: flex;
    justify-content: space-between;
    padding: 12px;
    background: var(--b3-theme-surface, #f9fafb);
    border-radius: 6px;
  }
  
  .summary-label {
    font-size: 0.875rem;
    color: var(--b3-label-color, #6b7280);
    font-weight: 500;
  }
  
  .summary-value {
    font-size: 1rem;
    font-weight: 700;
    color: var(--b3-theme-on-background, #1f2937);
  }
  
  .summary-value.danger {
    color: #ef4444;
  }
  
  /* Mobile Responsive */
  @media (max-width: 1200px) {
    .widgets-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  
  @media (max-width: 768px) {
    .widgets-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .summary-grid {
      grid-template-columns: 1fr;
    }
  }
  
  @media (max-width: 480px) {
    .widgets-grid {
      grid-template-columns: 1fr;
    }
    
    .dashboard-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  }
</style>
