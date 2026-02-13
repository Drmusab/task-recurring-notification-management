<script lang="ts">
  /**
   * CompletionChart - D3.js line chart showing completion trends
   * Displays task completions over the last 30 days with streak visualization
   */
  
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import type { Task } from "@backend/core/models/Task";
  
  export let tasks: Task[] = [];
  export let days: number = 30;
  
  let chartContainer: HTMLDivElement;
  let chartRendered = false;
  
  interface DayData {
    date: Date;
    completions: number;
    dateStr: string;
  }
  
  /**
   * Generate daily completion data for chart
   */
  function generateChartData(): DayData[] {
    const now = new Date();
    const data: DayData[] = [];
    
    // Create array of dates for the last N days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      data.push({
        date,
        completions: 0,
        dateStr: date.toISOString().slice(0, 10),
      });
    }
    
    // Count completions per day
    for (const task of tasks) {
      if (!task.recentCompletions) continue;
      
      for (const completionISOString of task.recentCompletions) {
        const completionDate = new Date(completionISOString);
        const dateStr = completionDate.toISOString().slice(0, 10);
        
        const dayData = data.find(d => d.dateStr === dateStr);
        if (dayData) {
          dayData.completions++;
        }
      }
    }
    
    return data;
  }
  
  /**
   * Render D3.js line chart
   */
  function renderChart() {
    if (!chartContainer || chartRendered) return;
    
    const data = generateChartData();
    if (data.length === 0) return;
    
    // Clear previous chart
    d3.select(chartContainer).selectAll("*").remove();
    
    // Dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(chartContainer)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.date) as [Date, Date])
      .range([0, width]);
    
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.completions) || 10])
      .nice()
      .range([height, 0]);
    
    // Axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(7, data.length))
      .tickFormat(d3.timeFormat("%m/%d") as any);
    
    const yAxis = d3.axisLeft(yScale)
      .ticks(5);
    
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");
    
    svg.append("g")
      .call(yAxis);
    
    // Grid lines
    svg.append("g")
      .attr("class", "grid")
      .attr("opacity", 0.1)
      .call(d3.axisLeft(yScale)
        .tickSize(-width)
        .tickFormat(() => "") as any
      );
    
    // Line
    const line = d3.line<DayData>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.completions))
      .curve(d3.curveMonotoneX);
    
    svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2.5)
      .attr("d", line);
    
    // Area fill
    const area = d3.area<DayData>()
      .x(d => xScale(d.date))
      .y0(height)
      .y1(d => yScale(d.completions))
      .curve(d3.curveMonotoneX);
    
    svg.append("path")
      .datum(data)
      .attr("fill", "#3b82f6")
      .attr("fill-opacity", 0.2)
      .attr("d", area);
    
    // Data points
    svg.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.date))
      .attr("cy", d => yScale(d.completions))
      .attr("r", 4)
      .attr("fill", "#3b82f6")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("r", 6)
          .attr("fill", "#1d4ed8");
        
        // Tooltip
        const tooltip = d3.select(chartContainer)
          .append("div")
          .attr("class", "chart-tooltip")
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
            Completions: ${d.completions}
          `);
        
        const [mouseX, mouseY] = d3.pointer(event, chartContainer);
        tooltip
          .style("left", `${mouseX + 10}px`)
          .style("top", `${mouseY - 10}px`);
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("r", 4)
          .attr("fill", "#3b82f6");
        
        d3.select(chartContainer).selectAll(".chart-tooltip").remove();
      });
    
    // Axis labels
    svg.append("text")
      .attr("transform", `translate(${width / 2},${height + margin.bottom - 5})`)
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#6b7280")
      .text("Date");
    
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#6b7280")
      .text("Completions");
    
    chartRendered = true;
  }
  
  onMount(() => {
    renderChart();
  });
  
  // Re-render when tasks change
  $: if (chartContainer && tasks) {
    chartRendered = false;
    renderChart();
  }
</script>

<div class="completion-chart">
  <h3 class="chart-title">
    📈 Completion Trend (Last {days} Days)
  </h3>
  
  <div class="chart-container" bind:this={chartContainer}></div>
  
  {#if tasks.length === 0}
    <div class="empty-state">
      <p>No task data available</p>
      <span class="empty-icon">📊</span>
    </div>
  {/if}
</div>

<style>
  .completion-chart {
    background: var(--b3-card-background, #fff);
    border: 1px solid var(--b3-border-color, #e5e7eb);
    border-radius: 8px;
    padding: 20px;
  }
  
  .chart-title {
    margin: 0 0 16px 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--b3-theme-on-background, #1f2937);
  }
  
  .chart-container {
    width: 100%;
    min-height: 300px;
    position: relative;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: var(--b3-label-color, #6b7280);
  }
  
  .empty-icon {
    font-size: 3rem;
    opacity: 0.3;
    margin-top: 16px;
  }
  
  :global(.completion-chart svg) {
    font-family: var(--b3-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  }
  
  :global(.completion-chart .grid line) {
    stroke: #d1d5db;
  }
  
  :global(.completion-chart .domain) {
    stroke: #9ca3af;
  }
  
  :global(.completion-chart .tick text) {
    fill: #6b7280;
    font-size: 11px;
  }
</style>
