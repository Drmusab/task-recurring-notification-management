/**
 * QueryExplanation - Consolidated query explanation system
 * 
 * Consolidates functionality from:
 * - QueryExplainer.ts (main explanation generation)
 * - QueryExplain.ts (simple text explanations)
 * - ExplanationCache.ts (caching layer)
 * - ExplanationDiff.ts (diff generation)
 * - ExplanationDiagramGenerator.ts (mermaid diagrams)
 * 
 * Phase 2: Query Module Consolidation
 * 
 * @module QueryExplanation
 */

import type { Task } from '@backend/core/models/Task';
import type { Filter } from '@backend/core/query/filters/FilterBase';
import type { QueryResult } from '@backend/core/query/QueryEngine';
import type { QueryAST, FilterNode } from '@backend/core/query/QueryParser';

// ================== Types ==================

/**
 * Explanation for a single filter evaluation on a task
 */
export interface FilterExplanation {
  filterName: string;
  filterDescription: string;
  matched: boolean;
  reason: string;
}

/**
 * Explanation for why a task did or did not match a query
 */
export interface TaskExplanation {
  task: Task;
  filterExplanations: FilterExplanation[];
  matched: boolean;
  mismatchReasons: string[];
}

/**
 * Complete explanation for a query execution
 */
export interface Explanation {
  queryString: string;
  taskExplanations: TaskExplanation[];
  matchCount: number;
  totalCount: number;
  globalFilterApplied?: boolean;
  executionTimeMs?: number;
}

/**
 * Interface that all filters must implement for explanation support
 */
export interface FilterExplainable {
  /**
   * Return human-readable description of what this filter does
   * Example: "priority >= high" or "due before today"
   */
  explain(): string;

  /**
   * Explain why a specific task matched this filter
   * Example: "Task 'Buy milk' has priority HIGH (≥ HIGH)"
   */
  explainMatch(task: Task): string;

  /**
   * Explain why a specific task did NOT match this filter
   * Example: "Task 'Walk dog' has priority MEDIUM (< HIGH)"
   */
  explainMismatch(task: Task): string;
}

// ================== Diff Types ==================

export interface ExplanationDiff {
  /** Tasks that were matched before but not after */
  nowUnmatched: TaskDiffEntry[];
  /** Tasks that were unmatched before but matched after */
  nowMatched: TaskDiffEntry[];
  /** Tasks still matched (reasons may have changed) */
  stillMatched: TaskDiffEntry[];
  /** Tasks still unmatched (reasons may have changed) */
  stillUnmatched: TaskDiffEntry[];
  /** Overall change summary */
  summary: DiffSummary;
}

export interface TaskDiffEntry {
  task: Task;
  beforeReasons: string[];
  afterReasons: string[];
  reasonsChanged: boolean;
}

export interface DiffSummary {
  totalTasks: number;
  beforeMatchCount: number;
  afterMatchCount: number;
  matchCountChange: number;
  gainedMatches: number;
  lostMatches: number;
  reasonsChangedCount: number;
  impactLevel: "none" | "minor" | "moderate" | "major";
}

// ================== Diagram Types ==================

export interface DiagramOptions {
  /** Diagram type to generate */
  type: "flowchart" | "tree" | "sankey";
  /** Include task flow (matched/unmatched paths) */
  includeTaskFlow?: boolean;
  /** Color scheme */
  colorScheme?: "default" | "dark" | "light" | "colorblind";
  /** Maximum nodes to show before summarizing */
  maxNodes?: number;
  /** Show statistics on nodes */
  showStats?: boolean;
}

export interface DiagramResult {
  /** Mermaid diagram syntax */
  mermaidSyntax: string;
  /** Diagram title */
  title: string;
  /** Estimated render complexity (1-5) */
  complexity: number;
  /** Warnings about truncation or simplification */
  warnings: string[];
}

// ================== Cache Types ==================

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

// ================== Explanation Cache (Internal) ==================

/**
 * LRU Cache for query explanations with automatic invalidation
 */
class ExplanationCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private maxAge: number; // milliseconds
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxSize: number = 100, maxAge: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  get(queryHash: string, tasksHash: string): Explanation | null {
    const entry = this.cache.get(queryHash);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if cache is stale (tasks changed or expired)
    const now = Date.now();
    if (entry.tasksHash !== tasksHash || now - entry.cachedAt > this.maxAge) {
      this.cache.delete(queryHash);
      this.misses++;
      return null;
    }
    
    // Cache hit
    entry.hitCount++;
    this.hits++;
    
    // Move to end (LRU)
    this.cache.delete(queryHash);
    this.cache.set(queryHash, entry);
    
    return entry.explanation;
  }

  set(queryHash: string, tasksHash: string, explanation: Explanation): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(queryHash, {
      queryHash,
      tasksHash,
      explanation,
      cachedAt: Date.now(),
      hitCount: 0
    });
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalEntries = entries.length;
    const totalRequests = this.hits + this.misses;
    
    return {
      totalHits: this.hits,
      totalMisses: this.misses,
      totalEntries,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      averageHitCount: totalEntries > 0 
        ? entries.reduce((sum, e) => sum + e.hitCount, 0) / totalEntries 
        : 0,
      oldestEntry: totalEntries > 0 ? Math.min(...entries.map(e => e.cachedAt)) : null,
      newestEntry: totalEntries > 0 ? Math.max(...entries.map(e => e.cachedAt)) : null
    };
  }

  private hashObject(obj: any): string {
    return JSON.stringify(obj);
  }
}

// ================== QueryExplainer (Main Class) ==================

/**
 * QueryExplainer generates human-readable explanations for query results
 */
export class QueryExplainer {
  private cache: ExplanationCache;

  constructor() {
    this.cache = new ExplanationCache();
  }

  /**
   * Generate comprehensive explanation for query result
   * 
   * @param result The query result to explain
   * @param query The parsed query AST
   * @param allTasks All tasks before filtering (to explain mismatches)
   * @param filters The filter instances that were evaluated
   * @param globalFilterApplied Whether global filter was applied
   * @returns Complete explanation including why each task matched/didn't match
   */
  explainQuery(
    result: QueryResult,
    query: QueryAST,
    allTasks: Task[],
    filters: Filter[],
    globalFilterApplied: boolean = false
  ): Explanation {
    const queryString = this.reconstructQuery(query);
    
    // Generate explanations for all tasks (matched and unmatched)
    const taskExplanations = allTasks.map(task => {
      const filterExplanations = filters.map((filter, index) => {
        const matched = filter.matches(task);
        const filterNode = query.filters[index];
        
        return {
          filterName: filterNode?.type || filter.constructor.name,
          filterDescription: this.getFilterExplainable(filter)?.explain() || 'Unknown filter',
          matched,
          reason: matched 
            ? (this.getFilterExplainable(filter)?.explainMatch(task) || 'Match')
            : (this.getFilterExplainable(filter)?.explainMismatch(task) || 'No match')
        };
      });
      
      const allMatched = filterExplanations.every(f => f.matched);
      const mismatchReasons = filterExplanations
        .filter(f => !f.matched)
        .map(f => f.reason);
      
      return {
        task,
        filterExplanations,
        matched: allMatched,
        mismatchReasons
      };
    });
    
    return {
      queryString,
      taskExplanations,
      matchCount: result.tasks.length,
      totalCount: allTasks.length,
      globalFilterApplied,
      executionTimeMs: result.executionTimeMs
    };
  }

  /**
   * Generate simpler explanation for just the matched tasks
   * Useful for inline display in UI
   */
  explainMatches(
    result: QueryResult,
    query: QueryAST,
    filters: Filter[]
  ): string[] {
    const explanations: string[] = [];
    
    explanations.push(`Query matched ${result.tasks.length} tasks:`);
    explanations.push('');
    
    // Explain each filter
    filters.forEach((filter, index) => {
      const filterNode = query.filters[index];
      const explainable = this.getFilterExplainable(filter);
      
      if (explainable) {
        explanations.push(`  ✓ ${explainable.explain()}`);
      } else {
        explanations.push(`  ✓ ${filterNode?.type || 'Unknown filter'}`);
      }
    });
    
    if (query.sort) {
      explanations.push('');
      explanations.push(`Sorted by: ${query.sort.field}${query.sort.reverse ? ' (descending)' : ''}`);
    }
    
    if (query.group) {
      explanations.push(`Grouped by: ${query.group.field}`);
    }
    
    if (query.limit) {
      explanations.push(`Limited to: ${query.limit} tasks`);
    }
    
    if (result.executionTimeMs !== undefined) {
      explanations.push('');
      explanations.push(`Execution time: ${result.executionTimeMs.toFixed(2)}ms`);
    }
    
    return explanations;
  }

