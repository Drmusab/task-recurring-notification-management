/**
 * Query Engine Module
 * 
 * Provides a powerful query language for filtering, sorting, and grouping tasks.
 */

export { QueryEngine, type QueryResult, type TaskQueryIndex } from "@backend/core/query/QueryEngine";
export { QueryParser, type QueryAST, type FilterNode, type SortNode, type GroupNode } from "@backend/core/query/QueryParser";
export { QuerySyntaxError, QueryExecutionError } from "@backend/core/query/QueryError";

// Filters
export { Filter } from "@backend/core/query/filters/FilterBase";
export { 
  StatusTypeFilter, 
  StatusNameFilter, 
  StatusSymbolFilter,
  DoneFilter,
  NotDoneFilter
} from "@backend/core/query/filters/StatusFilter";
export { DateComparisonFilter, HasDateFilter, type DateField, type DateComparator } from "@backend/core/query/filters/DateFilter";
export { PriorityFilter, type Priority, type PriorityLevel } from "@backend/core/query/filters/PriorityFilter";
export { TagIncludesFilter, HasTagsFilter } from "@backend/core/query/filters/TagFilter";
export { PathFilter } from "@backend/core/query/filters/PathFilter";
export { IsBlockedFilter, IsBlockingFilter, type DependencyGraph } from "@backend/core/query/filters/DependencyFilter";
export { RecurrenceFilter } from "@backend/core/query/filters/RecurrenceFilter";
export { AndFilter, OrFilter, NotFilter } from "@backend/core/query/filters/BooleanFilter";
export { DescriptionFilter } from "@backend/core/query/filters/DescriptionFilter";
export { DescriptionRegexFilter } from "@backend/core/query/filters/DescriptionRegexFilter";
export { PathRegexFilter } from "@backend/core/query/filters/PathRegexFilter";
export { TagRegexFilter } from "@backend/core/query/filters/TagRegexFilter";
export { EscalationFilter } from "@backend/core/query/filters/EscalationFilter";
export { AttentionScoreFilter, AttentionLaneFilter } from "@backend/core/query/filters/AttentionFilter";

// Utils
export { RegexMatcher, type RegexSpec } from "@backend/core/query/utils/RegexMatcher";

// Groupers
export { Grouper } from "@backend/core/query/groupers/GrouperBase";
export { DueDateGrouper, ScheduledDateGrouper } from "@backend/core/query/groupers/DateGrouper";
export { StatusTypeGrouper, StatusNameGrouper } from "@backend/core/query/groupers/StatusGrouper";
export { PriorityGrouper } from "@backend/core/query/groupers/PriorityGrouper";
export { FolderGrouper, PathGrouper, TagGrouper } from "@backend/core/query/groupers/PathGrouper";
