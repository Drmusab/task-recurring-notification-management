<script lang="ts">
  /**
   * EditTask - Native SiYuan task editor form
   *
   * Provides core task editing: name, description, priority, status,
   * dates (due, scheduled, start), and recurrence (RRule).
   *
   * Uses SiYuan CSS variables for native look & feel.
   *
   * @module EditTask
   */

  import { onMount } from "svelte";
  import type { Task } from "@backend/core/models/Task";
  import type { Recurrence } from "@domain/models/Recurrence";

  /** Minimal status option for the dropdown */
  interface StatusOption {
    symbol: string;
    name: string;
  }

  /** The task being edited */
  export let task: Task;
  /** Available status options */
  export let statusOptions: StatusOption[] = [];
  /** Submit callback — receives array of updated tasks */
  export let onSubmit: (updatedTasks: Task[]) => void | Promise<void> = () => {};

  // Editable fields (local state)
  let editName = task.name || "";
  let editDescription = task.description || "";
  let editPriority = task.priority || "medium";
  let editStatus = task.status || "todo";
  let editDueAt = task.dueAt ? task.dueAt.slice(0, 16) : "";
  let editScheduledAt = task.scheduledAt ? task.scheduledAt.slice(0, 16) : "";
  let editStartAt = task.startAt ? task.startAt.slice(0, 16) : "";
  let editRecurrenceRule = task.recurrence?.rrule || "";
  let editEnabled = task.enabled !== false;

  let nameInput: HTMLInputElement;
  let formIsValid = true;

  $: formIsValid = editName.trim().length > 0;

  onMount(() => {
    setTimeout(() => nameInput?.focus(), 10);
  });

  function handleSubmit() {
    if (!formIsValid) return;

    const updated: Task = {
      ...task,
      name: editName.trim(),
      description: editDescription.trim(),
      priority: editPriority as Task["priority"],
      status: editStatus,
      dueAt: editDueAt ? new Date(editDueAt).toISOString() : "",
      scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : undefined,
      startAt: editStartAt ? new Date(editStartAt).toISOString() : undefined,
      enabled: editEnabled,
      updatedAt: new Date().toISOString(),
    };

    // Attach recurrence if provided
    if (editRecurrenceRule.trim()) {
      const recurrence: Recurrence = {
        rrule: editRecurrenceRule.trim(),
        baseOnToday: task.recurrence?.baseOnToday ?? false,
        humanReadable: task.recurrence?.humanReadable || editRecurrenceRule.trim(),
        referenceDate: task.recurrence?.referenceDate,
        timezone: task.recurrence?.timezone,
        time: task.recurrence?.time,
        originalInput: task.recurrence?.originalInput,
      };
      updated.recurrence = recurrence;
    } else {
      // Clear recurrence if input emptied
      updated.recurrence = undefined;
    }

    onSubmit([updated]);
  }

  function handleCancel() {
    onSubmit([]);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && formIsValid) {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<form class="edit-task-form" on:submit|preventDefault={handleSubmit}>
  <!-- Name -->
  <div class="edit-task-field">
    <label for="task-name" class="edit-task-label">Name</label>
    <input
      bind:this={nameInput}
      bind:value={editName}
      id="task-name"
      type="text"
      class="b3-text-field fn__block"
      placeholder="Task name..."
      on:keydown={handleKeyDown}
    />
  </div>

  <!-- Description -->
  <div class="edit-task-field">
    <label for="task-desc" class="edit-task-label">Description</label>
    <textarea
      bind:value={editDescription}
      id="task-desc"
      class="b3-text-field fn__block"
      placeholder="Optional description..."
      rows="2"
    ></textarea>
  </div>

  <!-- Priority & Status row -->
  <div class="edit-task-row">
    <div class="edit-task-field" style="flex: 1;">
      <label for="task-priority" class="edit-task-label">Priority</label>
      <select bind:value={editPriority} id="task-priority" class="b3-select" style="width: 100%;">
        <option value="lowest">Lowest</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="highest">Highest</option>
      </select>
    </div>
    <div class="edit-task-field" style="flex: 1;">
      <label for="task-status" class="edit-task-label">Status</label>
      <select bind:value={editStatus} id="task-status" class="b3-select" style="width: 100%;">
        {#each statusOptions as status}
          <option value={status.symbol}>{status.name}</option>
        {/each}
        {#if statusOptions.length === 0}
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        {/if}
      </select>
    </div>
  </div>

  <!-- Dates -->
  <div class="edit-task-field">
    <label for="task-due" class="edit-task-label">Due Date</label>
    <input
      bind:value={editDueAt}
      id="task-due"
      type="datetime-local"
      class="b3-text-field"
      style="width: 100%;"
    />
  </div>

  <div class="edit-task-row">
    <div class="edit-task-field" style="flex: 1;">
      <label for="task-scheduled" class="edit-task-label">Scheduled</label>
      <input
        bind:value={editScheduledAt}
        id="task-scheduled"
        type="datetime-local"
        class="b3-text-field"
        style="width: 100%;"
      />
    </div>
    <div class="edit-task-field" style="flex: 1;">
      <label for="task-start" class="edit-task-label">Start Date</label>
      <input
        bind:value={editStartAt}
        id="task-start"
        type="datetime-local"
        class="b3-text-field"
        style="width: 100%;"
      />
    </div>
  </div>

  <!-- Recurrence (RRule) -->
  <div class="edit-task-field">
    <label for="task-rrule" class="edit-task-label">Recurrence (RRule)</label>
    <input
      bind:value={editRecurrenceRule}
      id="task-rrule"
      type="text"
      class="b3-text-field"
      style="width: 100%;"
      placeholder="e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR"
    />
    <div class="edit-task-hint">RFC 5545 RRule format. Leave empty for one-time tasks.</div>
  </div>

  <!-- Enabled toggle -->
  <div class="edit-task-field" style="flex-direction: row; align-items: center; gap: 8px;">
    <label for="task-enabled" class="edit-task-label">Enabled</label>
    <input
      bind:checked={editEnabled}
      id="task-enabled"
      type="checkbox"
      class="b3-switch"
    />
  </div>

  <!-- Actions -->
  <div class="edit-task-actions">
    <button type="button" class="b3-button b3-button--outline" on:click={handleCancel}>
      Cancel
    </button>
    <button type="submit" class="b3-button b3-button--text" disabled={!formIsValid}>
      {task.id ? "Save" : "Create"}
    </button>
  </div>
</form>

<style>
  .edit-task-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 0;
  }
  .edit-task-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .edit-task-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }
  .edit-task-row {
    display: flex;
    gap: 12px;
  }
  .edit-task-hint {
    font-size: 11px;
    color: var(--b3-theme-on-surface-light, #888);
  }
  .edit-task-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--b3-border-color);
  }
</style>
