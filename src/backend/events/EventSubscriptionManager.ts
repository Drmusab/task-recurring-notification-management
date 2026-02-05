import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';
import {
  WebhookSubscription,
  CreateSubscriptionData,
  UpdateSubscriptionData,
} from "@backend/events/types/SubscriptionTypes";
import { WebhookError } from "@backend/webhooks/types/Error";
import * as logger from "@backend/logging/logger";

/**
 * Manages webhook subscriptions
 */
export class EventSubscriptionManager {
  private subscriptions: Map<string, WebhookSubscription> = new Map();
  private storagePath: string;

  constructor(dataDir: string) {
    this.storagePath = path.join(dataDir, 'webhook-subscriptions.json');
  }

  /**
   * Initialize from storage
   */
  async init(): Promise<void> {
    try {
      const data = await fs.readFile(this.storagePath, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        parsed.forEach((sub) => {
          if (sub && typeof sub.id === 'string') {
            this.subscriptions.set(sub.id, sub);
          }
        });
      } else {
        logger.warn('Webhook subscription storage corrupted; resetting cache', {
          storagePath: this.storagePath,
        });
        this.subscriptions = new Map();
      }
      logger.info(`Loaded ${this.subscriptions.size} webhook subscriptions`);
    } catch (error) {
      // No subscriptions yet
      const err = error as NodeJS.ErrnoException;
      if (err?.code !== 'ENOENT') {
        logger.warn('Failed to load webhook subscriptions; starting fresh', {
          storagePath: this.storagePath,
          error,
        });
      }
      this.subscriptions = new Map();
    }
  }

  /**
   * Create subscription
   */
  async create(
    workspaceId: string,
    data: CreateSubscriptionData
  ): Promise<WebhookSubscription> {
    // Validate URL
    this.validateURL(data.url);

    // Validate events
    this.validateEvents(data.events);

    // Generate subscription
    const subscription: WebhookSubscription = {
      id: this.generateId(),
      workspaceId,
      url: data.url,
      events: data.events,
      secret: this.generateSecret(),
      active: true,
      description: data.description,
      filters: data.filters,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastDeliveryAt: null,
      deliveryStats: {
        totalSent: 0,
        totalSucceeded: 0,
        totalFailed: 0,
      },
    };

    this.subscriptions.set(subscription.id, subscription);
    await this.persist();

    return subscription;
  }

  /**
   * Update subscription
   */
  async update(
    workspaceId: string,
    data: UpdateSubscriptionData
  ): Promise<WebhookSubscription> {
    const subscription = this.subscriptions.get(data.subscriptionId);

    if (!subscription) {
      throw new WebhookError('NOT_FOUND', 'Subscription not found');
    }

    if (subscription.workspaceId !== workspaceId) {
      throw new WebhookError('FORBIDDEN', 'Cannot update subscription from different workspace');
    }

    // Validate updates
    if (data.url) {
      this.validateURL(data.url);
    }

    if (data.events) {
      this.validateEvents(data.events);
    }

    // Apply updates
    const updated: WebhookSubscription = {
      ...subscription,
      url: data.url ?? subscription.url,
      events: data.events ?? subscription.events,
      active: data.active ?? subscription.active,
      description: data.description ?? subscription.description,
      filters: data.filters ?? subscription.filters,
      updatedAt: new Date().toISOString(),
    };

    this.subscriptions.set(updated.id, updated);
    await this.persist();

    return updated;
  }

  /**
   * Delete subscription
   */
  async delete(workspaceId: string, subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      throw new WebhookError('NOT_FOUND', 'Subscription not found');
    }

    if (subscription.workspaceId !== workspaceId) {
      throw new WebhookError('FORBIDDEN', 'Cannot delete subscription from different workspace');
    }

    this.subscriptions.delete(subscriptionId);
    await this.persist();
  }

  /**
   * Get subscription
   */
  get(subscriptionId: string): WebhookSubscription | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * List subscriptions for workspace
   */
  list(workspaceId: string): WebhookSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      (sub) => sub.workspaceId === workspaceId
    );
  }

  /**
   * Get active subscriptions for event
   */
  getSubscriptionsForEvent(
    workspaceId: string,
    eventType: string,
    taskData?: { tags?: string[]; priority?: string }
  ): WebhookSubscription[] {
    return Array.from(this.subscriptions.values()).filter((sub) => {
      // Check workspace
      if (sub.workspaceId !== workspaceId) return false;

      // Check active
      if (!sub.active) return false;

      // Check event type
      if (!sub.events.includes('*' as any) && !sub.events.includes(eventType as any)) {
        return false;
      }

      // Check filters
      if (sub.filters && taskData) {
        // Tag filter
        if (sub.filters.tags && sub.filters.tags.length > 0) {
          if (!taskData.tags || !sub.filters.tags.some((tag) => taskData.tags!.includes(tag))) {
            return false;
          }
        }

        // Priority filter
        if (sub.filters.priority && sub.filters.priority.length > 0) {
          if (!taskData.priority || !sub.filters.priority.includes(taskData.priority as any)) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Update delivery stats
   */
  async updateStats(
    subscriptionId: string,
    success: boolean
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.deliveryStats.totalSent++;
      if (success) {
        subscription.deliveryStats.totalSucceeded++;
      } else {
        subscription.deliveryStats.totalFailed++;
      }
      subscription.lastDeliveryAt = new Date().toISOString();
      await this.persist();
    }
  }

  /**
   * Validate URL
   */
  private validateURL(url: string): void {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      throw new WebhookError('VALIDATION_ERROR', 'Invalid webhook URL', { url });
    }
  }

  /**
   * Validate events
   */
  private validateEvents(events: any[]): void {
    if (!Array.isArray(events) || events.length === 0) {
      throw new WebhookError('VALIDATION_ERROR', 'Events must be a non-empty array');
    }

    const validEvents = [
      '*',
      'task.created',
      'task.updated',
      'task.completed',
      'task.deleted',
      'task.due',
      'task.overdue',
      'recurrence.paused',
      'recurrence.resumed',
      'recurrence.regenerated',
      'recurrence.skipped',
      'notification.sent',
    ];

    for (const event of events) {
      if (!validEvents.includes(event)) {
        throw new WebhookError('VALIDATION_ERROR', `Invalid event type: ${event}`, {
          validEvents,
        });
      }
    }
  }

  /**
   * Generate subscription ID
   */
  private generateId(): string {
    return `sub_${randomBytes(12).toString('hex')}`;
  }

  /**
   * Generate webhook secret
   */
  private generateSecret(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Persist to disk
   */
  private async persist(): Promise<void> {
    const subscriptions = Array.from(this.subscriptions.values());
    try {
      await fs.writeFile(this.storagePath, JSON.stringify(subscriptions, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to persist webhook subscriptions', {
        storagePath: this.storagePath,
        error,
      });
    }
  }
}
