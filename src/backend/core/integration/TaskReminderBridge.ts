/**
 * Task-Reminder Bridge Service
 * 
 * Synchronizes reminder state with task changes.
 * Ensures reminders are created/updated/deleted when tasks change.
 * 
 * INTEGRATION PATTERN:
 * - Subscribe to TaskManager events (task:created, task:updated, task:deleted)
 * - Map Task dueAt/scheduledAt to Reminder dates
 * - Update ReminderPlugin accordingly
 * 
 * WHY THIS EXISTS:
 * ReminderPlugin is a standalone Obsidian-based system that doesn't know about
 * our SiYuan Task model. This bridge translates between the two.
 */

import type { Task } from '@backend/core/models/Task';
import type ReminderPlugin from '@frontend/components/reminders/main';
import type { Reminder } from '@backend/core/reminders/reminder';
import * as logger from "@backend/logging/logger";

export interface TaskReminderSyncOptions {
  /** Auto-create reminders for tasks with due dates */
  autoCreateReminders: boolean;
  
  /** Default reminder offset in minutes (e.g., -15 = 15 minutes before) */
  defaultReminderOffset: number;
  
  /** Enable sync (can be disabled for testing) */
  enabled: boolean;
}

const DEFAULT_OPTIONS: TaskReminderSyncOptions = {
  autoCreateReminders: true,
  defaultReminderOffset: -15, // 15 minutes before due date
  enabled: true,
};

/**
 * Task-Reminder Bridge
 * 
 * Lifecycle:
 * 1. Initialize with ReminderPlugin instance
 * 2. Call syncTask() after any task create/update
 * 3. Call removeTaskReminder() after task delete
 */
export class TaskReminderBridge {
  private reminderPlugin: ReminderPlugin | null = null;
  private options: TaskReminderSyncOptions;
  private taskReminderMap: Map<string, string> = new Map(); // taskId -> reminderId
  
  constructor(options: Partial<TaskReminderSyncOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Initialize bridge with ReminderPlugin instance
   */
  initialize(reminderPlugin: ReminderPlugin): void {
    this.reminderPlugin = reminderPlugin;
    logger.info('TaskReminderBridge initialized');
  }
  
  /**
   * Check if bridge is ready
   */
  isReady(): boolean {
    return this.reminderPlugin !== null && this.options.enabled;
  }
  
  /**
   * Sync task to reminder system
   * Creates or updates reminder based on task dates
   */
  async syncTask(task: Task): Promise<void> {
    if (!this.isReady()) {
      logger.debug('TaskReminderBridge not ready, skipping sync for task', task.id);
      return;
    }
    
    try {
      // Determine which date to use for reminder
      const reminderDate = this.getReminderDate(task);
      
      if (!reminderDate) {
        // No valid date - remove reminder if exists
        await this.removeTaskReminder(task.id);
        return;
      }
      
      // Check if reminder already exists
      const existingReminderId = this.taskReminderMap.get(task.id);
      
      if (existingReminderId) {
        // Update existing reminder
        await this.updateReminder(existingReminderId, task, reminderDate);
      } else if (this.options.autoCreateReminders) {
        // Create new reminder
        await this.createReminder(task, reminderDate);
      }
      
      logger.debug('Task reminder synced', { taskId: task.id, reminderDate });
    } catch (error) {
      logger.error('Failed to sync task reminder', { taskId: task.id, error });
      // Non-fatal - don't throw
    }
  }
  
  /**
   * Remove reminder for deleted task
   */
  async removeTaskReminder(taskId: string): Promise<void> {
    if (!this.isReady()) {
      return;
    }
    
    try {
      const reminderId = this.taskReminderMap.get(taskId);
      
      if (reminderId && this.reminderPlugin) {
        // Remove from ReminderPlugin
        const reminders = this.reminderPlugin.reminders;
        reminders.removeReminder(reminderId);
        
        // Remove from map
        this.taskReminderMap.delete(taskId);
        
        logger.debug('Task reminder removed', { taskId, reminderId });
      }
    } catch (error) {
      logger.error('Failed to remove task reminder', { taskId, error });
    }
  }
  
  /**
   * Get reminder date from task
   * Priority: dueAt > scheduledAt > startAt
   */
  private getReminderDate(task: Task): Date | null {
    if (task.dueAt) {
      const date = new Date(task.dueAt);
      // Apply offset
      date.setMinutes(date.getMinutes() + this.options.defaultReminderOffset);
      return date;
    }
    
    if (task.scheduledAt) {
      const date = new Date(task.scheduledAt);
      date.setMinutes(date.getMinutes() + this.options.defaultReminderOffset);
      return date;
    }
    
    if (task.startAt) {
      return new Date(task.startAt);
    }
    
    return null;
  }
  
  /**
   * Create new reminder for task
   */
  private async createReminder(task: Task, reminderDate: Date): Promise<void> {
    if (!this.reminderPlugin) return;
    
    const reminders = this.reminderPlugin.reminders;
    
    // Create reminder object (adapt to ReminderPlugin format)
    const reminder: Partial<Reminder> = {
      title: `📋 ${task.name}`,
      time: reminderDate.getTime(),
      enabled: task.enabled !== false,
      // Store task ID in reminder for reverse lookup
      rowid: `task-${task.id}`,
    };
    
    // Add to ReminderPlugin
    const reminderId = reminders.addReminder(reminder as Reminder);
    
    // Track mapping
    this.taskReminderMap.set(task.id, reminderId);
    
    logger.debug('Created reminder for task', { taskId: task.id, reminderId });
  }
  
  /**
   * Update existing reminder
   */
  private async updateReminder(
    reminderId: string, 
    task: Task, 
    reminderDate: Date
  ): Promise<void> {
    if (!this.reminderPlugin) return;
    
    const reminders = this.reminderPlugin.reminders;
    
    // Update reminder
    const reminder = reminders.getReminder(reminderId);
    if (reminder) {
      reminder.title = `📋 ${task.name}`;
      reminder.time = reminderDate.getTime();
      reminder.enabled = task.enabled !== false;
      
      // Trigger change callback
      reminders.updateReminder(reminder);
      
      logger.debug('Updated reminder for task', { taskId: task.id, reminderId });
    }
  }
  
  /**
   * Sync multiple tasks (batch operation)
   */
  async syncTasks(tasks: Task[]): Promise<void> {
    if (!this.isReady()) {
      return;
    }
    
    logger.info('Batch syncing', tasks.length, 'tasks to reminders');
    
    for (const task of tasks) {
      await this.syncTask(task);
    }
  }
  
  /**
   * Get statistics
   */
  getStats(): { totalMapped: number; enabledReminders: number } {
    let enabledReminders = 0;
    
    if (this.reminderPlugin) {
      const reminders = this.reminderPlugin.reminders;
      for (const reminderId of this.taskReminderMap.values()) {
        const reminder = reminders.getReminder(reminderId);
        if (reminder?.enabled) {
          enabledReminders++;
        }
      }
    }
    
    return {
      totalMapped: this.taskReminderMap.size,
      enabledReminders,
    };
  }
}

/**
 * Singleton instance
 */
let bridgeInstance: TaskReminderBridge | null = null;

/**
 * Get singleton bridge instance
 */
export function getTaskReminderBridge(
  options?: Partial<TaskReminderSyncOptions>
): TaskReminderBridge {
  if (!bridgeInstance) {
    bridgeInstance = new TaskReminderBridge(options);
  }
  return bridgeInstance;
}
