<script lang="ts">
/**
 * TaskEditModal - Task edit dialog with WCAG 2.1 AA accessibility
 * 
 * @module TaskEditModal
 * @accessibility WCAG 2.1 AA compliant modal dialog pattern
 * @version 2.0.0
 */

import { createEventDispatcher, onMount, onDestroy } from 'svelte';
import DatePicker from './components/DatePicker.svelte';
import TagSelector from './components/TagSelector.svelte';
import RecurrencePicker from './components/RecurrencePicker.svelte';
import { StatusRegistry } from '../domain/models/TaskStatus';
import { createTask } from '../domain/models/Task';
import type { Task, TaskPriority } from '../domain/models/Task';
import { 
  trapFocus, 
  generateAriaId, 
  announceToScreenReader 
} from '@frontend/utils/accessibility';

export let task: Task | null = null;
export let open: boolean = false;

const dispatch = createEventDispatcher();
const registry = StatusRegistry.getInstance();

// Form state
let formData: Partial<Task> = {};
let isNewTask: boolean = true;
let isDirty: boolean = false;

// Focus management
let modalElement: HTMLElement;
let firstFocusableElement: HTMLElement | null = null;
let lastFocusedElement: HTMLElement | null = null;
let cleanupFocusTrap: (() => void) | null = null;

// Generate unique IDs for ARIA relationships
const modalTitleId = generateAriaId('modal-title');
const modalDescId = generateAriaId('modal-desc');

// Field options
const priorities: Array<{ value: TaskPriority; label: string; icon: string }> = [
  { value: 'highest', label: 'Highest', icon: '🔺' },
  { value: 'high', label: 'High', icon: '⏫' },
  { value: 'medium', label: 'Medium', icon: '🔼' },
  { value: 'none', label: 'Normal', icon: '' },
  { value: 'low', label: 'Low', icon: '🔽' },
  { value: 'lowest', label: 'Lowest', icon: '⏬' },
];

const completionActions = [
  { value: 'keep', label: 'Keep in document', icon: '📌' },
  { value: 'delete', label: 'Delete when done', icon: '🗑️' },
  { value: 'archive', label: 'Archive when done', icon: '📦' },
];

$: statusOptions = registry.getAll().map((status) => ({
  symbol: status.symbol,
  name: status.name,
  type: status.type,
}));

// Initialize form
$: if (open) {
  initializeForm();
}

function initializeForm() {
  if (task) {
    isNewTask = false;
    formData = { ...task };
  } else {
    isNewTask = true;
    formData = {
      name: '',
      status: 'todo',
      statusSymbol: ' ',
      priority: 'none',
      tags: [],
    };
  }
}

// Handle save
async function handleSave() {
  // Validate required fields
  if (!formData.name || !formData.name.trim()) {
    alert('Task description is required');
    return;
  }

  // Create or update task
  const taskToSave: Task = isNewTask
    ? createTask(formData)
    : { ...(task as Task), ...formData, updatedAt: new Date().toISOString() };

  dispatch('save', taskToSave);
  handleClose();
}

// Handle cancel
function handleClose() {
  open = false;
  dispatch('close');
}

// Handle delete
function handleDelete() {
  if (confirm('Are you sure you want to delete this task?')) {
    dispatch('delete', task);
    handleClose();
  }
}

// Handle keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleCloseWithConfirmation();
  } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    handleSave();
  }
}

// Handle close with dirty check
function handleCloseWithConfirmation() {
  if (isDirty) {
    const shouldClose = confirm('You have unsaved changes. Are you sure you want to close?');
    if (!shouldClose) return;
  }
  handleClose();
}

// Handle backdrop click
function handleBackdropClick() {
  handleCloseWithConfirmation();
}

// Track form changes
$: if (formData) {
  isDirty = JSON.stringify(formData) !== JSON.stringify(task || {});
}

