/**
 * Webhook configuration settings
 * Manages webhook endpoints, security, and validation rules
 */

export interface WebhookConfig {
  /** Webhook endpoint URL */
  url: string;
  
  /** Secret key for HMAC signature validation */
  secret: string;
  
  /** Maximum request body size in bytes (default: 1MB) */
  maxBodySize?: number;
  
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  
  /** Enable signature validation */
  validateSignature?: boolean;
  
  /** Enable timestamp validation to prevent replay attacks */
  validateTimestamp?: boolean;
  
  /** Maximum allowed timestamp age in seconds (default: 300) */
  maxTimestampAge?: number;
  
  /** Retry configuration */
  retry?: {
    /** Maximum number of retry attempts */
    maxAttempts: number;
    /** Delay between retries in milliseconds */
    delayMs: number;
    /** Use exponential backoff */
    exponentialBackoff?: boolean;
  };
}

/**
 * Default webhook configuration
 */
export const DEFAULT_WEBHOOK_CONFIG: Partial<WebhookConfig> = {
  maxBodySize: 1024 * 1024, // 1MB
  timeout: 30000, // 30 seconds
  validateSignature: true,
  validateTimestamp: true,
  maxTimestampAge: 300, // 5 minutes
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
    exponentialBackoff: true,
  },
};

/**
 * Merge user config with defaults
 */
export function createWebhookConfig(userConfig: Partial<WebhookConfig>): WebhookConfig {
  if (!userConfig.url) {
    throw new Error('Webhook URL is required');
  }
  
  if (!userConfig.secret) {
    throw new Error('Webhook secret is required');
  }
  
  return {
    ...DEFAULT_WEBHOOK_CONFIG,
    ...userConfig,
    url: userConfig.url,
    secret: userConfig.secret,
    retry: {
      ...DEFAULT_WEBHOOK_CONFIG.retry!,
      ...userConfig.retry,
    },
  };
}
