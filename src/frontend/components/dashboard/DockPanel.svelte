<script lang="ts">
/**
 * DockPanel - Main task dashboard for SiYuan sidebar
 * Features: Tabbed views (Inbox, Today, Upcoming, Done)
 */

import { onMount, onDestroy } from 'svelte';
import TaskListView from '@frontend/components/shared/TaskListView.svelte';
import SearchBar from '@frontend/components/shared/pickers/SearchBar.svelte';
import QuickFilters from '@frontend/components/shared/pickers/QuickFilters.svelte';
import { taskStore } from '@stores/Task.store';
import { settingsStore } from '@stores/Settings.store';
import type { Task } from '@backend/core/models/Task';

enum TabView {
  INBOX = 'inbox',
  TODAY = 'today',
  UPCOMING = 'upcoming',
  DONE = 'done',
  TAGS = 'tags',
}

let activeTab: TabView = TabView.INBOX;
let searchQuery: string = '';
let filteredTasks: Task[] = [];
let isLoading: boolean = true;

// Tab definitions
const tabs = [
  { id: TabView.INBOX, label: '📥 Inbox', icon: '📥' },
  { id: TabView.TODAY, label: '📅 Today', icon: '📅' },
  { id: TabView.UPCOMING, label: '📆 Upcoming', icon: '📆' },
  { id: TabView.DONE, label: '✅ Done', icon: '✅' },
  { id: TabView.TAGS, label: '🏷️ Tags', icon: '🏷️' },
];

// Subscribe to task store
let unsubscribe: (() => void) | null = null;

onMount(async () => {
  // Subscribe to task updates
  unsubscribe = taskStore.subscribe((state) => {
    filterTasksForActiveTab();
    isLoading = state.loading;
  });

  // Initial load
  await taskStore.refreshTasks();
});

onDestroy(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

/**
 * Filter tasks based on active tab
 */
function filterTasksForActiveTab() {
  const allTasks = taskStore.getAllTasks();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  switch (activeTab) {
    case TabView.INBOX:
      // All open tasks
      filteredTasks = allTasks.filter(
        (t) => t.status === 'todo' || t.status === 'in-progress'
      );
      break;

    case TabView.TODAY:
      // Due or scheduled today
      filteredTasks = allTasks.filter((t) => {
        if (t.status === 'done' || t.status === 'cancelled') return false;
        
        const dueDate = t.dueAt ? new Date(t.dueAt) : null;
        const scheduledDate = t.scheduledAt ? new Date(t.scheduledAt) : null;

        return (
          (dueDate && dueDate >= today && dueDate < tomorrow) ||
          (scheduledDate && scheduledDate >= today && scheduledDate < tomorrow)
        );
      });
      break;

    case TabView.UPCOMING:
      // Due in next 7 days
      filteredTasks = allTasks.filter((t) => {
        if (t.status === 'done' || t.status === 'cancelled') return false;
        
        const dueDate = t.dueAt ? new Date(t.dueAt) : null;

        return dueDate && dueDate >= tomorrow && dueDate < nextWeek;
      });
      break;

    case TabView.DONE:
      // Recently completed
      filteredTasks = allTasks
        .filter((t) => t.status === 'done')
        .sort((a, b) => {
          const dateA = a.doneAt ? new Date(a.doneAt).getTime() : 0;
          const dateB = b.doneAt ? new Date(b.doneAt).getTime() : 0;
          return dateB - dateA; // Most recent first
        })
        .slice(0, 100); // Limit to 100 most recent
      break;

    case TabView.TAGS:
      // Group by tag (for now, show all)
      filteredTasks = allTasks;
      break;

    default:
      filteredTasks = allTasks;
  }

  // Apply search filter if query exists
  if (searchQuery.trim()) {
    filteredTasks = applySearchFilter(filteredTasks, searchQuery);
  }
}

/**
 * Apply search query to tasks
 */
function applySearchFilter(tasks: Task[], query: string): Task[] {
  const lowerQuery = query.toLowerCase();

  return tasks.filter((task) => {
    // Search in description
    if (task.name.toLowerCase().includes(lowerQuery)) return true;

    // Search in tags
    if (task.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))) return true;

    // Search in path
    if (task.path?.toLowerCase().includes(lowerQuery)) return true;

    return false;
  });
}

