import { CommandResult, ErrorInfo } from "@backend/commands/types/CommandTypes";
import { WebhookError } from "@backend/webhook/types/Error";
import { ErrorCode } from "@backend/webhook/types/Response";

/**
 * Abstract base command handler
 */
export abstract class BaseCommandHandler {
  /**
   * Wrap result in standard envelope
   */
  protected success<T>(result: T): CommandResult<T> {
    return {
      status: 'success',
      result,
      error: null,
    };
  }

  /**
   * Wrap error in standard envelope
   */
  protected error(code: ErrorCode, message: string, details?: any): CommandResult {
    return {
      status: 'error',
      result: null,
      error: {
        code,
        message,
        details,
      },
    };
  }

  /**
   * Convert WebhookError to CommandResult
   */
  protected fromWebhookError(error: WebhookError): CommandResult {
    return this.error(error.code, error.message, error.details);
  }

  /**
   * Validate required fields
   */
  protected validateRequired(
    data: any,
    fields: string[]
  ): { valid: boolean; missing?: string[] } {
    const missing = fields.filter((field) => {
      const value = this.getNestedValue(data, field);
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      return { valid: false, missing };
    }

    return { valid: true };
  }

  /**
   * Get nested object value by dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Validate ISO-8601 date
   */
  protected validateISO8601(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date.toISOString() === dateString;
  }

  /**
   * Validate enum value
   */
  protected validateEnum<T extends string>(
    value: T,
    allowedValues: T[]
  ): boolean {
    return allowedValues.includes(value);
  }
}
