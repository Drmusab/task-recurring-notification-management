<script lang="ts">
  /**
   * TasksView Component - Extracted from Dashboard
   * Handles task listing, creation, editing, and deletion
   */
  import type { Task } from "@backend/core/models/Task";
  import type { TaskStorage } from "@backend/core/storage/TaskStorage";
  import type { TaskCreationService } from "@backend/core/services/TaskCreationService";
  import type { AutoMigrationService } from "@backend/core/services/AutoMigrationService";
  import type { PluginEventBus } from "@backend/core/events/PluginEventBus";

  // Props
  export let taskStorage: TaskStorage;
  export let taskCreationService: TaskCreationService;
  export let autoMigrationService: AutoMigrationService;
  export let eventBus: PluginEventBus;
  export let tabPanelId: string;
  export let tasksTabId: string;

  // State
  let tasks: Task[] = [];
  let isLoading = true;
  let editingTask: Task | null = null;
  let isCreating = false;

  // Form state
  let editName = "";
  let editDueAt = "";
  let editDescription = "";
  let validationError = ""; // Validation error for form

  // Abort controller for cancellable operations
  let loadTasksAbortController: AbortController | null = null;

  // Status announcements for screen readers
  let statusMessage = "";

  async function loadTasks() {
    // Cancel previous request
    if (loadTasksAbortController) {
      loadTasksAbortController.abort();
    }

    loadTasksAbortController = new AbortController();
    const { signal } = loadTasksAbortController;

    isLoading = true;
    statusMessage = "Loading tasks...";
    
    try {
      const loadedTasks = await taskStorage.loadActive(signal);

      // Only update state if not aborted
      if (!signal.aborted) {
        tasks = Array.from(loadedTasks.values());
        statusMessage = `Loaded ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;
      }
    } catch (error: any) {
      // Ignore abort errors
      if (error.name !== 'AbortError' && !signal.aborted) {
        console.error("[TasksView] Failed to load tasks:", error);
        statusMessage = "Error loading tasks";
      }
    } finally {
      if (!signal.aborted) {
        isLoading = false;
      }
      loadTasksAbortController = null;
    }
  }

  function handleCreateTask() {
    isCreating = true;
    editingTask = null;
    editName = "";
    editDueAt = "";
    editDescription = "";
    validationError = "";
    statusMessage = "Creating new task";
  }

  function handleEditTask(task: Task) {
    editingTask = task;
    isCreating = false;
    editName = task.name;
    editDueAt = task.dueAt ? task.dueAt.slice(0, 16) : "";
    editDescription = task.description || "";
    validationError = "";
    statusMessage = `Editing task: ${task.name}`;
  }

  async function handleSaveTask() {
    // Validate task name
    if (!editName.trim()) {
      validationError = "Task name is required";
      statusMessage = "Validation error: Task name cannot be empty";
      return;
    }
    
    validationError = ""; // Clear any previous errors
    
    try {
      if (isCreating) {
        // Create a new task
        const newTask = taskCreationService.createTask({
          name: editName,
          dueAt: editDueAt ? new Date(editDueAt) : new Date(),
          frequency: { type: "daily", interval: 1 },
          description: editDescription || undefined,
        });
        await taskStorage.saveTask(newTask);
        eventBus.emit("task:saved", { task: newTask, isNew: true });
        statusMessage = `Created task: ${editName}`;
      } else if (editingTask) {
        let updatedTask: Task = {
          ...editingTask,
          name: editName,
          dueAt: editDueAt ? new Date(editDueAt).toISOString() : editingTask.dueAt,
          description: editDescription || undefined,
        };
        
        // Auto-migrate task if needed
        if (autoMigrationService.shouldAutoMigrate(updatedTask as any)) {
          const migrationResult = autoMigrationService.migrateOnEdit(updatedTask as any);
          if (migrationResult.migrated && migrationResult.migratedTask) {
            updatedTask = migrationResult.migratedTask as any;
            console.log('[TasksView] Task auto-migrated to RRule:', updatedTask.id);
          }
        }
        
        await taskStorage.saveTask(updatedTask);
        eventBus.emit("task:saved", { task: updatedTask, isNew: false });
        statusMessage = `Saved task: ${editName}`;
      }
    } catch (error) {
      console.error("[TasksView] Failed to save task:", error);
      statusMessage = "Error saving task";
    }
  }

  async function handleDeleteTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    try {
      await taskStorage.deleteTask(taskId);
      tasks = tasks.filter((t: Task) => t.id !== taskId);
      statusMessage = `Deleted task: ${task.name}`;
    } catch (error) {
      console.error("[TasksView] Failed to delete task:", error);
      statusMessage = "Error deleting task";
    }
  }

  async function handleCompleteTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    eventBus.emit("task:complete", { taskId });
    await loadTasks();
    if (task) {
      statusMessage = `Completed task: ${task.name}`;
    }
  }

  function handleCancelEdit() {
    editingTask = null;
    isCreating = false;
    editName = "";
    editDueAt = "";
    editDescription = "";
    validationError = "";
    statusMessage = "Cancelled editing";
  }

  function formatDueDate(dueAt: string): string {
    const date = new Date(dueAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    if (days < 7) return `Due in ${days} days`;
    return date.toLocaleDateString();
  }

  function getTaskStatus(task: Task): string {
    const date = new Date(task.dueAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return "overdue";
    if (days === 0) return "today";
    return "upcoming";
  }

  // Event subscriptions
  let unsubscribeRefresh: (() => void) | null = null;
  let unsubscribeSaved: (() => void) | null = null;
  let unsubscribeEdit: (() => void) | null = null;

  // Lifecycle
  import { onMount, onDestroy } from "svelte";

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
        handleEditTask(data.task);
      } else {
        handleCreateTask();
      }
    });
  });

  onDestroy(() => {
    // Cancel any in-flight requests
    loadTasksAbortController?.abort();

    // Unsubscribe from events
    unsubscribeRefresh?.();
    unsubscribeSaved?.();
    unsubscribeEdit?.();
  });
</script>

<div 
  class="rtm-tasks-panel" 
  role="tabpanel" 
  id={tabPanelId}
  aria-labelledby={tasksTabId}
  tabindex="0"
>
  <!-- ARIA live region for status announcements -->
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {statusMessage}
  </div>

  <!-- Header -->
  <div class="rtm-panel-header">
    <h3>Recurring Tasks</h3>
    <button class="rtm-btn-primary" on:click={handleCreateTask}>
      + New Task
    </button>
  </div>

  {#if isLoading}
    <div class="rtm-loading" role="status" aria-live="polite">
      Loading tasks...
    </div>
  {:else if isCreating || editingTask}
    <!-- Inline Task Editor -->
    <div class="rtm-edit-form">
      <h4>{isCreating ? "New Task" : "Edit Task"}</h4>
      
      <!-- Validation Error Display -->
      {#if validationError}
        <div class="rtm-validation-error" role="alert">
          ⚠️ {validationError}
        </div>
      {/if}
      
      <label class="rtm-field">
        <span>Name</span>
        <input 
          type="text" 
          bind:value={editName} 
          placeholder="Task name"
          aria-label="Task name"
          aria-required="true"
          aria-invalid={validationError ? "true" : "false"}
          class:error={validationError}
        />
      </label>
      <label class="rtm-field">
        <span>Due Date</span>
        <input 
          type="datetime-local" 
          bind:value={editDueAt}
          aria-label="Due date"
        />
      </label>
      <label class="rtm-field">
        <span>Description</span>
        <textarea 
          bind:value={editDescription} 
          placeholder="Optional description" 
          rows="3"
          aria-label="Task description"
        ></textarea>
      </label>
      <div class="rtm-form-actions">
        <button 
          class="rtm-btn-primary" 
          on:click={handleSaveTask} 
          disabled={!editName.trim()}
        >
          {isCreating ? "Create" : "Save"}
        </button>
        <button class="rtm-btn-secondary" on:click={handleCancelEdit}>
          Cancel
        </button>
        {#if editingTask}
          <button 
            class="rtm-btn-danger-text" 
            on:click={() => { if (editingTask) handleDeleteTask(editingTask.id); }}
          >
            Delete
          </button>
        {/if}
      </div>
    </div>
  {:else if tasks.length === 0}
    <div class="rtm-empty-state" role="status">
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
            {#if (task as any).recurrence}
              <div class="rtm-task-recurrence">
                🔄 {(task as any).recurrence.humanReadable || "Recurring"}
              </div>
            {/if}
          </div>
          <div class="rtm-task-actions">
            <button
              class="rtm-btn-icon"
              title="Complete"
              aria-label={`Complete task: ${task.name}`}
              on:click={() => handleCompleteTask(task.id)}
            >
              ✓
            </button>
            <button
              class="rtm-btn-icon"
              title="Edit"
              aria-label={`Edit task: ${task.name}`}
              on:click={() => handleEditTask(task)}
            >
              ✏️
            </button>
            <button
              class="rtm-btn-icon rtm-btn-danger"
              title="Delete"
              aria-label={`Delete task: ${task.name}`}
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

  .rtm-tasks-panel {
    padding: 16px;
  }

  .rtm-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .rtm-panel-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .rtm-loading {
    text-align: center;
    padding: 40px;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-edit-form {
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .rtm-edit-form h4 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .rtm-field {
    display: flex;
    flex-direction: column;
    margin-bottom: 16px;
  }

  .rtm-field span {
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .rtm-field input,
  .rtm-field textarea {
    padding: 8px 12px;
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

  .rtm-btn-primary {
    padding: 8px 16px;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.2s;
  }

  .rtm-btn-primary:hover:not(:disabled) {
    background: var(--b3-theme-primary-light);
  }

  .rtm-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rtm-btn-secondary {
    padding: 8px 16px;
    background: transparent;
    color: var(--b3-theme-primary);
    border: 1px solid var(--b3-theme-primary);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .rtm-btn-secondary:hover {
    background: var(--b3-theme-primary-light);
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

  /* Validation Error Styles */
  .rtm-validation-error {
    padding: 12px;
    margin-bottom: 16px;
    background: var(--b3-card-error-background, rgba(239, 68, 68, 0.1));
    border: 1px solid var(--b3-card-error-color, #ef4444);
    border-radius: 6px;
    color: var(--b3-card-error-color, #ef4444);
    font-size: 13px;
    font-weight: 500;
  }

  .rtm-field input.error {
    border-color: var(--b3-card-error-color, #ef4444);
    background: var(--b3-card-error-background, rgba(239, 68, 68, 0.05));
  }

  .rtm-empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-empty-state p {
    margin: 0 0 16px 0;
    font-size: 15px;
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
    padding: 16px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    transition: all 0.2s;
  }

  .rtm-task-card:hover {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .rtm-task-card.overdue {
    border-left: 3px solid var(--b3-card-error-color, #ef4444);
  }

  .rtm-task-card.today {
    border-left: 3px solid var(--b3-theme-primary);
  }

  .rtm-task-info {
    flex: 1;
  }

  .rtm-task-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-background);
    margin-bottom: 4px;
  }

  .rtm-task-due {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    margin-bottom: 4px;
  }

  .rtm-task-recurrence {
    font-size: 11px;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-task-actions {
    display: flex;
    gap: 4px;
  }

  .rtm-btn-icon {
    padding: 6px 8px;
    background: transparent;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .rtm-btn-icon:hover {
    background: var(--b3-theme-primary-light);
    border-color: var(--b3-theme-primary);
  }

  .rtm-btn-icon.rtm-btn-danger:hover {
    background: var(--b3-card-error-background, rgba(239, 68, 68, 0.1));
    border-color: var(--b3-card-error-color, #ef4444);
  }
</style>