  /**
   * Generate markdown explanation for display
   */
  explainAsMarkdown(explanation: Explanation): string {
    const lines: string[] = [];
    
    lines.push('# Query Explanation');
    lines.push('');
    lines.push(`**Query**: \`${explanation.queryString}\``);
    lines.push(`**Results**: ${explanation.matchCount} / ${explanation.totalCount} tasks`);
    
    if (explanation.globalFilterApplied) {
      lines.push(`**Note**: Global filter was applied before this query`);
    }
    
    if (explanation.executionTimeMs !== undefined) {
      lines.push(`**Execution Time**: ${explanation.executionTimeMs.toFixed(2)}ms`);
    }
    
    lines.push('');
    lines.push('## Matched Tasks');
    lines.push('');
    
    const matchedTasks = explanation.taskExplanations.filter(te => te.matched);
    
    if (matchedTasks.length === 0) {
      lines.push('*No tasks matched this query*');
    } else {
      matchedTasks.forEach(te => {
        lines.push(`### ${te.task.name}`);
        te.filterExplanations.forEach(fe => {
          const icon = fe.matched ? '✓' : '✗';
          lines.push(`  ${icon} ${fe.filterDescription}: ${fe.reason}`);
        });
        lines.push('');
      });
    }
    
    lines.push('## Unmatched Tasks (Sample)');
    lines.push('');
    
    const unmatchedTasks = explanation.taskExplanations
      .filter(te => !te.matched)
      .slice(0, 5); // Show first 5 mismatches
    
    if (unmatchedTasks.length === 0) {
      lines.push('*All tasks matched!*');
    } else {
      unmatchedTasks.forEach(te => {
        lines.push(`### ${te.task.name}`);
        lines.push(`**Reasons for mismatch**:`);
        te.mismatchReasons.forEach(reason => {
          lines.push(`  - ${reason}`);
        });
        lines.push('');
      });
      
      const remainingUnmatched = explanation.taskExplanations.filter(te => !te.matched).length - 5;
      if (remainingUnmatched > 0) {
        lines.push(`*...and ${remainingUnmatched} more unmatched tasks*`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Simple text explanation from query AST (from QueryExplain.ts)
   */
  explainQueryAST(query: QueryAST): string {
    const parts: string[] = [];

    if (query.filters.length > 0) {
      parts.push('**Filters:**');
      for (const filter of query.filters) {
        parts.push(`- ${this.explainFilterNode(filter)}`);
      }
    } else {
      parts.push('**Filters:** None (showing all tasks)');
    }

    if (query.sort) {
      const direction = query.sort.reverse ? 'descending' : 'ascending';
      parts.push(`\n**Sort:** By ${query.sort.field} (${direction})`);
    }

    if (query.group) {
      parts.push(`\n**Group:** By ${query.group.field}`);
    }

    if (query.limit !== undefined && query.limit > 0) {
      parts.push(`\n**Limit:** First ${query.limit} tasks`);
    }

    return parts.join('\n');
  }

  /**
   * Explain a filter node in human-readable text
   */
  private explainFilterNode(filter: FilterNode): string {
    const negate = filter.negate ? 'NOT ' : '';
    const escalationLabel =
      typeof filter.value === "number"
        ? { 0: "on-time", 1: "warning", 2: "critical", 3: "severe" }[filter.value] ?? filter.value
        : filter.value;

    switch (filter.type) {
      case 'status':
        return `${negate}Status ${filter.operator} "${filter.value}"`;

      case 'date':
        return `${negate}${filter.value.field} ${filter.value.comparator} ${filter.value.date}`;

      case 'priority':
        return `${negate}Priority ${filter.operator} ${filter.value}`;

      case 'urgency':
        return `${negate}Urgency ${filter.operator} ${filter.value}`;

      case 'escalation':
        return `${negate}Escalation ${filter.operator} ${escalationLabel}`;

      case 'attention':
        return `${negate}Attention ${filter.operator} ${filter.value}`;

      case 'tag':
        if (filter.operator === 'includes') {
          return `${negate}Tag includes "${filter.value}"`;
        }
        if (filter.operator === 'has') {
          return `${negate}Has tags`;
        }
        return `${negate}Tag ${filter.operator} "${filter.value}"`;

      case 'path':
        return `${negate}Path ${filter.operator} "${filter.value}"`;

      case 'boolean':
        if (filter.operator === 'AND' && filter.left && filter.right) {
          return `(${this.explainFilterNode(filter.left)} AND ${this.explainFilterNode(filter.right)})`;
        }
        if (filter.operator === 'OR' && filter.left && filter.right) {
          return `(${this.explainFilterNode(filter.left)} OR ${this.explainFilterNode(filter.right)})`;
        }
        if (filter.operator === 'NOT' && filter.inner) {
          return `(NOT ${this.explainFilterNode(filter.inner)})`;
        }
        return 'Unknown boolean filter';

      case 'done':
        return filter.value ? `${negate}done` : `${negate}not done`;

      default:
        return `${negate}${filter.type} ${filter.operator} "${filter.value}"`;
    }
  }

  /**
   * Compare two explanations and generate diff
   */
  diffExplanations(before: Explanation, after: Explanation): ExplanationDiff {
    const beforeMap = new Map(
      before.taskExplanations.map(te => [te.task.id, te])
    );
    const afterMap = new Map(
      after.taskExplanations.map(te => [te.task.id, te])
    );

    const nowUnmatched: TaskDiffEntry[] = [];
    const nowMatched: TaskDiffEntry[] = [];
    const stillMatched: TaskDiffEntry[] = [];
    const stillUnmatched: TaskDiffEntry[] = [];

    // Process all tasks from both explanations
    const allTaskIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);

    for (const taskId of allTaskIds) {
      const beforeTE = beforeMap.get(taskId);
      const afterTE = afterMap.get(taskId);

      if (!beforeTE || !afterTE) continue; // Task added/removed

      const beforeReasons = beforeTE.mismatchReasons;
      const afterReasons = afterTE.mismatchReasons;
      const reasonsChanged = JSON.stringify(beforeReasons) !== JSON.stringify(afterReasons);

      const entry: TaskDiffEntry = {
        task: afterTE.task,
        beforeReasons,
        afterReasons,
        reasonsChanged
      };

      if (beforeTE.matched && !afterTE.matched) {
        nowUnmatched.push(entry);
      } else if (!beforeTE.matched && afterTE.matched) {
        nowMatched.push(entry);
      } else if (beforeTE.matched && afterTE.matched) {
        stillMatched.push(entry);
      } else {
        stillUnmatched.push(entry);
      }
    }

    const matchCountChange = after.matchCount - before.matchCount;
    const reasonsChangedCount = [...stillMatched, ...stillUnmatched, ...nowMatched, ...nowUnmatched]
      .filter(e => e.reasonsChanged).length;

    let impactLevel: "none" | "minor" | "moderate" | "major" = "none";
    const changePercent = Math.abs(matchCountChange) / before.totalCount;
    if (changePercent === 0 && reasonsChangedCount === 0) {
      impactLevel = "none";
    } else if (changePercent < 0.1) {
      impactLevel = "minor";
    } else if (changePercent < 0.3) {
      impactLevel = "moderate";
    } else {
      impactLevel = "major";
    }

    return {
      nowUnmatched,
      nowMatched,
      stillMatched,
      stillUnmatched,
      summary: {
        totalTasks: before.totalCount,
        beforeMatchCount: before.matchCount,
        afterMatchCount: after.matchCount,
        matchCountChange,
        gainedMatches: nowMatched.length,
        lostMatches: nowUnmatched.length,
        reasonsChangedCount,
        impactLevel
      }
    };
  }

  /**
   * Generate Mermaid diagram from explanation
   */
  generateDiagram(
    explanation: Explanation,
    options: DiagramOptions = { type: "flowchart" }
  ): DiagramResult {
    const warnings: string[] = [];
    let complexity = 1;

    if (options.type === "flowchart") {
      return this.generateFlowchartDiagram(explanation, options, warnings);
    } else if (options.type === "tree") {
      return this.generateTreeDiagram(explanation, options, warnings);
    } else {
      return this.generateSankeyDiagram(explanation, options, warnings);
    }
  }

  private generateFlowchartDiagram(
    explanation: Explanation,
    options: DiagramOptions,
    warnings: string[]
  ): DiagramResult {
    const lines: string[] = [];
    const maxNodes = options.maxNodes || 20;
    
    lines.push('```mermaid');
    lines.push('flowchart TD');
    lines.push('  Start([Query Start])');
    lines.push('  Start --> Filters{Apply Filters}');
    
    const matched = explanation.taskExplanations.filter(te => te.matched);
    const unmatched = explanation.taskExplanations.filter(te => !te.matched);
    
    if (matched.length > 0) {
      lines.push(`  Filters -->|${matched.length} matched| Matched[Matched Tasks]`);
      
      if (options.includeTaskFlow && matched.length <= maxNodes) {
        matched.slice(0, maxNodes).forEach((te, i) => {
          lines.push(`  Matched --> T${i}["${te.task.name}"]`);
        });
      }
    }
    
    if (unmatched.length > 0) {
      lines.push(`  Filters -->|${unmatched.length} unmatched| Unmatched[Unmatched Tasks]`);
      
      if (options.includeTaskFlow && unmatched.length <= maxNodes) {
        unmatched.slice(0, Math.min(5, maxNodes)).forEach((te, i) => {
          lines.push(`  Unmatched --> U${i}["${te.task.name}"]`);
        });
        if (unmatched.length > 5) {
          warnings.push(`Showing first 5 of ${unmatched.length} unmatched tasks`);
        }
      }
    }
    
    lines.push('```');
    
    const complexity = Math.min(5, Math.ceil((matched.length + unmatched.length) / 10));
    
    return {
      mermaidSyntax: lines.join('\n'),
      title: `Query Flowchart: ${explanation.matchCount} / ${explanation.totalCount} matched`,
      complexity,
      warnings
    };
  }

  private generateTreeDiagram(
    explanation: Explanation,
    options: DiagramOptions,
    warnings: string[]
  ): DiagramResult {
    warnings.push('Tree diagram not yet implemented, showing flowchart instead');
    return this.generateFlowchartDiagram(explanation, options, warnings);
  }

  private generateSankeyDiagram(
    explanation: Explanation,
    options: DiagramOptions,
    warnings: string[]
  ): DiagramResult {
    warnings.push('Sankey diagram not yet implemented, showing flowchart instead');
    return this.generateFlowchartDiagram(explanation, options, warnings);
  }

  /**
   * Clear explanation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Reconstruct query string from AST for display
   */
  private reconstructQuery(query: QueryAST): string {
    const parts: string[] = [];
    
    query.filters.forEach(filter => {
      parts.push(this.reconstructFilter(filter));
    });
    
    if (query.sort) {
      parts.push(`sort by ${query.sort.field}${query.sort.reverse ? ' desc' : ''}`);
    }
    
    if (query.group) {
      parts.push(`group by ${query.group.field}`);
    }
    
    if (query.limit) {
      parts.push(`limit ${query.limit}`);
    }
    
    return parts.join(' AND ');
  }

  /**
   * Reconstruct a single filter node as string
   */
  private reconstructFilter(filter: FilterNode): string {
    if (filter.type === 'boolean') {
      // Handle AND/OR/NOT
      if (filter.operator === 'AND' && filter.left && filter.right) {
        return `(${this.reconstructFilter(filter.left)} AND ${this.reconstructFilter(filter.right)})`;
      }
      if (filter.operator === 'OR' && filter.left && filter.right) {
        return `(${this.reconstructFilter(filter.left)} OR ${this.reconstructFilter(filter.right)})`;
      }
      if (filter.operator === 'NOT' && filter.inner) {
        return `NOT ${this.reconstructFilter(filter.inner)}`;
      }
    }
    
    // Simple filter
    const negation = filter.negate ? 'NOT ' : '';
    return `${negation}${filter.type} ${filter.operator} ${filter.value}`;
  }

  /**
   * Type guard to check if filter implements FilterExplainable
   */
  private getFilterExplainable(filter: Filter): FilterExplainable | null {
    if ('explain' in filter && 'explainMatch' in filter && 'explainMismatch' in filter) {
      return filter as unknown as FilterExplainable;
    }
    return null;
  }
}

/**
 * Singleton instance for convenience
 */
export const queryExplainer = new QueryExplainer();

/**
 * Standalone function for simple query explanation (from QueryExplain.ts)
 * @deprecated Use queryExplainer.explainQueryAST() instead
 */
export function explainQuery(query: QueryAST): string {
  return queryExplainer.explainQueryAST(query);
}

// ================== Compatibility Exports ==================
//
// These exports maintain backward compatibility with the old separate modules

/**
 * ExplanationDiff static utilities - Compatibility wrapper
 * Uses the singleton QueryExplainer instance
 */
export namespace ExplanationDiffUtils {
  export function diff(before: Explanation, after: Explanation): ExplanationDiff {
    return queryExplainer.diffExplanations(before, after);
  }
  
  export function getSummaryText(diff: ExplanationDiff): string {
    const s = diff.summary;
    const parts: string[] = [];
    
    if (s.matchCountChange > 0) {
      parts.push(`+${s.matchCountChange} matches`);
    } else if (s.matchCountChange < 0) {
      parts.push(`${s.matchCountChange} matches`);
    }
    
    if (s.gainedMatches > 0) {
      parts.push(`${s.gainedMatches} gained`);
    }
    if (s.lostMatches > 0) {
      parts.push(`${s.lostMatches} lost`);
    }
    if (s.reasonsChangedCount > 0) {
      parts.push(`${s.reasonsChangedCount} reasons changed`);
    }
    
    if (parts.length === 0) {
      return "No changes";
    }
    
    return parts.join(', ');
  }
  
  export function toMarkdown(diff: ExplanationDiff): string {
    const lines: string[] = [];
    const s = diff.summary;
    
    lines.push('# Explanation Diff');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Tasks**: ${s.totalTasks}`);
    lines.push(`- **Before**: ${s.beforeMatchCount} matched`);
    lines.push(`- **After**: ${s.afterMatchCount} matched`);
    lines.push(`- **Change**: ${s.matchCountChange >= 0 ? '+' : ''}${s.matchCountChange}`);
    lines.push(`- **Impact**: ${s.impactLevel}`);
    lines.push('');
    
    if (diff.nowMatched.length > 0) {
      lines.push(`## Now Matched (${diff.nowMatched.length})`);
      lines.push('');
      diff.nowMatched.forEach(entry => {
        lines.push(`- **${entry.task.name}**`);
        if (entry.beforeReasons.length > 0) {
          lines.push(`  - Before: ${entry.beforeReasons.join(', ')}`);
        }
      });
      lines.push('');
    }
    
    if (diff.nowUnmatched.length > 0) {
      lines.push(`## Now Unmatched (${diff.nowUnmatched.length})`);
      lines.push('');
      diff.nowUnmatched.forEach(entry => {
        lines.push(`- **${entry.task.name}**`);
        if (entry.afterReasons.length > 0) {
          lines.push(`  - Reasons: ${entry.afterReasons.join(', ')}`);
        }
      });
      lines.push('');
    }
    
    if (diff.stillMatched.some(e => e.reasonsChanged)) {
      const changed = diff.stillMatched.filter(e => e.reasonsChanged);
      lines.push(`## Still Matched (reasons changed: ${changed.length})`);
      lines.push('');
      changed.forEach(entry => {
        lines.push(`- **${entry.task.name}**`);
        lines.push(`  - Before: ${entry.beforeReasons.join(', ') || 'none'}`);
        lines.push(`  - After: ${entry.afterReasons.join(', ') || 'none'}`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }
}
