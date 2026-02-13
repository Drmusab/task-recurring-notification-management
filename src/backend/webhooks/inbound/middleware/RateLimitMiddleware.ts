import type { Request, Response, NextFunction } from 'express';
import * as logger from "@backend/logging/logger";

export interface RateLimitConfig {
  /** Maximum requests per window. Default: 100 */
  maxRequests?: number;
  /** Window duration in milliseconds. Default: 60_000 (1 min) */
  windowMs?: number;
}

/**
 * Sliding-window rate limiter per client IP.
 */
export class RateLimitMiddleware {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  /** IP → list of request timestamps within the current window */
  private readonly clients: Map<string, number[]> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig = {}) {
    this.maxRequests = config.maxRequests ?? 100;
    this.windowMs = config.windowMs ?? 60_000;
  }

  middleware() {
    // Start periodic cleanup so the map doesn't grow unbounded
    if (!this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => this.cleanup(), this.windowMs * 2);
    }

    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const windowStart = now - this.windowMs;

      // Get or create entry
      let timestamps = this.clients.get(ip);
      if (!timestamps) {
        timestamps = [];
        this.clients.set(ip, timestamps);
      }

      // Remove expired entries (outside the window)
      const filtered = timestamps.filter(t => t > windowStart);
      this.clients.set(ip, filtered);

      if (filtered.length >= this.maxRequests) {
        logger.warn('Rate limit exceeded', { ip, requests: filtered.length, limit: this.maxRequests });
        const retryAfter = Math.ceil(this.windowMs / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Limit: ${this.maxRequests} per ${this.windowMs / 1000}s`,
            retryAfter,
          },
        });
      }

      filtered.push(now);
      next();
    };
  }

  /** Remove stale entries to prevent memory leaks */
  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [ip, timestamps] of this.clients.entries()) {
      const active = timestamps.filter(t => t > cutoff);
      if (active.length === 0) {
        this.clients.delete(ip);
      } else {
        this.clients.set(ip, active);
      }
    }
  }

  /** Stop the cleanup timer (for shutdown) */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clients.clear();
  }
}
