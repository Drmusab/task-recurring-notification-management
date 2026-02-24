/**
 * Chart Adapter Layer
 *
 * Wraps D3-based chart rendering behind lazy-loaded adapters.
 * Charts are NEVER loaded at plugin startup — they load on first panel open.
 *
 * Each adapter:
 * 1. Lazy-loads D3 via lazyD3.ts
 * 2. Renders into a provided container element
 * 3. Returns a cleanup function
 *
 * All chart files (heatmapChart.ts, pieChart.ts, bulletChart.ts) were removed
 * in the dead-code elimination phase. These adapters provide a lightweight
 * replacement that can be expanded when full D3 charts are needed.
 */

import { loadD3 } from "@frontend/utils/lazyD3";

// ─── Types ──────────────────────────────────────────────────

export interface ChartRenderOptions {
  /** Container element to render into */
  container: HTMLElement;
  /** Width override (defaults to container width) */
  width?: number;
  /** Height override (defaults to 200) */
  height?: number;
  /** Use SiYuan CSS variables for colors */
  useSiYuanTheme?: boolean;
}

export interface HeatmapData {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface PieSlice {
  label: string;
  value: number;
  color?: string;
}

export interface BulletData {
  label: string;
  actual: number;
  target: number;
  ranges: number[];
}

// ─── Heatmap Chart ──────────────────────────────────────────

/**
 * Render a task completion heatmap (GitHub-style contribution grid).
 * Lazy-loads D3 on first call.
 *
 * @returns Cleanup function to remove the chart
 */
export async function renderHeatmapChart(
  data: HeatmapData[],
  options: ChartRenderOptions
): Promise<() => void> {
  const { container, width, height = 120, useSiYuanTheme = true } = options;

  try {
    const d3 = await loadD3();

    const w = width ?? container.clientWidth;
    const cellSize = Math.max(8, Math.floor(w / 53));
    const h = height;

    // Create SVG
    const svg = d3
      .select(container)
      .append("svg")
      .attr("class", "rtm-heatmap-chart")
      .attr("width", w)
      .attr("height", h)
      .attr("role", "img")
      .attr("aria-label", `Task completion heatmap with ${data.length} data points`);

    // Color scale
    const maxVal = d3.max(data, (d: HeatmapData) => d.value) || 1;
    const colorScale = useSiYuanTheme
      ? d3.scaleSequential(d3.interpolateGreens).domain([0, maxVal])
      : d3.scaleSequential(d3.interpolateBlues).domain([0, maxVal]);

    // Render cells
    svg
      .selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (_d: HeatmapData, i: number) => (i % 53) * (cellSize + 2))
      .attr("y", (_d: HeatmapData, i: number) => Math.floor(i / 53) * (cellSize + 2))
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("rx", 2)
      .attr("fill", (d: HeatmapData) => (d.value > 0 ? colorScale(d.value) : "var(--b3-border-color)"))
      .append("title")
      .text((d: HeatmapData) => `${d.date}: ${d.value} task${d.value !== 1 ? "s" : ""}`);

    return () => {
      svg.remove();
    };
  } catch (error) {
    console.warn("[ChartAdapters] Heatmap render failed — falling back to text", error);
    container.innerHTML = `<div class="rtm-chart-fallback" role="status">
      <p>Heatmap: ${data.length} data points</p>
    </div>`;
    return () => {
      container.innerHTML = "";
    };
  }
}

// ─── Pie Chart ──────────────────────────────────────────────

/**
 * Render a task distribution pie chart.
 * Lazy-loads D3 on first call.
 *
 * @returns Cleanup function to remove the chart
 */
export async function renderPieChart(
  slices: PieSlice[],
  options: ChartRenderOptions
): Promise<() => void> {
  const { container, width, height = 200 } = options;

  try {
    const d3 = await loadD3();

    const w = width ?? Math.min(container.clientWidth, 300);
    const h = height;
    const radius = Math.min(w, h) / 2 - 10;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("class", "rtm-pie-chart")
      .attr("width", w)
      .attr("height", h)
      .attr("role", "img")
      .attr("aria-label", `Task distribution: ${slices.map((s) => `${s.label} ${s.value}`).join(", ")}`)
      .append("g")
      .attr("transform", `translate(${w / 2},${h / 2})`);

    const pie = d3.pie().value((d: any) => d.value);
    const arc = d3.arc().innerRadius(0).outerRadius(radius);

    const colors = d3.scaleOrdinal(d3.schemeTableau10);

    svg
      .selectAll("path")
      .data(pie(slices))
      .enter()
      .append("path")
      .attr("d", arc as any)
      .attr("fill", (_d: unknown, i: number) => colors(String(i)))
      .attr("stroke", "var(--b3-theme-background)")
      .attr("stroke-width", 2)
      .append("title")
      .text((d: any) => `${d.data.label}: ${d.data.value}`);

    return () => {
      d3.select(container).select(".rtm-pie-chart").remove();
    };
  } catch (error) {
    console.warn("[ChartAdapters] Pie chart render failed — falling back to text", error);
    container.innerHTML = `<div class="rtm-chart-fallback" role="status">
      <ul>${slices.map((s) => `<li>${s.label}: ${s.value}</li>`).join("")}</ul>
    </div>`;
    return () => {
      container.innerHTML = "";
    };
  }
}

// ─── Bullet Chart ───────────────────────────────────────────

/**
 * Render a bullet chart for goal tracking.
 * Lazy-loads D3 on first call.
 *
 * @returns Cleanup function to remove the chart
 */
export async function renderBulletChart(
  data: BulletData,
  options: ChartRenderOptions
): Promise<() => void> {
  const { container, width, height = 40 } = options;

  try {
    const d3 = await loadD3();

    const w = width ?? container.clientWidth;
    const h = height;
    const maxRange = Math.max(...data.ranges, data.target, data.actual);

    const xScale = d3.scaleLinear().domain([0, maxRange]).range([0, w - 40]);

    const svg = d3
      .select(container)
      .append("svg")
      .attr("class", "rtm-bullet-chart")
      .attr("width", w)
      .attr("height", h)
      .attr("role", "img")
      .attr("aria-label", `${data.label}: ${data.actual} of ${data.target} target`);

    // Range bars
    const rangeColors = ["#ddd", "#ccc", "#bbb"];
    data.ranges.forEach((range: number, i: number) => {
      svg
        .append("rect")
        .attr("x", 0)
        .attr("y", 4)
        .attr("width", xScale(range))
        .attr("height", h - 8)
        .attr("fill", rangeColors[i] || "#eee")
        .attr("rx", 2);
    });

    // Actual bar
    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", h / 2 - 6)
      .attr("width", xScale(data.actual))
      .attr("height", 12)
      .attr("fill", "var(--b3-theme-primary)")
      .attr("rx", 2);

    // Target marker
    svg
      .append("line")
      .attr("x1", xScale(data.target))
      .attr("x2", xScale(data.target))
      .attr("y1", 2)
      .attr("y2", h - 2)
      .attr("stroke", "var(--b3-theme-on-background)")
      .attr("stroke-width", 2);

    return () => {
      d3.select(container).select(".rtm-bullet-chart").remove();
    };
  } catch (error) {
    console.warn("[ChartAdapters] Bullet chart render failed — falling back to text", error);
    container.innerHTML = `<div class="rtm-chart-fallback" role="status">
      <p>${data.label}: ${data.actual}/${data.target}</p>
    </div>`;
    return () => {
      container.innerHTML = "";
    };
  }
}
