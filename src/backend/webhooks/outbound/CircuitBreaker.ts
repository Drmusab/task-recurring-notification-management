/**
 * Circuit Breaker Pattern Implementation
 * 
 * FIX [HIGH-007]: Prevents resource exhaustion when remote endpoints fail repeatedly
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failing fast, requests immediately rejected
 * - HALF_OPEN: Testing if service recovered, single request allowed
 */

import * as logger from '@backend/logging/logger';

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  threshold?: number;
  
  /** Milliseconds to wait before attempting reset (default: 60000 = 1 minute) */
  timeout?: number;
  
  /** Name for logging (default: 'circuit') */
  name?: string;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number | null;
  lastStateChange: number;
}

/**
 * Circuit Breaker - Prevents cascade failures by failing fast when service is down
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailureTime: number | null = null;
  private lastStateChange: number = Date.now();
  
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly name: string;

  constructor(config: CircuitBreakerConfig = {}) {
    this.threshold = config.threshold ?? 5;
    this.timeout = config.timeout ?? 60000; // 1 minute default
    this.name = config.name ?? 'circuit';
  }

  /**
   * Execute function with circuit breaker protection
   * 
   * @param fn - Async function to execute
   * @returns Result of function
   * @throws Error if circuit is OPEN
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.lastStateChange = Date.now();
        logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN (testing recovery)`);
      } else {
        const timeUntilRetry = this.timeout - (Date.now() - (this.lastFailureTime || Date.now()));
        throw new Error(
          `Circuit breaker ${this.name} is OPEN - retry in ${Math.ceil(timeUntilRetry / 1000)}s`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record successful execution
   */
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      logger.info(`Circuit breaker ${this.name} recovered - closing circuit`);
    }
    
    this.failures = 0;
    this.lastFailureTime = null;
    if (this.state !== 'CLOSED') {
      this.state = 'CLOSED';
      this.lastStateChange = Date.now();
    }
  }

  /**
   * Record failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Failed during test - reopen immediately
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
      logger.warn(`Circuit breaker ${this.name} failed during HALF_OPEN test - reopening circuit`);
    } else if (this.failures >= this.threshold && this.state === 'CLOSED') {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
      logger.warn(`Circuit breaker ${this.name} opened after ${this.failures} consecutive failures`);
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.timeout;
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange
    };
  }

  /**
   * Force reset circuit breaker (for testing or manual intervention)
   */
  reset(): void {
    logger.info(`Circuit breaker ${this.name} manually reset`);
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
  }

  /**
   * Get human-readable status
   */
  getStatus(): string {
    const state = this.getState();
    if (state.state === 'OPEN') {
      const timeUntilRetry = this.timeout - (Date.now() - (state.lastFailureTime || Date.now()));
      return `OPEN (${state.failures} failures, retry in ${Math.ceil(timeUntilRetry / 1000)}s)`;
    }
    if (state.state === 'HALF_OPEN') {
      return `HALF_OPEN (testing recovery)`;
    }
    return `CLOSED (${state.failures} failures)`;
  }
}
