// @ts-nocheck
/**
 * Task Commands for keyboard shortcuts and actions
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskRepository";
import type { RecurrenceEngineRRULE as RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngineRRULE";
import type { PluginSettings } from "@backend/core/settings/PluginSettings";
import { StatusRegistry } from "@backend/core/models/StatusRegistry";
import { pluginEventBus } from "@backend/core/events/PluginEventBus";
import { CompletionHandler } from "@backend/core/actions/CompletionHandler";
import type { SiYuanBlockAPI } from "@backend/core/actions/CompletionHandler";
import * as logger from "@backend/logging/logger";
import { toast } from "@frontend/utils/notifications";

export class TaskCommands {
  private completionHandler?: CompletionHandler;

  constructor(
    private repository: TaskRepositoryProvider,
    private recurrenceEngine?: RecurrenceEngine,
    private getSettings?: () => PluginSettings,
    private siyuanApi?: SiYuanBlockAPI
  ) {
    // Initialize CompletionHandler if we have required dependencies
    if (recurrenceEngine && getSettings) {
      this.completionHandler = new CompletionHandler(
        repository,
        recurrenceEngine,
        getSettings(),
        siyuanApi
      );
    }
  }

  /**
   * Get current settings or undefined if not available
   */
  private get settings(): PluginSettings | undefined {
    return this.getSettings?.();
  }

  /**
   * Toggle task status - cycle through status types
   */
  async toggleStatus(taskId: string): Promise<void> {
    try {
      const task = this.repository.getTask(taskId);
      if (!task) {
        toast.error("Task not found");
        return;
      }

      const registry = StatusRegistry.getInstance();
      const currentSymbol = task.statusSymbol || " ";
      const nextSymbol = registry.getNextSymbol(currentSymbol);
      
      // Update task
      const updatedTask = { ...task, statusSymbol: nextSymbol };
      const newStatus = registry.getStatus(nextSymbol);
      
      // Update status field based on type
      if (newStatus.type === "DONE") {
        updatedTask.status = "done";
        
        // Use CompletionHandler for full orchestration
        if (task.frequency && this.completionHandler) {
          const result = await this.completionHandler.onComplete(
            updatedTask,
            new Date()
          );
          
          if (result.success) {
            if (result.nextTask) {
              logger.info('Next recurrence created', { 
                taskId: updatedTask.id,
                nextTaskId: result.nextTask.id,
                nextDue: result.nextTask.dueAt,
              });
              toast.success(`Task completed - next occurrence scheduled`);
            } else {
              toast.success(`Task status updated to ${newStatus.name}`);
            }
            
            if (result.warnings) {
              result.warnings.forEach(w => toast.warning(w));
            }
          } else {
            toast.error(`Failed to complete task: ${result.error}`);
          }
        } else {
          // No recurrence - simple completion
          if (this.settings?.dates.autoAddDone && !updatedTask.doneAt) {
            updatedTask.doneAt = new Date().toISOString();
          }
          await this.repository.saveTask(updatedTask);
          toast.success(`Task status updated to ${newStatus.name}`);
        }
        
        pluginEventBus.emit("task:updated", { taskId });
      } else if (newStatus.type === "CANCELLED") {
        updatedTask.status = "cancelled";
        
        // Auto-add cancelled date if enabled in settings
        if (this.settings?.dates.autoAddCancelled && !updatedTask.cancelledAt) {
          updatedTask.cancelledAt = new Date().toISOString();
        }
        
        await this.repository.saveTask(updatedTask);
        pluginEventBus.emit("task:updated", { taskId });
        toast.success(`Task status updated to ${newStatus.name}`);
      } else if (newStatus.type === "TODO") {
        updatedTask.status = "todo";
        
        await this.repository.saveTask(updatedTask);
        pluginEventBus.emit("task:updated", { taskId });
        toast.success(`Task status updated to ${newStatus.name}`);
      }
    } catch (error) {
      logger.error("Failed to toggle task status", error);
      toast.error("Failed to toggle status");
    }
  }

  /**
   * Complete a task (mark as done)
   */
  async completeTask(taskId: string): Promise<void> {
    try {
      const task = this.repository.getTask(taskId);
      if (!task) {
        toast.error("Task not found");
        return;
      }

      const updatedTask = {
        ...task,
        status: "done" as const,
      };
      
      // Use CompletionHandler for full orchestration
      if (task.frequency && this.completionHandler) {
        const result = await this.completionHandler.onComplete(
          updatedTask,
          new Date()
        );
        
        if (result.success) {
          if (result.nextTask) {
            logger.info('Next recurrence created', { 
              taskId: updatedTask.id,
              nextTaskId: result.nextTask.id,
              nextDue: result.nextTask.dueAt,
            });
            toast.success(`Task "${task.name}" completed - next occurrence scheduled`);
          } else {
            toast.success(`Task "${task.name}" completed`);
          }
          
          if (result.warnings) {
            result.warnings.forEach(w => toast.warning(w));
          }
        } else {
          toast.error(`Failed to complete task: ${result.error}`);
        }
      } else {
        // No recurrence - simple completion
        const autoAddDone = this.settings?.dates.autoAddDone ?? true;
        if (autoAddDone && !updatedTask.doneAt) {
          updatedTask.doneAt = new Date().toISOString();
        }
        await this.repository.saveTask(updatedTask);
        toast.success(`Task "${task.name}" completed`);
      }
      
      pluginEventBus.emit("task:complete", { taskId });
    } catch (error) {
      logger.error("Failed to complete task", error);
      toast.error("Failed to complete task");
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      const task = this.repository.getTask(taskId);
      if (!task) {
        toast.error("Task not found");
        return;
      }

      // Check for dependencies
      const allTasks = this.repository.getAllTasks();
      const dependents = allTasks.filter((t) => 
        t.blockedBy?.includes(taskId) || t.dependsOn?.includes(taskId)
      );

      if (dependents.length > 0) {
        const confirmed = confirm(
          `This task is blocking ${dependents.length} other task(s). Are you sure you want to delete it?`
        );
        if (!confirmed) {
          return;
        }
      }

      await this.repository.deleteTask(taskId);
      pluginEventBus.emit("task:deleted", { taskId });
      toast.success(`Task "${task.name}" deleted`);
    } catch (error) {
      logger.error("Failed to delete task", error);
      toast.error("Failed to delete task");
    }
  }

  /**
   * Reschedule task to today
   */
  async rescheduleToToday(taskId: string): Promise<void> {
    try {
      const task = this.repository.getTask(taskId);
      if (!task) {
        toast.error("Task not found");
        return;
      }

      const today = new Date();
      today.setHours(12, 0, 0, 0);
      
      const updatedTask = {
        ...task,
        scheduledAt: today.toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.repository.saveTask(updatedTask);
      pluginEventBus.emit("task:updated", { taskId });
      toast.success(`Task rescheduled to today`);
    } catch (error) {
      logger.error("Failed to reschedule task", error);
      toast.error("Failed to reschedule task");
    }
  }

  /**
   * Defer task by N days
   */
  async deferTask(taskId: string, days: number): Promise<void> {
    try {
      const task = this.repository.getTask(taskId);
      if (!task) {
        toast.error("Task not found");
        return;
      }

      const updatedTask = { ...task, updatedAt: new Date().toISOString() };

      // Defer due date if it exists
      if (task.dueAt) {
        const newDue = new Date(task.dueAt);
        newDue.setDate(newDue.getDate() + days);
        updatedTask.dueAt = newDue.toISOString();
      }

      // Defer scheduled date if it exists
      if (task.scheduledAt) {
        const newScheduled = new Date(task.scheduledAt);
        newScheduled.setDate(newScheduled.getDate() + days);
        updatedTask.scheduledAt = newScheduled.toISOString();
      }

      await this.repository.saveTask(updatedTask);
      pluginEventBus.emit("task:updated", { taskId });
      toast.success(`Task deferred by ${days} day${days !== 1 ? "s" : ""}`);
    } catch (error) {
      logger.error("Failed to defer task", error);
      toast.error("Failed to defer task");
    }
  }

}
