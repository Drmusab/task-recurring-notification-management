<script lang="ts">
  /**
   * Main Dashboard Component - Session 27 Refactored (Runtime Projection Layer)
   *
   * BEFORE (violations):
   *   9 backend type imports
   *   taskStorage.loadActive() direct storage access
   *   eventBus.on("task:refresh") direct subscription
   *   Local migrationStats computation
   *   No reminder/AI/dependency reactive subscriptions
   *
   * AFTER (clean):
   *   Dashboard.store as single source of truth
   *   All derived stores for filtered views
   *   Reminder-reactive via dashboardStore event subscriptions
   *   AI suggestions tracked in dashboardStore
   *   Recurring instance-aware (completed parents filtered)
   *   Dependency readiness from DependencyDTO.isBlocked
   *   migrationStats from derived store
   *   No backend imports except type-only PluginSettingsDTO
   *
   * @accessibility WCAG 2.1 AA compliant tab navigation
   * @version 5.0.0
   */

  import { onMount, onDestroy } from "svelte";
  import { generateAriaId } from "@frontend/utils/accessibility";
  import { runtimeReady } from "@stores/RuntimeReady.store";
  import TrackerDashboard from "@components/shared/TrackerDashboard.svelte";
  import ErrorBoundary from "@components/shared/ErrorBoundary.svelte";
  import TasksView from "./views/TasksView.svelte";
  import QueriesView from "./views/QueriesView.svelte";
  import SettingsView from "./views/SettingsView.svelte";

  // Stores - Dashboard.store is the single source of truth
  import {
    dashboardStore,
  } from "@stores/Dashboard.store";

  // Props - minimal: only optional mobile flag
  export let isMobile: boolean = false;

  // State
  let activeTab: "tasks" | "queries" | "tracker" | "settings" = "tasks";

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

  onMount(() => {
    // Dashboard.store should already be connected by plugin index.ts.
    // Trigger refresh if not yet loaded.
    if (dashboardStore.getState().lastUpdated === 0) {
      dashboardStore.refresh();
    }
  });

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
    const activeTabButton = document.querySelector(
      '.rtm-dashboard .rtm-tab[aria-selected="true"]'
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

{#if $runtimeReady}
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
          tabPanelId={tasksTabPanelId}
          tasksTabId={tasksTabId}
        />
      </ErrorBoundary>
    {:else if activeTab === "queries"}
      <ErrorBoundary fallback="Failed to load queries view">
        <QueriesView
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
        />
      </ErrorBoundary>
    {/if}
  </div>
</div>
{:else}
<div class="rtm-dashboard-loading">
  <div class="loading-spinner"></div>
  <p>Initializing plugin...</p>
</div>
{/if}

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

  .rtm-dashboard-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    gap: 12px;
    color: var(--b3-theme-on-surface);
  }

  .loading-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--b3-border-color);
    border-top-color: var(--b3-theme-primary);
    border-radius: 50%;
    animation: rtm-spin 0.8s linear infinite;
  }

  @keyframes rtm-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
      opacity: 0.5;
    }
  }
</style>
