<script lang="ts">
  /**
   * MonthPicker Component
   * WCAG 2.1 AA Compliant
   * 
   * Allows users to select a month using an accessible dropdown or grid
   * 
   * @accessibility
   * - label element with for/id relationship
   * - aria-required for required fields
   * - aria-invalid for validation errors
   * - Keyboard navigation (Arrow keys in grid mode, Enter/Space to select)
   * - Screen reader announcements for selection
   * - 44x44px minimum touch targets
   * - High contrast mode support
   */

  import { createEventDispatcher } from 'svelte';

  export let value: number | undefined = undefined; // 0-11 (0=January, 11=December)
  export let label = 'Month';
  export let required = false;
  export let invalid = false;
  export let errorMessage = '';
  export let mode: 'dropdown' | 'grid' = 'dropdown';
  export let className: string = '';

  const dispatch = createEventDispatcher();

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthsShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  let monthPickerId = `month-picker-${Math.random().toString(36).substr(2, 9)}`;
  let errorId = `${monthPickerId}-error`;

  function handleDropdownChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const monthValue = target.value === '' ? undefined : parseInt(target.value, 10);
    value = monthValue;
    dispatch('change', monthValue);
    
    // Announce to screen readers
    if (monthValue !== undefined) {
      announceSelection(monthValue);
    }
  }

  function handleGridSelect(monthIndex: number) {
    value = monthIndex;
    dispatch('change', monthIndex);
    announceSelection(monthIndex);
  }

  function handleKeyDown(event: KeyboardEvent, monthIndex: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleGridSelect(monthIndex);
    }
  }

  function announceSelection(monthIndex: number) {
    const announcement = `${months[monthIndex]} selected`;
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = announcement;
    document.body.appendChild(liveRegion);
    setTimeout(() => document.body.removeChild(liveRegion), 1000);
  }
</script>

<div class="month-picker {className}">
  <label for={monthPickerId} class="month-picker__label">
    {label}
    {#if required}
      <span class="required-indicator" aria-label="required">*</span>
    {/if}
  </label>

  {#if mode === 'dropdown'}
    <select
      id={monthPickerId}
      class="month-picker__select"
      class:invalid
      bind:value
      on:change={handleDropdownChange}
      aria-required={required}
      aria-invalid={invalid}
      aria-describedby={invalid ? errorId : undefined}
    >
      <option value="">Select month...</option>
      {#each months as month, index}
        <option value={index}>{month}</option>
      {/each}
    </select>
  {:else}
    <div
      class="month-picker__grid"
      role="group"
      aria-labelledby={monthPickerId}
    >
      {#each monthsShort as monthShort, index}
        <button
          type="button"
          class="month-picker__month"
          class:selected={value === index}
          on:click={() => handleGridSelect(index)}
          on:keydown={(e) => handleKeyDown(e, index)}
          aria-label={months[index]}
          aria-pressed={value === index}
        >
          {monthShort}
        </button>
      {/each}
    </div>
  {/if}

  {#if invalid && errorMessage}
    <div id={errorId} class="month-picker__error" role="alert">
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .month-picker {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .month-picker__label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-normal, #333);
    margin-bottom: 0.25rem;
  }

  .required-indicator {
    color: var(--text-error, #d32f2f);
    margin-left: 0.25rem;
  }

  /* Dropdown mode */
  .month-picker__select {
    /* WCAG 2.5.5 Target Size - Minimum 44x44px */
    min-height: 44px;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--background-modifier-border, #ccc);
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.875rem;
    background: var(--background-primary, #fff);
    color: var(--text-normal, #333);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .month-picker__select:hover {
    border-color: var(--interactive-accent, #1976d2);
  }

  /* WCAG 2.4.7 Focus Visible */
  .month-picker__select:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
    border-color: var(--interactive-accent, #1976d2);
  }

  .month-picker__select.invalid {
    border-color: var(--text-error, #d32f2f);
  }

  .month-picker__select.invalid:focus-visible {
    outline-color: var(--text-error, #d32f2f);
    box-shadow: 0 0 0 4px rgba(211, 47, 47, 0.2);
  }

  /* Grid mode */
  .month-picker__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  .month-picker__month {
    /* WCAG 2.5.5 Target Size - Minimum 44x44px */
    min-height: 44px;
    padding: 0.625rem;
    border: 1px solid var(--background-modifier-border, #ccc);
    border-radius: 6px;
    background: var(--background-primary, #fff);
    color: var(--text-normal, #333);
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .month-picker__month:hover {
    background: var(--background-modifier-hover, #f5f5f5);
    border-color: var(--interactive-accent, #1976d2);
  }

  /* WCAG 2.4.7 Focus Visible */
  .month-picker__month:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
  }

  .month-picker__month.selected {
    background: var(--interactive-accent, #1976d2);
    color: #ffffff;
    border-color: var(--interactive-accent, #1976d2);
    font-weight: 600;
  }

  .month-picker__month.selected:hover {
    background: var(--interactive-accent-hover, #1565c0);
  }

  /* Error message */
  .month-picker__error {
    font-size: 0.8125rem;
    color: var(--text-error, #d32f2f);
    margin-top: 0.25rem;
  }

  /* WCAG 1.4.11 Non-text Contrast - High contrast mode */
  @media (prefers-contrast: high) {
    .month-picker__select,
    .month-picker__month {
      border-width: 2px;
    }

    .month-picker__month.selected {
      border-width: 3px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .month-picker__select,
    .month-picker__month {
      transition: none;
    }
  }

  /* Responsive */
  @media (max-width: 480px) {
    .month-picker__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* Screen reader only */
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
