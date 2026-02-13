// @ts-nocheck
import type { Task } from '@backend/core/models/Task';
import { normalizePriority } from '@backend/core/models/Task';
import { calculateUrgencyScore } from '@backend/core/urgency/UrgencyScoreCalculator';
import type { UrgencySettings } from '@backend/core/urgency/UrgencySettings';
import { DEFAULT_URGENCY_SETTINGS } from '@backend/core/urgency/UrgencySettings';
import type { QueryAST, FilterNode, SortNode, GroupNode } from "@backend/core/query/QueryParser";
import { QueryParser } from "@backend/core/query/QueryParser";
import { QueryCache } from '@backend/core/cache/QueryCache';
import { QueryExecutionError } from "@backend/core/query/QueryError";
import { Filter } from "@backend/core/query/filters/FilterBase";
import { 
  StatusTypeFilter, 
  StatusNameFilter, 
  StatusSymbolFilter,
  DoneFilter,
  NotDoneFilter
} from "@backend/core/query/filters/StatusFilter";
import { DateComparisonFilter, HasDateFilter, type DateField, type DateComparator } from "@backend/core/query/filters/DateFilter";
import { PriorityFilter, type PriorityLevel } from "@backend/core/query/filters/PriorityFilter";
import { TagIncludesFilter, HasTagsFilter } from "@backend/core/query/filters/TagFilter";
import { PathFilter } from "@backend/core/query/filters/PathFilter";
import { IsBlockedFilter, IsBlockingFilter, type DependencyGraph } from "@backend/core/query/filters/DependencyFilter";
import { RecurrenceFilter } from "@backend/core/query/filters/RecurrenceFilter";
import { AndFilter, OrFilter, NotFilter } from "@backend/core/query/filters/BooleanFilter";
import { DescriptionFilter } from "@backend/core/query/filters/DescriptionFilter";
import { HeadingFilter } from "@backend/core/query/filters/HeadingFilter";
import { UrgencyFilter, type UrgencyComparator } from "@backend/core/query/filters/UrgencyFilter";
import { EscalationFilter, type EscalationComparator } from "@backend/core/query/filters/EscalationFilter";
import { DescriptionRegexFilter } from "@backend/core/query/filters/DescriptionRegexFilter";
import { PathRegexFilter } from "@backend/core/query/filters/PathRegexFilter";
import { TagRegexFilter } from "@backend/core/query/filters/TagRegexFilter";
import { AttentionLaneFilter, AttentionScoreFilter, type AttentionComparator, type AttentionProfileProvider } from "@backend/core/query/filters/AttentionFilter";
import { Grouper } from "@backend/core/query/groupers/GrouperBase";
import { DueDateGrouper, ScheduledDateGrouper } from "@backend/core/query/groupers/DateGrouper";
import { StatusTypeGrouper, StatusNameGrouper } from "@backend/core/query/groupers/StatusGrouper";
import { PriorityGrouper } from "@backend/core/query/groupers/PriorityGrouper";
import { FolderGrouper, PathGrouper, TagGrouper } from "@backend/core/query/groupers/PathGrouper";
import { explainQuery } from "@backend/core/query/QueryExplain";
import { QueryExplainer, type Explanation } from "@backend/core/query/QueryExplainer";
import type { AttentionSettings, EscalationSettings } from '@backend/core/settings/PluginSettings';
import { DEFAULT_ATTENTION_SETTINGS, DEFAULT_ESCALATION_SETTINGS } from '@backend/core/settings/PluginSettings';
import { AttentionEngine, type AttentionLane } from '@backend/core/attention/AttentionEngine';
import { buildAttentionQueryFields } from '@backend/core/attention/AttentionQueryFields';
import * as logger from '@backend/logging/logger';

/**
 * Execute queries against task index
 */
export interface QueryResult {
  tasks: Task[];
  groups?: Map<string, Task[]>;
  totalCount: number;
  executionTimeMs: number;
  explanation?: string;
}

