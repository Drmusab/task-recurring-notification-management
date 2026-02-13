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
  version: string;
  
  /** Enable debug logging */
  debugMode: boolean;
  
  /** User's timezone (IANA format, e.g., 'America/New_York') */
  timezone: string;
  
  // ===== Task Display Settings =====
  /** Preferred date format */
  dateFormat: DateFormat;
  
  /** Show relative dates (e.g., "tomorrow", "2 days ago") */
  showRelativeDates: boolean;
  
  /** Show task path in task list */
  showPath: boolean;
  
  /** Show task heading/section */
  showHeading: boolean;
  
  /** Show task description as popover */
  showDescriptionPopover: boolean;
  
  /** Max items to display before virtual scrolling */
  virtualScrollThreshold: number;
  
  // ===== Task Format Settings =====
  /** Preferred task format: emoji or text signifiers */
  preferredFormat: 'emoji' | 'text';
  
  /** Custom status definitions */
  customStatuses: Status[];
  
  /** Default priority for new tasks */
  defaultPriority: 'highest' | 'high' | 'medium' | 'low' | 'lowest' | 'none';
  
  /** Use filename as date for daily notes */
  useFilenameAsDate: boolean;
  
  /** Filename date format regex pattern */
  filenameDatePattern: string;
  
  // ===== Query & Filter Settings =====
  /** Default query for task list */
  defaultQuery: string;
  
  /** Group tasks by field */
  groupBy: GroupByOption;
  
  /** Sort tasks by field */
  sortBy: SortByOption;
  
  /** Sort direction */
  sortDirection: SortDirection;
  
  /** Hide completed tasks by default */
  hideCompleted: boolean;
  
  /** Auto-hide completed tasks after N days */
  autoHideCompletedDays: number;
  
  // ===== Recurrence Settings =====
  /** Calculate next recurrence from completion date instead of due date */
  recurrenceFromCompletion: boolean;
  
  /** Auto-create next task in series on completion */
  autoCreateNextTask: boolean;
  
  /** Keep completed recurring tasks in history */
  keepCompletedRecurring: boolean;
  
  // ===== Dependency Settings =====
  /** Enable dependency graph */
  enableDependencies: boolean;
  
  /** Show dependency warnings */
  showDependencyWarnings: boolean;
  
  /** Auto-hide blocked tasks */
  autoHideBlockedTasks: boolean;
  
  // ===== Notification Settings =====
  /** Enable notifications */
  enableNotifications: boolean;
  
  /** Notification channels */
  notificationChannels: string[];
  
  /** Notification lead time (minutes before due) */
  notificationLeadMinutes: number;
  
  /** Show notification for overdue tasks */
  notifyOverdue: boolean;
  
  // ===== Performance Settings =====
  /** Enable indexing for faster queries */
  enableIndexing: boolean;
  
  /** Enable query caching */
  enableQueryCache: boolean;
  
  /** Query cache TTL (seconds) */
  queryCacheTTL: number;
  
  /** Debounce save delay (milliseconds) */
  saveDebounceDuration: number;
  
  /** Auto-archive completed tasks older than N days */
  autoArchiveDays: number;
  
  // ===== Storage Settings =====
  /** Storage file path */
  storageFilePath: string;
  
  /** Archive directory path */
  archiveDirectoryPath: string;
  
  /** Enable time-partitioned storage */
  enablePartitionedStorage: boolean;
  
  /** Partition by month/year */
  partitionBy: 'month' | 'year';
  
  // ===== Advanced Settings =====
  /** Enable experimental features */
  enableExperimentalFeatures: boolean;
  
  /** Enable AI suggestions */
  enableAISuggestions: boolean;
  
  /** Enable smart recurrence learning */
  enableSmartRecurrence: boolean;
  
  /** Smart recurrence confidence threshold */
  smartRecurrenceConfidence: number;
}

/**
 * Default settings factory
 */
export function getDefaultSettings(): Settings {
  return {
    // General
    version: '2.0.0',
    debugMode: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    
    // Display
    dateFormat: 'YYYY-MM-DD',
    showRelativeDates: true,
    showPath: true,
    showHeading: true,
    showDescriptionPopover: true,
    virtualScrollThreshold: 100,
    
    // Task Format
    preferredFormat: 'emoji',
    customStatuses: [],
    defaultPriority: 'none',
    useFilenameAsDate: true,
    filenameDatePattern: '^(\\d{4})-(\\d{2})-(\\d{2})',
    
    // Query & Filter
    defaultQuery: 'not done',
    groupBy: 'none',
    sortBy: 'due',
    sortDirection: 'asc',
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
    notificationChannels: ['siyuan'],
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
    partitionBy: 'month',
    
    // Advanced
    enableExperimentalFeatures: false,
    enableAISuggestions: false,
    enableSmartRecurrence: false,
    smartRecurrenceConfidence: 0.8,
  };
}

/**
 * Validate settings and fix invalid values
 */
export function validateSettings(settings: Partial<Settings>): Settings {
  const defaults = getDefaultSettings();
  
  return {
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
  };
}
