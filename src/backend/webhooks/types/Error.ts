import type { ErrorCode } from "@backend/webhooks/types/Response";

/**
 * Custom error class for webhook operations
 */
export class WebhookError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'WebhookError';
  }

  /**
   * Convert to error response format
   */
  toResponse(): {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
  } {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
