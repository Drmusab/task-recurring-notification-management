<script lang="ts">
  /**
   * TaskGrouper Component
   * 
   * Provides grouping controls for task lists with full accessibility support.
   * WCAG 2.1 AA compliant with proper ARIA attributes and keyboard navigation.
   * 
   * @component
   */
  
  import { createEventDispatcher } from 'svelte';
  import Icon from '../shared/Icon.svelte';
  
  export let groupBy: 'none' | 'priority' | 'status' | 'project' | 'dueDate' | 'tags' = 'none';
  export let compact = false;
  
  const dispatch = createEventDispatcher();
  
  const groupOptions = [
    { value: 'none', label: 'No Grouping', icon: 'list' },
    { value: 'priority', label: 'Priority', icon: 'flag' },
    { value: 'status', label: 'Status', icon: 'circle' },
    { value: 'project', label: 'Project', icon: 'folder' },
    { value: 'dueDate', label: 'Due Date', icon: 'calendar' },
    { value: 'tags', label: 'Tags', icon: 'tag' }
  ];
  
  function handleGroupChange(newGroupBy: string) {
    dispatch('change', { groupBy: newGroupBy });
  }
  
  // Get label for current grouping
  $: currentGroupLabel = groupOptions.find(opt => opt.value === groupBy)?.label || 'No Grouping';
  
  // Screen reader description
  $: groupDescription = groupBy === 'none' 
    ? 'Tasks are not grouped' 
    : `Tasks grouped by ${currentGroupLabel}`;
</script>

<div 
  class="task-grouper"
  class:task-grouper--compact={compact}
  role="group"
  aria-label="Group tasks"
>
  {#if !compact}
    <label for="task-group-select" class="task-grouper__label">
      Group By
    </label>
  {/if}
  
  <div class="task-grouper__controls">
    <!-- Group Field Select -->
    <select
      id="task-group-select"
      class="task-grouper__select"
      value={groupBy}
      on:change={(e) => handleGroupChange(e.currentTarget.value)}
      aria-label="Group tasks by"
      aria-describedby="group-status"
    >
      {#each groupOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
    
    <!-- Visual Indicator -->
    {#if groupBy !== 'none'}
      <div class="task-grouper__indicator" aria-hidden="true">
        <Icon 
          category="status" 
          name="layers" 
          size={16}
          alt=""
        />
      </div>
    {/if}
  </div>
  
  <!-- Screen Reader Status -->
  <div id="group-status" class="sr-only" role="status" aria-live="polite">
    {groupDescription}
  </div>
</div>

<style>
  .task-grouper {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .task-grouper--compact {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
  
  .task-grouper__label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .task-grouper__controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .task-grouper__select {
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
  
  .task-grouper__select:hover {
    border-color: var(--interactive-accent);
  }
  
  .task-grouper__select:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px var(--interactive-accent-hover);
  }
  
  .task-grouper__indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    color: var(--interactive-accent);
  }
  
  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .task-grouper__select {
      border-width: 2px;
    }
  }
  
  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .task-grouper__select {
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
