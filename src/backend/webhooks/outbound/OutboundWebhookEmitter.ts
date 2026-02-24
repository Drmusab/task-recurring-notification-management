// @ts-nocheck
import axios from 'axios';
import { randomBytes } from 'crypto';
import { EventSubscriptionManager } from "@backend/events/EventSubscriptionManager";
import { EventQueue } from "@backend/events/EventQueue";
import { RetryManager } from "@backend/webhooks/outbound/RetryManager";
import { SignatureGenerator } from "@backend/webhooks/outbound/SignatureGenerator";
import { CircuitBreaker } from "@backend/webhooks/outbound/CircuitBreaker";
import { WebhookEvent, EventDeliveryRecord } from "@backend/events/types/EventTypes";
import { WebhookSubscription } from "@backend/events/types/SubscriptionTypes";
import * as logger from "@backend/logging/logger";

// TODO: Move to proper config location
interface EventConfig {
  enabled: boolean;
  retry: {
    maxAttempts: number;
    delayMs: number;
  };
  delivery: {
    batchSize: number;
    maxConcurrent: number;
    timeoutMs: number;
  };
  signature: {
    headerName: string;
  };
  queue: {
    retentionDays: number;
  };
}

/**
 * Outbound webhook emitter
 * 
 * FIX [HIGH-007]: Added CircuitBreaker to prevent resource exhaustion
 */
export class OutboundWebhookEmitter {
  private retryManager: RetryManager;
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(
    private config: EventConfig,
    private subscriptionManager: EventSubscriptionManager,
    private queue: EventQueue
  ) {
    this.retryManager = new RetryManager(config.retry);
  }

