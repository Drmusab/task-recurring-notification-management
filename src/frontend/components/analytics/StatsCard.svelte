<script lang="ts">
  /**
   * StatsCard - Individual statistic display card
   * Used in AnalyticsDashboard to show key metrics
   */
  
  export let label: string;
  export let value: string | number;
  export let icon: string = "📊";
  export let subtitle: string | undefined = undefined;
  export let color: "primary" | "success" | "warning" | "danger" | "info" = "primary";
  export let trend: "up" | "down" | "neutral" | undefined = undefined;
  export let trendValue: string | undefined = undefined;
  
  function getColorClass(color: string): string {
    const colorMap: Record<string, string> = {
      primary: "color-primary",
      success: "color-success",
      warning: "color-warning",
      danger: "color-danger",
      info: "color-info",
    };
    return colorMap[color] || "color-primary";
  }
  
  function getTrendIcon(trend: string | undefined): string {
    if (!trend) return "";
    return trend === "up" ? "↗" : trend === "down" ? "↘" : "→";
  }
  
  function getTrendClass(trend: string | undefined): string {
    if (!trend) return "";
    return trend === "up" ? "trend-up" : trend === "down" ? "trend-down" : "trend-neutral";
  }
</script>

<div class="stats-card {getColorClass(color)}">
  <div class="card-header">
    <span class="card-icon">{icon}</span>
    <span class="card-label">{label}</span>
  </div>
  
  <div class="card-value">
    {value}
  </div>
  
  {#if subtitle}
    <div class="card-subtitle">
      {subtitle}
    </div>
  {/if}
  
  {#if trend && trendValue}
    <div class="card-trend {getTrendClass(trend)}">
      <span class="trend-icon">{getTrendIcon(trend)}</span>
      <span class="trend-value">{trendValue}</span>
    </div>
  {/if}
</div>

<style>
  .stats-card {
    background: var(--b3-card-background, #fff);
    border: 1px solid var(--b3-border-color, #e5e7eb);
    border-radius: 8px;
    padding: 16px;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 180px;
  }
  
  .stats-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
  
  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    color: var(--b3-label-color, #6b7280);
    font-weight: 500;
  }
  
  .card-icon {
    font-size: 1.25rem;
  }
  
  .card-label {
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .card-value {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--b3-theme-primary, #3b82f6);
  }
  
  .color-primary .card-value {
    color: var(--b3-theme-primary, #3b82f6);
  }
  
  .color-success .card-value {
    color: #10b981;
  }
  
  .color-warning .card-value {
    color: #f59e0b;
  }
  
  .color-danger .card-value {
    color: #ef4444;
  }
  
  .color-info .card-value {
    color: #06b6d4;
  }
  
  .card-subtitle {
    font-size: 0.875rem;
    color: var(--b3-label-color, #6b7280);
    margin-top: -4px;
  }
  
  .card-trend {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.875rem;
    font-weight: 600;
    margin-top: 4px;
  }
  
  .trend-up {
    color: #10b981;
  }
  
  .trend-down {
    color: #ef4444;
  }
  
  .trend-neutral {
    color: #6b7280;
  }
  
  .trend-icon {
    font-size: 1rem;
  }
</style>
