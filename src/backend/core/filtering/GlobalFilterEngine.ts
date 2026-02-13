// @ts-nocheck
import type { GlobalFilterConfig, FilterRule } from "@backend/core/filtering/FilterRule";
import { StatusRegistry } from '@backend/core/models/StatusRegistry';
import type { StatusType } from '@backend/core/models/Status';
import type { Task } from '@backend/core/models/Task';

/**
 * Engine for evaluating global filter rules
 */
export class GlobalFilterEngine {
  private config: GlobalFilterConfig;
  private compiledExcludeFolders: RegExp[] = [];
  private compiledExcludeNotebooks: RegExp[] = [];
  private compiledExcludeTags: RegExp[] = [];
  private compiledExcludeFilePatterns: RegExp[] = [];
  private statusRegistry = StatusRegistry.getInstance();
  private tagRuleCache = new Map<string, RegExp>();
  private regexRuleCache = new Map<string, RegExp | null>();

  constructor(config: GlobalFilterConfig) {
    this.config = this.normalizeConfig(config);
    this.compileExclusions();
  }

  /**
   * Evaluate whether a block should be treated as a task
   * @param blockContent - The markdown content of the block
   * @param blockPath - Optional path to the document (for path filtering)
   * @returns true if block passes filter (should be treated as task)
   */
  evaluate(blockContent: string, blockPath?: string): boolean {
    if (!this.config.enabled) {
      return true;
    }

    if (!this.passesExclusions(blockContent, blockPath)) {
      return false;
    }

    // If mode is 'all', pass everything after exclusions
    if (this.config.mode === 'all') {
      return true;
    }

    const activeRules = this.getActiveRules();
    if (activeRules.length === 0) {
      // No rules = pass all (default behavior)
      return true;
    }

    // Evaluate each rule
    if (this.config.mode === 'include') {
      const pathRules = activeRules.filter(rule => rule.type === 'path');
      const otherRules = activeRules.filter(rule => rule.type !== 'path');
      const pathMatch = pathRules.length === 0
        ? true
        : pathRules.some(rule => this.evaluateRule(rule, blockContent, blockPath));
      const otherMatch = otherRules.length === 0
        ? true
        : otherRules.some(rule => this.evaluateRule(rule, blockContent, blockPath));
      return pathMatch && otherMatch;
    }

    // Exclude mode: pass if NO rule matches (NOR logic)
    const anyMatch = activeRules.some(rule =>
      this.evaluateRule(rule, blockContent, blockPath)
    );
    return !anyMatch;
  }

  /**
   * Update filter configuration
   */
  updateConfig(config: GlobalFilterConfig): void {
    this.config = this.normalizeConfig(config);
    this.tagRuleCache.clear();
    this.regexRuleCache.clear();
    this.compileExclusions();
  }

  /**
   * Get current configuration
   */
  getConfig(): GlobalFilterConfig {
    return this.config;
  }

  /**
   * Test a single rule against content
   */
  private evaluateRule(rule: FilterRule, content: string, path?: string): boolean {
    switch (rule.type) {
      case 'tag': {
        const tags = this.extractTags(content);
        // Support wildcards: #work/* matches #work/urgent
        const regex = this.getTagRuleRegex(rule);
        return tags.some(tag => regex.test(tag));
      }

      case 'regex':
        return this.testRegexRule(rule, content);

      case 'path':
        if (!path) return false;
        const normalizedPath = this.normalizePath(path);
        return normalizedPath.includes(rule.pattern);

      case 'marker':
        // Custom marker like "TODO:", "TASK:"
        return content.includes(rule.pattern);

      default:
        return false;
    }
  }

  /**
   * Evaluate filter against a task (for previews)
   */
  evaluateTask(task: Task): boolean {
    if (!this.config.enabled) {
      return true;
    }

    const content = task.linkedBlockContent ?? task.name ?? '';
    const path = task.path;

    if (!this.passesExclusions(content, path, task.statusSymbol, task.tags)) {
      return false;
    }

    if (this.config.mode === 'all') {
      return true;
    }

    const activeRules = this.getActiveRules();
    if (activeRules.length === 0) {
      return true;
    }

    if (this.config.mode === 'include') {
      const pathRules = activeRules.filter(rule => rule.type === 'path');
      const otherRules = activeRules.filter(rule => rule.type !== 'path');
      const pathMatch = pathRules.length === 0
        ? true
        : pathRules.some(rule => this.evaluateRule(rule, content, path));
      const otherMatch = otherRules.length === 0
        ? true
        : otherRules.some(rule => this.evaluateRule(rule, content, path));
      return pathMatch && otherMatch;
    }
    const anyMatch = activeRules.some(rule =>
      this.evaluateRule(rule, content, path)
    );
    return !anyMatch;
  }

