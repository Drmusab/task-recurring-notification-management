import { Minimatch } from 'minimatch';
import type { Task } from '@backend/core/models/Task';
import type { 
  GlobalFilterProfile, 
  FilterDecision, 
  RegexTarget, 
  GlobalFilterConfig 
} from "@backend/core/filtering/FilterRule";
import { DEFAULT_GLOBAL_FILTER_CONFIG } from "@backend/core/filtering/FilterRule";

/**
 * Precompiled filter for maximum performance
 * ONE instance per active profile
 */
export class CompiledGlobalFilter {
  private includePathMatchers: Minimatch[] = [];
  private excludePathMatchers: Minimatch[] = [];
  private includeTagsSet: Set<string> = new Set();
  private excludeTagsSet: Set<string> = new Set();
  private includeRegex?: RegExp;
  private excludeRegex?: RegExp;
  private regexTargets: Set<RegexTarget>;
  
  constructor(profile: GlobalFilterProfile) {
    // Compile glob patterns
    this.includePathMatchers = profile.includePaths.map(p => 
      new Minimatch(this.normalizePath(p), { dot: true, matchBase: true })
    );
    this.excludePathMatchers = profile.excludePaths.map(p => 
      new Minimatch(this.normalizePath(p), { dot: true, matchBase: true })
    );
    
    // Compile tag sets (boundary-safe)
    this.includeTagsSet = new Set(profile.includeTags.map(t => this.normalizeTag(t)));
    this.excludeTagsSet = new Set(profile.excludeTags. map(t => this.normalizeTag(t)));
    
    // Compile regex (safe - invalid regex = disabled)
    if (profile.includeRegex) {
      try { 
        this.includeRegex = new RegExp(profile. includeRegex); 
      } catch { 
        /* invalid = disabled */ 
      }
    }
    if (profile.excludeRegex) {
      try { 
        this.excludeRegex = new RegExp(profile.excludeRegex); 
      } catch { 
        /* invalid = disabled */ 
      }
    }
    
    this.regexTargets = new Set(profile.regexTargets);
  }
  
