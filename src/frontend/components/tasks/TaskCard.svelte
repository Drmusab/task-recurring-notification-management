<script lang="ts">
  /**
   * TaskCard Component
   * 
   * Displays a single task as a card with full accessibility support.
   * WCAG 2.1 AA compliant with semantic HTML, ARIA attributes, and keyboard navigation.
   * 
   * @component
   */
  
  import { createEventDispatcher } from 'svelte';
  import { getTaskAriaLabel, formatDateForScreenReader } from '@frontend/utils/accessibility';
  import Icon from '../shared/Icon.svelte';
  import Button from '../shared/Button.svelte';
  
  export let task: {
    id: string;
    description: string;
    completed: boolean;
    priority?: 'low' | 'medium' | 'high';
    dueDate?: string;
    tags?: string[];
    project?: string;
    recurrence?: string;
  };
  export let selectable = false;
  export let selected = false;
  export let showActions = true;
  
  const dispatch = createEventDispatcher();
  
  let cardElement: HTMLElement;
  
  function handleCardClick(event: MouseEvent | KeyboardEvent) {
    if (event.target === cardElement || (event.target as HTMLElement).closest('.task-card__main')) {
      dispatch('click', { taskId: task.id });
    }
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardClick(event);
    }
  }
  
  function handleToggleComplete(event: Event) {
    event.stopPropagation();
    dispatch('toggleComplete', { taskId: task.id });
  }
  
  function handleEdit(event: Event) {
    event.stopPropagation();
    dispatch('edit', { taskId: task.id });
  }
  
  function handleDelete(event: Event) {
    event.stopPropagation();
    dispatch('delete', { taskId: task.id });
  }
  
  function handleSelectToggle(event: Event) {
    event.stopPropagation();
    dispatch('toggleSelect', { taskId: task.id });
  }
  
  // Priority color mapping
  const priorityColors = {
    high: '#dc2626',
    medium: '#f59e0b',
    low: '#10b981'
  };
  
  // Compute aria-label for card
  $: ariaLabel = task.description + (task.priority ? `, ${task.priority} priority` : '') + (task.dueDate ? `, due ${task.dueDate}` : '') + (task.completed ? ', completed' : ', not completed');
  
  // Compute due date screen reader text
  $: dueDateScreenReader = task.dueDate ? formatDateForScreenReader(task.dueDate) : '';
  
  // Check if overdue
  $: isOverdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date();
</script>

<article
  bind:this={cardElement}
  class="task-card"
  class:task-card--completed={task.completed}
  class:task-card--overdue={isOverdue}
  class:task-card--selectable={selectable}
  class:task-card--selected={selected}
  aria-label={ariaLabel}
