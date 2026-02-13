<script lang="ts">
  /**
   * Saved Queries Dropdown Component
   * 
   * Manages saved queries with folders, tags, and usage tracking.
   * Provides UI for CRUD operations on saved queries.
   * 
   * Phase 1: Query Enhancement
   * 
   * @module SavedQueriesDropdown
   */

  import { onMount } from "svelte";
  import { SavedQueryStore, type SavedQuery, type SavedQueryFolder } from "@backend/core/query/SavedQueryStore";

  // Props
  export let onQuerySelected: (query: SavedQuery) => void;
  export let currentQueryString = "";

  // State
  let savedQueries: SavedQuery[] = [];
  let folders: SavedQueryFolder[] = [];
  let isOpen = false;
  let showSaveDialog = false;
  let showEditDialog = false;
  let searchTerm = "";
  let selectedFolder: string | null = null;
  let selectedQuery: SavedQuery | null = null;

  // Save/Edit dialog fields
  let queryName = "";
  let queryDescription = "";
  let queryTags: string = "";
  let queryFolder: string | null = null;
  let pinQuery = false;

  // Filtered queries
  $: filteredQueries = savedQueries
    .filter(q => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          q.name.toLowerCase().includes(term) ||
          q.description?.toLowerCase().includes(term) ||
          q.tags?.some(t => t.toLowerCase().includes(term))
        );
      }
      // Folder filter
      if (selectedFolder) {
        return q.folder === selectedFolder;
      }
      return true;
    })
    .sort((a, b) => {
      // Pinned first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Then by use count
      return (b.useCount || 0) - (a.useCount || 0);
    });

  // Stats
  $: stats = SavedQueryStore.getStats();

  onMount(() => {
    loadQueries();
  });

  function loadQueries() {
    savedQueries = SavedQueryStore.load();
    folders = SavedQueryStore.getFolders();
  }

  function handleSelectQuery(query: SavedQuery) {
    // Update use tracking
    SavedQueryStore.update(query.id, {
      useCount: (query.useCount || 0) + 1,
      lastUsedAt: new Date().toISOString()
    });
    onQuerySelected(query);
    isOpen = false;
    loadQueries(); // Refresh to show updated use count
  }

  function handleSaveCurrentQuery() {
    if (!currentQueryString.trim()) {
      alert("No query to save. Please enter a query first.");
      return;
    }
    showSaveDialog = true;
    queryName = "";
    queryDescription = "";
    queryTags = "";
    queryFolder = null;
    pinQuery = false;
  }

  function confirmSaveQuery() {
    if (!queryName.trim()) {
      alert("Query name is required.");
      return;
    }

    const newQuery: SavedQuery = {
      id: crypto.randomUUID(),
      name: queryName.trim(),
      queryString: currentQueryString,
      description: queryDescription.trim() || undefined,
      tags: queryTags ? queryTags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      folder: queryFolder || undefined,
      useCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: pinQuery
    };

    SavedQueryStore.save(newQuery);
    loadQueries();
    showSaveDialog = false;
  }

  function handleEditQuery(query: SavedQuery) {
    selectedQuery = query;
    queryName = query.name;
    queryDescription = query.description || "";
    queryTags = query.tags?.join(', ') || "";
    queryFolder = query.folder || null;
    pinQuery = query.pinned || false;
    showEditDialog = true;
  }

  function confirmEditQuery() {
    if (!selectedQuery || !queryName.trim()) return;

    SavedQueryStore.update(selectedQuery.id, {
      name: queryName.trim(),
      description: queryDescription.trim() || undefined,
      tags: queryTags ? queryTags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      folder: queryFolder || undefined,
      pinned: pinQuery,
      updatedAt: new Date().toISOString()
    });

    loadQueries();
    showEditDialog = false;
    selectedQuery = null;
  }

  function handleDeleteQuery(queryId: string, event: Event) {
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this saved query?")) {
      SavedQueryStore.delete(queryId);
      loadQueries();
    }
  }

  function handleTogglePin(query: SavedQuery, event: Event) {
    event.stopPropagation();
    SavedQueryStore.update(query.id, {
      pinned: !query.pinned
    });
    loadQueries();
  }

  function handleExportQueries() {
    const json = SavedQueryStore.export();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saved-queries-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportQueries(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const text = await file.text();
    const count = SavedQueryStore.import(text, false);
    alert(`Imported ${count} queries successfully!`);
    loadQueries();
    input.value = ''; // Reset input
  }
</script>

<div class="saved-queries-dropdown">
  <div class="dropdown-header">
    <button class="dropdown-toggle" on:click={() => (isOpen = !isOpen)}>
      📚 Saved Queries ({savedQueries.length})
      <span class="caret" class:open={isOpen}>▼</span>
    </button>
    <button class="btn-save" on:click={handleSaveCurrentQuery} title="Save current query">
      💾 Save Query
    </button>
  </div>

  {#if isOpen}
    <div class="dropdown-menu">
      <!-- Search & Filters -->
      <div class="dropdown-controls">
        <input
          type="text"
          class="search-input"
          placeholder="🔍 Search queries..."
          bind:value={searchTerm}
        />
        <select class="folder-filter" bind:value={selectedFolder}>
          <option value={null}>All Folders</option>
          {#each folders as folder}
            <option value={folder.id}>{folder.icon || '📁'} {folder.name}</option>
          {/each}
        </select>
      </div>

      <!-- Stats -->
      <div class="stats-bar">
        <span class="stat">{stats.totalQueries} queries</span>
        <span class="stat">{stats.totalUses} total uses</span>
        <span class="stat">Avg: {stats.averageUsesPerQuery.toFixed(1)} uses/query</span>
      </div>

      <!-- Query List -->
      <div class="query-list">
        {#if filteredQueries.length === 0}
          <div class="empty-state">
            {#if searchTerm}
              No queries match "{searchTerm}"
            {:else if selectedFolder}
              No queries in this folder
            {:else}
              No saved queries yet
            {/if}
          </div>
        {:else}
          {#each filteredQueries as query}
            <div
              class="query-item"
              class:pinned={query.pinned}
              role="button"
              tabindex="0"
              on:click={() => handleSelectQuery(query)}
              on:keydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectQuery(query);
                }
              }}
              aria-label="Select query {query.name}"
            >
              <div class="query-info">
                <div class="query-name">
                  {#if query.pinned}📌{/if}
                  {query.name}
                  {#if query.folder}
                    <span class="query-folder-badge">
                      {folders.find(f => f.id === query.folder)?.name || 'Folder'}
                    </span>
                  {/if}
                </div>
                {#if query.description}
                  <div class="query-description">{query.description}</div>
                {/if}
                <div class="query-meta">
                  <span class="meta-item">Used {query.useCount || 0} times</span>
                  {#if query.lastUsedAt}
                    <span class="meta-item">Last: {new Date(query.lastUsedAt).toLocaleDateString()}</span>
                  {/if}
                  {#if query.tags && query.tags.length > 0}
                    <span class="meta-item">
                      {#each query.tags as tag}
                        <span class="tag">#{tag}</span>
                      {/each}
                    </span>
                  {/if}
                </div>
              </div>
              <div class="query-actions">
                <button
                  class="action-btn"
                  on:click={(e) => handleTogglePin(query, e)}
                  title={query.pinned ? "Unpin" : "Pin"}
                >
                  {query.pinned ? "📌" : "📍"}
                </button>
                <button
                  class="action-btn"
                  on:click={(e) => { e.stopPropagation(); handleEditQuery(query); }}
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  class="action-btn danger"
                  on:click={(e) => handleDeleteQuery(query.id, e)}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer Actions -->
      <div class="dropdown-footer">
        <button class="btn-secondary" on:click={handleExportQueries}>
          📤 Export
        </button>
        <label class="btn-secondary">
          📥 Import
          <input
            type="file"
            accept=".json"
            on:change={handleImportQueries}
            style="display: none;"
          />
        </label>
      </div>
    </div>
  {/if}

  <!-- Save Dialog -->
  {#if showSaveDialog}
    <div class="modal-overlay" on:click={() => (showSaveDialog = false)} role="presentation">
      <div 
        class="modal-dialog" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="save-dialog-title" 
        tabindex="-1"
        on:click={(e) => e.stopPropagation()}
        on:keydown={(e) => e.stopPropagation()}
      >
        <h3 id="save-dialog-title">💾 Save Query</h3>
        <label class="modal-field">
          <span>Name *</span>
          <input type="text" bind:value={queryName} placeholder="My urgent tasks" />
        </label>
        <label class="modal-field">
          <span>Description</span>
          <textarea bind:value={queryDescription} placeholder="Optional description" rows="2"></textarea>
        </label>
        <label class="modal-field">
          <span>Tags (comma-separated)</span>
          <input type="text" bind:value={queryTags} placeholder="work, urgent, weekly" />
        </label>
        <label class="modal-field">
          <span>Folder</span>
          <select bind:value={queryFolder}>
            <option value={null}>No folder</option>
            {#each folders as folder}
              <option value={folder.id}>{folder.name}</option>
            {/each}
          </select>
        </label>
        <label class="modal-checkbox">
          <input type="checkbox" bind:checked={pinQuery} />
          <span>Pin to top</span>
        </label>
        <div class="modal-actions">
          <button class="btn-primary" on:click={confirmSaveQuery}>Save</button>
          <button class="btn-secondary" on:click={() => (showSaveDialog = false)}>Cancel</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Edit Dialog -->
  {#if showEditDialog && selectedQuery}
    <div class="modal-overlay" on:click={() => (showEditDialog = false)} role="presentation">
      <div 
        class="modal-dialog" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="edit-dialog-title" 
        tabindex="-1"
        on:click={(e) => e.stopPropagation()}
        on:keydown={(e) => e.stopPropagation()}
      >
        <h3 id="edit-dialog-title">✏️ Edit Query</h3>
        <label class="modal-field">
          <span>Name *</span>
          <input type="text" bind:value={queryName} />
        </label>
        <label class="modal-field">
          <span>Description</span>
          <textarea bind:value={queryDescription} rows="2"></textarea>
        </label>
        <label class="modal-field">
          <span>Tags (comma-separated)</span>
          <input type="text" bind:value={queryTags} />
        </label>
        <label class="modal-field">
          <span>Folder</span>
          <select bind:value={queryFolder}>
            <option value={null}>No folder</option>
            {#each folders as folder}
              <option value={folder.id}>{folder.name}</option>
            {/each}
          </select>
        </label>
        <label class="modal-checkbox">
          <input type="checkbox" bind:checked={pinQuery} />
          <span>Pin to top</span>
        </label>
        <div class="modal-actions">
          <button class="btn-primary" on:click={confirmEditQuery}>Update</button>
          <button class="btn-secondary" on:click={() => (showEditDialog = false)}>Cancel</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .saved-queries-dropdown {
    position: relative;
    margin-bottom: 12px;
  }

  .dropdown-header {
    display: flex;
    gap: 8px;
  }

  .dropdown-toggle {
    flex: 1;
    padding: 10px 16px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.2s;
  }

  .dropdown-toggle:hover {
    background: var(--b3-theme-surface-light);
  }

  .caret {
    transition: transform 0.2s;
  }

  .caret.open {
    transform: rotate(180deg);
  }

  .btn-save {
    padding: 10px 16px;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: opacity 0.2s;
  }

  .btn-save:hover {
    opacity: 0.9;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-height: 500px;
    display: flex;
    flex-direction: column;
  }

  .dropdown-controls {
    padding: 12px;
    border-bottom: 1px solid var(--b3-border-color);
    display: flex;
    gap: 8px;
  }

  .search-input,
  .folder-filter {
    flex: 1;
    padding: 8px 12px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    font-size: 13px;
    color: var(--b3-theme-on-surface);
  }

  .stats-bar {
    display: flex;
    justify-content: space-around;
    padding: 8px 12px;
    background: var(--b3-theme-surface);
    border-bottom: 1px solid var(--b3-border-color);
    font-size: 12px;
    color: var(--b3-theme-on-surface-variant);
  }

  .query-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .empty-state {
    padding: 32px;
    text-align: center;
    color: var(--b3-theme-on-surface-variant);
  }

  .query-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    margin-bottom: 4px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .query-item:hover {
    background: var(--b3-theme-surface-light);
    border-color: var(--b3-theme-primary);
  }

  .query-item.pinned {
    border-left: 3px solid var(--b3-theme-primary);
  }

  .query-info {
    flex: 1;
  }

  .query-name {
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .query-folder-badge {
    display: inline-block;
    padding: 2px 6px;
    background: var(--b3-theme-primary-light, #e3f2fd);
    color: var(--b3-theme-primary);
    border-radius: 4px;
    font-size: 11px;
    font-weight: normal;
  }

  .query-description {
    font-size: 12px;
    color: var(--b3-theme-on-surface-variant);
    margin-bottom: 4px;
  }

  .query-meta {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: var(--b3-theme-on-surface-variant);
  }

  .tag {
    display: inline-block;
    padding: 2px 6px;
    background: var(--b3-theme-surface-dark, #f5f5f5);
    border-radius: 3px;
    margin-right: 4px;
  }

  .query-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .query-item:hover .query-actions {
    opacity: 1;
  }

  .action-btn {
    padding: 4px 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .action-btn:hover {
    background: var(--b3-theme-surface);
  }

  .action-btn.danger:hover {
    background: var(--b3-theme-error-light, #ffebee);
  }

  .dropdown-footer {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid var(--b3-border-color);
  }

  .btn-secondary {
    flex: 1;
    padding: 8px 12px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--b3-theme-on-surface);
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: var(--b3-theme-surface-light);
  }

  /* Modal Styles */
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
    z-index: 2000;
  }

  .modal-dialog {
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .modal-dialog h3 {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .modal-field {
    display: block;
    margin-bottom: 16px;
  }

  .modal-field span {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .modal-field input,
  .modal-field textarea,
  .modal-field select {
    width: 100%;
    padding: 8px 12px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
    font-family: inherit;
  }

  .modal-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    cursor: pointer;
  }

  .modal-checkbox input {
    width: auto;
  }

  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn-primary {
    padding: 10px 20px;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: opacity 0.2s;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }
</style>