/**
 * Handle tab change
 */
function handleTabChange(tab: TabView) {
  activeTab = tab;
  filterTasksForActiveTab();
}

/**
 * Handle search input
 */
function handleSearch(event: CustomEvent<string>) {
  searchQuery = event.detail;
  filterTasksForActiveTab();
}

/**
 * Handle quick filter application
 */
function handleQuickFilter(event: CustomEvent<any>) {
  // TODO: Implement quick filter logic
  console.log('Quick filter:', event.detail);
}

/**
 * Handle task click (navigate to block in document)
 */
function handleTaskClick(event: CustomEvent<Task>) {
  const task = event.detail;
  
  if (task.linkedBlockId) {
    // Use SiYuan API to jump to block
    // @ts-ignore - SiYuan global
    if (window.siyuan?.openBlock) {
      // @ts-ignore
      window.siyuan.openBlock({ id: task.linkedBlockId });
    }
  }
}

/**
 * Handle task toggle (status change)
 */
async function handleTaskToggle(event: CustomEvent<Task>) {
  const task = event.detail;
  await taskStore.toggleTaskStatus(task.id);
}

/**
 * Handle task edit
 */
function handleTaskEdit(event: CustomEvent<Task>) {
  const task = event.detail;
  // Dispatch event to open edit modal
  const editEvent = new CustomEvent('openEditModal', {
    detail: task,
    bubbles: true,
  });
  window.dispatchEvent(editEvent);
}

/**
 * Get task count for tab badge
 */
function getTabCount(tab: TabView): number {
  const allTasks = taskStore.getAllTasks();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  switch (tab) {
    case TabView.INBOX:
      return allTasks.filter((t) => t.status === 'todo' || t.status === 'in-progress').length;

    case TabView.TODAY:
      return allTasks.filter((t) => {
        if (t.status === 'done' || t.status === 'cancelled') return false;
        const dueDate = t.dueAt ? new Date(t.dueAt) : null;
        const scheduledDate = t.scheduledAt ? new Date(t.scheduledAt) : null;
        return (
          (dueDate && dueDate >= today && dueDate < tomorrow) ||
          (scheduledDate && scheduledDate >= today && scheduledDate < tomorrow)
        );
      }).length;

    case TabView.UPCOMING:
      return allTasks.filter((t) => {
        if (t.status === 'done' || t.status === 'cancelled') return false;
        const dueDate = t.dueAt ? new Date(t.dueAt) : null;
        return dueDate && dueDate >= tomorrow && dueDate < nextWeek;
      }).length;

    case TabView.DONE:
      return allTasks.filter((t) => t.status === 'done').length;

    case TabView.TAGS:
      return 0; // No count for tags view

    default:
      return 0;
  }
}
</script>

<div class="task-dock-panel">
  <!-- Header with tabs -->
  <div class="dock-header">
    <div class="tabs">
      {#each tabs as tab}
        <button
          class="tab"
          class:active={activeTab === tab.id}
          on:click={() => handleTabChange(tab.id)}
          title={tab.label}
        >
          <span class="tab-icon">{tab.icon}</span>
          <span class="tab-label">{tab.label.replace(/^[^\s]+\s/, '')}</span>
          {#if getTabCount(tab.id) > 0}
            <span class="tab-badge">{getTabCount(tab.id)}</span>
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
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading tasks...</p>
      </div>
    {:else if filteredTasks.length === 0}
      <div class="empty-state">
        <p class="empty-icon">📭</p>
        <p class="empty-text">
          {#if searchQuery}
            No tasks match your search
          {:else if activeTab === TabView.DONE}
            No completed tasks yet
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

/* Header & Tabs */
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

/* Toolbar */
.dock-toolbar {
  padding: 8px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
}

/* Content */
.dock-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Loading state */
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

/* Empty state */
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
</style>
