<script lang="ts">
  /**
   * Accessible Quick Actions Component
   * WCAG 2.1 AA Compliant
   * 
   * @accessibility
   * - role="group" for action buttons
   * - aria-label for each action
   * - Keyboard accessible (Enter/Space)
   * - 44x44px minimum touch targets
   * - Visible focus indicators
   * - High contrast mode support
   */

  import { createEventDispatcher } from 'svelte';
  import Button from '@components/shared/Button.svelte';
  import Icon from '@components/shared/Icon.svelte';

  export let disabled = false;

  const dispatch = createEventDispatcher();

  interface QuickAction {
    id: string;
    label: string;
    icon: string;
    ariaLabel: string;
    variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  }

  const actions: QuickAction[] = [
    {
      id: 'new-task',
      label: 'New Task',
      icon: '➕',
      ariaLabel: 'Create a new task',
      variant: 'primary'
    },
    {
      id: 'view-overdue',
      label: 'Overdue',
      icon: '⚠',
      ariaLabel: 'View overdue tasks',
      variant: 'danger'
    },
    {
      id: 'view-today',
      label: 'Today',
      icon: '📅',
      ariaLabel: 'View tasks due today',
      variant: 'secondary'
    },
    {
      id: 'view-upcoming',
      label: 'Upcoming',
      icon: '🔜',
      ariaLabel: 'View upcoming tasks',
      variant: 'secondary'
    },
    {
      id: 'search',
      label: 'Search',
      icon: '🔍',
      ariaLabel: 'Search tasks',
      variant: 'ghost'
    }
  ];

  function handleAction(actionId: string) {
    dispatch('action', { actionId });
  }
</script>

<section
  class="quick-actions"
  role="group"
  aria-label="Quick actions for task management"
>
  <h2 class="quick-actions-title">Quick Actions</h2>

  <div class="actions-grid">
    {#each actions as action}
      <Button
        variant={action.variant}
        size="medium"
        ariaLabel={action.ariaLabel}
        {disabled}
        className="action-button"
        on:click={() => handleAction(action.id)}
      >
        <span class="action-icon" aria-hidden="true">{action.icon}</span>
        <span class="action-label">{action.label}</span>
      </Button>
    {/each}
  </div>
</section>

<style>
  .quick-actions {
    padding: 1.5rem;
    background: var(--background-primary, #ffffff);
    border-radius: 8px;
  }

  .quick-actions-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--text-normal, #1f2937);
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  :global(.action-button) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem !important;
    height: auto;
    min-height: 80px;
  }

  .action-icon {
    font-size: 1.75rem;
    line-height: 1;
  }

  .action-label {
    font-size: 0.875rem;
    font-weight: 500;
    text-align: center;
  }

  /* WCAG High Contrast Mode */
  @media (prefers-contrast: high) {
    :global(.action-button) {
      border-width: 2px;
    }
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .actions-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .actions-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
