<script lang="ts">
/**
 * TagSelector - Multi-select tag input with autocomplete
 */

import { createEventDispatcher } from 'svelte';
import { generateAriaId, announceToScreenReader } from '../../../utils/accessibility';

export let value: string[] = [];
export let label: string = 'Tags';
export let placeholder: string = 'Add tags...';

const dispatch = createEventDispatcher();

let inputValue: string = '';
let showSuggestions: boolean = false;
let focusedIndex: number = -1;

// ARIA IDs
const inputId = generateAriaId('tag-input');
const suggestionsId = generateAriaId('tag-suggestions');
const labelId = generateAriaId('tag-label');
const hintId = generateAriaId('tag-hint');

$: activeDescendant = focusedIndex >= 0 ? `${suggestionsId}-${focusedIndex}` : undefined;

// Common tag suggestions (could be loaded from existing tasks)
const commonTags = [
  '#work', '#personal', '#urgent', '#project',
  '#waiting', '#someday', '#reading', '#writing',
  '#meeting', '#call', '#email', '#review',
];

$: availableTags = commonTags.filter(
  (tag) => !value.includes(tag) && tag.toLowerCase().includes(inputValue.toLowerCase())
);

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  inputValue = target.value;
  showSuggestions = inputValue.length > 0;
}

function handleKeydown(event: KeyboardEvent) {
  if (!showSuggestions && event.key === 'ArrowDown' && availableTags.length > 0) {
    event.preventDefault();
    showSuggestions = true;
    focusedIndex = 0;
    return;
  }

  if (showSuggestions) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, availableTags.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
    } else if (event.key === 'Enter' && focusedIndex >= 0) {
      event.preventDefault();
      selectSuggestion(availableTags[focusedIndex]!);
      return;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      showSuggestions = false;
      focusedIndex = -1;
      return;
    }
  }

  if (event.key === 'Enter' && inputValue.trim()) {
    event.preventDefault();
    addTag(inputValue.trim());
  } else if (event.key === 'Backspace' && !inputValue && value.length > 0) {
    removeTag(value[value.length - 1]!);
  }
}

function addTag(tag: string) {
  // Ensure tag starts with #
  if (!tag.startsWith('#')) {
    tag = '#' + tag;
  }

  if (!value.includes(tag)) {
    value = [...value, tag];
    dispatch('change', value);
    announceToScreenReader(`Tag added: ${tag}. ${value.length} tags selected.`, 'polite');
  }

  inputValue = '';
  showSuggestions = false;
  focusedIndex = -1;
}

function removeTag(tag: string) {
  value = value.filter((t) => t !== tag);
  dispatch('change', value);
  announceToScreenReader(`Tag removed: ${tag}. ${value.length} tags remaining.`, 'polite');
}

function selectSuggestion(tag: string) {
  addTag(tag);
  focusedIndex = -1;
}
</script>

<div class="tag-selector">
  <label id={labelId} for={inputId} class="tag-label">
    {label}
  </label>
  
  <div class="tag-input-wrapper">
    {#if value.length > 0}
      <div 
        class="selected-tags" 
        role="list"
        aria-label="Selected tags"
      >
        {#each value as tag}
          <span class="tag-chip" role="listitem">
            {tag}
            <button
              class="tag-remove"
              on:click={() => removeTag(tag)}
              type="button"
              aria-label="Remove tag {tag}"
            >
              ✕
            </button>
          </span>
        {/each}
      </div>
    {/if}

    <input
      id={inputId}
      type="text"
      class="tag-input"
      placeholder={value.length === 0 ? placeholder : ''}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={showSuggestions}
      aria-controls={suggestionsId}
      aria-activedescendant={activeDescendant}
      aria-describedby={hintId}
      aria-labelledby={labelId}
      bind:value={inputValue}
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:focus={() => { if (inputValue.length > 0) showSuggestions = true; }}
      on:blur={() => setTimeout(() => { showSuggestions = false; focusedIndex = -1; }, 200)}
    />
  </div>
  
  <p id={hintId} class="tag-hint">
    Press Enter to add a tag, or choose from suggestions
  </p>

  {#if showSuggestions && availableTags.length > 0}
    <div 
      class="tag-suggestions"
      id={suggestionsId}
      role="listbox"
      aria-label="Tag suggestions"
    >
      {#each availableTags as tag, idx}
        <button
          class="suggestion-item"
          class:suggestion-focused={focusedIndex === idx}
          id="{suggestionsId}-{idx}"
          role="option"
          aria-selected={focusedIndex === idx}
          on:click={() => selectSuggestion(tag)}
          type="button"
        >
          <span class="suggestion-icon" aria-hidden="true">🏷️</span>
          <span class="suggestion-label">{tag}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
.tag-selector {
  position: relative;
}

.tag-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-text);
}

.tag-hint {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: var(--b3-theme-text-light, #666);
  font-style: italic;
}

.tag-input-wrapper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  min-height: 38px;
  transition: all 0.15s ease;
}

.tag-input-wrapper:focus-within {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--b3-theme-primary-lighter);
  color: var(--b3-theme-primary);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.tag-remove {
  padding: 0;
  min-width: 20px;
  min-height: 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: currentColor;
  opacity: 0.7;
  transition: opacity 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-remove:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
  opacity: 1;
}

.tag-input {
  flex: 1;
  min-width: 120px;
  padding: 2px 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--b3-theme-text);
  font-family: var(--b3-font-family);
}

/* Suggestions */
.tag-suggestions {
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
  max-height: 200px;
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

.suggestion-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.suggestion-label {
  font-size: 13px;
}

/* Accessibility: High Contrast Mode */
@media (prefers-contrast: high) {
  .tag-input-wrapper,
  .tag-suggestions {
    border: 2px solid CanvasText;
  }

  .tag-label,
  .tag-hint {
    color: CanvasText;
    font-weight: 700;
  }

  .tag-chip {
    border: 1px solid CanvasText;
  }

  .suggestion-item:hover,
  .suggestion-focused {
    background: Highlight;
    color: HighlightText;
  }
}

/* Accessibility: Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .tag-input-wrapper,
  .tag-remove,
  .suggestion-item {
    transition: none;
  }
}
</style>
