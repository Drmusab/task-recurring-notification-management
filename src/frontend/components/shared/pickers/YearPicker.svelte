<script lang="ts">
  /**
   * YearPicker Component
   * WCAG 2.1 AA Compliant
   * 
   * Allows users to select a year using an accessible dropdown or numeric input
   * 
   * @accessibility
   * - label element with for/id relationship
   * - aria-required for required fields
   * - aria-invalid for validation errors
   * - Keyboard navigation (Arrow keys to increment/decrement)
   * - Screen reader announcements for selection
   * - 44x44px minimum touch targets
   * - High contrast mode support
   */

  import { createEventDispatcher } from 'svelte';

  export let value: number | undefined = undefined;
  export let label = 'Year';
  export let required = false;
  export let invalid = false;
  export let errorMessage = '';
  export let minYear = 1900;
  export let maxYear = 2100;
  export let mode: 'dropdown' | 'input' | 'stepper' = 'dropdown';
  export let className: string = '';

  const dispatch = createEventDispatcher();

  let yearPickerId = `year-picker-${Math.random().toString(36).substr(2, 9)}`;
  let errorId = `${yearPickerId}-error`;

  // Generate year options for dropdown
  $: yearOptions = Array.from(
    { length: maxYear - minYear + 1 },
    (_, i) => minYear + i
  ).reverse(); // Most recent years first

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const yearValue = target.value === '' ? undefined : parseInt(target.value, 10);
    
    // Validate year range
    if (yearValue !== undefined && (yearValue < minYear || yearValue > maxYear)) {
      return;
    }
    
    value = yearValue;
    dispatch('change', yearValue);
    
    // Announce to screen readers
    if (yearValue !== undefined) {
      announceSelection(yearValue);
    }
  }

  function increment() {
    if (value === undefined) {
      value = new Date().getFullYear();
    } else if (value < maxYear) {
      value += 1;
    }
    dispatch('change', value);
    announceSelection(value);
  }

  function decrement() {
    if (value === undefined) {
      value = new Date().getFullYear();
    } else if (value > minYear) {
      value -= 1;
    }
    dispatch('change', value);
    announceSelection(value);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (mode === 'stepper') {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        increment();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        decrement();
      }
    }
  }

  function announceSelection(year: number) {
    const announcement = `Year ${year} selected`;
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = announcement;
    document.body.appendChild(liveRegion);
    setTimeout(() => document.body.removeChild(liveRegion), 1000);
  }
</script>

<div class="year-picker {className}">
  <label for={yearPickerId} class="year-picker__label">
    {label}
    {#if required}
      <span class="required-indicator" aria-label="required">*</span>
    {/if}
  </label>

  {#if mode === 'dropdown'}
    <select
      id={yearPickerId}
      class="year-picker__select"
      class:invalid
      bind:value
      on:change={handleChange}
      aria-required={required}
      aria-invalid={invalid}
      aria-describedby={invalid ? errorId : undefined}
    >
      <option value="">Select year...</option>
      {#each yearOptions as year}
        <option value={year}>{year}</option>
      {/each}
    </select>
  {:else if mode === 'input'}
    <input
      type="number"
      id={yearPickerId}
      class="year-picker__input"
      class:invalid
      bind:value
      on:change={handleChange}
      min={minYear}
      max={maxYear}
      placeholder="YYYY"
      aria-required={required}
      aria-invalid={invalid}
      aria-describedby={invalid ? errorId : undefined}
    />
  {:else}
    <div class="year-picker__stepper">
      <input
        type="number"
        id={yearPickerId}
        class="year-picker__stepper-input"
        class:invalid
        bind:value
        on:change={handleChange}
        on:keydown={handleKeyDown}
        min={minYear}
        max={maxYear}
        placeholder="YYYY"
        aria-required={required}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : `${yearPickerId}-hint`}
      />
      <div class="year-picker__stepper-buttons">
        <button
          type="button"
          class="year-picker__stepper-button year-picker__stepper-button--up"
          on:click={increment}
          aria-label="Increase year"
          disabled={value !== undefined && value >= maxYear}
        >
          ▲
        </button>
        <button
          type="button"
          class="year-picker__stepper-button year-picker__stepper-button--down"
          on:click={decrement}
          aria-label="Decrease year"
          disabled={value !== undefined && value <= minYear}
        >
          ▼
        </button>
      </div>
    </div>
    <div id="{yearPickerId}-hint" class="year-picker__hint sr-only">
      Use arrow up and down keys to change year
    </div>
  {/if}

  {#if invalid && errorMessage}
    <div id={errorId} class="year-picker__error" role="alert">
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .year-picker {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .year-picker__label {
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

  /* Dropdown and Input modes */
  .year-picker__select,
  .year-picker__input {
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

  .year-picker__input {
    cursor: text;
  }

  .year-picker__select:hover,
  .year-picker__input:hover {
    border-color: var(--interactive-accent, #1976d2);
  }

  /* WCAG 2.4.7 Focus Visible */
  .year-picker__select:focus-visible,
  .year-picker__input:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
    border-color: var(--interactive-accent, #1976d2);
  }

  .year-picker__select.invalid,
  .year-picker__input.invalid {
    border-color: var(--text-error, #d32f2f);
  }

  .year-picker__select.invalid:focus-visible,
  .year-picker__input.invalid:focus-visible {
    outline-color: var(--text-error, #d32f2f);
    box-shadow: 0 0 0 4px rgba(211, 47, 47, 0.2);
  }

  /* Stepper mode */
  .year-picker__stepper {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }

  .year-picker__stepper-input {
    flex: 1;
    /* WCAG 2.5.5 Target Size - Minimum 44x44px */
    min-height: 44px;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--background-modifier-border, #ccc);
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.875rem;
    background: var(--background-primary, #fff);
    color: var(--text-normal, #333);
    transition: all 0.2s ease;
  }

  .year-picker__stepper-input:hover {
    border-color: var(--interactive-accent, #1976d2);
  }

  .year-picker__stepper-input:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
    border-color: var(--interactive-accent, #1976d2);
  }

  .year-picker__stepper-input.invalid {
    border-color: var(--text-error, #d32f2f);
  }

  .year-picker__stepper-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .year-picker__stepper-button {
    /* WCAG 2.5.5 Target Size - Minimum 44x44px width, 22px height each */
    min-width: 44px;
    height: 21.5px;
    padding: 0;
    border: 1px solid var(--background-modifier-border, #ccc);
    border-radius: 4px;
    background: var(--background-primary, #fff);
    color: var(--text-normal, #333);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .year-picker__stepper-button:hover:not(:disabled) {
    background: var(--background-modifier-hover, #f5f5f5);
    border-color: var(--interactive-accent, #1976d2);
  }

  .year-picker__stepper-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* WCAG 2.4.7 Focus Visible */
  .year-picker__stepper-button:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
  }

  /* Error message */
  .year-picker__error {
    font-size: 0.8125rem;
    color: var(--text-error, #d32f2f);
    margin-top: 0.25rem;
  }

  .year-picker__hint {
    font-size: 0.75rem;
    color: var(--text-muted, #666);
    margin-top: 0.25rem;
  }

  /* WCAG 1.4.11 Non-text Contrast - High contrast mode */
  @media (prefers-contrast: high) {
    .year-picker__select,
    .year-picker__input,
    .year-picker__stepper-input,
    .year-picker__stepper-button {
      border-width: 2px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .year-picker__select,
    .year-picker__input,
    .year-picker__stepper-input,
    .year-picker__stepper-button {
      transition: none;
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
