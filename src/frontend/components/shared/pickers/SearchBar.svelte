<script lang="ts">
/**
 * SearchBar - Search input with query support
 */

import { createEventDispatcher } from 'svelte';
import { generateAriaId } from '../../../utils/accessibility';

export let value: string = '';
export let placeholder: string = 'Search...';
export let label: string = 'Search';
export let resultsCount: number | undefined = undefined;
export let isSearching: boolean = false;

const dispatch = createEventDispatcher();

let inputElement: HTMLInputElement;

// ARIA IDs
const inputId = generateAriaId('search-input');
const resultsAnnouncementId = generateAriaId('search-results');

// Results announcement for screen readers
$: resultsAnnouncement = resultsCount !== undefined 
  ? resultsCount === 0
    ? 'No results found'
    : `${resultsCount} result${resultsCount === 1 ? '' : 's'} found`
  : '';

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  value = target.value;
  dispatch('search', value);
}

function handleClear() {
  value = '';
  dispatch('search', value);
  inputElement.focus();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleClear();
  }
}
</script>

<div class="search-bar" role="search">
  <label for={inputId} class="sr-only">{label}</label>
  <span class="search-icon" aria-hidden="true">🔍</span>
  <input
    id={inputId}
    bind:this={inputElement}
    type="search"
    class="search-input"
    {placeholder}
    {value}
    aria-label={label}
    aria-busy={isSearching}
    aria-describedby={resultsAnnouncement ? resultsAnnouncementId : undefined}
    on:input={handleInput}
    on:keydown={handleKeydown}
  />
  {#if value}
    <button 
      class="search-clear" 
      on:click={handleClear} 
      type="button"
      aria-label="Clear search"
    >
      ✕
    </button>
  {/if}
  
  <!-- Screen reader live region for results announcement -->
  <div 
    id={resultsAnnouncementId}
    class="sr-only" 
    role="status" 
    aria-live="polite"
    aria-atomic="true"
  >
    {resultsAnnouncement}
  </div>
</div>

<style>
.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.search-bar:focus-within {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter);
}

.search-icon {
  flex-shrink: 0;
  font-size: 16px;
  opacity: 0.6;
}

.search-input {
  flex: 1;
  padding: 8px 0;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--b3-theme-text);
  font-family: var(--b3-font-family);
}

.search-input::placeholder {
  color: var(--b3-theme-text-light);
}

.search-clear {
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  color: var(--b3-theme-text-light);
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-clear:hover {
  background: var(--b3-theme-error-lighter);
  color: var(--b3-theme-error);
}

.search-clear:focus-visible {
  outline: 2px solid var(--b3-theme-primary);
  outline-offset: 2px;
}

/* Screen reader only utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Accessibility: High Contrast Mode */
@media (prefers-contrast: high) {
  .search-bar {
    border: 2px solid CanvasText;
  }

  .search-input {
    color: CanvasText;
    font-weight: 600;
  }

  .search-clear {
    border: 1px solid CanvasText;
  }
}

/* Accessibility: Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .search-bar,
  .search-clear {
    transition: none;
  }
}
</style>
