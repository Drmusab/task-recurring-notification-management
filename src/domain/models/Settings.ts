/**
 * Plugin Settings Configuration
 * User preferences and customization options
 */

import type { Status } from './TaskStatus';

/**
 * Date display format options
 */
export type DateFormat = 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'relative';

/**
 * Task grouping options
 */
export type GroupByOption = 'none' | 'status' | 'priority' | 'due' | 'path' | 'heading' | 'tags';

/**
 * Sort field options
 */
export type SortByOption = 'due' | 'priority' | 'created' | 'updated' | 'status' | 'name' | 'path';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Plugin settings schema
 */
export interface Settings {
  // ===== General Settings =====
  /** Plugin version for migrations */
  readonly version: string;
  
  /** Enable debug logging */
  readonly debugMode: boolean;
  
  /** User's timezone (IANA format, e.g., 'America/New_York') */
  readonly timezone: string;
  
  // ===== Task Display Settings =====
  /** Preferred date format */
  readonly dateFormat: DateFormat;
  
  /** Show relative dates (e.g., "tomorrow", "2 days ago") */
  readonly showRelativeDates: boolean;
  
  /** Show task path in task list */
  readonly showPath: boolean;
  
  /** Show task heading/section */
  readonly showHeading: boolean;
  
  /** Show task description as popover */
  readonly showDescriptionPopover: boolean;
  
  /** Max items to display before virtual scrolling */
  readonly virtualScrollThreshold: number;
  
  // ===== Task Format Settings =====
  /** Preferred task format: emoji or text signifiers */
  readonly preferredFormat: 'emoji' | 'text';
  
  /** Custom status definitions */
  readonly customStatuses: readonly Status[];
  
  /** Default priority for new tasks */
  readonly defaultPriority: 'highest' | 'high' | 'medium' | 'low' | 'lowest' | 'none';
  
  /** Use filename as date for daily notes */
  readonly useFilenameAsDate: boolean;
  
  /** Filename date format regex pattern */
  readonly filenameDatePattern: string;
  
  // ===== Query & Filter Settings =====
  /** Default query for task list */
  readonly defaultQuery: string;
  
  /** Group tasks by field */
  readonly groupBy: GroupByOption;
  
  /** Sort tasks by field */
  readonly sortBy: SortByOption;
  
  /** Sort direction */
  readonly sortDirection: SortDirection;
  
  /** Hide completed tasks by default */
  readonly hideCompleted: boolean;
  
  /** Auto-hide completed tasks after N days */
  readonly autoHideCompletedDays: number;
  
  // ===== Recurrence Settings =====
  /** Calculate next recurrence from completion date instead of due date */
  readonly recurrenceFromCompletion: boolean;
  
  /** Auto-create next task in series on completion */
  readonly autoCreateNextTask: boolean;
  
  /** Keep completed recurring tasks in history */
  readonly keepCompletedRecurring: boolean;
  
  // ===== Dependency Settings =====
  /** Enable dependency graph */
  readonly enableDependencies: boolean;
  
  /** Show dependency warnings */
  readonly showDependencyWarnings: boolean;
  
  /** Auto-hide blocked tasks */
  readonly autoHideBlockedTasks: boolean;
  
  // ===== Notification Settings =====
  /** Enable notifications */
  readonly enableNotifications: boolean;
  
  /** Notification channels */
  readonly notificationChannels: readonly string[];
  
  /** Notification lead time (minutes before due) */
  readonly notificationLeadMinutes: number;
  
  /** Show notification for overdue tasks */
  readonly notifyOverdue: boolean;
  
  // ===== Performance Settings =====
  /** Enable indexing for faster queries */
  readonly enableIndexing: boolean;
  
  /** Enable query caching */
  readonly enableQueryCache: boolean;
  
  /** Query cache TTL (seconds) */
  readonly queryCacheTTL: number;
  
  /** Debounce save delay (milliseconds) */
  readonly saveDebounceDuration: number;
  
