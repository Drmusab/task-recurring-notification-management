<script lang="ts">
/**
 * TaskListItem - Individual task row component with WCAG 2.1 AA accessibility
 * 
 * @module TaskListItem
 * @accessibility WCAG 2.1 AA compliant
 * @version 2.0.0
 */

import { createEventDispatcher } from 'svelte';
import { StatusRegistry } from '../../domain/models/TaskStatus';
import type { Task } from '../../domain/models/Task';
import { formatRelativeDate } from '../../domain/utils/DateUtils';
import { 
  getTaskAriaLabel, 
  getStatusText, 
  generateAriaId 
} from '@frontend/utils/accessibility';

export let task: Task;
export let index: number = 0;

const dispatch = createEventDispatcher();
const registry = StatusRegistry.getInstance();

// Generate unique IDs for ARIA relationships
const taskDescId = generateAriaId('task-desc');
const taskMetaId = generateAriaId('task-meta');

// Get status icon
$: statusInfo = registry.get(task.statusSymbol || ' ');
$: statusIcon = getStatusIcon(task.status);

function getStatusIcon(status: string): string {
  switch (status) {
    case 'done':
      return '✅';
    case 'cancelled':
      return '❌';
    case 'in-progress':
      return '⏳';
    default:
      return '◻️';
  }
}

// Get priority icon
function getPriorityIcon(priority?: string): string {
  switch (priority) {
    case 'highest':
      return '🔺';
    case 'high':
      return '⏫';
    case 'medium':
      return '🔼';
    case 'low':
      return '🔽';
    case 'lowest':
      return '⏬';
    default:
      return '';
  }
}

// Format date for display
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  
  try {
    const date = new Date(dateStr);
    return formatRelativeDate(date);
  } catch {
    return dateStr;
  }
}

// Check if overdue
function isOverdue(task: Task): boolean {
  if (!task.dueAt || task.status === 'done' || task.status === 'cancelled') {
    return false;
  }

  const dueDate = new Date(task.dueAt);
  const now = new Date();

  return dueDate < now;
}

// Handle checkbox click
function handleToggle(event: Event) {
  event.stopPropagation();
  dispatch('toggle');
}

// Handle row click
function handleClick() {
  dispatch('click');
}

// Handle edit button click
function handleEdit(event: Event) {
  event.stopPropagation();
  dispatch('edit');
}

// Handle keyboard navigation
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleClick();
  }
}

// Generate comprehensive ARIA label
$: ariaLabel = getTaskAriaLabel(task);
$: statusText = getStatusText(task.status);
</script>

<div
  class="task-list-item"
  class:overdue={isOverdue(task)}
  class:done={task.status === 'done'}
  on:click={handleClick}
  on:keydown={handleKeyDown}
  role="button"
  tabindex="0"
  aria-label={ariaLabel}
  aria-describedby="{taskDescId} {taskMetaId}"
  data-task-id={task.id}
  data-task-index={index}
>
  <!-- Checkbox -->
  <button
    class="task-checkbox"
    on:click={handleToggle}
    type="button"
    title="{statusText} - Click to toggle"
    aria-label="Mark task as {task.status === 'done' ? 'incomplete' : 'complete'}"
    aria-pressed={task.status === 'done'}
  >
    <span class="checkbox-icon" aria-hidden="true">{statusIcon}</span>
  </button>

  <!-- Task content -->
  <div class="task-content">
    <!-- Description -->
    <div class="task-description" id={taskDescId}>
      {#if task.priority}
        <span 
          class="task-priority" 
          aria-label="{task.priority} priority"
          role="img"
        >
          {getPriorityIcon(task.priority)}
        </span>
      {/if}
      <span class="task-name">{task.name}</span>
      {#if task.tags && task.tags.length > 0}
        <span 
          class="task-tags" 
          role="list" 
          aria-label="Task tags"
        >
          {#each task.tags.slice(0, 3) as tag, i}
            <span class="task-tag" role="listitem">{tag}</span>
          {/each}
          {#if task.tags.length > 3}
            <span 
              class="task-tag-more"
              aria-label="{task.tags.length - 3} more tags"
            >
              +{task.tags.length - 3}
            </span>
          {/if}
        </span>
      {/if}
    </div>

    <!-- Metadata -->
    <div class="task-metadata" id={taskMetaId}>
      {#if task.dueAt}
        <span class="task-date task-due">
          <span aria-hidden="true">📅</span>
          <time 
            datetime={task.dueAt}
            aria-label="Due {formatDate(task.dueAt)}"
          >
            {formatDate(task.dueAt)}
          </time>
        </span>
      {/if}
      {#if task.scheduledAt}
        <span class="task-date task-scheduled">
          <span aria-hidden="true">⏳</span>
          <time 
            datetime={task.scheduledAt}
            aria-label="Scheduled {formatDate(task.scheduledAt)}"
          >
            {formatDate(task.scheduledAt)}
          </time>
        </span>
      {/if}
      {#if task.frequency}
        <span 
          class="task-recurrence" 
          aria-label="Recurring: {task.recurrenceText || 'recurring'}"
        >
          <span aria-hidden="true">🔁</span>
          <span>{task.recurrenceText || 'recurring'}</span>
        </span>
      {/if}
      {#if task.path}
        <span 
          class="task-path" 
          title={task.path}
          aria-label="File: {task.path}"
        >
          <span aria-hidden="true">📄</span>
          <span>{task.path.split('/').pop()}</span>
        </span>
      {/if}
    </div>
  </div>

  <!-- Actions -->
  <div class="task-actions" role="group" aria-label="Task actions">
    <button
      class="task-action-btn"
      on:click={handleEdit}
      type="button"
      title="Edit task: {task.name}"
      aria-label="Edit {task.name}"
    >
      <span aria-hidden="true">✏️</span>
      <span class="sr-only">Edit task</span>
    </button>
  </div>
</div>

<style>
.task-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  min-height: 60px;
  border-bottom: 1px solid var(--b3-border-color);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.task-list-item:hover {
  background: var(--b3-list-hover);
}

.task-list-item.done {
  opacity: 0.6;
}

.task-list-item.done .task-name {
  text-decoration: line-through;
}

.task-list-item.overdue .task-due {
  color: var(--b3-card-error-color);
  font-weight: 500;
}

/* Checkbox */
.task-checkbox {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  transition: transform 0.15s ease;
}

.task-checkbox:hover {
  transform: scale(1.1);
}

.checkbox-icon {
  display: block;
}

/* Content */
.task-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-description {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.task-priority {
  font-size: 14px;
  flex-shrink: 0;
}

.task-name {
  font-size: 14px;
  color: var(--b3-theme-text);
  word-break: break-word;
}

.task-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.task-tag {
  display: inline-block;
  padding: 2px 6px;
  background: var(--b3-theme-primary-lighter);
  color: var(--b3-theme-primary);
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
}

.task-tag-more {
  display: inline-block;
  padding: 2px 6px;
  color: var(--b3-theme-text-light);
  font-size: 11px;
}

/* Metadata */
.task-metadata {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--b3-theme-text-light);
}

.task-date,
.task-recurrence,
.task-path {
  display: flex;
  align-items: center;
  gap: 3px;
}

.task-path {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Actions */
.task-actions {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.task-list-item:hover .task-actions {
  opacity: 1;
}

.task-action-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s ease;
}

.task-action-btn:hover {
  background: var(--b3-theme-surface-light);
}
</style>
