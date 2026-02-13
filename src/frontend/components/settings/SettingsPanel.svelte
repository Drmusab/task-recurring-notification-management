<script lang="ts">
/**
 * SettingsPanel - Plugin configuration interface
 */

import { settingsStore } from '@stores/Settings.store';
import type { Settings } from '@/domain/models/Settings';

let settings: Settings = settingsStore.getSettings();

// Subscribe to settings changes
settingsStore.subscribe((newSettings) => {
  settings = newSettings;
});

// Tab state
let activeTab: 'general' | 'format' | 'dates' | 'recurrence' | 'advanced' = 'general';

const tabs = [
  { id: 'general', label: '⚙️ General', icon: '⚙️' },
  { id: 'format', label: '🎨 Format', icon: '🎨' },
  { id: 'dates', label: '📅 Dates', icon: '📅' },
  { id: 'recurrence', label: '🔁 Recurrence', icon: '🔁' },
  { id: 'advanced', label: '🔧 Advanced', icon: '🔧' },
] as const;

function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settingsStore.updateSettings({ [key]: value } as Partial<Settings>);
}

function handleReset() {
  if (confirm('Reset all settings to defaults?')) {
    settingsStore.resetToDefaults();
  }
}
</script>

<div class="settings-panel">
  <!-- Header -->
  <div class="settings-header">
    <h2 class="settings-title">⚙️ Task Plugin Settings</h2>
    <button class="btn-reset" on:click={handleReset} title="Reset to defaults">
      Reset
    </button>
  </div>

  <!-- Tabs -->
  <div class="settings-tabs">
    {#each tabs as tab}
      <button
        class="settings-tab"
        class:active={activeTab === tab.id}
        on:click={() => (activeTab = tab.id)}
      >
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-label">{tab.label.replace(/^[^\s]+\s/, '')}</span>
      </button>
    {/each}
  </div>

  <!-- Content -->
  <div class="settings-content">
    {#if activeTab === 'general'}
      <div class="settings-section">
        <h3 class="section-title">General Settings</h3>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={settings.debugMode}
              on:change={(e) => updateSetting('debugMode', e.currentTarget.checked)}
            />
            Enable debug mode
          </label>
          <p class="setting-help">Log detailed debug information to console</p>
        </div>

        <div class="setting-group">
          <label class="setting-label" for="default-priority">
            Default task priority
          </label>
          <select
            id="default-priority"
            class="setting-input"
            bind:value={settings.defaultPriority}
          >
            <option value="highest">Highest 🔺</option>
            <option value="high">High ⏫</option>
            <option value="medium">Medium 🔼</option>
            <option value="none">Normal</option>
            <option value="low">Low 🔽</option>
            <option value="lowest">Lowest ⏬</option>
          </select>
        </div>

        <div class="setting-group">
          <label class="setting-label" for="timezone">
            Timezone
          </label>
          <input
            id="timezone"
            type="text"
            class="setting-input"
            value={settings.timezone}
            on:change={(e) => updateSetting('timezone', e.currentTarget.value)}
            placeholder="America/New_York"
          />
          <p class="setting-help">IANA timezone for date calculations (leave empty for system timezone)</p>
        </div>
      </div>
    {:else if activeTab === 'format'}
      <div class="settings-section">
        <h3 class="section-title">Task Format Settings</h3>

        <div class="setting-group">
          <label class="setting-label" for="task-format">
            Task format style
          </label>
          <select
            id="task-format"
            class="setting-input"
            bind:value={settings.preferredFormat}
          >
            <option value="emoji">Emoji (📅 2026-02-10)</option>
            <option value="text">Text (due: 2026-02-10)</option>
          </select>
          <p class="setting-help">How to display and parse task metadata</p>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={settings.showRelativeDates}
              on:change={(e) => updateSetting('showRelativeDates', e.currentTarget.checked)}
            />
            Show relative dates
          </label>
          <p class="setting-help">Display dates like "tomorrow" instead of exact dates</p>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={settings.showPath}
              on:change={(e) => updateSetting('showPath', e.currentTarget.checked)}
            />
            Show task file path
          </label>
          <p class="setting-help">Display the file path in task list items</p>
        </div>
      </div>
    {:else if activeTab === 'dates'}
      <div class="settings-section">
        <h3 class="section-title">Date Settings</h3>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={settings.useFilenameAsDate}
              on:change={(e) => updateSetting('useFilenameAsDate', e.currentTarget.checked)}
            />
            Use filename as default date
          </label>
          <p class="setting-help">Extract date from daily note filenames (e.g., 2026-02-06.md)</p>
        </div>

        <div class="setting-group">
          <label class="setting-label" for="date-format">
            Date format
          </label>
          <select
            id="date-format"
            class="setting-input"
            bind:value={settings.dateFormat}
          >
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="relative">Relative (tomorrow, next week)</option>
          </select>
          <p class="setting-help">Preferred date display format</p>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={settings.hideCompleted}
              on:change={(e) => updateSetting('hideCompleted', e.currentTarget.checked)}
            />
            Hide completed tasks by default
          </label>
          <p class="setting-help">Don't show completed tasks in main task list</p>
        </div>
      </div>
    {:else if activeTab === 'recurrence'}
      <div class="settings-section">
        <h3 class="section-title">Recurrence Settings</h3>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={settings.recurrenceFromCompletion}
              on:change={(e) => updateSetting('recurrenceFromCompletion', e.currentTarget.checked)}
            />
            Calculate from completion date
          </label>
          <p class="setting-help">Next instance uses completion date instead of due date</p>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={settings.autoCreateNextTask}
              on:change={(e) => updateSetting('autoCreateNextTask', e.currentTarget.checked)}
            />
            Auto-create next task
          </label>
          <p class="setting-help">Automatically create next instance when marking recurring task as done</p>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={settings.keepCompletedRecurring}
              on:change={(e) => updateSetting('keepCompletedRecurring', e.currentTarget.checked)}
            />
            Keep completed recurring tasks
          </label>
          <p class="setting-help">Preserve completed instances in history (don't archive/delete)</p>
        </div>
      </div>
    {:else if activeTab === 'advanced'}
      <div class="settings-section">
        <h3 class="section-title">Advanced Settings</h3>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={settings.enableIndexing}
              on:change={(e) => updateSetting('enableIndexing', e.currentTarget.checked)}
            />
            Enable task indexing
          </label>
          <p class="setting-help">Build and maintain task index for faster queries</p>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={settings.enableQueryCache}
              on:change={(e) => updateSetting('enableQueryCache', e.currentTarget.checked)}
            />
            Enable query caching
          </label>
          <p class="setting-help">Cache query results for better performance</p>
        </div>

        <div class="setting-group">
          <label class="setting-label" for="cache-ttl">
            Query cache TTL (seconds)
          </label>
          <input
            id="cache-ttl"
            type="number"
            class="setting-input"
            value={settings.queryCacheTTL}
            on:change={(e) => updateSetting('queryCacheTTL', parseInt(e.currentTarget.value))}
            min="10"
            max="3600"
            step="10"
          />
          <p class="setting-help">How long to cache query results</p>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={settings.enableExperimentalFeatures}
              on:change={(e) => updateSetting('enableExperimentalFeatures', e.currentTarget.checked)}
            />
            Enable experimental features
          </label>
          <p class="setting-help">Try out new features before they're stable</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
.settings-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--b3-theme-background);
  color: var(--b3-theme-text);
  font-family: var(--b3-font-family);
}

/* Header */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-border-color);
}

.settings-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.btn-reset {
  padding: 6px 12px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reset:hover {
  background: var(--b3-list-hover);
}

/* Tabs */
.settings-tabs {
  display: flex;
  overflow-x: auto;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
}

.settings-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 14px;
  color: var(--b3-theme-text-light);
  transition: all 0.15s ease;
  white-space: nowrap;
}

.settings-tab:hover {
  background: var(--b3-list-hover);
  color: var(--b3-theme-text);
}

.settings-tab.active {
  color: var(--b3-theme-primary);
  border-bottom-color: var(--b3-theme-primary);
  font-weight: 500;
}

.tab-icon {
  font-size: 16px;
}

/* Content */
.settings-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.settings-section {
  max-width: 600px;
}

.section-title {
  margin: 0 0 20px;
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-text);
}

/* Setting groups */
.setting-group {
  margin-bottom: 24px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-text);
  cursor: pointer;
}

.setting-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.setting-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 14px;
  color: var(--b3-theme-text);
  font-family: var(--b3-font-family);
}

.setting-input:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
}

.setting-help {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--b3-theme-text-light);
}
</style>
