/**
 * Event configuration for webhook/notification system.
 */
export interface EventConfig {
  maxRetries: number;
  retryDelayMs: number;
  retryBackoffMultiplier: number;
  maxRetryDelayMs: number;
  eventTimeoutMs: number;
  queueMaxSize: number;
}

export const DEFAULT_EVENT_CONFIG: EventConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  retryBackoffMultiplier: 2,
  maxRetryDelayMs: 30000,
  eventTimeoutMs: 10000,
  queueMaxSize: 1000,
};

export type { EventConfig as default };
