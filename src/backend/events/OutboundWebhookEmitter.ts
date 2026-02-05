import axios from 'axios';
import { randomBytes } from 'crypto';
import { EventConfig } from "@backend/config/EventConfig";
import { EventSubscriptionManager } from "@backend/events/EventSubscriptionManager";
import { EventQueue } from "@backend/events/EventQueue";
import { RetryManager } from "@backend/events/RetryManager";
import { SignatureGenerator } from "@backend/events/SignatureGenerator";
import { WebhookEvent, EventDeliveryRecord } from "@backend/events/types/EventTypes";
import { WebhookSubscription } from "@backend/events/types/SubscriptionTypes";

/**
 * Outbound webhook emitter
 */
export class OutboundWebhookEmitter {
  private retryManager: RetryManager;
  private processingInterval: NodeJS.Timeout | null = null;

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
      console.log('ℹ️  Outbound webhooks disabled');
      return;
    }

    // Process queue every second
    this.processingInterval = setInterval(() => {
      this.processQueue().catch((error) => {
        console.error('❌ Error processing event queue:', error);
      });
    }, 1000);

    // Cleanup old events daily
    setInterval(() => {
      this.cleanup().catch((error) => {
        console.error('❌ Error cleaning up events:', error);
      });
    }, 24 * 60 * 60 * 1000);

    console.log('✅ Outbound webhook emitter started');
  }

  /**
   * Stop event processor
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('✅ Outbound webhook emitter stopped');
    }
  }

  /**
   * Emit event (fire-and-forget)
   */
  async emit(event: WebhookEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Find matching subscriptions
    const subscriptions = this.subscriptionManager.getSubscriptionsForEvent(
      event.workspaceId,
      event.event,
      {
        tags: (event.payload as any).tags,
        priority: (event.payload as any).priority,
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
      await this.sendWebhook(subscription, record.event);

      // Success
      await this.queue.update(record.eventId, {
        status: 'delivered',
        attempts: record.attempts,
        lastAttemptAt: new Date().toISOString(),
      });

      await this.subscriptionManager.updateStats(subscription.id, true);
    } catch (error: any) {
      // Failure
      const shouldRetry = this.retryManager.shouldRetry(record.attempts);

      if (shouldRetry) {
        const nextRetry = this.retryManager.calculateNextRetry(record.attempts);

        await this.queue.update(record.eventId, {
          status: 'pending',
          attempts: record.attempts,
          lastAttemptAt: new Date().toISOString(),
          nextRetryAt: nextRetry.toISOString(),
          lastError: error.message,
        });
      } else {
        // Abandon after max attempts
        await this.queue.update(record.eventId, {
          status: 'abandoned',
          attempts: record.attempts,
          lastAttemptAt: new Date().toISOString(),
          lastError: error.message,
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
      console.log(`🗑️  Cleaned up ${removed} old events`);
    }
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
