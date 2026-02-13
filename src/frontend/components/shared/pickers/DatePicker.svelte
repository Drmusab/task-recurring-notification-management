<script lang="ts">
/**
 * DatePicker - Natural language date input with calendar picker
 */

import { createEventDispatcher } from 'svelte';
import { parseNaturalDate, toISODate, formatRelativeDate } from '../../domain/utils/DateUtils';
import { generateAriaId, announceToScreenReader } from '../../../utils/accessibility';

export let value: string | undefined = undefined;
export let placeholder: string = 'Enter a date...';
export let label: string = 'Date';
export let required: boolean = false;
export let invalid: boolean = false;
export let errorMessage: string = '';

const dispatch = createEventDispatcher();

let inputValue: string = '';
let showSuggestions: boolean = false;
let parsedDate: Date | null = null;
let focusedIndex: number = -1;

// ARIA IDs
const inputId = generateAriaId('date-input');
const suggestionsId = generateAriaId('date-suggestions');
const hintId = generateAriaId('date-hint');
const errorId = generateAriaId('date-error');

// Computed active descendant
$: activeDescendant = focusedIndex >= 0 ? `${suggestionsId}-${focusedIndex}` : undefined;

// Compute aria-describedby
$: describedby = [hintId, invalid ? errorId : ''].filter(Boolean).join(' ');

// Date shortcut suggestions
const shortcuts = [
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'Next Monday', value: 'next Monday' },
  { label: 'Next Week', value: '+7d' },
  { label: 'In 2 weeks', value: '+14d' },
  { label: 'In 1 month', value: '+30d' },
];

// Initialize input value from prop
$: if (value && !inputValue) {
  inputValue = formatDateValue(value);
}

function formatDateValue(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return formatRelativeDate(date);
  } catch {
    return dateStr;
  }
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  inputValue = target.value;
  
  // Try to parse natural language
  if (inputValue.trim()) {
    parsedDate = parseNaturalDate(inputValue);
    showSuggestions = true;
  } else {
    parsedDate = null;
    showSuggestions = false;
  }
}

function handleBlur() {
  // Delay to allow click on suggestions
  setTimeout(() => {
    showSuggestions = false;
    focusedIndex = -1;
    
    // Update value if valid date parsed
    if (parsedDate) {
      value = toISODate(parsedDate);
      inputValue = formatRelativeDate(parsedDate);
      dispatch('change', value);
      announceToScreenReader(`Date selected: ${formatRelativeDate(parsedDate)}`, 'polite');
    }
  }, 200);
}

function handleFocus() {
  if (inputValue.trim()) {
    showSuggestions = true;
    focusedIndex = -1;
  }
}

// Get all suggestion items (parsed + shortcuts)
$: suggestionItems = [
  ...(parsedDate ? [{ type: 'parsed', date: parsedDate }] : []),
  ...(!inputValue ? shortcuts.map(s => ({ type: 'shortcut', shortcut: s })) : [])
];

function selectShortcut(shortcut: typeof shortcuts[0]) {
  inputValue = shortcut.value;
  parsedDate = parseNaturalDate(shortcut.value);
  
  if (parsedDate) {
    value = toISODate(parsedDate);
    inputValue = formatRelativeDate(parsedDate);
    dispatch('change', value);
  }
  
  showSuggestions = false;
}

function handleClear() {
  inputValue = '';
  value = undefined;
  parsedDate = null;
  showSuggestions = false;
  dispatch('change', undefined);
}

function handleKeydown(event: KeyboardEvent) {
  if (!showSuggestions) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      showSuggestions = true;
      focusedIndex = 0;
    }
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    showSuggestions = false;
    focusedIndex = -1;
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    focusedIndex = Math.min(focusedIndex + 1, suggestionItems.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    focusedIndex = Math.max(focusedIndex - 1, 0);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (focusedIndex >= 0 && suggestionItems[focusedIndex]) {
      const item = suggestionItems[focusedIndex];
      if (item && item.type === 'parsed' && 'date' in item) {
        value = toISODate(item.date);
        inputValue = formatRelativeDate(item.date);
        dispatch('change', value);
        announceToScreenReader(`Date selected: ${formatRelativeDate(item.date)}`, 'polite');
      } else if (item && item.type === 'shortcut' && 'shortcut' in item) {
        selectShortcut(item.shortcut);
      }
      showSuggestions = false;
      focusedIndex = -1;
    } else if (parsedDate) {
      value = toISODate(parsedDate);
      inputValue = formatRelativeDate(parsedDate);
      dispatch('change', value);
      showSuggestions = false;
    }
  }
}
</script>

