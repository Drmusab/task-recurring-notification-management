import type { Task } from '@backend/core/models/Task';
import type { Filter } from '@backend/core/query/filters/FilterBase';
import type { QueryResult } from '@backend/core/query/QueryEngine';
import type { QueryAST, FilterNode } from '@backend/core/query/QueryParser';

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

/**
 * QueryExplainer generates human-readable explanations for query results
 * Ported from obsidian-tasks with adaptations for System A filter architecture
 */
export class QueryExplainer {
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
