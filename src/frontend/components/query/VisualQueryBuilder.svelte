<script lang="ts">
  /**
   * Visual Query Builder Component
   * 
   * Provides drag-and-drop query construction with:
   * - Visual boolean operators (AND, OR, NOT)
   * - Filter blocks (date, status, tags, etc.)
   * - Grouping and nesting
   * - Real-time query string generation
   * - Query validation
   * 
   * Phase 3: Advanced Query Features
   * 
   * @module VisualQueryBuilder
   */

  import { onMount } from "svelte";

  // Filter types available
  type FilterType = 
    | "status" 
    | "date" 
    | "tag" 
    | "priority" 
    | "text" 
    | "folder"
    | "recurrence";

  interface FilterBlock {
    id: string;
    type: FilterType;
    value: string;
    operator?: "equals" | "contains" | "before" | "after" | "not";
  }

  interface QueryGroup {
    id: string;
    operator: "AND" | "OR";
    filters: (FilterBlock | QueryGroup)[];
  }

  // Props
  export let onQueryChange: (queryString: string) => void = () => {};
  export let initialQuery: string = "";

  // State
  let rootGroup: QueryGroup = {
    id: "root",
    operator: "AND",
    filters: []
  };

  let queryString = "";
  let draggedFilter: FilterType | null = null;
  let showAddFilterMenu = false;
  let addFilterTarget: QueryGroup | null = null;

  // Available filter templates
  const filterTemplates: {  type: FilterType; label: string; icon: string; placeholder: string }[] = [
    { type: "status", label: "Status Filter", icon: "✓", placeholder: "e.g., done, pending, in-progress" },
    { type: "date", label: "Date Filter", icon: "📅", placeholder: "e.g., today, tomorrow, 2024-01-01" },
    { type: "tag", label: "Tag Filter", icon: "🏷️", placeholder: "e.g., #work, #personal" },
    { type: "priority", label: "Priority Filter", icon: "⚡", placeholder: "e.g., high, medium, low" },
    { type: "text", label: "Text Filter", icon: "📝", placeholder: "Search in task text" },
    { type: "folder", label: "Folder Filter", icon: "📁", placeholder: "Folder name" },
    { type: "recurrence", label: "Recurrence Filter", icon: "🔄", placeholder: "e.g., daily, weekly" },
  ];

  onMount(() => {
    if (initialQuery) {
      // TODO: Parse initial query string into blocks
      queryString = initialQuery;
    }
    updateQueryString();
  });

  function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function handleDragStart(filterType: FilterType) {
    draggedFilter = filterType;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent, group: QueryGroup) {
    event.preventDefault();
    if (draggedFilter) {
      addFilter(group, draggedFilter);
      draggedFilter = null;
    }
  }

  function addFilter(group: QueryGroup, type: FilterType) {
    const newFilter: FilterBlock = {
      id: generateId(),
      type,
      value: "",
      operator: "equals"
    };
    
    group.filters = [...group.filters, newFilter];
    updateQueryString();
  }

  function removeFilter(group: QueryGroup, filterId: string) {
    group.filters = group.filters.filter(f => {
      if ("id" in f) {
        return f.id !== filterId;
      }
      return true;
    });
    updateQueryString();
  }

  function addGroup(parentGroup: QueryGroup) {
    const newGroup: QueryGroup = {
      id: generateId(),
      operator: "AND",
      filters: []
    };
    
    parentGroup.filters = [...parentGroup.filters, newGroup];
    updateQueryString();
  }

  function removeGroup(parentGroup: QueryGroup, groupId: string) {
    parentGroup.filters = parentGroup.filters.filter(f => {
      if ("operator" in f) {
        return f.id !== groupId;
      }
      return true;
    });
    updateQueryString();
  }

  function toggleOperator(group: QueryGroup) {
    group.operator = group.operator === "AND" ? "OR" : "AND";
    updateQueryString();
  }

  function updateFilterValue(filter: FilterBlock, value: string) {
    filter.value = value;
    updateQueryString();
  }

  function updateFilterOperator(filter: FilterBlock, operator: FilterBlock["operator"]) {
    filter.operator = operator;
    updateQueryString();
  }

  function updateQueryString() {
    queryString = generateQueryString(rootGroup);
    onQueryChange(queryString);
  }

  function generateQueryString(group: QueryGroup, isNested: boolean = false): string {
    if (group.filters.length === 0) return "";

    const parts = group.filters
      .map(item => {
        if ("operator" in item) {
          // It's a group
          const nested = generateQueryString(item, true);
          return nested ? `(${nested})` : "";
        } else {
          // It's a filter
          return generateFilterString(item);
        }
      })
      .filter(Boolean);

    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];

    const operator = group.operator === "AND" ? " AND " : " OR ";
    const result = parts.join(operator);

    return isNested ? result : result;
  }

  function generateFilterString(filter: FilterBlock): string {
    if (!filter.value) return "";

    const { type, value, operator } = filter;

    switch (type) {
      case "status":
        return `status:${value}`;
      case "date":
        return operator === "before" ? `due before ${value}` : 
               operator === "after" ? `due after ${value}` : 
               `due:${value}`;
      case "tag":
        return operator === "not" ? `NOT tag:${value}` : `tag:${value}`;
      case "priority":
        return `priority:${value}`;
      case "text":
        return operator === "contains" ? `"${value}"` : value;
      case "folder":
        return `folder:${value}`;
      case "recurrence":
        return `recurrence:${value}`;
      default:
        return value;
    }
  }

  function openAddFilterMenu(group: QueryGroup) {
    addFilterTarget = group;
    showAddFilterMenu = true;
  }

  function selectFilter(type: FilterType) {
    if (addFilterTarget) {
      addFilter(addFilterTarget, type);
    }
    showAddFilterMenu = false;
    addFilterTarget = null;
  }

  function clearAll() {
    rootGroup.filters = [];
    updateQueryString();
  }
