<script lang="ts">
  /**
   * Main Dashboard Component - Refactored for Maintainability
   * Now acts as a container that orchestrates view components
   *
   * @module Dashboard
   * @accessibility WCAG 2.1 AA compliant tab navigation
   * @version 3.0.0
   */

  import { onMount, onDestroy } from "svelte";
  import { generateAriaId } from "@frontend/utils/accessibility";
  import TrackerDashboard from "@components/shared/TrackerDashboard.svelte";
  import ErrorBoundary from "@components/shared/ErrorBoundary.svelte";
  import TasksView from "./views/TasksView.svelte";
  import QueriesView from "./views/QueriesView.svelte";
  import SettingsView from "./views/SettingsView.svelte";
  import { updateAnalyticsFromTasks } from "@stores/TaskAnalytics.store";
  
  import type { Task } from "@backend/core/models/Task";
  import type { TaskStorage } from "@backend/core/storage/TaskStorage";
  import type { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
  import type { Scheduler } from "@backend/core/engine/Scheduler";
  import type { EventService } from "@backend/services/EventService";
  import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
  import type { Plugin } from "siyuan";
  import type { TaskCreationService } from "@backend/core/services/TaskCreationService";
  import type { AutoMigrationService } from "@backend/core/services/AutoMigrationService";
  import type { PluginSettings } from "@backend/core/settings/PluginSettings";

  // Props - all passed from index.ts mount call
  export let taskStorage: TaskStorage;
  export let recurrenceEngine: RecurrenceEngine | undefined = undefined;
  export let taskScheduler: Scheduler | undefined = undefined;
  export let notificationService: EventService | undefined = undefined;
  export let eventBus: PluginEventBus;
  export let plugin: Plugin;
  export let taskCreationService: TaskCreationService;
  export let autoMigrationService: AutoMigrationService;
  export let settings: PluginSettings;
  export let isMobile: boolean = false;

 // Use refs to services for future expansion
  void recurrenceEngine;
  void taskScheduler;
  void notificationService;
  void plugin;

  // State
  let tasks: Task[] = [];
  let activeTab: "tasks" | "queries" | "tracker" | "settings" = "tasks";
  let migrationStats = { migratable: 0, alreadyMigrated: 0 };

  // Generate unique IDs for ARIA relationships
  const tablistId = generateAriaId('tablist');
  const tasksTabId = generateAriaId('tasks-tab');
  const tasksTabPanelId = generateAriaId('tasks-panel');
  const queriesTabId = generateAriaId('queries-tab');
  const queriesTabPanelId = generateAriaId('queries-panel');
  const trackerTabId = generateAriaId('tracker-tab');
  const trackerTabPanelId = generateAriaId('tracker-panel');
  const settingsTabId = generateAriaId('settings-tab');
  const settingsTabPanelId = generateAriaId('settings-panel');

  // ARIA live region for tab changes
  let tabChangeAnnouncement = "";

  // Subscriptions
  let unsubscribeRefresh: (() => void) | null = null;

  onMount(async () => {
    await loadTasks();
    await updateMigrationStats();

    // Populate analytics store on initial load so TrackerDashboard has data
    if (tasks.length > 0) {
      updateAnalyticsFromTasks(tasks);
    }

    // Subscribe to task refresh events
    unsubscribeRefresh = eventBus.on("task:refresh", async () => {
      await loadTasks();
      updateAnalyticsFromTasks(tasks);
    });
  });

  onDestroy(() => {
    unsubscribeRefresh?.();
  });

  async function loadTasks() {
    try {
      const loadedTasks = await taskStorage.loadActive();
      tasks = Array.from(loadedTasks.values());
    } catch (error: any) {
      console.error("[Dashboard] Failed to load tasks:", error);
    }
  }

  async function updateMigrationStats() {
    // Phase 3: All tasks should have recurrence, count any legacy tasks as migratable
    const migratable = tasks.filter(t => (t as any).frequency && !(t as any).recurrence).length;
    const alreadyMigrated = tasks.filter(t => (t as any).recurrence).length;
    migrationStats = { migratable, alreadyMigrated };
  }

  // Accessibility: Tab keyboard navigation
  function handleTabKeyDown(event: KeyboardEvent) {
    const tabs = ['tasks', 'queries', 'tracker', 'settings'] as const;
    const currentIndex = tabs.indexOf(activeTab);

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        activeTab = tabs[(currentIndex + 1) % tabs.length]!;
        focusActiveTab();
        announceTabChange();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        activeTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length]!;
        focusActiveTab();
        announceTabChange();
        break;
      case 'Home':
        event.preventDefault();
        activeTab = tabs[0]!;
        focusActiveTab();
        announceTabChange();
        break;
      case 'End':
        event.preventDefault();
        activeTab = tabs[tabs.length - 1]!;
        focusActiveTab();
        announceTabChange();
        break;
    }
  }

  function focusActiveTab() {
    // Focus the active tab button after keyboard navigation
    const activeTabButton = document.querySelector(
      '.rtm-tab[aria-selected="true"]'
    ) as HTMLButtonElement;
    if (activeTabButton) {
      activeTabButton.focus();
    }
  }

  function announceTabChange() {
    const tabNames: Record<typeof activeTab, string> = {
      tasks: 'Tasks',
      queries: 'Queries',
      tracker: 'Tracker',
      settings: 'Settings'
    };
    tabChangeAnnouncement = `${tabNames[activeTab]} tab selected`;
  }

  function handleTabClick(tab: typeof activeTab) {
    activeTab = tab;
    announceTabChange();
  }
