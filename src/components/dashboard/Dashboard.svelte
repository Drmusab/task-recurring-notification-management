<script lang="ts">
  /**
   * Main Dashboard Component
   *
   * Integrates all task management features:
   * - Task list display with inline editing
   * - Task creation
   * - Tracker dashboard
   * - Settings placeholder
   *
   * @module Dashboard
   */

  import { onMount, onDestroy } from "svelte";
  import TrackerDashboard from "../../frontend/components/common/TrackerDashboard.svelte";
  import type { Task } from "@backend/core/models/Task";
  import type { TaskStorage } from "@backend/core/storage/TaskStorage";
  import type { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
  import type { Scheduler } from "@backend/core/engine/Scheduler";
  import type { EventService } from "@backend/services/EventService";
  import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
  import type { Plugin } from "siyuan";

  // Props - all passed from index.ts mount call
  export let taskStorage: TaskStorage;
  export let recurrenceEngine: RecurrenceEngine | undefined = undefined;
  export let taskScheduler: Scheduler | undefined = undefined;
  export let notificationService: EventService | undefined = undefined;
  export let eventBus: PluginEventBus;
  export let plugin: Plugin;

  // Use refs to services for future expansion
  void recurrenceEngine;
  void taskScheduler;
  void notificationService;
  void plugin;

  // State
  let tasks: Task[] = [];
  let isLoading = true;
  let activeTab: "tasks" | "tracker" | "settings" = "tasks";
  let editingTask: Task | null = null;
  let isCreating = false;

  // Inline edit form state
  let editName = "";
  let editDueAt = "";
  let editDescription = "";

  // Subscriptions
  let unsubscribeRefresh: (() => void) | null = null;
  let unsubscribeSaved: (() => void) | null = null;
  let unsubscribeEdit: (() => void) | null = null;

  onMount(async () => {
    await loadTasks();

    // Subscribe to events
    unsubscribeRefresh = eventBus.on("task:refresh", () => {
      loadTasks();
    });

    unsubscribeSaved = eventBus.on("task:saved", ({ task, isNew }: { task: Task; isNew: boolean }) => {
      if (isNew) {
        tasks = [...tasks, task];
      } else {
        tasks = tasks.map((t: Task) => (t.id === task.id ? task : t));
      }
      editingTask = null;
      isCreating = false;
    });

    unsubscribeEdit = eventBus.on("task:edit", (data) => {
      if (data.task) {
        editingTask = data.task;
        editName = data.task.name;
        editDueAt = data.task.dueAt ? data.task.dueAt.slice(0, 16) : "";
        editDescription = data.task.description || "";
      } else {
        isCreating = true;
        editName = "";
        editDueAt = "";
        editDescription = "";
      }
    });
  });

  onDestroy(() => {
    unsubscribeRefresh?.();
    unsubscribeSaved?.();
    unsubscribeEdit?.();
  });

  async function loadTasks() {
    isLoading = true;
    try {
      const loadedTasks = await taskStorage.loadActive();
      tasks = Array.from(loadedTasks.values());
    } catch (error) {
      console.error("[Dashboard] Failed to load tasks:", error);
    } finally {
      isLoading = false;
    }
  }

  function handleCreateTask() {
    isCreating = true;
    editingTask = null;
    editName = "";
    editDueAt = "";
    editDescription = "";
  }

  function handleEditTask(task: Task) {
    editingTask = task;
    isCreating = false;
    editName = task.name;
    editDueAt = task.dueAt ? task.dueAt.slice(0, 16) : "";
    editDescription = task.description || "";
  }

  async function handleSaveTask() {
    try {
      if (isCreating) {
        // Create a new task with minimal required fields
        const now = new Date().toISOString();
        const newTask: Task = {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
          name: editName,
          dueAt: editDueAt ? new Date(editDueAt).toISOString() : now,
          frequency: { type: "daily", interval: 1 },
          enabled: true,
          description: editDescription || undefined,
          createdAt: now,
          updatedAt: now,
        };
        await taskStorage.saveTask(newTask);
        eventBus.emit("task:saved", { task: newTask, isNew: true });
      } else if (editingTask) {
        const updatedTask: Task = {
          ...editingTask,
          name: editName,
          dueAt: editDueAt ? new Date(editDueAt).toISOString() : editingTask.dueAt,
          description: editDescription || undefined,
        };
        await taskStorage.saveTask(updatedTask);
        eventBus.emit("task:saved", { task: updatedTask, isNew: false });
      }
    } catch (error) {
      console.error("[Dashboard] Failed to save task:", error);
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await taskStorage.deleteTask(taskId);
      tasks = tasks.filter((t: Task) => t.id !== taskId);
    } catch (error) {
      console.error("[Dashboard] Failed to delete task:", error);
    }
  }

  async function handleCompleteTask(taskId: string) {
    eventBus.emit("task:complete", { taskId });
    await loadTasks();
  }

  function handleCancelEdit() {
    editingTask = null;
    isCreating = false;
    editName = "";
    editDueAt = "";
    editDescription = "";
  }

  function formatDueDate(dueAt: string): string {
    const date = new Date(dueAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return `Overdue by ${Math.abs(days)} day(s)`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days} days`;
  }

  function getTaskStatus(task: Task): "overdue" | "today" | "upcoming" {
    const now = new Date();
    const due = new Date(task.dueAt);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    if (dueDay < today) return "overdue";
    if (dueDay.getTime() === today.getTime()) return "today";
    return "upcoming";
  }
</script>

<div class="rtm-dashboard">
  <!-- Tab Navigation -->
  <div class="rtm-tabs">
    <button
      class="rtm-tab"
      class:active={activeTab === "tasks"}
      on:click={() => (activeTab = "tasks")}
    >
      📋 Tasks
    </button>
    <button
      class="rtm-tab"
      class:active={activeTab === "tracker"}
      on:click={() => (activeTab = "tracker")}
    >
      📊 Tracker
    </button>
    <button
      class="rtm-tab"
      class:active={activeTab === "settings"}
      on:click={() => (activeTab = "settings")}
    >
      ⚙️ Settings
    </button>
  </div>

  <!-- Content Area -->
  <div class="rtm-content">
    {#if activeTab === "tasks"}
      <div class="rtm-tasks-panel">
        <!-- Header -->
        <div class="rtm-panel-header">
          <h3>Recurring Tasks</h3>
          <button class="rtm-btn-primary" on:click={handleCreateTask}>
            + New Task
          </button>
        </div>

        {#if isLoading}
          <div class="rtm-loading">Loading tasks...</div>
        {:else if isCreating || editingTask}
          <!-- Inline Task Editor -->
          <div class="rtm-edit-form">
            <h4>{isCreating ? "New Task" : "Edit Task"}</h4>
            <label class="rtm-field">
              <span>Name</span>
              <input type="text" bind:value={editName} placeholder="Task name" />
            </label>
            <label class="rtm-field">
              <span>Due Date</span>
              <input type="datetime-local" bind:value={editDueAt} />
            </label>
            <label class="rtm-field">
              <span>Description</span>
              <textarea bind:value={editDescription} placeholder="Optional description" rows="3"></textarea>
            </label>
            <div class="rtm-form-actions">
              <button class="rtm-btn-primary" on:click={handleSaveTask} disabled={!editName.trim()}>
                {isCreating ? "Create" : "Save"}
              </button>
              <button class="rtm-btn-secondary" on:click={handleCancelEdit}>Cancel</button>
              {#if editingTask}
                <button class="rtm-btn-danger-text" on:click={() => { if (editingTask) handleDeleteTask(editingTask.id); }}>
                  Delete
                </button>
              {/if}
            </div>
          </div>
        {:else if tasks.length === 0}
          <div class="rtm-empty-state">
            <p>No recurring tasks yet</p>
            <button class="rtm-btn-secondary" on:click={handleCreateTask}>
              Create your first task
            </button>
          </div>
        {:else}
          <div class="rtm-task-list">
            {#each tasks as task (task.id)}
              <div
                class="rtm-task-card"
                class:overdue={getTaskStatus(task) === "overdue"}
                class:today={getTaskStatus(task) === "today"}
              >
                <div class="rtm-task-info">
                  <div class="rtm-task-name">{task.name}</div>
                  <div class="rtm-task-due">{formatDueDate(task.dueAt)}</div>
                  {#if task.frequency?.rruleString}
                    <div class="rtm-task-recurrence">
                      🔄 {task.frequency.naturalLanguage || task.frequency.type || "Recurring"}
                    </div>
                  {/if}
                </div>
                <div class="rtm-task-actions">
                  <button
                    class="rtm-btn-icon"
                    title="Complete"
                    on:click={() => handleCompleteTask(task.id)}
                  >
                    ✓
                  </button>
                  <button
                    class="rtm-btn-icon"
                    title="Edit"
                    on:click={() => handleEditTask(task)}
                  >
                    ✏️
                  </button>
                  <button
                    class="rtm-btn-icon rtm-btn-danger"
                    title="Delete"
                    on:click={() => handleDeleteTask(task.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeTab === "tracker"}
      <TrackerDashboard onClose={() => (activeTab = "tasks")} />
    {:else if activeTab === "settings"}
      <div class="rtm-settings-panel">
        <h3>Settings</h3>
        <p>Settings panel coming soon...</p>
      </div>
    {/if}
  </div>
</div>

<style>
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
    background: var(--b3-theme-surface-light);
  }

  .rtm-tab.active {
    color: var(--b3-theme-primary);
    border-bottom-color: var(--b3-theme-primary);
  }

  .rtm-content {
    flex: 1;
    overflow: auto;
    padding: 12px;
  }

  .rtm-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .rtm-panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .rtm-btn-primary {
    padding: 6px 12px;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }

  .rtm-btn-primary:hover {
    opacity: 0.9;
  }

  .rtm-btn-secondary {
    padding: 6px 12px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }

  .rtm-loading,
  .rtm-empty-state {
    text-align: center;
    padding: 24px;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rtm-task-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: var(--b3-theme-surface);
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
  }

  .rtm-task-card.overdue {
    border-left: 3px solid var(--b3-card-error-color, #ef4444);
  }

  .rtm-task-card.today {
    border-left: 3px solid var(--b3-card-warning-color, #f59e0b);
  }

  .rtm-task-info {
    flex: 1;
  }

  .rtm-task-name {
    font-weight: 500;
    margin-bottom: 4px;
  }

  .rtm-task-due {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-task-recurrence {
    font-size: 11px;
    color: var(--b3-theme-primary);
    margin-top: 2px;
  }

  .rtm-task-actions {
    display: flex;
    gap: 4px;
  }

  .rtm-btn-icon {
    padding: 4px 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 4px;
    font-size: 14px;
  }

  .rtm-btn-icon:hover {
    background: var(--b3-theme-surface-light);
  }

  .rtm-btn-danger:hover {
    background: var(--b3-card-error-background, #fef2f2);
    color: var(--b3-card-error-color, #ef4444);
  }

  .rtm-settings-panel {
    padding: 16px;
  }

  .rtm-settings-panel h3 {
    margin: 0 0 12px 0;
  }

  .rtm-edit-form {
    padding: 16px;
    background: var(--b3-theme-surface);
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
  }

  .rtm-edit-form h4 {
    margin: 0 0 12px 0;
    font-size: 15px;
  }

  .rtm-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .rtm-field span {
    font-size: 12px;
    font-weight: 500;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-field input,
  .rtm-field textarea {
    padding: 6px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 13px;
    font-family: var(--b3-font-family);
  }

  .rtm-field textarea {
    resize: vertical;
  }

  .rtm-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .rtm-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rtm-btn-danger-text {
    padding: 6px 12px;
    background: transparent;
    color: var(--b3-card-error-color, #ef4444);
    border: none;
    cursor: pointer;
    font-size: 13px;
    margin-left: auto;
  }

  .rtm-btn-danger-text:hover {
    text-decoration: underline;
  }
</style>
