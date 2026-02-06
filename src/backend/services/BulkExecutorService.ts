import { BatchConfig } from "@backend/services/batch-config";
import { PartialResultCollector } from "@backend/services/PartialResultCollectorService";

/**
 * Safe bulk operation executor with batching
 */
export class BulkExecutor {
  constructor(private config: BatchConfig) {}

  /**
   * Execute bulk operation with batching
   */
  async execute<T>(
    items: string[],
    operation: (item: string) => Promise<T>,
    collector: PartialResultCollector
  ): Promise<void> {
    // Split into batches
    const batches = this.createBatches(items, this.config.maxBatchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // Execute batch with concurrency limit
      await this.executeBatch(batch, operation, collector);

      // Delay between batches (except last)
      if (i < batches.length - 1) {
        await this.delay(this.config.batchDelay);
      }

      // Check if should continue
      if (!collector.shouldContinue(this.config.continueOnError)) {
        break; // Early termination on error
      }
    }
  }

  /**
   * Execute single batch with concurrency control
   */
  private async executeBatch<T>(
    batch: string[],
    operation: (item: string) => Promise<T>,
    collector: PartialResultCollector
  ): Promise<void> {
    // Split batch into concurrent chunks
    const chunks = this.createBatches(batch, this.config.maxConcurrent);

    for (const chunk of chunks) {
      // Execute chunk concurrently
      const promises = chunk.map((item) => this.executeWithTimeout(item, operation, collector));

      await Promise.all(promises);
    }
  }

  /**
   * Execute single operation with timeout
   */
  private async executeWithTimeout<T>(
    item: string,
    operation: (item: string) => Promise<T>,
    collector: PartialResultCollector
  ): Promise<void> {
    try {
      const result = await this.withTimeout(
        operation(item),
        this.config.operationTimeout
      );

      collector.recordSuccess(item, result);
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      collector.recordFailure(item, {
        code: (err?.code as string) || 'INTERNAL_ERROR',
        message: (err?.message as string) || 'Operation failed',
        details: err?.details,
      });
    }
  }

  /**
   * Wrap promise with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timerId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<T>((_, reject) => {
      timerId = setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
