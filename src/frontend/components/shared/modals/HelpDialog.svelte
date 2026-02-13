<script lang="ts">
  /**
   * HelpDialog Component
   * WCAG 2.1 AA Compliant
   * 
   * Modal dialog displaying help documentation and FAQs
   * 
   * @accessibility
   * - role="dialog" with proper ARIA attributes
   * - Keyboard navigation (Tab, Escape)
   * - Semantic HTML headings for content structure
   * - 44x44px minimum touch targets
   * - High contrast mode support
   * - Scrollable content with visible focus indicators
   */

  import { createEventDispatcher } from 'svelte';
  import Button from '../Button.svelte';
  import Icon from '../Icon.svelte';

  export let onClose: () => void;

  const dispatch = createEventDispatcher();

  interface HelpSection {
    id: string;
    title: string;
    content: string[];
  }

  const helpSections: HelpSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      content: [
        'Welcome to the Task Management Plugin! This tool helps you organize and track your tasks with recurring schedules and reminders.',
        'To create a new task, click the "Create Task" button or use the keyboard shortcut Ctrl+N.',
        'Tasks can have priorities, due dates, tags, and custom recurrence rules.'
      ]
    },
    {
      id: 'creating-tasks',
      title: 'Creating Tasks',
      content: [
        'Click "Create Task" to open the task editor.',
        'Fill in the task description (required).',
        'Set optional fields: priority, due date, tags, notes, and recurrence.',
        'Click "Save" or press Ctrl+Enter to create the task.'
      ]
    },
    {
      id: 'recurrence',
      title: 'Recurring Tasks',
      content: [
        'Set up recurring tasks using natural language: "every day", "every Monday", "every 2 weeks".',
        'Completed recurring tasks automatically create the next instance based on your schedule.',
        'Edit the recurrence rule anytime to change the schedule.'
      ]
    },
    {
      id: 'filtering',
      title: 'Filtering & Sorting',
      content: [
        'Use the filter panel to view tasks by status, priority, project, or tags.',
        'Sort tasks by due date, priority, creation date, or status.',
        'Group tasks by priority, status, or project for better organization.',
        'Use the search bar to find tasks by description or tags.'
      ]
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts',
      content: [
        'Press Shift+? to view all keyboard shortcuts.',
        'Ctrl+N: Create new task',
        'Ctrl+K: Focus search',
        'Escape: Close dialogs or clear selection',
        'Customize shortcuts in Settings → Keyboard Shortcuts.'
      ]
    },
    {
      id: 'tips',
      title: 'Tips & Tricks',
      content: [
        'Use tags to categorize tasks across projects: #home, #work, #urgent',
        'Set priorities to focus on what matters most.',
        'Review upcoming tasks in the dashboard for a quick overview.',
        'Use batch operations to complete, delete, or modify multiple tasks at once.',
        'Export your task data from Settings → Data Management.'
      ]
    }
  ];

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
  class="help-dialog-overlay" 
  on:click={handleBackdropClick}
  role="presentation"
>
  <div
    class="help-dialog"
    role="dialog"
    aria-labelledby="help-dialog-title"
    aria-modal="true"
  >
    <div class="help-dialog-header">
      <h2 id="help-dialog-title">Help & Documentation</h2>
      <button
        type="button"
        class="help-dialog-close"
        on:click={onClose}
        aria-label="Close help dialog"
      >
        <Icon name="x" category="actions" size={20} />
      </button>
    </div>

    <div class="help-dialog-content">
      {#each helpSections as section}
        <section class="help-section" id={section.id}>
          <h3 class="help-section-title">{section.title}</h3>
          {#each section.content as paragraph}
            <p class="help-section-paragraph">{paragraph}</p>
          {/each}
        </section>
      {/each}

      <section class="help-section">
        <h3 class="help-section-title">Need More Help?</h3>
        <p class="help-section-paragraph">
          For additional support, check the full documentation or report issues on the project repository.
        </p>
      </section>
    </div>

    <div class="help-dialog-footer">
      <Button
        variant="primary"
        on:click={onClose}
      >
        Got it
      </Button>
    </div>
  </div>
</div>

<style>
  .help-dialog-overlay {
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

  .help-dialog {
    background: var(--background-primary, #fff);
    border-radius: 8px;
    width: 90%;
    max-width: 700px;
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

  .help-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  .help-dialog-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-normal, #333);
  }

  .help-dialog-close {
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

  .help-dialog-close:hover {
    background: var(--background-modifier-hover, #f5f5f5);
    color: var(--text-normal, #333);
  }

  /* WCAG 2.4.7 Focus Visible */
  .help-dialog-close:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
  }

  .help-dialog-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .help-section {
    margin-bottom: 2rem;
  }

  .help-section:last-child {
    margin-bottom: 0;
  }

  .help-section-title {
    margin: 0 0 0.75rem 0;
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--text-normal, #333);
  }

  .help-section-paragraph {
    margin: 0 0 0.75rem 0;
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--text-normal, #333);
  }

  .help-section-paragraph:last-child {
    margin-bottom: 0;
  }

  .help-dialog-footer {
    display: flex;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  /* WCAG 1.4.11 Non-text Contrast - High contrast mode */
  @media (prefers-contrast: high) {
    .help-dialog-header,
    .help-dialog-footer {
      border-width: 2px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .help-dialog-overlay,
    .help-dialog,
    .help-dialog-close {
      animation: none;
      transition: none;
    }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .help-dialog {
      width: 95%;
      max-height: 90vh;
    }
  }

  @media (max-width: 480px) {
    .help-dialog-header,
    .help-dialog-content,
    .help-dialog-footer {
      padding-left: 1rem;
      padding-right: 1rem;
    }
  }
</style>
