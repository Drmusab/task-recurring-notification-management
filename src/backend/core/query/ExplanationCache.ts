/**
 * ExplanationCache - Performance optimization for query explanations
 * 
 * Caches explanation results to avoid redundant computation when:
 * - Same query executed multiple times
 * - Task list hasn't changed
 * - Filters haven't changed
 * 
 * Phase 4: Explanation Enhancements
 * 
 * @module ExplanationCache
 */

import type { Explanation, TaskExplanation } from "./QueryExplainer";
import type { QueryAST } from "./QueryParser";
import type { Task } from "../../../domain/models/Task";

interface CacheEntry {
  /** Hash of the query AST for comparison */
  queryHash: string;
  /** Hash of the task list for invalidation */
  tasksHash: string;
  /** Cached explanation result */
  explanation: Explanation;
  /** Timestamp when cached */
  cachedAt: number;
  /** Number of times this cache entry was hit */
  hitCount: number;
}

interface CacheStats {
  totalHits: number;
  totalMisses: number;
  totalEntries: number;
  hitRate: number;
  averageHitCount: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

/**
 * LRU Cache for query explanations with automatic invalidation
 */
export class ExplanationCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private maxAge: number; // milliseconds
  private hits: number = 0;
  private misses: number = 0;
  private saveTimeout: number | null = null;
  private readonly STORAGE_KEY = "tasks-explanation-cache";
  private readonly SAVE_DEBOUNCE_MS = 1000; // 1 second

  /**
   * @param maxSize Maximum number of cached explanations (default: 100)
   * @param maxAge Maximum age of cache entries in ms (default: 5 minutes)
   */
  constructor(maxSize: number = 100, maxAge: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
    this.loadFromStorage(); // Auto-load on initialization
  }

  /**
   * Get cached explanation if available and valid
   */
  get(query: QueryAST, tasks: Task[]): Explanation | null {
    const queryHash = this.hashQuery(query);
    const tasksHash = this.hashTasks(tasks);
    const cacheKey = `${queryHash}:${tasksHash}`;

    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if entry is expired
    const age = Date.now() - entry.cachedAt;
    if (age > this.maxAge) {
      this.cache.delete(cacheKey);
      this.misses++;
      return null;
    }

    // Cache hit
    this.hits++;
    entry.hitCount++;
    
    // Move to end (LRU)
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, entry);

    return entry.explanation;
  }

  /**
   * Store explanation in cache
   */
  set(query: QueryAST, tasks: Task[], explanation: Explanation): void {
    const queryHash = this.hashQuery(query);
    const tasksHash = this.hashTasks(tasks);
    const cacheKey = `${queryHash}:${tasksHash}`;

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(cacheKey)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const entry: CacheEntry = {
      queryHash,
      tasksHash,
      explanation,
      cachedAt: Date.now(),
      hitCount: 0
    };

    this.cache.set(cacheKey, entry);
    
    // Schedule save to localStorage
    this.scheduleSave();
  }

  /**
   * Invalidate cache entries for specific tasks
   */
  invalidateForTasks(tasks: Task[]): number {
    const tasksHash = this.hashTasks(tasks);
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tasksHash === tasksHash) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Invalidate cache entries for specific query
   */
  invalidateForQuery(query: QueryAST): number {
    const queryHash = this.hashQuery(query);
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.queryHash === queryHash) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const total = this.hits + this.misses;

    return {
      totalHits: this.hits,
      totalMisses: this.misses,
      totalEntries: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
      averageHitCount: entries.length > 0 
        ? entries.reduce((sum, e) => sum + e.hitCount, 0) / entries.length 
        : 0,
      oldestEntry: entries.length > 0 
        ? Math.min(...entries.map(e => e.cachedAt)) 
        : null,
      newestEntry: entries.length > 0 
        ? Math.max(...entries.map(e => e.cachedAt)) 
        : null
    };
  }

  /**
   * Remove expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cachedAt > this.maxAge) {
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Hash query AST for comparison
   */
  private hashQuery(query: QueryAST): string {
    // Create deterministic hash from query structure
    const parts: string[] = [];

    // Hash filters
    if (query.filters) {
      parts.push(`f:${JSON.stringify(query.filters)}`);
    }

    // Hash sort
    if (query.sort) {
      parts.push(`s:${query.sort.field}:${query.sort.reverse ? 'desc' : 'asc'}`);
    }

    // Hash group
    if (query.group) {
      parts.push(`g:${query.group.field}`);
    }

    // Hash limit
    if (query.limit) {
      parts.push(`l:${query.limit}`);
    }

    return this.simpleHash(parts.join('|'));
  }

  /**
   * Hash task list for invalidation detection
   */
  private hashTasks(tasks: Task[]): string {
    // Hash based on task IDs and modification times
    const signature = tasks
      .map(t => `${t.id}:${t.updatedAt || t.createdAt}`)
      .sort()
      .join(',');

    return this.simpleHash(signature);
  }

  /**
   * Simple string hashing function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cache size in bytes (approximate)
   */
  getSizeBytes(): number {
    let size = 0;

    for (const entry of this.cache.values()) {
      // Approximate JSON size
      size += JSON.stringify(entry.explanation).length;
      size += 100; // Metadata overhead
    }

    return size;
  }

  /**
   * Export cache for persistence
   */
  export(): string {
    const data = {
      entries: Array.from(this.cache.entries()),
      stats: {
        hits: this.hits,
        misses: this.misses
      },
      config: {
        maxSize: this.maxSize,
        maxAge: this.maxAge
      }
    };

    return JSON.stringify(data);
  }

  /**
   * Import cache from persisted data
   */
  import(json: string): boolean {
    try {
      const data = JSON.parse(json);

      this.cache.clear();
      this.hits = data.stats.hits || 0;
      this.misses = data.stats.misses || 0;
      this.maxSize = data.config.maxSize || this.maxSize;
      this.maxAge = data.config.maxAge || this.maxAge;

      for (const [key, entry] of data.entries) {
        // Only restore non-expired entries
        const age = Date.now() - entry.cachedAt;
        if (age <= this.maxAge) {
          this.cache.set(key, entry);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to import cache:', error);
      return false;
    }
  }

  /**
   * Schedule debounced save to localStorage
   */
  private scheduleSave(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = window.setTimeout(() => {
      this.saveToStorage();
      this.saveTimeout = null;
    }, this.SAVE_DEBOUNCE_MS);
  }

  /**
   * Save cache to localStorage
   */
  private saveToStorage(): void {
    try {
      const json = this.export();
      localStorage.setItem(this.STORAGE_KEY, json);
    } catch (error) {
      console.error("Failed to save cache to localStorage:", error);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      const json = localStorage.getItem(this.STORAGE_KEY);
      if (json) {
        this.import(json);
      }
    } catch (error) {
      console.error("Failed to load cache from localStorage:", error);
    }
  }
}

/**
 * Global singleton cache instance
 */
export const globalExplanationCache = new ExplanationCache();
