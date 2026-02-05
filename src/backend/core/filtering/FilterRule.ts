import type { StatusType } from '@backend/core/models/Status';

export type FilterRuleType = 'tag' | 'regex' | 'path' | 'marker';

export interface FilterRule {
  id: string;
  type: FilterRuleType;
  pattern: string;
  enabled: boolean;
  description?: string;
}

export type RegexTarget = 'taskText' | 'path' | 'fileName';

// NEW: Profile interface
export interface GlobalFilterProfile {
  id: string;
  name: string;
  description?: string;

  // Path Scoping
  includePaths: string[]; // glob patterns: daily/**, projects/**
  excludePaths: string[]; // glob patterns (wins over include)

  // Tag Scoping
  includeTags: string[]; // #work, #task (boundary-safe: #work ≠ #workshop)
  excludeTags: string[]; // #archive, #template (wins over include)

  // Regex Scoping
  includeRegex?: string; // task must match
  excludeRegex?: string; // task must NOT match (wins over include)
  regexTargets: RegexTarget[]; // what to match against

  // Status exclusion (carry forward from existing)
  excludeStatusTypes: StatusType[];
}

// NEW: Filter decision interface (for explain mode)
export interface FilterDecision {
  included: boolean;
  reason: string;
  matchedRule?: {
    type:
      | 'includePath'
      | 'excludePath'
      | 'includeTag'
      | 'excludeTag'
      | 'includeRegex'
      | 'excludeRegex';
    pattern: string;
    target?: string; // for regex
  };
}

export interface GlobalFilterConfig {
  enabled: boolean;

  /**
   * Filtering mode:
   * - 'all' means don't filter by rules (but still may exclude by status if profile says so).
   * - 'include' / 'exclude' supported for backward compatibility.
   * - 'tag' means only include tasks with a specific global filter tag.
   */
  mode: 'include' | 'exclude' | 'all' | 'tag';
  
  /** Global filter tag (e.g., "#task") - used when mode is 'tag' */
  tag?: string;
  
  /** Auto-remove global filter tag from task description display */
  removeFromDescription?: boolean;

  // NEW: Profile System
  activeProfileId: string;
  profiles: GlobalFilterProfile[];

  // Legacy fields (deprecated but kept for migration)
  rules?: FilterRule[];
  excludeFolders?: string[];
  excludeNotebooks?: string[];
  excludeTags?: string[];
  excludeFilePatterns?: string[];
  excludeStatusTypes?: StatusType[];
}

/**
 * Validate a filter rule (existing)
 */
export function validateFilterRule(rule: FilterRule): { valid: boolean; error?: string } {
  if (!rule.pattern || rule.pattern.trim().length === 0) {
    return { valid: false, error: 'Pattern cannot be empty' };
  }

  switch (rule.type) {
    case 'regex':
      try {
        new RegExp(rule.pattern);
        return { valid: true };
      } catch (e) {
        return {
          valid: false,
          error: `Invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

    case 'tag':
      if (!rule.pattern.startsWith('#')) {
        return { valid: false, error: 'Tag pattern should start with #' };
      }
      return { valid: true };

    case 'path':
    case 'marker':
      return { valid: true };

    default:
      return { valid: false, error: `Unknown rule type: ${(rule as any).type}` };
  }
}

/**
 * NEW: Validate a profile
 */
export function validateProfile(profile: GlobalFilterProfile): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!profile.name || profile.name.trim().length === 0) {
    errors.push('name: Profile name cannot be empty');
  }

  if (!profile.regexTargets || profile.regexTargets.length === 0) {
    errors.push('regexTargets: Must include at least one target');
  }

  if (profile.includeRegex) {
    try {
      new RegExp(profile.includeRegex);
    } catch (e) {
      errors.push(`includeRegex: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (profile.excludeRegex) {
    try {
      new RegExp(profile.excludeRegex);
    } catch (e) {
      errors.push(`excludeRegex: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Validate tags start with #
  [...profile.includeTags, ...profile.excludeTags].forEach((tag) => {
    if (!tag.startsWith('#')) {
      errors.push(`Invalid tag "${tag}" - must start with #`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Create a new filter rule (existing)
 */
export function createFilterRule(type: FilterRuleType, pattern: string, description?: string): FilterRule {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function'
      ? `rule_${crypto.randomUUID()}`
      : `rule_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  return {
    id,
    type,
    pattern,
    enabled: true,
    description,
  };
}

/**
 * NEW: Default profile
 */
export const DEFAULT_PROFILE: GlobalFilterProfile = {
  id: 'default',
  name: 'Default',
  description: 'Include all tasks',
  includePaths: [],
  excludePaths: [],
  includeTags: [],
  excludeTags: [],
  includeRegex: undefined,
  excludeRegex: undefined,
  regexTargets: ['taskText'],
  excludeStatusTypes: [],
};

/**
 * Default global filter configuration (UPDATED)
 */
export const DEFAULT_GLOBAL_FILTER_CONFIG: GlobalFilterConfig = {
  enabled: false,
  mode: 'all',
  activeProfileId: 'default',
  profiles: [DEFAULT_PROFILE],
};

/**
 * NEW: Helper - get active profile safely
 */
export function getActiveProfile(config: GlobalFilterConfig): GlobalFilterProfile {
  return config.profiles.find((p) => p.id === config.activeProfileId) ?? config.profiles[0] ?? DEFAULT_PROFILE;
}

/**
 * NEW: Migration helper - convert legacy config fields into the default profile (one-time)
 * Call this when loading persisted config.
 */
export function migrateLegacyToProfiles(config: GlobalFilterConfig): GlobalFilterConfig {
  // Already migrated
  if (config.profiles?.length) return config;

  const profile: GlobalFilterProfile = {
    ...DEFAULT_PROFILE,
    // If you had legacy excludes, put them into exclude lists:
    excludePaths: [
      ...(config.excludeFolders ?? []),
      ...(config.excludeNotebooks ?? []),
      ...(config.excludeFilePatterns ?? []),
    ],
    excludeTags: [...(config.excludeTags ?? [])],
    excludeStatusTypes: [...(config.excludeStatusTypes ?? [])],
  };

  return {
    ...config,
    activeProfileId: profile.id,
    profiles: [profile],
  };
}
