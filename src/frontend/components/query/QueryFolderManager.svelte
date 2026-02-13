<script lang="ts">
  /**
   * Query Folder Manager Component
   * 
   * Provides advanced folder management for saved queries:
   * - Folder tree view with colors and icons
   * - Drag-and-drop query organization
   * - Folder CRUD operations
   * - Hierarchical folder display
   * 
   * Phase 3: Advanced Query Features
   * 
   * @module QueryFolderManager
   */

  import { onMount } from "svelte";
  import { SavedQueryStore, type SavedQuery, type SavedQueryFolder } from "@backend/core/query/SavedQueryStore";

  // Props
  export let onFolderSelect: (folderId: string | null) => void = () => {};
  export let selectedFolderId: string | null = null;

  // State
  let folders: SavedQueryFolder[] = [];
  let queries: SavedQuery[] = [];
  let showCreateDialog = false;
  let showEditDialog = false;
  let editingFolder: SavedQueryFolder | null = null;

  // Dialog fields
  let folderName = "";
  let folderColor = "#3b82f6"; // Default blue
  let folderIcon = "📁";

  // Drag and drop state
  let draggedQueryId: string | null = null;
  let dragOverFolderId: string | null = null;

  // Available icons
  const availableIcons = ["📁", "🏠", "💼", "📊", "⭐", "🎯", "📝", "🔍", "⚙️", "📌"];
  const availableColors = [
    "#3b82f6", // Blue
    "#10b981", // Green
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#84cc16", // Lime
  ];

  // Computed: Query count per folder
  $: queryCounts = folders.reduce((acc, folder) => {
    acc[folder.id] = queries.filter(q => q.folder === folder.id).length;
    return acc;
  }, {} as Record<string, number>);

  $: unfolderedCount = queries.filter(q => !q.folder).length;

  onMount(() => {
    loadData();
  });

  function loadData() {
    folders = SavedQueryStore.getFolders();
    queries = SavedQueryStore.load();
  }

  function handleSelectFolder(folderId: string | null) {
    selectedFolderId = folderId;
    onFolderSelect(folderId);
  }

  function openCreateDialog() {
    showCreateDialog = true;
    folderName = "";
    folderColor = "#3b82f6";
    folderIcon = "📁";
  }

  function openEditDialog(folder: SavedQueryFolder) {
    editingFolder = folder;
    showEditDialog = true;
    folderName = folder.name;
    folderColor = folder.color || "#3b82f6";
    folderIcon = folder.icon || "📁";
  }

  function confirmCreateFolder() {
    if (!folderName.trim()) {
      alert("Folder name is required");
      return;
    }

    const newFolder: SavedQueryFolder = {
      id: `folder-${Date.now()}`,
      name: folderName.trim(),
      color: folderColor,
      icon: folderIcon,
    };

    SavedQueryStore.saveFolder(newFolder);
    loadData();
    showCreateDialog = false;
  }

  function confirmEditFolder() {
    if (!editingFolder || !folderName.trim()) return;

    const updatedFolder: SavedQueryFolder = {
      ...editingFolder,
      name: folderName.trim(),
      color: folderColor,
      icon: folderIcon,
    };

    SavedQueryStore.saveFolder(updatedFolder);
    loadData();
    showEditDialog = false;
    editingFolder = null;
  }

  function handleDeleteFolder(folderId: string) {
    const queriesInFolder = queries.filter(q => q.folder === folderId);
    
    if (queriesInFolder.length > 0) {
      const confirm = window.confirm(
        `This folder contains ${queriesInFolder.length} queries. Delete anyway? (Queries will move to "Unfiled")`
      );
      if (!confirm) return;

      // Move queries to unfiled
      queriesInFolder.forEach(query => {
        SavedQueryStore.save({ ...query, folder: undefined });
      });
    }

    SavedQueryStore.deleteFolder(folderId);
    if (selectedFolderId === folderId) {
      handleSelectFolder(null);
    }
    loadData();
  }

  // Drag and drop handlers
  function handleDragStart(event: DragEvent, queryId: string) {
    draggedQueryId = queryId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  function handleDragOver(event: DragEvent, folderId: string | null) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    dragOverFolderId = folderId;
  }

  function handleDragLeave() {
    dragOverFolderId = null;
  }

  function handleDrop(event: DragEvent, folderId: string | null) {
    event.preventDefault();
    
    if (draggedQueryId) {
      const query = SavedQueryStore.get(draggedQueryId);
      if (query) {
        SavedQueryStore.save({ ...query, folder: folderId || undefined });
        loadData();
      }
    }

    draggedQueryId = null;
    dragOverFolderId = null;
  }