  /**
   * Fast boolean check
   */
  matches(task: Task): boolean {
    const path = task.path ? this.normalizePath(task.path) : undefined;
    const tags = task.tags ?? [];
    const taskText = task.name || '';
    const hasRegexTaskText = this.regexTargets.has('taskText');
    const hasRegexPath = this.regexTargets.has('path');
    const hasRegexFileName = this.regexTargets.has('fileName');
    let fileName: string | undefined;

    if (this.excludePathMatchers.length > 0 && path) {
      for (const matcher of this.excludePathMatchers) {
        if (matcher.match(path)) {
          return false;
        }
      }
    }

    if (this.includePathMatchers.length > 0) {
      if (!path) {
        return false;
      }
      let matched = false;
      for (const matcher of this.includePathMatchers) {
        if (matcher.match(path)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        return false;
      }
    }

    if (this.excludeTagsSet.size > 0 && tags.length > 0) {
      for (const tag of tags) {
        if (this.excludeTagsSet.has(this.normalizeTag(tag))) {
          return false;
        }
      }
    }

    if (this.includeTagsSet.size > 0) {
      if (tags.length === 0) {
        return false;
      }
      let matched = false;
      for (const tag of tags) {
        if (this.includeTagsSet.has(this.normalizeTag(tag))) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        return false;
      }
    }

    if (this.excludeRegex) {
      if (hasRegexTaskText && this.excludeRegex.test(taskText)) {
        return false;
      }
      if (hasRegexPath && path && this.excludeRegex.test(path)) {
        return false;
      }
      if (hasRegexFileName) {
        fileName = path ? this.extractFileName(path) : task.path ? this.extractFileName(task.path) : undefined;
        if (fileName && this.excludeRegex.test(fileName)) {
          return false;
        }
      }
    }

    if (this.includeRegex) {
      let matched = false;
      if (hasRegexTaskText && this.includeRegex.test(taskText)) {
        matched = true;
      } else if (hasRegexPath && path && this.includeRegex.test(path)) {
        matched = true;
      } else if (hasRegexFileName) {
        fileName = fileName ?? (path ? this.extractFileName(path) : task.path ? this.extractFileName(task.path) : undefined);
        if (fileName && this.includeRegex.test(fileName)) {
          matched = true;
        }
      }
      if (!matched) {
        return false;
      }
    }

    return true;
  }
  
  /**
   * Explain decision (for debugging)
   * 
   * Evaluation order (fastest first):
   * 1. Exclude paths
   * 2. Include paths (if non-empty)
   * 3.  Exclude tags
   * 4. Include tags (if non-empty)
   * 5. Exclude regex
   * 6. Include regex
   * 
   * Exclude always wins. 
   */
  explain(task: Task): FilterDecision {
    const path = task.path ? this.normalizePath(task.path) : undefined;
    const tags = task.tags ?? [];
    const taskText = task.name || '';
    const hasRegexTaskText = this.regexTargets.has('taskText');
    const hasRegexPath = this.regexTargets.has('path');
    const hasRegexFileName = this.regexTargets.has('fileName');
    let fileName: string | undefined;
    
    // 1. Exclude paths (fastest first, wins)
    if (this.excludePathMatchers.length > 0 && path) {
      for (const matcher of this.excludePathMatchers) {
        if (matcher.match(path)) {
          return {
            included: false,
            reason: 'Excluded by path pattern',
            matchedRule: { type: 'excludePath', pattern: matcher.pattern },
          };
        }
      }
    }
    
    // 2. Include paths (if non-empty, must match one)
    if (this.includePathMatchers.length > 0) {
      if (!path) {
        return {
          included: false,
          reason: 'includePaths set but task has no path metadata',
        };
      }
      let matched = false;
      for (const matcher of this.includePathMatchers) {
        if (matcher.match(path)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        return {
          included: false,
          reason: 'Did not match any includePath pattern',
        };
      }
    }
    
    // 3. Exclude tags (wins)
    if (this.excludeTagsSet.size > 0 && tags.length > 0) {
      for (const tag of tags) {
        const normalizedTag = this.normalizeTag(tag);
        if (this.excludeTagsSet.has(normalizedTag)) {
          return {
            included: false,
            reason:  'Excluded by tag',
            matchedRule: { type: 'excludeTag', pattern: normalizedTag },
          };
        }
      }
    }
    
    // 4. Include tags (if non-empty, must have at least one)
    if (this.includeTagsSet. size > 0) {
      if (tags.length === 0) {
        return {
          included: false,
          reason:  'includeTags set but task has no tags',
        };
      }
      let matched = false;
      for (const tag of tags) {
        if (this.includeTagsSet.has(this.normalizeTag(tag))) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        return {
          included: false,
          reason: 'Did not match any includeTag',
        };
      }
    }
    
    // 5. Exclude regex (wins)
    if (this.excludeRegex) {
      if (hasRegexTaskText && this.excludeRegex.test(taskText)) {
        return {
          included: false,
          reason: 'Excluded by regex',
          matchedRule: { type: 'excludeRegex', pattern: this.excludeRegex.source, target: 'taskText' },
        };
      }
      if (hasRegexPath && path && this.excludeRegex.test(path)) {
        return {
          included: false,
          reason: 'Excluded by regex',
          matchedRule: { type: 'excludeRegex', pattern: this.excludeRegex.source, target: 'path' },
        };
      }
      if (hasRegexFileName) {
        fileName = path ? this.extractFileName(path) : task.path ? this.extractFileName(task.path) : undefined;
        if (fileName && this.excludeRegex.test(fileName)) {
          return {
            included: false,
            reason: 'Excluded by regex',
            matchedRule: { type: 'excludeRegex', pattern: this.excludeRegex.source, target: 'fileName' },
          };
        }
      }
    }
    
    // 6. Include regex (must match)
    if (this.includeRegex) {
      let matched = false;
      if (hasRegexTaskText && this.includeRegex.test(taskText)) {
        matched = true;
      } else if (hasRegexPath && path && this.includeRegex.test(path)) {
        matched = true;
      } else if (hasRegexFileName) {
        fileName = fileName ?? (path ? this.extractFileName(path) : task.path ? this.extractFileName(task.path) : undefined);
        if (fileName && this.includeRegex.test(fileName)) {
          matched = true;
        }
      }
      if (!matched) {
        return {
          included: false,
          reason: 'Did not match includeRegex',
          matchedRule: { type: 'includeRegex', pattern: this.includeRegex.source },
        };
      }
    }
    
    // Passed all filters
    return { included: true, reason: 'Passed all filters' };
  }
  
  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '');
  }
  
  private normalizeTag(tag: string): string {
    return tag.startsWith('#') ? tag.toLowerCase() : `#${tag}`.toLowerCase();
  }
  
  private extractFileName(path:  string): string {
    return path.split('/').pop() || '';
  }
}

/**
 * Singleton Global Filter (UPDATED with profiles support)
 */
