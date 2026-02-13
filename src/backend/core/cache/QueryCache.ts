/**
 * QueryCache - Performance optimization for task queries
 * 
 * Implements a time-based cache with LFU (Least Frequently Used) eviction
 * to improve query performance for repeated queries.
 * 
 * Target Performance:
 * - 70%+ cache hit rate in typical usage
 * - <100ms query response time for cached queries
 * - <20MB memory overhead for cache
 * 
 * Phase 1, Week 1 - Performance Optimization
 */

import * as logger from '@backend/logging/logger';

/**
 * Cache entry with metadata for eviction policy
 */
export interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Timestamp when entry was created (ms since epoch) */
  timestamp: number;
  /** Number of times this entry has been accessed */
  hits: number;
  /** Last access timestamp for debugging */
  lastAccess: number;
}

/**
 * Cache statistics for monitoring and optimization
 */
export interface CacheStats {
  /** Total number of cache lookups */
  totalRequests: number;
  /** Number of successful cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Cache hit rate as percentage */
  hitRate: number;
  /** Current number of entries in cache */
  size: number;
  /** Maximum allowed size */
  maxSize: number;
  /** Number of evictions due to size limit */
  evictions: number;
  /** Number of invalidations due to TTL expiry */
  expirations: number;
}

/**
 * QueryCache provides high-performance caching for task query results
 * 
 * Features:
 * - Time-to-Live (TTL) based expiration
 * - Least Frequently Used (LFU) eviction policy
 * - Automatic invalidation on task mutations
 * - Cache hit/miss statistics
 * 
 * Usage:
 * ```typescript
 * const cache = new QueryCache<Task[]>();
 * 
 * const result = await cache.execute('query:status=todo', async () => {
 *   return expensiveQueryOperation();
 * });
 * 
 * // Invalidate when tasks change
 * cache.invalidate('query:*');
 * ```
 */
export class QueryCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly ttl: number;
  private readonly maxSize: number;
  
  // Statistics
  private stats = {
    totalRequests: 0,
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  };

  /**
   * Create a new QueryCache
   * 
   * @param ttl - Time-to-live in milliseconds (default: 5000ms = 5s)
   * @param maxSize - Maximum number of entries (default: 100)
   */
  constructor(ttl: number = 5000, maxSize: number = 100) {
    this.ttl = ttl;
    this.maxSize = maxSize;
    logger.info(`QueryCache initialized with TTL=${ttl}ms, maxSize=${maxSize}`);
  }

  /**
   * Execute a function with caching
   * 
   * If a valid cached result exists for the given key, returns it immediately.
   * Otherwise, executes the function, caches the result, and returns it.
   * 
   * @param queryKey - Unique identifier for this query
   * @param executor - Async function to execute if cache miss
   * @returns Cached or freshly computed result
   */
  async execute(queryKey: string, executor: () => Promise<T>): Promise<T> {
    this.stats.totalRequests++;
    
    // Check cache for valid entry
    const entry = this.cache.get(queryKey);
    const now = Date.now();
    
    if (entry) {
      // Check if entry is still valid (not expired)
      if (now - entry.timestamp < this.ttl) {
        // Cache hit - update statistics
        entry.hits++;
        entry.lastAccess = now;
        this.stats.hits++;
        
        logger.debug(`QueryCache HIT: ${queryKey} (hits=${entry.hits})`);
        return entry.data;
      } else {
        // Entry expired - remove it
        this.cache.delete(queryKey);
        this.stats.expirations++;
        logger.debug(`QueryCache EXPIRED: ${queryKey}`);
      }
    }
    
    // Cache miss - execute function
    this.stats.misses++;
    logger.debug(`QueryCache MISS: ${queryKey}`);
    
    const result = await executor();
    
    // Store in cache
    this.set(queryKey, result);
    
    return result;
  }

  /**
   * Store a value in the cache
   * 
   * If cache is full, evicts the least frequently used entry.
   * 
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: string, value: T): void {
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLFU();
    }
    
    // Create new entry
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: now,
      hits: 0,
      lastAccess: now,
    };
    
    this.cache.set(key, entry);
    logger.debug(`QueryCache SET: ${key} (size=${this.cache.size}/${this.maxSize})`);
  }

  /**
   * Get a value from the cache without executing
   * 
   * Returns undefined if key doesn't exist or entry is expired.
   * Updates hit count if entry is valid.
   * 
   * @param key - Cache key
   * @returns Cached value or undefined
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    
    const now = Date.now();
    
    // Check if expired
    if (now - entry.timestamp >= this.ttl) {
      this.cache.delete(key);
      this.stats.expirations++;
      return undefined;
    }
    
    // Update hit count
    entry.hits++;
    entry.lastAccess = now;
    
    return entry.data;
  }

  /**
   * Check if a key exists in the cache and is not expired
   * 
   * @param key - Cache key
   * @returns true if valid entry exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    
    const now = Date.now();
    if (now - entry.timestamp >= this.ttl) {
      this.cache.delete(key);
      this.stats.expirations++;
      return false;
    }
    
    return true;
  }

  /**
   * Invalidate cache entries matching a pattern
   * 
   * Patterns:
   * - 'key' - exact match
   * - 'prefix:*' - all keys starting with 'prefix:'
   * - '*' - clear all entries
   * 
   * @param pattern - Invalidation pattern
   * @returns Number of entries invalidated
   */
  invalidate(pattern?: string): number {
    let removed = 0;
    
    if (!pattern || pattern === '*') {
      // Clear all
      removed = this.cache.size;
      this.cache.clear();
      logger.info(`QueryCache CLEAR ALL: ${removed} entries invalidated`);
      return removed;
    }
    
    if (pattern.endsWith('*')) {
      // Prefix match
      const prefix = pattern.slice(0, -1);
      for (const key of Array.from(this.cache.keys())) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          removed++;
        }
      }
      logger.info(`QueryCache INVALIDATE: pattern=${pattern}, removed=${removed}`);
    } else {
      // Exact match
      if (this.cache.delete(pattern)) {
        removed = 1;
        logger.debug(`QueryCache INVALIDATE: ${pattern}`);
      }
    }
    
    return removed;
  }

  /**
   * Evict the least frequently used entry
   * 
   * In case of ties (same hit count), evicts the oldest entry.
   */
  private evictLFU(): void {
    let minHits = Infinity;
    let oldestTimestamp = Infinity;
    let keyToEvict: string | null = null;
    
    for (const [key, entry] of this.cache.entries()) {
      // Find entry with lowest hits, or oldest if tied
      if (entry.hits < minHits || (entry.hits === minHits && entry.timestamp < oldestTimestamp)) {
        minHits = entry.hits;
        oldestTimestamp = entry.timestamp;
        keyToEvict = key;
      }
    }
    
    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      this.stats.evictions++;
      logger.debug(`QueryCache EVICT LFU: ${keyToEvict} (hits=${minHits})`);
    }
  }

  /**
   * Get cache statistics
   * 
   * @returns Current cache statistics
   */
  getStats(): CacheStats {
    return {
      totalRequests: this.stats.totalRequests,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.totalRequests > 0 
        ? (this.stats.hits / this.stats.totalRequests) * 100 
        : 0,
      size: this.cache.size,
      maxSize: this.maxSize,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
    };
  }

  /**
   * Reset cache statistics (preserves cached data)
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };
    logger.info('QueryCache stats reset');
  }

  /**
   * Clear all cached entries and reset statistics
   */
  clear(): void {
    this.cache.clear();
    this.resetStats();
    logger.info('QueryCache cleared');
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cache keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}
