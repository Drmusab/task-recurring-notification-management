import { Request, Response, NextFunction } from 'express';

/**
 * Idempotency Middleware (stub)
 * TODO: Implement idempotency key checking
 */
export class IdempotencyMiddleware {
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Stub implementation - always allow
      next();
    };
  }
}
