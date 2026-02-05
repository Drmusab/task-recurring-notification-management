import { BaseCommandHandler } from "@backend/commands/handlers/BaseCommandHandler";
import { CommandResult, Task, RecurrencePattern } from "@backend/commands/types/CommandTypes";
import { PreviewOccurrencesData } from "@backend/commands/types/RecurrenceCommandTypes";
import { RecurrencePreview } from "@backend/recurrence/RecurrencePreview";
import { WebhookError } from "@backend/webhook/types/Error";
import { ITaskManager } from "@backend/commands/handlers/TaskCommandHandler";

/**
 * Preview command handler
 */
export class PreviewCommandHandler extends BaseCommandHandler {
  constructor(private taskManager: ITaskManager) {
    super();
  }

  /**
   * Handle: v1/recurrence/preview-occurrences
   */
  async handlePreview(data: PreviewOccurrencesData, context: any): Promise<CommandResult> {
    try {
      let pattern: RecurrencePattern;
      let startDate: Date;

      // Get pattern from task or direct input
      if (data.taskId) {
        const task = await this.taskManager.getTask(context.workspaceId, data.taskId, false);
        
        if (!task.recurrencePattern) {
          throw new WebhookError(
            'VALIDATION_ERROR',
            'Task does not have a recurrence pattern',
            { taskId: data.taskId }
          );
        }

        pattern = task.recurrencePattern;
        startDate = task.nextDueDate ? new Date(task.nextDueDate) : new Date();
      } else if (data.recurrencePattern) {
        pattern = data.recurrencePattern;
        startDate = data.startDate ? new Date(data.startDate) : new Date();
      } else {
        throw new WebhookError(
          'VALIDATION_ERROR',
          'Must provide either taskId or recurrencePattern'
        );
      }

      // Validate limit
      const limit = data.limit || 50;
      if (limit < 1 || limit > 100) {
        throw new WebhookError('VALIDATION_ERROR', 'Limit must be between 1 and 100', {
          limit,
        });
      }

      // Determine until date
      let until: Date | undefined;
      if (data.until) {
        until = new Date(data.until);
        if (!this.validateISO8601(data.until)) {
          throw new WebhookError('VALIDATION_ERROR', 'until must be ISO-8601 format');
        }
      }

      // Determine horizon
      const horizonDays = data.horizonDays || pattern.horizonDays || 365;
      if (horizonDays > 1095) {
        throw new WebhookError('VALIDATION_ERROR', 'horizonDays cannot exceed 1095', {
          horizonDays,
        });
      }

      // Generate preview
      const preview = RecurrencePreview.previewOccurrences(pattern, startDate, {
        limit,
        until,
        horizonDays,
        maxIterations: 1000,
      });

      // Estimate total
      const estimatedTotal = RecurrencePreview.estimateTotalOccurrences(
        pattern,
        startDate,
        horizonDays
      );

      return this.success({
        occurrences: preview.occurrences.map((d) => d.toISOString()),
        count: preview.occurrences.length,
        truncated: preview.truncated,
        nextOccurrenceAfterLimit: preview.nextOccurrenceAfterLimit?.toISOString() || null,
        estimatedTotalInHorizon: estimatedTotal,
        horizonDays,
        startDate: startDate.toISOString(),
      });
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to preview occurrences');
    }
  }
}
