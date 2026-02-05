import { EventType } from "@backend/events/types/EventTypes";

/**
 * Webhook subscription
 */
export interface WebhookSubscription {
  /** Unique subscription ID */
  id: string;

  /** Workspace this subscription belongs to */
  workspaceId: string;

  /** Target webhook URL */
  url: string;

  /** Events to subscribe to (or ['*'] for all) */
  events: EventType[] | ['*'];

  /** Shared secret for HMAC signing */
  secret: string;

  /** Whether subscription is active */
  active: boolean;

  /** Optional description */
  description?: string;

  /** Optional filters */
  filters?: {
    tags?: string[]; // Only send events for tasks with these tags
    priority?: ('low' | 'medium' | 'high')[]; // Only send for these priorities
  };

  /** Retry configuration */
  retryConfig?: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };

  /** Metadata */
  createdAt: string;
  updatedAt: string;
  lastDeliveryAt: string | null;
  deliveryStats: {
    totalSent: number;
    totalSucceeded: number;
    totalFailed: number;
  };
}

/**
 * Subscription creation data
 */
export interface CreateSubscriptionData {
  url: string;
  events: EventType[] | ['*'];
  description?: string;
  filters?: {
    tags?: string[];
    priority?: ('low' | 'medium' | 'high')[];
  };
}

/**
 * Subscription update data
 */
export interface UpdateSubscriptionData {
  subscriptionId: string;
  url?: string;
  events?: EventType[] | ['*'];
  active?: boolean;
  description?: string;
  filters?: {
    tags?: string[];
    priority?: ('low' | 'medium' | 'high')[];
  };
}