// Accessibility: Focus trap and restoration
onMount(() => {
  if (!open) return;

  // Save currently focused element for restoration
  lastFocusedElement = document.activeElement as HTMLElement;

  // Wait for modal to render
  setTimeout(() => {
    if (!modalElement) return;

    // Set up focus trap
    cleanupFocusTrap = trapFocus(modalElement);

    // Focus first focusable element (description textarea)
    firstFocusableElement = modalElement.querySelector('textarea, input, select, button') as HTMLElement;
    if (firstFocusableElement) {
      firstFocusableElement.focus();
    }

    // Announce modal opening to screen readers
    announceToScreenReader(
      `${isNewTask ? 'New task' : 'Edit task'} dialog opened`,
      'polite'
    );
  }, 50);
});

onDestroy(() => {
  // Clean up focus trap
  if (cleanupFocusTrap) {
    cleanupFocusTrap();
  }

  // Restore focus to previously focused element
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
});

// Watch open state changes
$: if (!open && cleanupFocusTrap) {
  cleanupFocusTrap();
  cleanupFocusTrap = null;
  
  // Restore focus
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    setTimeout(() => {
      lastFocusedElement?.focus();
    }, 50);
  }
}
</script>

{#if open}
  <!-- Modal overlay - WCAG 2.1 AA Compliant -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="modal-overlay" 
    on:click={handleBackdropClick}
    aria-hidden="true"
  >
    <!-- Modal content -->
    <div
      class="modal-content"
      bind:this={modalElement}
      on:click|stopPropagation
      on:keydown={handleKeydown}
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      aria-describedby={modalDescId}
      tabindex="-1"
    >
      <!-- Header -->
      <div class="modal-header">
        <h2 class="modal-title" id={modalTitleId}>
          {#if isNewTask}
            <span aria-hidden="true">✨</span> New Task
          {:else}
            <span aria-hidden="true">✏️</span> Edit Task
          {/if}
        </h2>
        <button 
          class="modal-close" 
          on:click={handleCloseWithConfirmation}
          type="button"
          aria-label="Close dialog (Escape key)"
          title="Close (Esc)"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <!-- Hidden description for screen readers -->
        <p id={modalDescId} class="sr-only">
          {isNewTask ? 'Create a new task with description, dates, priority, and recurrence settings' : 'Edit task properties including description, dates, priority, and recurrence'}
        </p>
        <!-- Description -->
        <div class="form-group">
          <label for="task-description" class="form-label">
            Description <span class="required" aria-label="required">*</span>
          </label>
          <textarea
            id="task-description"
            class="form-input form-textarea"
            bind:value={formData.name}
            placeholder="What needs to be done?"
            rows="3"
            aria-required="true"
            aria-invalid={!formData.name?.trim()}
          ></textarea>
        </div>

        <!-- Dates row -->
        <div class="form-row">
          <!-- Due date -->
          <div class="form-group">
            <label for="task-due" class="form-label">📅 Due Date</label>
            <DatePicker
              bind:value={formData.dueAt}
              placeholder="When is it due?"
            />
          </div>

          <!-- Scheduled date -->
          <div class="form-group">
            <label for="task-scheduled" class="form-label">⏳ Scheduled</label>
            <DatePicker
              bind:value={formData.scheduledAt}
              placeholder="When to work on it?"
            />
          </div>

          <!-- Start date -->
          <div class="form-group">
            <label for="task-start" class="form-label">🛫 Start</label>
            <DatePicker
              bind:value={formData.startAt}
              placeholder="Earliest start date"
            />
          </div>
        </div>

        <!-- Priority and Status row -->
        <div class="form-row">
          <!-- Priority -->
          <div class="form-group">
            <label for="task-priority" class="form-label">Priority</label>
            <select
              id="task-priority"
              class="form-input form-select"
              bind:value={formData.priority}
            >
              {#each priorities as priority}
                <option value={priority.value}>
                  {priority.icon} {priority.label}
                </option>
              {/each}
            </select>
          </div>

          <!-- Status -->
          <div class="form-group">
            <label for="task-status" class="form-label">Status</label>
            <select
              id="task-status"
              class="form-input form-select"
              bind:value={formData.statusSymbol}
              on:change={(e) => {
                const symbol = e.currentTarget.value;
                const status = registry.get(symbol);
                formData.status = registry.mapTypeToStatus(status.type);
              }}
            >
              {#each statusOptions as status}
                <option value={status.symbol}>
                  [{status.symbol}] {status.name}
                </option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Tags -->
        <div class="form-group">
          <label for="task-tags" class="form-label">🏷️ Tags</label>
          <TagSelector bind:value={formData.tags} />
        </div>

        <!-- Recurrence -->
        <div class="form-group">
          <label for="task-recurrence" class="form-label">🔁 Recurrence</label>
          <RecurrencePicker bind:value={formData.frequency} />
        </div>

        <!-- On Completion -->
        <div class="form-group">
          <label for="task-completion" class="form-label">On Completion</label>
          <select
            id="task-completion"
            class="form-input form-select"
            bind:value={formData.onCompletion}
          >
            {#each completionActions as action}
              <option value={action.value}>
                {action.icon} {action.label}
              </option>
            {/each}
          </select>
        </div>

        <!-- Task ID (read-only for existing, auto-generated for new) -->
        {#if !isNewTask && formData.taskId}
          <div class="form-group">
            <label for="task-id" class="form-label">Task ID</label>
            <input
              id="task-id"
              type="text"
              class="form-input"
              value={formData.taskId}
              readonly
              title="Task ID (read-only)"
            />
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        {#if !isNewTask}
          <button 
            class="btn btn-danger" 
            on:click={handleDelete}
            type="button"
            aria-label="Delete this task permanently"
          >
            <span aria-hidden="true">🗑️</span> Delete
          </button>
        {/if}
        <div class="modal-footer-actions">
          <button 
            class="btn btn-secondary" 
            on:click={handleCloseWithConfirmation}
            type="button"
            aria-label="Cancel and close dialog"
          >
            Cancel
          </button>
          <button 
            class="btn btn-primary" 
            on:click={handleSave}
            type="button"
            disabled={!formData.name?.trim()}
            aria-label={isNewTask ? 'Create new task' : 'Save changes to task'}
          >
            {#if isNewTask}
              <span aria-hidden="true">✨</span> Create
            {:else}
              <span aria-hidden="true">💾</span> Save
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
/* Modal overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

/* Modal content */
.modal-content {
  background: var(--b3-theme-background);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  outline: none;
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-border-color);
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-text);
}

.modal-close {
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 20px;
  color: var(--b3-theme-text-light);
  transition: all 0.15s ease;
}

.modal-close:hover {
  background: var(--b3-theme-error-lighter);
  color: var(--b3-theme-error);
}

/* Body */
.modal-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* Form elements */
.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-text);
}

.required {
  color: var(--b3-theme-error);
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 8px 12px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 14px;
  color: var(--b3-theme-text);
  font-family: var(--b3-font-family);
  transition: all 0.15s ease;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
}

.form-input[readonly] {
  background: var(--b3-theme-surface-light);
  color: var(--b3-theme-text-light);
  cursor: not-allowed;
}

/* Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-top: 1px solid var(--b3-border-color);
}

.modal-footer-actions {
  display: flex;
  gap: 8px;
}

/* Buttons */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 44px;
  min-height: 44px;
}

.btn:focus-visible {
  outline: 2px solid var(--b3-theme-primary);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--b3-theme-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--b3-theme-primary-dark);
}

.btn-primary:disabled {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-text-light);
}

.btn-secondary {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-text);
  border: 1px solid var(--b3-border-color);
}

.btn-secondary:hover {
  background: var(--b3-list-hover);
}

.btn-danger {
  background: var(--b3-theme-error);
  color: white;
}

.btn-danger:hover {
  background: var(--b3-theme-error-dark);
}

/* Screen reader only utility */
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

/* Accessibility: Focus indicators */
.modal-content:focus-visible {
  outline: 2px solid var(--b3-theme-primary);
  outline-offset: -2px;
}

.modal-close:focus-visible {
  outline: 2px solid var(--b3-theme-primary);
  outline-offset: 2px;
}

/* Accessibility: High contrast mode support */
@media (prefers-contrast: high) {
  .modal-overlay {
    background: rgba(0, 0, 0, 0.8);
  }
  
  .modal-content {
    border: 2px solid currentColor;
  }
  
  .btn {
    border: 1px solid currentColor;
  }
}

/* Accessibility: Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .btn,
  .modal-close,
  .form-input,
  .form-textarea,
  .form-select {
    transition: none;
  }
}
</style>
