/**
 * ErrorLogger - Wrapper around shared logger for webhook server
 * Provides async logError method for compatibility with WebhookServer
 */
import * as logger from "@shared/utils/misc/logger";

export class ErrorLogger {
  async logError(error: Error | string, context?: Record<string, unknown>): Promise<void> {
    logger.error(error instanceof Error ? error.message : error, context);
  }

  log(error: Error | string, context?: unknown): void {
    logger.error(error instanceof Error ? error.message : error, context);
  }

  warn(message: string, context?: unknown): void {
    logger.warn(message, context);
  }

  info(message: string, context?: unknown): void {
    logger.info(message, context);
  }
}
