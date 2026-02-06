// @ts-nocheck
/**
 * StatusSettings - Configuration for task status types
 * 
 * Manages the configuration of task statuses (TODO, DONE, etc.)
 * and provides methods to apply settings to the StatusRegistry.
 */

import { StatusConfiguration, StatusType } from "@shared/constants/statuses/StatusConfiguration";
import type { StatusRegistry } from "@shared/types/StatusRegistry";

/**
 * Status settings interface for storing status configurations
 */
export interface StatusSettings {
  /** Core status configurations (TODO, DONE) */
  coreStatuses: StatusConfiguration[];
  /** Custom user-defined status configurations */
  customStatuses: StatusConfiguration[];
}

/**
 * Default core status configurations
 */
const DEFAULT_CORE_STATUSES: StatusConfiguration[] = [
  new StatusConfiguration(' ', 'Todo', 'x', true, StatusType.TODO),
  new StatusConfiguration('x', 'Done', ' ', true, StatusType.DONE),
];

/**
 * Default status settings
 */
export const DEFAULT_STATUS_SETTINGS: StatusSettings = {
  coreStatuses: DEFAULT_CORE_STATUSES,
  customStatuses: [],
};

/**
 * StatusSettings utility class with static methods for status management
 */
export class StatusSettings {
  /**
   * Apply status settings to a StatusRegistry
   * @param settings - The status settings to apply
   * @param registry - The registry to update
   */
  public static applyToStatusRegistry(settings: StatusSettings, registry: StatusRegistry): void {
    registry.resetToDefaultStatuses();
    
    // Apply core statuses
    for (const status of settings.coreStatuses) {
      registry.add(status);
    }
    
    // Apply custom statuses
    for (const status of settings.customStatuses) {
      registry.add(status);
    }
  }

  /**
   * Get all statuses from settings (both core and custom)
   * @param settings - The status settings
   * @returns Combined array of all status configurations
   */
  public static allStatuses(settings: StatusSettings): StatusConfiguration[] {
    return [...settings.coreStatuses, ...settings.customStatuses];
  }

  /**
   * Create a new StatusSettings with default values
   * @returns Default status settings
   */
  public static createDefault(): StatusSettings {
    return {
      coreStatuses: [...DEFAULT_CORE_STATUSES],
      customStatuses: [],
    };
  }

  /**
   * Add a custom status to settings
   * @param settings - Current settings
   * @param status - Status to add
   * @returns New settings with the status added
   */
  public static addCustomStatus(settings: StatusSettings, status: StatusConfiguration): StatusSettings {
    return {
      ...settings,
      customStatuses: [...settings.customStatuses, status],
    };
  }

  /**
   * Remove a custom status from settings
   * @param settings - Current settings
   * @param symbol - Symbol of the status to remove
   * @returns New settings without the status
   */
  public static removeCustomStatus(settings: StatusSettings, symbol: string): StatusSettings {
    return {
      ...settings,
      customStatuses: settings.customStatuses.filter(s => s.symbol !== symbol),
    };
  }

  /**
   * Find a status by symbol
   * @param settings - The status settings to search
   * @param symbol - The symbol to find
   * @returns The matching status or undefined
   */
  public static findBySymbol(settings: StatusSettings, symbol: string): StatusConfiguration | undefined {
    return this.allStatuses(settings).find(s => s.symbol === symbol);
  }

  /**
   * Check if a symbol is already used
   * @param settings - The status settings to check
   * @param symbol - The symbol to check
   * @returns true if the symbol is in use
   */
  public static hasSymbol(settings: StatusSettings, symbol: string): boolean {
    return this.findBySymbol(settings, symbol) !== undefined;
  }
}
