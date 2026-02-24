/**
 * SettingsStore - Svelte store for plugin settings
 * 
 * REFACTORED: Uses SiYuan's plugin.loadData/saveData API instead of localStorage.
 * The store must be initialized with a plugin reference via initSettingsStore().
 */

import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { Plugin } from 'siyuan';
import { type Settings, getDefaultSettings } from '@domain/models/Settings';

const SETTINGS_STORAGE_KEY = "ui-settings";

/** Plugin reference for SiYuan storage API access */
let pluginRef: Plugin | null = null;

class SettingsStore {
  private store: Writable<Settings>;

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
        const defaults = getDefaultSettings();
        this.store.set({ ...defaults, ...stored });
        console.log("[SettingsStore] Loaded settings from SiYuan storage");
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
   * Persist settings to SiYuan storage (debounced-safe, fire-and-forget)
   */
  private persistSettings(settings: Settings): void {
    if (!pluginRef) {
      console.warn("[SettingsStore] Cannot save — no plugin reference");
      return;
    }

    pluginRef.saveData(SETTINGS_STORAGE_KEY, settings).catch((error) => {
      console.error("[SettingsStore] Failed to save settings:", error);
    });
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
