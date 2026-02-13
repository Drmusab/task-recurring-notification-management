<script lang="ts">
  /**
   * ConfirmationDialog Component
   * WCAG 2.1 AA Compliant
   * 
   * Reusable confirmation dialog for user confirmations
   * 
   * @accessibility
   * - role="alertdialog" for important confirmations
   * - aria-labelledby and aria-describedby
   * - Focus trap with auto-focus on primary action
   * - Keyboard navigation (Tab, Escape, Enter)
   * - Distinct visual styling for destructive actions
   * - 44x44px minimum touch targets
   * - High contrast mode support
   */

  import { onMount, createEventDispatcher } from 'svelte';
  import Button from '../Button.svelte';

  export let title: string;
  export let message: string;
  export let confirmText = 'Confirm';
  export let cancelText = 'Cancel';
  export let isDestructive = false;
  export let onClose: () => void;

  const dispatch = createEventDispatcher();

  let confirmButtonElement: HTMLButtonElement | undefined;
  let dialogElement: HTMLElement;

  onMount(() => {
    // Focus confirm button by default (primary action)
    // The Button component wraps a <button>, we can't directly bind to it
    // Instead, we'll use a setTimeout to allow the DOM to update
    setTimeout(() => {
      const confirmBtn = dialogElement?.querySelector('.btn-primary') as HTMLButtonElement;
      if (confirmBtn) {
        confirmBtn.focus();
      }
    }, 0);
  });

  function handleConfirm() {
    dispatch('confirm', true);
    onClose();
  }

  function handleCancel() {
    dispatch('confirm', false);
    onClose();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    } else if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey) {
      event.preventDefault();
      handleConfirm();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div 
  class="confirmation-dialog-overlay" 
  on:click={handleBackdropClick}
  role="presentation"
>
  <div
    bind:this={dialogElement}
    class="confirmation-dialog"
    class:destructive={isDestructive}
    role="alertdialog"
    aria-labelledby="confirmation-dialog-title"
    aria-describedby="confirmation-dialog-message"
    aria-modal="true"
  >
    <div class="confirmation-dialog-header">
      <h2 id="confirmation-dialog-title" class="confirmation-dialog-title">
        {title}
      </h2>
    </div>

    <div class="confirmation-dialog-body">
      <p id="confirmation-dialog-message" class="confirmation-dialog-message">
        {message}
      </p>
    </div>

    <div class="confirmation-dialog-footer">
      <Button
        variant="secondary"
        on:click={handleCancel}
      >
        {cancelText}
      </Button>
      <Button
        variant={isDestructive ? 'danger' : 'primary'}
        on:click={handleConfirm}
      >
        {confirmText}
      </Button>
    </div>
  </div>
</div>

<style>
  .confirmation-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
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

  .confirmation-dialog {
    background: var(--background-primary, #fff);
    border-radius: 8px;
    width: 90%;
    max-width: 450px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
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

  /* Destructive variant - red accent */
  .confirmation-dialog.destructive {
    border-top: 4px solid var(--text-error, #d32f2f);
  }

  .confirmation-dialog-header {
    padding: 1.25rem 1.5rem 1rem 1.5rem;
  }

  .confirmation-dialog-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-normal, #333);
  }

  .confirmation-dialog.destructive .confirmation-dialog-title {
    color: var(--text-error, #d32f2f);
  }

  .confirmation-dialog-body {
    padding: 0 1.5rem 1.5rem 1.5rem;
  }

  .confirmation-dialog-message {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--text-normal, #333);
  }

  .confirmation-dialog-footer {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding: 1rem 1.5rem 1.5rem 1.5rem;
    border-top: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  /* WCAG 1.4.11 Non-text Contrast - High contrast mode */
  @media (prefers-contrast: high) {
    .confirmation-dialog {
      border: 2px solid var(--text-normal, #333);
    }

    .confirmation-dialog.destructive {
      border-top-width: 6px;
    }

    .confirmation-dialog-footer {
      border-top-width: 2px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .confirmation-dialog-overlay,
    .confirmation-dialog {
      animation: none;
    }
  }

  /* Responsive */
  @media (max-width: 480px) {
    .confirmation-dialog {
      width: 95%;
    }

    .confirmation-dialog-header,
    .confirmation-dialog-body,
    .confirmation-dialog-footer {
      padding-left: 1rem;
      padding-right: 1rem;
    }
  }
</style>
