/**
 * Backend Utilities — Runtime-Pure Function Layer
 *
 * This barrel exports two categories:
 *
 * 1. Legacy task utilities (markdown/Obsidian-compat, pre-existing)
 *    - snooze, task-templates, on-completion, occurrence, link, priority,
 *      signifiers, task-regular-expressions, log-tasks-helper
 *
 * 2. NEW: Runtime-deterministic pure functions (Session 21)
 *    - dateUtils        — UTC-anchored date normalization
 *    - recurrenceUtils  — Instance-based recurrence comparison
 *    - taskIdUtils      — Deterministic task ID generation
 *    - comparisonUtils  — Immutable model comparison + deepClone
 *    - debounceUtils    — Backend-safe debounce/throttle
 *    - serializationUtils — Schema-safe pre-save validation
 *    - timezoneUtils    — Pure timezone conversion
 *    - guardUtils       — Type/value guards for runtime safety
 *
 * FORBIDDEN: Frontend components MUST NOT import from this barrel.
 */

// ─── Legacy Task Utilities (pre-existing) ─────────────────────
export * from '@backend/utils/task/snooze';
export * from '@backend/utils/task/task-templates';
export * from '@backend/utils/task/on-completion';
export * from '@backend/utils/task/occurrence';
export * from '@backend/utils/task/link';
export * from '@backend/utils/task/priority';
export * from '@backend/utils/task/signifiers';
export * from '@backend/utils/task/task-regular-expressions';

// ─── Legacy Lib Utilities ─────────────────────────────────────
export * from '@backend/utils/lib/log-tasks-helper';

// ─── Runtime-Deterministic Pure Functions (Session 21) ────────
export * from './dateUtils';
export * from './recurrenceUtils';
export * from './taskIdUtils';
export * from './comparisonUtils';
export * from './debounceUtils';
export * from './serializationUtils';
export * from './timezoneUtils';
export * from './guardUtils';
