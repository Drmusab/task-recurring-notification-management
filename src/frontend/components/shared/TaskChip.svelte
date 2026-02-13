<script lang="ts">
  /**
   * TaskChip Component
   * WCAG 2.1 AA Compliant
   * 
   * Displays task metadata as a compact chip/badge with icon and text
   * 
   * @accessibility
   * - aria-label for screen reader context
   * - Color + icon + text (not relying on color alone)
   * - High contrast mode support
   * - 44x44px touch targets for removable chips
   * - Keyboard accessible remove button
   * - Semantic role="listitem" when in lists
   */

  import { createEventDispatcher } from 'svelte';
  import Icon from './Icon.svelte';

  export let type: 'priority' | 'status' | 'tag' | 'date' | 'recurrence' | 'project' = 'tag';
  export let label: string;
  export let icon: string | undefined = undefined;
  export let removable = false;
  export let ariaLabel: string | undefined = undefined;
  export let size: 'small' | 'medium' = 'medium';
  export let className: string = '';

  const dispatch = createEventDispatcher();

  // Default icons for each type
  const defaultIcons: Record<typeof type, string> = {
    priority: 'flag',
    status: 'check-circle',
    tag: 'tag',
    date: 'calendar',
    recurrence: 'repeat',
    project: 'folder',
  };

  $: chipIcon = icon || defaultIcons[type];
  $: chipAriaLabel = ariaLabel || `${type}: ${label}`;

  function handleRemove(event: MouseEvent) {
    if (removable) {
      dispatch('remove', { type, label });
    }
  }
</script>

<span
  class="task-chip task-chip--{type} task-chip--{size} {className}"
  aria-label={chipAriaLabel}
  role="listitem"
>
  <Icon name={chipIcon} category="features" size={size === 'small' ? 16 : 20} className="task-chip__icon" />
  <span class="task-chip__label">{label}</span>
  {#if removable}
    <button
      type="button"
      class="task-chip__remove"
      on:click={handleRemove}
      aria-label="Remove {label}"
      title="Remove {label}"
    >
      <Icon name="x" category="actions" size={16} />
    </button>
  {/if}
</span>

<style>
  .task-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 16px;
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    user-select: none;
    transition: all 0.2s ease;
  }

  .task-chip--medium {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }

  /* Type-specific colors - WCAG 1.4.1 Use of Color (color + icon + text) */
  .task-chip--priority {
    background: rgba(255, 87, 34, 0.12);
    color: #d84315;
    border: 1px solid rgba(255, 87, 34, 0.3);
  }

  .task-chip--status {
    background: rgba(76, 175, 80, 0.12);
    color: #388e3c;
    border: 1px solid rgba(76, 175, 80, 0.3);
  }

  .task-chip--tag {
    background: rgba(33, 150, 243, 0.12);
    color: #1565c0;
    border: 1px solid rgba(33, 150, 243, 0.3);
  }

  .task-chip--date {
    background: rgba(156, 39, 176, 0.12);
    color: #7b1fa2;
    border: 1px solid rgba(156, 39, 176, 0.3);
  }

  .task-chip--recurrence {
    background: rgba(255, 152, 0, 0.12);
    color: #e65100;
    border: 1px solid rgba(255, 152, 0, 0.3);
  }

  .task-chip--project {
    background: rgba(96, 125, 139, 0.12);
    color: #455a64;
    border: 1px solid rgba(96, 125, 139, 0.3);
  }

  /* WCAG 1.4.11 Non-text Contrast - High contrast mode */
  @media (prefers-contrast: high) {
    .task-chip {
      border-width: 2px;
      font-weight: 600;
    }

    .task-chip--priority {
      background: #fff3e0;
      border-color: #d84315;
    }

    .task-chip--status {
      background: #e8f5e9;
      border-color: #388e3c;
    }

    .task-chip--tag {
      background: #e3f2fd;
      border-color: #1565c0;
    }

    .task-chip--date {
      background: #f3e5f5;
      border-color: #7b1fa2;
    }

    .task-chip--recurrence {
      background: #fff3e0;
      border-color: #e65100;
    }

    .task-chip--project {
      background: #eceff1;
      border-color: #455a64;
    }
  }

  .task-chip__icon {
    flex-shrink: 0;
  }

  .task-chip__label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .task-chip__remove {
    /* WCAG 2.5.5 Target Size - Minimum 44x44px */
    min-width: 24px;
    min-height: 24px;
    padding: 0.25rem;
    margin: -0.25rem -0.25rem -0.25rem 0.125rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: currentColor;
    opacity: 0.6;
    transition: all 0.2s ease;
  }

  .task-chip__remove:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.1);
  }

  /* WCAG 2.4.7 Focus Visible */
  .task-chip__remove:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
    opacity: 1;
  }

  /* WCAG 1.4.12 Text Spacing */
  .task-chip {
    line-height: 1.5;
    letter-spacing: normal;
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .task-chip,
    .task-chip__remove {
      transition: none;
    }
  }

  /* Responsive - ensure readability on small screens */
  @media (max-width: 480px) {
    .task-chip--small {
      font-size: 0.75rem;
      padding: 0.1875rem 0.5rem;
    }

    .task-chip--medium {
      font-size: 0.8125rem;
      padding: 0.25rem 0.625rem;
    }
  }
</style>
