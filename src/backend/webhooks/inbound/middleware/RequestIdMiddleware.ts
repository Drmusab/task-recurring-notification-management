/**
 * Request ID Middleware - Trace Context for Request Tracking
 * 
 * FIX [HIGH-009]: Adds unique request ID to every request for tracing
 * 
 * Features:
 * - Accepts X-Request-ID header if provided by client
 * - Generates UUID if not provided
 * - Attaches requestId to Express Request object
 * - Returns X-Request-ID in response headers
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import * as logger from '@backend/logging/logger';

/**
 * Request ID Middleware
 * 
 * Ensures every request has a unique identifier for tracing across logs
 */
export class RequestIdMiddleware {
  /**
   * Create middleware function
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Extract or generate request ID
        const requestId = (req.headers['x-request-id'] as string) || randomUUID();
        
        // Attach to request object
        req.requestId = requestId;
        
        // Include in response headers for client reference
        res.setHeader('X-Request-ID', requestId);
        
        // Log request received with ID
        logger.info('Request received', {
          requestId,
          method: req.method,
          path: req.path,
          ip: req.ip
        });
        
        next();
      } catch (error) {
        // Don't let middleware errors block requests
        logger.error('RequestIdMiddleware error', error);
        next();
      }
    };
  }
}

/**
 * Extend Express Request type to include requestId
 */
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}
