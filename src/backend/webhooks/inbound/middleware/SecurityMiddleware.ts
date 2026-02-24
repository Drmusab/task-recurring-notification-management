/**
 * Security Middleware - HTTPS, timeout, content-type validation
 * 
 * FIX [CRITICAL-008]: Complete implementation from stub
 * Prevents DoS attacks, man-in-the-middle attacks, injection attacks
 */

import { Request, Response, NextFunction } from 'express';
import type { SecurityConfig } from '@shared/config/WebhookConfig';
import * as logger from '@backend/logging/logger';

export class SecurityMiddleware {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  /**
   * Main security middleware (combines all checks)
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // 1. Validate HTTPS in production
        if (this.config.requireHttps && !this.isHttps(req)) {
          logger.warn('SecurityMiddleware: Non-HTTPS request rejected', {
            ip: req.ip,
            path: req.path
          });
          return res.status(403).json({
            success: false,
            error: {
              code: 'HTTPS_REQUIRED',
              message: 'HTTPS is required for webhook endpoints',
              timestamp: new Date().toISOString()
            }
          });
        }

        // 2. Validate content type for POST/PUT/PATCH
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && !this.isValidContentType(req)) {
          logger.warn('SecurityMiddleware: Invalid content type', {
            method: req.method,
            contentType: req.get('content-type'),
            path: req.path
          });
          return res.status(415).json({
            success: false,
            error: {
              code: 'INVALID_CONTENT_TYPE',
              message: 'Content-Type must be application/json',
              timestamp: new Date().toISOString()
            }
          });
        }

        // 3. Add security headers
        this.addSecurityHeaders(res);

        next();
      } catch (error) {
        logger.error('SecurityMiddleware error', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'SECURITY_ERROR',
            message: 'Security validation failed',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Request timeout handler
   * Prevents DoS attacks via slow requests
   */
  timeoutHandler() {
    return (req: Request, res: Response, next: NextFunction) => {
      const timeout = this.config.requestTimeout || 30000;
      
      const timer = setTimeout(() => {
        if (!res.headersSent) {
          logger.warn('SecurityMiddleware: Request timeout', {
            path: req.path,
            method: req.method,
            timeout,
            ip: req.ip
          });
          res.status(408).json({
            success: false,
            error: {
              code: 'REQUEST_TIMEOUT',
              message: `Request exceeded ${timeout}ms timeout`,
              timestamp: new Date().toISOString()
            }
          });
        }
      }, timeout);

      // Clear timeout when response finishes
      res.on('finish', () => clearTimeout(timer));
      res.on('close', () => clearTimeout(timer));

      next();
    };
  }

  /**
   * HTTPS validator (standalone)
   */
  httpsValidator() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (this.config.requireHttps && !this.isHttps(req)) {
        logger.warn('SecurityMiddleware: HTTPS validation failed', {
          protocol: req.protocol,
          path: req.path
        });
        return res.status(403).json({
          success: false,
          error: {
            code: 'HTTPS_REQUIRED',
            message: 'HTTPS required for this endpoint',
            timestamp: new Date().toISOString()
          }
        });
      }
      next();
    };
  }

  private isHttps(req: Request): boolean {
    return req.protocol === 'https' || 
           req.get('x-forwarded-proto') === 'https';
  }

  private isValidContentType(req: Request): boolean {
    const contentType = req.get('content-type') || '';
    return contentType.toLowerCase().includes('application/json');
  }

  private addSecurityHeaders(res: Response): void {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Enforce HTTPS (only if HTTPS is required)
    if (this.config.requireHttps) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'self'");
  }
}