export interface TaskQueryIndex {
  getAllTasks(): Task[];
  getTasksByStatus?(statusType: string): Task[];
  getTasksByDateRange?(field: string, start: Date, end: Date): Task[];
}

export class QueryEngine {
  private dependencyGraph: DependencyGraph | null = null;
  private globalFilterAST: QueryAST | null = null;
  private urgencySettings: UrgencySettings;
  private escalationSettings: EscalationSettings;
  private attentionSettings: AttentionSettings;
  private attentionEngine = new AttentionEngine();
  private queryCache = new QueryCache<QueryResult>(5000, 100);

  constructor(
    private taskIndex: TaskQueryIndex,
    options: { urgencySettings?: UrgencySettings; escalationSettings?: EscalationSettings; attentionSettings?: AttentionSettings } = {}
  ) {
    this.urgencySettings = options.urgencySettings ?? DEFAULT_URGENCY_SETTINGS;
    this.escalationSettings = options.escalationSettings ?? DEFAULT_ESCALATION_SETTINGS;
    this.attentionSettings = options.attentionSettings ?? DEFAULT_ATTENTION_SETTINGS;
  }

  /**
   * Set dependency graph for dependency filters
   */
  setDependencyGraph(graph: DependencyGraph | null): void {
    this.dependencyGraph = graph;
  }

  /**
   * Set global filter to be applied before all queries
   * @param filterString Global filter query string (e.g., "tag includes #task")
   */
  setGlobalFilter(filterString: string | null): void {
    if (!filterString) {
      this.globalFilterAST = null;
      return;
    }
    
    try {
      const parser = new QueryParser();
      this.globalFilterAST = parser.parse(filterString);
    } catch (error) {
      logger.error('Failed to parse global filter', error);
      this.globalFilterAST = null;
    }
  }

