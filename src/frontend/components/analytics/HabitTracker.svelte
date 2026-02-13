<script lang="ts">
  /**
   * HabitTracker - GitHub-style heatmap showing completion density
   * Visualizes task completion patterns over time
   */
  
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import type { Task } from "@backend/core/models/Task";
  
  export let tasks: Task[] = [];
  export let weeks: number = 26; // ~6 months
  
  let heatmapContainer: HTMLDivElement;
  let heatmapRendered = false;
  
  interface DayCell {
    date: Date;
    completions: number;
    dateStr: string;
    weekday: number;
    week: number;
  }
  
  /**
   * Generate heatmap data
   */
  function generateHeatmapData(): DayCell[] {
    const now = new Date();
    const data: DayCell[] = [];
    const totalDays = weeks * 7;
    
    // Start from Sunday of the week containing the first day
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - totalDays);
    const dayOfWeek = startDate.getDay(); // 0 = Sunday
    startDate.setDate(startDate.getDate() - dayOfWeek);
    
    // Generate day cells
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      const week = Math.floor(i / 7);
      const weekday = date.getDay(); // 0 = Sunday, 6 = Saturday
      
      data.push({
        date,
        completions: 0,
        dateStr: date.toISOString().slice(0, 10),
        weekday,
        week,
      });
    }
    
    // Count completions per day across all tasks
    for (const task of tasks) {
      if (!task.recentCompletions) continue;
      
      for (const completionISOString of task.recentCompletions) {
        const completionDate = new Date(completionISOString);
        const dateStr = completionDate.toISOString().slice(0, 10);
        
        const dayCell = data.find(d => d.dateStr === dateStr);
        if (dayCell) {
          dayCell.completions++;
        }
      }
    }
    
    return data;
  }
  
  /**
   * Get color for completion count (GitHub-style)
   */
  function getColor(completions: number): string {
    if (completions === 0) return "#ebedf0";
    if (completions === 1) return "#9be9a8";
    if (completions <= 3) return "#40c463";
    if (completions <= 5) return "#30a14e";
    return "#216e39";
  }
  
  /**
   * Render D3.js heatmap
   */
  function renderHeatmap() {
    if (!heatmapContainer || heatmapRendered) return;
    
    const data = generateHeatmapData();
    if (data.length === 0) return;
    
    // Clear previous heatmap
    d3.select(heatmapContainer).selectAll("*").remove();
    
    // Dimensions
    const cellSize = 12;
    const cellGap = 3;
    const weekDayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const labelWidth = 40;
    
    const maxWeek = d3.max(data, d => d.week) || 0;
    const width = labelWidth + (maxWeek + 1) * (cellSize + cellGap);
    const height = 7 * (cellSize + cellGap) + 40;
    
    // Create SVG
    const svg = d3.select(heatmapContainer)
      .append("svg")
      .attr("width", width)
      .attr("height", height);
    
    // Weekday labels
    svg.selectAll(".weekday-label")
      .data(weekDayLabels)
      .enter()
      .append("text")
      .attr("x", 0)
      .attr("y", (d, i) => i * (cellSize + cellGap) + cellSize + 20)
      .attr("text-anchor", "start")
      .attr("font-size", "10px")
      .attr("fill", "#6b7280")
      .text(d => d);
    
    // Month labels (first day of each month)
    const monthData = data.filter(d => d.date.getDate() === 1);
    svg.selectAll(".month-label")
      .data(monthData)
      .enter()
      .append("text")
      .attr("x", d => labelWidth + d.week * (cellSize + cellGap))
      .attr("y", 10)
      .attr("font-size", "10px")
      .attr("fill", "#6b7280")
      .text(d => d3.timeFormat("%b")(d.date));
    
    // Day cells
    svg.selectAll(".day-cell")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", d => labelWidth + d.week * (cellSize + cellGap))
      .attr("y", d => d.weekday * (cellSize + cellGap) + 20)
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("rx", 2)
      .attr("fill", d => getColor(d.completions))
      .attr("stroke", "#d1d5db")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("stroke", "#3b82f6")
          .attr("stroke-width", 2);
        
        // Tooltip
        const tooltip = d3.select(heatmapContainer)
          .append("div")
          .attr("class", "heatmap-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "#fff")
          .style("padding", "8px 12px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "1000")
          .html(`
            <strong>${d.date.toLocaleDateString()}</strong><br/>
            ${d.completions} completion${d.completions === 1 ? '' : 's'}
          `);
        
        const rect = (this as SVGRectElement).getBoundingClientRect();
        const container = heatmapContainer.getBoundingClientRect();
        tooltip
          .style("left", `${rect.left - container.left + cellSize / 2}px`)
          .style("top", `${rect.top - container.top - 40}px`)
          .style("transform", "translateX(-50%)");
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("stroke", "#d1d5db")
          .attr("stroke-width", 0.5);
        
        d3.select(heatmapContainer).selectAll(".heatmap-tooltip").remove();
      });
    
    heatmapRendered = true;
  }
  
  onMount(() => {
    renderHeatmap();
  });
  
  // Re-render when tasks change
  $: if (heatmapContainer && tasks) {
    heatmapRendered = false;
    renderHeatmap();
  }
</script>

<div class="habit-tracker">
  <h3 class="tracker-title">
    🔥 Completion Heatmap (Last {weeks} Weeks)
  </h3>
  
  <div class="legend">
    <span class="legend-label">Less</span>
    <div class="legend-colors">
      <div class="legend-cell" style="background-color: #ebedf0;"></div>
      <div class="legend-cell" style="background-color: #9be9a8;"></div>
      <div class="legend-cell" style="background-color: #40c463;"></div>
      <div class="legend-cell" style="background-color: #30a14e;"></div>
      <div class="legend-cell" style="background-color: #216e39;"></div>
    </div>
    <span class="legend-label">More</span>
  </div>
  
  <div class="heatmap-container" bind:this={heatmapContainer}></div>
  
  {#if tasks.length === 0}
    <div class="empty-state">
      <p>No completion data available</p>
      <span class="empty-icon">🔥</span>
    </div>
  {/if}
</div>

<style>
  .habit-tracker {
    background: var(--b3-card-background, #fff);
    border: 1px solid var(--b3-border-color, #e5e7eb);
    border-radius: 8px;
    padding: 20px;
  }
  
  .tracker-title {
    margin: 0 0 16px 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--b3-theme-on-background, #1f2937);
  }
  
  .legend {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 0.875rem;
    color: var(--b3-label-color, #6b7280);
  }
  
  .legend-colors {
    display: flex;
    gap: 3px;
  }
  
  .legend-cell {
    width: 12px;
    height: 12px;
    border: 0.5px solid #d1d5db;
    border-radius: 2px;
  }
  
  .legend-label {
    font-size: 0.75rem;
  }
  
  .heatmap-container {
    width: 100%;
    overflow-x: auto;
    position: relative;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    color: var(--b3-label-color, #6b7280);
  }
  
  .empty-icon {
    font-size: 3rem;
    opacity: 0.3;
    margin-top: 16px;
  }
  
  :global(.habit-tracker svg) {
    font-family: var(--b3-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  }
</style>
