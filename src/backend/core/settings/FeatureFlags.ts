/**
 * Feature flags system for gradual rollout of new features
 */

import * as logger from "@backend/logging/logger";

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  requiresRestart?: boolean;
}

export class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();

  constructor() {
    this.initializeDefaultFlags();
  }

  private initializeDefaultFlags(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        key: "emoji-format",
        name: "Emoji Task Format",
        description: "Parse tasks with emoji metadata (📅, ⏳, 🛫)",
        enabled: true,
      },
      {
        key: "dependencies",
        name: "Task Dependencies",
        description: "Enable blocking/blocked task relationships",
        enabled: true,
        requiresRestart: true,
      },
      {
        key: "query-language",
        name: "Advanced Query Language",
        description: "Enable full query syntax with filters and grouping",
        enabled: true,
      },
      {
        key: "filename-date",
        name: "Filename as Date",
        description: "Infer scheduled date from daily note filenames",
        enabled: false,
      },
      {
        key: "performance-profiling",
        name: "Performance Profiling",
        description: "Enable performance monitoring for critical operations",
        enabled: false,
      },
      {
        key: "incremental-index",
        name: "Incremental Task Index",
        description: "Use incremental indexing for better performance",
        enabled: true,
        requiresRestart: true,
      },
    ];

    for (const flag of defaultFlags) {
      this.flags.set(flag.key, flag);
    }
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(key: string): boolean {
    const flag = this.flags.get(key);
    return flag?.enabled ?? false;
  }

  /**
   * Enable a feature flag
   */
  enable(key: string): void {
    const flag = this.flags.get(key);
    if (flag) {
      flag.enabled = true;
      logger.info(`Feature flag enabled: ${flag.name}`);
      
      if (flag.requiresRestart) {
        logger.warn(`Feature "${flag.name}" requires restart to take effect`);
      }
    }
  }

  /**
   * Disable a feature flag
   */
  disable(key: string): void {
    const flag = this.flags.get(key);
    if (flag) {
      flag.enabled = false;
      logger.info(`Feature flag disabled: ${flag.name}`);
      
      if (flag.requiresRestart) {
        logger.warn(`Feature "${flag.name}" requires restart to take effect`);
      }
    }
  }

  /**
   * Get a specific feature flag
   */
  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Set feature flag state
   */
  setFlag(key: string, enabled: boolean): void {
    if (enabled) {
      this.enable(key);
    } else {
      this.disable(key);
    }
  }

  /**
   * Load feature flags from stored configuration
   */
  loadFromConfig(config: Record<string, boolean>): void {
    for (const [key, enabled] of Object.entries(config)) {
      const flag = this.flags.get(key);
      if (flag) {
        flag.enabled = enabled;
      }
    }
    logger.info("Feature flags loaded from configuration");
  }

  /**
   * Export current flag states
   */
  exportConfig(): Record<string, boolean> {
    const config: Record<string, boolean> = {};
    for (const [key, flag] of this.flags) {
      config[key] = flag.enabled;
    }
    return config;
  }

  /**
   * Register a custom feature flag
   */
  registerFlag(flag: FeatureFlag): void {
    if (this.flags.has(flag.key)) {
      logger.warn(`Feature flag already registered: ${flag.key}`);
      return;
    }
    this.flags.set(flag.key, flag);
    logger.info(`Feature flag registered: ${flag.name}`);
  }
}

// Global feature flag manager instance
export const featureFlags = new FeatureFlagManager();
