/**
 * Domain Layer - Public API
 * 
 * Phase 3: Enhanced with Value Objects and Domain Errors
 * 
 * This is the single entry point for domain imports.
 * All domain entities, value objects, and domain services are exported here.
 * 
 * Usage:
 *   import { Task, TaskIndex, executeQuery, Priority } from '@domain';
 * 
 * DO NOT import directly from domain subfolders outside domain layer.
 * Use this barrel export to maintain API stability.
 */

// ===== Value Objects =====
export type {
  TaskId,
  ISODateString,
  Confidence,
  PositiveInteger,
  NonNegativeInteger,
} from './models/ValueObjects';

export {
  createTaskId,
  generateTaskId,
  isTaskId,
  createISODateString,
  isISODateString,
  now as nowISO,
  Priority,
  Tag,
  createConfidence,
  createPositiveInteger,
  createNonNegativeInteger,
} from './models/ValueObjects';

// ===== Domain Errors =====
export {
  DomainError,
  ValidationError,
  ParseError,
  InvariantError,
  RecurrenceError,
  DependencyError,
  QueryError,
  DomainLogicError,
  isDomainError,
  isValidationError,
  isParseError,
  getErrorMessage,
  formatError,
} from './models/DomainErrors';

// ===== Models =====
export type {
  Task,
  TaskStatus,
  TaskPriority,
  CompletionAction,
  OnCompletionAction,
  CompletionHistoryEntry,
  SmartRecurrence,
} from './models/Task';

export {
  PRIORITY_WEIGHTS,
  createTask,
  normalizePriority,
  isTaskCompleted,
  isTaskOverdue,
  isRecurring,
  isBlocked,
} from './models/Task';

export type {
  Status,
  StatusType,
} from './models/TaskStatus';

export {
  DEFAULT_STATUSES,
  StatusRegistry,
} from './models/TaskStatus';

export type {
  Recurrence,
  RecurrenceResult,
  RecurrenceValidation,
} from './models/Recurrence';

export {
  createRecurrence,
  validateRRule,
} from './models/Recurrence';

export type {
  Frequency,
} from './models/Frequency';

export {
  isValidFrequency,
  frequencyToRRule,
} from './models/Frequency';

// ===== Index =====
export {
  TaskIndex,
} from './index/TaskIndex';

export type {
  IndexStructure,
} from './index/TaskIndex';

// ===== Query =====
export {
  QueryTokenizer,
  QueryParser,
  QueryExecutor,
  executeQuery,
  executeGroupedQuery,
} from './query/AdvancedQuery';

export type {
  TokenType,
  Token,
  QueryNode,
  ComparisonNode,
  LogicalNode,
  NotNode,
  FieldNode,
  ValueNode,
  SortConfig,
  GroupConfig,
  ParsedQuery,
} from './query/AdvancedQuery';

// ===== Query Specifications (Phase 5) =====
export type {
  Specification,
} from './query/Specification';

export {
  BaseSpecification,
  AndSpec,
  OrSpec,
  NotSpec,
  TrueSpec,
  FalseSpec,
  StatusSpec,
  CompletedTaskSpec,
  IncompleteTaskSpec,
  OverdueTaskSpec,
  PrioritySpec,
  PriorityInSpec,
  HasTagSpec,
  HasAnyTagSpec,
  HasAllTagsSpec,
  HasDueDateSpec,
  NoDueDateSpec,
  HasScheduledDateSpec,
  RecurringTaskSpec,
  DueBeforeSpec,
  DueAfterSpec,
  ScheduledBeforeSpec,
  ScheduledAfterSpec,
  NameContainsSpec,
  NameMatchesSpec,
  BlockedTaskSpec,
  BlockingTaskSpec,
  DependsOnSpec,
  PathSpec,
  PathContainsSpec,
  PredicateSpec,
} from './query/Specification';

// ===== Query Builder (Phase 5) =====
export type {
  CompiledQuery,
} from './query/QueryBuilder';

export {
  TaskQueryBuilder,
  query,
  queryWhere,
} from './query/QueryBuilder';

// ===== Common Queries (Phase 5) =====
export {
  CommonQueries,
  incompleteTasks,
  completedTasks,
  overdueTasks,
  todaysTasks,
  scheduledToday,
  urgent,
  highPriority,
  lowPriority,
  recurringTasks,
  unscheduledTasks,
  withTag,
  withAnyTag,
  withAllTags,
  inPath,
  search,
  blockedTasks,
  blockingTasks,
  actionable,
  focus,
  waiting,
  recentlyCompleted,
  dueWithinDays,
  scheduledWithinDays,
} from './query/CommonQueries';

// ============================================================================
// Phase 6: Recurrence Domain Logic
// ============================================================================

// Recurrence Engine - Pure next occurrence calculator
export {
  RecurrenceEngine,
  calculateNextOccurrence,
  getRecurrenceDescription,
} from './recurrence/RecurrenceEngine';

export type {
  NextOccurrenceOptions,
  NextOccurrenceResult,
} from './recurrence/RecurrenceEngine';

// Recurrence Validator - Comprehensive RRule validation
export {
  RecurrenceValidator,
  validateRRule as validateRRuleComprehensive,
  validateRRuleStrict as validateRRuleStrictComprehensive,
} from './recurrence/RecurrenceValidator';

export type {
  RRuleValidationResult,
  ValidationMessage as RRuleValidationMessage,
} from './recurrence/RecurrenceValidator';

// Enhanced Recurrence model helpers
export {
  isRecurrence,
  cloneRecurrence,
  mergeRecurrence,
} from './models/Recurrence';

// ===== Recurrence =====
export {
  parseRecurrenceRule,
  parseRecurrenceRuleStrict,
  serializeRecurrenceRule,
  validateRecurrenceRule,
  validateRecurrenceRuleStrict,
  getRecurrenceExamples,
} from './recurrence/RuleParser';

// ===== Parser =====
export {
  FilenameParser,
  DEFAULT_DATE_PATTERNS,
  parseDateFromFilename,
  requireDateFromFilename,
} from './parser/FilenameParser';

export type {
  DatePattern,
  FilenameParserConfig,
} from './parser/FilenameParser';

// ===== Tags =====
export {
  TagHierarchy,
  extractTags,
  taskHasTag,
  groupTagsByLevel,
  sortTagsHierarchically,
} from './tags/TagHierarchy';

export type {
  TagNode,
} from './tags/TagHierarchy';

// ===== Dependencies =====
export type {
  IDependencyChecker,
} from './dependencies/IDependencyChecker';

export {
  NullDependencyChecker,
} from './dependencies/IDependencyChecker';

// ===== Utils =====
// Phase 9: Date utilities refactored to pure functions only
// For presentation/formatting, use frontend/utils/dateFormatters.ts
export {
  toISODate,
  toISODateTime,
  parseISODate,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  getNextWeekday,
  getNextDayOfMonth,
  isLeapYear,
  getLastDayOfMonth,
  parseNaturalDate,
  compareDates,
  isBefore,
  isAfter,
  isSameDay,
  daysBetween,
  isPastRelativeTo,
  isFutureRelativeTo,
  isTodayRelativeTo,
  getTimezoneOffset,
  startOfDay,
  endOfDay,
} from './utils/DateCalculations';

