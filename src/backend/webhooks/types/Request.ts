/**
 * Standard request envelope for all webhook commands
 */
export interface WebhookRequest {
  /** Command in format: v1/category/action */
  command: string;

  /** Command-specific data payload */
  data: Record<string, any>;

  /** Request metadata */
  meta: RequestMeta;
}

export interface RequestMeta {
  /** Unique request identifier (UUID recommended) */
  requestId: string;

  /** ISO-8601 timestamp */
  timestamp: string;

  /** Source system identifier */
  source: string;

  /** Optional idempotency key for non-idempotent operations */
  idempotencyKey?: string;
}

/**
 * Internal request context (enriched after middleware)
 */
export interface RequestContext {
  /** Original request */
  request: WebhookRequest;

  /** Authenticated workspace ID */
  workspaceId: string;

  /** API key used for authentication */
  apiKey: string;

  /** Client IP address */
  clientIp: string;

  /** User agent string */
  userAgent: string;

  /** Whether request was proxied via HTTPS */
  isHttps: boolean;

  /** Timestamp when request was received */
  receivedAt: Date;
}
