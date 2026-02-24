/**
 * Backend Utilities
 * 
 * Backend-specific utilities that depend on backend models, services, or infrastructure.
 * These utilities are NOT meant to be shared with frontend/shared layers.
 * 
 * Architecture Note: These files were moved from shared/utils to enforce
 * proper layer separation. Shared utilities should remain truly generic.
 */

// Task utilities (backend-dependent)
export * from '@backend/utils/task/snooze';
export * from '@backend/utils/task/task-dependency';
export * from '@backend/utils/task/task-templates';
export * from '@backend/utils/task/urgency';
export * from '@backend/utils/task/reorder-tasks';
export * from '@backend/utils/task/on-completion';
export * from '@backend/utils/task/occurrence';
export * from '@backend/utils/task/link';
export * from '@backend/utils/task/priority';
export * from '@backend/utils/task/recurrence';
export * from '@backend/utils/task/list-item';
export * from '@backend/utils/task/task-location';
export * from '@backend/utils/task/signifiers';
export * from '@backend/utils/task/task-regular-expressions';

// DateTime utilities (backend-dependent)
export * from '@backend/utils/dateTime/date-fallback';
export * from '@backend/utils/dateTime/date-field-types';
export * from '@backend/utils/dateTime/postponer';
export * from '@backend/utils/dateTime/tasks-date';

// Search utilities (backend-dependent)
export * from '@backend/utils/search/fuzzy-search';

// Lib utilities (backend-dependent)
export * from '@backend/utils/lib/log-tasks-helper';