</script>

<div class="rtm-dashboard" class:rtm-dashboard--mobile={isMobile}>
  <!-- ARIA live region for tab changes -->
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {tabChangeAnnouncement}
  </div>

  <!-- Tab Navigation - WCAG 2.1 AA Compliant -->
  <div 
    class="rtm-tabs" 
    role="tablist" 
    aria-label="Dashboard sections"
    id={tablistId}
    tabindex="-1"
    on:keydown={handleTabKeyDown}
  >
    <button
      class="rtm-tab"
      class:active={activeTab === "tasks"}
      role="tab"
      aria-selected={activeTab === "tasks"}
      aria-controls={tasksTabPanelId}
      id={tasksTabId}
      tabindex={activeTab === "tasks" ? 0 : -1}
      on:click={() => handleTabClick("tasks")}
    >
      <span aria-hidden="true">📋</span>
      <span>Tasks</span>
    </button>
    <button
      class="rtm-tab"
      class:active={activeTab === "queries"}
      role="tab"
      aria-selected={activeTab === "queries"}
      aria-controls={queriesTabPanelId}
      id={queriesTabId}
      tabindex={activeTab === "queries"? 0 : -1}
      on:click={() => handleTabClick("queries")}
    >
      <span aria-hidden="true">🔍</span>
      <span>Queries</span>
    </button>
    <button
      class="rtm-tab"
      class:active={activeTab === "tracker"}
      role="tab"
      aria-selected={activeTab === "tracker"}
      aria-controls={trackerTabPanelId}
      id={trackerTabId}
      tabindex={activeTab === "tracker" ? 0 : -1}
      on:click={() => handleTabClick("tracker")}
    >
      <span aria-hidden="true">📊</span>
      <span>Tracker</span>
    </button>
    <button
      class="rtm-tab"
      class:active={activeTab === "settings"}
      role="tab"
      aria-selected={activeTab === "settings"}
      aria-controls={settingsTabPanelId}
      id={settingsTabId}
      tabindex={activeTab === "settings" ? 0 : -1}
      on:click={() => handleTabClick("settings")}
    >
      <span aria-hidden="true">⚙️</span>
      <span>Settings</span>
    </button>
  </div>

  <!-- Content Area -->
  <div class="rtm-content">
    {#if activeTab === "tasks"}
      <ErrorBoundary fallback="Failed to load tasks view">
        <TasksView
          {taskStorage}
          {taskCreationService}
          {autoMigrationService}
          {eventBus}
          tabPanelId={tasksTabPanelId}
          tasksTabId={tasksTabId}
        />
      </ErrorBoundary>
    {:else if activeTab === "queries"}
      <ErrorBoundary fallback="Failed to load queries view">
        <QueriesView
          {tasks}
          {settings}
          tabPanelId={queriesTabPanelId}
          queriesTabId={queriesTabId}
        />
      </ErrorBoundary>
    {:else if activeTab === "tracker"}
      <ErrorBoundary fallback="Failed to load analytics dashboard">
        <div 
          role="tabpanel" 
          id={trackerTabPanelId}
          aria-labelledby={trackerTabId}
          tabindex="0"
        >
          <TrackerDashboard onClose={() => handleTabClick("tasks")} />
        </div>
      </ErrorBoundary>
    {:else if activeTab === "settings"}
      <ErrorBoundary fallback="Failed to load settings">
        <SettingsView
          tabPanelId={settingsTabPanelId}
          settingsTabId={settingsTabId}
          {migrationStats}
          {settings}
          {plugin}
        />
      </ErrorBoundary>
    {/if}
  </div>
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .rtm-dashboard {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-family: var(--b3-font-family);
    color: var(--b3-theme-on-background);
    background: var(--b3-theme-background);
  }

  .rtm-tabs {
    display: flex;
    border-bottom: 1px solid var(--b3-border-color);
    padding: 0 8px;
    gap: 4px;
  }

  .rtm-tab {
    padding: 8px 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--b3-theme-on-surface);
    font-size: 13px;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .rtm-tab:hover {
    background: var(--b3-theme-surface);
  }

  .rtm-tab.active {
    color: var(--b3-theme-primary);
    border-bottom-color: var(--b3-theme-primary);
    font-weight: 500;
  }

  .rtm-tab:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: -2px;
  }

  .rtm-content {
    flex: 1;
    overflow-y: auto;
  }
</style>
