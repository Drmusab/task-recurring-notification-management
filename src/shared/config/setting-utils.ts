import type { Plugin } from "siyuan";

/**
 * SettingUtils provides type-safe settings management with automatic persistence.
 * Based on patterns from siyuan-plugin-task-note-management (libs/setting-utils.ts)
 */
export class SettingUtils<T extends Record<string, any>> {
  private plugin: Plugin;
  private storageKey: string;
  private settings: T;
  private defaults: T;

  constructor(plugin: Plugin, storageKey: string, defaults: T) {
    this.plugin = plugin;
    this.storageKey = storageKey;
    this.defaults = { ...defaults };
    this.settings = { ...defaults };
  }

  /**
   * Load settings from storage
   */
  async load(): Promise<T> {
    try {
      const data = await this.plugin.loadData(this.storageKey);
      if (data) {
        this.settings = { ...this.defaults, ...data };
      }
    } catch (err) {
      console.error(`Failed to load settings from ${this.storageKey}:`, err);
      this.settings = { ...this.defaults };
    }
    return this.settings;
  }

  /**
   * Save settings to storage
   */
  async save(settings?: T): Promise<void> {
    if (settings) {
      this.settings = settings;
    }
    try {
      await this.plugin.saveData(this.storageKey, this.settings);
    } catch (err) {
      console.error(`Failed to save settings to ${this.storageKey}:`, err);
      throw err;
    }
  }

  /**
   * Get current settings
   */
  get(): T {
    return { ...this.settings };
  }

  /**
   * Update specific setting
   */
  async set<K extends keyof T>(key: K, value: T[K]): Promise<void> {
    this.settings[key] = value;
    await this.save();
  }

  /**
   * Reset to defaults
   */
  async reset(): Promise<void> {
    this.settings = { ...this.defaults };
    await this.save();
  }

  /**
   * Check if a setting exists
   */
  has<K extends keyof T>(key: K): boolean {
    return key in this.settings;
  }

  /**
   * Get a specific setting with type safety
   */
  getValue<K extends keyof T>(key: K): T[K] {
    return this.settings[key];
  }
}
