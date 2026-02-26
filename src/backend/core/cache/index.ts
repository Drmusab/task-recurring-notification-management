/**
 * Legacy cache module exports
 * Note: The main cache layer is now at @backend/cache/ (TaskCache, DueStateCache, etc.)
 * QueryCache remains here as it is used by QueryEngine.
 */
export { QueryCache } from "@backend/core/cache/QueryCache";
export type { CacheEntry, CacheStats } from "@backend/core/cache/QueryCache";
