<!--
  ReminderPanel.svelte - Persistent Reminder Display in SiYuan Dock
  
  Displays active and upcoming reminders for tasks. Mounted inside 
  a SiYuan dock panel via addDock() API.
  
  Features:
  - Active reminder list with snooze/dismiss controls
  - Upcoming reminders timeline
  - Quick task completion from reminder
  - Mobile-responsive layout
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { Task } from "@backend/core/models/Task";
  import type { TaskStorage } from "@backend/core/storage/TaskStorage";
  import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
  import type { Plugin } from "siyuan";

  // Props passed from dock init
  export let taskStorage: TaskStorage;
  export let eventBus: PluginEventBus;
  export let plugin: Plugin;
  void plugin; // Referenced externally
  export let isMobile: boolean = false;

  let activeReminders: Task[] = [];
  let upcomingReminders: Task[] = [];
  let loading = true;
  let error: string | null = null;

  // Cleanup references
  let unsubRefresh: (() => void) | null = null;
  let unsubSaved: (() => void) | null = null;
  let refreshInterval: number | null = null;

  onMount(async () => {
    await loadReminders();
    
    // Subscribe to task events for live updates
    unsubRefresh = eventBus.on("task:refresh", () => {
      loadReminders();
    });

    unsubSaved = eventBus.on("task:saved", () => {
      loadReminders();
    });

    // Refresh every 60 seconds to update time-based sorting
    refreshInterval = window.setInterval(() => {
      loadReminders();
    }, 60000);
  });

  onDestroy(() => {
    unsubRefresh?.();
    unsubSaved?.();
    if (refreshInterval !== null) {
      clearInterval(refreshInterval);
    }
  });

  async function loadReminders(): Promise<void> {
    try {
      loading = true;
      error = null;

      const tasks = await taskStorage.loadActive();
      const allTasks = Array.from(tasks.values());
      const now = new Date();

      // Active reminders: tasks that are due or overdue
      activeReminders = allTasks
        .filter((t) => {
          if (!t.enabled || t.status === "done" || t.status === "cancelled") return false;
          if (!t.dueAt) return false;
          const due = new Date(t.dueAt);
          return due <= now;
        })
        .sort((a, b) => {
          const aDue = new Date(a.dueAt || 0).getTime();
          const bDue = new Date(b.dueAt || 0).getTime();
          return aDue - bDue;
        });

      // Upcoming reminders: tasks due within next 24 hours
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      upcomingReminders = allTasks
        .filter((t) => {
          if (!t.enabled || t.status === "done" || t.status === "cancelled") return false;
          if (!t.dueAt) return false;
          const due = new Date(t.dueAt);
          return due > now && due <= tomorrow;
        })
        .sort((a, b) => {
          const aDue = new Date(a.dueAt || 0).getTime();
          const bDue = new Date(b.dueAt || 0).getTime();
          return aDue - bDue;
        });

    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load reminders";
      console.error("[ReminderPanel] Load error:", err);
    } finally {
      loading = false;
    }
  }

  async function completeTask(task: Task): Promise<void> {
    try {
      const updated = { ...task, status: "done", doneAt: new Date().toISOString() };
      await taskStorage.saveTask(updated as any);
      eventBus.emit("task:refresh", undefined);
    } catch (err) {
      console.error("[ReminderPanel] Complete error:", err);
    }
  }

  async function snoozeTask(task: Task, minutes: number): Promise<void> {
    try {
      const newDue = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      const updated = { ...task, dueAt: newDue };
      await taskStorage.saveTask(updated as any);
      eventBus.emit("task:snooze", { taskId: task.id, minutes });
      eventBus.emit("task:refresh", undefined);
    } catch (err) {
      console.error("[ReminderPanel] Snooze error:", err);
    }
  }

  function dismissTask(task: Task): void {
    activeReminders = activeReminders.filter((t) => t.id !== task.id);
  }

  function formatTimeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;

    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  function formatTimeUntil(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = then - now;

    if (diff < 60000) return "< 1m";
    if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
    return `in ${Math.floor(diff / 86400000)}d`;
  }

  function getPriorityColor(priority: string | undefined): string {
    if (!priority) return "var(--b3-theme-on-surface-light, #95a5a6)";
    switch (priority) {
      case "urgent": return "var(--b3-card-error-color, #e74c3c)";
      case "high": return "var(--b3-card-warning-color, #f39c12)";
      case "medium": return "var(--b3-theme-primary, #3498db)";
      default: return "var(--b3-theme-on-surface-light, #95a5a6)";
    }
  }
</script>

