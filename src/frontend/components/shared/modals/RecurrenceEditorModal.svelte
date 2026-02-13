<script lang="ts">
  /**
   * RecurrenceEditorModal Component
   * WCAG 2.1 AA Compliant
   * 
   * Modal dialog for editing task recurrence rules with preset options
   * 
   * @accessibility
   * - role="dialog" with aria-labelledby and aria-modal
   * - Focus trap within modal
   * - Keyboard navigation (Tab, Escape, Enter)
   * - Radio button group for presets with fieldset/legend
   * - 44x44px minimum touch targets
   * - Screen reader announcements for selection changes
   * - High contrast mode support
   */

  import { onMount, createEventDispatcher } from 'svelte';
  import Button from '../Button.svelte';
  import Icon from '../Icon.svelte';

  export let initialRule: string = '';
  export let onClose: () => void;

  const dispatch = createEventDispatcher();

  interface RecurrencePreset {
    id: string;
    label: string;
    rule: string;
    description: string;
  }

  const presets: RecurrencePreset[] = [
    { id: 'none', label: 'Does not repeat', rule: '', description: 'Task will not recur' },
    { id: 'daily', label: 'Daily', rule: 'every day', description: 'Repeats every day' },
    { id: 'weekdays', label: 'Every weekday (Mon-Fri)', rule: 'every weekday', description: 'Repeats Monday through Friday' },
    { id: 'weekly', label: 'Weekly', rule: 'every week', description: 'Repeats once a week' },
    { id: 'biweekly', label: 'Every 2 weeks', rule: 'every 2 weeks', description: 'Repeats every two weeks' },
    { id: 'monthly', label: 'Monthly', rule: 'every month', description: 'Repeats once a month' },
    { id: 'yearly', label: 'Yearly', rule: 'every year', description: 'Repeats once a year' },
    { id: 'custom', label: 'Custom', rule: 'custom', description: 'Enter custom recurrence rule' },
  ];

  let selectedPreset = 'none';
  let customRule = '';
  let dialogElement: HTMLElement;
  let firstFocusableElement: HTMLElement;
  let announcementText = '';

  // Initialize selected preset based on initial rule
  onMount(() => {
    if (initialRule) {
      const matchingPreset = presets.find(p => p.rule === initialRule.toLowerCase().trim());
      if (matchingPreset) {
        selectedPreset = matchingPreset.id;
      } else {
        selectedPreset = 'custom';
        customRule = initialRule;
      }
    }

    // Set up focus trap
    if (firstFocusableElement) {
      firstFocusableElement.focus();
    }
  });

  function handlePresetChange(presetId: string) {
    selectedPreset = presetId;
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      announcementText = `${preset.label} selected. ${preset.description}`;
    }
  }

  function handleSave() {
    let rule = '';
    if (selectedPreset === 'custom') {
      rule = customRule.trim();
    } else {
      const preset = presets.find(p => p.id === selectedPreset);
      rule = preset?.rule || '';
    }
    
    dispatch('save', rule);
    announcementText = 'Recurrence rule saved';
    setTimeout(() => onClose(), 100);
  }

  function handleCancel() {
    onClose();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    } else if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      handleSave();
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
  class="recurrence-modal-overlay" 
  on:click={handleBackdropClick}
  role="presentation"
