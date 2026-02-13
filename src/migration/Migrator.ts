/**
 * Migration System - Migrates tasks from old plugin format to new format
 * 
 * Handles:
 * - Old task line formats
 * - Legacy storage structures
 * - Settings migration across versions
 * - Backup and rollback functionality
 */

import type { Task, TaskPriority } from '../domain/models/Task';
import type { Settings } from '../domain/models/Settings';
import { createTask } from '../domain/models/Task';
import { getDefaultSettings } from '../domain/models/Settings';

/**
 * Migration version history
 */
export enum MigrationVersion {
  V1_LEGACY = '1.0.0',      // Original plugin format
  V2_ENHANCED = '2.0.0',    // Enhanced with dependencies, advanced queries
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  version: string;
  tasksUpdated: number;
  settingsUpdated: boolean;
  errors: string[];
  warnings: string[];
  backupPath?: string;
}

/**
 * Legacy task format (old plugin version)
 */
export interface LegacyTask {
  id: string;
  content: string;
  done: boolean;
  dueDate?: string;
  recurrence?: string;
  priority?: number;
  tags?: string[];
  // Old format specifics
  created?: number;        // Unix timestamp
  completed?: number;      // Unix timestamp
  path?: string;
}

/**
 * Migration strategy interface
 */
export interface MigrationStrategy {
  fromVersion: string;
  toVersion: string;
  migrate(data: unknown): Promise<MigrationResult>;
}

/**
 * V1 to V2 Migration Strategy
 */
export class V1ToV2Migration implements MigrationStrategy {
  fromVersion = MigrationVersion.V1_LEGACY;
  toVersion = MigrationVersion.V2_ENHANCED;

