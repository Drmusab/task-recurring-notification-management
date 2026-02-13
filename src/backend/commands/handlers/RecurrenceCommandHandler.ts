// @ts-nocheck
import { BaseCommandHandler } from "@backend/commands/handlers/BaseCommandHandler";
import { CommandResult, Task } from "@backend/commands/types/CommandTypes";
import {
  PauseRecurrenceData,
  ResumeRecurrenceData,
  SkipNextOccurrenceData,
  UpdateRecurrencePatternData,
  RecalculateOccurrenceData,
} from "@backend/commands/types/RecurrenceCommandTypes";
import { TaskValidator } from "@backend/commands/validation/TaskValidator";
import { WebhookError } from "@backend/webhook/types/Error";
import { ITaskManager } from "@backend/commands/handlers/TaskCommandHandler";
import type { IRecurrenceEngine } from "@backend/core/engine/recurrence/recurrence.types";
import { ISchedulerService } from "@backend/services/SchedulerService";

/**
 * Recurrence command handler
 */
export class RecurrenceCommandHandler extends BaseCommandHandler {
  constructor(
    private taskManager: ITaskManager,
    private recurrenceEngine: IRecurrenceEngine,
    private scheduler: ISchedulerService,
    private validator: TaskValidator
  ) {
    super();
  }

  /**
   * Handle: v1/recurrence/pause
   */
  async handlePause(data: PauseRecurrenceData, context: any): Promise<CommandResult> {
    try {
      // Validate task ID
      const validation = this.validateRequired(data, ['taskId']);
      if (!validation.valid) {
        throw new WebhookError('VALIDATION_ERROR', 'taskId is required');
      }

      // Get task
      const task = await this.taskManager.getTask(context.workspaceId, data.taskId, false);

      // Verify task is recurring
      if (!task.recurrencePattern) {
        throw new WebhookError(
          'INVALID_STATE_TRANSITION',
          'Cannot pause non-recurring task',
          { taskId: data.taskId }
        );
      }

      // Verify task is not already paused
      if (task.status === 'paused') {
        throw new WebhookError(
          'TASK_ALREADY_PAUSED',
          'Task is already paused',
          { taskId: data.taskId, status: task.status }
        );
      }

      // Pause task via TaskManager
      const pausedTask = await this.taskManager.pauseTask(context.workspaceId, data.taskId);

      // Unschedule from scheduler
      await this.scheduler.unscheduleTask(data.taskId);

      return this.success({
        taskId: pausedTask.taskId,
        status: pausedTask.status,
        pausedAt: new Date().toISOString(),
        reason: data.reason,
      });
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to pause recurrence');
    }
  }

  /**
   * Handle: v1/recurrence/resume
   */
  async handleResume(data: ResumeRecurrenceData, context: any): Promise<CommandResult> {
    try {
      // Validate task ID
      const validation = this.validateRequired(data, ['taskId']);
      if (!validation.valid) {
        throw new WebhookError('VALIDATION_ERROR', 'taskId is required');
      }

      // Get task
      const task = await this.taskManager.getTask(context.workspaceId, data.taskId, false);

      // Verify task is paused
      if (task.status !== 'paused') {
        throw new WebhookError(
          'INVALID_STATE_TRANSITION',
          'Can only resume paused tasks',
          { taskId: data.taskId, status: task.status }
        );
      }

      // Resume task via TaskManager
      const resumedTask = await this.taskManager.resumeTask(context.workspaceId, data.taskId);

      // Recalculate next due date if resuming from now
      if (data.resumeFromNow && resumedTask.recurrencePattern) {
        const nextDue = this.recurrenceEngine.calculateNextDueDate(
          resumedTask,
          new Date()
        );

        if (nextDue) {
          // Update task with new due date
          const updated = await this.taskManager.updateTask(context.workspaceId, {
            taskId: data.taskId,
            dueDate: nextDue.toISOString(),
          });

          // Reschedule
          await this.scheduler.scheduleTask(updated);

          return this.success({
            taskId: updated.taskId,
            status: updated.status,
            resumedAt: new Date().toISOString(),
            nextDueDate: updated.nextDueDate,
            recalculated: true,
          });
        }
      }

      // Reschedule with existing due date
      await this.scheduler.scheduleTask(resumedTask);

      return this.success({
        taskId: resumedTask.taskId,
        status: resumedTask.status,
        resumedAt: new Date().toISOString(),
        nextDueDate: resumedTask.nextDueDate,
        recalculated: false,
      });
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to resume recurrence');
    }
  }