  /**
   * Execute query and return results with explanation
   * Phase 1: Query Enhancement - uses new QueryExplainer for detailed explanations
   */
  executeWithExplanation(query: QueryAST): {
    result: QueryResult;
    explanation: Explanation;
  } {
    const startTime = performance.now();
    const referenceDate = new Date();

    try {
      // Get all tasks for explanation context
      const allTasks = this.taskIndex.getAllTasks();
      
      // Build attention profile provider
      const attentionFields = buildAttentionQueryFields(
        this.attentionEngine,
        allTasks,
        this.attentionSettings,
        this.escalationSettings,
        referenceDate
      );
      const attentionProfileProvider: AttentionProfileProvider = {
        getProfile: (taskId: string) => attentionFields.getProfile(taskId),
      };

      // Create filter instances for explanation
      const filters: Filter[] = [];
      for (const filterNode of query.filters) {
        filters.push(this.createFilter(filterNode, referenceDate, attentionProfileProvider));
      }

      // Execute the query normally
      const result = this.execute(query);

      // Generate detailed explanation
      const explainer = new QueryExplainer();
      const explanation = explainer.explainQuery(result, query, allTasks, filters);

      return { result, explanation };
    } catch (error) {
      throw new QueryExecutionError(
        `Failed to execute query with explanation: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute query and return results
   */
  execute(query: QueryAST): QueryResult {
    const startTime = performance.now();
    const referenceDate = new Date();

    try {
      // Generate cache key from query
      const cacheKey = this.generateCacheKey(query);
      
      // Try to get from cache (skip cache if explain mode is on)
      if (!query.explain && this.queryCache.has(cacheKey)) {
        const cachedResult = this.queryCache.get(cacheKey);
        if (cachedResult) {
          logger.debug(`QueryEngine using cached result for: ${cacheKey}`);
          return cachedResult;
        }
      }
      
      // Generate explanation if requested
      const explanation = query.explain ? this.generateExplanation(query) : undefined;
      
      // Start with all tasks
      let tasks = this.taskIndex.getAllTasks();
      const totalCount = tasks.length;

      const attentionFields = buildAttentionQueryFields(
        this.attentionEngine,
        tasks,
        this.attentionSettings,
        this.escalationSettings,
        referenceDate
      );
      const attentionProfileProvider: AttentionProfileProvider = {
        getProfile: (taskId: string) => attentionFields.getProfile(taskId),
      };

      // Apply global filter first if configured
      if (this.globalFilterAST && this.globalFilterAST.filters.length > 0) {
        tasks = this.applyFilters(tasks, this.globalFilterAST.filters, referenceDate, attentionProfileProvider);
      }

      // Apply query filters
      if (query.filters.length > 0) {
        tasks = this.applyFilters(tasks, query.filters, referenceDate, attentionProfileProvider);
      }

      // Apply sorting
      if (query.sort) {
        tasks = this.applySort(tasks, query.sort, referenceDate);
      }

      // Apply limit
      if (query.limit !== undefined && query.limit > 0) {
        tasks = tasks.slice(0, query.limit);
      }

      // Apply grouping
      let groups: Map<string, Task[]> | undefined;
      if (query.group) {
        groups = this.applyGrouping(tasks, query.group);
      }

      const endTime = performance.now();
      const executionTimeMs = endTime - startTime;

      const result: QueryResult = {
        tasks,
        groups,
        totalCount,
        executionTimeMs,
        explanation,
      };
      
      // Cache the result (skip if explain mode is on)
      if (!query.explain) {
        this.queryCache.set(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      throw new QueryExecutionError(
        `Failed to execute query: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute query from string (convenience method)
   */
  executeString(queryString: string): QueryResult {
    const parser = new QueryParser();
    const ast = parser.parse(queryString);
    return this.execute(ast);
  }

  /**
   * Validate query without executing
   */
  validateQuery(queryString: string): { valid: boolean; error?: string; parsedFilters?: string[] } {
    try {
      const parser = new QueryParser();
      const ast = parser.parse(queryString);
      return {
        valid: true,
        parsedFilters: ast.filters.map(f => `${f.type}:${f.operator}`)
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Apply filters to task list (chainable)
   */
  private applyFilters(
    tasks: Task[],
    filters: FilterNode[],
    referenceDate: Date,
    attentionProfileProvider: AttentionProfileProvider
  ): Task[] {
    let result = tasks;

    for (const filterNode of filters) {
      const filter = this.createFilter(filterNode, referenceDate, attentionProfileProvider);
      result = result.filter(task => filter.matches(task));
    }

    return result;
  }

  /**
   * Create a filter from a filter node
   */
  private createFilter(
    node: FilterNode,
    referenceDate: Date,
    attentionProfileProvider: AttentionProfileProvider
  ): Filter {
    switch (node.type) {
      case 'done':
        return node.value ? new DoneFilter() : new NotDoneFilter();

      case 'status':
        if (node.operator === 'type-is') {
          return new StatusTypeFilter(node.value, node.negate);
        } else if (node.operator === 'name-includes') {
          return new StatusNameFilter(node.value, node.negate);
        } else if (node.operator === 'symbol-is') {
          return new StatusSymbolFilter(node.value, node.negate);
        }
        throw new QueryExecutionError(`Unknown status operator: ${node.operator}`);

      case 'date':
        if (node.operator === 'has') {
          return new HasDateFilter(node.value.field, node.negate);
        } else if (node.operator === 'between') {
          return new DateComparisonFilter(
            node.value.field as DateField,
            node.operator as DateComparator,
            node.value.date,
            node.value.endDate
          );
        } else {
          return new DateComparisonFilter(
            node.value.field as DateField,
            node.operator as DateComparator,
            node.value.date
          );
        }

      case 'priority':
        return new PriorityFilter(
          node.operator as 'is' | 'above' | 'below' | 'at-least' | 'at-most',
          node.value as PriorityLevel
        );

      case 'urgency':
        return new UrgencyFilter(
          node.operator as UrgencyComparator,
          node.value as number,
          referenceDate,
          this.urgencySettings
        );

      case 'escalation':
        return new EscalationFilter(
          node.operator as EscalationComparator,
          node.value as number,
          referenceDate,
          this.escalationSettings
        );

      case 'attention':
        return new AttentionScoreFilter(
          node.operator as AttentionComparator,
          node.value as number,
          attentionProfileProvider
        );

      case 'attention-lane':
        return new AttentionLaneFilter(node.value as AttentionLane, attentionProfileProvider);

      case 'tag':
        if (node.operator === 'has') {
          return new HasTagsFilter(!node.value);
        } else {
          return new TagIncludesFilter(node.value, node.negate);
        }

      case 'path':
        return new PathFilter(node.value, node.negate);

      case 'dependency':
        if (node.operator === 'is-blocked') {
          return new IsBlockedFilter(this.dependencyGraph, !node.value);
        } else if (node.operator === 'is-blocking') {
          return new IsBlockingFilter(this.dependencyGraph, !node.value);
        }
        throw new QueryExecutionError(`Unknown dependency operator: ${node.operator}`);

      case 'recurrence':
        return new RecurrenceFilter(!node.value);

      case 'description':
        return new DescriptionFilter(
          node.operator as 'includes' | 'does not include' | 'regex',
          node.value,
          node.negate
        );

      case 'description-regex':
        return new DescriptionRegexFilter(node.value, node.negate);

      case 'path-regex':
        return new PathRegexFilter(node.value, node.negate);

      case 'tag-regex':
        return new TagRegexFilter(node.value, node.negate);

      case 'heading':
        return new HeadingFilter(
          node.operator as 'includes' | 'does not include',
          node.value
        );

      case 'boolean':
        if (node.operator === 'AND' && node.left && node.right) {
          return new AndFilter(
            this.createFilter(node.left, referenceDate),
            this.createFilter(node.right, referenceDate)
          );
        } else if (node.operator === 'OR' && node.left && node.right) {
          return new OrFilter(
            this.createFilter(node.left, referenceDate),
            this.createFilter(node.right, referenceDate)
          );
        } else if (node.operator === 'NOT' && node.inner) {
          return new NotFilter(this.createFilter(node.inner, referenceDate));
        }
        throw new QueryExecutionError(`Invalid boolean operator: ${node.operator}`);

      default:
        throw new QueryExecutionError(`Unknown filter type: ${node.type}`);
    }
  }

  /**
   * Apply sorting (supports multi-field sorting)
   */
  private applySort(tasks: Task[], sort: SortNode, referenceDate: Date): Task[] {
    const sorted = [...tasks];
    
    // Check if multi-field sorting is used
    const sortFields = (sort as any).sortFields as { field: string; reverse?: boolean }[] | undefined;
    const fieldsToSort = sortFields || [{ field: sort.field, reverse: sort.reverse }];

    sorted.sort((a, b) => {
      // Try each sort field in order until we find a difference
      for (const sortField of fieldsToSort) {
        let comparison = 0;

        switch (sortField.field) {
          case 'due':
            comparison = this.compareDates(a.dueAt, b.dueAt);
            break;
          case 'scheduled':
            comparison = this.compareDates(a.scheduledAt, b.scheduledAt);
            break;
          case 'start':
            comparison = this.compareDates(a.startAt, b.startAt);
            break;
          case 'created':
            comparison = this.compareDates(a.createdAt, b.createdAt);
            break;
          case 'done':
            comparison = this.compareDates(a.doneAt, b.doneAt);
            break;
          case 'priority':
            comparison = this.comparePriorities(a.priority, b.priority);
            break;
          case 'urgency':
            comparison = this.getUrgencyScore(b, referenceDate) - this.getUrgencyScore(a, referenceDate);
            break;
          case 'status.type':
            comparison = this.compareStatusTypes(a, b);
            break;
          case 'description':
            comparison = (a.description || '').localeCompare(b.description || '');
            break;
          case 'heading':
            comparison = (a.heading || '').localeCompare(b.heading || '');
            break;
          case 'path':
            comparison = (a.path || '').localeCompare(b.path || '');
            break;
          default:
            // Default to sorting by name
            comparison = a.name.localeCompare(b.name);
        }
        
        // Apply reverse if specified
        const finalComparison = sortField.reverse ? -comparison : comparison;
        
        // If this field produces a difference, use it (don't check remaining fields)
        if (finalComparison !== 0) {
          return finalComparison;
        }
        
        // Otherwise, continue to next sort field
      }
      
      // All sort fields were equal
      return 0;
    });

    return sorted;
  }

  private compareDates(a: string | undefined, b: string | undefined): number {
    if (!a && !b) return 0;
    if (!a) return 1; // Put tasks without dates at the end
    if (!b) return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  }

  private comparePriorities(a: string | undefined, b: string | undefined): number {
    const weights: Record<string, number> = {
      lowest: 0,
      low: 1,
      normal: 2,
      medium: 3,
      high: 4,
      highest: 5,
    };
    const weightA = weights[normalizePriority(a) || 'normal'] || 2;
    const weightB = weights[normalizePriority(b) || 'normal'] || 2;
    return weightA - weightB;
  }

  private compareStatusTypes(a: Task, b: Task): number {
    const getStatusWeight = (task: Task): number => {
      const symbol = task.statusSymbol || ' ';
      // Simple weight based on symbol
      if (symbol === ' ') return 0; // TODO
      if (symbol === '/') return 1; // IN_PROGRESS
      if (symbol === 'x') return 2; // DONE
      if (symbol === '-') return 3; // CANCELLED
      return 0;
    };

    return getStatusWeight(a) - getStatusWeight(b);
  }

  private getUrgencyScore(task: Task, referenceDate: Date): number {
    return calculateUrgencyScore(task, {
      now: referenceDate,
      settings: this.urgencySettings,
    });
  }

  /**
   * Apply grouping
   */
  private applyGrouping(tasks: Task[], group: GroupNode): Map<string, Task[]> {
    const grouper = this.createGrouper(group.field);
    return grouper.group(tasks);
  }

  private createGrouper(field: string): Grouper {
    switch (field) {
      case 'due':
        return new DueDateGrouper();
      case 'scheduled':
        return new ScheduledDateGrouper();
      case 'status.type':
        return new StatusTypeGrouper();
      case 'status.name':
        return new StatusNameGrouper();
      case 'priority':
        return new PriorityGrouper();
      case 'path':
        return new PathGrouper();
      case 'folder':
        return new FolderGrouper();
      case 'tags':
        return new TagGrouper();
      default:
        throw new QueryExecutionError(`Unknown grouping field: ${field}`);
    }
  }

  /**
   * Generate cache key from query AST
   */
  private generateCacheKey(query: QueryAST): string {
    const parts: string[] = ['query'];
    
    // Add filters
    if (query.filters.length > 0) {
      const filtersKey = query.filters
        .map(f => `${f.type}:${f.operator}:${JSON.stringify(f.value)}`)
        .join('|');
      parts.push(`filters=${filtersKey}`);
    }
    
    // Add sort
    if (query.sort) {
      parts.push(`sort=${query.sort.field}:${query.sort.reverse ? 'desc' : 'asc'}`);
    }
    
    // Add group
    if (query.group) {
      parts.push(`group=${query.group.field}`);
    }
    
    // Add limit
    if (query.limit !== undefined) {
      parts.push(`limit=${query.limit}`);
    }
    
    // Add global filter if present
    if (this.globalFilterAST) {
      parts.push('global=active');
    }
    
    return parts.join(':');
  }
  
  /**
   * Invalidate query cache
   * 
   * Call this when tasks are modified to ensure fresh results.
   * 
   * @param pattern - Optional invalidation pattern ('*' for all, prefix:* for prefix match)
   */
  invalidateCache(pattern?: string): number {
    return this.queryCache.invalidate(pattern);
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.queryCache.getStats();
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Generate human-readable explanation of query
   */
  private generateExplanation(query: QueryAST): string {
    return explainQuery(query);
  }
}
