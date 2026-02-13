<script lang="ts">
  /**
   * TaskSorter Component
   * 
   * Provides sorting controls for task lists with full accessibility support.
   * WCAG 2.1 AA compliant with ARIA attributes and keyboard navigation.
   * 
   * @component
   */
  
  import { createEventDispatcher } from 'svelte';
  import Icon from '../shared/Icon.svelte';
  
  export let sortBy: 'dueDate' | 'priority' | 'status' | 'created' | 'updated' | 'description' = 'dueDate';
  export let sortOrder: 'asc' | 'desc' = 'asc';
  export let compact = false;
  
  const dispatch = createEventDispatcher();
  
  const sortOptions = [
    { value: 'dueDate', label: 'Due Date' },
    { value: 'priority', label: 'Priority' },
    { value: 'status', label: 'Status' },
    { value: 'created', label: 'Created Date' },
    { value: 'updated', label: 'Last Updated' },
    { value: 'description', label: 'Description' }
  ];
  
  function handleSortChange(newSortBy: string) {
    // If clicking the same field, toggle order; otherwise, reset to ascending
    if (newSortBy === sortBy) {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      dispatch('change', { sortBy, sortOrder: newOrder });
    } else {
      dispatch('change', { sortBy: newSortBy, sortOrder: 'asc' });
    }
  }
  
  function handleOrderToggle() {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    dispatch('change', { sortBy, sortOrder: newOrder });
  }
  
  // Get label for current sort
  $: currentSortLabel = sortOptions.find(opt => opt.value === sortBy)?.label || sortBy;
  
  // Screen reader description
  $: sortDescription = `Sorted by ${currentSortLabel}, ${sortOrder === 'asc' ? 'ascending' : 'descending'}`;
</script>

<div 
  class="task-sorter" 
  class:task-sorter--compact={compact}
  role="group"
  aria-label="Sort tasks"
>
  {#if !compact}
    <label for="task-sort-select" class="task-sorter__label">
      Sort By
    </label>
  {/if}
  
  <div class="task-sorter__controls">
    <!-- Sort Field Select -->
    <select
      id="task-sort-select"
      class="task-sorter__select"
      value={sortBy}
      on:change={(e) => handleSortChange(e.currentTarget.value)}
      aria-label="Sort tasks by"
      aria-describedby="sort-status"
    >
      {#each sortOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
    
    <!-- Sort Order Toggle Button -->
    <button
      type="button"
      class="task-sorter__order-btn"
      on:click={handleOrderToggle}
      aria-label="Toggle sort order: Currently {sortOrder === 'asc' ? 'ascending' : 'descending'}"
      aria-pressed={sortOrder === 'desc'}
      title={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
    >
      <Icon 
        category="actions" 
        name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
        size={20}
        alt=""
      />
      <span class="sr-only">
        {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
      </span>
    </button>
  </div>
  
  <!-- Screen Reader Status -->
  <div id="sort-status" class="sr-only" role="status" aria-live="polite">
    {sortDescription}
  </div>
</div>

<style>
  .task-sorter {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .task-sorter--compact {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
  
  .task-sorter__label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .task-sorter__controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .task-sorter__select {
    flex: 1;
    min-width: 150px;
    padding: 8px 12px;
    font-size: 14px;
    font-family: inherit;
    color: var(--text-normal);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  .task-sorter__select:hover {
    border-color: var(--interactive-accent);
  }
  
  .task-sorter__select:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px var(--interactive-accent-hover);
  }
  
  .task-sorter__order-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-normal);
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  }
  
  .task-sorter__order-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
  }
  
  .task-sorter__order-btn:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }
  
  .task-sorter__order-btn[aria-pressed="true"] {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: white;
  }
  
  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .task-sorter__select,
    .task-sorter__order-btn {
      border-width: 2px;
    }
  }
  
  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .task-sorter__select,
    .task-sorter__order-btn {
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
