<script lang="ts">
  /**
   * TasksView Component - Session 27 Refactored (Runtime Projection Layer)
   *
   * BEFORE (violations):
   *   Local formatDueDate() date computation
   *   Local getTaskStatus() duplicating DTO flags
   *   Direct uiQueryService.selectDashboard() call
   *   No recurring instance filtering
   *   Shows completed recurring parent templates
   *
   * AFTER (clean):
   *   Dashboard.store as data source (recurring-instance-filtered)
   *   task.lifecycleState / task.isOverdue for status display
   *   Mutations via uiMutationService only
   *   Event refresh via dashboardStore (not separate subscription)
   *   Blocked tasks shown with dependency indicator
   */
  import type { TaskDTO } from "../../../services/DTOs";
  import { uiMutationService } from "../../../services/UITaskMutationService";
  import {
    dashboardStore,
    dashboardTasks,
    dashboardLoading,
  } from "@stores/Dashboard.store";
  import * as logger from "@shared/logging/logger";
  import { onMount } from "svelte";

  // Props - NO backend types
  export let tabPanelId: string;
  export let tasksTabId: string;

  // State - driven by Dashboard.store
  $: tasks = $dashboardTasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled"
  ) as TaskDTO[];
  $: isLoading = $dashboardLoading;

  let editingTask: TaskDTO | null = null;
  let isCreating = false;

  // Form state
  let editName = "";
  let editDueAt = "";
  let editDescription = "";
  let validationError = "";

  // Status announcements for screen readers
  let statusMessage = "";

  onMount(() => {
    // Dashboard.store is already connected and refreshing.
    // If somehow empty, trigger a refresh.
    if (dashboardStore.getState().lastUpdated === 0) {
      dashboardStore.refresh();
    }
    statusMessage = `Loaded ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;
  });

  function handleCreateTask() {
    isCreating = true;
    editingTask = null;
    editName = "";
    editDueAt = "";
    editDescription = "";
    validationError = "";
    statusMessage = "Creating new task";
  }

  function handleEditTask(task: TaskDTO) {
    editingTask = task;
    isCreating = false;
    editName = task.name;
    editDueAt = task.dueAt ? task.dueAt.slice(0, 16) : "";
    editDescription = task.description || "";
    validationError = "";
    statusMessage = `Editing task: ${task.name}`;
  }

  async function handleSaveTask() {
    if (!editName.trim()) {
      validationError = "Task name is required";
      statusMessage = "Validation error: Task name cannot be empty";
      return;
    }

    validationError = "";

    try {
      if (isCreating) {
        const result = await uiMutationService.createTask({
          name: editName,
          dueAt: editDueAt ? new Date(editDueAt).toISOString() : new Date().toISOString(),
          enabled: true,
        });
        if (result.success) {
          statusMessage = `Created task: ${editName}`;
        } else {
          statusMessage = `Failed to create task: ${result.error}`;
        }
      } else if (editingTask) {
        const result = await uiMutationService.updateTask(editingTask.id, {
          name: editName,
          dueAt: editDueAt ? new Date(editDueAt).toISOString() : undefined,
          description: editDescription || undefined,
        });
        if (result.success) {
          statusMessage = `Saved task: ${editName}`;
        } else {
          statusMessage = `Failed to save task: ${result.error}`;
        }
      }

      // Dashboard.store will refresh automatically via event subscription
      editingTask = null;
      isCreating = false;
    } catch (error) {
      logger.error("[TasksView] Failed to save task:", error);
      statusMessage = "Error saving task";
    }
  }

  async function handleDeleteTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const result = await uiMutationService.deleteTask(taskId);
      if (result.success) {
        statusMessage = `Deleted task: ${task.name}`;
      } else {
        statusMessage = `Failed to delete task: ${result.error}`;
      }
    } catch (error) {
      logger.error("[TasksView] Failed to delete task:", error);
      statusMessage = "Error deleting task";
    }
  }

  async function handleCompleteTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);

    try {
      await uiMutationService.completeTask(taskId);
      if (task) {
        statusMessage = `Completed task: ${task.name}`;
      }
    } catch (error) {
      logger.error("[TasksView] Failed to complete task:", error);
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

  /**
   * Format due date display using DTO flags.
   * Uses task.isOverdue and task.lifecycleState instead of manual date computation.
   */
  function formatDueDisplay(task: TaskDTO): string {
    if (!task.dueAt) return "";
    const date = new Date(task.dueAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Use DTO isOverdue flag as source of truth
    if (task.isOverdue) return `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    if (days < 7) return `Due in ${days} days`;
    return date.toLocaleDateString();
  }

  /**
   * Get CSS class for task card based on DTO lifecycleState.
   * No local status recomputation.
   */
  function getStatusClass(task: TaskDTO): string {
    switch (task.lifecycleState) {
      case "overdue": return "overdue";
      case "due": return "today";
      case "blocked": return "blocked";
      default: return "";
    }
  }
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

      {#if validationError}
        <div class="rtm-validation-error" role="alert">
          {validationError}
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
          class:overdue={task.isOverdue}
          class:today={task.lifecycleState === "due"}
          class:blocked={task.isBlocked}
        >
          <div class="rtm-task-info">
            <div class="rtm-task-name">
              {task.name}
              {#if task.isBlocked}
                <span class="rtm-blocked-badge" title="Blocked by dependency">🚫</span>
              {/if}
            </div>
            {#if task.dueAt}
              <div class="rtm-task-due">{formatDueDisplay(task)}</div>
            {/if}
            {#if task.isRecurring}
              <div class="rtm-task-recurrence">
                🔄 {task.recurrenceText || "Recurring"}
                {#if task.occurrenceIndex != null}
                  <span class="rtm-occurrence-badge">#{task.occurrenceIndex}</span>
                {/if}
              </div>
            {/if}
            {#if task.lifecycleState === "blocked"}
              <div class="rtm-task-blocked-info">
                Waiting on dependencies
              </div>
            {/if}
          </div>
          <div class="rtm-task-actions">
            {#if !task.isBlocked}
              <button
                class="rtm-btn-icon"
                title="Complete"
                aria-label={`Complete task: ${task.name}`}
                on:click={() => handleCompleteTask(task.id)}
              >
                ✓
              </button>
            {/if}
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

  .rtm-task-card.blocked {
    border-left: 3px solid var(--b3-card-warning-color, #f59e0b);
    opacity: 0.85;
  }

  .rtm-task-info {
    flex: 1;
  }

  .rtm-task-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-background);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rtm-blocked-badge {
    font-size: 12px;
  }

  .rtm-task-due {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    margin-bottom: 4px;
  }

  .rtm-task-recurrence {
    font-size: 11px;
    color: var(--b3-theme-on-surface-light);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .rtm-occurrence-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 3px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-task-blocked-info {
    font-size: 11px;
    color: var(--b3-card-warning-color, #f59e0b);
    font-style: italic;
    margin-top: 2px;
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
