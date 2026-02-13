<script lang="ts">
  /**
   * AboutDialog Component
   * WCAG 2.1 AA Compliant
   * 
   * Modal dialog displaying plugin information, version, and credits
   * 
   * @accessibility
   * - role="dialog" with proper ARIA attributes
   * - Keyboard navigation (Tab, Escape)
   * - Semantic HTML structure
   * - 44x44px minimum touch targets
   * - High contrast mode support
   */

  import { createEventDispatcher } from 'svelte';
  import Button from '../Button.svelte';
  import Icon from '../Icon.svelte';

  export let onClose: () => void;
  export let version = '1.0.0';
  export let author = 'Plugin Developer';
  export let repository = '';

  const dispatch = createEventDispatcher();

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div 
  class="about-dialog-overlay" 
  on:click={handleBackdropClick}
  role="presentation"
>
  <div
    class="about-dialog"
    role="dialog"
    aria-labelledby="about-dialog-title"
    aria-modal="true"
  >
    <div class="about-dialog-header">
      <h2 id="about-dialog-title">About Task Management Plugin</h2>
      <button
        type="button"
        class="about-dialog-close"
        on:click={onClose}
        aria-label="Close about dialog"
      >
        <Icon name="x" category="actions" size={20} />
      </button>
    </div>

    <div class="about-dialog-content">
      <div class="about-dialog-logo">
        <Icon name="check-circle" category="status" size={24} />
      </div>

      <div class="about-dialog-info">
        <h3 class="about-dialog-app-name">Task Management Plugin</h3>
        <p class="about-dialog-version">Version {version}</p>
      </div>

      <div class="about-dialog-section">
        <h4 class="about-dialog-section-title">Description</h4>
        <p class="about-dialog-section-text">
          A comprehensive task management plugin with support for recurring tasks, 
          priorities, tags, reminders, and advanced filtering capabilities.
        </p>
      </div>

      <div class="about-dialog-section">
        <h4 class="about-dialog-section-title">Features</h4>
        <ul class="about-dialog-list">
          <li>Create and organize tasks with priorities and tags</li>
          <li>Flexible recurrence rules for repeating tasks</li>
          <li>Advanced filtering, sorting, and grouping</li>
          <li>Customizable keyboard shortcuts</li>
          <li>Calendar view and timeline visualization</li>
          <li>Task analytics and completion tracking</li>
        </ul>
      </div>

      {#if author}
        <div class="about-dialog-section">
          <h4 class="about-dialog-section-title">Author</h4>
          <p class="about-dialog-section-text">{author}</p>
        </div>
      {/if}

      {#if repository}
        <div class="about-dialog-section">
          <h4 class="about-dialog-section-title">Repository</h4>
          <a 
            href={repository} 
            target="_blank" 
            rel="noopener noreferrer"
            class="about-dialog-link"
          >
            {repository}
          </a>
        </div>
      {/if}

      <div class="about-dialog-section">
        <h4 class="about-dialog-section-title">License</h4>
        <p class="about-dialog-section-text">MIT License</p>
      </div>
    </div>

    <div class="about-dialog-footer">
      <Button
        variant="primary"
        on:click={onClose}
      >
        Close
      </Button>
    </div>
  </div>
</div>

<style>
  .about-dialog-overlay {
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

  .about-dialog {
    background: var(--background-primary, #fff);
    border-radius: 8px;
    width: 90%;
    max-width: 550px;
    max-height: 80vh;
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

  .about-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  .about-dialog-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-normal, #333);
  }

  .about-dialog-close {
    /* WCAG 2.5.5 Target Size - Minimum 44x44px */
    min-width: 44px;
    min-height: 44px;
    padding: 0.625rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--text-muted, #666);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .about-dialog-close:hover {
    background: var(--background-modifier-hover, #f5f5f5);
    color: var(--text-normal, #333);
  }

  /* WCAG 2.4.7 Focus Visible */
  .about-dialog-close:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
  }

  .about-dialog-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .about-dialog-logo {
    text-align: center;
    margin-bottom: 1rem;
    color: var(--interactive-accent, #1976d2);
  }

  .about-dialog-info {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .about-dialog-app-name {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-normal, #333);
  }

  .about-dialog-version {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted, #666);
  }

  .about-dialog-section {
    margin-bottom: 1.5rem;
  }

  .about-dialog-section:last-child {
    margin-bottom: 0;
  }

  .about-dialog-section-title {
    margin: 0 0 0.5rem 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-normal, #333);
  }

  .about-dialog-section-text {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--text-normal, #333);
  }

  .about-dialog-list {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.875rem;
    line-height: 1.8;
    color: var(--text-normal, #333);
  }

  .about-dialog-list li {
    margin-bottom: 0.25rem;
  }

  .about-dialog-link {
    /* WCAG 2.5.5 Target Size - Minimum 44x44px height */
    display: inline-block;
    min-height: 44px;
    padding: 0.625rem 0;
    color: var(--interactive-accent, #1976d2);
    text-decoration: underline;
    font-size: 0.875rem;
    word-break: break-all;
    transition: color 0.2s ease;
  }

  .about-dialog-link:hover {
    color: var(--interactive-accent-hover, #1565c0);
  }

  /* WCAG 2.4.7 Focus Visible */
  .about-dialog-link:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
  }

  .about-dialog-footer {
    display: flex;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  /* WCAG 1.4.11 Non-text Contrast - High contrast mode */
  @media (prefers-contrast: high) {
    .about-dialog-header,
    .about-dialog-footer {
      border-width: 2px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .about-dialog-overlay,
    .about-dialog,
    .about-dialog-close,
    .about-dialog-link {
      animation: none;
      transition: none;
    }
  }

  /* Responsive */
  @media (max-width: 480px) {
    .about-dialog {
      width: 95%;
    }

    .about-dialog-header,
    .about-dialog-content,
    .about-dialog-footer {
      padding-left: 1rem;
      padding-right: 1rem;
    }
  }
</style>
