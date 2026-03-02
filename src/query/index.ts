/**
 * Query Layer — Read-Only Task Selection
 *
 * The query layer provides read-only access to task data through
 * filter pipelines and selectors. It NEVER mutates any data.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Reads from cache/ layer only
 *   ✔ Returns readonly snapshots
 *   ✔ Composable filter pipeline stages
 *   ❌ No mutations
 *   ❌ No SiYuan API calls
 */

export {
  // ── Task Query Engine ──────────────────────────────────────
  TaskQueryEngine,
  type TaskQueryEngineDeps,
  type QueryOptions,
  type QueryResult,

  // ── Task Selector ──────────────────────────────────────────
  TaskSelector,
  type TaskSelectorDeps,
  type SelectionOptions,
  type SelectionResult,

  // ── Filter Pipeline ────────────────────────────────────────
  TaskFilterPipeline,
  type FilterStage,
  type FilterPipelineResult,

  // ── Dependency-Aware Selector ──────────────────────────────
  DependencyAwareSelector,
  type DependencyFilterOptions,
  type DependencyFilterResult,

  // ── Recurrence-Aware Selector ──────────────────────────────
  RecurrenceAwareSelector,
  type RecurrenceResolveDeps,
  type RecurrenceResolveOptions,
  type RecurrenceResolveResult,

  // ── Analytics Query Adapter ────────────────────────────────
  AnalyticsQueryAdapter,
  type AnalyticsQueryDeps,
  type AnalyticsTaskView,
  type AnalyticsQueryOptions,
  type AnalyticsQueryResult,
} from "@backend/query";

// ── Saved Query Store ────────────────────────────────────────
export {
  initSavedQueryStore,
  resetSavedQueryStore,
  SavedQueryStore,
} from "@backend/core/query/SavedQueryStore";

export type {
  SavedQuery,
  SavedQueryFolder,
  SavedQueryCollection,
} from "@backend/core/query/SavedQueryStore";

// ── Canonical QueryEngine (Architecture Spec v3 §4.1) ────────
export { QueryEngine } from "./QueryEngine";
