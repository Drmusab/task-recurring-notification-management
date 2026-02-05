/**
 * Data schema migration manager
 */

import type { Plugin } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import { CURRENT_SCHEMA_VERSION } from "@shared/constants/misc-constants";
import * as logger from "@backend/logging/logger";
import { migrateAllTasksToRRule } from "@backend/core/storage/migrations/RRuleMigration";

export interface MigrationResult {
  migrated: boolean;
  tasksAffected: number;
  fromVersion?: number;
  toVersion: number;
  backupKey?: string;
}

export class MigrationManager {
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    return CURRENT_SCHEMA_VERSION;
  }

  /**
   * Create a backup before migration
   */
  async createBackup(storageKey: string, version?: number): Promise<string> {
    try {
      const data = await this.plugin.loadData(storageKey);
      if (data) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const versionStr = version !== undefined ? `v${version}` : 'unknown';
        const backupKey = `${storageKey}-backup-${versionStr}-${timestamp}`;
        await this.plugin.saveData(backupKey, data);
        logger.info(`Created backup: ${backupKey}`);
        return backupKey;
      }
      throw new Error("No data to backup");
    } catch (err) {
      logger.error("Failed to create backup", err);
      throw err;
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(storageKey: string): Promise<MigrationResult> {
    try {
      const data = await this.plugin.loadData(storageKey);
      if (!data) {
        logger.info("No data to migrate");
        return {
          migrated: false,
          tasksAffected: 0,
          toVersion: CURRENT_SCHEMA_VERSION,
        };
      }

      const tasks: Task[] = Array.isArray(data) ? data : Array.isArray(data.tasks) ? data.tasks : [];
      if (tasks.length === 0) {
        logger.info("No data to migrate");
        return {
          migrated: false,
          tasksAffected: 0,
          toVersion: CURRENT_SCHEMA_VERSION,
        };
      }

      let migrated = false;
      let backupKey: string | undefined;
      let fromVersion: number | undefined;
      let tasksAffected = 0;

      // First, run standard version migrations
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const originalVersion = task.version || 0;
        
        if (originalVersion < CURRENT_SCHEMA_VERSION) {
          // Create backup before first migration
          if (!migrated) {
            fromVersion = originalVersion;
            backupKey = await this.createBackup(storageKey, originalVersion);
            migrated = true;
          }

          tasks[i] = this.migrateTask(task, originalVersion);
          tasksAffected++;
          logger.info(`Migrated task ${task.id} from v${originalVersion} to v${CURRENT_SCHEMA_VERSION}`);
        }
      }

      // Run RRULE migration (v5+) - this is idempotent
      const rruleMigrationResult = await migrateAllTasksToRRule(tasks);
      if (rruleMigrationResult.migrated > 0) {
        if (!migrated) {
          // Create backup if RRULE migration is the first change
          fromVersion = 4; // Assume we're migrating from v4 to v5
          backupKey = await this.createBackup(storageKey, fromVersion);
          migrated = true;
        }
        tasksAffected += rruleMigrationResult.migrated;
        // Update tasks array with migrated tasks
        for (let i = 0; i < rruleMigrationResult.migratedTasks.length; i++) {
          tasks[i] = rruleMigrationResult.migratedTasks[i];
        }
      }

      if (migrated) {
        const payload = Array.isArray(data) ? tasks : { ...data, tasks };
        await this.plugin.saveData(storageKey, payload);
        logger.info(`Migration complete: ${tasksAffected} tasks migrated`);
        
        return {
          migrated: true,
          tasksAffected,
          fromVersion,
          toVersion: CURRENT_SCHEMA_VERSION,
          backupKey,
        };
      } else {
        logger.info("No migration needed - all tasks up to date");
        return {
          migrated: false,
          tasksAffected: 0,
          toVersion: CURRENT_SCHEMA_VERSION,
        };
      }
    } catch (err) {
      logger.error("Migration failed", err);
      throw err;
    }
  }

  /**
   * Migrate a single task through all versions
   */
  private migrateTask(task: Task, fromVersion: number): Task {
    let migrated = { ...task };

    // v0 -> v1: Add version field
    if (fromVersion < 1) {
      migrated.version = 1;
    }

    // v1 -> v2: Add timezone, analytics, priority, tags, notification settings
    if (fromVersion < 2) {
      migrated = {
        ...migrated,
        version: 2,
        timezone: migrated.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        completionCount: migrated.completionCount || 0,
        missCount: migrated.missCount || 0,
        currentStreak: migrated.currentStreak || 0,
        bestStreak: migrated.bestStreak || 0,
        recentCompletions: migrated.recentCompletions || [],
        priority: migrated.priority || "normal",
        tags: migrated.tags || [],
        notificationChannels: migrated.notificationChannels || [],
        snoozeCount: migrated.snoozeCount || 0,
        maxSnoozes: migrated.maxSnoozes || 3,
      };
    }

    // v2 -> v3: Add escalation policy, linked block content, category, description
    if (fromVersion < 3) {
      migrated = {
        ...migrated,
        version: 3,
        escalationPolicy: migrated.escalationPolicy || {
          enabled: false,
          levels: [],
        },
        linkedBlockContent: migrated.linkedBlockContent || undefined,
        category: migrated.category || undefined,
        description: migrated.description || undefined,
      };
    }

    // v3 -> v4: Add onCompletion field for recurring tasks
    if (fromVersion < 4) {
      migrated = {
        ...migrated,
        version: 4,
        onCompletion: (migrated as any).onCompletion || 'keep',
        dependsOn: (migrated as any).dependsOn || [],
        blockedBy: (migrated as any).blockedBy || [],
      };
    }

    // v4 -> v5: Migrate to RRULE format
    if (fromVersion < 5) {
      // Note: Actual RRULE migration is handled separately by RRuleMigration
      // This just updates the version number
      migrated = {
        ...migrated,
        version: 5,
      };
    }

    return migrated;
  }
}