<div class={`reminder-panel ${isMobile ? 'reminder-panel--mobile' : ''}`}>
  {#if loading}
    <div class="reminder-panel__loading">
      <span class="fn__loading">
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>
  {:else if error}
    <div class="reminder-panel__error b3-label b3-label--error">
      {error}
    </div>
  {:else}
    <!-- Active Reminders Section -->
    <div class="reminder-panel__section">
      <div class="reminder-panel__header">
        <svg class="reminder-panel__icon"><use xlink:href="#iconTaskNotification"></use></svg>
        <span>Active ({activeReminders.length})</span>
      </div>

      {#if activeReminders.length === 0}
        <div class="reminder-panel__empty">
          No active reminders
        </div>
      {:else}
        {#each activeReminders as reminder (reminder.id)}
          <div class="reminder-card" style="border-left-color: {getPriorityColor(reminder.priority)}">
            <div class="reminder-card__content">
              <div class="reminder-card__name">{reminder.name || "Untitled"}</div>
              <div class="reminder-card__meta">
                <span class="reminder-card__time">{formatTimeAgo(reminder.dueAt || "")}</span>
                {#if reminder.priority}
                  <span class="reminder-card__priority" style="color: {getPriorityColor(reminder.priority)}">
                    {reminder.priority}
                  </span>
                {/if}
              </div>
            </div>
            <div class="reminder-card__actions">
              <button
                class="b3-button b3-button--small b3-button--outline"
                on:click={() => completeTask(reminder)}
                title="Complete"
              >
                ✓
              </button>
              <button
                class="b3-button b3-button--small b3-button--outline"
                on:click={() => snoozeTask(reminder, 15)}
                title="Snooze 15m"
              >
                ⏰
              </button>
              <button
                class="b3-button b3-button--small b3-button--outline"
                on:click={() => dismissTask(reminder)}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Upcoming Reminders Section -->
    <div class="reminder-panel__section">
      <div class="reminder-panel__header">
        <svg class="reminder-panel__icon"><use xlink:href="#iconTaskCalendar"></use></svg>
        <span>Upcoming ({upcomingReminders.length})</span>
      </div>

      {#if upcomingReminders.length === 0}
        <div class="reminder-panel__empty">
          No upcoming reminders in next 24h
        </div>
      {:else}
        {#each upcomingReminders as reminder (reminder.id)}
          <div class="reminder-card reminder-card--upcoming" style="border-left-color: {getPriorityColor(reminder.priority)}">
            <div class="reminder-card__content">
              <div class="reminder-card__name">{reminder.name || "Untitled"}</div>
              <div class="reminder-card__meta">
                <span class="reminder-card__time">{formatTimeUntil(reminder.dueAt || "")}</span>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .reminder-panel {
    height: 100%;
    overflow-y: auto;
    padding: 8px;
    font-family: var(--b3-font-family);
    color: var(--b3-theme-on-background);
    background: var(--b3-theme-background);
  }

  .reminder-panel--mobile {
    padding: 4px;
  }

  .reminder-panel__loading {
    display: flex;
    justify-content: center;
    padding: 32px;
  }

  .reminder-panel__error {
    margin: 8px;
    padding: 8px;
    border-radius: 4px;
  }

  .reminder-panel__section {
    margin-bottom: 16px;
  }

  .reminder-panel__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 4px;
    font-weight: 600;
    font-size: 13px;
    color: var(--b3-theme-on-surface);
    border-bottom: 1px solid var(--b3-border-color);
  }

  .reminder-panel__icon {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }

  .reminder-panel__empty {
    padding: 16px 8px;
    text-align: center;
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    font-style: italic;
  }

  .reminder-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    margin: 4px 0;
    border-radius: 4px;
    border-left: 3px solid var(--b3-theme-primary);
    background: var(--b3-theme-surface);
    transition: background 0.15s;
  }

  .reminder-card:hover {
    background: var(--b3-list-hover);
  }

  .reminder-card--upcoming {
    opacity: 0.85;
  }

  .reminder-card__content {
    flex: 1;
    min-width: 0;
  }

  .reminder-card__name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--b3-theme-on-surface);
  }

  .reminder-card__meta {
    display: flex;
    gap: 8px;
    margin-top: 2px;
    font-size: 11px;
  }

  .reminder-card__time {
    color: var(--b3-theme-on-surface-light);
  }

  .reminder-card__priority {
    font-weight: 600;
    text-transform: capitalize;
  }

  .reminder-card__actions {
    display: flex;
    gap: 4px;
    margin-left: 8px;
    flex-shrink: 0;
  }

  .reminder-card__actions .b3-button--small {
    padding: 2px 6px;
    min-width: 24px;
    font-size: 12px;
  }
</style>
