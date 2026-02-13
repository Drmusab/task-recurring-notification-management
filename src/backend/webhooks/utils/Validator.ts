import { WebhookRequest } from "@backend/webhooks/types/Request";
import { WebhookError } from "@backend/webhooks/types/Error";

/**
 * Request validation utilities
 */
export class Validator {
  /**
   * Validate request envelope
   */
  static validateRequest(body: any): WebhookRequest {
    if (!body || typeof body !== 'object') {
      throw new WebhookError('INVALID_REQUEST', 'Request body must be a JSON object');
    }

    // Validate command
    if (!body.command || typeof body.command !== 'string') {
      throw new WebhookError('INVALID_REQUEST', 'Missing or invalid "command" field');
    }

    if (!this.validateCommandFormat(body.command)) {
      throw new WebhookError(
        'INVALID_REQUEST',
        'Command must be in format: v{major}/{category}/{action}',
        { command: body.command }
      );
    }

    // Validate data
    if (!body.data || typeof body.data !== 'object') {
      throw new WebhookError('INVALID_REQUEST', 'Missing or invalid "data" field');
    }

    // Validate meta
    if (!body.meta || typeof body.meta !== 'object') {
      throw new WebhookError('INVALID_REQUEST', 'Missing or invalid "meta" field');
    }

    if (!body.meta.requestId || typeof body.meta.requestId !== 'string') {
      throw new WebhookError('INVALID_REQUEST', 'Missing or invalid "meta.requestId"');
    }

    if (!body.meta.timestamp || typeof body.meta.timestamp !== 'string') {
      throw new WebhookError('INVALID_REQUEST', 'Missing or invalid "meta.timestamp"');
    }

    if (!this.validateISO8601(body.meta.timestamp)) {
      throw new WebhookError(
        'INVALID_REQUEST',
        'meta.timestamp must be ISO-8601 format',
        { timestamp: body.meta.timestamp }
      );
    }

    if (!body.meta.source || typeof body.meta.source !== 'string') {
      throw new WebhookError('INVALID_REQUEST', 'Missing or invalid "meta.source"');
    }

    // Validate idempotency key if present
    if (body.meta.idempotencyKey !== undefined) {
      if (typeof body.meta.idempotencyKey !== 'string') {
        throw new WebhookError('INVALID_REQUEST', 'meta.idempotencyKey must be a string');
      }

      if (!this.validateIdempotencyKey(body.meta.idempotencyKey)) {
        throw new WebhookError(
          'INVALID_REQUEST',
          'meta.idempotencyKey must be 1-255 alphanumeric characters or -_',
          { idempotencyKey: body.meta.idempotencyKey }
        );
      }
    }

    return body as WebhookRequest;
  }

  /**
   * Validate command format: v1/category/action
   */
  private static validateCommandFormat(command: string): boolean {
    const pattern = /^v\d+\/[a-z]+\/[a-z-]+$/;
    return pattern.test(command);
  }

  /**
   * Validate ISO-8601 timestamp
   */
  private static validateISO8601(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && date.toISOString() === timestamp;
  }

  /**
   * Validate idempotency key format
   */
  private static validateIdempotencyKey(key: string): boolean {
    if (key.length === 0 || key.length > 255) {
      return false;
    }
    const pattern = /^[a-zA-Z0-9_-]+$/;
    return pattern.test(key);
  }

  /**
   * Validate timestamp is not too old or in future
   */
  static validateTimestampFreshness(
    timestamp: string,
    maxAgeSeconds: number = 300
  ): void {
    const requestTime = new Date(timestamp).getTime();
    const now = Date.now();
    const age = (now - requestTime) / 1000;

    if (age > maxAgeSeconds) {
      throw new WebhookError(
        'INVALID_REQUEST',
        `Request timestamp too old (${Math.floor(age)}s > ${maxAgeSeconds}s)`,
        { timestamp, ageSeconds: age }
      );
    }

    if (age < -60) {
      // Allow 1 minute clock skew
      throw new WebhookError(
        'INVALID_REQUEST',
        'Request timestamp is in the future',
        { timestamp }
      );
    }
  }
}
