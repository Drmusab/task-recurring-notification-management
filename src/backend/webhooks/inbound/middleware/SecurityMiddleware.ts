import { Request, Response, NextFunction } from 'express';

/**
 * Security Middleware (stub)
 * TODO: Implement security headers and validation
 */
export class SecurityMiddleware {
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Stub implementation - always allow
      next();
    };
  }
}
