/**
 * Settings - Central configuration module for the task management plugin
 * 
 * This file provides:
 * - TASK_FORMATS: Task serialization formats (emoji-based symbols)
 * - getSettings/updateSettings: Settings state management
 * - getUserSelectedTaskFormat: Get the current task format
 */

import type { Task } from "@backend/core/models/Task";
import { EMOJI_SIGNIFIERS } from "@backend/utils/task/signifiers";
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
 * Parsed task information from deserialization.
 * Date fields are ISO 8601 strings (matching the Task interface),
 * or null when not present in the serialized text.
 */
export interface TaskInfo {
  description: string;
  priority: string;
  startDate: string | null;
  scheduledDate: string | null;
  dueDate: string | null;
  createdDate: string | null;
  doneDate: string | null;
  cancelledDate: string | null;
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
   * Serialize a task to its string representation.
   *
   * Maps the canonical Task field names (dueAt, scheduledAt, etc.)
   * to the emoji-signifier format.
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

    // Add recurrence (use humanReadable string, not toText())
    if (task.recurrence) {
      parts.push(`${this.symbols.recurrenceSymbol} ${task.recurrence.humanReadable || task.recurrence.rrule}`);
    }

    // Add dates (Task uses ISO string fields, not Moment)
    if (task.startAt) {
      parts.push(`${this.symbols.startDateSymbol} ${this.formatISODate(task.startAt)}`);
    }
    if (task.scheduledAt) {
      parts.push(`${this.symbols.scheduledDateSymbol} ${this.formatISODate(task.scheduledAt)}`);
    }
    if (task.dueAt) {
      parts.push(`${this.symbols.dueDateSymbol} ${this.formatISODate(task.dueAt)}`);
    }
    if (task.createdAt) {
      parts.push(`${this.symbols.createdDateSymbol} ${this.formatISODate(task.createdAt)}`);
    }
    if (task.status === 'done' && task.lastCompletedAt) {
      parts.push(`${this.symbols.doneDateSymbol} ${this.formatISODate(task.lastCompletedAt)}`);
    }
    if (task.status === 'cancelled' && task.updatedAt) {
      parts.push(`${this.symbols.cancelledDateSymbol} ${this.formatISODate(task.updatedAt)}`);
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
   * Convert a task component to its string representation.
   * Maps canonical Task fields to emoji-signifier display strings.
   */
  componentToString(task: Task, shortMode: boolean, component: string): string {
    switch (component) {
      case 'description':
        return task.description ?? '';
      case 'priority':
        return this.getPrioritySymbol(task.priority) || '';
      case 'recurrence':
        return task.recurrence 
          ? `${this.symbols.recurrenceSymbol} ${task.recurrence.humanReadable || task.recurrence.rrule}`
          : '';
      case 'startDate':
        return task.startAt 
          ? `${this.symbols.startDateSymbol} ${this.formatISODate(task.startAt)}`
          : '';
      case 'scheduledDate':
        return task.scheduledAt
          ? `${this.symbols.scheduledDateSymbol} ${this.formatISODate(task.scheduledAt)}`
          : '';
      case 'dueDate':
        return task.dueAt 
          ? `${this.symbols.dueDateSymbol} ${this.formatISODate(task.dueAt)}`
          : '';
      case 'createdDate':
        return task.createdAt
          ? `${this.symbols.createdDateSymbol} ${this.formatISODate(task.createdAt)}`
          : '';
      case 'doneDate':
        return (task.status === 'done' && task.lastCompletedAt)
          ? `${this.symbols.doneDateSymbol} ${this.formatISODate(task.lastCompletedAt)}`
          : '';
      case 'cancelledDate':
        return (task.status === 'cancelled' && task.updatedAt)
          ? `${this.symbols.cancelledDateSymbol} ${this.formatISODate(task.updatedAt)}`
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

  private formatISODate(isoString: string): string {
    // Extract YYYY-MM-DD from an ISO 8601 string
    return isoString.slice(0, 10);
  }

  private extractAndRemove(body: string, info: TaskInfo): string {
    let description = body;
    const datePattern = '(\\d{4}-\\d{2}-\\d{2})';

    // Extract dates and capture values
    const dateFields: Array<{
      symbol: string;
      field: 'startDate' | 'scheduledDate' | 'dueDate' | 'createdDate' | 'doneDate' | 'cancelledDate';
    }> = [
      { symbol: this.symbols.startDateSymbol, field: 'startDate' },
      { symbol: this.symbols.scheduledDateSymbol, field: 'scheduledDate' },
      { symbol: this.symbols.dueDateSymbol, field: 'dueDate' },
      { symbol: this.symbols.createdDateSymbol, field: 'createdDate' },
      { symbol: this.symbols.doneDateSymbol, field: 'doneDate' },
      { symbol: this.symbols.cancelledDateSymbol, field: 'cancelledDate' },
    ];

    for (const { symbol, field } of dateFields) {
      const regex = new RegExp(`${this.escapeRegex(symbol)}\\s*${datePattern}`, 'g');
      const match = regex.exec(body);
      if (match?.[1]) {
        info[field] = match[1]; // ISO date string YYYY-MM-DD
      }
      description = description.replace(regex, '');
    }

    // Extract recurrence rule
    const recurrenceRegex = new RegExp(
      `${this.escapeRegex(this.symbols.recurrenceSymbol)}\\s*([^📅⏳🛫➕✅❌🔁🏁🆔⛔🔺⏫🔼🔽⏬]+)`,
      'g',
    );
    const recurrenceMatch = recurrenceRegex.exec(body);
    if (recurrenceMatch?.[1]) {
      info.recurrenceRule = recurrenceMatch[1].trim();
    }
    description = description.replace(recurrenceRegex, '');

    // Extract ID
    const idRegex = new RegExp(`${this.escapeRegex(this.symbols.idSymbol)}\\s*(\\S+)`, 'g');
    const idMatch = idRegex.exec(body);
    if (idMatch?.[1]) {
      info.id = idMatch[1];
    }
    description = description.replace(idRegex, '');

    // Extract dependencies
    const depsRegex = new RegExp(`${this.escapeRegex(this.symbols.dependsOnSymbol)}\\s*(\\S+)`, 'g');
    const depsMatch = depsRegex.exec(body);
    if (depsMatch?.[1]) {
      info.dependsOn = depsMatch[1].split(',').filter(Boolean);
    }
    description = description.replace(depsRegex, '');

    // Remove priority symbols
    for (const [name, symbol] of Object.entries(this.symbols.prioritySymbols)) {
      if (symbol && description.includes(symbol)) {
        info.priority = name.toLowerCase();
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
let currentSettings: Readonly<Settings> = Object.freeze({ ...DEFAULT_SETTINGS });

/**
 * Get current plugin settings (immutable snapshot).
 * Returns a frozen object — callers cannot mutate plugin state.
 * @returns Frozen settings object
 */
export function getSettings(): Readonly<Settings> {
  return currentSettings;
}

/**
 * Update plugin settings.
 * Creates a new frozen settings object — previous references remain unchanged.
 * @param newSettings - Partial settings to merge with current settings
 */
export function updateSettings(newSettings: Partial<Settings> | null | undefined): void {
  if (newSettings) {
    currentSettings = Object.freeze({
      ...currentSettings,
      ...newSettings,
      isShownInEditModal: Object.freeze({
        ...currentSettings.isShownInEditModal,
        ...(newSettings.isShownInEditModal || {}),
      }),
      statusSettings: Object.freeze({
        ...currentSettings.statusSettings,
        ...(newSettings.statusSettings || {}),
      }),
      loggingOptions: Object.freeze({
        ...currentSettings.loggingOptions,
        ...(newSettings.loggingOptions || {}),
      }),
    });
  }
}

/**
 * Reset settings to defaults (useful for testing)
 */
export function resetSettings(): void {
  currentSettings = Object.freeze({ ...DEFAULT_SETTINGS });
}

/**
 * Get the user's selected task format
 * @returns The task format configuration including serializer
 */
export function getUserSelectedTaskFormat(): TaskFormat {
  const format = currentSettings.taskFormat;
  return TASK_FORMATS[format] || TASK_FORMATS.tasksPluginEmoji;
}
