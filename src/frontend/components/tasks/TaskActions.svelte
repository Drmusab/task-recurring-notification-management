<script lang="ts">
  /**
   * TaskActions Component
   * 
   * Provides action buttons for task operations with full accessibility support.
   * WCAG 2.1 AA compliant with proper ARIA attributes and keyboard navigation.
   * 
   * @component
   */
  
  import { createEventDispatcher } from 'svelte';
  import Button from '../shared/Button.svelte';
  import Icon from '../shared/Icon.svelte';
  
  export let taskId: string | null = null;
  export let selectedCount = 0;
  export let showEdit = true;
  export let showDelete = true;
  export let showComplete = true;
  export let showDuplicate = false;
  export let showArchive = false;
  export let compact = false;
  export let disabled = false;
  
  const dispatch = createEventDispatcher();
  
  function handleAction(action: string) {
    dispatch('action', { action, taskId, selectedCount });
  }
  
  // Determine context for aria-labels
  $: context = selectedCount > 0 
    ? `${selectedCount} selected task${selectedCount !== 1 ? 's' : ''}` 
    : 'task';
  
  $: isBatchMode = selectedCount > 0;
</script>

<div
  class="task-actions"
  class:task-actions--compact={compact}
  class:task-actions--batch={isBatchMode}
  role="toolbar"
  aria-label={isBatchMode ? `Bulk actions for ${selectedCount} tasks` : 'Task actions'}
>
  {#if isBatchMode}
    <div class="task-actions__info" aria-live="polite">
      <strong>{selectedCount}</strong> task{selectedCount !== 1 ? 's' : ''} selected
    </div>
  {/if}
  
  <div class="task-actions__buttons" role="group" aria-label="Available actions">
    <!-- Complete/Mark Done -->
    {#if showComplete}
      <Button
        variant="primary"
        size={compact ? 'small' : 'medium'}
        ariaLabel={`Mark ${context} as complete`}
        {disabled}
        on:click={() => handleAction('complete')}
      >
        <Icon category="status" name="check" size={16} alt="" />
        {#if !compact}
          Complete
        {/if}
      </Button>
    {/if}
    
    <!-- Edit -->
    {#if showEdit && !isBatchMode}
      <Button
        variant="secondary"
        size={compact ? 'small' : 'medium'}
        ariaLabel={`Edit ${context}`}
        {disabled}
        on:click={() => handleAction('edit')}
      >
        <Icon category="actions" name="edit" size={16} alt="" />
        {#if !compact}
          Edit
        {/if}
      </Button>
    {/if}
    
    <!-- Duplicate -->
    {#if showDuplicate && !isBatchMode}
      <Button
        variant="secondary"
        size={compact ? 'small' : 'medium'}
        ariaLabel={`Duplicate ${context}`}
        {disabled}
        on:click={() => handleAction('duplicate')}
      >
        <Icon category="actions" name="copy" size={16} alt="" />
        {#if !compact}
          Duplicate
        {/if}
      </Button>
    {/if}
    
    <!-- Archive -->
    {#if showArchive}
      <Button
        variant="secondary"
        size={compact ? 'small' : 'medium'}
        ariaLabel={`Archive ${context}`}
        {disabled}
        on:click={() => handleAction('archive')}
      >
        <Icon category="actions" name="archive" size={16} alt="" />
        {#if !compact}
          Archive
        {/if}
      </Button>
    {/if}
    
    <!-- Delete -->
    {#if showDelete}
      <Button
        variant="danger"
        size={compact ? 'small' : 'medium'}
        ariaLabel={`Delete ${context}`}
        {disabled}
        on:click={() => handleAction('delete')}
      >
        <Icon category="actions" name="trash" size={16} alt="" />
        {#if !compact}
          Delete
        {/if}
      </Button>
    {/if}
  </div>
</div>

<style>
  .task-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
  }
  
  .task-actions--compact {
    padding: 8px;
    gap: 8px;
  }
  
  .task-actions--batch {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .task-actions__info {
    padding: 0 8px;
    font-size: 14px;
    color: var(--text-normal);
  }
  
  .task-actions__info strong {
    color: var(--interactive-accent);
    font-weight: 700;
  }
  
  .task-actions__buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  /* High Contrast Mode */
  @media (prefers-contrast: high) {
    .task-actions {
      border-width: 2px;
    }
    
    .task-actions--batch {
      border-width: 3px;
    }
  }
  
  /* Responsive */
  @media (max-width: 640px) {
    .task-actions {
      flex-direction: column;
      align-items: stretch;
    }
    
    .task-actions__buttons {
      flex-direction: column;
    }
    
    .task-actions__buttons :global(button) {
      width: 100%;
    }
  }
</style>
