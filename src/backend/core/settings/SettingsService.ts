/**
 * Settings Service - manages plugin settings
 */

import type { Plugin } from "siyuan";
import type { PluginSettings } from "@backend/core/settings/PluginSettings";
import { DEFAULT_SETTINGS, mergeSettings } from "@backend/core/settings/PluginSettings";
import { pluginEventBus } from "@backend/core/events/PluginEventBus";

const PLUGIN_SETTINGS_KEY = "plugin-settings";

/**
 * Settings service for loading and saving plugin settings
 */
export class SettingsService {
  private plugin: Plugin;
  private settings: PluginSettings;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.settings = DEFAULT_SETTINGS;
  }

  /**
   * Load settings from storage
   */
  async load(): Promise<void> {
    try {
      const data = await this.plugin.loadData(PLUGIN_SETTINGS_KEY);
      if (data && typeof data === 'object') {
        this.settings = mergeSettings(data as Partial<PluginSettings>);
      }
    } catch (err) {
      console.error("Failed to load plugin settings:", err);
    }
  }

  /**
   * Save settings to storage
   */
  async save(settings: PluginSettings): Promise<void> {
    this.settings = settings;
    await this.plugin.saveData(PLUGIN_SETTINGS_KEY, settings);
    pluginEventBus.emit("task:refresh", undefined);
  }

  /**
   * Get current settings
   */
  get(): PluginSettings {
    return this.settings;
  }

  /**
   * Update specific settings
   */
  async update(partial: Partial<PluginSettings>): Promise<void> {
    this.settings = mergeSettings(partial);
    await this.plugin.saveData(PLUGIN_SETTINGS_KEY, this.settings);
    pluginEventBus.emit("task:refresh", undefined);
  }
}
