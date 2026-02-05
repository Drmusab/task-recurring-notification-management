import { Router } from "@backend/webhooks/Router";
import { TaskCommandHandler, ITaskManager } from "@backend/commands/handlers/TaskCommandHandler";
import { QueryCommandHandler, IStorageService } from "@backend/commands/handlers/QueryCommandHandler";
import { RecurrenceCommandHandler } from "@backend/commands/handlers/RecurrenceCommandHandler";
import { PreviewCommandHandler } from "@backend/commands/handlers/PreviewCommandHandler";
import { BulkCommandHandler } from "@backend/commands/handlers/BulkCommandHandler";
import { SearchCommandHandler } from "@backend/commands/handlers/SearchCommandHandler";
import { TaskValidator } from "@backend/commands/validation/TaskValidator";
import { RecurrenceLimitsConfig } from "@backend/config/WebhookConfig";
import { IRecurrenceEngine } from "@backend/services/RecurrenceEngine";
import { ISchedulerService } from "@backend/services/SchedulerService";
import { WebhookError } from "@backend/webhook/types/Error";

/**
 * Command registry - registers all command handlers
 */
export class CommandRegistry {
  private taskHandler: TaskCommandHandler;
  private queryHandler: QueryCommandHandler;
  private recurrenceHandler: RecurrenceCommandHandler;
  private previewHandler: PreviewCommandHandler;
  private bulkHandler: BulkCommandHandler;
  private searchHandler: SearchCommandHandler;

  constructor(
    private router: Router,
    taskManager: ITaskManager,
    storage: IStorageService,
    recurrenceEngine: IRecurrenceEngine,
    scheduler: ISchedulerService,
    recurrenceLimits: RecurrenceLimitsConfig
  ) {
    const validator = new TaskValidator(recurrenceLimits);

    this.taskHandler = new TaskCommandHandler(taskManager, validator);
    this.queryHandler = new QueryCommandHandler(storage);
    this.recurrenceHandler = new RecurrenceCommandHandler(
      taskManager,
      recurrenceEngine,
      scheduler,
      validator
    );
    this.previewHandler = new PreviewCommandHandler(taskManager);
    this.bulkHandler = new BulkCommandHandler(taskManager);
    this.searchHandler = new SearchCommandHandler(storage);

    this.registerCommands();
  }

  /**
   * Register all commands
   */
  private registerCommands(): void {
    // Task commands
    this.router.register('v1/tasks/create', this.wrap((data, ctx) => 
      this.taskHandler.handleCreate(data, ctx)
    ));
    this.router.register('v1/tasks/update', this.wrap((data, ctx) => 
      this.taskHandler.handleUpdate(data, ctx)
    ));
    this.router.register('v1/tasks/complete', this.wrap((data, ctx) => 
      this.taskHandler.handleComplete(data, ctx)
    ));
    this.router.register('v1/tasks/delete', this.wrap((data, ctx) => 
      this.taskHandler.handleDelete(data, ctx)
    ));
    this.router.register('v1/tasks/get', this.wrap((data, ctx) => 
      this.taskHandler.handleGet(data, ctx)
    ));

    // Query commands
    this.router.register('v1/query/list', this.wrap((data, ctx) => 
      this.queryHandler.handleList(data, ctx)
    ));
    this.router.register('v1/query/search', this.wrap((data, ctx) => 
      this.searchHandler.handleSearch(data, ctx)
    ));
    this.router.register('v1/query/stats', this.wrap((data, ctx) => 
      this.searchHandler.handleStats(data, ctx)
    ));

    // Recurrence commands
    this.router.register('v1/recurrence/pause', this.wrap((data, ctx) => 
      this.recurrenceHandler.handlePause(data, ctx)
    ));
    this.router.register('v1/recurrence/resume', this.wrap((data, ctx) => 
      this.recurrenceHandler.handleResume(data, ctx)
    ));
    this.router.register('v1/recurrence/skip', this.wrap((data, ctx) => 
      this.recurrenceHandler.handleSkip(data, ctx)
    ));
    this.router.register('v1/recurrence/update-pattern', this.wrap((data, ctx) => 
      this.recurrenceHandler.handleUpdatePattern(data, ctx)
    ));
    this.router.register('v1/recurrence/recalculate', this.wrap((data, ctx) => 
      this.recurrenceHandler.handleRecalculate(data, ctx)
    ));
    this.router.register('v1/recurrence/preview-occurrences', this.wrap((data, ctx) => 
      this.previewHandler.handlePreview(data, ctx)
    ));

    // Bulk commands
    this.router.register('v1/tasks/bulk-complete', this.wrap((data, ctx) => 
      this.bulkHandler.handleBulkComplete(data, ctx)
    ));
    this.router.register('v1/tasks/bulk-reschedule', this.wrap((data, ctx) => 
      this.bulkHandler.handleBulkReschedule(data, ctx)
    ));
    this.router.register('v1/tasks/bulk-delete', this.wrap((data, ctx) => 
      this.bulkHandler.handleBulkDelete(data, ctx)
    ));
  }

  /**
   * Wrap handler to convert CommandResult to router format
   */
  private wrap(
    handler: (data: any, context: any) => Promise<any>
  ): (command: string, data: any, context: any) => Promise<any> {
    return async (command: string, data: any, context: any) => {
      const result = await handler(data, context);
      if (result.status === 'error') {
        throw new WebhookError(
          result.error!.code as any,
          result.error!.message,
          result.error!.details
        );
      }
      return result.result;
    };
  }
}
