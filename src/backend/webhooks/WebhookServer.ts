import express, { Express, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import { WebhookConfig } from "@shared/config/WebhookConfig";
import { PortDetector } from "@backend/webhooks/utils/PortDetector";
import { Validator } from "@backend/webhooks/utils/Validator";
import { Router } from "@backend/webhooks/Router";
import { AuthMiddleware } from "@backend/webhooks/middleware/AuthMiddleware";
import { RateLimitMiddleware } from "@backend/webhooks/middleware/RateLimitMiddleware";
import { IdempotencyMiddleware } from "@backend/webhooks/middleware/IdempotencyMiddleware";
import { SecurityMiddleware } from "@backend/webhooks/middleware/SecurityMiddleware";
import { ApiKeyManager } from "@backend/auth/ApiKeyManager";
import { ErrorLogger } from "@backend/logging/ErrorLogger";
import { CommandRegistry } from "@backend/commands/CommandRegistry";
import { ITaskManager } from "@backend/commands/handlers/TaskCommandHandler";
import { IStorageService } from "@backend/commands/handlers/QueryCommandHandler";
import { WebhookError } from "@backend/webhooks/types/Error";
import { ERROR_HTTP_STATUS } from "@backend/webhooks/types/Response";

/**
 * Main webhook server
 */
export class WebhookServer {
  private app: Express;
  private server: http.Server | null = null;
  private port: number | null = null;
  private router: Router;
  private errorLogger: ErrorLogger;
  private commandRegistry: CommandRegistry;

  constructor(
    private config: WebhookConfig,
    private apiKeyManager: ApiKeyManager,
    errorLogger: ErrorLogger,
    taskManager: ITaskManager,
    storage: IStorageService
  ) {
    this.app = express();
    this.router = new Router();
    this.errorLogger = errorLogger;

    // Register commands
    this.commandRegistry = new CommandRegistry(
      this.router,
      taskManager,
      storage,
      config.recurrenceLimits
    );

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandler();
  }

  /**
   * Setup middleware stack
   */
  private setupMiddleware(): void {
    // Body parser
    this.app.use(express.json({ limit: this.config.security.maxBodySize }));

    // Security middleware
    const securityMiddleware = new SecurityMiddleware(this.config.security);
    this.app.use(securityMiddleware.timeoutHandler());

    // Auth middleware (only for webhook endpoints)
    const authMiddleware = new AuthMiddleware(
      this.apiKeyManager,
      this.config.security.maxFailedAuthAttempts,
      this.config.security.authBlockDuration
    );

    // Apply auth only to webhook routes (not health check)
    this.app.use('/webhook', authMiddleware.middleware());

    // HTTPS validation
    this.app.use('/webhook', securityMiddleware.httpsValidator());

    // Rate limiting
    const rateLimitMiddleware = new RateLimitMiddleware(this.config.rateLimits);
    this.app.use('/webhook', rateLimitMiddleware.middleware());

    // Idempotency
    const idempotencyMiddleware = new IdempotencyMiddleware(this.config.idempotency);
    this.app.use('/webhook', idempotencyMiddleware.middleware());
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: 'v1',
      });
    });

    // Main webhook endpoint
    this.app.post('/webhook/v1', async (req, res, next) => {
      try {
        // Validate request envelope
        const validatedRequest = Validator.validateRequest(req.body);
        req.body = validatedRequest;

        // Validate timestamp freshness
        Validator.validateTimestampFreshness(validatedRequest.meta.timestamp);

        // Route to handler
        await this.router.route(req, res);
      } catch (error) {
        next(error);
      }
    });
  }

  /**
   * Setup error handler
   */
  private setupErrorHandler(): void {
    this.app.use(async (err: any, req: Request, res: Response, next: NextFunction) => {
      const context = (req as any).context;
      const requestBody = req.body;

      // Log error
      if (context && requestBody) {
        await this.errorLogger.logError(
          context.workspaceId,
          requestBody.command || 'unknown',
          requestBody.meta?.source || 'unknown',
          requestBody.meta?.requestId || 'unknown',
          err instanceof WebhookError ? err.code : 'INTERNAL_ERROR',
          err.message,
          requestBody.data,
          {
            stackTrace: err.stack,
            userAgent: context.userAgent,
            ipAddress: context.clientIp,
          }
        );
      }

      // Send error response
      if (err instanceof WebhookError) {
        const statusCode = ERROR_HTTP_STATUS[err.code] || 500;
        res.status(statusCode).json({
          success: false,
          error: err.toResponse(),
          meta: {
            requestId: requestBody?.meta?.requestId || 'unknown',
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        // Unhandled error
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
          meta: {
            requestId: requestBody?.meta?.requestId || 'unknown',
            timestamp: new Date().toISOString(),
          },
        });
      }
    });
  }

  /**
   * Start server
   */
  async start(): Promise<{ port: number; url: string }> {
    // Determine port
    if (this.config.server.port === 'auto') {
      this.port = await PortDetector.findAvailablePort(
        this.config.server.autoPortRange[0],
        this.config.server.autoPortRange[1],
        this.config.server.host
      );
    } else {
      if (!PortDetector.validatePort(this.config.server.port)) {
        throw new Error(`Invalid port: ${this.config.server.port}`);
      }
      this.port = this.config.server.port;
    }

    // Start server
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, this.config.server.host, () => {
        const protocol = this.config.server.enableHttp ? 'http' : 'https';
        const url = `${protocol}://${this.config.server.host}:${this.port}`;
        
        console.log(`✅ Webhook server started`);
        console.log(`   Port: ${this.port} (${this.config.server.port === 'auto' ? 'auto-selected' : 'manual'})`);
        console.log(`   Local URL: ${url}/webhook/v1`);
        console.log(`   Health: ${url}/health`);

        resolve({ port: this.port!, url });
      });

      this.server.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Stop server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server!.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✅ Webhook server stopped');
            resolve();
          }
        });
      });
    }
  }

  /**
   * Get server info
   */
  getInfo(): { port: number | null; isRunning: boolean } {
    return {
      port: this.port,
      isRunning: this.server !== null,
    };
  }
}