export class GlobalFilter {
  private static instance: GlobalFilter;
  private config: GlobalFilterConfig;
  private compiled: CompiledGlobalFilter | null = null;
  
  private constructor() {
    this.config = DEFAULT_GLOBAL_FILTER_CONFIG;
  }
  
  static getInstance(): GlobalFilter {
    if (! GlobalFilter.instance) {
      GlobalFilter.instance = new GlobalFilter();
    }
    return GlobalFilter.instance;
  }
  
  initialize(config: GlobalFilterConfig): void {
    this.updateConfig(config);
  }
  
  updateConfig(config: GlobalFilterConfig): void {
    this.config = config;
    this.compile();
  }
  
  private compile(): void {
    if (!this.config.enabled) {
      this.compiled = null;
      return;
    }
    
    const activeProfile = this.config.profiles.find(p => p.id === this.config.activeProfileId) 
      || this.config.profiles[0];
    
    if (!activeProfile) {
      this.compiled = null;
      return;
    }
    
    this.compiled = new CompiledGlobalFilter(activeProfile);
  }
  
  /**
   * Call BEFORE parsing (raw block content)
   */
  shouldTreatAsTask(blockContent: string, blockPath?: string): boolean {
    if (!this.config.enabled) return true;
    
    // Tag-based mode: check for global filter tag
    if (this.config.mode === 'tag' && this.config.tag) {
      const tags = this.extractTagsFromContent(blockContent);
      const normalizedFilterTag = this.normalizeTag(this.config.tag);
      return tags.some(tag => this.normalizeTag(tag) === normalizedFilterTag);
    }
    
    // Profile-based filtering
    if (!this.compiled) return true;
    
    // Extract tags from raw content for early filtering
    const tags = this.extractTagsFromContent(blockContent);
    const mockTask: Partial<Task> = {
      name: blockContent,
      path: blockPath,
      tags,
    };
    
    return this.compiled.matches(mockTask as Task);
  }
  
  /**
   * Call AFTER parsing (full task object)
   */
  shouldIncludeTask(task: Task): boolean {
    if (!this.config.enabled) return true;
    
    // Tag-based mode: check for global filter tag
    if (this.config.mode === 'tag' && this.config.tag) {
      const normalizedFilterTag = this.normalizeTag(this.config.tag);
      return (task.tags || []).some(tag => this.normalizeTag(tag) === normalizedFilterTag);
    }
    
    // Profile-based filtering
    if (!this.compiled) return true;
    return this.compiled.matches(task);
  }
  
  /**
   * Explain why task was excluded (for debugging)
   */
  explainTask(task: Task): FilterDecision {
    if (!this.compiled) {
      return { included: true, reason: 'Global filter disabled' };
    }
    return this.compiled.explain(task);
  }
  
  private extractTagsFromContent(content: string): string[] {
    return (content.match(/#[\w\/-]+/g) || []);
  }
  
  private normalizeTag(tag: string): string {
    return tag.startsWith('#') ? tag.toLowerCase() : `#${tag}`.toLowerCase();
  }
  
  getConfig(): GlobalFilterConfig {
    return this.config;
  }
  
  getActiveProfile(): GlobalFilterProfile | undefined {
    return this.config.profiles.find(p => p.id === this.config.activeProfileId);
  }
  
  setActiveProfile(profileId: string): void {
    if (this.config.profiles.some(p => p.id === profileId)) {
      this.config.activeProfileId = profileId;
      this.compile();
    }
  }
  
  /**
   * Reset to default (for testing)
   */
  reset(): void {
    this.updateConfig(DEFAULT_GLOBAL_FILTER_CONFIG);
  }
  
  /**
   * Remove global filter tag from task description (if removeFromDescription is true)
   */
  removeTagFromDescription(description: string): string {
    if (!this.config.enabled || this.config.mode !== 'tag' || !this.config.tag || !this.config.removeFromDescription) {
      return description;
    }
    
    // Create and cache the regex if not already cached
    if (!this.cachedTagRemovalRegex || this.lastCachedTag !== this.config.tag) {
      const normalizedFilterTag = this.normalizeTag(this.config.tag);
      this.cachedTagRemovalRegex = new RegExp(`\\s*${normalizedFilterTag.replace('#', '\\#')}\\s*`, 'gi');
      this.lastCachedTag = this.config.tag;
    }
    
    return description.replace(this.cachedTagRemovalRegex, ' ').trim();
  }
  
  private cachedTagRemovalRegex?: RegExp;
  private lastCachedTag?: string;
}
