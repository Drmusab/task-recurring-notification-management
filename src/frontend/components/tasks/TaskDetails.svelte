<script lang="ts">
  /**
   * TaskDetails Component
   * 
   * Displays comprehensive details for a single task with full accessibility support.
   * WCAG 2.1 AA compliant with semantic HTML, proper headings, and ARIA attributes.
   * 
   * @component
   */
  
  import { createEventDispatcher } from 'svelte';
  import { formatDateForScreenReader } from '@frontend/utils/accessibility';
  import Icon from '../shared/Icon.svelte';
  import Button from '../shared/Button.svelte';
  
  export let task: {
    id: string;
    description: string;
    completed: boolean;
    priority?: 'low' | 'medium' | 'high';
    status?: 'todo' | 'in-progress' | 'done';
    dueDate?: string;
    startDate?: string;
    completedDate?: string;
    tags?: string[];
    project?: string;
    recurrence?: string;
    notes?: string;
    subtasks?: Array<{
      id: string;
      description: string;
      completed: boolean;
    }>;
    createdAt?: string;
    updatedAt?: string;
  };
  
  const dispatch = createEventDispatcher();
  
  function handleEdit() {
    dispatch('edit', { taskId: task.id });
  }
  
  function handleDelete() {
    dispatch('delete', { taskId: task.id });
  }
  
  function handleToggleComplete() {
    dispatch('toggleComplete', { taskId: task.id });
  }
  
  function handleSubtaskToggle(subtaskId: string) {
    dispatch('toggleSubtask', { taskId: task.id, subtaskId });
  }
  
  // Priority color mapping
  const priorityColors = {
    high: '#dc2626',
    medium: '#f59e0b',
    low: '#10b981'
  };
  
  // Status labels
  const statusLabels = {
    'todo': 'To Do',
    'in-progress': 'In Progress',
    'done': 'Done'
  };
  
  // Compute screen reader dates
  $: dueDateScreenReader = task.dueDate ? formatDateForScreenReader(task.dueDate) : '';
  $: startDateScreenReader = task.startDate ? formatDateForScreenReader(task.startDate) : '';
  $: completedDateScreenReader = task.completedDate ? formatDateForScreenReader(task.completedDate) : '';
  
  // Check if overdue
  $: isOverdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date();
  
  // Calculate completion percentage for subtasks
  $: completedSubtasks = task.subtasks?.filter(st => st.completed).length || 0;
  $: totalSubtasks = task.subtasks?.length || 0;
  $: completionPercentage = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
</script>