  /** Auto-archive completed tasks older than N days */
  readonly autoArchiveDays: number;
  
  // ===== Storage Settings =====
  /** Storage file path */
  readonly storageFilePath: string;
  
  /** Archive directory path */
  readonly archiveDirectoryPath: string;
  
  /** Enable time-partitioned storage */
  readonly enablePartitionedStorage: boolean;
  
  /** Partition by month/year */
  readonly partitionBy: 'month' | 'year';
  
  // ===== Advanced Settings =====
  /** Enable experimental features */
  readonly enableExperimentalFeatures: boolean;
  
  /** Enable AI suggestions */
  readonly enableAISuggestions: boolean;
  
  /** Enable smart recurrence learning */
  readonly enableSmartRecurrence: boolean;
  
  /** Smart recurrence confidence threshold */
  readonly smartRecurrenceConfidence: number;
}

/**
 * Default settings factory
 */
export function getDefaultSettings(): Settings {
  return Object.freeze({
    // General
    version: '2.0.0',
    debugMode: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    
    // Display
    dateFormat: 'YYYY-MM-DD' as DateFormat,
    showRelativeDates: true,
    showPath: true,
    showHeading: true,
    showDescriptionPopover: true,
    virtualScrollThreshold: 100,
    
    // Task Format
    preferredFormat: 'emoji' as const,
    customStatuses: Object.freeze([] as Status[]),
    defaultPriority: 'none' as const,
    useFilenameAsDate: true,
    filenameDatePattern: '^(\\d{4})-(\\d{2})-(\\d{2})',
    
    // Query & Filter
    defaultQuery: 'not done',
    groupBy: 'none' as GroupByOption,
    sortBy: 'due' as SortByOption,
    sortDirection: 'asc' as SortDirection,
    hideCompleted: false,
    autoHideCompletedDays: 30,
    
    // Recurrence
    recurrenceFromCompletion: false,
    autoCreateNextTask: true,
    keepCompletedRecurring: true,
    
    // Dependencies
    enableDependencies: true,
    showDependencyWarnings: true,
    autoHideBlockedTasks: false,
    
    // Notifications
    enableNotifications: true,
    notificationChannels: Object.freeze(['siyuan'] as string[]),
    notificationLeadMinutes: 15,
    notifyOverdue: true,
    
    // Performance
    enableIndexing: true,
    enableQueryCache: true,
    queryCacheTTL: 60,
    saveDebounceDuration: 1000,
    autoArchiveDays: 90,
    
    // Storage
    storageFilePath: 'data/tasks.json',
    archiveDirectoryPath: 'data/archives',
    enablePartitionedStorage: true,
    partitionBy: 'month' as const,
    
    // Advanced
    enableExperimentalFeatures: false,
    enableAISuggestions: false,
    enableSmartRecurrence: false,
    smartRecurrenceConfidence: 0.8,
  });
}

/**
 * Validate settings and fix invalid values
 */
export function validateSettings(settings: Partial<Settings>): Settings {
  const defaults = getDefaultSettings();
  
  return Object.freeze({
    ...defaults,
    ...settings,
    // Ensure valid ranges
    virtualScrollThreshold: Math.max(10, settings.virtualScrollThreshold || defaults.virtualScrollThreshold),
    autoHideCompletedDays: Math.max(0, settings.autoHideCompletedDays || defaults.autoHideCompletedDays),
    notificationLeadMinutes: Math.max(0, settings.notificationLeadMinutes || defaults.notificationLeadMinutes),
    queryCacheTTL: Math.max(0, settings.queryCacheTTL || defaults.queryCacheTTL),
    saveDebounceDuration: Math.max(0, settings.saveDebounceDuration || defaults.saveDebounceDuration),
    autoArchiveDays: Math.max(0, settings.autoArchiveDays || defaults.autoArchiveDays),
    smartRecurrenceConfidence: Math.max(0, Math.min(1, settings.smartRecurrenceConfidence || defaults.smartRecurrenceConfidence)),
  });
}
