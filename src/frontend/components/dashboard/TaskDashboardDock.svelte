<script lang="ts">
  /**
   * TaskDashboardDock - SiYuan Dock-Mounted Dashboard
   *
   * Session 27: Full runtime projection refactor.
   *   All state from Dashboard.store (DashboardDTO-driven)
   *   Recurring instance-aware (completed parents filtered by store)
   *   Reminder-reactive via dashboardStore event subscriptions
   *   AI suggestions tracked in dashboardStore
   *   Dependency readiness from DependencyDTO.isBlocked
   *   No dead state variables, no tasks-as-any casts
   *   Lifecycle gated by runtimeReady store
   *
   * FORBIDDEN:
   *   Import domain types (Task, RecurrenceInstance, DependencyLink)
   *   Access TaskStorage / Cache / Scheduler
   *   Compute dependency chains locally
   *   Poll or debounce runtime state
   *   Mutate task inline
   *   Call SiYuan API directly
   *
   * @accessibility WCAG 2.1 AA compliant tab navigation
   * @version 6.0.0
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
    dashboardTasks,
    inboxTasks,
    dashboardLoading,
    activeReminders,
  } from "@stores/Dashboard.store";

  // Props (injected by mountDashboardDock)
  export let isMobile: boolean = false;

  // Local State
  let activeTab: "tasks" | "queries" | "tracker" | "settings" = "tasks";

  // ARIA IDs
  const tablistId = generateAriaId("tablist");
  const tasksTabId = generateAriaId("tasks-tab");
  const tasksTabPanelId = generateAriaId("tasks-panel");
  const queriesTabId = generateAriaId("queries-tab");
  const queriesTabPanelId = generateAriaId("queries-panel");
  const trackerTabId = generateAriaId("tracker-tab");
  const trackerTabPanelId = generateAriaId("tracker-panel");
  const settingsTabId = generateAriaId("settings-tab");
  const settingsTabPanelId = generateAriaId("settings-panel");

  let tabChangeAnnouncement = "";

  // Reactive: task count for badge (from derived store)
  $: activeTaskCount = $inboxTasks.length;

  // Reactive: reminder count for badge
  $: reminderCount = $activeReminders.length;

  onMount(() => {
    // Dashboard.store should already be connected by plugin index.ts.
    // Trigger refresh if not yet loaded.
    if (dashboardStore.getState().lastUpdated === 0) {
      dashboardStore.refresh();
    }
  });

  // Tab Navigation (WCAG keyboard)
  function handleTabKeyDown(event: KeyboardEvent) {
    const tabs = ["tasks", "queries", "tracker", "settings"] as const;
    const currentIndex = tabs.indexOf(activeTab);

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        activeTab = tabs[(currentIndex + 1) % tabs.length]!;
        focusActiveTab();
        announceTabChange();
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        activeTab =
          tabs[(currentIndex - 1 + tabs.length) % tabs.length]!;
        focusActiveTab();
        announceTabChange();
        break;
      case "Home":
        event.preventDefault();
        activeTab = tabs[0]!;
        focusActiveTab();
        announceTabChange();
        break;
      case "End":
        event.preventDefault();
        activeTab = tabs[tabs.length - 1]!;
        focusActiveTab();
        announceTabChange();
        break;
    }
  }

  function focusActiveTab() {
    const el = document.querySelector(
      `.rtm-dashboard-dock .rtm-tab[aria-selected="true"]`
    ) as HTMLButtonElement;
    el?.focus();
  }

  function announceTabChange() {
    const tabNames: Record<typeof activeTab, string> = {
      tasks: "Tasks",
      queries: "Queries",
      tracker: "Tracker",
      settings: "Settings",
    };
    tabChangeAnnouncement = `${tabNames[activeTab]} tab selected`;
  }

  function handleTabClick(tab: typeof activeTab) {
    activeTab = tab;
    announceTabChange();
  }
</script>

{#if $runtimeReady}
<div
  class="rtm-dashboard-dock"
  class:rtm-dashboard-dock--mobile={isMobile}
>
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
      {#if !$dashboardLoading && activeTaskCount > 0}
        <span class="rtm-tab-badge" aria-label="{activeTaskCount} active">
          {activeTaskCount}
        </span>
      {/if}
      {#if reminderCount > 0}
        <span class="rtm-tab-reminder-dot" aria-label="{reminderCount} reminders due" title="{reminderCount} reminders"></span>
      {/if}
    </button>
    <button
      class="rtm-tab"
      class:active={activeTab === "queries"}
      role="tab"
      aria-selected={activeTab === "queries"}
      aria-controls={queriesTabPanelId}
      id={queriesTabId}
      tabindex={activeTab === "queries" ? 0 : -1}
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
    {#if $dashboardLoading}
      <div class="rtm-loading" role="status" aria-live="polite">
        <div class="rtm-spinner" aria-hidden="true"></div>
        <span>Loading tasks...</span>
      </div>
    {:else if activeTab === "tasks"}
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

  .rtm-dashboard-dock {
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
    padding: 0 4px;
    gap: 2px;
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .rtm-tabs::-webkit-scrollbar {
    display: none;
  }

  .rtm-tab {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--b3-theme-on-surface);
    font-size: 13px;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    white-space: nowrap;
    min-height: 36px;
    position: relative;
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

  .rtm-tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary, #fff);
    border-radius: 9px;
    font-size: 11px;
    font-weight: 600;
  }

  .rtm-tab-reminder-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 8px;
    height: 8px;
    background: var(--b3-card-error-color, #ef4444);
    border-radius: 50%;
    animation: rtm-pulse 2s ease-in-out infinite;
  }

  @keyframes rtm-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .rtm-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .rtm-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    gap: 12px;
    color: var(--b3-theme-on-surface);
  }

  .rtm-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--b3-border-color);
    border-top-color: var(--b3-theme-primary);
    border-radius: 50%;
    animation: rtm-spin 0.8s linear infinite;
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

  /* Mobile Responsive */
  .rtm-dashboard-dock--mobile .rtm-tab {
    padding: 6px 8px;
    font-size: 12px;
  }

  .rtm-dashboard-dock--mobile .rtm-tab span:first-child {
    font-size: 16px;
  }

  .rtm-dashboard-dock--mobile .rtm-tab span:nth-child(2) {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .rtm-spinner, .loading-spinner {
      animation: none;
      opacity: 0.5;
    }
    .rtm-tab-reminder-dot {
      animation: none;
    }
  }
</style>