<article class="task-details" aria-labelledby="task-title">
  <!-- Header -->
  <header class="task-details__header">
    <div class="task-details__title-row">
      <h2 id="task-title" class="task-details__title">
        {task.description}
      </h2>
      
      <div class="task-details__actions" role="group" aria-label="Task actions">
        <Button
          variant="secondary"
          ariaLabel="Edit {task.description}"
          on:click={handleEdit}
        >
          <Icon category="actions" name="edit" size={16} alt="" />
          Edit
        </Button>
        
        <Button
          variant="danger"
          ariaLabel="Delete {task.description}"
          on:click={handleDelete}
        >
          <Icon category="actions" name="trash" size={16} alt="" />
          Delete
        </Button>
      </div>
    </div>
    
    <!-- Status Bar -->
    <div class="task-details__status-bar">
      <button
        type="button"
        class="task-details__complete-btn"
        class:task-details__complete-btn--completed={task.completed}
        aria-pressed={task.completed}
        on:click={handleToggleComplete}
      >
        <Icon
          category="status"
          name={task.completed ? 'check-circle' : 'circle'}
          size={20}
          alt=""
        />
        {task.completed ? 'Completed' : 'Mark Complete'}
      </button>
      
      {#if task.status}
        <span class="task-details__status" aria-label="Status: {statusLabels[task.status]}">
          <Icon category="status" name="info" size={16} alt="" />
          {statusLabels[task.status]}
        </span>
      {/if}
    </div>
  </header>
  
  <!-- Metadata Grid -->
  <section class="task-details__metadata" aria-labelledby="metadata-heading">
    <h3 id="metadata-heading" class="sr-only">Task Metadata</h3>
    
    <dl class="task-details__metadata-grid">
      <!-- Priority -->
      {#if task.priority}
        <div class="task-details__metadata-item">
          <dt>
            <Icon category="status" name="flag" size={16} alt="" />
            Priority
          </dt>
          <dd style="--priority-color: {priorityColors[task.priority]}">
            <span class="task-details__priority task-details__priority--{task.priority}">
              {task.priority}
            </span>
          </dd>
        </div>
      {/if}
      
      <!-- Due Date -->
      {#if task.dueDate}
        <div class="task-details__metadata-item" class:task-details__metadata-item--overdue={isOverdue}>
          <dt>
            <Icon category="status" name="calendar" size={16} alt="" />
            Due Date
          </dt>
          <dd>
            <time datetime={task.dueDate} aria-label="Due {dueDateScreenReader}">
              {new Date(task.dueDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </time>
            {#if isOverdue}
              <span class="task-details__overdue-badge" aria-label="Overdue">
                Overdue
              </span>
            {/if}
          </dd>
        </div>
      {/if}
      
      <!-- Start Date -->
      {#if task.startDate}
        <div class="task-details__metadata-item">
          <dt>
            <Icon category="status" name="clock" size={16} alt="" />
            Start Date
          </dt>
          <dd>
            <time datetime={task.startDate} aria-label="Starts {startDateScreenReader}">
              {new Date(task.startDate).toLocaleDateString()}
            </time>
          </dd>
        </div>
      {/if}
      
      <!-- Completed Date -->
      {#if task.completedDate}
        <div class="task-details__metadata-item">
          <dt>
            <Icon category="status" name="check" size={16} alt="" />
            Completed
          </dt>
          <dd>
            <time datetime={task.completedDate} aria-label="Completed {completedDateScreenReader}">
              {new Date(task.completedDate).toLocaleDateString()}
            </time>
          </dd>
        </div>
      {/if}
      
      <!-- Recurrence -->
      {#if task.recurrence}
        <div class="task-details__metadata-item">
          <dt>
            <Icon category="actions" name="repeat" size={16} alt="" />
            Recurrence
          </dt>
          <dd>{task.recurrence}</dd>
        </div>
      {/if}
      
      <!-- Project -->
      {#if task.project}
        <div class="task-details__metadata-item">
          <dt>
            <Icon category="navigation" name="folder" size={16} alt="" />
            Project
          </dt>
          <dd>{task.project}</dd>
        </div>
      {/if}
    </dl>
  </section>
  
  <!-- Tags -->
  {#if task.tags && task.tags.length > 0}
    <section class="task-details__tags" aria-labelledby="tags-heading">
      <h3 id="tags-heading" class="task-details__section-title">Tags</h3>
      <ul role="list" aria-label="{task.tags.length} tags">
        {#each task.tags as tag}
          <li role="listitem">
            <span class="task-details__tag">#{tag}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  
  <!-- Notes -->
  {#if task.notes}
    <section class="task-details__notes" aria-labelledby="notes-heading">
      <h3 id="notes-heading" class="task-details__section-title">Notes</h3>
      <p class="task-details__notes-text">{task.notes}</p>
    </section>
  {/if}
  
  <!-- Subtasks -->
  {#if task.subtasks && task.subtasks.length > 0}
    <section class="task-details__subtasks" aria-labelledby="subtasks-heading">
      <div class="task-details__subtasks-header">
        <h3 id="subtasks-heading" class="task-details__section-title">
          Subtasks ({completedSubtasks}/{totalSubtasks})
        </h3>
        
        <!-- Progress Bar -->
        <div
          class="task-details__progress"
          role="progressbar"
          aria-valuenow={completionPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext="{completedSubtasks} of {totalSubtasks} subtasks completed, {completionPercentage}%"
        >
          <div class="task-details__progress-bar" style="width: {completionPercentage}%"></div>
          <span class="task-details__progress-text">{completionPercentage}%</span>
        </div>
      </div>
      
      <ul class="task-details__subtasks-list" role="list">
        {#each task.subtasks as subtask}
          <li role="listitem">
            <label class="task-details__subtask">
              <input
                type="checkbox"
                checked={subtask.completed}
                on:change={() => handleSubtaskToggle(subtask.id)}
                aria-label="{subtask.completed ? 'Mark incomplete' : 'Mark complete'}: {subtask.description}"
              />
              <span class:task-details__subtask-text--completed={subtask.completed}>
                {subtask.description}
              </span>
            </label>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  
  <!-- Timestamps -->
  <footer class="task-details__footer">
    <dl class="task-details__timestamps">
      {#if task.createdAt}
        <div class="task-details__timestamp">
          <dt>Created:</dt>
          <dd>
            <time datetime={task.createdAt}>
              {new Date(task.createdAt).toLocaleString()}
            </time>
          </dd>
        </div>
      {/if}
      
      {#if task.updatedAt}
        <div class="task-details__timestamp">
          <dt>Updated:</dt>
          <dd>
            <time datetime={task.updatedAt}>
              {new Date(task.updatedAt).toLocaleString()}
            </time>
          </dd>
        </div>
      {/if}
    </dl>
  </footer>
</article>

<style>
  .task-details {
    max-width: 800px;
    margin: 0 auto;
    padding: 24px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
  }
  
  /* Header */
  .task-details__header {
    margin-bottom: 24px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .task-details__title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
  }
  
  .task-details__title {
    flex: 1;
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-normal);
    line-height: 1.3;
  }
  
  .task-details__actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
  
  .task-details__status-bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .task-details__complete-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    min-height: 44px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal);
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;
  }
  
  .task-details__complete-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }
  
  .task-details__complete-btn:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }
  
  .task-details__complete-btn--completed {
    background: #dcfce7;
    border-color: #10b981;
    color: #10b981;
  }
  
  .task-details__status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--background-secondary);
    border-radius: 4px;
    font-size: 13px;
    color: var(--text-muted);
  }
  
  /* Metadata Grid */
  .task-details__metadata {
    margin-bottom: 24px;
  }
  
  .task-details__metadata-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin: 0;
  }
  
  .task-details__metadata-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 6px;
  }
  
  .task-details__metadata-item--overdue {
    background: #fef2f2;
    border: 1px solid #fecaca;
  }
  
  .task-details__metadata-item dt {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }
  
  .task-details__metadata-item dd {
    margin: 0;
    font-size: 14px;
    color: var(--text-normal);
  }
  
  .task-details__priority {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 12px;
    color: var(--priority-color);
    background: color-mix(in srgb, var(--priority-color) 15%, transparent);
  }
  
  .task-details__overdue-badge {
    display: inline-block;
    margin-left: 8px;
    padding: 2px 8px;
    background: #dc2626;
    color: white;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  /* Sections */
  .task-details__section-title {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .task-details__tags,
  .task-details__notes,
  .task-details__subtasks {
    margin-bottom: 24px;
  }
  
  /* Tags */
  .task-details__tags ul {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  
  .task-details__tag {
    display: inline-block;
    padding: 6px 12px;
    background: var(--background-modifier-border);
    border-radius: 16px;
    font-size: 13px;
    color: var(--text-normal);
  }
  
  /* Notes */
  .task-details__notes-text {
    margin: 0;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 6px;
    line-height: 1.6;
    color: var(--text-normal);
    white-space: pre-wrap;
  }
  
  /* Subtasks */
  .task-details__subtasks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }
  
  .task-details__progress {
    position: relative;
    flex: 1;
    max-width: 200px;
    height: 24px;
    background: var(--background-modifier-border);
    border-radius: 12px;
    overflow: hidden;
  }
  
  .task-details__progress-bar {
    height: 100%;
    background: var(--interactive-accent);
    transition: width 0.3s ease;
  }
  
  .task-details__progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-normal);
    mix-blend-mode: difference;
  }
  
  .task-details__subtasks-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  
  .task-details__subtask {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    margin-bottom: 4px;
    background: var(--background-secondary);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s ease;
  }
  
  .task-details__subtask:hover {
    background: var(--background-modifier-hover);
  }
  
  .task-details__subtask input {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
  
  .task-details__subtask-text--completed {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  
  /* Footer */
  .task-details__footer {
    padding-top: 16px;
    border-top: 1px solid var(--background-modifier-border);
  }
  
  .task-details__timestamps {
    display: flex;
    gap: 24px;
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }
  
  .task-details__timestamp {
    display: flex;
    gap: 6px;
  }
  
  .task-details__timestamp dt {
    font-weight: 600;
  }
  
  .task-details__timestamp dd {
    margin: 0;
  }
  
  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .task-details__metadata-item,
    .task-details__notes-text,
    .task-details__subtask,
    .task-details__tag {
      border: 1px solid var(--text-muted);
    }
  }
  
  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .task-details__complete-btn,
    .task-details__subtask,
    .task-details__progress-bar {
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
    .task-details {
      padding: 16px;
    }
    
    .task-details__title-row {
      flex-direction: column;
    }
    
    .task-details__actions {
      width: 100%;
    }
    
    .task-details__metadata-grid {
      grid-template-columns: 1fr;
    }
    
    .task-details__subtasks-header {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .task-details__progress {
      max-width: 100%;
      width: 100%;
    }
  }
</style>
