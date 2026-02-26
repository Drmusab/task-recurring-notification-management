/**
 * Cache layer barrel exports
 *
 * Architecture: Block-Validated Runtime Cache
 * All caches read from TaskRepositoryProvider, validate against SiYuan block attrs,
 * and emit PluginEventBus events for frontend reactivity.
 *
 * Lifecycle: start() after plugin.onload(), stop() on plugin.onunload()
 */

// ── Core caches ──────────────────────────────────────────────
export { TaskCache } from "./TaskCache";
export type { TaskCacheDeps, TaskCacheStats } from "./TaskCache";

export { RecurrenceCache } from "./RecurrenceCache";
export type { RecurrenceCacheDeps, RecurrenceCacheEntry, RecurrenceCacheStats } from "./RecurrenceCache";

export { AnalyticsCache } from "./AnalyticsCache";
export type { AnalyticsCacheDeps, TaskAnalyticsEntry, AggregateAnalytics, AnalyticsCacheStats } from "./AnalyticsCache";

export { DependencyCache } from "./DependencyCache";
export type { DependencyCacheDeps, DependencyNode, DependencyCacheStats } from "./DependencyCache";

export { DueStateCache } from "./DueStateCache";
export type { DueStateCacheDeps, DueStateEntry, DueStateCacheStats } from "./DueStateCache";

// ── Orchestrator ─────────────────────────────────────────────
export { CacheManager } from "./CacheManager";
export type { CacheManagerDeps, CacheManagerStats } from "./CacheManager";
