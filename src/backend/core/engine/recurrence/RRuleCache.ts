/**
 * RRuleCache - LRU cache for parsed RRule objects
 * 
 * Provides:
 * - Fast access to frequently used RRule objects
 * - Automatic eviction of least recently used entries
 * - Task-specific invalidation
 * - Performance monitoring
 */

import { RRule, rrulestr, RRuleSet } from 'rrule';
import type { CacheEntry, CacheStats } from './types';
import { extractRRuleOptions } from './utils';
import * as logger from '@shared/utils/misc/logger';

/**
 * LRU Cache for parsed RRule objects
 * Improves performance by avoiding repeated parsing of the same rules
 */
export class RRuleCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private totalHits = 0;
  private totalMisses = 0;

  /**
   * Create a new RRuleCache
   * @param maxSize - Maximum number of entries (default: 1000)
   */
  constructor(maxSize: number = 1000) {
    if (maxSize < 1) {
      throw new Error('Cache maxSize must be at least 1');
    }
    this.maxSize = maxSize;
  }

  /**
   * Get or parse an RRule, caching the result
   * @param key - Cache key (typically "taskId:rruleString")
   * @param rruleString - RRULE string to parse if not cached
   * @param dtstart - DTSTART date for the rule
   * @param timezone - Optional timezone
   * @returns Parsed RRule object
   */
  getOrParse(key: string, rruleString: string, dtstart: Date, timezone?: string): RRule {
    // Check cache first
    const cached = this.cache.get(key);
    
    if (cached) {
      // Cache hit
      this.totalHits++;
      cached.hits++;
      cached.lastAccess = Date.now();
      
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, cached);
      
      return cached.rrule;
    }

    // Cache miss - parse the rule
    this.totalMisses++;
    
    const rrule = this.parseRRule(rruleString, dtstart, timezone);
    
    // Add to cache
    this.set(key, rrule);
    
    return rrule;
  }

  /**
   * Parse an RRULE string into an RRule object
   * @param rruleString - RRULE string to parse
   * @param dtstart - DTSTART date
   * @param timezone - Optional timezone
   * @returns Parsed RRule object
   */
  private parseRRule(rruleString: string, dtstart: Date, timezone?: string): RRule {
    try {
      // Extract options using shared utility
      const options = extractRRuleOptions(rruleString);
      
      // Set dtstart
      options.dtstart = dtstart;
      
      // Set timezone if provided
      if (timezone) {
        options.tzid = timezone;
      }
      
      // Create RRule with updated options
      return new RRule(options);
      
    } catch (error) {
      logger.error('Failed to parse RRULE', {
        rruleString,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Add an entry to the cache
   * @param key - Cache key
   * @param rrule - RRule object to cache
   */
  private set(key: string, rrule: RRule): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      rrule,
      key,
      hits: 0,
      lastAccess: Date.now(),
      createdAt: Date.now()
    };

    this.cache.set(key, entry);
  }

  /**
   * Evict the least recently used entry
   */
  private evictOldest(): void {
    // Find the entry with the oldest lastAccess time
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Invalidate a specific cache entry
   * @param key - Cache key to invalidate
   * @returns true if entry was found and removed
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries for a specific task
   * @param taskId - Task ID
   * @returns Number of entries removed
   */
  invalidateTask(taskId: string): number {
    let removed = 0;
    
    // Find all keys that start with the taskId
    const keysToRemove: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${taskId}:`)) {
        keysToRemove.push(key);
      }
    }
    
    // Remove them
    for (const key of keysToRemove) {
      if (this.cache.delete(key)) {
        removed++;
      }
    }
    
    return removed;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.totalHits + this.totalMisses;
    const hitRate = totalRequests > 0 ? this.totalHits / totalRequests : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses
    };
  }

  /**
   * Get current cache size
   * @returns Number of entries in cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Check if cache has a specific key
   * @param key - Cache key
   * @returns true if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get detailed information about a cache entry
   * @param key - Cache key
   * @returns Cache entry or undefined
   */
  getEntry(key: string): CacheEntry | undefined {
    return this.cache.get(key);
  }

  /**
   * Get all cache keys (for debugging)
   * @returns Array of cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Prune cache entries older than a certain age
   * @param maxAgeMs - Maximum age in milliseconds
   * @returns Number of entries removed
   */
  pruneOld(maxAgeMs: number): number {
    const now = Date.now();
    let pruned = 0;
    
    const keysToRemove: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccess > maxAgeMs) {
        keysToRemove.push(key);
      }
    }
    
    for (const key of keysToRemove) {
      if (this.cache.delete(key)) {
        pruned++;
      }
    }
    
    if (pruned > 0) {
      logger.debug('Pruned old cache entries', { pruned, maxAgeMs });
    }
    
    return pruned;
  }
}
