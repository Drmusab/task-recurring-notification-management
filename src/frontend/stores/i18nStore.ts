/**
 * Internationalization Store
 * 
 * Provides reactive access to translations for Svelte components.
 * Also provides locale-sensitive formatting for dates, times, and numbers.
 */

import { writable, derived, get } from 'svelte/store';

// ============================================================================
// Types
// ============================================================================

export interface I18nMessages {
  // Plugin-level
  pluginName?: string;
  pluginLoaded?: string;
  pluginLoadFailed?: string;
  initializationError?: string;

  // Navigation & UI
  dockTitle?: string;
  settings?: string;
  close?: string;
  apply?: string;
  cancel?: string;
  save?: string;
  delete?: string;
  edit?: string;
  add?: string;
  remove?: string;
  enable?: string;
  disable?: string;
  enabled?: string;
  disabled?: string;
  ok?: string;
  confirm?: string;
  dismiss?: string;
  loading?: string;
  error?: string;
  success?: string;
  warning?: string;
  info?: string;

  // Task CRUD
  task?: TaskI18n;
  tasks?: TasksI18n;

  // Forms & Inputs
  forms?: FormsI18n;

  // Priority
  priority?: PriorityI18n;

  // Status
  status?: StatusI18n;

  // Recurrence
  recurrence?: RecurrenceI18n;

  // Dates
  dates?: DatesI18n;

  // Analytics & Dashboard
  analytics?: AnalyticsI18n;

  // AI Suggestions
  ai?: AII18n;

  // Block Actions
  blockActions?: BlockActionsI18n;

  // Notifications
  notifications?: NotificationsI18n;

  // Reminders
  reminders?: RemindersI18n;

  // Calendar
  calendar?: CalendarI18n;

  // Validation
  validation?: ValidationI18n;

  // Empty States
  empty?: EmptyStatesI18n;

  // Errors
  errors?: ErrorsI18n;

  // Commands
  commands?: CommandsI18n;

  // Webhooks
  webhooks?: WebhooksI18n;

  // Tags & Categories
  tags?: TagsI18n;

  // Dependencies
  dependencies?: DependenciesI18n;

  // Allow additional keys
  [key: string]: any;
}

export interface TaskI18n {
  name?: string;
  description?: string;
  dueAt?: string;
  dueDate?: string;
  startDate?: string;
  scheduledDate?: string;
  createdDate?: string;
  completedDate?: string;
  cancelledDate?: string;
  frequency?: string;
  status?: string;
  priority?: string;
  enabled?: string;
  disabled?: string;
  lastCompleted?: string;
  nextDue?: string;
  edit?: string;
  delete?: string;
  confirmDelete?: string;
  placeholder?: string;
}

export interface TasksI18n {
  noTasks?: string;
  createNew?: string;
  createFirst?: string;
  showList?: string;
  overview?: string;
  total?: string;
  active?: string;
  overdue?: string;
  dueToday?: string;
  dueThisWeek?: string;
  upcoming?: string;
}

export interface FormsI18n {
  required?: string;
  optional?: string;
  placeholder?: string;
  selectOption?: string;
  enterValue?: string;
  search?: string;
  filter?: string;
  sort?: string;
  clear?: string;
  reset?: string;
}

export interface PriorityI18n {
  label?: string;
  highest?: string;
  high?: string;
  medium?: string;
  low?: string;
  lowest?: string;
  none?: string;
}

export interface StatusI18n {
  label?: string;
  todo?: string;
  inProgress?: string;
  done?: string;
  cancelled?: string;
  blocked?: string;
  waiting?: string;
}

export interface RecurrenceI18n {
  label?: string;
  recurs?: string;
  once?: string;
  daily?: string;
  weekly?: string;
  monthly?: string;
  yearly?: string;
  custom?: string;
  every?: string;
  days?: string;
  weeks?: string;
  months?: string;
  years?: string;
  interval?: string;
  preview?: string;
  nextOccurrences?: string;
  noMoreOccurrences?: string;
  placeholder?: string;
  whenDone?: string;
  onWeekdays?: string;
  onDay?: string;
  triggerNext?: string;
  pause?: string;
}

export interface DatesI18n {
  today?: string;
  tomorrow?: string;
  yesterday?: string;
  thisWeek?: string;
  nextWeek?: string;
  thisMonth?: string;
  nextMonth?: string;
  noDate?: string;
  selectDate?: string;
  selectTime?: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  scheduledDate?: string;
  createdDate?: string;
  completedDate?: string;
  cancelledDate?: string;
  invalidDate?: string;
  dateFormat?: string;
  timeFormat?: string;
}

