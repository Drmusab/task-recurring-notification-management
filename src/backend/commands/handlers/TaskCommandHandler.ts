// Add to existing TaskCommandHandler

import { OutboundWebhookEmitter } from "@backend/events/OutboundWebhookEmitter";
import { TaskCreatedEvent, TaskCompletedEvent } from "@backend/events/types/EventTypes";

export class TaskCommandHandler extends BaseCommandHandler {
  constructor(
    private taskManager: ITaskManager,
    private validator: TaskValidator,
    private eventEmitter?: OutboundWebhookEmitter // Optional event emitter
  ) {
    super();
  }

  /**
   * Handle: v1/tasks/create (with events)
   */
  async handleCreate(data: CreateTaskData, context: any): Promise<CommandResult> {
    try {
      this.validator.validateCreateTask(data);

      const task = await this.taskManager.createTask(context.workspaceId, data);

      // Emit event
      if (this.eventEmitter) {
        const event: TaskCreatedEvent = {
          event: 'task.created',
          taskId: task.taskId,
          workspaceId: context.workspaceId,
          timestamp: new Date().toISOString(),
          eventId: OutboundWebhookEmitter.generateEventId(),
          payload: {
            title: task.title,
            description: task.description,
            dueDate: task.nextDueDate,
            recurrencePattern: task.recurrencePattern,
            tags: task.tags,
            priority: task.priority,
          },
        };

        await this.eventEmitter.emit(event);
      }

      return this.success({
        taskId: task.taskId,
        createdAt: task.createdAt,
        nextDueDate: task.nextDueDate,
        status: task.status,
      });
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to create task');
    }
  }

  /**
   * Handle: v1/tasks/complete (with events)
   */
  async handleComplete(data: CompleteTaskData, context: any): Promise<CommandResult> {
    try {
      const validation = this.validateRequired(data, ['taskId']);
      if (!validation.valid) {
        throw new WebhookError('VALIDATION_ERROR', 'taskId is required', {
          missing: validation.missing,
        });
      }

      if (data.completionTimestamp && !this.validateISO8601(data.completionTimestamp)) {
        throw new WebhookError('VALIDATION_ERROR', 'completionTimestamp must be ISO-8601 format');
      }

      const task = await this.taskManager.completeTask(context.workspaceId, data);

      // Emit event
      if (this.eventEmitter) {
        const event: TaskCompletedEvent = {
          event: 'task.completed',
          taskId: task.taskId,
          workspaceId: context.workspaceId,
          timestamp: new Date().toISOString(),
          eventId: OutboundWebhookEmitter.generateEventId(),
          payload: {
            title: task.title,
            completedAt: task.completedAt!,
            completionNotes: data.notes,
            isRecurring: task.recurrencePattern !== null,
            nextDueDate: task.nextDueDate,
          },
        };

        await this.eventEmitter.emit(event);

        // If recurring, also emit regeneration event
        if (task.recurrencePattern && task.nextDueDate) {
          const regenEvent = {
            event: 'recurrence.regenerated' as const,
            taskId: task.taskId,
            workspaceId: context.workspaceId,
            timestamp: new Date().toISOString(),
            eventId: OutboundWebhookEmitter.generateEventId(),
            payload: {
              title: task.title,
              previousDueDate: data.completionTimestamp || new Date().toISOString(),
              nextDueDate: task.nextDueDate,
              regeneratedAt: new Date().toISOString(),
            },
          };

          await this.eventEmitter.emit(regenEvent);
        }
      }

      const response: any = {
        taskId: task.taskId,
        completedAt: task.completedAt,
      };

      if (task.recurrencePattern) {
        response.nextOccurrence = {
          dueDate: task.nextDueDate,
          status: task.status,
        };
      } else {
        response.status = task.status;
      }

      return this.success(response);
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to complete task');
    }
  }
}
