/**
 * Standard success response envelope
 */
export interface WebhookResponse<T = any> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

/**
 * Standard error response envelope
 */
export interface WebhookErrorResponse {
  success: false;
  error: ErrorDetails;
  meta: ResponseMeta;
}

export interface ResponseMeta {
  /** Echo of request ID */
  requestId: string;

  /** ISO-8601 timestamp of response */
  timestamp: string;

  /** Idempotency information (if applicable) */
  idempotencyKey?: string;
  firstSeen?: boolean;
  originalTimestamp?: string;
}

export interface ErrorDetails {
  /** Machine-readable error code */
  code: ErrorCode;

  /** Human-readable error message */
  message: string;

  /** Additional error context */
  details?: Record<string, any>;
}

/**
 * Standard error codes
 */
export type ErrorCode =
  // Client errors (4xx)
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  // Server errors (5xx)
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'STORAGE_ERROR'
  // Business logic errors (4xx)
  | 'TASK_ALREADY_COMPLETED'
  | 'TASK_ALREADY_PAUSED'
  | 'INVALID_RECURRENCE_PATTERN'
  | 'INVALID_STATE_TRANSITION'
  | 'HIGH_FREQUENCY_WARNING'
  | 'UNBOUNDED_GENERATION_REQUEST'
  | 'RECURRENCE_NO_PROGRESS'
  | 'RECURRENCE_ITERATION_LIMIT_EXCEEDED'
  | 'HIGH_FREQUENCY_EXPLOSION';

/**
 * Map error codes to HTTP status codes
 */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  STORAGE_ERROR: 500,
  TASK_ALREADY_COMPLETED: 409,
  TASK_ALREADY_PAUSED: 409,
  INVALID_RECURRENCE_PATTERN: 422,
  INVALID_STATE_TRANSITION: 409,
  HIGH_FREQUENCY_WARNING: 422,
  UNBOUNDED_GENERATION_REQUEST: 400,
  RECURRENCE_NO_PROGRESS: 422,
  RECURRENCE_ITERATION_LIMIT_EXCEEDED: 422,
  HIGH_FREQUENCY_EXPLOSION: 422,
};
