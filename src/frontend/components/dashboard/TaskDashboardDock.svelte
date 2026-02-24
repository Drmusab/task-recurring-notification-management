<script lang="ts">
  /**
   * TaskDashboardDock — SiYuan Dock-Mounted Dashboard
   *
   * Replaces the old standalone Dashboard.svelte with a store-bound,
   * dock-lifecycle-safe implementation.
   *
   * Key differences from Dashboard.svelte:
   * - Binds to Task.store / Settings.store / TaskAnalytics.store (reactive)
   * - NO window/global DOM assumptions
   * - NO self-mounting — always instantiated by mountDashboardDock()
   * - Lazy-loads chart/analytics adapters on tab switch
   * - Mobile/desktop compatible via isMobile prop
   *
   * @module TaskDashboardDock
   * @accessibility WCAG 2.1 AA compliant tab navigation
   * @version 4.0.0
   */

  import { onMount, onDestroy } from "svelte";
  import { generateAriaId } from "@frontend/utils/accessibility";
  import TrackerDashboard from "@components/shared/TrackerDashboard.svelte";
  import ErrorBoundary from "@components/shared/ErrorBoundary.svelte";
  import TasksView from "./views/TasksView.svelte";
  import QueriesView from "./views/QueriesView.svelte";
  import SettingsView from "./views/SettingsView.svelte";

  // ─── Stores ──────────────────────────────────────────────
  import { taskStore } from "@stores/Task.store";
  import { settingsStore } from "@stores/Settings.store";
  import {
    taskAnalyticsStore,
    updateAnalyticsFromTasks,
  } from "@stores/TaskAnalytics.store";

  // ─── Types ───────────────────────────────────────────────
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

  // ─── Props (injected by mountDashboardDock) ──────────────
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

  // Silence unused-prop warnings for future expansion
  void recurrenceEngine;
  void taskScheduler;
  void notificationService;

  // ─── Reactive Store Bindings ─────────────────────────────
  // Subscribe to taskStore for reactive task list
  let tasks: Task[] = [];
  let storeLoading = false;

  // Subscribe to analytics for the Tracker tab
  let analyticsData: any = null;

  // Subscribe to settings store for UI preferences
  let uiSettings: ReturnType<typeof settingsStore.getSettings> | null = null;

  // ─── Local State ─────────────────────────────────────────
  let activeTab: "tasks" | "queries" | "tracker" | "settings" = "tasks";
  let migrationStats = { migratable: 0, alreadyMigrated: 0 };

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

  // ─── Store Subscriptions ─────────────────────────────────
  let unsubTask: (() => void) | null = null;
  let unsubAnalytics: (() => void) | null = null;
  let unsubSettings: (() => void) | null = null;
  let unsubRefresh: (() => void) | null = null;

  // Reactive: update analytics whenever tasks change
  $: if (tasks.length > 0) {
    updateAnalyticsFromTasks(tasks);
  }

  onMount(() => {
    // Subscribe to Task.store
    unsubTask = taskStore.subscribe((state) => {
      tasks = Array.from(state.tasks.values());
      storeLoading = state.loading;
    });

    // Subscribe to TaskAnalytics.store
    unsubAnalytics = taskAnalyticsStore.subscribe((state) => {
      analyticsData = state;
    });

    // Subscribe to Settings.store
    unsubSettings = settingsStore.subscribe((s) => {
      uiSettings = s;
    });

    // Subscribe to backend refresh events for migration stats
    unsubRefresh = eventBus.on("task:refresh", () => {
      updateMigrationStats();
    });

    // Initial load: trigger refresh from backend
    taskStore.refreshFromBackend().catch((err: unknown) => {
      console.warn("[TaskDashboardDock] Initial refresh failed:", err);
    });

    updateMigrationStats();
  });

  onDestroy(() => {
    unsubTask?.();
    unsubAnalytics?.();
    unsubSettings?.();
    unsubRefresh?.();
  });

  function updateMigrationStats() {
    const migratable = tasks.filter(
      (t: any) => t.frequency && !t.recurrence
    ).length;
    const alreadyMigrated = tasks.filter(
      (t: any) => t.recurrence
    ).length;
    migrationStats = { migratable, alreadyMigrated };
  }

  // ─── Tab Navigation (WCAG keyboard) ─────────────────────
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
    // Find the active tab within OUR dock container (not global DOM)
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
      {#if !storeLoading}
        <span class="rtm-tab-badge" aria-label="{tasks.filter((t) => t.status === 'todo').length} active">
          {tasks.filter((t) => t.status === "todo").length}
        </span>
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
    {#if storeLoading}
      <div class="rtm-loading" role="status" aria-live="polite">
        <div class="rtm-spinner" aria-hidden="true"></div>
        <span>Loading tasks...</span>
      </div>
    {:else if activeTab === "tasks"}
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

  @keyframes rtm-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ─── Mobile Responsive ──────────────────────────── */
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
    .rtm-spinner {
      animation: none;
      opacity: 0.5;
    }
  }
</style>