</script>

<div class="visual-query-builder" role="region" aria-label="Visual query builder">
  <div class="builder-header">
    <h3 id="query-builder-title">🎨 Visual Query Builder</h3>
    <div class="header-actions">
      <button 
        class="btn-secondary" 
        on:click={clearAll}
        aria-label="Clear all filters"
        type="button"
      >
        Clear All
      </button>
    </div>
  </div>

  <!-- Filter Palette -->
  <div class="filter-palette" role="toolbar" aria-label="Available filters">
    <h4 id="filter-palette-title">Drag & Drop Filters</h4>
    <div class="palette-items" role="group" aria-labelledby="filter-palette-title">
      {#each filterTemplates as template}
        <div
          class="palette-item"
          draggable="true"
          on:dragstart={() => handleDragStart(template.type)}
          on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (addFilterTarget) {
                addFilter(addFilterTarget, template.type);
              } else {
                addFilter(rootGroup, template.type);
              }
            }
          }}
          title={template.placeholder}
          role="button"
          tabindex="0"
          aria-label={`Add ${template.label}`}
        >
          <span class="palette-icon" aria-hidden="true">{template.icon}</span>
          <span class="palette-label">{template.label}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Query Builder Area -->
  <div class="builder-area" role="application" aria-labelledby="query-builder-title">
    <div class="query-group root-group">
      <div class="group-header">
        <button
          class="operator-toggle {rootGroup.operator.toLowerCase()}"
          on:click={() => toggleOperator(rootGroup)}
          aria-label="Toggle between AND and OR operators"
          title="Click to switch between AND/OR"
          type="button"
        >
          {rootGroup.operator}
        </button>
        <button 
          class="btn-add" 
          on:click={() => openAddFilterMenu(rootGroup)}
          aria-label="Add a new filter"
          type="button"
        >
          + Add Filter
        </button>
        <button 
          class="btn-add-group" 
          on:click={() => addGroup(rootGroup)}
          aria-label="Add a nested filter group"
          type="button"
        >
          + Add Group
        </button>
      </div>

      <div
        class="group-content"
        on:dragover={handleDragOver}
        on:drop={(e) => handleDrop(e, rootGroup)}
        role="group"
        aria-label="Filter conditions"
      >
        {#if rootGroup.filters.length === 0}
          <div class="empty-builder" role="status" aria-live="polite">
            <p>Drag filters here or click "+ Add Filter"</p>
            <p class="hint">Build complex queries with AND/OR logic</p>
          </div>
        {:else}
          {#each rootGroup.filters as item (item.id)}
            {#if "operator" in item}
              <!-- Nested Group -->
              <div class="query-group nested-group">
                <div class="group-header">
                  <button
                    class="operator-toggle {item.operator.toLowerCase()}"
                    on:click={() => toggleOperator(item)}
                    type="button"
                    aria-label="Toggle group operator"
                  >
                    {item.operator}
                  </button>
                  <button 
                    class="btn-add-small" 
                    on:click={() => openAddFilterMenu(item)}
                    type="button"
                    aria-label="Add filter to group"
                  >
                    + Filter
                  </button>
                  <button 
                    class="btn-remove-group" 
                    on:click={() => removeGroup(rootGroup, item.id)}
                    type="button"
                    aria-label="Remove this group"
                  >
                    ✕
                  </button>
                </div>
                <div
                  class="group-content"
                  on:dragover={handleDragOver}
                  on:drop={(e) => handleDrop(e, item)}
                  role="group"
                  aria-label="Nested filter group"
                >
                  {#each item.filters as filter}
                    {#if !("operator" in filter)}
                      <div class="filter-block">
                        <span class="filter-icon">
                          {filterTemplates.find(t => t.type === filter.type)?.icon || "📌"}
                        </span>
                        <select
                          class="filter-operator"
                          value={filter.operator}
                          on:change={(e) => updateFilterOperator(filter, e.currentTarget.value as any)}
                        >
                          <option value="equals">equals</option>
                          <option value="contains">contains</option>
                          {#if filter.type === "date"}
                            <option value="before">before</option>
                            <option value="after">after</option>
                          {/if}
                          <option value="not">NOT</option>
                        </select>
                        <input
                          type="text"
                          class="filter-value"
                          value={filter.value}
                          on:input={(e) => updateFilterValue(filter, e.currentTarget.value)}
                          placeholder={filterTemplates.find(t => t.type === filter.type)?.placeholder}
                        />
                        <button class="btn-remove-filter" on:click={() => removeFilter(item, filter.id)}>
                          ✕
                        </button>
                      </div>
                    {/if}
                  {/each}
                </div>
              </div>
            {:else}
              <!-- Filter Block -->
              <div class="filter-block">
                <span class="filter-icon">
                  {filterTemplates.find(t => t.type === item.type)?.icon || "📌"}
                </span>
                <select
                  class="filter-operator"
                  value={item.operator}
                  on:change={(e) => updateFilterOperator(item, e.currentTarget.value as any)}
                >
                  <option value="equals">equals</option>
                  <option value="contains">contains</option>
                  {#if item.type === "date"}
                    <option value="before">before</option>
                    <option value="after">after</option>
                  {/if}
                  <option value="not">NOT</option>
                </select>
                <input
                  type="text"
                  class="filter-value"
                  value={item.value}
                  on:input={(e) => updateFilterValue(item, e.currentTarget.value)}
                  placeholder={filterTemplates.find(t => t.type === item.type)?.placeholder}
                />
                <button class="btn-remove-filter" on:click={() => removeFilter(rootGroup, item.id)}>
                  ✕
                </button>
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    </div>
  </div>

  <!-- Generated Query -->
  <div class="query-output" aria-live="polite" aria-atomic="true">
    <h4 id="query-output-title">Generated Query</h4>
    <div 
      class="query-string" 
      role="status"
      aria-labelledby="query-output-title"
    >
      {#if queryString}
        <code>{queryString}</code>
      {:else}
        <span class="placeholder">Build a query to see the result...</span>
      {/if}
    </div>
  </div>
</div>

<!-- Add Filter Menu -->
{#if showAddFilterMenu}
  <div 
    class="modal-overlay" 
    on:click={() => (showAddFilterMenu = false)}
    role="presentation"
  >
    <div 
      class="modal"
      on:click|stopPropagation
      on:keydown={(e) => {
        if (e.key === 'Escape') {
          showAddFilterMenu = false;
        }
      }}
      role="dialog"
      aria-labelledby="filter-menu-title"
      aria-modal="true"
      tabindex="-1"
    >
      <h3 id="filter-menu-title">Add Filter</h3>
      <div class="filter-menu-grid">
        {#each filterTemplates as template}
          <button 
            class="filter-menu-item" 
            on:click={() => selectFilter(template.type)}
            aria-label={`Add ${template.label}`}
            type="button"
          >
            <span class="filter-menu-icon" aria-hidden="true">{template.icon}</span>
            <span class="filter-menu-label">{template.label}</span>
          </button>
        {/each}
      </div>
      <button 
        class="btn-secondary mt-2" 
        on:click={() => (showAddFilterMenu = false)}
        type="button"
      >
        Cancel
      </button>
    </div>
  </div>
{/if}

<style>
  .visual-query-builder {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  .builder-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .builder-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* Filter Palette */
  .filter-palette {
    background: var(--background-primary);
    border-radius: 8px;
    padding: 1rem;
  }

  .filter-palette h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .palette-items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.5rem;
  }

  .palette-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--background-secondary);
    border: 2px dashed var(--background-modifier-border);
    border-radius: 6px;
    cursor: grab;
    transition: all 0.2s ease;
  }

  .palette-item:active {
    cursor: grabbing;
  }

  .palette-item:hover {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .palette-icon {
    font-size: 1.2rem;
  }

  .palette-label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  /* Builder Area */
  .builder-area {
    background: var(--background-primary);
    border-radius: 8px;
    padding: 1rem;
    min-height: 300px;
  }

  .query-group {
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 0.75rem;
  }

  .root-group {
    border-color: var(--interactive-accent);
  }

  .nested-group {
    margin-top: 0.75rem;
    background: var(--background-secondary);
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .operator-toggle {
    padding: 0.25rem 0.75rem;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }

  .operator-toggle.and {
    background: #3b82f6;
    color: white;
  }

  .operator-toggle.or {
    background: #f59e0b;
    color: white;
  }

  .operator-toggle:hover {
    opacity: 0.8;
  }

  .btn-add,
  .btn-add-group,
  .btn-add-small {
    padding: 0.25rem 0.5rem;
    background: var(--background-modifier-border);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .btn-add:hover,
  .btn-add-group:hover,
  .btn-add-small:hover {
    background: var(--background-modifier-hover);
  }

  .btn-remove-group {
    margin-left: auto;
    padding: 0.25rem 0.5rem;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .btn-remove-group:hover {
    background: #dc2626;
  }

  .group-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 50px;
  }

  .empty-builder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    border: 2px dashed var(--background-modifier-border);
    border-radius: 8px;
    color: var(--text-muted);
    text-align: center;
  }

  .empty-builder p {
    margin: 0.25rem 0;
  }

  .hint {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  /* Filter Block */
  .filter-block {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }

  .filter-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .filter-operator {
    padding: 0.25rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text-normal);
    font-size: 0.875rem;
  }

  .filter-value {
    flex: 1;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  .btn-remove-filter {
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 4px;
    width: 24px;
    height: 24px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .btn-remove-filter:hover {
    background: #dc2626;
  }

  /* Query Output */
  .query-output {
    background: var(--background-primary);
    border-radius: 8px;
    padding: 1rem;
  }

  .query-output h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .query-string {
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    font-family: monospace;
    font-size: 0.9rem;
    min-height: 60px;
    display: flex;
    align-items: center;
  }

  .query-string code {
    color: var(--text-accent);
  }

  .placeholder {
    color: var(--text-muted);
    font-style: italic;
  }

  /* Filter Menu Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--background-primary);
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 600px;
    width: 90%;
  }

  .modal h3 {
    margin: 0 0 1rem 0;
  }

  .filter-menu-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .filter-menu-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-menu-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .filter-menu-icon {
    font-size: 2rem;
  }

  .filter-menu-label {
    font-size: 0.875rem;
    font-weight: 500;
    text-align: center;
  }

  .btn-secondary {
    padding: 0.5rem 1rem;
    background: var(--background-modifier-border);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    background: var(--background-modifier-hover);
  }

  .mt-2 {
    margin-top: 0.5rem;
  }
</style>
