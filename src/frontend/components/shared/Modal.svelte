<!--
  Modal Component
  
  Reusable modal dialog component with consistent styling and accessibility.
  Replaces duplicate modal implementations across query components.
  
  @component
  @example
  <Modal 
    isOpen={showModal} 
    title="Edit Task"
    onClose={() => showModal = false}
    size="medium"
  >
    <div slot="content">
      Your modal content here
    </div>
    <div slot="footer">
      <button class="btn-secondary" on:click={handleCancel}>Cancel</button>
      <button class="btn-primary" on:click={handleSave}>Save</button>
    </div>
  </Modal>
-->

<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  // Props
  export let isOpen: boolean = false;
  export let title: string = '';
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let showHeader: boolean = true;
  export let showFooter: boolean = true;
  export let closeOnEscape: boolean = true;
  export let closeOnBackdrop: boolean = true;
  export let ariaLabel: string = title || 'Modal dialog';

  const dispatch = createEventDispatcher<{
    close: void;
    open: void;
  }>();

  // Size mapping
  const sizeClasses = {
    small: 'modal-small',
    medium: 'modal-medium',
    large: 'modal-large'
  };

  // Handle escape key
  function handleKeydown(event: KeyboardEvent) {
    if (closeOnEscape && event.key === 'Escape' && isOpen) {
      handleClose();
    }
  }

  // Handle backdrop click
  function handleBackdropClick(event: MouseEvent) {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      handleClose();
    }
  }

  // Close handler
  function handleClose() {
    dispatch('close');
  }

  // Lifecycle
  onMount(() => {
    if (isOpen) {
      dispatch('open');
    }
  });

  // Watch for open state changes
  $: {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  onDestroy(() => {
    document.body.style.overflow = '';
  });
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <div 
    class="modal-overlay" 
    on:click={handleBackdropClick}
    role="presentation"
  >
    <div 
      class="modal {sizeClasses[size]}"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {#if showHeader && title}
        <div class="modal-header">
          <h3 class="modal-title">{title}</h3>
          <button 
            class="modal-close" 
            on:click={handleClose}
            aria-label="Close dialog"
            type="button"
          >
            ×
          </button>
        </div>
      {/if}

      <div class="modal-content">
        <slot name="content">
          <slot />
        </slot>
      </div>

      {#if showFooter && $$slots.footer}
        <div class="modal-footer">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
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
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal {
    background: var(--background-primary, #ffffff);
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    width: 90%;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-small {
    max-width: 400px;
  }

  .modal-medium {
    max-width: 600px;
  }

  .modal-large {
    max-width: 900px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  .modal-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-normal, #000000);
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    color: var(--text-muted, #666666);
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s, color 0.2s;
  }

  .modal-close:hover {
    background-color: var(--background-modifier-hover, #f0f0f0);
    color: var(--text-normal, #000000);
  }

  .modal-close:focus {
    outline: 2px solid var(--interactive-accent, #4a9eff);
    outline-offset: 2px;
  }

  .modal-content {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  /* Global button styles (can be overridden) */
  :global(.modal-footer .btn-primary),
  :global(.modal-footer .btn-secondary) {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  :global(.modal-footer .btn-primary) {
    background-color: var(--interactive-accent, #4a9eff);
    color: white;
  }

  :global(.modal-footer .btn-primary:hover) {
    background-color: var(--interactive-accent-hover, #3a8eef);
  }

  :global(.modal-footer .btn-primary:focus) {
    outline: 2px solid var(--interactive-accent, #4a9eff);
    outline-offset: 2px;
  }

  :global(.modal-footer .btn-secondary) {
    background-color: var(--background-secondary, #f5f5f5);
    color: var(--text-normal, #000000);
  }

  :global(.modal-footer .btn-secondary:hover) {
    background-color: var(--background-modifier-hover, #e0e0e0);
  }

  :global(.modal-footer .btn-secondary:focus) {
    outline: 2px solid var(--interactive-accent, #4a9eff);
    outline-offset: 2px;
  }
</style>
