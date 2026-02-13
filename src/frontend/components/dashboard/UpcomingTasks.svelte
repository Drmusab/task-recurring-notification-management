<script lang="ts">
  /**
   * Accessible Upcoming Tasks Component
   * WCAG 2.1 AA Compliant
   * 
   * @accessibility
   * - role="region" for landmark navigation
   * - aria-label with task count
   * - Semantic list structure (ul/li)
   * - Keyboard navigation support
   * - Loading state with aria-busy
   * - Empty state with role="status"
   * - High contrast mode support
   */

  import { createEventDispatcher } from 'svelte';
  import { getTaskAriaLabel, formatDateForScreenReader } from '@frontend/utils/accessibility';

  export let tasks: Array<{
    id: string;
    description: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
  }> = [];
  export let loading = false;
  export let maxTasks = 5;

  const dispatch = createEventDispatcher();

  $: displayTasks = tasks.slice(0, maxTasks);
  $: hasMore = tasks.length > maxTasks;

  function handleTaskClick(taskId: string) {
    dispatch('taskClick', { taskId });
  }

  function getPriorityLabel(priority?: string): string {
    if (!priority) return '';
    return priority.charAt(0).toUpperCase() + priority.slice(1) + ' priority';
  }

  function getPriorityClass(priority?: string): string {
    if (!priority) return '';
    return `priority-${priority}`;
  }
</script>

<section
  class="upcoming-tasks"
  aria-label="Upcoming tasks, {tasks.length} tasks"
  aria-busy={loading}
>
  <div class="upcoming-header">
    <h2 class="upcoming-title">Upcoming Tasks</h2>
    {#if tasks.length > 0}
      <span class="task-count" aria-label="{tasks.length} upcoming tasks">
        {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
      </span>
    {/if}
  </div>

  {#if loading}
    <div class="loading-state" role="status" aria-live="polite">
      <div class="loading-spinner" aria-hidden="true"></div>
      <span>Loading upcoming tasks...</span>
    </div>
  {:else if displayTasks.length === 0}
    <div class="empty-state" role="status">
      <div class="empty-icon" aria-hidden="true">✓</div>
      <p class="empty-message">No upcoming tasks. You're all caught up!</p>
    </div>
  {:else}
    <ul class="task-list" role="list">
      {#each displayTasks as task}
        <li class="task-item" role="listitem">
          <button
            class="task-button"
            type="button"
            aria-label="View task: {task.description}{task.priority ? ', ' + getPriorityLabel(task.priority) : ''}{task.dueDate ? ', due ' + formatDateForScreenReader(task.dueDate) : ''}"
            on:click={() => handleTaskClick(task.id)}
          >
            <div class="task-content">
              <div class="task-description">
                {task.description}
              </div>
              
              <div class="task-metadata">
                {#if task.dueDate}
                  <span class="task-due-date" aria-label="Due {formatDateForScreenReader(task.dueDate)}">
                    <span aria-hidden="true">📅</span>
                    {task.dueDate}
                  </span>
                {/if}
                
                {#if task.priority}
                  <span 
                    class="task-priority {getPriorityClass(task.priority)}" 
                    aria-label={getPriorityLabel(task.priority)}
                  >
                    {task.priority}
                  </span>
                {/if}
              </div>

              {#if task.tags && task.tags.length > 0}
                <ul class="task-tags" role="list" aria-label="Tags">
                  {#each task.tags as tag}
                    <li class="task-tag" role="listitem">
                      #{tag}
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>

            <div class="task-arrow" aria-hidden="true">›</div>
          </button>
        </li>
      {/each}
    </ul>

    {#if hasMore}
      <button
        class="view-all-button"
        type="button"
        aria-label="View all {tasks.length} upcoming tasks"
        on:click={() => dispatch('viewAll')}
      >
        View all {tasks.length} tasks
      </button>
    {/if}
  {/if}
</section>

<style>
  .upcoming-tasks {
    padding: 1.5rem;
    background: var(--background-primary, #ffffff);
    border-radius: 8px;
  }

  .upcoming-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .upcoming-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-normal, #1f2937);
  }

  .task-count {
    font-size: 0.875rem;
    color: var(--text-muted, #6b7280);
    background: var(--background-secondary, #f3f4f6);
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    color: var(--text-muted, #6b7280);
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--background-modifier-border, #e5e7eb);
    border-top-color: var(--interactive-accent, #1976d2);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted, #6b7280);
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .empty-message {
    margin: 0;
    font-size: 1rem;
  }

  .task-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .task-item {
    margin: 0;
  }

  .task-button {
    /* WCAG 2.5.5 Target Size - Minimum 44x44px */
    width: 100%;
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--background-secondary, #f9fafb);
    border: 1px solid var(--background-modifier-border, #e5e7eb);
    border-radius: 6px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .task-button:hover {
    background: var(--background-modifier-hover, #f3f4f6);
    border-color: var(--interactive-accent, #1976d2);
  }

  /* WCAG 2.4.7 Focus Visible */
  .task-button:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
  }

  .task-content {
    flex: 1;
    min-width: 0;
  }

  .task-description {
    font-size: 0.9375rem;
    color: var(--text-normal, #1f2937);
    margin-bottom: 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-metadata {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.8125rem;
  }

  .task-due-date {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-muted, #6b7280);
  }

  .task-priority {
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
    text-transform: capitalize;
  }

  .priority-high {
    background: rgba(239, 68, 68, 0.1);
    color: var(--text-error, #ef4444);
  }

  .priority-medium {
    background: rgba(251, 191, 36, 0.1);
    color: #f59e0b;
  }

  .priority-low {
    background: rgba(59, 130, 246, 0.1);
    color: var(--text-info, #3b82f6);
  }

  .task-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    list-style: none;
    margin: 0.5rem 0 0 0;
    padding: 0;
  }

  .task-tag {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background: var(--background-modifier-border, #e5e7eb);
    color: var(--text-muted, #6b7280);
    border-radius: 4px;
  }

  .task-arrow {
    font-size: 1.25rem;
    color: var(--text-muted, #9ca3af);
    flex-shrink: 0;
  }

  .view-all-button {
    width: 100%;
    min-height: 44px;
    margin-top: 0.75rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: 1px solid var(--background-modifier-border, #d1d5db);
    border-radius: 6px;
    color: var(--interactive-accent, #1976d2);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-all-button:hover {
    background: var(--background-modifier-hover, #f3f4f6);
    border-color: var(--interactive-accent, #1976d2);
  }

  .view-all-button:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
  }

  /* WCAG High Contrast Mode */
  @media (prefers-contrast: high) {
    .task-button,
    .view-all-button {
      border-width: 2px;
    }
  }

  /* WCAG Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .task-button,
    .view-all-button {
      transition: none;
    }
    
    .loading-spinner {
      animation: pulse 1s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  }
</style>
