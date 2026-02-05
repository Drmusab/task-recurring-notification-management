import type { Task } from '@backend/core/models/Task';

/**
 * Configuration for filename-based date extraction
 */
export interface FilenameDateConfig {
  /** Enable filename date extraction */
  enabled: boolean;
  
  /** Date format patterns to try (e.g., 'YYYY-MM-DD', 'YYYYMMDD') */
  patterns: string[];
  
  /** Only apply to files in these folder paths */
  folders: string[];
  
  /** Which date field to set */
  targetField: 'scheduled' | 'due' | 'start';
}

/**
 * Extract dates from daily note filenames and apply to tasks
 */
export class FilenameDateExtractor {
  // Cache extracted dates for performance
  private dateCache: Map<string, Date | null> = new Map();

  /**
   * Extract date from filename using configured patterns
   * @param filepath Full file path
   * @param config Configuration
   * @returns Extracted date or null if no match
   */
  extractDate(filepath: string, config: FilenameDateConfig): Date | null {
    if (!config.enabled) {
      return null;
    }

    // Check cache first
    if (this.dateCache.has(filepath)) {
      return this.dateCache.get(filepath) || null;
    }

    // Extract filename from path
    const filename = filepath.split('/').pop() || filepath;
    const filenameWithoutExt = filename.replace(/\.[^.]+$/, '');

    // Try each pattern
    for (const pattern of config.patterns) {
      const date = this.tryExtractDate(filenameWithoutExt, pattern);
      if (date) {
        this.dateCache.set(filepath, date);
        return date;
      }
    }

    // Cache null result
    this.dateCache.set(filepath, null);
    return null;
  }

  /**
   * Try to extract date using a specific pattern
   */
  private tryExtractDate(filename: string, pattern: string): Date | null {
    let regex: RegExp;
    let dateBuilder: (match: RegExpMatchArray) => Date | null;

    switch (pattern) {
      case 'YYYY-MM-DD':
        regex = /(\d{4})-(\d{2})-(\d{2})/;
        dateBuilder = (match) => {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10);
          const day = parseInt(match[3], 10);
          return this.createValidDate(year, month, day);
        };
        break;

      case 'YYYYMMDD':
        regex = /(\d{4})(\d{2})(\d{2})/;
        dateBuilder = (match) => {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10);
          const day = parseInt(match[3], 10);
          return this.createValidDate(year, month, day);
        };
        break;

      case 'DD-MM-YYYY':
        regex = /(\d{2})-(\d{2})-(\d{4})/;
        dateBuilder = (match) => {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10);
          const year = parseInt(match[3], 10);
          return this.createValidDate(year, month, day);
        };
        break;

      case 'MM-DD-YYYY':
        regex = /(\d{2})-(\d{2})-(\d{4})/;
        dateBuilder = (match) => {
          const month = parseInt(match[1], 10);
          const day = parseInt(match[2], 10);
          const year = parseInt(match[3], 10);
          return this.createValidDate(year, month, day);
        };
        break;

      case 'YYYY.MM.DD':
        regex = /(\d{4})\.(\d{2})\.(\d{2})/;
        dateBuilder = (match) => {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10);
          const day = parseInt(match[3], 10);
          return this.createValidDate(year, month, day);
        };
        break;

      case 'DD.MM.YYYY':
        regex = /(\d{2})\.(\d{2})\.(\d{4})/;
        dateBuilder = (match) => {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10);
          const year = parseInt(match[3], 10);
          return this.createValidDate(year, month, day);
        };
        break;

      default:
        return null;
    }

    const match = filename.match(regex);
    if (match) {
      return dateBuilder(match);
    }

    return null;
  }

  /**
   * Create a valid date object, return null if invalid
   */
  private createValidDate(year: number, month: number, day: number): Date | null {
    // Validate ranges
    if (year < 1900 || year > 2100) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day); // month is 0-indexed in Date
    
    // Check if date is valid (e.g., Feb 30 would roll over)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  /**
   * Check if file is in scope for filename date extraction
   * @param filepath Full file path
   * @param folders Configured folder patterns
   * @returns true if file matches folder scope
   */
  isInScope(filepath: string, folders: string[]): boolean {
    if (folders.length === 0) {
      // Empty folders array means apply to all files
      return true;
    }

    // Normalize path separators
    const normalizedPath = filepath.replace(/\\/g, '/');

    // Check if path includes any of the folder patterns
    for (const folder of folders) {
      const normalizedFolder = folder.replace(/\\/g, '/');
      if (normalizedPath.includes(normalizedFolder)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Apply filename date to task if task has no existing date in target field
   * @param task Task to modify
   * @param filepath File containing the task
   * @param config Configuration
   * @returns Modified task (or original if no date extracted)
   */
  applyFilenameDate(task: Task, filepath: string, config: FilenameDateConfig): Task {
    if (!config.enabled) {
      return task;
    }

    // Check if file is in scope
    if (!this.isInScope(filepath, config.folders)) {
      return task;
    }

    // Check if target field already has a date
    const targetField = this.getTargetField(task, config.targetField);
    if (targetField) {
      // Don't override existing date
      return task;
    }

    // Extract date from filename
    const date = this.extractDate(filepath, config);
    if (!date) {
      return task;
    }

    // Apply date to target field
    const updatedTask = { ...task };
    const isoDate = date.toISOString();

    switch (config.targetField) {
      case 'scheduled':
        updatedTask.scheduledAt = isoDate;
        break;
      case 'due':
        updatedTask.dueAt = isoDate;
        break;
      case 'start':
        updatedTask.startAt = isoDate;
        break;
    }

    return updatedTask;
  }

  /**
   * Get the current value of target field
   */
  private getTargetField(task: Task, targetField: 'scheduled' | 'due' | 'start'): string | undefined {
    switch (targetField) {
      case 'scheduled':
        return task.scheduledAt;
      case 'due':
        return task.dueAt;
      case 'start':
        return task.startAt;
    }
  }

  /**
   * Clear the date cache (useful for testing)
   */
  clearCache(): void {
    this.dateCache.clear();
  }
}
