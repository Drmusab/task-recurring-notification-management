/**
 * Dashboard Chart Adapters
 *
 * Adapter layer for chart/visualization rendering.
 * All chart dependencies are lazy-loaded via lazyD3.ts — they are NEVER
 * loaded at plugin.onload() time.
 *
 * Usage:
 *   const { renderHeatmap } = await import("@frontend/adapters/dashboard");
 *   renderHeatmap(container, data);
 */

export {
  renderHeatmapChart,
  renderPieChart,
  renderBulletChart,
  type ChartRenderOptions,
} from "./chartAdapters";
