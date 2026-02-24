/**
 * Standard API Response Formats
 * 
 * Implements consistent error and success responses across all API endpoints.
 * Section 3 requirement from Backend Stabilization Protocol.
 */

export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;              // e.g., "SCHEDULER_001"
    message: string;           // Human-readable
    details?: Record<string, unknown>;  // Context-specific info
    requestId?: string;        // Trace ID
    timestamp: string;         // ISO-8601
  };
}

export interface StandardSuccessResponse<T = unknown> {
  success: true;
  data: T;
  requestId?: string;
  timestamp: string;
}

export type ApiResponse<T = unknown> = StandardSuccessResponse<T> | StandardErrorResponse;

/**
 * Response Formatter - Centralized response creation
 */
export class ResponseFormatter {
  static success<T>(data: T, requestId?: string): StandardSuccessResponse<T> {
    return {
      success: true,
      data,
      requestId,
      timestamp: new Date().toISOString()
    };
  }

  static error(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    requestId?: string
  ): StandardErrorResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        requestId,
        timestamp: new Date().toISOString()
      }
    };
  }
}
