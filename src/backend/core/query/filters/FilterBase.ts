import type { Task } from '@backend/core/models/Task';

/**
 * Base class for all filters
 */
export abstract class Filter {
  abstract matches(task: Task): boolean;
}