export interface AnalyticsI18n {
  title?: string;
  trackerAndAnalytics?: string;
  completionRate?: string;
  missRate?: string;
  currentStreak?: string;
  bestStreak?: string;
  avgHealthScore?: string;
  taskOverview?: string;
  totalTasks?: string;
  activeTasks?: string;
  disabledTasks?: string;
  overdueTasks?: string;
  healthDistribution?: string;
  healthy?: string;
  moderate?: string;
  struggling?: string;
  completions?: string;
  misses?: string;
  staleData?: string;
  calculating?: string;
  recalculate?: string;
}

export interface AII18n {
  title?: string;
  suggestions?: string;
  noSuggestions?: string;
  analyzeAll?: string;
  analyzing?: string;
  apply?: string;
  dismiss?: string;
  approve?: string;
  reject?: string;
  confidence?: string;
  impact?: string;
  reason?: string;
  noHistoryWarning?: string;

  // Features
  features?: {
    abandonment?: {
      name?: string;
      description?: string;
      suggestion?: string;
    };
    reschedule?: {
      name?: string;
      description?: string;
      suggestion?: string;
    };
    urgency?: {
      name?: string;
      description?: string;
      suggestion?: string;
    };
    frequency?: {
      name?: string;
      description?: string;
      suggestion?: string;
    };
    consolidation?: {
      name?: string;
      description?: string;
      suggestion?: string;
    };
    delegation?: {
      name?: string;
      description?: string;
      suggestion?: string;
    };
  };
}

export interface BlockActionsI18n {
  title?: string;
  addAction?: string;
  removeAction?: string;
  enableAction?: string;
  disableAction?: string;
  noActions?: string;

  // Triggers
  triggers?: {
    label?: string;
    when?: string;
    blockCompleted?: string;
    blockDeleted?: string;
    blockEmpty?: string;
    blockMoved?: string;
    blockCollapsed?: string;
    blockExpanded?: string;
    contentMatches?: string;
    contentNotMatches?: string;
    contentHasTag?: string;
    contentHasKeyword?: string;
  };

  // Actions
  actions?: {
    label?: string;
    then?: string;
    setStatus?: string;
    triggerNextRecurrence?: string;
    pauseRecurrence?: string;
    changePriority?: string;
    addTag?: string;
    removeTag?: string;
    addCompletionNote?: string;
    sendWebhook?: string;
    notify?: string;
  };

  // Placeholders
  placeholders?: {
    regex?: string;
    tagName?: string;
    keyword?: string;
    note?: string;
    webhookUrl?: string;
    message?: string;
  };
}

export interface NotificationsI18n {
  title?: string;
  settings?: string;
  n8n?: string;
  telegram?: string;
  gmail?: string;
  webhookUrl?: string;
  botToken?: string;
  chatId?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  recipientEmail?: string;
  testSuccess?: string;
  testFailed?: string;
  send?: string;
  test?: string;
}

export interface RemindersI18n {
  title?: string;
  noReminders?: string;
  snooze?: string;
  done?: string;
  dismiss?: string;
  later?: string;
  in5Min?: string;
  in15Min?: string;
  in30Min?: string;
  in1Hour?: string;
  tomorrow?: string;
  nextWeek?: string;
  selectDateTime?: string;
}

export interface CalendarI18n {
  title?: string;
  showCalendar?: string;
  today?: string;
  week?: string;
  month?: string;
  year?: string;
  previous?: string;
  next?: string;
  tasksFor?: string;
  noTasksOnDate?: string;
  weekdays?: {
    sunday?: string;
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
  };
  weekdaysShort?: {
    sun?: string;
    mon?: string;
    tue?: string;
    wed?: string;
    thu?: string;
    fri?: string;
    sat?: string;
  };
  months?: {
    january?: string;
    february?: string;
    march?: string;
    april?: string;
    may?: string;
    june?: string;
    july?: string;
    august?: string;
    september?: string;
    october?: string;
    november?: string;
    december?: string;
  };
  monthsShort?: {
    jan?: string;
    feb?: string;
    mar?: string;
    apr?: string;
    may?: string;
    jun?: string;
    jul?: string;
    aug?: string;
    sep?: string;
    oct?: string;
    nov?: string;
    dec?: string;
  };
}