<div class="date-picker">
  <label for={inputId} class="date-label">
    {label}
    {#if required}
      <span class="required-indicator" aria-hidden="true">*</span>
    {/if}
  </label>
  
  <div class="date-input-wrapper">
    <input
      id={inputId}
      type="text"
      class="date-input"
      class:date-input--invalid={invalid}
      {placeholder}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={showSuggestions}
      aria-controls={suggestionsId}
      aria-activedescendant={activeDescendant}
      aria-describedby={describedby}
      aria-invalid={invalid}
      aria-required={required}
      bind:value={inputValue}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeydown}
    />
    {#if inputValue}
      <button 
        class="date-clear" 
        on:click={handleClear} 
        type="button"
        aria-label="Clear date"
      >
        ✕
      </button>
    {/if}
  </div>
  
  <p id={hintId} class="date-hint">
    Try "today", "tomorrow", "next Monday", or "+7d"
  </p>
  
  {#if invalid && errorMessage}
    <p id={errorId} class="date-error" role="alert">
      {errorMessage}
    </p>
  {/if}

  {#if showSuggestions}
    <div 
      class="date-suggestions" 
      id={suggestionsId}
      role="listbox"
      aria-label="Date suggestions"
    >
      <!-- Parse result -->
      {#if parsedDate}
        <div 
          class="suggestion-item suggestion-parsed"
          class:suggestion-focused={focusedIndex === 0}
          id="{suggestionsId}-0"
          role="option"
          aria-selected={focusedIndex === 0}
        >
          <span class="suggestion-icon" aria-hidden="true">✅</span>
          <div class="suggestion-content">
            <span class="suggestion-label">{formatRelativeDate(parsedDate)}</span>
            <span class="suggestion-detail">{toISODate(parsedDate)}</span>
          </div>
        </div>
      {/if}

      <!-- Shortcuts -->
      {#if !inputValue && shortcuts.length > 0}
        <div class="suggestion-divider" role="presentation">Quick dates</div>
        {#each shortcuts as shortcut, idx}
          {@const itemIndex = parsedDate ? idx + 1 : idx}
          <button
            class="suggestion-item"
            class:suggestion-focused={focusedIndex === itemIndex}
            id="{suggestionsId}-{itemIndex}"
            role="option"
            aria-selected={focusedIndex === itemIndex}
            on:click={() => selectShortcut(shortcut)}
            type="button"
          >
            <span class="suggestion-icon" aria-hidden="true">📅</span>
            <span class="suggestion-label">{shortcut.label}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
.date-picker {
  position: relative;
}

.date-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-text);
}

.required-indicator {
  color: var(--b3-theme-error, #d32f2f);
  margin-left: 2px;
}

.date-hint {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: var(--b3-theme-text-light, #666);
  font-style: italic;
}

.date-error {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: var(--b3-theme-error, #d32f2f);
  font-weight: 500;
}

.date-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.date-input {
  flex: 1;
  padding: 8px 32px 8px 12px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 14px;
  color: var(--b3-theme-text);
  font-family: var(--b3-font-family);
  transition: all 0.15s ease;
}

.date-input:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
}

.date-input--invalid {
  border-color: var(--b3-theme-error, #d32f2f);
}

.date-input--invalid:focus {
  border-color: var(--b3-theme-error, #d32f2f);
  box-shadow: 0 0 0 2px rgba(211, 47, 47, 0.2);
}

.date-clear {
  position: absolute;
  right: 8px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  color: var(--b3-theme-text-light);
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-clear:hover {
  background: var(--b3-theme-error-lighter);
  color: var(--b3-theme-error);
}

.date-clear:focus-visible {
  outline: 2px solid var(--b3-theme-primary);
  outline-offset: 2px;
}

/* Suggestions */
.date-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  padding: 4px 0;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  width: 100%;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.suggestion-item:hover,
.suggestion-focused {
  background: var(--b3-list-hover);
}

.suggestion-item:focus-visible {
  outline: 2px solid var(--b3-theme-primary);
  outline-offset: -2px;
}

.suggestion-parsed {
  background: var(--b3-theme-primary-lighter);
  color: var(--b3-theme-primary);
  cursor: default;
}

.suggestion-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.suggestion-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.suggestion-label {
  font-size: 14px;
  font-weight: 500;
}

.suggestion-detail {
  font-size: 12px;
  opacity: 0.7;
}

.suggestion-divider {
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-text-light);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Accessibility: High Contrast Mode */
@media (prefers-contrast: high) {
  .date-input,
  .date-suggestions {
    border: 2px solid CanvasText;
  }

  .date-input--invalid {
    border-color: CanvasText;
    background: Canvas;
  }

  .date-label,
  .date-hint,
  .date-error {
    color: CanvasText;
    font-weight: 700;
  }

  .suggestion-item:hover,
  .suggestion-focused {
    background: Highlight;
    color: HighlightText;
  }
}

/* Accessibility: Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .date-input,
  .date-clear,
  .suggestion-item {
    transition: none;
  }
}
</style>
