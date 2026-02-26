<script lang="ts">
/**
 * DockPanel - Main task dashboard for SiYuan sidebar
 * Features: Tabbed views (Inbox, Today, Upcoming, Done, Blocked)
 *
 * Session 27: Full runtime projection refactor.
 *   All filtering via Dashboard.store derived stores (no local date computation)
 *   Recurring instance-aware (completed parents filtered by store)
 *   Dependency-safe: blocked tab reads DependencyDTO.isBlocked from DTO
 *   Reminder-reactive via dashboardStore event subscriptions
 *   No deprecated props, no dead code
 *   Search filter applied on projected DTOs only
 *   Tab counts from derived store (tabCounts)
 *   Mutations via UITaskMutationService - no inline mutation
 *
 * FORBIDDEN:
 *   Import domain types
 *   Access TaskStorage / Cache
 *   Compute dependency chains
 *   Local date filtering
 *   Poll / debounce
 */

import { onMount, onDestroy } from 'svelte';
import TaskListView from '@frontend/components/shared/TaskListView.svelte';
import SearchBar from '@frontend/components/shared/pickers/SearchBar.svelte';
import QuickFilters from '@frontend/components/shared/pickers/QuickFilters.svelte';
import type { TaskDTO } from '../../services/DTOs';
import { uiEventService } from '../../services/UIEventService';
import { uiMutationService } from '../../services/UITaskMutationService';
import {
  dashboardStore,
  inboxTasks,
  todayTasks,
  upcomingTasksView,
  doneTasks,
  blockedTasks,
  tabCounts,
  dashboardLoading,
} from '@stores/Dashboard.store';
import * as logger from '@shared/logging/logger';

// Tab Definition

enum TabView {
  INBOX = 'inbox',
  TODAY = 'today',
  UPCOMING = 'upcoming',
  DONE = 'done',
  BLOCKED = 'blocked',
}

let activeTab: TabView = TabView.INBOX;
let searchQuery: string = '';

const tabs = [
  { id: TabView.INBOX, label: 'Inbox', icon: '📥' },
  { id: TabView.TODAY, label: 'Today', icon: '📅' },
  { id: TabView.UPCOMING, label: 'Upcoming', icon: '📆' },
  { id: TabView.DONE, label: 'Done', icon: '✅' },
  { id: TabView.BLOCKED, label: 'Blocked', icon: '🚫' },
];

// Reactive Task Projection
// All filtering is done by Dashboard.store derived stores.
// Only search filtering is applied locally on already-projected DTOs.

$: activeTabTasks = getTasksForTab(activeTab);
$: filteredTasks = searchQuery.trim()
  ? applySearchFilter(activeTabTasks, searchQuery)
  : activeTabTasks;

function getTasksForTab(tab: TabView): readonly TaskDTO[] {
  switch (tab) {
    case TabView.INBOX:
      return $inboxTasks;
    case TabView.TODAY:
      return $todayTasks;
    case TabView.UPCOMING:
      return $upcomingTasksView;
    case TabView.DONE:
      return $doneTasks;
    case TabView.BLOCKED:
      return $blockedTasks;
    default:
      return $inboxTasks;
  }
}

/**
 * Apply search query to projected DTOs.
 * Searches name, tags, and path - no markdown parsing.
 */
function applySearchFilter(tasks: readonly TaskDTO[], query: string): TaskDTO[] {
  const lowerQuery = query.toLowerCase();
  return tasks.filter((task) => {
    if (task.name.toLowerCase().includes(lowerQuery)) return true;
    if (task.tags?.some((tag: string) => tag.toLowerCase().includes(lowerQuery))) return true;
    if (task.path?.toLowerCase().includes(lowerQuery)) return true;
    return false;
  });
}

// Lifecycle

onMount(() => {
  // Dashboard.store is already connected by plugin index.ts.
  // If not yet loaded, trigger a refresh.
  if (dashboardStore.getState().lastUpdated === 0) {
    dashboardStore.refresh();
  }
});

// Event Handlers

function handleTabChange(tab: TabView) {
  activeTab = tab;
}

