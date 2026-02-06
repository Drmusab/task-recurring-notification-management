import { Request, Response } from 'express';
import { WebhookRequest } from "@backend/webhooks/types/Request";
import { WebhookError } from "@backend/webhooks/types/Error";

export type CommandHandler = (
  command: string,
  data: Record<string, unknown>,
  context: Record<string, unknown>
) => Promise<unknown>;

/**
 * Command router
 */
export class Router {
  private handlers: Map<string, CommandHandler> = new Map();

  /**
   * Register command handler
   */
  register(commandPattern: string, handler: CommandHandler): void {
    this.handlers.set(commandPattern, handler);
  }

  /**
   * Route request to appropriate handler
   */
  async route(req: Request, res: Response): Promise<void> {
    const request = req.body as WebhookRequest;
    const context = (req as any).context;

    // Find handler
    const handler = this.findHandler(request.command);
    if (!handler) {
      throw new WebhookError(
        'NOT_FOUND',
        `Unknown command: ${request.command}`,
        { command: request.command }
      );
    }

    // Execute handler
    const result = await handler(request.command, request.data, context);

    // Send response
    res.json({
      success: true,
      data: result,
      meta: {
        requestId: request.meta.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Find handler for command
   */
  private findHandler(command: string): CommandHandler | null {
    // Exact match
    if (this.handlers.has(command)) {
      return this.handlers.get(command)!;
    }

    // Pattern match (e.g., "v1/tasks/*")
    for (const [pattern, handler] of this.handlers.entries()) {
      if (this.matchesPattern(command, pattern)) {
        return handler;
      }
    }

    return null;
  }

  /**
   * Check if command matches pattern
   */
  private matchesPattern(command: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    return regex.test(command);
  }
}
