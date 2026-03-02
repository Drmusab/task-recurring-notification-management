/**
 * Cache Layer — Hot-Path Read Optimization
 *
 * Caches are populated by services after mutations and read by
 * the query layer. Caches NEVER perform mutations themselves.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Populated via service callbacks after persistence
 *   ✔ Read-only access from query/ and engine/
 *   ✔ Invalidated by domain events
 *   ❌ No direct SiYuan API calls
 *   ❌ No mutations — caches are derived state
 */

export {
  // ── Cache Manager ──────────────────────────────────────────
  CacheManager,
  type CacheManagerDeps,
  type CacheManagerStats,

  // ── Task Cache ─────────────────────────────────────────────
  TaskCache,
  type TaskCacheStats,
  type TaskCacheDeps,

  // ── Due State Cache ────────────────────────────────────────
  DueStateCache,
  type DueStateEntry,
  type DueStateCacheStats,
  type DueStateCacheDeps,

  // ── Recurrence Cache ───────────────────────────────────────
  RecurrenceCache,
  type RecurrenceCacheEntry,
  type RecurrenceCacheStats,
  type RecurrenceCacheDeps,

  // ── Analytics Cache ────────────────────────────────────────
  AnalyticsCache,
  type TaskAnalyticsEntry,
  type AggregateAnalytics,
  type AnalyticsCacheStats,
  type AnalyticsCacheDeps,

  // ── Dependency Cache ───────────────────────────────────────
  DependencyCache,
  type DependencyCacheDeps,
} from "@backend/cache";

// Re-export dependency cache types
export type { DependencyNode, DependencyCacheStats } from "@backend/cache";

// ── Canonical TaskCache (Architecture Spec v3 §4.2) ──────────
export { TaskCache as CanonicalTaskCache } from "./TaskCache";
