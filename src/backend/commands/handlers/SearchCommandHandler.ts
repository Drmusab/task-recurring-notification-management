// @ts-nocheck
import { BaseCommandHandler } from "@backend/commands/handlers/BaseCommandHandler";
import { CommandResult, TaskListResult } from "@backend/commands/types/CommandTypes";
import { SearchTasksData, TaskStatsData, TaskStatsResult } from "@backend/commands/types/BulkCommandTypes";
import { IStorageService } from "@backend/commands/handlers/QueryCommandHandler";
import { TaskSearchEngine } from "@backend/query/TaskSearchEngine";
import { TaskStatsCalculator } from "@backend/query/TaskStatsCalculator";
import { WebhookError } from "@backend/webhook/types/Error";

/**
 * Search and statistics command handler
 */
export class SearchCommandHandler extends BaseCommandHandler {
  private searchEngine: TaskSearchEngine;
  private statsCalculator: TaskStatsCalculator;

  constructor(private storage: IStorageService) {
    super();
    this.searchEngine = new TaskSearchEngine();
    this.statsCalculator = new TaskStatsCalculator();
  }

  /**
   * Handle: v1/query/search
   */
  async handleSearch(data: SearchTasksData, context: any): Promise<CommandResult<TaskListResult>> {
    try {
      // Validate pagination
      const limit = data.pagination?.limit ?? 20;
      const offset = data.pagination?.offset ?? 0;

      if (limit < 1 || limit > 100) {
        throw new WebhookError('VALIDATION_ERROR', 'Limit must be between 1 and 100');
      }

      if (offset < 0) {
        throw new WebhookError('VALIDATION_ERROR', 'Offset must be non-negative');
      }

      // Get all tasks for workspace
      const allTasks = await this.storage.queryTasks(context.workspaceId, {});

      // Apply search and filters
      const searchResults = this.searchEngine.search(allTasks, data);

      // Apply pagination
      const paginatedResults = searchResults.slice(offset, offset + limit);

      const result: TaskListResult = {
        tasks: paginatedResults,
        pagination: {
          total: searchResults.length,
          limit,
          offset,
          hasMore: offset + paginatedResults.length < searchResults.length,
        },
      };

      return this.success(result);
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to search tasks');
    }
  }

  /**
   * Handle: v1/query/stats
   */
  async handleStats(data: TaskStatsData, context: any): Promise<CommandResult<TaskStatsResult>> {
    try {
      // Validate time range if provided
      if (data.timeRange) {
        if (!this.validateISO8601(data.timeRange.start)) {
          throw new WebhookError('VALIDATION_ERROR', 'timeRange.start must be ISO-8601 format');
        }
        if (!this.validateISO8601(data.timeRange.end)) {
          throw new WebhookError('VALIDATION_ERROR', 'timeRange.end must be ISO-8601 format');
        }

        const start = new Date(data.timeRange.start);
        const end = new Date(data.timeRange.end);
        if (end <= start) {
          throw new WebhookError('VALIDATION_ERROR', 'timeRange.end must be after timeRange.start');
        }
      }

      // Get all tasks for workspace
      const allTasks = await this.storage.queryTasks(context.workspaceId, {});

      // Calculate statistics
      const stats = this.statsCalculator.calculate(allTasks, data);

      return this.success(stats);
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to calculate statistics');
    }
  }
}
