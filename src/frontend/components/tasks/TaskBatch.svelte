<script lang="ts">
  /**
   * TaskBatch Component
   * 
   * Manages batch operations and selection for multiple tasks with full accessibility support.
   * WCAG 2.1 AA compliant with proper ARIA attributes, keyboard navigation, and screen reader announcements.
   * 
   * @component
   */
  
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  import { announceToScreenReader } from '@frontend/utils/accessibility';
  import Button from '../shared/Button.svelte';
  import Icon from '../shared/Icon.svelte';
  
  export let totalTasks = 0;
  export let selectedTaskIds: string[] = [];
  export let allSelected = false;
  
  const dispatch = createEventDispatcher();
  
  // Batch operation options
  const batchOperations: Array<{
    id: string;
    label: string;
    icon: string;
    variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  }> = [
    { id: 'complete', label: 'Mark Complete', icon: 'check', variant: 'primary' },
    { id: 'incomplete', label: 'Mark Incomplete', icon: 'circle', variant: 'secondary' },
    { id: 'delete', label: 'Delete', icon: 'trash', variant: 'danger' },
    { id: 'archive', label: 'Archive', icon: 'archive', variant: 'secondary' },
    { id: 'duplicate', label: 'Duplicate', icon: 'copy', variant: 'secondary' }
  ];
  
  // Selected count
  $: selectedCount = selectedTaskIds.length;
  
  // Announce selection changes
  $: if (selectedCount > 0) {
    announceToScreenReader(
      `${selectedCount} task${selectedCount !== 1 ? 's' : ''} selected`,
      'polite'
    );
  }
  
  function handleSelectAll() {
    const newAllSelected = !allSelected;
    dispatch('selectAll', { selected: newAllSelected });
    
    announceToScreenReader(
      newAllSelected 
        ? `All ${totalTasks} tasks selected` 
        : 'Selection cleared',
      'polite'
    );
  }
  
  function handleClearSelection() {
    dispatch('clearSelection');
    announceToScreenReader('Selection cleared', 'polite');
  }
  
  function handleBatchOperation(operationId: string) {
    dispatch('batchOperation', { 
      operation: operationId, 
      taskIds: selectedTaskIds 
    });
  }
  
  // Keyboard shortcut handler
  function handleKeyDown(event: KeyboardEvent) {
    // Ctrl/Cmd + A to select all
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
      event.preventDefault();
      handleSelectAll();
    }
    
    // Escape to clear selection
    if (event.key === 'Escape' && selectedCount > 0) {
      handleClearSelection();
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="task-batch" aria-label="Batch operations">
  <!-- Selection Controls -->
  <div class="task-batch__controls" role="toolbar" aria-label="Selection controls">
    <!-- Select All Checkbox -->
    <label class="task-batch__select-all">
      <input
        type="checkbox"
        checked={allSelected}
        indeterminate={selectedCount > 0 && !allSelected}
        on:change={handleSelectAll}
        aria-label={allSelected ? 'Deselect all tasks' : 'Select all tasks'}
        aria-describedby="selection-count"
      />
      <span>Select All</span>
    </label>
    
    <!-- Selection Count -->
    <div id="selection-count" class="task-batch__count" aria-live="polite">
      {#if selectedCount > 0}
        <strong>{selectedCount}</strong> of <strong>{totalTasks}</strong> selected
      {:else}
        {totalTasks} task{totalTasks !== 1 ? 's' : ''}
      {/if}
    </div>
    
    <!-- Clear Selection -->
    {#if selectedCount > 0}
      <Button
        variant="ghost"
        size="small"
        ariaLabel="Clear selection"
        on:click={handleClearSelection}
      >
        <Icon category="actions" name="x" size={16} alt="" />
        Clear
      </Button>
    {/if}
  </div>
  
  <!-- Batch Operations (shown when tasks are selected) -->
  {#if selectedCount > 0}
    <div 
      class="task-batch__operations"
      role="group"
      aria-label="Batch operations for {selectedCount} selected task{selectedCount !== 1 ? 's' : ''}"
      transition:slide={{ duration: 200 }}
    >
      <div class="task-batch__operations-label">
        Bulk Actions:
      </div>
      
      <div class="task-batch__operations-buttons">
        {#each batchOperations as operation}
          <Button
            variant={operation.variant}
            size="small"
            ariaLabel="{operation.label} {selectedCount} selected task{selectedCount !== 1 ? 's' : ''}"
            on:click={() => handleBatchOperation(operation.id)}
          >
            <Icon category="actions" name={operation.icon} size={16} alt="" />
            {operation.label}
          </Button>
        {/each}
      </div>
    </div>
  {/if}
  
  <!-- Keyboard Shortcuts Help -->
  <div class="task-batch__shortcuts sr-only" role="region" aria-label="Keyboard shortcuts">
    <ul>
      <li>Press Control+A or Command+A to select all tasks</li>
      <li>Press Escape to clear selection</li>
    </ul>
  </div>
  
  <!-- Screen Reader Status -->
  <div class="sr-only" role="status" aria-live="assertive" aria-atomic="true">
    {#if selectedCount > 0}
      {selectedCount} task{selectedCount !== 1 ? 's' : ''} selected. {batchOperations.length} bulk actions available.
    {/if}
  </div>
</div>

<style>
  .task-batch {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
  }
  
  .task-batch__controls {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  
  .task-batch__select-all {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-normal);
    cursor: pointer;
    user-select: none;
  }
  
  .task-batch__select-all input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
  
  .task-batch__select-all:hover {
    color: var(--interactive-accent);
  }
  
  .task-batch__count {
    flex: 1;
    font-size: 14px;
    color: var(--text-muted);
  }
  
  .task-batch__count strong {
    color: var(--text-normal);
    font-weight: 700;
  }
  
  .task-batch__operations {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--background-modifier-hover);
    border: 1px solid var(--interactive-accent);
    border-radius: 6px;
  }
  
  .task-batch__operations-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-normal);
    white-space: nowrap;
  }
  
  .task-batch__operations-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .task-batch {
      border-width: 2px;
    }
    
    .task-batch__operations {
      border-width: 2px;
    }
  }
  
  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .task-batch__operations {
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
    .task-batch__controls {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .task-batch__operations {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .task-batch__operations-buttons {
      width: 100%;
      flex-direction: column;
    }
    
    .task-batch__operations-buttons :global(button) {
      width: 100%;
    }
  }
</style>
