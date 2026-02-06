// @ts-nocheck
import { BaseCommandHandler } from "@backend/commands/handlers/BaseCommandHandler";
import { CommandResult, ListTasksData, TaskListResult, Task } from "@backend/commands/types/CommandTypes";
import { WebhookError } from "@backend/webhook/types/Error";

/**
 * Storage service interface (existing service)
 */
export interface IStorageService {
  queryTasks(workspaceId: string, filters: any): Promise<Task[]>;
  countTasks(workspaceId: string, filters: any): Promise<number>;
}

/**
 * Query command handler
 */
export class QueryCommandHandler extends BaseCommandHandler {
  constructor(private storage: IStorageService) {
    super();
  }

  /**
   * Handle: v1/query/list
   */
  async handleList(data: ListTasksData, context: any): Promise<CommandResult> {
    try {
      // Validate pagination
      const limit = data.pagination?.limit ?? 20;
      const offset = data.pagination?.offset ?? 0;

      if (limit < 1 || limit > 100) {
        throw new WebhookError('VALIDATION_ERROR', 'Limit must be between 1 and 100', {
          limit,
        });
      }

      if (offset < 0) {
        throw new WebhookError('VALIDATION_ERROR', 'Offset must be non-negative', {
          offset,
        });
      }

      // Validate filters
      if (data.filters) {
        this.validateFilters(data.filters);
      }

      // Query tasks
      const tasks = await this.storage.queryTasks(context.workspaceId, {
        ...data.filters,
        sort: data.sort,
        limit,
        offset,
      });

      // Get total count
      const total = await this.storage.countTasks(context.workspaceId, data.filters || {});

      const result: TaskListResult = {
        tasks,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + tasks.length < total,
        },
      };

      return this.success(result);
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to list tasks');
    }
  }

  /**
   * Validate list filters
   */
  private validateFilters(filters: any): void {
    // Validate status
    if (filters.status !== undefined) {
      if (!Array.isArray(filters.status)) {
        throw new WebhookError('VALIDATION_ERROR', 'filters.status must be an array');
      }

      const validStatuses = [
        'created',
        'active',
        'due',
        'completed',
        'paused',
        'skipped',
        'archived',
        'deleted',
      ];

      for (const status of filters.status) {
        if (!validStatuses.includes(status)) {
          throw new WebhookError(
            'VALIDATION_ERROR',
            `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`
          );
        }
      }
    }

    // Validate dates
    if (filters.dueBefore !== undefined) {
      if (!this.validateISO8601(filters.dueBefore)) {
        throw new WebhookError('VALIDATION_ERROR', 'filters.dueBefore must be ISO-8601 format');
      }
    }

    if (filters.dueAfter !== undefined) {
      if (!this.validateISO8601(filters.dueAfter)) {
        throw new WebhookError('VALIDATION_ERROR', 'filters.dueAfter must be ISO-8601 format');
      }
    }

    // Validate tags
    if (filters.tags !== undefined) {
      if (!Array.isArray(filters.tags)) {
        throw new WebhookError('VALIDATION_ERROR', 'filters.tags must be an array');
      }
    }

    // Validate priority
    if (filters.priority !== undefined) {
      if (!Array.isArray(filters.priority)) {
        throw new WebhookError('VALIDATION_ERROR', 'filters.priority must be an array');
      }

      for (const priority of filters.priority) {
        if (!['low', 'medium', 'high'].includes(priority)) {
          throw new WebhookError(
            'VALIDATION_ERROR',
            `Invalid priority: ${priority}. Must be one of: low, medium, high`
          );
        }
      }
    }
  }
}
