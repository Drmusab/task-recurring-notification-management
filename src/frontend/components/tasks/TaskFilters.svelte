<script lang="ts">
  /**
   * TaskFilters Component
   * 
   * Provides filtering controls for task lists with full accessibility support.
   * WCAG 2.1 AA compliant with proper labels, keyboard navigation, and ARIA attributes.
   * 
   * @component
   */
  
  import { createEventDispatcher } from 'svelte';
  import Button from '../shared/Button.svelte';
  import Icon from '../shared/Icon.svelte';
  
  export let activeFilters: {
    status?: 'all' | 'todo' | 'in-progress' | 'done' | 'completed';
    priority?: 'all' | 'low' | 'medium' | 'high';
    tags?: string[];
    hasDate?: boolean;
    overdue?: boolean;
    project?: string;
  } = {
    status: 'all',
    priority: 'all',
    tags: [],
    hasDate: false,
    overdue: false
  };
  
  const dispatch = createEventDispatcher();
  
  // Track if any filters are active (not default)
  $: hasActiveFilters = 
    activeFilters.status !== 'all' ||
    activeFilters.priority !== 'all' ||
    (activeFilters.tags && activeFilters.tags.length > 0) ||
    activeFilters.hasDate ||
    activeFilters.overdue ||
    Boolean(activeFilters.project);
  
  // Count active filters for screen reader announcement
  $: activeFilterCount = [
    activeFilters.status !== 'all',
    activeFilters.priority !== 'all',
    activeFilters.tags && activeFilters.tags.length > 0,
    activeFilters.hasDate,
    activeFilters.overdue,
    Boolean(activeFilters.project)
  ].filter(Boolean).length;
  
  function handleChange(filterType: string, value: any) {
    const newFilters = { ...activeFilters, [filterType]: value };
    dispatch('change', { filters: newFilters });
  }
  
  function clearAllFilters() {
    const clearedFilters = {
      status: 'all',
      priority: 'all',
      tags: [],
      hasDate: false,
      overdue: false,
      project: ''
    };
    dispatch('change', { filters: clearedFilters });
  }
  
  function removeTag(tag: string) {
    const newTags = activeFilters.tags?.filter(t => t !== tag) || [];
    handleChange('tags', newTags);
  }
</script>

<section 
  class="task-filters" 
  aria-labelledby="filters-heading"
  role="search"
>
  <div class="task-filters__header">
    <h3 id="filters-heading" class="task-filters__title">
      Filters
      {#if hasActiveFilters}
        <span class="task-filters__badge" aria-label="{activeFilterCount} active filters">
          {activeFilterCount}
        </span>
      {/if}
    </h3>
    
    {#if hasActiveFilters}
      <Button
        variant="ghost"
        size="small"
        ariaLabel="Clear all filters"
        on:click={clearAllFilters}
      >
        <Icon category="actions" name="x" size={16} alt="" />
        Clear All
      </Button>
    {/if}
  </div>
  
  <!-- Status Filter -->
  <div class="task-filters__group">
    <label for="filter-status" class="task-filters__label">
      Status
    </label>
    
    <select
      id="filter-status"
      class="task-filters__select"
      value={activeFilters.status}
      on:change={(e) => handleChange('status', e.currentTarget.value)}
      aria-label="Filter by status"
    >
      <option value="all">All Tasks</option>
      <option value="todo">To Do</option>
      <option value="in-progress">In Progress</option>
      <option value="done">Done</option>
      <option value="completed">Completed</option>
    </select>
  </div>
  
  <!-- Priority Filter -->
  <div class="task-filters__group">
    <label for="filter-priority" class="task-filters__label">
      Priority
    </label>
    
    <select
      id="filter-priority"
      class="task-filters__select"
      value={activeFilters.priority}
      on:change={(e) => handleChange('priority', e.currentTarget.value)}
      aria-label="Filter by priority"
    >
      <option value="all">All Priorities</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
  </div>
  
  <!-- Project Filter -->
  <div class="task-filters__group">
    <label for="filter-project" class="task-filters__label">
      Project
    </label>
    
    <input
      id="filter-project"
      type="text"
      class="task-filters__input"
      value={activeFilters.project || ''}
      on:input={(e) => handleChange('project', e.currentTarget.value)}
      placeholder="Filter by project..."
      aria-label="Filter by project name"
    />
  </div>
  
  <!-- Quick Filters -->
  <fieldset class="task-filters__group">
    <legend class="task-filters__label">Quick Filters</legend>
    
    <div class="task-filters__checkboxes">
      <label class="task-filters__checkbox-label">
        <input
          type="checkbox"
          checked={activeFilters.hasDate}
          on:change={(e) => handleChange('hasDate', e.currentTarget.checked)}
          aria-label="Show only tasks with due dates"
        />
        <span>Has Due Date</span>
      </label>
      
      <label class="task-filters__checkbox-label">
        <input
          type="checkbox"
          checked={activeFilters.overdue}
          on:change={(e) => handleChange('overdue', e.currentTarget.checked)}
          aria-label="Show only overdue tasks"
        />
        <span>Overdue Only</span>
      </label>
    </div>
  </fieldset>
  
  <!-- Active Tag Filters -->
  {#if activeFilters.tags && activeFilters.tags.length > 0}
    <div class="task-filters__group">
      <div class="task-filters__label">Active Tags</div>
      
      <ul class="task-filters__tags" role="list" aria-label="Active tag filters">
        {#each activeFilters.tags as tag}
          <li role="listitem">
            <button
              type="button"
              class="task-filters__tag"
              on:click={() => removeTag(tag)}
              aria-label="Remove {tag} filter"
            >
              #{tag}
              <Icon category="actions" name="x" size={16} alt="" />
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  
  <!-- Screen Reader Announcement -->
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {#if hasActiveFilters}
      {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
    {:else}
      No filters active
    {/if}
  </div>
</section>

<style>
  .task-filters {
    padding: 16px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
  }
  
  .task-filters__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .task-filters__title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .task-filters__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    background: var(--interactive-accent);
    color: white;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 700;
  }
  
  .task-filters__group {
    margin-bottom: 16px;
    padding: 0;
    border: none;
  }
  
  .task-filters__group:last-child {
    margin-bottom: 0;
  }
  
  .task-filters__label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .task-filters__select,
  .task-filters__input {
    width: 100%;
    padding: 8px 12px;
    font-size: 14px;
    font-family: inherit;
    color: var(--text-normal);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  .task-filters__select:focus,
  .task-filters__input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px var(--interactive-accent-hover);
  }
  
  .task-filters__checkboxes {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .task-filters__checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-normal);
  }
  
  .task-filters__checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
  
  .task-filters__checkbox-label:hover {
    color: var(--interactive-accent);
  }
  
  .task-filters__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  
  .task-filters__tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--background-modifier-border);
    border: 1px solid transparent;
    border-radius: 12px;
    font-size: 12px;
    color: var(--text-normal);
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;
  }
  
  .task-filters__tag:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }
  
  .task-filters__tag:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }
  
  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .task-filters {
      border-width: 2px;
    }
    
    .task-filters__select,
    .task-filters__input,
    .task-filters__tag {
      border-width: 2px;
    }
  }
  
  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .task-filters__select,
    .task-filters__input,
    .task-filters__tag {
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