  /**
   * Extract tags from content
   */
  private extractTags(content: string): string[] {
    const tagMatches = content.match(/#[\w/-]+/g);
    return tagMatches || [];
  }

  private passesExclusions(
    content: string,
    path?: string,
    statusSymbol?: string,
    tags?: string[]
  ): boolean {
    const normalizedPath = path ? this.normalizePath(path) : undefined;
    const tagList = tags ?? this.extractTags(content);

    if (normalizedPath) {
      if (this.compiledExcludeFolders.some(regex => regex.test(normalizedPath))) {
        return false;
      }
      if (this.compiledExcludeNotebooks.some(regex => regex.test(normalizedPath))) {
        return false;
      }
      if (this.compiledExcludeFilePatterns.some(regex => regex.test(normalizedPath))) {
        return false;
      }
    }

    if (tagList.length > 0 && this.compiledExcludeTags.length > 0) {
      if (tagList.some(tag => this.compiledExcludeTags.some(regex => regex.test(tag)))) {
        return false;
      }
    }

    if (this.config.excludeStatusTypes.length > 0) {
      const type = this.resolveStatusType(statusSymbol, content);
      if (type && this.config.excludeStatusTypes.includes(type)) {
        return false;
      }
    }

    return true;
  }

  private resolveStatusType(statusSymbol?: string, content?: string): StatusType | null {
    const symbol = statusSymbol ?? this.extractStatusSymbol(content ?? '');
    if (!symbol) {
      return null;
    }
    return this.statusRegistry.get(symbol).type;
  }

  private extractStatusSymbol(content: string): string | null {
    const match = content.match(/^\s*-\s*\[(.)\]/);
    return match ? match[1] : null;
  }

  private normalizeConfig(config: GlobalFilterConfig): GlobalFilterConfig {
    return {
      ...config,
      rules: config.rules ?? [],
      excludeFolders: config.excludeFolders ?? [],
      excludeNotebooks: config.excludeNotebooks ?? [],
      excludeTags: config.excludeTags ?? [],
      excludeFilePatterns: config.excludeFilePatterns ?? [],
      excludeStatusTypes: config.excludeStatusTypes ?? [],
    };
  }

  private getActiveRules(): FilterRule[] {
    return this.config.rules.filter(rule => rule.enabled);
  }

  private getTagRuleRegex(rule: FilterRule): RegExp {
    const cacheKey = `${rule.id}:${rule.pattern}`;
    const cached = this.tagRuleCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const pattern = rule.pattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    this.tagRuleCache.set(cacheKey, regex);
    return regex;
  }

  private testRegexRule(rule: FilterRule, content: string): boolean {
    const cacheKey = `${rule.id}:${rule.pattern}`;
    if (this.regexRuleCache.has(cacheKey)) {
      const cached = this.regexRuleCache.get(cacheKey);
      return cached ? cached.test(content) : false;
    }

    try {
      // Parse regex pattern with flags if provided (e.g., /pattern/flags)
      const regexMatch = rule.pattern.match(/^\/(.+)\/([gimsuy]*)$/);
      const regex = regexMatch
        ? new RegExp(regexMatch[1], regexMatch[2])
        : new RegExp(rule.pattern);
      this.regexRuleCache.set(cacheKey, regex);
      return regex.test(content);
    } catch {
      this.regexRuleCache.set(cacheKey, null);
      return false; // Invalid regex = no match
    }
  }

  private compileExclusions(): void {
    this.compiledExcludeFolders = this.config.excludeFolders.map(pattern =>
      this.compilePathPattern(pattern)
    );
    this.compiledExcludeNotebooks = this.config.excludeNotebooks.map(pattern =>
      this.compilePathPattern(pattern)
    );
    this.compiledExcludeFilePatterns = this.config.excludeFilePatterns.map(pattern =>
      this.compilePathPattern(pattern)
    );
    this.compiledExcludeTags = this.config.excludeTags.map(tag => this.compileTagPattern(tag));
  }

  private compileTagPattern(pattern: string): RegExp {
    const sanitized = pattern.trim();
    if (!sanitized) {
      return /^$/;
    }
    const wildcard = sanitized.replace(/\*/g, '.*');
    return new RegExp(`^${wildcard}$`, 'i');
  }

  private compilePathPattern(pattern: string): RegExp {
    const trimmed = pattern.trim();
    if (!trimmed) {
      return /^$/;
    }
    const regexLiteral = trimmed.match(/^\/(.+)\/([gimsuy]*)$/);
    if (regexLiteral) {
      try {
        return new RegExp(regexLiteral[1], regexLiteral[2]);
      } catch {
        return /^$/;
      }
    }
    return this.globToRegExp(trimmed);
  }

  private globToRegExp(pattern: string): RegExp {
    const normalized = this.normalizePath(pattern);
    let regexSource = normalized
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '::DOUBLE_STAR::')
      .replace(/\*/g, '[^/]*')
      .replace(/::DOUBLE_STAR::/g, '.*');
    if (!regexSource.startsWith('.*')) {
      regexSource = `.*${regexSource}`;
    }
    return new RegExp(regexSource);
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
  }
}
