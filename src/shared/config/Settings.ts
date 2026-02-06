// @ts-nocheck
/**
 * Settings - Central configuration module for the task management plugin
 * 
 * This file provides:
 * - TASK_FORMATS: Task serialization formats (emoji-based symbols)
 * - getSettings/updateSettings: Settings state management
 * - getUserSelectedTaskFormat: Get the current task format
 */

import type { Task } from "@backend/core/models/Task";
import { EMOJI_SIGNIFIERS } from "@shared/utils/task/signifiers";
import type { EditModalShowSettings } from "@shared/config/EditModalShowSettings";
import { defaultEditModalShowSettings } from "@shared/config/EditModalShowSettings";

// ============================================================================
// Task Serializer Types
// ============================================================================

/**
 * Priority symbols for different priority levels
 */
export interface PrioritySymbols {
  Highest: string;
  High: string;
  Medium: string;
  None: string;
  Low: string;
  Lowest: string;
}

/**
 * All task field symbols used for serialization
 */
export interface TaskSymbols {
  startDateSymbol: string;
  scheduledDateSymbol: string;
  dueDateSymbol: string;
  createdDateSymbol: string;
  doneDateSymbol: string;
  cancelledDateSymbol: string;
  recurrenceSymbol: string;
  onCompletionSymbol: string;
  idSymbol: string;
  dependsOnSymbol: string;
  prioritySymbols: PrioritySymbols;
}

/**
 * Task serializer interface for converting tasks to/from string format
 */
export interface TaskSerializer {
  /** Symbols used for task field markers */
  symbols: TaskSymbols;
  
  /** Serialize a task to string format */
  serialize(task: Task): string;
  
  /** Deserialize task body string to task info */
  deserialize(body: string): TaskInfo;
  
  /** Convert a task component to string for display */
  componentToString(task: Task, shortMode: boolean, component: string): string;
}

/**
 * Parsed task information from deserialization
 */
export interface TaskInfo {
  description: string;
  priority: string;
  startDate: moment.Moment | null;
  scheduledDate: moment.Moment | null;
  dueDate: moment.Moment | null;
  createdDate: moment.Moment | null;
  doneDate: moment.Moment | null;
  cancelledDate: moment.Moment | null;
  recurrenceRule: string;
  tags: string[];
  id: string;
  dependsOn: string[];
  onCompletion: string;
}

/**
 * Task format definition with serializer
 */
export interface TaskFormat {
  taskSerializer: TaskSerializer;
}

// ============================================================================
// Default Emoji Symbols
// ============================================================================

const DEFAULT_PRIORITY_SYMBOLS: PrioritySymbols = {
  Highest: EMOJI_SIGNIFIERS.priority.highest,
  High: EMOJI_SIGNIFIERS.priority.high,
  Medium: EMOJI_SIGNIFIERS.priority.medium,
  None: '', // Normal priority has no symbol
  Low: EMOJI_SIGNIFIERS.priority.low,
  Lowest: EMOJI_SIGNIFIERS.priority.lowest,
};

const DEFAULT_TASK_SYMBOLS: TaskSymbols = {
  startDateSymbol: EMOJI_SIGNIFIERS.start,
  scheduledDateSymbol: EMOJI_SIGNIFIERS.scheduled,
  dueDateSymbol: EMOJI_SIGNIFIERS.due,
  createdDateSymbol: EMOJI_SIGNIFIERS.created,
  doneDateSymbol: EMOJI_SIGNIFIERS.done,
  cancelledDateSymbol: EMOJI_SIGNIFIERS.cancelled,
  recurrenceSymbol: EMOJI_SIGNIFIERS.recurrence,
  onCompletionSymbol: EMOJI_SIGNIFIERS.onCompletion,
  idSymbol: EMOJI_SIGNIFIERS.id,
  dependsOnSymbol: EMOJI_SIGNIFIERS.dependsOn,
  prioritySymbols: DEFAULT_PRIORITY_SYMBOLS,
};

// ============================================================================
// Default Task Serializer Implementation
// ============================================================================

/**
 * Default task serializer using emoji-based format
 */
class DefaultTaskSerializer implements TaskSerializer {
  public readonly symbols: TaskSymbols = DEFAULT_TASK_SYMBOLS;

