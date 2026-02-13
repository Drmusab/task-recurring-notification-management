<script lang="ts">
  /**
   * Query Tag Manager Component
   * 
   * Provides tag management for saved queries:
   * - Tag cloud visualization
   * - Tag-based filtering
   * - Tag autocomplete
   * - Tag creation and deletion
   * - Tag color coding
   * 
   * Phase 3: Advanced Query Features
   * 
   * @module QueryTagManager
   */

  import { onMount } from "svelte";
  import { SavedQueryStore, type SavedQuery } from "@backend/core/query/SavedQueryStore";

  // Props
  export let onTagSelect: (tag: string | null) => void = () => {};
  export let selectedTag: string | null = null;

  // State
  let queries: SavedQuery[] = [];
  let allTags: string[] = [];
  let tagCounts: Record<string, number> = {};
  let searchTerm = "";
  let showRenameDialog = false;
  let renamingTag: string | null = null;
  let newTagName = "";

  // Tag colors (hash-based for consistency)
  const tagColors = [
    "#3b82f6", // Blue
    "#10b981", // Green
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#84cc16", // Lime
    "#f97316", // Orange
    "#14b8a6", // Teal
  ];

  // Computed: Tag statistics
  $: {
    queries = SavedQueryStore.load();
    computeTagStats();
  }

  $: filteredTags = searchTerm
    ? allTags.filter(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    : allTags;

  $: sortedTags = [...filteredTags].sort(
    (a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0)
  );

  $: maxCount = Math.max(...Object.values(tagCounts), 1);
  $: minCount = Math.min(...Object.values(tagCounts).filter(c => c > 0), 1);

  onMount(() => {
    loadData();
  });

  function loadData() {
    queries = SavedQueryStore.load();
    computeTagStats();
  }

  function computeTagStats() {
    const tagSet = new Set<string>();
    const counts: Record<string, number> = {};

    queries.forEach(query => {
      if (query.tags && Array.isArray(query.tags)) {
        query.tags.forEach(tag => {
          tagSet.add(tag);
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });

    allTags = Array.from(tagSet);
    tagCounts = counts;
  }

  function handleSelectTag(tag: string | null) {
    selectedTag = tag;
    onTagSelect(tag);
  }

  function getTagColor(tag: string): string {
    const hash = tag.split("").reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    return tagColors[Math.abs(hash) % tagColors.length] || tagColors[0];
  }

  function getTagSize(tag: string): number {
    const count = tagCounts[tag] || 0;
    const range = maxCount - minCount;
    if (range === 0) return 1;
    
    const normalized = (count - minCount) / range;
    return 0.875 + normalized * 1.125; // 0.875rem to 2rem
  }

  function openRenameDialog(tag: string) {
    renamingTag = tag;
    newTagName = tag;
    showRenameDialog = true;
  }

  function confirmRenameTag() {
    if (!renamingTag || !newTagName.trim()) return;
    if (renamingTag === newTagName.trim()) {
      showRenameDialog = false;
      return;
    }

    // Update all queries with this tag
    queries.forEach(query => {
      if (query.tags && query.tags.includes(renamingTag!)) {
        const updatedTags = query.tags.map(t => 
          t === renamingTag ? newTagName.trim() : t
        );
        SavedQueryStore.save({
          ...query,
          tags: updatedTags
        });
      }
    });

    if (selectedTag === renamingTag) {
      handleSelectTag(newTagName.trim());
    }

    loadData();
    showRenameDialog = false;
    renamingTag = null;
  }

  function handleDeleteTag(tag: string) {
    const confirm = window.confirm(
      `Remove tag "${tag}" from ${tagCounts[tag]} queries?`
    );
    if (!confirm) return;

    // Remove tag from all queries
    queries.forEach(query => {
      if (query.tags && query.tags.includes(tag)) {
        const updatedTags = query.tags.filter(t => t !== tag);
        SavedQueryStore.save({
          ...query,
          tags: updatedTags
        });
      }
    });

    if (selectedTag === tag) {
      handleSelectTag(null);
    }

    loadData();
  }

  function getTagOpacity(tag: string): number {
    const count = tagCounts[tag] || 0;
    const range = maxCount - minCount;
    if (range === 0) return 1;
    
    const normalized = (count - minCount) / range;
    return 0.6 + normalized * 0.4; // 0.6 to 1.0
  }
</script>

<div class="tag-manager">
  <div class="tag-header">
    <h3>🏷️ Query Tags</h3>
    <div class="tag-search">
      <input
        type="text"
        bind:value={searchTerm}
        placeholder="Search tags..."
      />
    </div>
  </div>

  <div class="tag-stats">
    <div class="stat-item">
      <span class="stat-value">{allTags.length}</span>
      <span class="stat-label">Total Tags</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">{Object.values(tagCounts).reduce((a, b) => a + b, 0)}</span>
      <span class="stat-label">Tag Uses</span>
    </div>
  </div>

  <div class="tag-filter-buttons">
    <button
      class="filter-btn {selectedTag === null ? 'active' : ''}"
      on:click={() => handleSelectTag(null)}
    >
      All Tags
    </button>
  </div>

  {#if sortedTags.length > 0}
    <!-- Tag Cloud View -->
    <div class="tag-cloud">
      {#each sortedTags as tag (tag)}
        <div class="tag-cloud-item-wrapper">
          <button
            class="tag-cloud-item {selectedTag === tag ? 'selected' : ''}"
            style="
              font-size: {getTagSize(tag)}rem;
              color: {getTagColor(tag)};
              opacity: {getTagOpacity(tag)};
            "
            on:click={() => handleSelectTag(tag)}
            title="{tag} ({tagCounts[tag]} queries)"
          >
            {tag}
          </button>
          <div class="tag-actions">
            <button
              class="tag-action-btn"
              on:click|stopPropagation={() => openRenameDialog(tag)}
              title="Rename tag"
            >
              ✏️
            </button>
            <button
              class="tag-action-btn"
              on:click|stopPropagation={() => handleDeleteTag(tag)}
              title="Delete tag"
            >
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- Tag List View (Alternative compact view) -->
    <div class="tag-list">
      <h4>Tag List</h4>
      {#each sortedTags as tag (tag)}
        <div class="tag-list-item {selectedTag === tag ? 'selected' : ''}">
          <button
            class="tag-list-button"
            on:click={() => handleSelectTag(tag)}
            style="border-left: 3px solid {getTagColor(tag)};"
          >
            <span class="tag-name">{tag}</span>
            <span class="tag-count">{tagCounts[tag]}</span>
          </button>
          <div class="tag-list-actions">
            <button
              class="btn-icon-small"
              on:click={() => openRenameDialog(tag)}
              title="Rename"
            >
              ✏️
            </button>
            <button
              class="btn-icon-small"
              on:click={() => handleDeleteTag(tag)}
              title="Delete"
            >
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      {#if searchTerm}
        <p>No tags match "{searchTerm}"</p>
      {:else}
        <p>No tags yet</p>
        <p class="hint">Add tags to your saved queries to see them here</p>
      {/if}
    </div>
  {/if}
</div>

<!-- Rename Tag Dialog -->
{#if showRenameDialog && renamingTag}
  <div class="modal-overlay">
    <div class="modal">
      <h3>Rename Tag</h3>
      
      <div class="form-group">
        <label for="new-tag-name">New Tag Name</label>
        <input
          id="new-tag-name"
          type="text"
          bind:value={newTagName}
          placeholder="Enter new tag name"
        />
        <p class="hint-text">
          This will update {tagCounts[renamingTag]} queries
        </p>
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" on:click={() => (showRenameDialog = false)}>
          Cancel
        </button>
        <button class="btn-primary" on:click={confirmRenameTag}>
          Rename
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tag-manager {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 1rem;
    gap: 1rem;
  }

  .tag-header {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .tag-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .tag-search input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .tag-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem;
    background: var(--background-primary);
    border-radius: 6px;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-accent);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tag-filter-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .filter-btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .filter-btn:hover {
    background: var(--background-modifier-hover);
  }

  .filter-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  /* Tag Cloud */
  .tag-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--background-primary);
    border-radius: 8px;
    align-items: center;
    justify-content: center;
    min-height: 200px;
  }

  .tag-cloud-item-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .tag-cloud-item {
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .tag-cloud-item:hover {
    transform: scale(1.1);
    opacity: 1 !important;
  }

  .tag-cloud-item.selected {
    background: var(--background-modifier-hover);
    text-decoration: underline;
    transform: scale(1.15);
  }

  .tag-actions {
    display: none;
    gap: 0.25rem;
    margin-left: 0.5rem;
  }

  .tag-cloud-item-wrapper:hover .tag-actions {
    display: flex;
  }

  .tag-action-btn {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0.125rem 0.25rem;
    transition: all 0.2s ease;
  }

  .tag-action-btn:hover {
    background: var(--background-modifier-hover);
  }

  /* Tag List */
  .tag-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .tag-list h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tag-list-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tag-list-button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .tag-list-button:hover {
    background: var(--background-modifier-hover);
  }

  .tag-list-item.selected .tag-list-button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .tag-name {
    font-weight: 500;
  }

  .tag-count {
    background: var(--background-modifier-border);
    color: var(--text-muted);
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .tag-list-item.selected .tag-count {
    background: rgba(255, 255, 255, 0.2);
    color: var(--text-on-accent);
  }

  .tag-list-actions {
    display: none;
    gap: 0.25rem;
  }

  .tag-list-item:hover .tag-list-actions {
    display: flex;
  }

  .btn-icon-small {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background 0.2s ease;
    font-size: 0.9rem;
  }

  .btn-icon-small:hover {
    background: var(--background-modifier-hover);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted);
  }

  .empty-state p {
    margin: 0.5rem 0;
  }

  .hint {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  /* Modal */
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
    max-width: 400px;
    width: 90%;
  }

  .modal h3 {
    margin: 0 0 1.5rem 0;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .hint-text {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn-primary:hover {
    background: var(--interactive-accent-hover);
  }

  .btn-secondary {
    background: var(--background-modifier-border);
    color: var(--text-normal);
  }

  .btn-secondary:hover {
    background: var(--background-modifier-hover);
  }
</style>
