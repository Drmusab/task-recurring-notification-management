<script lang="ts">
  /**
   * SettingsView Component - Session 27 Refactored (Runtime Projection Layer)
   *
   * BEFORE (violations):
   *   Direct plugin.saveData("settings", settings) SiYuan API call
   *   Inline mutation: (settings as any)[section][key] = !...
   *   Plugin instance passed as prop (couples to backend)
   *   migrationStats passed as prop (stale prop chain)
   *
   * AFTER (clean):
   *   settingsStore for reactive settings + persistence
   *   Dashboard.store for migrationStats
   *   No SiYuan API, no domain imports, no inline mutation
   *   all mutations via settingsStore.updateSettings()
   */
  import { settingsStore } from "@stores/Settings.store";
  import { migrationStats } from "@stores/Dashboard.store";

  export let tabPanelId: string;
  export let settingsTabId: string;

  // Subscribe to the settings store (SettingsDTO, flat structure)
  $: currentSettings = $settingsStore;

  // Read migration stats from Dashboard.store (reactive)
  $: stats = $migrationStats;

  /**
   * Type-safe settings read using SettingsDTO index signature.
   * Falls back to false for boolean toggles.
   */
  function getSetting(key: string): unknown {
    return (currentSettings as Record<string, unknown>)?.[key] ?? false;
  }

  /**
   * Toggle a boolean setting and persist via settingsStore.
   * No direct plugin.saveData() call.
   */
  function toggleSetting(key: string) {
    const current = getSetting(key);
    settingsStore.updateSettings({ [key]: !current });
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
        <span class="fn__flex">Create next on completion</span>
        <div class="b3-label__text">Automatically create the next recurring instance when completing a task</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('autoCreateNextTask')}
        on:change={() => toggleSetting('autoCreateNextTask')} />
    </label>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Recurrence from completion</span>
        <div class="b3-label__text">Calculate next date from completion date rather than original due date</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('recurrenceFromCompletion')}
        on:change={() => toggleSetting('recurrenceFromCompletion')} />
    </label>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Keep completed recurring</span>
        <div class="b3-label__text">Retain completed instances of recurring tasks in the dashboard</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('keepCompletedRecurring')}
        on:change={() => toggleSetting('keepCompletedRecurring')} />
    </label>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Smart recurrence</span>
        <div class="b3-label__text">Enable AI-powered smart recurrence suggestions</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('enableSmartRecurrence')}
        on:change={() => toggleSetting('enableSmartRecurrence')} />
    </label>
  </div>

  <!-- Dependencies & Blocking -->
  <div class="rtm-settings-section">
    <h4>🔗 Dependencies</h4>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Enable dependencies</span>
        <div class="b3-label__text">Allow tasks to depend on other tasks</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('enableDependencies')}
        on:change={() => toggleSetting('enableDependencies')} />
    </label>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Show dependency warnings</span>
        <div class="b3-label__text">Display warnings when tasks have unresolved dependencies</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('showDependencyWarnings')}
        on:change={() => toggleSetting('showDependencyWarnings')} />
    </label>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Auto-hide blocked tasks</span>
        <div class="b3-label__text">Automatically hide blocked tasks from the main task list</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('autoHideBlockedTasks')}
        on:change={() => toggleSetting('autoHideBlockedTasks')} />
    </label>
  </div>

  <!-- Notifications -->
  <div class="rtm-settings-section">
    <h4>🔔 Notifications</h4>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Enable notifications</span>
        <div class="b3-label__text">Receive notifications for due and overdue tasks</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('enableNotifications')}
        on:change={() => toggleSetting('enableNotifications')} />
    </label>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Notify overdue</span>
        <div class="b3-label__text">Show notifications for overdue tasks</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('notifyOverdue')}
        on:change={() => toggleSetting('notifyOverdue')} />
    </label>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">AI suggestions</span>
        <div class="b3-label__text">Enable AI-powered task suggestions and recommendations</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('enableAISuggestions')}
        on:change={() => toggleSetting('enableAISuggestions')} />
    </label>
  </div>

  <!-- Display Settings -->
  <div class="rtm-settings-section">
    <h4>🎨 Display</h4>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Show relative dates</span>
        <div class="b3-label__text">Display dates as "today", "tomorrow" instead of absolute dates</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('showRelativeDates')}
        on:change={() => toggleSetting('showRelativeDates')} />
    </label>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Show path</span>
        <div class="b3-label__text">Display file path in task cards</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('showPath')}
        on:change={() => toggleSetting('showPath')} />
    </label>

    <label class="fn__flex b3-label rtm-setting-item">
      <div class="fn__flex-1">
        <span class="fn__flex">Hide completed tasks</span>
        <div class="b3-label__text">Hide completed tasks from the main view</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox"
        checked={getSetting('hideCompleted')}
        on:change={() => toggleSetting('hideCompleted')} />
    </label>
  </div>

  <!-- Migration Status -->
  <div class="rtm-settings-section">
    <h4>📊 Migration Status</h4>
    <div class="rtm-migration-stats">
      <div class="rtm-stat">
        <span class="rtm-stat-value">{stats.alreadyMigrated}</span>
        <span class="rtm-stat-label">Tasks using RRule</span>
      </div>
      <div class="rtm-stat">
        <span class="rtm-stat-value">{stats.migratable}</span>
        <span class="rtm-stat-label">Legacy tasks remaining</span>
      </div>
    </div>

    {#if stats.migratable > 0}
      <div class="rtm-warning-box" role="alert">
        ⚠️ {stats.migratable} legacy task(s) detected. They will be auto-migrated on next plugin reload.
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