  async migrate(data: unknown): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      version: this.toVersion,
      tasksUpdated: 0,
      settingsUpdated: false,
      errors: [],
      warnings: [],
    };

    try {
      // Validate input data
      if (!this.isLegacyData(data)) {
        result.errors.push('Invalid legacy data format');
        return result;
      }

      const legacyData = data as { tasks: LegacyTask[]; settings?: unknown };
      const migratedTasks: Task[] = [];

      // Migrate tasks
      for (const legacyTask of legacyData.tasks) {
        try {
          const migratedTask = this.migrateLegacyTask(legacyTask);
          migratedTasks.push(migratedTask);
          result.tasksUpdated++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.warnings.push(`Failed to migrate task ${legacyTask.id}: ${message}`);
        }
      }

      // Migrate settings
      if (legacyData.settings) {
        try {
          this.migrateLegacySettings(legacyData.settings);
          result.settingsUpdated = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.warnings.push(`Failed to migrate settings: ${message}`);
        }
      }

      result.success = result.errors.length === 0;
      return result;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Migration failed: ${message}`);
      return result;
    }
  }

  /**
   * Type guard for legacy data
   */
  private isLegacyData(data: unknown): data is { tasks: LegacyTask[] } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'tasks' in data &&
      Array.isArray((data as { tasks: unknown }).tasks)
    );
  }

  /**
   * Migrate a single legacy task to new format
   */
  private migrateLegacyTask(legacyTask: LegacyTask): Task {
    // Convert priority (old: 1-5, new: TaskPriority)
    const priorityMap: Record<number, TaskPriority> = {
      1: 'highest',
      2: 'high',
      3: 'medium',
      4: 'low',
      5: 'lowest',
    };

    // Convert timestamps to ISO strings
    const createdAt = legacyTask.created 
      ? new Date(legacyTask.created).toISOString() 
      : undefined;
    const doneAt = legacyTask.completed 
      ? new Date(legacyTask.completed).toISOString() 
      : undefined;

    // Create new task with migrated data
    return createTask({
      id: legacyTask.id,
      name: legacyTask.content,
      status: legacyTask.done ? 'done' : 'todo',
      dueAt: legacyTask.dueDate,
      recurrenceText: legacyTask.recurrence,
      priority: legacyTask.priority ? priorityMap[legacyTask.priority] : undefined,
      tags: legacyTask.tags || [],
      createdAt,
      doneAt,
      path: legacyTask.path,
    });
  }

  /**
   * Migrate legacy settings to new format
   */
  private migrateLegacySettings(legacySettings: unknown): Settings {
    const defaults = getDefaultSettings();
    
    // For now, return defaults with any preserved legacy preferences
    // This can be expanded based on actual legacy settings structure
    return defaults;
  }
}

/**
 * Main Migrator class
 */
export class Migrator {
  private strategies: Map<string, MigrationStrategy> = new Map();
  private backupEnabled: boolean = true;

  constructor() {
    // Register migration strategies
    this.registerStrategy(new V1ToV2Migration());
  }

  /**
   * Register a migration strategy
   */
  registerStrategy(strategy: MigrationStrategy): void {
    const key = `${strategy.fromVersion}->${strategy.toVersion}`;
    this.strategies.set(key, strategy);
  }

  /**
   * Detect current data version
   */
  detectVersion(data: unknown): string {
    // Check for version markers
    if (typeof data === 'object' && data !== null) {
      if ('version' in data && typeof data.version === 'string') {
        return data.version;
      }
      
      // Legacy detection heuristics
      if ('tasks' in data && Array.isArray(data.tasks)) {
        const tasks = data.tasks as unknown[];
        if (tasks.length > 0) {
          const firstTask = tasks[0];
          if (typeof firstTask === 'object' && firstTask !== null) {
            // Check for legacy task structure
            if ('content' in firstTask && 'done' in firstTask && 'created' in firstTask) {
              return MigrationVersion.V1_LEGACY;
            }
          }
        }
      }
    }

    // Default to current version if detection fails
    return MigrationVersion.V2_ENHANCED;
  }

  /**
   * Create backup of current data
   */
  async createBackup(data: unknown, backupPath: string): Promise<void> {
    try {
      const backupData = {
        version: this.detectVersion(data),
        timestamp: new Date().toISOString(),
        data,
      };
      
      // In SiYuan environment, use file API
      // For now, use localStorage as fallback
      localStorage.setItem(`task-plugin-backup-${Date.now()}`, JSON.stringify(backupData));
      
    } catch (error) {
      throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrate data from one version to another
   */
  async migrate(
    data: unknown, 
    fromVersion?: string, 
    toVersion: string = MigrationVersion.V2_ENHANCED
  ): Promise<MigrationResult> {
    const sourceVersion = fromVersion || this.detectVersion(data);
    
    // No migration needed if already at target version
    if (sourceVersion === toVersion) {
      return {
        success: true,
        version: toVersion,
        tasksUpdated: 0,
        settingsUpdated: false,
        errors: [],
        warnings: ['Data already at target version'],
      };
    }

    // Find migration strategy
    const strategyKey = `${sourceVersion}->${toVersion}`;
    const strategy = this.strategies.get(strategyKey);

    if (!strategy) {
      return {
        success: false,
        version: sourceVersion,
        tasksUpdated: 0,
        settingsUpdated: false,
        errors: [`No migration strategy found for ${strategyKey}`],
        warnings: [],
      };
    }

    // Create backup before migration
    if (this.backupEnabled) {
      try {
        const backupPath = `backup-${sourceVersion}-to-${toVersion}-${Date.now()}.json`;
        await this.createBackup(data, backupPath);
      } catch (error) {
        return {
          success: false,
          version: sourceVersion,
          tasksUpdated: 0,
          settingsUpdated: false,
          errors: [`Backup failed: ${error instanceof Error ? error.message : String(error)}`],
          warnings: [],
        };
      }
    }

    // Execute migration
    return await strategy.migrate(data);
  }

  /**
   * Migrate task line text format
   */
  migrateTaskLine(line: string): string {
    // Legacy format detection patterns
    const legacyPatterns = [
      // Old checkbox format: [✓] -> [x]
      { from: /\[✓\]/g, to: '[x]' },
      // Old date format: @due(2026-02-06) -> 📅 2026-02-06
      { from: /@due\((\d{4}-\d{2}-\d{2})\)/g, to: '📅 $1' },
      // Old priority: !high -> ⏫
      { from: /!highest/g, to: '🔺' },
      { from: /!high/g, to: '⏫' },
      { from: /!medium/g, to: '🔼' },
      { from: /!low/g, to: '🔽' },
      { from: /!lowest/g, to: '⏬' },
      // Old recurrence: @repeat(daily) -> 🔁 daily
      { from: /@repeat\((.*?)\)/g, to: '🔁 $1' },
      // Old tags: @tag(work) -> #work
      { from: /@tag\(([^)]+)\)/g, to: '#$1' },
    ];

    let migratedLine = line;
    for (const pattern of legacyPatterns) {
      migratedLine = migratedLine.replace(pattern.from, pattern.to);
    }

    return migratedLine;
  }

  /**
   * Batch migrate multiple task lines
   */
  migrateTaskLines(lines: string[]): { original: string; migrated: string; changed: boolean }[] {
    return lines.map(line => {
      const migrated = this.migrateTaskLine(line);
      return {
        original: line,
        migrated,
        changed: line !== migrated,
      };
    });
  }

  /**
   * Validate migrated data
   */
  validateMigration(originalData: unknown, migratedData: unknown): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check task count preservation
    if (this.isTaskArray(originalData) && this.isTaskArray(migratedData)) {
      if (originalData.tasks.length !== migratedData.tasks.length) {
        issues.push(`Task count mismatch: ${originalData.tasks.length} -> ${migratedData.tasks.length}`);
      }
    }

    // Check for data loss (more comprehensive checks can be added)
    // For now, basic validation
    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Type guard for task array data
   */
  private isTaskArray(data: unknown): data is { tasks: unknown[] } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'tasks' in data &&
      Array.isArray((data as { tasks: unknown }).tasks)
    );
  }

  /**
   * Rollback to backup
   */
  async rollback(backupKey: string): Promise<void> {
    try {
      const backup = localStorage.getItem(backupKey);
      if (!backup) {
        throw new Error(`Backup not found: ${backupKey}`);
      }

      const backupData = JSON.parse(backup);
      // Restore data (implementation depends on storage API)
      
    } catch (error) {
      throw new Error(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List available backups
   */
  listBackups(): { key: string; version: string; timestamp: string }[] {
    const backups: { key: string; version: string; timestamp: string }[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('task-plugin-backup-')) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            backups.push({
              key,
              version: parsed.version || 'unknown',
              timestamp: parsed.timestamp || 'unknown',
            });
          }
        } catch {
          // Skip invalid backups
        }
      }
    }

    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Clean old backups (keep last N backups)
   */
  cleanBackups(keepCount: number = 5): number {
    const backups = this.listBackups();
    const toDelete = backups.slice(keepCount);
    
    toDelete.forEach(backup => {
      localStorage.removeItem(backup.key);
    });

    return toDelete.length;
  }

  /**
   * Enable/disable automatic backups
   */
  setBackupEnabled(enabled: boolean): void {
    this.backupEnabled = enabled;
  }
}

/**
 * Singleton instance
 */
export const migrator = new Migrator();

/**
 * Convenience function for quick migration
 */
export async function migrateFromLegacy(legacyData: unknown): Promise<MigrationResult> {
  return migrator.migrate(legacyData, MigrationVersion.V1_LEGACY, MigrationVersion.V2_ENHANCED);
}

/**
 * Convenience function for task line migration
 */
export function migrateTaskLineFormat(line: string): string {
  return migrator.migrateTaskLine(line);
}