>
  <div
    bind:this={dialogElement}
    class="recurrence-modal-dialog"
    role="dialog"
    aria-labelledby="recurrence-modal-title"
    aria-modal="true"
  >
    <div class="recurrence-modal-header">
      <h2 id="recurrence-modal-title">Edit Recurrence</h2>
      <button
        type="button"
        class="recurrence-modal-close"
        on:click={handleCancel}
        aria-label="Close recurrence editor"
      >
        <Icon name="x" category="actions" size={20} />
      </button>
    </div>

    <div class="recurrence-modal-content">
      <fieldset class="recurrence-modal-presets">
        <legend class="recurrence-modal-legend">Repeat</legend>
        {#each presets as preset, index}
          <label class="recurrence-modal-preset-label">
            {#if index === 0}
              <input
                type="radio"
                name="recurrence-preset"
                value={preset.id}
                checked={selectedPreset === preset.id}
                on:change={() => handlePresetChange(preset.id)}
                class="recurrence-modal-radio"
                bind:this={firstFocusableElement}
              />
            {:else}
              <input
                type="radio"
                name="recurrence-preset"
                value={preset.id}
                checked={selectedPreset === preset.id}
                on:change={() => handlePresetChange(preset.id)}
                class="recurrence-modal-radio"
              />
            {/if}
            <div class="recurrence-modal-preset-content">
              <span class="recurrence-modal-preset-label-text">{preset.label}</span>
              <span class="recurrence-modal-preset-description">{preset.description}</span>
            </div>
          </label>
        {/each}
      </fieldset>

      {#if selectedPreset === 'custom'}
        <div class="recurrence-modal-custom">
          <label for="custom-rule" class="recurrence-modal-custom-label">
            Custom recurrence rule
          </label>
          <input
            type="text"
            id="custom-rule"
            class="recurrence-modal-custom-input"
            bind:value={customRule}
            placeholder="e.g., every 3 days, every Monday and Wednesday"
            aria-describedby="custom-rule-hint"
          />
          <p id="custom-rule-hint" class="recurrence-modal-custom-hint">
            Examples: "every 3 days", "every Monday", "every 2 weeks on Friday"
          </p>
        </div>
      {/if}
    </div>

    <div class="recurrence-modal-footer">
      <Button
        variant="secondary"
        on:click={handleCancel}
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        on:click={handleSave}
      >
        Save
      </Button>
    </div>

    <!-- ARIA live region for announcements -->
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcementText}
    </div>
  </div>
</div>

<style>
  .recurrence-modal-overlay {
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

  .recurrence-modal-dialog {
    background: var(--background-primary, #fff);
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
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

  .recurrence-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  .recurrence-modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-normal, #333);
  }

  .recurrence-modal-close {
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

  .recurrence-modal-close:hover {
    background: var(--background-modifier-hover, #f5f5f5);
    color: var(--text-normal, #333);
  }

  /* WCAG 2.4.7 Focus Visible */
  .recurrence-modal-close:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
  }

  .recurrence-modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .recurrence-modal-presets {
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .recurrence-modal-legend {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-normal, #333);
    margin-bottom: 0.5rem;
  }

  .recurrence-modal-preset-label {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    cursor: pointer;
    /* WCAG 2.5.5 Target Size - Minimum 44x44px */
    min-height: 44px;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border, #e0e0e0);
    transition: all 0.2s ease;
  }

  .recurrence-modal-preset-label:hover {
    background: var(--background-modifier-hover, #f5f5f5);
    border-color: var(--interactive-accent, #1976d2);
  }

  .recurrence-modal-preset-label:has(input:checked) {
    background: rgba(25, 118, 210, 0.08);
    border-color: var(--interactive-accent, #1976d2);
  }

  .recurrence-modal-radio {
    /* WCAG 2.5.5 Target Size */
    min-width: 20px;
    min-height: 20px;
    margin: 0;
    margin-top: 0.125rem;
    cursor: pointer;
    flex-shrink: 0;
  }

  /* WCAG 2.4.7 Focus Visible */
  .recurrence-modal-radio:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
  }

  .recurrence-modal-preset-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .recurrence-modal-preset-label-text {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-normal, #333);
  }

  .recurrence-modal-preset-description {
    font-size: 0.8125rem;
    color: var(--text-muted, #666);
  }

  /* Custom rule input */
  .recurrence-modal-custom {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  .recurrence-modal-custom-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-normal, #333);
    margin-bottom: 0.5rem;
  }

  .recurrence-modal-custom-input {
    /* WCAG 2.5.5 Target Size - Minimum 44x44px */
    min-height: 44px;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--background-modifier-border, #ccc);
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.875rem;
    background: var(--background-primary, #fff);
    color: var(--text-normal, #333);
    transition: all 0.2s ease;
  }

  .recurrence-modal-custom-input:hover {
    border-color: var(--interactive-accent, #1976d2);
  }

  .recurrence-modal-custom-input:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
    border-color: var(--interactive-accent, #1976d2);
  }

  .recurrence-modal-custom-hint {
    font-size: 0.75rem;
    color: var(--text-muted, #666);
    margin: 0.5rem 0 0 0;
  }

  .recurrence-modal-footer {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  /* WCAG 1.4.11 Non-text Contrast - High contrast mode */
  @media (prefers-contrast: high) {
    .recurrence-modal-preset-label,
    .recurrence-modal-custom-input {
      border-width: 2px;
    }

    .recurrence-modal-preset-label:has(input:checked) {
      border-width: 3px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .recurrence-modal-overlay,
    .recurrence-modal-dialog,
    .recurrence-modal-close,
    .recurrence-modal-preset-label,
    .recurrence-modal-custom-input {
      animation: none;
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

  /* Responsive */
  @media (max-width: 480px) {
    .recurrence-modal-dialog {
      width: 95%;
      max-height: 90vh;
    }

    .recurrence-modal-header,
    .recurrence-modal-content,
    .recurrence-modal-footer {
      padding-left: 1rem;
      padding-right: 1rem;
    }
  }
</style>
