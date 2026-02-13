// @ts-nocheck
import { EventConfig } from "@backend/config/EventConfig";

/**
 * Manages exponential backoff retry logic
 */
export class RetryManager {
  constructor(private config: EventConfig['retry']) {}

  /**
   * Calculate next retry delay
   */
  calculateDelay(attemptNumber: number): number {
    const delay =
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber - 1);

    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Calculate next retry timestamp
   */
  calculateNextRetry(attemptNumber: number): Date {
    const delay = this.calculateDelay(attemptNumber);
    return new Date(Date.now() + delay);
  }

  /**
   * Check if should retry
   */
  shouldRetry(attemptNumber: number): boolean {
    return attemptNumber < this.config.maxAttempts;
  }

  /**
   * Get retry schedule (for display)
   */
  getRetrySchedule(): Array<{ attempt: number; delayMs: number; delayHuman: string }> {
    const schedule = [];

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      const delayMs = this.calculateDelay(attempt);
      const delayHuman = this.formatDelay(delayMs);

      schedule.push({ attempt, delayMs, delayHuman });
    }

    return schedule;
  }

  /**
   * Format delay as human-readable string
   */
  private formatDelay(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    return `${Math.floor(ms / 3600000)}h`;
  }
}