  /**
   * Serialize a task to its string representation
   */
  serialize(task: Task): string {
    const parts: string[] = [];
    
    // Description is always first
    if (task.description) {
      parts.push(task.description);
    }

    // Add priority symbol
    const prioritySymbol = this.getPrioritySymbol(task.priority);
    if (prioritySymbol) {
      parts.push(prioritySymbol);
    }

    // Add recurrence
    if (task.recurrence) {
      parts.push(`${this.symbols.recurrenceSymbol} ${task.recurrence.toText()}`);
    }

    // Add dates
    if (task.startDate) {
      parts.push(`${this.symbols.startDateSymbol} ${this.formatDate(task.startDate)}`);
    }
    if (task.scheduledDate && !task.scheduledDateIsInferred) {
      parts.push(`${this.symbols.scheduledDateSymbol} ${this.formatDate(task.scheduledDate)}`);
    }
    if (task.dueDate) {
      parts.push(`${this.symbols.dueDateSymbol} ${this.formatDate(task.dueDate)}`);
    }
    if (task.createdDate) {
      parts.push(`${this.symbols.createdDateSymbol} ${this.formatDate(task.createdDate)}`);
    }
    if (task.doneDate) {
      parts.push(`${this.symbols.doneDateSymbol} ${this.formatDate(task.doneDate)}`);
    }
    if (task.cancelledDate) {
      parts.push(`${this.symbols.cancelledDateSymbol} ${this.formatDate(task.cancelledDate)}`);
    }

    // Add ID if present
    if (task.id) {
      parts.push(`${this.symbols.idSymbol} ${task.id}`);
    }

    // Add dependencies
    if (task.dependsOn && task.dependsOn.length > 0) {
      parts.push(`${this.symbols.dependsOnSymbol} ${task.dependsOn.join(',')}`);
    }

    return parts.join(' ');
  }

  /**
   * Deserialize a task body string into task info
   */
  deserialize(body: string): TaskInfo {
    const info: TaskInfo = {
      description: body,
      priority: 'none',
      startDate: null,
      scheduledDate: null,
      dueDate: null,
      createdDate: null,
      doneDate: null,
      cancelledDate: null,
      recurrenceRule: '',
      tags: [],
      id: '',
      dependsOn: [],
      onCompletion: '',
    };

    // Extract tags
    const tagRegex = /#[\w-]+/g;
    const tags = body.match(tagRegex);
    if (tags) {
      info.tags = tags;
    }

    // Extract dates using symbols
    info.description = this.extractAndRemove(body, info);

    return info;
  }

  /**
   * Convert a task component to its string representation
   */
  componentToString(task: Task, shortMode: boolean, component: string): string {
    switch (component) {
      case 'description':
        return task.description;
      case 'priority':
        return this.getPrioritySymbol(task.priority) || '';
      case 'recurrence':
        return task.recurrence 
          ? `${this.symbols.recurrenceSymbol} ${task.recurrence.toText()}`
          : '';
      case 'startDate':
        return task.startDate 
          ? `${this.symbols.startDateSymbol} ${this.formatDate(task.startDate)}`
          : '';
      case 'scheduledDate':
        return task.scheduledDate && !task.scheduledDateIsInferred
          ? `${this.symbols.scheduledDateSymbol} ${this.formatDate(task.scheduledDate)}`
          : '';
      case 'dueDate':
        return task.dueDate 
          ? `${this.symbols.dueDateSymbol} ${this.formatDate(task.dueDate)}`
          : '';
      case 'createdDate':
        return task.createdDate
          ? `${this.symbols.createdDateSymbol} ${this.formatDate(task.createdDate)}`
          : '';
      case 'doneDate':
        return task.doneDate
          ? `${this.symbols.doneDateSymbol} ${this.formatDate(task.doneDate)}`
          : '';
      case 'cancelledDate':
        return task.cancelledDate
          ? `${this.symbols.cancelledDateSymbol} ${this.formatDate(task.cancelledDate)}`
          : '';
      default:
        return '';
    }
  }

  private getPrioritySymbol(priority: string | { name?: string } | null | undefined): string {
    if (!priority) return '';
    
    const priorityName = typeof priority === 'string' 
      ? priority 
      : priority.name || '';
    
    const normalizedPriority = priorityName.charAt(0).toUpperCase() + priorityName.slice(1).toLowerCase();
    
    return this.symbols.prioritySymbols[normalizedPriority as keyof PrioritySymbols] || '';
  }

  private formatDate(date: moment.Moment): string {
    return date.format('YYYY-MM-DD');
  }

