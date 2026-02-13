<script lang="ts">
  /**
   * Accessible Dropdown Component
   * WCAG 2.1 AA Compliant
   * 
   * @accessibility
   * - Uses ARIA combobox + listbox pattern
   * - Keyboard navigation (ArrowUp/Down, Enter, Escape)
   * - aria-expanded state
   * - aria-activedescendant for focus management
   * - Screen reader announcements
   * - 44x44px minimum touch targets
   * - Visible focus indicators
   * 
   * @reference https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
   */

  import { createEventDispatcher } from 'svelte';
  import { generateAriaId } from '@frontend/utils/accessibility';

  export let label: string;
  export let options: Array<{ value: string; label: string; disabled?: boolean }> = [];
  export let value: string | undefined = undefined;
  export let placeholder = 'Select an option';
  export let disabled = false;
  export let required = false;
  export let ariaDescribedBy: string | undefined = undefined;

  const dispatch = createEventDispatcher();
  const dropdownId = generateAriaId('dropdown');
  const listboxId = generateAriaId('listbox');
  const labelId = generateAriaId('label');

  let isOpen = false;
  let focusedIndex = -1;
  let buttonElement: HTMLButtonElement | undefined;

  $: selectedOption = options.find(opt => opt.value === value);
  $: displayText = selectedOption?.label || placeholder;

  function toggle() {
    if (disabled) return;
    isOpen = !isOpen;
    if (isOpen) {
      focusedIndex = options.findIndex(opt => opt.value === value);
      if (focusedIndex === -1) focusedIndex = 0;
    }
  }

  function select(option: typeof options[0]) {
    if (option.disabled) return;
    value = option.value;
    isOpen = false;
    dispatch('change', { value: option.value });
    buttonElement?.focus();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          isOpen = true;
          focusedIndex = 0;
        } else {
          focusedIndex = Math.min(focusedIndex + 1, options.length - 1);
          // Skip disabled options
          while (options[focusedIndex]?.disabled && focusedIndex < options.length - 1) {
            focusedIndex++;
          }
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          focusedIndex = Math.max(focusedIndex - 1, 0);
          // Skip disabled options
          while (options[focusedIndex]?.disabled && focusedIndex > 0) {
            focusedIndex--;
          }
        }
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen && focusedIndex >= 0) {
          const selectedOption = options[focusedIndex];
          if (selectedOption) {
            select(selectedOption);
          }
        } else {
          toggle();
        }
        break;

      case 'Escape':
        event.preventDefault();
        isOpen = false;
        buttonElement?.focus();
        break;

      case 'Home':
        if (isOpen) {
          event.preventDefault();
          focusedIndex = 0;
        }
        break;

      case 'End':
        if (isOpen) {
          event.preventDefault();
          focusedIndex = options.length - 1;
        }
        break;
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (isOpen && !event.target) {
      isOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="dropdown-container">
  <label id={labelId} for={dropdownId} class="dropdown-label">
    {label}
    {#if required}
      <span class="required-indicator" aria-label="required">*</span>
    {/if}
  </label>
  
  <button
    id={dropdownId}
    bind:this={buttonElement}
    type="button"
    role="combobox"
    class="dropdown-button"
    aria-labelledby={labelId}
    aria-describedby={ariaDescribedBy}
    aria-expanded={isOpen}
    aria-controls={listboxId}
    aria-haspopup="listbox"
    aria-activedescendant={isOpen && focusedIndex >= 0 ? `${listboxId}-option-${focusedIndex}` : undefined}
    aria-required={required}
    {disabled}
    on:click|stopPropagation={toggle}
    on:keydown={handleKeydown}
  >
    <span class="dropdown-text">{displayText}</span>
    <span class="dropdown-arrow" aria-hidden="true">
      {isOpen ? '▲' : '▼'}
    </span>
  </button>

  {#if isOpen}
    <ul
      id={listboxId}
      role="listbox"
      class="dropdown-list"
      aria-labelledby={labelId}
      tabindex="-1"
    >
      {#each options as option, index}
        <li
          id="{listboxId}-option-{index}"
          role="option"
          class="dropdown-option"
          class:dropdown-option-focused={index === focusedIndex}
          class:dropdown-option-selected={option.value === value}
          class:dropdown-option-disabled={option.disabled}
          aria-selected={option.value === value}
          aria-disabled={option.disabled}
          on:click={() => select(option)}
          on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              select(option);
            }
          }}
          on:mouseenter={() => focusedIndex = index}
        >
          {option.label}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .dropdown-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .dropdown-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal, #1f2937);
  }

  .required-indicator {
    color: var(--text-error, #ef4444);
    margin-left: 0.25rem;
  }

  .dropdown-button {
    /* WCAG 2.5.5 Target Size - Minimum 44x44px */
    min-height: 44px;
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    background: var(--background-primary, #ffffff);
    border: 1px solid var(--background-modifier-border, #d1d5db);
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    color: var(--text-normal, #1f2937);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .dropdown-button:hover:not(:disabled) {
    border-color: var(--interactive-accent, #1976d2);
    background: var(--background-primary-alt, #f9fafb);
  }

  /* WCAG 2.4.7 Focus Visible */
  .dropdown-button:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
  }

  .dropdown-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--background-secondary, #f5f5f5);
  }

  .dropdown-text {
    flex: 1;
    text-align: left;
  }

  .dropdown-arrow {
    font-size: 10px;
    color: var(--text-muted, #6b7280);
  }

  .dropdown-list {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 1000;
    max-height: 300px;
    overflow-y: auto;
    background: var(--background-primary, #ffffff);
    border: 1px solid var(--background-modifier-border, #d1d5db);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    list-style: none;
    margin: 0;
    padding: 0.25rem;
  }

  .dropdown-option {
    /* WCAG 2.5.5 Target Size */
    min-height: 44px;
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s ease;
    font-size: 14px;
  }

  .dropdown-option:hover:not(.dropdown-option-disabled) {
    background: var(--background-modifier-hover, #f3f4f6);
  }

  .dropdown-option-focused {
    background: var(--background-modifier-hover, #f3f4f6);
  }

  .dropdown-option-selected {
    background: var(--interactive-accent-rgb, rgba(25, 118, 210, 0.1));
    color: var(--interactive-accent, #1976d2);
    font-weight: 500;
  }

  .dropdown-option-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* WCAG High Contrast Mode */
  @media (prefers-contrast: high) {
    .dropdown-button,
    .dropdown-list {
      border-width: 2px;
    }
  }

  /* WCAG Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .dropdown-button,
    .dropdown-option {
      transition: none;
    }
  }
</style>
