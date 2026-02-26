/**
 * SettingsStore - Svelte store for plugin settings
 * 
 * REFACTORED: Uses SiYuan's plugin.loadData/saveData API instead of localStorage.
 * The store must be initialized with a plugin reference via initSettingsStore().
 */

import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { Plugin } from 'siyuan';
import type { SettingsDTO } from '../services/DTOs';

/**
 * Alias for internal use — the store holds a SettingsDTO-shaped object.
 * Mutable locally but projected as SettingsDTO to consumers.
 */
type Settings = SettingsDTO;

const SETTINGS_STORAGE_KEY = "ui-settings";
/** Debounce delay for save operations (ms) */
const SAVE_DEBOUNCE_MS = 300;

/** Plugin reference for SiYuan storage API access */
let pluginRef: Plugin | null = null;

/**
 * Produce default settings (inlined from domain — no domain import).
 */
function getDefaultSettings(): Settings {
  return {
    version: '2.0.0',
    debugMode: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'YYYY-MM-DD',
    showRelativeDates: true,
    showPath: true,
    showHeading: true,
    showDescriptionPopover: true,
    virtualScrollThreshold: 100,
    preferredFormat: 'emoji',
    customStatuses: [],
    defaultPriority: 'none',
    useFilenameAsDate: true,
    filenameDatePattern: '^(\\d{4})-(\\d{2})-(\\d{2})',
    defaultQuery: 'not done',
    groupBy: 'none',
    sortBy: 'due',
    sortDirection: 'asc',
    hideCompleted: false,
    autoHideCompletedDays: 30,
    recurrenceFromCompletion: false,
    autoCreateNextTask: true,
    keepCompletedRecurring: true,
    enableDependencies: true,
    showDependencyWarnings: true,
    autoHideBlockedTasks: false,
    enableNotifications: true,
    notificationChannels: ['siyuan'],
    notificationLeadMinutes: 15,
    notifyOverdue: true,
    enableIndexing: true,
    enableQueryCache: true,
    queryCacheTTL: 60,
    saveDebounceDuration: 1000,
    autoArchiveDays: 90,
    storageFilePath: 'data/tasks.json',
    archiveDirectoryPath: 'data/archives',
    enablePartitionedStorage: true,
    partitionBy: 'month',
    enableExperimentalFeatures: false,
    enableAISuggestions: false,
    enableSmartRecurrence: false,
    smartRecurrenceConfidence: 0.8,
  };
}

/**
 * Merge partial settings with defaults and clamp numeric ranges.
 * Inlined from domain — no domain import.
 */
function validateSettings(settings: Partial<Settings>): Settings {
  const defaults = getDefaultSettings();
  return {
    ...defaults,
    ...settings,
    virtualScrollThreshold: Math.max(10, (settings.virtualScrollThreshold as number) || defaults.virtualScrollThreshold),
    autoHideCompletedDays: Math.max(0, (settings.autoHideCompletedDays as number) || defaults.autoHideCompletedDays),
    notificationLeadMinutes: Math.max(0, (settings.notificationLeadMinutes as number) || defaults.notificationLeadMinutes),
    queryCacheTTL: Math.max(0, (settings.queryCacheTTL as number) || defaults.queryCacheTTL),
    saveDebounceDuration: Math.max(0, (settings.saveDebounceDuration as number) || defaults.saveDebounceDuration),
    autoArchiveDays: Math.max(0, (settings.autoArchiveDays as number) || defaults.autoArchiveDays),
    smartRecurrenceConfidence: Math.max(0, Math.min(1, (settings.smartRecurrenceConfidence as number) || defaults.smartRecurrenceConfidence)),
  } as Settings;
}

class SettingsStore {
  private store: Writable<Settings>;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Start with defaults; actual load happens async in initSettingsStore()
    this.store = writable<Settings>(getDefaultSettings());
  }

  /**
   * Subscribe to store updates
   */
  subscribe = this.store.subscribe;

  /**
   * Get current settings
   */
  getSettings(): Settings {
    return get(this.store);
  }

  /**
   * Initialize store from SiYuan plugin storage (async)
   * Called by plugin's onload() after setting the plugin reference.
   */
  async load(): Promise<void> {
    if (!pluginRef) {
      console.warn("[SettingsStore] No plugin reference — using defaults");
      return;
    }

    try {
      const stored = await pluginRef.loadData(SETTINGS_STORAGE_KEY);
      if (stored && typeof stored === "object") {
        // Merge with defaults (new fields from updates) and validate ranges
        const merged = validateSettings(stored as Partial<Settings>);
        this.store.set(merged);
        console.info("[SettingsStore] Loaded settings from SiYuan storage");
      }
    } catch (error) {
      console.error("[SettingsStore] Failed to load settings:", error);
    }
  }

  /**
   * Update settings and persist via SiYuan plugin API
   */
  updateSettings(updates: Partial<Settings>): void {
    this.store.update((current: Settings) => {
      const newSettings = { ...current, ...updates };
      this.persistSettings(newSettings);
      return newSettings;
    });
  }

  /**
   * Reset to defaults and persist
   */
  resetToDefaults(): void {
    const defaults = getDefaultSettings();
    this.store.set(defaults);
    this.persistSettings(defaults);
  }

  /**
   * Cancel any pending debounced save. Called on plugin unload to prevent
   * writes after the plugin instance is destroyed.
   */
  cancelPendingSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /**
   * Persist settings to SiYuan storage (debounced to avoid redundant writes).
   * Rapid calls within SAVE_DEBOUNCE_MS collapse into a single write.
   */
  private persistSettings(settings: Settings): void {
    if (!pluginRef) {
      console.warn("[SettingsStore] Cannot save — no plugin reference");
      return;
    }

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      pluginRef!.saveData(SETTINGS_STORAGE_KEY, settings).catch((error) => {
        console.error("[SettingsStore] Failed to save settings:", error);
      });
    }, SAVE_DEBOUNCE_MS);
  }
}

// Create singleton instance
export const settingsStore = new SettingsStore();

/**
 * Initialize the settings store with a plugin reference.
 * Must be called from the plugin's onload() method.
 *
 * @param plugin - The SiYuan Plugin instance for storage API access
 */
export async function initSettingsStore(plugin: Plugin): Promise<void> {
  pluginRef = plugin;
  await settingsStore.load();
}

/**
 * Reset module-level state on plugin unload.
 * Prevents stale plugin references and pending timers from leaking across hot-reloads.
 */
export function resetSettingsStore(): void {
  settingsStore.cancelPendingSave();
  pluginRef = null;
}
