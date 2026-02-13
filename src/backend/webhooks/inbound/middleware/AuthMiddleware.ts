/**
 * Authentication middleware for webhook endpoints
 * Validates HMAC signatures and timestamps to ensure request authenticity
 */

import type { Request, Response, NextFunction } from 'express';
import { createHmac } from 'crypto';
import * as logger from "@backend/logging/logger";

export interface AuthMiddlewareOptions {
  secret: string;
  validateTimestamp?: boolean;
  maxTimestampAge?: number; // in seconds
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  const { secret, validateTimestamp = true, maxTimestampAge = 300 } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get signature and timestamp from headers
      const signature = req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;

      if (!signature) {
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      if (validateTimestamp && !timestamp) {
        return res.status(401).json({ error: 'Missing webhook timestamp' });
      }

      // Validate timestamp to prevent replay attacks
      if (validateTimestamp) {
        const now = Math.floor(Date.now() / 1000);
        const reqTime = parseInt(timestamp, 10);

        if (isNaN(reqTime)) {
          return res.status(401).json({ error: 'Invalid timestamp format' });
        }

        const age = Math.abs(now - reqTime);
        if (age > maxTimestampAge) {
          return res.status(401).json({ 
            error: 'Timestamp too old or from future',
            age,
            maxAge: maxTimestampAge 
          });
        }
      }

      // Compute expected signature
      const body = JSON.stringify(req.body);
      const payload = validateTimestamp ? `${timestamp}.${body}` : body;
      const expectedSignature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Compare signatures (constant-time comparison to prevent timing attacks)
      if (!constantTimeCompare(signature, expectedSignature)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      // Authentication successful
      next();
    } catch (error) {
      logger.error('Auth middleware error', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
