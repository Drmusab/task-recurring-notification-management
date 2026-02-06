// @ts-nocheck
import { BaseCommandHandler } from "@backend/commands/handlers/BaseCommandHandler";
import { CommandResult } from "@backend/commands/types/CommandTypes";
import {
  BulkCompleteData,
  BulkRescheduleData,
  BulkDeleteData,
  BulkOperationResult,
} from "@backend/commands/types/BulkCommandTypes";
import { ITaskManager } from "@backend/commands/handlers/TaskCommandHandler";
import { BulkExecutor } from "@backend/services/BulkExecutorService";
import { PartialResultCollector } from "@backend/services/PartialResultCollectorService";
import { DEFAULT_BATCH_CONFIGS } from "@backend/services/batch-config";
import { WebhookError } from "@backend/webhook/types/Error";

/**
 * Bulk operations handler
 */
export class BulkCommandHandler extends BaseCommandHandler {
  constructor(private taskManager: ITaskManager) {
    super();
  }

  /**
   * Handle: v1/tasks/bulk-complete
   */
  async handleBulkComplete(
    data: BulkCompleteData,
    context: any
  ): Promise<CommandResult<BulkOperationResult>> {
    try {
      // Validate
      this.validateBulkInput(data.taskIds, 'taskIds');

      const continueOnError = data.continueOnError ?? true;
      const collector = new PartialResultCollector(data.taskIds.length);
      const executor = new BulkExecutor({
        ...DEFAULT_BATCH_CONFIGS.complete,
        continueOnError,
      });

      // Execute bulk operation
      await executor.execute(
        data.taskIds,
        async (taskId) => {
          const task = await this.taskManager.completeTask(context.workspaceId, {
            taskId,
            completionTimestamp: data.completionTimestamp,
            notes: data.notes,
          });

          return {
            taskId: task.taskId,
            completedAt: task.completedAt,
            nextOccurrence: task.recurrencePattern
              ? {
                  dueDate: task.nextDueDate,
                  status: task.status,
                }
              : undefined,
          };
        },
        collector
      );

      return this.success(collector.getResult());
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to bulk complete tasks');
    }
  }

  /**
   * Handle: v1/tasks/bulk-reschedule
   */
  async handleBulkReschedule(
    data: BulkRescheduleData,
    context: any
  ): Promise<CommandResult<BulkOperationResult>> {
    try {
      // Validate
      this.validateBulkInput(data.taskIds, 'taskIds');

      if (!data.dueDate && !data.offset) {
        throw new WebhookError(
          'VALIDATION_ERROR',
          'Must provide either dueDate or offset'
        );
      }

      if (data.dueDate && !this.validateISO8601(data.dueDate)) {
        throw new WebhookError('VALIDATION_ERROR', 'dueDate must be ISO-8601 format');
      }

      const continueOnError = data.continueOnError ?? true;
      const collector = new PartialResultCollector(data.taskIds.length);
      const executor = new BulkExecutor({
        ...DEFAULT_BATCH_CONFIGS.reschedule,
        continueOnError,
      });

      // Execute bulk operation
      await executor.execute(
        data.taskIds,
        async (taskId) => {
          // Calculate new due date
          let newDueDate: string;

          if (data.dueDate) {
            newDueDate = data.dueDate;
          } else {
            // Calculate offset
            const task = await this.taskManager.getTask(
              context.workspaceId,
              taskId,
              false
            );

            const currentDue = task.nextDueDate
              ? new Date(task.nextDueDate)
              : new Date();

            newDueDate = this.applyOffset(currentDue, data.offset!).toISOString();
          }

          // Update task
          const updated = await this.taskManager.updateTask(context.workspaceId, {
            taskId,
            dueDate: newDueDate,
          });

          return {
            taskId: updated.taskId,
            oldDueDate: updated.nextDueDate,
            newDueDate: newDueDate,
            updatedAt: updated.updatedAt,
          };
        },
        collector
      );

      return this.success(collector.getResult());
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to bulk reschedule tasks');
    }
  }

  /**
   * Handle: v1/tasks/bulk-delete
   */
  async handleBulkDelete(
    data: BulkDeleteData,
    context: any
  ): Promise<CommandResult<BulkOperationResult>> {
    try {
      // Validate
      this.validateBulkInput(data.taskIds, 'taskIds');

      const continueOnError = data.continueOnError ?? true;
      const collector = new PartialResultCollector(data.taskIds.length);
      const executor = new BulkExecutor({
        ...DEFAULT_BATCH_CONFIGS.delete,
        continueOnError,
      });

      // Execute bulk operation
      await executor.execute(
        data.taskIds,
        async (taskId) => {
          await this.taskManager.deleteTask(
            context.workspaceId,
            taskId,
            data.deleteHistory ?? false
          );

          return {
            taskId,
            deletedAt: new Date().toISOString(),
          };
        },
        collector
      );

      return this.success(collector.getResult());
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to bulk delete tasks');
    }
  }

  /**
   * Validate bulk input
   */
  private validateBulkInput(taskIds: any, fieldName: string): void {
    if (!Array.isArray(taskIds)) {
      throw new WebhookError('VALIDATION_ERROR', `${fieldName} must be an array`);
    }

    if (taskIds.length === 0) {
      throw new WebhookError('VALIDATION_ERROR', `${fieldName} cannot be empty`);
    }

    if (taskIds.length > 1000) {
      throw new WebhookError(
        'VALIDATION_ERROR',
        `${fieldName} cannot exceed 1000 items`,
        { limit: 1000, actual: taskIds.length }
      );
    }

    for (const taskId of taskIds) {
      if (typeof taskId !== 'string' || taskId.trim().length === 0) {
        throw new WebhookError('VALIDATION_ERROR', 'All task IDs must be non-empty strings');
      }
    }
  }

  /**
   * Apply time offset to date
   */
  private applyOffset(
    date: Date,
    offset: { amount: number; unit: string; direction: string }
  ): Date {
    const result = new Date(date);
    const multiplier = offset.direction === 'forward' ? 1 : -1;
    const amount = offset.amount * multiplier;

    switch (offset.unit) {
      case 'minutes':
        result.setMinutes(result.getMinutes() + amount);
        break;
      case 'hours':
        result.setHours(result.getHours() + amount);
        break;
      case 'days':
        result.setDate(result.getDate() + amount);
        break;
      case 'weeks':
        result.setDate(result.getDate() + amount * 7);
        break;
      default:
        throw new WebhookError('VALIDATION_ERROR', `Invalid offset unit: ${offset.unit}`);
    }

    return result;
  }
}