  /**
   * Start event processor
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Outbound webhooks disabled');
      return;
    }

    // Process queue every second
    this.processingInterval = setInterval(() => {
      this.processQueue().catch((error: unknown) => {
        logger.error('Error processing event queue:', error);
      });
    }, 1000);

    // Cleanup old events daily — store interval ID for proper cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch((error: unknown) => {
        logger.error('Error cleaning up events:', error);
      });
    }, 24 * 60 * 60 * 1000);

    logger.info('Outbound webhook emitter started');
  }

  /**
   * Stop event processor
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    logger.info('Outbound webhook emitter stopped');
  }

  /**
   * Emit event (fire-and-forget)
   */
  async emit(event: WebhookEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Find matching subscriptions
    const payload = event.payload as Record<string, unknown>;
    const subscriptions = this.subscriptionManager.getSubscriptionsForEvent(
      event.workspaceId,
      event.event,
      {
        tags: payload.tags as string[] | undefined,
        priority: payload.priority as string | undefined,
      }
    );

    if (subscriptions.length === 0) {
      return; // No subscribers
    }

    // Enqueue for each subscription
    for (const subscription of subscriptions) {
      const record: EventDeliveryRecord = {
        eventId: event.eventId,
        subscriptionId: subscription.id,
        url: subscription.url,
        event,
        attempts: 0,
        lastAttemptAt: null,
        nextRetryAt: null,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await this.queue.enqueue(record);
    }
  }

  /**
   * Process event queue
   */
  private async processQueue(): Promise<void> {
    const pending = this.queue.getPending(this.config.delivery.batchSize);

    if (pending.length === 0) {
      return;
    }

    // Process with concurrency limit
    const chunks = this.createChunks(pending, this.config.delivery.maxConcurrent);

    for (const chunk of chunks) {
      await Promise.all(chunk.map((record) => this.deliverEvent(record)));
    }
  }

  /**
   * Deliver single event
   * 
   * FIX [HIGH-007]: Wrapped sendWebhook with circuit breaker protection
   */
  private async deliverEvent(record: EventDeliveryRecord): Promise<void> {
    const subscription = this.subscriptionManager.get(record.subscriptionId);

    if (!subscription) {
      // Subscription deleted, remove from queue
      await this.queue.remove(record.eventId);
      return;
    }

    if (!subscription.active) {
      // Subscription deactivated, abandon
      await this.queue.update(record.eventId, {
        status: 'abandoned',
        lastError: 'Subscription deactivated',
      });
      return;
    }

    record.attempts++;

    try {
      // ✅ FIX: Get or create circuit breaker for this subscription URL
      const circuitBreaker = this.getCircuitBreaker(subscription.url);
      
      // ✅ FIX: Execute webhook with circuit breaker protection
      await circuitBreaker.execute(async () => {
        await this.sendWebhook(subscription, record.event);
      });

      // Success
      await this.queue.update(record.eventId, {
        status: 'delivered',
        attempts: record.attempts,
        lastAttemptAt: new Date().toISOString(),
      });

      await this.subscriptionManager.updateStats(subscription.id, true);
    } catch (error: unknown) {
      // Failure (from circuit breaker or actual HTTP error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isCircuitOpen = errorMessage.includes('Circuit breaker');
      
      if (isCircuitOpen) {
        // Circuit breaker is open - don't count as retry attempt
        logger.warn('Circuit breaker prevented webhook delivery', {
          subscriptionId: subscription.id,
          url: subscription.url,
          eventId: record.eventId,
          error: errorMessage
        });
        
        // Keep event in pending state for later retry (when circuit closes)
        await this.queue.update(record.eventId, {
          status: 'pending',
          attempts: record.attempts - 1, // Don't count circuit breaker rejection as attempt
          lastAttemptAt: new Date().toISOString(),
          nextRetryAt: new Date(Date.now() + 60000).toISOString(), // Retry in 1 minute
          lastError: errorMessage,
        });
        return;
      }
      
      // Regular HTTP error - apply retry logic
      const shouldRetry = this.retryManager.shouldRetry(record.attempts);

      if (shouldRetry) {
        const nextRetry = this.retryManager.calculateNextRetry(record.attempts);

        await this.queue.update(record.eventId, {
          status: 'pending',
          attempts: record.attempts,
          lastAttemptAt: new Date().toISOString(),
          nextRetryAt: nextRetry.toISOString(),
          lastError: errorMessage,
        });
      } else {
        // Abandon after max attempts
        await this.queue.update(record.eventId, {
          status: 'abandoned',
          attempts: record.attempts,
          lastAttemptAt: new Date().toISOString(),
          lastError: errorMessage,
        });
      }

      await this.subscriptionManager.updateStats(subscription.id, false);
    }
  }

  /**
   * Send webhook HTTP request
   */
  private async sendWebhook(
    subscription: WebhookSubscription,
    event: WebhookEvent
  ): Promise<void> {
    // Generate signature
    const signature = SignatureGenerator.generate(event, subscription.secret);

    // Send POST request
    await axios.post(subscription.url, event, {
      timeout: this.config.delivery.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        [this.config.signature.headerName]: signature,
        'X-Event-Type': event.event,
        'X-Event-ID': event.eventId,
        'X-Workspace-ID': event.workspaceId,
      },
      validateStatus: (status) => status >= 200 && status < 300, // Only 2xx is success
    });
  }

  /**
   * Cleanup old events
   */
  private async cleanup(): Promise<void> {
    const removed = await this.queue.cleanup(this.config.queue.retentionDays);
    if (removed > 0) {
      logger.info(`Cleaned up ${removed} old events`);
    }
  }

  /**
   * Get or create circuit breaker for URL
   * 
   * FIX [HIGH-007]: Circuit breaker management per endpoint
   */
  private getCircuitBreaker(url: string): CircuitBreaker {
    if (!this.circuitBreakers.has(url)) {
      const circuitBreaker = new CircuitBreaker({
        threshold: 5,        // Open after 5 consecutive failures
        timeout: 60000,      // Try again after 1 minute
        name: `webhook:${url}`
      });
      this.circuitBreakers.set(url, circuitBreaker);
      logger.info(`Created circuit breaker for webhook URL: ${url}`);
    }
    return this.circuitBreakers.get(url)!;
  }

  /**
   * Create chunks for concurrency control
   */
  private createChunks<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Generate event ID
   */
  static generateEventId(): string {
    return `evt_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }
}
