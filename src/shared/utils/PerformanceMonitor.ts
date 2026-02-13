/**
 * Performance Monitor - Track and log performance metrics
 * 
 * Monitors:
 * - Query execution time
 * - Index update time
 * - Task parse/serialize time
 * - Memory usage
 * - Operation counts
 */

export interface PerformanceMetric {
  name: string;
  duration: number;         // milliseconds
  timestamp: string;        // ISO timestamp
  metadata?: Record<string, unknown>;
}

export interface PerformanceStats {
  operationCounts: Map<string, number>;
  averageDurations: Map<string, number>;
  maxDurations: Map<string, number>;
  minDurations: Map<string, number>;
  totalOperations: number;
}

/**
 * Performance monitor with timing and profiling
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 1000;  // Keep last 1000 metrics
  private enabled: boolean = true;
  private activeTimers: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  startTimer(operationName: string): void {
    if (!this.enabled) return;
    this.activeTimers.set(operationName, performance.now());
  }

  /**
   * End timing and record metric
   */
  endTimer(operationName: string, metadata?: Record<string, unknown>): number {
    if (!this.enabled) return 0;

    const startTime = this.activeTimers.get(operationName);
    if (!startTime) {
      console.warn(`Timer not found for operation: ${operationName}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.activeTimers.delete(operationName);

    this.recordMetric({
      name: operationName,
      duration,
      timestamp: new Date().toISOString(),
      metadata,
    });

    return duration;
  }

  /**
   * Measure a synchronous operation
   */
  measure<T>(operationName: string, fn: () => T, metadata?: Record<string, unknown>): T {
    if (!this.enabled) return fn();

    this.startTimer(operationName);
    try {
      return fn();
    } finally {
      this.endTimer(operationName, metadata);
    }
  }

  /**
   * Measure an asynchronous operation
   */
  async measureAsync<T>(
    operationName: string, 
    fn: () => Promise<T>, 
    metadata?: Record<string, unknown>
  ): Promise<T> {
    if (!this.enabled) return fn();

    this.startTimer(operationName);
    try {
      return await fn();
    } finally {
      this.endTimer(operationName, metadata);
    }
  }

  /**
   * Record a manual metric
   */
  recordMetric(metric: PerformanceMetric): void {
    if (!this.enabled) return;

    this.metrics.push(metric);

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations
    if (metric.duration > 100) {
      console.warn(`Slow operation: ${metric.name} took ${metric.duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get statistics for an operation
   */
  getStats(operationName?: string): PerformanceStats {
    const filteredMetrics = operationName
      ? this.metrics.filter(m => m.name === operationName)
      : this.metrics;

    const stats: PerformanceStats = {
      operationCounts: new Map(),
      averageDurations: new Map(),
      maxDurations: new Map(),
      minDurations: new Map(),
      totalOperations: filteredMetrics.length,
    };

    // Group by operation name
    const grouped = new Map<string, number[]>();
    
    for (const metric of filteredMetrics) {
      if (!grouped.has(metric.name)) {
        grouped.set(metric.name, []);
      }
      grouped.get(metric.name)!.push(metric.duration);
    }

    // Calculate stats for each operation
    for (const [name, durations] of grouped) {
      stats.operationCounts.set(name, durations.length);
      stats.averageDurations.set(
        name,
        durations.reduce((a, b) => a + b, 0) / durations.length
      );
      stats.maxDurations.set(name, Math.max(...durations));
      stats.minDurations.set(name, Math.min(...durations));
    }

    return stats;
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 100): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(thresholdMs: number = 100): PerformanceMetric[] {
    return this.metrics.filter(m => m.duration > thresholdMs);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const stats = this.getStats();
    const lines: string[] = [];

    lines.push('=== Performance Report ===');
    lines.push(`Total Operations: ${stats.totalOperations}`);
    lines.push('');

    lines.push('Operation Statistics:');
    for (const [name, count] of stats.operationCounts) {
      const avg = stats.averageDurations.get(name)!;
      const max = stats.maxDurations.get(name)!;
      const min = stats.minDurations.get(name)!;

      lines.push(`  ${name}:`);
      lines.push(`    Count: ${count}`);
      lines.push(`    Avg: ${avg.toFixed(2)}ms`);
      lines.push(`    Min: ${min.toFixed(2)}ms`);
      lines.push(`    Max: ${max.toFixed(2)}ms`);
    }

    const slowOps = this.getSlowOperations();
    if (slowOps.length > 0) {
      lines.push('');
      lines.push(`Slow Operations (>100ms): ${slowOps.length}`);
      slowOps.slice(0, 10).forEach(op => {
        lines.push(`  ${op.name}: ${op.duration.toFixed(2)}ms at ${op.timestamp}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set max metrics to keep
   */
  setMaxMetrics(max: number): void {
    this.maxMetrics = Math.max(1, max);
    
    // Trim existing metrics if needed
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      stats: {
        ...this.getStats(),
        operationCounts: Array.from(this.getStats().operationCounts.entries()),
        averageDurations: Array.from(this.getStats().averageDurations.entries()),
        maxDurations: Array.from(this.getStats().maxDurations.entries()),
        minDurations: Array.from(this.getStats().minDurations.entries()),
      },
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }
}

/**
 * Singleton instance
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for measuring method performance
 */
export function Measure(target: unknown, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: unknown[]) {
    const className = (this as { constructor: { name: string } }).constructor.name;
    const operationName = `${className}.${propertyKey}`;
    
    return performanceMonitor.measure(operationName, () => originalMethod.apply(this, args));
  };

  return descriptor;
}

/**
 * Decorator for measuring async method performance
 */
export function MeasureAsync(target: unknown, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: unknown[]) {
    const className = (this as { constructor: { name: string } }).constructor.name;
    const operationName = `${className}.${propertyKey}`;
    
    return performanceMonitor.measureAsync(operationName, () => originalMethod.apply(this, args));
  };

  return descriptor;
}

/**
 * Simple logger with levels
 */
export class Logger {
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private logs: Array<{ level: string; message: string; timestamp: string; data?: unknown }> = [];
  private maxLogs: number = 500;

  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    this.logs.push(logEntry);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    const logFn = console[level] || console.log;
    logFn(`[${level.toUpperCase()}] ${message}`, data || '');
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  getLogs(): typeof this.logs {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

/**
 * Singleton logger instance
 */
export const logger = new Logger();
