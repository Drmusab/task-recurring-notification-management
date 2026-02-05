/**
 * Performance measurement utilities for critical operations
 */

import * as logger from "./logger";

export interface PerformanceStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
}

export class PerformanceProfiler {
  private measurements: Map<string, number[]> = new Map();
  private warnThresholdMs: number = 1000;

  constructor(warnThresholdMs: number = 1000) {
    this.warnThresholdMs = warnThresholdMs;
  }

  /**
   * Measure the performance of an async operation
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.record(name, duration);

      if (duration > this.warnThresholdMs) {
        logger.warn(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
      }
    }
  }

  /**
   * Measure the performance of a sync operation
   */
  measureSync<T>(name: string, fn: () => T): T {
    const start = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - start;
      this.record(name, duration);

      if (duration > this.warnThresholdMs) {
        logger.warn(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
      }
    }
  }

  /**
   * Record a measurement
   */
  record(name: string, duration: number): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);
  }

  /**
   * Get statistics for a specific operation
   */
  getStats(name: string): PerformanceStats | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);

    return {
      count: measurements.length,
      avg: sum / measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: this.percentile(sorted, 0.95),
    };
  }

  /**
   * Get all statistics
   */
  getAllStats(): Map<string, PerformanceStats> {
    const allStats = new Map<string, PerformanceStats>();
    for (const name of this.measurements.keys()) {
      const stats = this.getStats(name);
      if (stats) {
        allStats.set(name, stats);
      }
    }
    return allStats;
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
  }

  /**
   * Clear measurements for a specific operation
   */
  clearOperation(name: string): void {
    this.measurements.delete(name);
  }

  /**
   * Log all performance stats
   */
  logStats(): void {
    const stats = this.getAllStats();
    if (stats.size === 0) {
      logger.info("[Performance] No measurements recorded");
      return;
    }

    logger.info("[Performance] Statistics:");
    for (const [name, stat] of stats) {
      logger.info(
        `  ${name}: avg=${stat.avg.toFixed(2)}ms, min=${stat.min.toFixed(2)}ms, max=${stat.max.toFixed(2)}ms, p95=${stat.p95.toFixed(2)}ms, count=${stat.count}`
      );
    }
  }
}

// Global profiler instance
export const profiler = new PerformanceProfiler();
