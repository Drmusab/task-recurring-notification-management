/**
 * Query Runtime Layer — Barrel Export
 *
 * Re-exports all query-layer components for clean import paths:
 *
 *   import { TaskQueryEngine, TaskFilterPipeline } from "@backend/query";
 *
 * Module inventory:
 *   - TaskQueryEngine          — Central orchestrator (start/stop lifecycle)
 *   - TaskSelector             — Base cache-backed selection
 *   - TaskFilterPipeline       — Stateless filter chain
 *   - DependencyAwareSelector  — Dependency-guard integration
 *   - RecurrenceAwareSelector  — Recurrence instance resolver
 *   - AnalyticsQueryAdapter    — ML-safe analytics view
 */

// ── Core Orchestrator ──────────────────────────────────────────
export { TaskQueryEngine } from "./TaskQueryEngine";
export type { TaskQueryEngineDeps, QueryOptions, QueryResult } from "./TaskQueryEngine";

// ── Base Selector ──────────────────────────────────────────────
export { TaskSelector } from "./TaskSelector";
export type { TaskSelectorDeps, SelectionOptions, SelectionResult } from "./TaskSelector";

// ── Filter Pipeline ────────────────────────────────────────────
export { TaskFilterPipeline } from "./TaskFilterPipeline";
export type { FilterStage, FilterPipelineResult } from "./TaskFilterPipeline";

// ── Dependency-Aware Selector ──────────────────────────────────
export { DependencyAwareSelector } from "./DependencyAwareSelector";
export type { DependencyFilterOptions, DependencyFilterResult } from "./DependencyAwareSelector";

// ── Recurrence-Aware Selector ──────────────────────────────────
export { RecurrenceAwareSelector } from "./RecurrenceAwareSelector";
export type { RecurrenceResolveDeps, RecurrenceResolveOptions, RecurrenceResolveResult } from "./RecurrenceAwareSelector";

// ── Analytics Query Adapter ────────────────────────────────────
export { AnalyticsQueryAdapter } from "./AnalyticsQueryAdapter";
export type { AnalyticsQueryDeps, AnalyticsTaskView, AnalyticsQueryOptions, AnalyticsQueryResult } from "./AnalyticsQueryAdapter";
