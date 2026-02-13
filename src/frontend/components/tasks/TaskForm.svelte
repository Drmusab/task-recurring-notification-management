<script lang="ts">
  /**
   * TaskForm Component
   * 
   * Reusable form for creating or editing tasks with full accessibility support.
   * WCAG 2.1 AA compliant with proper labels, error messages, and keyboard navigation.
   * 
   * @component
   */
  
  import { createEventDispatcher } from 'svelte';
  import Button from '../shared/Button.svelte';
  import DatePicker from '../shared/pickers/DatePicker.svelte';
  import TagSelector from '../shared/pickers/TagSelector.svelte';
  
  export let task: {
    id?: string;
    description: string;
    priority?: 'low' | 'medium' | 'high';
    status?: 'todo' | 'in-progress' | 'done';
    dueDate?: string;
    startDate?: string;
    tags?: string[];
    project?: string;
    notes?: string;
  } = {
    description: '',
    priority: 'medium',
    status: 'todo',
    tags: []
  };
  
  export let submitLabel = 'Save Task';
  export let showCancel = true;
  export let disabled = false;
  
  const dispatch = createEventDispatcher();
  
  let formElement: HTMLFormElement;
  let descriptionElement: HTMLTextAreaElement;
  
  // Validation errors
  let errors: Record<string, string> = {};
  
  // Form dirty state
  let isDirty = false;
  
  function handleInput() {
    isDirty = true;
    // Clear errors on input
    if (errors.description && task.description.trim()) {
      errors = { ...errors, description: '' };
    }
  }
  
  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    
    if (!task.description || task.description.trim().length === 0) {
      newErrors.description = 'Task description is required';
    }
    
    if (task.description && task.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }
    
    if (task.notes && task.notes.length > 2000) {
      newErrors.notes = 'Notes must be less than 2000 characters';
    }
    
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }
  
  function handleSubmit(event: Event) {
    event.preventDefault();
    
    if (!validate()) {
      // Focus first error field
      if (errors.description) {
        descriptionElement?.focus();
      }
      return;
    }
    
    dispatch('submit', { task });
    isDirty = false;
  }
  
  function handleCancel() {
    if (isDirty) {
      const confirmed = confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirmed) return;
    }
    
    dispatch('cancel');
  }
  
  // Auto-focus description on mount
  import { onMount } from 'svelte';
  onMount(() => {
    descriptionElement?.focus();
  });
</script>

<form
  bind:this={formElement}
  class="task-form"
  on:submit={handleSubmit}
  novalidate
  aria-labelledby="task-form-title"
