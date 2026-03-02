/**
 * Scheduler — Tick-Based Execution Trigger (§4.4)
 *
 * Lightweight timer that drives the execution pipeline.
 * Emits "engine:tick:complete" events at configured intervals.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Owns the timer interval
 *   ✔ Workspace-aware (pause/resume on workspace switch)
 *   ✔ Emits events through EventBus
 *   ❌ No task reads or mutations
 *   ❌ No frontend imports
 */

import { eventBus } from "@events/EventBus";
import type { QueryEngine } from "@query/QueryEngine";
import type { DomainTask } from "@domain/DomainTask";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface SchedulerConfig {
  /** Interval between ticks in milliseconds */
  readonly intervalMs: number;
  /** Whether to run an immediate check on start */
  readonly immediateCheck: boolean;
}

export interface TickResult {
  readonly timestamp: string;
  readonly dueCount: number;
  readonly overdueCount: number;
  readonly durationMs: number;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  intervalMs: 60_000, // 1 minute
  immediateCheck: true,
};

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class Scheduler {
  private config: SchedulerConfig;
  private queryEngine: QueryEngine;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private tickCount = 0;

  constructor(queryEngine: QueryEngine, config: Partial<SchedulerConfig> = {}) {
    this.queryEngine = queryEngine;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.timerId !== null) return; // Already running

    if (this.config.immediateCheck) {
      void this.tick();
    }

    this.timerId = setInterval(() => {
      if (!this.paused) {
        void this.tick();
      }
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Pause the scheduler (workspace switch, plugin disabled).
   * Timer keeps running but ticks become no-ops.
   */
  pause(reason?: string): void {
    this.paused = true;
    void reason; // For logging if needed
  }

  /**
   * Resume the scheduler and trigger immediate check.
   */
  resume(): void {
    this.paused = false;
    void this.tick(); // Catch up
  }

  /**
   * Trigger an immediate tick (e.g., after task mutation).
   */
  triggerCheck(): void {
    if (!this.paused && this.timerId !== null) {
      void this.tick();
    }
  }

  /**
   * Check if the scheduler is currently running.
   */
  isRunning(): boolean {
    return this.timerId !== null;
  }

  /**
   * Get tick count for monitoring.
   */
  getTickCount(): number {
    return this.tickCount;
  }

  // ── Core Tick ────────────────────────────────────────────────

  /**
   * Single tick: query due tasks and emit reminder events.
   */
  private async tick(): Promise<TickResult> {
    const start = performance.now();
    this.tickCount++;

    const dueTasks = this.queryEngine.selectDue();
    const overdueTasks = this.queryEngine.selectOverdue();

    // Emit reminder events for due tasks
    for (const task of dueTasks) {
      eventBus.emit("task:reminder:due", { task });
    }

    // Emit missed events for overdue tasks
    for (const task of overdueTasks) {
      eventBus.emit("task:runtime:missed", {
        task,
        missedAt: new Date().toISOString(),
      });
    }

    const durationMs = performance.now() - start;

    return {
      timestamp: new Date().toISOString(),
      dueCount: dueTasks.length,
      overdueCount: overdueTasks.length,
      durationMs,
    };
  }
}