function handleSearch(event: CustomEvent<string>) {
  searchQuery = event.detail;
}

function handleQuickFilter(event: CustomEvent<any>) {
  logger.info('[DockPanel] Quick filter:', event.detail);
}

/**
 * Navigate to block in document via UIEventService orchestration.
 */
function handleTaskClick(event: CustomEvent<TaskDTO>) {
  const task = event.detail;
  if (task.blockId) {
    uiEventService.emitBlockNavigate(task.blockId);
  }
}

/**
 * Toggle task status via UITaskMutationService.
 * No inline mutation - delegates to backend lifecycle.
 */
async function handleTaskToggle(event: CustomEvent<TaskDTO>) {
  const task = event.detail;
  try {
    if (task.status === 'done') {
      await uiMutationService.updateTask(task.id, { enabled: true });
    } else {
      await uiMutationService.completeTask(task.id);
    }
  } catch (err) {
    logger.error('[DockPanel] Toggle failed:', err);
  }
}

/**
 * Open task editor via UIEventService orchestration.
 */
function handleTaskEdit(event: CustomEvent<TaskDTO>) {
  uiEventService.emitTaskEdit(event.detail);
}
</script>

<div class="task-dock-panel">
  <!-- Header with tabs -->
  <div class="dock-header">
    <div class="tabs" role="tablist" aria-label="Task views">
      {#each tabs as tab}
        <button
          class="tab"
          class:active={activeTab === tab.id}
          on:click={() => handleTabChange(tab.id)}
          title={tab.label}
          role="tab"
          aria-selected={activeTab === tab.id}
          tabindex={activeTab === tab.id ? 0 : -1}
        >
          <span class="tab-icon" aria-hidden="true">{tab.icon}</span>
          <span class="tab-label">{tab.label}</span>
          {#if $tabCounts[tab.id] > 0}
            <span class="tab-badge" aria-label="{$tabCounts[tab.id]} tasks">
              {$tabCounts[tab.id]}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Search and filters -->
  <div class="dock-toolbar">
    <SearchBar
      placeholder="Search tasks..."
      bind:value={searchQuery}
      on:search={handleSearch}
    />
    <QuickFilters on:filter={handleQuickFilter} />
  </div>

  <!-- Task list -->
  <div class="dock-content">
    {#if $dashboardLoading}
      <div class="loading-state" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p>Loading tasks...</p>
      </div>
    {:else if filteredTasks.length === 0}
      <div class="empty-state" role="status">
        <p class="empty-icon">📭</p>
        <p class="empty-text">
          {#if searchQuery}
            No tasks match your search
          {:else if activeTab === TabView.DONE}
            No completed tasks yet
          {:else if activeTab === TabView.BLOCKED}
            No blocked tasks - all dependencies resolved
          {:else}
            No tasks found
          {/if}
        </p>
      </div>
    {:else}
      <TaskListView
        tasks={filteredTasks}
        on:taskClick={handleTaskClick}
        on:taskToggle={handleTaskToggle}
        on:taskEdit={handleTaskEdit}
      />
    {/if}
  </div>
</div>

<style>
.task-dock-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--b3-theme-background);
  color: var(--b3-theme-text);
  font-family: var(--b3-font-family);
}

.dock-header {
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
}

.tabs {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--b3-theme-text-light);
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab:hover {
  background: var(--b3-list-hover);
  color: var(--b3-theme-text);
}

.tab.active {
  color: var(--b3-theme-primary);
  border-bottom-color: var(--b3-theme-primary);
  font-weight: 500;
}

.tab:focus {
  outline: 2px solid var(--b3-theme-primary);
  outline-offset: -2px;
}

.tab-icon {
  font-size: 16px;
}

.tab-label {
  display: none;
}

@media (min-width: 768px) {
  .tab-label {
    display: inline;
  }
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--b3-theme-primary);
  color: white;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
}

.dock-toolbar {
  padding: 8px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
}

.dock-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--b3-theme-text-light);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--b3-border-color);
  border-top-color: var(--b3-theme-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--b3-theme-text-light);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 8px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
    opacity: 0.5;
  }
}
</style>
