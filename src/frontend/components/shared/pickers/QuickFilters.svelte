<script lang="ts">
/**
 * QuickFilters - Quick filter buttons for common queries
 */

import { createEventDispatcher } from 'svelte';

const dispatch = createEventDispatcher();

interface FilterOption {
  id: string;
  label: string;
  icon: string;
  query: string;
}

const filterOptions: FilterOption[] = [
  { id: 'all', label: 'All', icon: '📋', query: '' },
  { id: 'high-priority', label: 'High Priority', icon: '⏫', query: 'priority is high' },
  { id: 'overdue', label: 'Overdue', icon: '⚠️', query: 'due before today AND not done' },
  { id: 'no-date', label: 'No Date', icon: '📅', query: 'no due date' },
  { id: 'recurring', label: 'Recurring', icon: '🔁', query: 'has recurrence' },
];

let activeFilter: string = 'all';

function handleFilterClick(filter: FilterOption) {
  activeFilter = filter.id;
  dispatch('filter', {
    id: filter.id,
    query: filter.query,
  });
}
</script>

<div class="quick-filters">
  {#each filterOptions as filter}
    <button
      class="filter-btn"
      class:active={activeFilter === filter.id}
      on:click={() => handleFilterClick(filter)}
      title={filter.label}
    >
      <span class="filter-icon">{filter.icon}</span>
      <span class="filter-label">{filter.label}</span>
    </button>
  {/each}
</div>

<style>
.quick-filters {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.quick-filters::-webkit-scrollbar {
  display: none;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--b3-theme-text);
  transition: all 0.15s ease;
  white-space: nowrap;
}

.filter-btn:hover {
  background: var(--b3-list-hover);
  border-color: var(--b3-theme-primary-light);
}

.filter-btn.active {
  background: var(--b3-theme-primary);
  border-color: var(--b3-theme-primary);
  color: white;
  font-weight: 500;
}

.filter-icon {
  font-size: 14px;
}

.filter-label {
  display: none;
}

@media (min-width: 768px) {
  .filter-label {
    display: inline;
  }
}
</style>
