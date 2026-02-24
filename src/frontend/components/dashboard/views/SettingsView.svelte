<script lang="ts">
  /**
   * SettingsView Component - Full settings editor in dock panel
   * Displays toggles for plugin settings and migration status.
   * Changes are saved via SiYuan plugin.saveData() API.
   */
  import type { PluginSettings } from "@backend/core/settings/PluginSettings";
  import type { Plugin } from "siyuan";

  export let tabPanelId: string;
  export let settingsTabId: string;
  export let migrationStats: { migratable: number; alreadyMigrated: number };
  export let settings: PluginSettings;
  export let plugin: Plugin;

  async function saveSettings() {
    try {
      await plugin.saveData("settings", settings);
    } catch (err) {
      console.error("[SettingsView] Failed to save settings:", err);
    }
  }

  function toggleSetting(section: string, key: string) {
    (settings as any)[section][key] = !(settings as any)[section][key];
    // Trigger Svelte reactivity
    settings = settings;
    saveSettings();
  }
</script>

<div 
  class="rtm-settings-panel" 
  role="tabpanel" 
  id={tabPanelId}
  aria-labelledby={settingsTabId}
  tabindex="0"
>
  <h3>Settings</h3>
  
  <!-- Recurrence Settings -->
  <div class="rtm-settings-section">
    <h4>🔄 Recurrence</h4>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Use RRule by default</span>
        <div class="b3-label__text">Use RFC 5545 RRule format for new tasks</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={settings.recurrence.useRRuleByDefault}
        on:change={() => toggleSetting('recurrence', 'useRRuleByDefault')} />
    </label>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Auto-migrate on edit</span>
        <div class="b3-label__text">Convert legacy tasks to RRule when edited</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={settings.recurrence.autoMigrateOnEdit}
        on:change={() => toggleSetting('recurrence', 'autoMigrateOnEdit')} />
    </label>
  </div>

  <!-- Date Tracking Settings -->
  <div class="rtm-settings-section">
    <h4>📅 Date Tracking</h4>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Auto-add done date</span>
        <div class="b3-label__text">Automatically set done date when completing tasks</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={settings.dates.autoAddDone}
        on:change={() => toggleSetting('dates', 'autoAddDone')} />
    </label>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Auto-add created date</span>
        <div class="b3-label__text">Automatically set created date when creating tasks</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={settings.dates.autoAddCreated}
        on:change={() => toggleSetting('dates', 'autoAddCreated')} />
    </label>
  </div>

  <!-- Block Actions Settings -->
  <div class="rtm-settings-section">
    <h4>🧱 Block Actions</h4>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Enable block actions</span>
        <div class="b3-label__text">Link tasks to SiYuan blocks for smart actions</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={settings.blockActions.enabled}
        on:change={() => toggleSetting('blockActions', 'enabled')} />
    </label>
  </div>

  <!-- Migration Status -->
  <div class="rtm-settings-section">
    <h4>📊 Migration Status</h4>
    <div class="rtm-migration-stats">
      <div class="rtm-stat">
        <span class="rtm-stat-value">{migrationStats.alreadyMigrated}</span>
        <span class="rtm-stat-label">Tasks using RRule</span>
      </div>
      <div class="rtm-stat">
        <span class="rtm-stat-value">{migrationStats.migratable}</span>
        <span class="rtm-stat-label">Legacy tasks remaining</span>
      </div>
    </div>

    {#if migrationStats.migratable > 0}
      <div class="rtm-warning-box" role="alert">
        ⚠️ {migrationStats.migratable} legacy task(s) detected. They will be auto-migrated on next plugin reload.
      </div>
    {:else}
      <div class="rtm-success-box" role="status">
        ✅ All tasks migrated to RRule format!
      </div>
    {/if}
  </div>
</div>

<style>
  .rtm-settings-panel {
    padding: 16px;
  }

  .rtm-settings-panel h3 {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .rtm-settings-section {
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
  }

  .rtm-settings-section h4 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .rtm-setting-item {
    margin-bottom: 8px;
    padding: 8px 0;
  }

  .rtm-migration-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .rtm-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
  }

  .rtm-stat-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--b3-theme-primary);
    margin-bottom: 8px;
  }

  .rtm-stat-label {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    text-align: center;
  }

  .rtm-warning-box {
    padding: 12px;
    background: var(--b3-card-warning-background, rgba(245, 158, 11, 0.1));
    color: var(--b3-card-warning-color, #f59e0b);
    border: 1px solid var(--b3-card-warning-color, #f59e0b);
    border-radius: 4px;
    font-size: 13px;
  }

  .rtm-success-box {
    padding: 12px;
    background: var(--b3-card-success-background, rgba(16, 185, 129, 0.1));
    color: var(--b3-card-success-color, #10b981);
    border: 1px solid var(--b3-card-success-color, #10b981);
    border-radius: 4px;
    font-size: 13px;
  }
</style>