</script>

<div class="folder-manager">
  <div class="folder-header">
    <h3>📂 Query Folders</h3>
    <button class="btn-icon" on:click={openCreateDialog} title="Create folder">
      ➕
    </button>
  </div>

  <div class="folder-list">
    <!-- All Queries (unfiled) -->
    <div
      class="folder-item {selectedFolderId === null ? 'selected' : ''} {dragOverFolderId === null ? 'drag-over' : ''}"
      on:click={() => handleSelectFolder(null)}
      on:dragover={(e) => handleDragOver(e, null)}
      on:dragleave={handleDragLeave}
      on:drop={(e) => handleDrop(e, null)}
      role="button"
      tabindex="0"
    >
      <span class="folder-icon" style="color: #6b7280;">📋</span>
      <span class="folder-name">All Queries</span>
      <span class="query-count">{queries.length}</span>
    </div>

    <!-- Unfiled -->
    {#if unfolderedCount > 0}
      <div
        class="folder-item {selectedFolderId === 'unfiled' ? 'selected' : ''}"
        on:click={() => handleSelectFolder('unfiled')}
        role="button"
        tabindex="0"
      >
        <span class="folder-icon" style="color: #9ca3af;">📄</span>
        <span class="folder-name">Unfiled</span>
        <span class="query-count">{unfolderedCount}</span>
      </div>
    {/if}

    <!-- Folders -->
    {#each folders as folder (folder.id)}
      <div
        class="folder-item {selectedFolderId === folder.id ? 'selected' : ''} {dragOverFolderId === folder.id ? 'drag-over' : ''}"
        on:click={() => handleSelectFolder(folder.id)}
        on:dragover={(e) => handleDragOver(e, folder.id)}
        on:dragleave={handleDragLeave}
        on:drop={(e) => handleDrop(e, folder.id)}
        role="button"
        tabindex="0"
      >
        <span class="folder-icon" style="color: {folder.color || '#3b82f6'};">
          {folder.icon || "📁"}
        </span>
        <span class="folder-name">{folder.name}</span>
        <span class="query-count">{queryCounts[folder.id] || 0}</span>
        
        <div class="folder-actions">
          <button
            class="btn-icon-small"
            on:click|stopPropagation={() => openEditDialog(folder)}
            title="Edit folder"
          >
            ✏️
          </button>
          <button
            class="btn-icon-small"
            on:click|stopPropagation={() => handleDeleteFolder(folder.id)}
            title="Delete folder"
          >
            🗑️
          </button>
        </div>
      </div>
    {/each}

    {#if folders.length === 0}
      <div class="empty-state">
        <p>No folders yet</p>
        <p class="hint">Click ➕ to create your first folder</p>
      </div>
    {/if}
  </div>
</div>

<!-- Create Folder Dialog -->
{#if showCreateDialog}
  <div class="modal-overlay" on:click={() => (showCreateDialog = false)}>
    <div class="modal" on:click|stopPropagation>
      <h3>Create New Folder</h3>
      
      <div class="form-group">
        <label for="folder-name">Folder Name</label>
        <input
          id="folder-name"
          type="text"
          bind:value={folderName}
          placeholder="e.g., Work Queries"
          autofocus
        />
      </div>

      <div class="form-group">
        <label>Icon</label>
        <div class="icon-grid">
          {#each availableIcons as icon}
            <button
              class="icon-option {folderIcon === icon ? 'selected' : ''}"
              on:click={() => (folderIcon = icon)}
            >
              {icon}
            </button>
          {/each}
        </div>
      </div>

      <div class="form-group">
        <label>Color</label>
        <div class="color-grid">
          {#each availableColors as color}
            <button
              class="color-option {folderColor === color ? 'selected' : ''}"
              style="background-color: {color};"
              on:click={() => (folderColor = color)}
              title={color}
            />
          {/each}
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" on:click={() => (showCreateDialog = false)}>
          Cancel
        </button>
        <button class="btn-primary" on:click={confirmCreateFolder}>
          Create
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Folder Dialog -->
{#if showEditDialog && editingFolder}
  <div class="modal-overlay" on:click={() => (showEditDialog = false)}>
    <div class="modal" on:click|stopPropagation>
      <h3>Edit Folder</h3>
      
      <div class="form-group">
        <label for="edit-folder-name">Folder Name</label>
        <input
          id="edit-folder-name"
          type="text"
          bind:value={folderName}
          placeholder="e.g., Work Queries"
        />
      </div>

      <div class="form-group">
        <label>Icon</label>
        <div class="icon-grid">
          {#each availableIcons as icon}
            <button
              class="icon-option {folderIcon === icon ? 'selected' : ''}"
              on:click={() => (folderIcon = icon)}
            >
              {icon}
            </button>
          {/each}
        </div>
      </div>

      <div class="form-group">
        <label>Color</label>
        <div class="color-grid">
          {#each availableColors as color}
            <button
              class="color-option {folderColor === color ? 'selected' : ''}"
              style="background-color: {color};"
              on:click={() => (folderColor = color)}
              title={color}
            ></button>
          {/each}
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" on:click={() => (showEditDialog = false)}>
          Cancel
        </button>
        <button class="btn-primary" on:click={confirmEditFolder}>
          Save
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .folder-manager {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 1rem;
  }

  .folder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .folder-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .folder-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .folder-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .folder-item:hover {
    background: var(--background-modifier-hover);
  }

  .folder-item.selected {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .folder-item.drag-over {
    background: var(--interactive-accent-hover);
    border: 2px dashed var(--interactive-accent);
  }

  .folder-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .folder-name {
    flex: 1;
    font-weight: 500;
  }

  .query-count {
    background: var(--background-modifier-border);
    color: var(--text-muted);
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .folder-item.selected .query-count {
    background: rgba(255, 255, 255, 0.2);
    color: var(--text-on-accent);
  }

  .folder-actions {
    display: none;
    gap: 0.25rem;
  }

  .folder-item:hover .folder-actions {
    display: flex;
  }

  .btn-icon,
  .btn-icon-small {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .btn-icon:hover,
  .btn-icon-small:hover {
    background: var(--background-modifier-hover);
  }

  .btn-icon {
    font-size: 1.2rem;
  }

  .btn-icon-small {
    font-size: 0.9rem;
  }

  .empty-state {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--text-muted);
  }

  .empty-state p {
    margin: 0.5rem 0;
  }

  .hint {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  /* Modal styles */
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
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
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

  .icon-grid,
  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 0.5rem;
  }

  .icon-option {
    aspect-ratio: 1;
    border: 2px solid var(--background-modifier-border);
    background: var(--background-secondary);
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .icon-option:hover {
    background: var(--background-modifier-hover);
  }

  .icon-option.selected {
    border-color: var(--interactive-accent);
    background: var(--interactive-accent);
  }

  .color-option {
    aspect-ratio: 1;
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .color-option:hover {
    transform: scale(1.1);
  }

  .color-option.selected {
    border-color: var(--text-normal);
    border-width: 3px;
    box-shadow: 0 0 0 2px var(--background-primary);
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
