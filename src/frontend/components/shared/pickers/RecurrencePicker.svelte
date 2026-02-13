<script lang="ts">
/**
 * RecurrencePicker - Recurrence rule input with natural language
 */

import { createEventDispatcher } from 'svelte';
import { parseRecurrenceRule, serializeRecurrenceRule } from '../../domain/recurrence/RuleParser';
import type { Frequency } from '../../domain/models/Task';

export let value: Frequency | undefined = undefined;

const dispatch = createEventDispatcher();

let inputValue: string = '';
let showSuggestions: boolean = false;
let parsedFrequency: Frequency | null = null;

// Recurrence shortcuts
const shortcuts = [
  { label: 'Every day', value: 'every day' },
  { label: 'Every week', value: 'every week' },
  { label: 'Every weekday', value: 'every weekday' },
  { label: 'Every Monday', value: 'every Monday' },
  { label: 'Every 2 weeks', value: 'every 2 weeks' },
  { label: 'Every month', value: 'every month' },
  { label: 'Every year', value: 'every year' },
];

// Initialize input value from prop
$: if (value && !inputValue) {
  inputValue = serializeRecurrenceRule(value);
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  inputValue = target.value;
  
  // Try to parse recurrence rule
  if (inputValue.trim()) {
    parsedFrequency = parseRecurrenceRule(inputValue);
    showSuggestions = true;
  } else {
    parsedFrequency = null;
    showSuggestions = false;
  }
}

function handleBlur() {
  setTimeout(() => {
    showSuggestions = false;
    
    // Update value if valid frequency parsed
    if (parsedFrequency) {
      value = parsedFrequency;
      inputValue = serializeRecurrenceRule(parsedFrequency);
      dispatch('change', value);
    }
  }, 200);
}

function handleFocus() {
  if (inputValue.trim()) {
    showSuggestions = true;
  }
}

function selectShortcut(shortcut: typeof shortcuts[0]) {
  inputValue = shortcut.value;
  parsedFrequency = parseRecurrenceRule(shortcut.value);
  
  if (parsedFrequency) {
    value = parsedFrequency;
    inputValue = serializeRecurrenceRule(parsedFrequency);
    dispatch('change', value);
  }
  
  showSuggestions = false;
}

function handleClear() {
  inputValue = '';
  value = undefined;
  parsedFrequency = null;
  showSuggestions = false;
  dispatch('change', undefined);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    showSuggestions = false;
  } else if (event.key === 'Enter') {
    if (parsedFrequency) {
      value = parsedFrequency;
      inputValue = serializeRecurrenceRule(parsedFrequency);
      dispatch('change', value);
      showSuggestions = false;
    }
  }
}
</script>

<div class="recurrence-picker">
  <div class="recurrence-input-wrapper">
    <input
      type="text"
      class="recurrence-input"
      placeholder="e.g., every week, every Monday..."
      bind:value={inputValue}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeydown}
    />
    {#if inputValue}
      <button class="recurrence-clear" on:click={handleClear} title="Clear recurrence">
        ✕
      </button>
    {/if}
  </div>

  {#if showSuggestions}
    <div class="recurrence-suggestions">
      <!-- Parse result -->
      {#if parsedFrequency}
        <div class="suggestion-item suggestion-parsed">
          <span class="suggestion-icon">✅</span>
          <div class="suggestion-content">
            <span class="suggestion-label">{serializeRecurrenceRule(parsedFrequency)}</span>
            <span class="suggestion-detail">{parsedFrequency.type} (interval: {parsedFrequency.interval})</span>
          </div>
        </div>
      {/if}

      <!-- Shortcuts -->
      {#if !inputValue || !parsedFrequency}
        <div class="suggestion-divider">Common patterns</div>
        {#each shortcuts as shortcut}
          <button
            class="suggestion-item"
            on:click={() => selectShortcut(shortcut)}
          >
            <span class="suggestion-icon">🔁</span>
            <span class="suggestion-label">{shortcut.label}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
.recurrence-picker {
  position: relative;
}

.recurrence-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.recurrence-input {
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

.recurrence-input:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
}

.recurrence-clear {
  position: absolute;
  right: 8px;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  color: var(--b3-theme-text-light);
  transition: all 0.15s ease;
}

.recurrence-clear:hover {
  background: var(--b3-theme-error-lighter);
  color: var(--b3-theme-error);
}

/* Suggestions */
.recurrence-suggestions {
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

.suggestion-item:hover {
  background: var(--b3-list-hover);
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
</style>
