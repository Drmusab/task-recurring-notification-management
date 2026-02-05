import { SCHEDULER_INTERVAL_MS } from "@shared/constants/misc-constants";

/**
 * SchedulerTimer manages the self-correcting timer loop for the Scheduler.
 */
export class SchedulerTimer {
  private intervalMs: number;
  private timeoutId: number | null = null;
  private isRunning = false;

  constructor(intervalMs: number, private readonly onTick: () => void) {
    this.intervalMs = intervalMs;
  }

  /**
   * Start the scheduler timer loop.
   */
  start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.scheduleNextTick();
  }

  /**
   * Stop the scheduler timer loop.
   */
  stop(): void {
    if (this.timeoutId !== null) {
      globalThis.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.isRunning = false;
  }

  /**
   * Update the interval in milliseconds.
   */
  setInterval(intervalMs: number): void {
    this.intervalMs = intervalMs;
  }

  /**
   * Check if the timer is currently running.
   */
  isActive(): boolean {
    return this.isRunning;
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) {
      return;
    }
    const now = Date.now();
    const interval = this.intervalMs > 0 ? this.intervalMs : SCHEDULER_INTERVAL_MS;
    const delay = interval - (now % interval);
    // Cast to number for cross-environment compatibility (NodeJS.Timeout vs number)
    this.timeoutId = globalThis.setTimeout(() => {
      this.onTick();
      this.scheduleNextTick();
    }, delay) as number;
  }
}
