import { Request, Response, NextFunction } from 'express';

/**
 * Rate Limit Middleware (stub)
 * TODO: Implement rate limiting logic
 */
export class RateLimitMiddleware {
  constructor(private config: any) {}

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Stub implementation - always allow
      next();
    };
  }
}