>
  <!-- Selection Checkbox (if selectable) -->
  {#if selectable}
    <div class="task-card__select">
      <label class="task-card__select-label">
        <input
          type="checkbox"
          checked={selected}
          on:change={handleSelectToggle}
          aria-label="Select {task.description}"
        />
        <span class="sr-only">Select task</span>
      </label>
    </div>
  {/if}
  
  <!-- Completion Checkbox -->
  <div class="task-card__checkbox">
    <button
      type="button"
      class="task-card__checkbox-btn"
      aria-pressed={task.completed}
      aria-label={task.completed ? `Mark "${task.description}" as incomplete` : `Mark "${task.description}" as complete`}
      on:click={handleToggleComplete}
    >
      <Icon
        category="status"
        name={task.completed ? 'check-circle' : 'circle'}
        size={24}
        alt=""
      />
    </button>
  </div>
  
  <!-- Main Content -->
  <div class="task-card__main">
    <!-- Description -->
    <h3 class="task-card__description" id="task-desc-{task.id}">
      {task.description}
    </h3>
    
    <!-- Metadata -->
    <div class="task-card__metadata" id="task-meta-{task.id}" aria-label="Task metadata">
      <!-- Priority Badge -->
      {#if task.priority}
        <span
          class="task-card__priority task-card__priority--{task.priority}"
          style="--priority-color: {priorityColors[task.priority]}"
          aria-label="{task.priority} priority"
        >
          <Icon category="status" name="flag" size={16} alt="" />
          {task.priority}
        </span>
      {/if}
      
      <!-- Due Date -->
      {#if task.dueDate}
        <time
          class="task-card__due-date"
          class:task-card__due-date--overdue={isOverdue}
          datetime={task.dueDate}
          aria-label="Due {dueDateScreenReader}"
        >
          <Icon category="status" name="calendar" size={16} alt="" />
          {new Date(task.dueDate).toLocaleDateString()}
        </time>
      {/if}
      
      <!-- Recurrence -->
      {#if task.recurrence}
        <span class="task-card__recurrence" aria-label="Recurring: {task.recurrence}">
          <Icon category="actions" name="repeat" size={16} alt="" />
          {task.recurrence}
        </span>
      {/if}
      
      <!-- Project -->
      {#if task.project}
        <span class="task-card__project" aria-label="Project: {task.project}">
          <Icon category="navigation" name="folder" size={16} alt="" />
          {task.project}
        </span>
      {/if}
    </div>
    
    <!-- Tags -->
    {#if task.tags && task.tags.length > 0}
      <ul class="task-card__tags" role="list" aria-label="Tags">
        {#each task.tags as tag}
          <li role="listitem">
            <span class="task-card__tag">#{tag}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  
  <!-- Actions -->
  {#if showActions}
    <div class="task-card__actions" role="group" aria-label="Task actions">
      <Button
        variant="ghost"
        size="small"
        ariaLabel="Edit {task.description}"
        on:click={handleEdit}
      >
        <Icon category="actions" name="edit" size={16} alt="" />
      </Button>
      
      <Button
        variant="ghost"
        size="small"
        ariaLabel="Delete {task.description}"
        on:click={handleDelete}
      >
        <Icon category="actions" name="trash" size={16} alt="" />
      </Button>
    </div>
  {/if}
</article>

<style>
  .task-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
    cursor: pointer;
    position: relative;
  }
  
  .task-card:hover {
    border-color: var(--interactive-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .task-card:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px var(--interactive-accent-hover);
  }
  
  .task-card--completed {
    opacity: 0.7;
  }
  
  .task-card--completed .task-card__description {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  
  .task-card--overdue {
    border-left: 4px solid #dc2626;
  }
  
  .task-card--selectable {
    padding-left: 52px;
  }
  
  .task-card--selected {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }
  
  /* Selection Checkbox */
  .task-card__select {
    position: absolute;
    left: 16px;
    top: 16px;
  }
  
  .task-card__select input {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
  
  /* Completion Checkbox */
  .task-card__checkbox {
    flex-shrink: 0;
  }
  
  .task-card__checkbox-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-muted);
    transition: color 0.2s ease, background 0.2s ease;
  }
  
  .task-card__checkbox-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--interactive-accent);
  }
  
  .task-card__checkbox-btn:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }
  
  .task-card__checkbox-btn[aria-pressed="true"] {
    color: var(--interactive-success);
  }
  
  /* Main Content */
  .task-card__main {
    flex: 1;
    min-width: 0;
  }
  
  .task-card__description {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 500;
    color: var(--text-normal);
    line-height: 1.5;
    word-wrap: break-word;
  }
  
  /* Metadata */
  .task-card__metadata {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 8px;
    font-size: 14px;
  }
  
  .task-card__priority,
  .task-card__due-date,
  .task-card__recurrence,
  .task-card__project {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    background: var(--background-secondary);
  }
  
  .task-card__priority {
    color: var(--priority-color);
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .task-card__due-date--overdue {
    background: #fef2f2;
    color: #dc2626;
    font-weight: 600;
  }
  
  /* Tags */
  .task-card__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  
  .task-card__tag {
    display: inline-block;
    padding: 2px 8px;
    background: var(--background-modifier-border);
    border-radius: 12px;
    font-size: 12px;
    color: var(--text-muted);
  }
  
  /* Actions */
  .task-card__actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  
  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .task-card {
      border-width: 2px;
    }
    
    .task-card__priority,
    .task-card__due-date,
    .task-card__recurrence,
    .task-card__project,
    .task-card__tag {
      border: 1px solid currentColor;
    }
  }
  
  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .task-card {
      transition: none;
    }
    
    .task-card__checkbox-btn {
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
</style>
