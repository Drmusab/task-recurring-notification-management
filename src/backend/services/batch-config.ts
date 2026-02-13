/**
 * Batch execution configuration
 */
export interface BatchConfig {
  /** Maximum batch size */
  maxBatchSize: number;

  /** Delay between batches (ms) */
  batchDelay: number;

  /** Maximum concurrent operations per batch */
  maxConcurrent: number;

  /** Timeout per operation (ms) */
  operationTimeout: number;

  /** Continue on error */
  continueOnError: boolean;
}

/**
 * Default batch configurations by operation type
 */
export const DEFAULT_BATCH_CONFIGS: Record<string, BatchConfig> = {
  complete: {
    maxBatchSize: 50,
    batchDelay: 100,
    maxConcurrent: 10,
    operationTimeout: 5000,
    continueOnError: true,
  },
  reschedule: {
    maxBatchSize: 100,
    batchDelay: 50,
    maxConcurrent: 20,
    operationTimeout: 3000,
    continueOnError: true,
  },
  delete: {
    maxBatchSize: 50,
    batchDelay: 100,
    maxConcurrent: 10,
    operationTimeout: 3000,
    continueOnError: true,
  },
};
