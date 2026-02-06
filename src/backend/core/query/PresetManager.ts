// @ts-nocheck
import type { Plugin } from 'siyuan';
import { SettingUtils } from "@shared/config/setting-utils";
import type { QueryPreset } from "@backend/core/query/QueryPreset";
import { BUILT_IN_PRESETS, isValidQueryPreset, createQueryPreset } from "@backend/core/query/QueryPreset";
import * as logger from "@backend/logging/logger";

const PRESETS_STORAGE_KEY = 'query-presets';

/**
 * Manages query presets - storage, retrieval, and manipulation
 */
export class PresetManager {
  private settingsStore: SettingUtils<QueryPreset[]>;
  private customPresets: QueryPreset[] = [];
  
  constructor(private plugin: Plugin) {
    this.settingsStore = new SettingUtils(plugin, PRESETS_STORAGE_KEY, []);
  }

  /**
   * Initialize the preset manager
   */
  async initialize(): Promise<void> {
    this.customPresets = await this.settingsStore.load();
    logger.info('Preset manager initialized', {
      customPresetsCount: this.customPresets.length
    });
  }

  /**
   * Get all presets (built-in + custom)
   */
  getAllPresets(): QueryPreset[] {
    return [...BUILT_IN_PRESETS, ...this.customPresets];
  }

  /**
   * Get built-in presets only
   */
  getBuiltInPresets(): QueryPreset[] {
    return BUILT_IN_PRESETS;
  }

  /**
   * Get custom presets only
   */
  getCustomPresets(): QueryPreset[] {
    return this.customPresets;
  }

  /**
   * Get a preset by ID
   */
  getPresetById(id: string): QueryPreset | undefined {
    return this.getAllPresets().find(p => p.id === id);
  }

  /**
   * Search presets by name or description
   */
  searchPresets(query: string): QueryPreset[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllPresets().filter(preset => 
      preset.name.toLowerCase().includes(lowerQuery) ||
      preset.description?.toLowerCase().includes(lowerQuery) ||
      preset.query.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Create a new custom preset
   */
  async createPreset(
    name: string,
    query: string,
    options?: Partial<Omit<QueryPreset, 'id' | 'name' | 'query' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>>
  ): Promise<QueryPreset> {
    const preset = createQueryPreset(name, query, options);
    this.customPresets.push(preset);
    await this.saveCustomPresets();
    logger.info('Created preset', { presetId: preset.id, name: preset.name });
    return preset;
  }

  /**
   * Update an existing custom preset
   */
  async updatePreset(
    id: string,
    updates: Partial<Omit<QueryPreset, 'id' | 'createdAt' | 'isBuiltIn'>>
  ): Promise<QueryPreset | null> {
    const index = this.customPresets.findIndex(p => p.id === id);
    if (index === -1) {
      logger.warn('Preset not found for update', { presetId: id });
      return null;
    }

    const preset = this.customPresets[index];
    if (preset.isBuiltIn) {
      logger.warn('Cannot update built-in preset', { presetId: id });
      return null;
    }

    const updatedPreset: QueryPreset = {
      ...preset,
      ...updates,
      id: preset.id,
      createdAt: preset.createdAt,
      updatedAt: new Date().toISOString(),
      isBuiltIn: false
    };

    this.customPresets[index] = updatedPreset;
    await this.saveCustomPresets();
    logger.info('Updated preset', { presetId: id });
    return updatedPreset;
  }

  /**
   * Delete a custom preset
   */
  async deletePreset(id: string): Promise<boolean> {
    const index = this.customPresets.findIndex(p => p.id === id);
    if (index === -1) {
      return false;
    }

    const preset = this.customPresets[index];
    if (preset.isBuiltIn) {
      logger.warn('Cannot delete built-in preset', { presetId: id });
      return false;
    }

    this.customPresets.splice(index, 1);
    await this.saveCustomPresets();
    logger.info('Deleted preset', { presetId: id });
    return true;
  }

  /**
   * Duplicate a preset (creates a copy as custom preset)
   */
  async duplicatePreset(id: string): Promise<QueryPreset | null> {
    const original = this.getPresetById(id);
    if (!original) {
      return null;
    }

    const copy = createQueryPreset(
      `${original.name} (Copy)`,
      original.query,
      {
        description: original.description,
        icon: original.icon,
        color: original.color
      }
    );

    this.customPresets.push(copy);
    await this.saveCustomPresets();
    logger.info('Duplicated preset', { originalId: id, copyId: copy.id });
    return copy;
  }

  /**
   * Reorder custom presets
   */
  async reorderPresets(orderedIds: string[]): Promise<void> {
    const reordered: QueryPreset[] = [];
    const orderedSet = new Set(orderedIds);  // O(1) lookup
    
    // Add presets in the specified order
    for (const id of orderedIds) {
      const preset = this.customPresets.find(p => p.id === id);
      if (preset) {
        reordered.push(preset);
      }
    }

    // Add any presets not in the ordered list (shouldn't happen, but be safe)
    for (const preset of this.customPresets) {
      if (!orderedSet.has(preset.id)) {
        reordered.push(preset);
      }
    }

    this.customPresets = reordered;
    await this.saveCustomPresets();
    logger.info('Reordered presets');
  }

  /**
   * Import presets (replaces existing custom presets)
   */
  async importPresets(presets: QueryPreset[], merge: boolean = false): Promise<number> {
    const validPresets = presets.filter(isValidQueryPreset);
    
    if (merge) {
      // Merge: Add new presets, update existing ones by ID
      const existingIds = new Set(this.customPresets.map(p => p.id));
      for (const preset of validPresets) {
        const index = this.customPresets.findIndex(p => p.id === preset.id);
        if (index >= 0) {
          this.customPresets[index] = { ...preset, isBuiltIn: false };
        } else {
          this.customPresets.push({ ...preset, isBuiltIn: false });
        }
      }
    } else {
      // Replace: Clear existing and add new
      this.customPresets = validPresets.map(p => ({ ...p, isBuiltIn: false }));
    }

    await this.saveCustomPresets();
    logger.info('Imported presets', { count: validPresets.length, merge });
    return validPresets.length;
  }

  /**
   * Export all custom presets
   */
  exportPresets(): QueryPreset[] {
    return [...this.customPresets];
  }

  /**
   * Clear all custom presets
   */
  async clearCustomPresets(): Promise<void> {
    this.customPresets = [];
    await this.saveCustomPresets();
    logger.info('Cleared all custom presets');
  }

  /**
   * Validate all stored presets and remove invalid ones
   */
  async validateAndClean(): Promise<number> {
    const before = this.customPresets.length;
    this.customPresets = this.customPresets.filter(isValidQueryPreset);
    const removed = before - this.customPresets.length;
    
    if (removed > 0) {
      await this.saveCustomPresets();
      logger.info('Cleaned invalid presets', { removed });
    }
    
    return removed;
  }

  /**
   * Save custom presets to storage
   */
  private async saveCustomPresets(): Promise<void> {
    await this.settingsStore.save(this.customPresets);
  }
}