  /**
   * Handle: v1/recurrence/skip
   */
  async handleSkip(data: SkipNextOccurrenceData, context: any): Promise<CommandResult> {
    try {
      // Validate task ID
      const validation = this.validateRequired(data, ['taskId']);
      if (!validation.valid) {
        throw new WebhookError('VALIDATION_ERROR', 'taskId is required');
      }

      const skipCount = data.skipCount || 1;
      if (skipCount < 1 || skipCount > 10) {
        throw new WebhookError('VALIDATION_ERROR', 'skipCount must be between 1 and 10', {
          skipCount,
        });
      }

      // Get task
      const task = await this.taskManager.getTask(context.workspaceId, data.taskId, false);

      // Verify task is recurring
      if (!task.recurrencePattern) {
        throw new WebhookError(
          'INVALID_STATE_TRANSITION',
          'Cannot skip non-recurring task',
          { taskId: data.taskId }
        );
      }

      // Calculate next occurrence after skipping
      let baseDate = task.nextDueDate ? new Date(task.nextDueDate) : new Date();
      let skippedDates: Date[] = [];

      for (let i = 0; i < skipCount; i++) {
        const skipped = baseDate;
        skippedDates.push(new Date(skipped));

        const next = this.recurrenceEngine.calculateNextDueDate(task, baseDate);
        if (!next) {
          throw new WebhookError(
            'INVALID_STATE_TRANSITION',
            'No more occurrences to skip',
            { taskId: data.taskId }
          );
        }

        baseDate = next;
      }

      // Update task with new due date
      const updated = await this.taskManager.updateTask(context.workspaceId, {
        taskId: data.taskId,
        dueDate: baseDate.toISOString(),
      });

      // Reschedule
      await this.scheduler.rescheduleTask(updated);

      return this.success({
        taskId: updated.taskId,
        skippedDates: skippedDates.map((d) => d.toISOString()),
        nextDueDate: updated.nextDueDate,
        reason: data.reason,
        skippedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to skip occurrence');
    }
  }

  /**
   * Handle: v1/recurrence/update-pattern
   */
  async handleUpdatePattern(
    data: UpdateRecurrencePatternData,
    context: any
  ): Promise<CommandResult> {
    try {
      // Validate task ID
      const validation = this.validateRequired(data, ['taskId', 'recurrencePattern']);
      if (!validation.valid) {
        throw new WebhookError('VALIDATION_ERROR', 'taskId and recurrencePattern are required');
      }

      // Validate new pattern
      this.validator.validateRecurrencePattern(data.recurrencePattern);

      // Verify pattern is valid via recurrence engine
      const engineValidation = this.recurrenceEngine.validatePattern(data.recurrencePattern);
      if (!engineValidation.valid) {
        throw new WebhookError(
          'INVALID_RECURRENCE_PATTERN',
          'Recurrence pattern validation failed',
          { errors: engineValidation.errors }
        );
      }

      // Get task
      const task = await this.taskManager.getTask(context.workspaceId, data.taskId, false);

      // Store old pattern for response
      const oldPattern = task.recurrencePattern;

      // Update task with new pattern
      // This will update the stored pattern but NOT regenerate immediately
      const updated = await this.taskManager.updateTask(context.workspaceId, {
        taskId: data.taskId,
        // Pattern update handled internally by TaskManager
      });

      // If applyToExisting, recalculate next due date immediately
      if (data.applyToExisting) {
        const nextDue = this.recurrenceEngine.calculateNextDueDate(
          { ...updated, recurrencePattern: data.recurrencePattern },
          new Date()
        );

        if (nextDue) {
          const recalculated = await this.taskManager.updateTask(context.workspaceId, {
            taskId: data.taskId,
            dueDate: nextDue.toISOString(),
          });

          // Reschedule
          await this.scheduler.rescheduleTask(recalculated);

          return this.success({
            taskId: recalculated.taskId,
            updatedAt: new Date().toISOString(),
            oldPattern,
            newPattern: data.recurrencePattern,
            nextDueDate: recalculated.nextDueDate,
            appliedToExisting: true,
          });
        }
      }

      return this.success({
        taskId: updated.taskId,
        updatedAt: new Date().toISOString(),
        oldPattern,
        newPattern: data.recurrencePattern,
        nextDueDate: updated.nextDueDate,
        appliedToExisting: false,
      });
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to update recurrence pattern');
    }
  }

  /**
   * Handle: v1/recurrence/recalculate
   */
  async handleRecalculate(
    data: RecalculateOccurrenceData,
    context: any
  ): Promise<CommandResult> {
    try {
      // Validate task ID
      const validation = this.validateRequired(data, ['taskId']);
      if (!validation.valid) {
        throw new WebhookError('VALIDATION_ERROR', 'taskId is required');
      }

      // Get task
      const task = await this.taskManager.getTask(context.workspaceId, data.taskId, false);

      // Verify task is recurring
      if (!task.recurrencePattern) {
        throw new WebhookError(
          'INVALID_STATE_TRANSITION',
          'Cannot recalculate non-recurring task',
          { taskId: data.taskId }
        );
      }

      const oldDueDate = task.nextDueDate;

      // Recalculate next due date
      const baseDate = task.lastCompletedAt
        ? new Date(task.lastCompletedAt)
        : new Date();

      const nextDue = this.recurrenceEngine.calculateNextDueDate(task, baseDate);

      if (!nextDue) {
        return this.success({
          taskId: task.taskId,
          recalculated: true,
          oldDueDate,
          nextDueDate: null,
          message: 'No more occurrences (recurrence ended or beyond horizon)',
        });
      }

      // Update task
      const updated = await this.taskManager.updateTask(context.workspaceId, {
        taskId: data.taskId,
        dueDate: nextDue.toISOString(),
      });

      // Reschedule
      await this.scheduler.rescheduleTask(updated);

      return this.success({
        taskId: updated.taskId,
        recalculated: true,
        oldDueDate,
        nextDueDate: updated.nextDueDate,
        recalculatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to recalculate occurrence');
    }
  }
}
