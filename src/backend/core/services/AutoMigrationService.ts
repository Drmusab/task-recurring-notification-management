/**
 * Auto-Migration Service - Phase 2 automatic migration on edit
 * 
 * This service handles automatic migration of legacy Frequency-based tasks
 * to RRule-based recurrence when tasks are edited.
 */

import type { Task } from '../models/Task';
import type { PluginSettings } from '../settings/PluginSettings';
import { FrequencyConverter } from '../utils/FrequencyConverter';
import { RecurrenceEngine } from '@backend/core/engine/recurrence/RecurrenceEngine';

export interface MigrationResult {
  migrated: boolean;
  originalTask: Task;
  migratedTask?: Task;
  reason?: string;
}

export class AutoMigrationService {
  constructor(private settings: PluginSettings) {}

  /**
   * Check if task should be auto-migrated
   * Phase 2 Logic:
   * - Auto-migrate is enabled in settings
   * - Task has legacy frequency but no recurrence
   * - Task is being edited (not just viewed)
   */
  shouldAutoMigrate(task: Task): boolean {
    if (!this.settings.recurrence.autoMigrateOnEdit) {
      return false;
    }

    return FrequencyConverter.shouldConvert(task as any);
  }

  /**
   * Attempt to auto-migrate a task on edit
   * Returns migration result with the updated task
   * 
   * @param task Task being edited
   * @returns Migration result
   */
  migrateOnEdit(task: Task): MigrationResult {
    // Check if migration should happen
    if (!this.shouldAutoMigrate(task)) {
      return {
        migrated: false,
        originalTask: task,
        reason: 'Auto-migration not enabled or task already has RRule',
      };
    }

    // Attempt conversion
    const migratedTask = FrequencyConverter.updateTaskRecurrence(task as any, true);

    if (!migratedTask) {
      return {
        migrated: false,
        originalTask: task,
        reason: 'Conversion failed',
      };
    }

    // Success
    return {
      migrated: true,
      originalTask: task,
      migratedTask: migratedTask as any,
    };
  }

  /**
   * Batch migrate all tasks in the workspace
   * Used for manual "Migrate All" button in settings
   * 
   * @param tasks All tasks to migrate
   * @param updateCallback Callback to persist each migrated task
   * @returns Migration statistics
   */
  async migrateAll(
    tasks: Task[],
    updateCallback: (task: Task) => Promise<void>
  ): Promise<{
    total: number;
    migrated: number;
    skipped: number;
    failed: number;
    errors: Array<{ taskId: string; error: string }>;
  }> {
    const stats = {
      total: tasks.length,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ taskId: string; error: string }>,
    };

    for (const task of tasks) {
      try {
        // Skip if already has recurrence
        if (task.recurrence) {
          stats.skipped++;
          continue;
        }

        // Skip if no frequency to migrate
        if (!task.frequency) {
          stats.skipped++;
          continue;
        }

        // Convert
        const migrated = FrequencyConverter.updateTaskRecurrence(task as any, true);

        if (!migrated) {
          stats.failed++;
          stats.errors.push({
            taskId: task.id,
            error: 'Conversion returned null',
          });
          continue;
        }

        // Persist
        await updateCallback(migrated as any);
        stats.migrated++;
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          taskId: task.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return stats;
  }

  /**
   * Preview migration for a single task
   * Shows what would happen without making changes
   */
  previewMigration(task: Task): {
    canMigrate: boolean;
    current: string;
    migrated?: string;
    warning?: string;
  } {
    const preview = FrequencyConverter.previewConversion(task as any);
    return {
      canMigrate: preview.canConvert,
      current: preview.current,
      migrated: preview.converted,
      warning: preview.warning,
    };
  }

  /**
   * Get count of tasks that need migration
   */
  getTasksNeedingMigrationCount(tasks: Task[]): number {
    return tasks.filter(task => FrequencyConverter.shouldConvert(task as any)).length;
  }

  /**
   * Get all tasks that need migration
   */
  getTasksNeedingMigration(tasks: Task[]): Task[] {
    return tasks.filter(task => FrequencyConverter.shouldConvert(task as any));
  }
}

/**
 * Helper: Create auto-migration service with settings
 */
export function createAutoMigrationService(settings: PluginSettings): AutoMigrationService {
  return new AutoMigrationService(settings);
}
