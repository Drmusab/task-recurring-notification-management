/**
 * SettingsStore - Svelte store for plugin settings
 */

import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { Settings, getDefaultSettings } from '../domain/models/Settings';

class SettingsStore {
  private store: Writable<Settings>;

  constructor() {
    // Load settings from storage or use defaults
    const savedSettings = this.loadSettings();
    this.store = writable<Settings>(savedSettings || getDefaultSettings());
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
   * Update settings
   */
  updateSettings(updates: Partial<Settings>): void {
    this.store.update((current: Settings) => {
      const newSettings = { ...current, ...updates };
      this.saveSettings(newSettings);
      return newSettings;
    });
  }

  /**
   * Reset to defaults
   */
  resetToDefaults(): void {
    const defaults = getDefaultSettings();
    this.store.set(defaults);
    this.saveSettings(defaults);
  }

  /**
   * Load settings from storage
   */
  private loadSettings(): Settings | null {
    try {
      // In SiYuan, we'd use the plugin storage API
      // For now, use localStorage as fallback
      const stored = localStorage.getItem('task-plugin-settings');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }

    return null;
  }

  /**
   * Save settings to storage
   */
  private saveSettings(settings: Settings): void {
    try {
      // In SiYuan, we'd use the plugin storage API
      localStorage.setItem('task-plugin-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }
}

// Create singleton instance
export const settingsStore = new SettingsStore();