export interface ValidationI18n {
  required?: string;
  invalid?: string;
  tooShort?: string;
  tooLong?: string;
  invalidDate?: string;
  invalidTime?: string;
  invalidEmail?: string;
  invalidUrl?: string;
  invalidNumber?: string;
  invalidPattern?: string;
  startBeforeEnd?: string;
  circularDependency?: string;
  duplicateValue?: string;
}

export interface EmptyStatesI18n {
  noTasks?: string;
  noReminders?: string;
  noSuggestions?: string;
  noResults?: string;
  noData?: string;
  createFirst?: string;
}

export interface ErrorsI18n {
  generic?: string;
  networkError?: string;
  saveFailed?: string;
  loadFailed?: string;
  deleteFailed?: string;
  updateFailed?: string;
  notFound?: string;
  unauthorized?: string;
  forbidden?: string;
  timeout?: string;
  conflict?: string;
  validationFailed?: string;
  modalError?: string;
  analysisError?: string;
}

export interface CommandsI18n {
  createTask?: string;
  showTaskList?: string;
  toggleTaskStatus?: string;
  showAISuggestions?: string;
  showCalendar?: string;
  insertTask?: string;
  taskCreated?: string;
  taskUpdated?: string;
  taskDeleted?: string;
  taskToggled?: string;
  taskInserted?: string;
  suggestionApplied?: string;
}

export interface WebhooksI18n {
  title?: string;
  url?: string;
  secret?: string;
  events?: string;
  test?: string;
  testSuccess?: string;
  testFailed?: string;
  retry?: string;
  retrying?: string;
  delivered?: string;
  failed?: string;
  pending?: string;
}

export interface TagsI18n {
  title?: string;
  label?: string;
  addTag?: string;
  removeTag?: string;
  noTags?: string;
  placeholder?: string;
  category?: string;
  categories?: string;
}

export interface DependenciesI18n {
  title?: string;
  blockedBy?: string;
  blocking?: string;
  addDependency?: string;
  removeDependency?: string;
  noDependencies?: string;
  circularWarning?: string;
  selectTask?: string;
  disabledWarning?: string;
}

export interface I18nLocale {
  code: string;
  name: string;
  messages: I18nMessages;
}

export interface I18nConfig {
  locale: string;
  fallbackLocale: string;
  messages: I18nMessages;
  dateFormat: Intl.DateTimeFormatOptions;
  timeFormat: Intl.DateTimeFormatOptions;
  numberFormat: Intl.NumberFormatOptions;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const DEFAULT_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

const DEFAULT_NUMBER_FORMAT: Intl.NumberFormatOptions = {
  style: 'decimal',
  maximumFractionDigits: 2,
};

const DEFAULT_CONFIG: I18nConfig = {
  locale: 'en-US',
  fallbackLocale: 'en-US',
  messages: {},
  dateFormat: DEFAULT_DATE_FORMAT,
  timeFormat: DEFAULT_TIME_FORMAT,
  numberFormat: DEFAULT_NUMBER_FORMAT,
};

// ============================================================================
// Store Implementation
// ============================================================================

function createI18nStore() {
  const { subscribe, set, update } = writable<I18nConfig>(DEFAULT_CONFIG);

  return {
    subscribe,
    
    /**
     * Initialize the store with messages from plugin i18n
     */
    init(messages: I18nMessages, locale?: string) {
      update(config => ({
        ...config,
        messages,
        locale: locale || config.locale,
      }));
    },

    /**
     * Set the current locale
     */
    setLocale(locale: string) {
      update(config => ({
        ...config,
        locale,
      }));
    },

    /**
     * Update messages (merge with existing)
     */
    setMessages(messages: I18nMessages) {
      update(config => ({
        ...config,
        messages: { ...config.messages, ...messages },
      }));
    },

    /**
     * Set date format options
     */
    setDateFormat(format: Intl.DateTimeFormatOptions) {
      update(config => ({
        ...config,
        dateFormat: format,
      }));
    },

    /**
     * Set time format options
     */
    setTimeFormat(format: Intl.DateTimeFormatOptions) {
      update(config => ({
        ...config,
        timeFormat: format,
      }));
    },

    /**
     * Set number format options
     */
    setNumberFormat(format: Intl.NumberFormatOptions) {
      update(config => ({
        ...config,
        numberFormat: format,
      }));
    },

    /**
     * Reset to defaults
     */
    reset() {
      set(DEFAULT_CONFIG);
    },
  };
}

export const i18nStore = createI18nStore();

// ============================================================================
// Derived Stores
// ============================================================================

/**
 * Current messages derived store
 */
export const messages = derived(i18nStore, $i18n => $i18n.messages);

/**
 * Current locale derived store
 */
export const locale = derived(i18nStore, $i18n => $i18n.locale);

// ============================================================================
// Translation Function
// ============================================================================

/**
 * Get a translation by key path (dot notation)
 * Falls back to the key itself if not found
 * 
 * Usage in components:
 *   import { t } from '@stores/i18nStore';
 *   const label = $t('task.name');
 *   const formatted = $t('messages.taskCreated', { name: 'My Task' });
 */
export const t = derived(i18nStore, ($i18n) => {
  return (key: string, params?: Record<string, any>): string => {
    const keys = key.split('.');
    let value: any = $i18n.messages;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Key not found, return the key itself as fallback
        return key;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Handle parameter interpolation: {paramName}
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return params[paramKey] !== undefined ? String(params[paramKey]) : `{${paramKey}}`;
      });
    }