>
  <h3 id="task-form-title" class="sr-only">
    {task.id ? 'Edit Task' : 'Create New Task'}
  </h3>
  
  <!-- Description -->
  <div class="task-form__field">
    <label for="task-description" class="task-form__label">
      Description
      <span class="task-form__required" aria-label="required">*</span>
    </label>
    
    <textarea
      bind:this={descriptionElement}
      id="task-description"
      bind:value={task.description}
      class="task-form__textarea"
      class:task-form__textarea--error={errors.description}
      placeholder="What needs to be done?"
      rows={3}
      maxlength={500}
      required
      aria-required="true"
      aria-invalid={Boolean(errors.description)}
      aria-describedby={errors.description ? 'description-error description-hint' : 'description-hint'}
      {disabled}
      on:input={handleInput}
    ></textarea>
    
    <div id="description-hint" class="task-form__hint">
      {task.description.length}/500 characters
    </div>
    
    {#if errors.description}
      <div id="description-error" class="task-form__error" role="alert">
        {errors.description}
      </div>
    {/if}
  </div>
  
  <!-- Priority -->
  <div class="task-form__field">
    <label for="task-priority" class="task-form__label">
      Priority
    </label>
    
    <select
      id="task-priority"
      bind:value={task.priority}
      class="task-form__select"
      {disabled}
    >
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
    </select>
  </div>
  
  <!-- Status -->
  <div class="task-form__field">
    <label for="task-status" class="task-form__label">
      Status
    </label>
    
    <select
      id="task-status"
      bind:value={task.status}
      class="task-form__select"
      {disabled}
    >
      <option value="todo">To Do</option>
      <option value="in-progress">In Progress</option>
      <option value="done">Done</option>
    </select>
  </div>
  
  <!-- Dates Row -->
  <div class="task-form__row">
    <!-- Start Date -->
    <div class="task-form__field">
      <DatePicker
        label="Start Date"
        bind:value={task.startDate}
      />
    </div>
    
    <!-- Due Date -->
    <div class="task-form__field">
      <DatePicker
        label="Due Date"
        bind:value={task.dueDate}
      />
    </div>
  </div>
  
  <!-- Project -->
  <div class="task-form__field">
    <label for="task-project" class="task-form__label">
      Project
    </label>
    
    <input
      id="task-project"
      type="text"
      bind:value={task.project}
      class="task-form__input"
      placeholder="e.g., Work, Personal"
      maxlength={100}
      {disabled}
    />
  </div>
  
  <!-- Tags -->
  <div class="task-form__field">
    <TagSelector
      bind:value={task.tags}
    />
  </div>
  
  <!-- Notes -->
  <div class="task-form__field">
    <label for="task-notes" class="task-form__label">
      Notes
    </label>
    
    <textarea
      id="task-notes"
      bind:value={task.notes}
      class="task-form__textarea"
      class:task-form__textarea--error={errors.notes}
      placeholder="Additional details, context, or reminders..."
      rows={5}
      maxlength={2000}
      aria-invalid={Boolean(errors.notes)}
      aria-describedby={errors.notes ? 'notes-error notes-hint' : 'notes-hint'}
      {disabled}
    ></textarea>
    
    <div id="notes-hint" class="task-form__hint">
      {(task.notes || '').length}/2000 characters
    </div>
    
    {#if errors.notes}
      <div id="notes-error" class="task-form__error" role="alert">
        {errors.notes}
      </div>
    {/if}
  </div>
  
  <!-- Actions -->
  <div class="task-form__actions" role="group" aria-label="Form actions">
    {#if showCancel}
      <Button
        type="button"
        variant="secondary"
        ariaLabel="Cancel editing"
        disabled={disabled}
        on:click={handleCancel}
      >
        Cancel
      </Button>
    {/if}
    
    <Button
      type="submit"
      variant="primary"
      ariaLabel={submitLabel}
      disabled={disabled}
    >
      {submitLabel}
    </Button>
  </div>
</form>

<style>
  .task-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 600px;
  }
  
  .task-form__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .task-form__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  
  .task-form__label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .task-form__required {
    color: #dc2626;
    font-weight: 700;
  }
  
  .task-form__input,
  .task-form__select,
  .task-form__textarea {
    padding: 10px 12px;
    font-size: 14px;
    font-family: inherit;
    color: var(--text-normal);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  .task-form__input:focus,
  .task-form__select:focus,
  .task-form__textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px var(--interactive-accent-hover);
  }
  
  .task-form__input:disabled,
  .task-form__select:disabled,
  .task-form__textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .task-form__textarea {
    resize: vertical;
    min-height: 80px;
    line-height: 1.5;
  }
  
  .task-form__textarea--error {
    border-color: #dc2626;
  }
  
  .task-form__hint {
    font-size: 12px;
    color: var(--text-muted);
  }
  
  .task-form__error {
    font-size: 13px;
    color: #dc2626;
    font-weight: 500;
  }
  
  .task-form__actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-border);
  }
  
  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .task-form__input,
    .task-form__select,
    .task-form__textarea {
      border-width: 2px;
    }
    
    .task-form__input:focus,
    .task-form__select:focus,
    .task-form__textarea:focus {
      box-shadow: 0 0 0 2px var(--interactive-accent);
    }
  }
  
  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .task-form__input,
    .task-form__select,
    .task-form__textarea {
      transition: none;
    }
  }
  
  /* Screen Reader Only */
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
  
  /* Responsive */
  @media (max-width: 640px) {
    .task-form {
      max-width: 100%;
    }
    
    .task-form__row {
      grid-template-columns: 1fr;
    }
    
    .task-form__actions {
      flex-direction: column-reverse;
    }
    
    .task-form__actions :global(button) {
      width: 100%;
    }
  }
</style>
