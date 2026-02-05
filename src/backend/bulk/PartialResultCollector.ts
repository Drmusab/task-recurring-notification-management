import {
  BulkOperationResult,
  BulkOperationSuccess,
  BulkOperationFailure,
} from "@backend/commands/types/BulkCommandTypes";

/**
 * Collects partial results during bulk operations
 */
export class PartialResultCollector {
  private successes: BulkOperationSuccess[] = [];
  private failures: BulkOperationFailure[] = [];
  private total: number = 0;

  constructor(totalCount: number) {
    this.total = totalCount;
  }

  /**
   * Record success
   */
  recordSuccess(taskId: string, result: any): void {
    this.successes.push({ taskId, result });
  }

  /**
   * Record failure
   */
  recordFailure(taskId: string, error: { code: string; message: string; details?: any }): void {
    this.failures.push({ taskId, error });
  }

  /**
   * Get current result
   */
  getResult(): BulkOperationResult {
    return {
      total: this.total,
      successful: this.successes.length,
      failed: this.failures.length,
      successes: this.successes,
      failures: this.failures,
      completedFully: this.failures.length === 0,
    };
  }

  /**
   * Check if should continue (for early termination)
   */
  shouldContinue(continueOnError: boolean): boolean {
    if (continueOnError) {
      return true;
    }
    return this.failures.length === 0;
  }

  /**
   * Get progress percentage
   */
  getProgress(): number {
    const processed = this.successes.length + this.failures.length;
    return Math.floor((processed / this.total) * 100);
  }
}