    return value;
  };
});

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format a date according to locale settings
 */
export const formatDate = derived(i18nStore, ($i18n) => {
  return (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const format = options || $i18n.dateFormat;
    return new Intl.DateTimeFormat($i18n.locale, format).format(d);
  };
});

/**
 * Format a time according to locale settings
 */
export const formatTime = derived(i18nStore, ($i18n) => {
  return (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const format = options || $i18n.timeFormat;
    return new Intl.DateTimeFormat($i18n.locale, format).format(d);
  };
});

/**
 * Format a date and time according to locale settings
 */
export const formatDateTime = derived(i18nStore, ($i18n) => {
  return (date: Date | string | number, dateOptions?: Intl.DateTimeFormatOptions, timeOptions?: Intl.DateTimeFormatOptions): string => {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const dateFormat = dateOptions || $i18n.dateFormat;
    const timeFormat = timeOptions || $i18n.timeFormat;
    
    const datePart = new Intl.DateTimeFormat($i18n.locale, dateFormat).format(d);
    const timePart = new Intl.DateTimeFormat($i18n.locale, timeFormat).format(d);
    
    return `${datePart} ${timePart}`;
  };
});

/**
 * Format a number according to locale settings
 */
export const formatNumber = derived(i18nStore, ($i18n) => {
  return (num: number, options?: Intl.NumberFormatOptions): string => {
    const format = options || $i18n.numberFormat;
    return new Intl.NumberFormat($i18n.locale, format).format(num);
  };
});

/**
 * Format a percentage
 */
export const formatPercent = derived(i18nStore, ($i18n) => {
  return (num: number, decimals: number = 0): string => {
    return new Intl.NumberFormat($i18n.locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num / 100);
  };
});

/**
 * Get relative time string (e.g., "2 days ago", "in 3 hours")
 */
export const formatRelativeTime = derived(i18nStore, ($i18n) => {
  return (date: Date | string | number): string => {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);
    const diffWeek = Math.round(diffDay / 7);
    const diffMonth = Math.round(diffDay / 30);
    const diffYear = Math.round(diffDay / 365);

    const rtf = new Intl.RelativeTimeFormat($i18n.locale, { numeric: 'auto' });

    if (Math.abs(diffYear) >= 1) {
      return rtf.format(diffYear, 'year');
    } else if (Math.abs(diffMonth) >= 1) {
      return rtf.format(diffMonth, 'month');
    } else if (Math.abs(diffWeek) >= 1) {
      return rtf.format(diffWeek, 'week');
    } else if (Math.abs(diffDay) >= 1) {
      return rtf.format(diffDay, 'day');
    } else if (Math.abs(diffHour) >= 1) {
      return rtf.format(diffHour, 'hour');
    } else if (Math.abs(diffMin) >= 1) {
      return rtf.format(diffMin, 'minute');
    } else {
      return rtf.format(diffSec, 'second');
    }
  };
});

// ============================================================================
// Helper Functions (non-reactive)
// ============================================================================

/**
 * Get current translation (non-reactive, for use outside Svelte components)
 */
export function getTranslation(key: string, params?: Record<string, any>): string {
  const config = get(i18nStore);
  const keys = key.split('.');
  let value: any = config.messages;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
      return params[paramKey] !== undefined ? String(params[paramKey]) : `{${paramKey}}`;
    });
  }

  return value;
}

/**
 * Get current locale (non-reactive)
 */
export function getCurrentLocale(): string {
  return get(i18nStore).locale;
}

/**
 * Check if a translation key exists
 */
export function hasTranslation(key: string): boolean {
  const config = get(i18nStore);
  const keys = key.split('.');
  let value: any = config.messages;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return false;
    }
  }

  return typeof value === 'string';
}