  private extractAndRemove(body: string, info: TaskInfo): string {
    let description = body;

    // This is a simplified extraction - real implementation would be more complex
    // Remove date patterns, priority symbols, etc. from description
    
    // Remove emoji signifiers and their associated values
    const patterns = [
      new RegExp(`${this.escapeRegex(this.symbols.startDateSymbol)}\\s*\\d{4}-\\d{2}-\\d{2}`, 'g'),
      new RegExp(`${this.escapeRegex(this.symbols.scheduledDateSymbol)}\\s*\\d{4}-\\d{2}-\\d{2}`, 'g'),
      new RegExp(`${this.escapeRegex(this.symbols.dueDateSymbol)}\\s*\\d{4}-\\d{2}-\\d{2}`, 'g'),
      new RegExp(`${this.escapeRegex(this.symbols.createdDateSymbol)}\\s*\\d{4}-\\d{2}-\\d{2}`, 'g'),
      new RegExp(`${this.escapeRegex(this.symbols.doneDateSymbol)}\\s*\\d{4}-\\d{2}-\\d{2}`, 'g'),
      new RegExp(`${this.escapeRegex(this.symbols.cancelledDateSymbol)}\\s*\\d{4}-\\d{2}-\\d{2}`, 'g'),
      new RegExp(`${this.escapeRegex(this.symbols.recurrenceSymbol)}\\s*[^📅⏳🛫➕✅❌🔁🏁🆔⛔🔺⏫🔼🔽⏬]+`, 'g'),
    ];

    for (const pattern of patterns) {
      description = description.replace(pattern, '');
    }

    // Remove priority symbols
    for (const symbol of Object.values(this.symbols.prioritySymbols)) {
      if (symbol) {
        description = description.replace(new RegExp(this.escapeRegex(symbol), 'g'), '');
      }
    }

    return description.trim();
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ============================================================================
// Task Formats Registry
// ============================================================================

/**
 * Available task formats
 */
export const TASK_FORMATS = {
  /**
   * Tasks plugin emoji format - uses emoji symbols for task fields
   */
  tasksPluginEmoji: {
    taskSerializer: new DefaultTaskSerializer(),
  } as TaskFormat,
} as const;

// ============================================================================
// Settings State Management
// ============================================================================

/**
 * Complete settings interface for the plugin
 */
export interface Settings {
  // Task format
  taskFormat: 'tasksPluginEmoji';
  
  // Date settings
  useFilenameAsScheduledDate: boolean;
  filenameAsDateFolders: string[];
  filenameAsScheduledDateFormat: string;
  removeScheduledDateOnRecurrence: boolean;
  
  // UI settings
  provideAccessKeys: boolean;
  isShownInEditModal: Partial<EditModalShowSettings>;
  
  // Global filter
  globalFilter: string;
  removeGlobalFilter: boolean;
  
  // Global query
  globalQuery: string;
  
  // Status settings
  statusSettings: StatusSettingsConfig;
  
  // Logging
  loggingOptions: LoggingOptions;
  
  // Recurrence settings
  recurrenceOnNextLine: boolean;
  
  // Date tracking
  setCreatedDate: boolean;
  setDoneDate: boolean;
  setCancelledDate: boolean;
  
  // Auto-suggest
  autoSuggestInEditor: boolean;
  autoSuggestMaxItems: number;
  autoSuggestMinMatch: number;
}

export interface StatusSettingsConfig {
  coreStatuses: StatusConfig[];
  customStatuses: StatusConfig[];
}

export interface StatusConfig {
  symbol: string;
  name: string;
  nextStatusSymbol: string;
  availableAsCommand: boolean;
  type: string;
}

export interface LoggingOptions {
  minLevels: Record<string, string>;
}

/**
 * Default settings values
 */
const DEFAULT_SETTINGS: Settings = {
  taskFormat: 'tasksPluginEmoji',
  useFilenameAsScheduledDate: false,
  filenameAsDateFolders: [],
  filenameAsScheduledDateFormat: '',
  removeScheduledDateOnRecurrence: false,
  provideAccessKeys: true,
  isShownInEditModal: {},
  globalFilter: '',
  removeGlobalFilter: false,
  globalQuery: '',
  statusSettings: {
    coreStatuses: [
      { symbol: ' ', name: 'Todo', nextStatusSymbol: 'x', availableAsCommand: true, type: 'TODO' },
      { symbol: 'x', name: 'Done', nextStatusSymbol: ' ', availableAsCommand: true, type: 'DONE' },
    ],
    customStatuses: [],
  },
  loggingOptions: {
    minLevels: {
      '': 'info',
    },
  },
  recurrenceOnNextLine: false,
  setCreatedDate: false,
  setDoneDate: true,
  setCancelledDate: true,
  autoSuggestInEditor: true,
  autoSuggestMaxItems: 6,
  autoSuggestMinMatch: 0,
};

/**
 * Current settings state (module-level singleton)
 */
let currentSettings: Settings = { ...DEFAULT_SETTINGS };

/**
 * Get current plugin settings
 * @returns Current settings object
 */
export function getSettings(): Settings {
  return currentSettings;
}

/**
 * Update plugin settings
 * @param newSettings - Partial settings to merge with current settings
 */
export function updateSettings(newSettings: Partial<Settings> | null | undefined): void {
  if (newSettings) {
    currentSettings = {
      ...currentSettings,
      ...newSettings,
      isShownInEditModal: {
        ...currentSettings.isShownInEditModal,
        ...(newSettings.isShownInEditModal || {}),
      },
      statusSettings: {
        ...currentSettings.statusSettings,
        ...(newSettings.statusSettings || {}),
      },
      loggingOptions: {
        ...currentSettings.loggingOptions,
        ...(newSettings.loggingOptions || {}),
      },
    };
  }
}

/**
 * Reset settings to defaults (useful for testing)
 */
export function resetSettings(): void {
  currentSettings = { ...DEFAULT_SETTINGS };
}

/**
 * Get the user's selected task format
 * @returns The task format configuration including serializer
 */
export function getUserSelectedTaskFormat(): TaskFormat {
  const format = currentSettings.taskFormat;
  return TASK_FORMATS[format] || TASK_FORMATS.tasksPluginEmoji;
}
