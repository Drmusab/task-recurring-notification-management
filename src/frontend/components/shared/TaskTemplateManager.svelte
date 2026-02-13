<script lang="ts">
  /**
   * Task Template Manager Component
   * 
   * Provides UI for managing task templates (create, edit, delete, apply)
   * Templates allow users to quickly create tasks with pre-filled data
   * 
   * Features:
   * - Template library view
   * - Create/edit template form
   * - Template preview
   * - Apply template to create task
   * - Import/export templates
   * - Template categories
   * 
   * @module TaskTemplateManager
   */

  import { onMount } from "svelte";
  import type { TaskTemplate } from "@shared/utils/task/task-templates";
  import {
    loadTaskTemplates,
    saveTaskTemplate,
    deleteTaskTemplate,
  } from "@shared/utils/task/task-templates";

  export let onApplyTemplate: ((template: TaskTemplate) => void) | undefined = undefined;
  export let onClose: (() => void) | undefined = undefined;

  type ViewMode = "list" | "create" | "edit";

  let templates: TaskTemplate[] = [];
  let viewMode: ViewMode = "list";
  let selectedTemplate: TaskTemplate | null = null;
  let searchQuery: string = "";
  let categoryFilter: string = "all";

  // Form state
  let formName: string = "";
  let formDescription: string = "";
  let formPriority: string = "medium";
  let formTags: string = "";
  let formRecurrence: string = "";
  let formCategory: string = "general";
  let formNotes: string = "";

  $: filteredTemplates = filterTemplates(templates, searchQuery, categoryFilter);
  $: categories = getCategories(templates);

  onMount(async () => {
    await loadTemplatesFromStorage();
  });

  async function loadTemplatesFromStorage() {
    templates = await loadTaskTemplates();
  }

  function filterTemplates(
    allTemplates: TaskTemplate[],
    search: string,
    category: string
  ): TaskTemplate[] {
    let filtered = allTemplates;

    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (category && category !== "all") {
      filtered = filtered.filter((t) => t.category === category);
    }

    return filtered;
  }

  function getCategories(allTemplates: TaskTemplate[]): string[] {
    const cats = new Set<string>();
    allTemplates.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }

  function handleCreateNew() {
    resetForm();
    viewMode = "create";
  }

  function handleEdit(template: TaskTemplate) {
    selectedTemplate = template;
    loadTemplateToForm(template);
    viewMode = "edit";
  }

  function handleDelete(template: TaskTemplate) {
    if (confirm(`Are you sure you want to delete template "${template.name}"?`)) {
      deleteTaskTemplate(template.id);
      templates = templates.filter((t) => t.id !== template.id);
    }
  }

  function handleApply(template: TaskTemplate) {
    if (onApplyTemplate) {
      onApplyTemplate(template);
    }
  }

  function handleSave() {
    const template: TaskTemplate = {
      id: viewMode === "edit" && selectedTemplate ? selectedTemplate.id : generateId(),
      label: formName.trim(),
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      priority: formPriority as "high" | "medium" | "low",
      tags: formTags
        ? formTags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      recurrence: formRecurrence.trim() || undefined,
      category: formCategory || "general",
      notes: formNotes.trim() || undefined,
      createdAt: viewMode === "edit" && selectedTemplate 
        ? selectedTemplate.createdAt 
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Default recurring task fields
      frequencyType: "daily",
      interval: 1,
      time: "09:00",
      weekdays: [],
      dayOfMonth: 1,
      month: 1,
      enabled: true,
    };

    saveTaskTemplate(template);

    if (viewMode === "edit") {
      const index = templates.findIndex((t) => t.id === template.id);
      if (index !== -1) {
        templates[index] = template;
      }
    } else {
      templates = [template, ...templates];
    }

    viewMode = "list";
    resetForm();
  }

  function handleCancel() {
    viewMode = "list";
    resetForm();
  }

  function resetForm() {
    selectedTemplate = null;
    formName = "";
    formDescription = "";
    formPriority = "medium";
    formTags = "";
    formRecurrence = "";
    formCategory = "general";
    formNotes = "";
  }

  function loadTemplateToForm(template: TaskTemplate) {
    formName = template.name;
    formDescription = template.description || "";
    formPriority = template.priority || "medium";
    formTags = template.tags?.join(", ") || "";
    formRecurrence = template.recurrence || "";
    formCategory = template.category || "general";
    formNotes = template.notes || "";
  }

  function generateId(): string {
    return `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function handleExport() {
    const dataStr = JSON.stringify(templates, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `task-templates-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (Array.isArray(imported)) {
          for (const template of imported) {
            await saveTaskTemplate(template);
          }
          await loadTemplatesFromStorage();
        }
      } catch (error) {
        alert("Failed to import templates. Please check the file format.");
      }
    };
    input.click();
  }
</script>

<div class="template-manager" role="dialog" aria-label="Task template manager">
  <div class="template-header">
    <h2>Task Templates</h2>
    {#if onClose}
      <button class="close-btn" on:click={onClose} aria-label="Close" type="button">
        ✕
      </button>
    {/if}
  </div>

  {#if viewMode === "list"}
    <!-- Template Library View -->
    <div class="template-toolbar">
      <div class="search-bar">
        <input
          type="search"
          placeholder="Search templates..."
          bind:value={searchQuery}
          aria-label="Search templates"
        />
      </div>
      
      <select bind:value={categoryFilter} aria-label="Filter by category">
        <option value="all">All Categories</option>
        {#each categories as category}
          <option value={category}>{category}</option>
        {/each}
      </select>

      <div class="toolbar-actions">
        <button class="btn-secondary" on:click={handleImport} type="button">
          📥 Import
        </button>
        <button class="btn-secondary" on:click={handleExport} type="button">
          📤 Export
        </button>
        <button class="btn-primary" on:click={handleCreateNew} type="button">
          ➕ New Template
        </button>
      </div>
    </div>

    <div class="template-list" role="list">
      {#if filteredTemplates.length === 0}
        <div class="empty-state" role="status">
          {#if searchQuery || categoryFilter !== "all"}
            <p>No templates match your filters</p>
          {:else}
            <div class="empty-icon" aria-hidden="true">📝</div>
            <p>No templates yet</p>
            <button class="btn-primary" on:click={handleCreateNew} type="button">
              Create your first template
            </button>
          {/if}
        </div>
      {:else}
        {#each filteredTemplates as template (template.id)}
          <div class="template-card" role="listitem">
            <div class="template-card-header">
              <div class="template-title">
                <h3>{template.name}</h3>
                {#if template.category}
                  <span class="category-badge">{template.category}</span>
                {/if}
              </div>
              <div class="template-actions">
                <button
                  class="icon-btn"
                  on:click={() => handleApply(template)}
                  title="Apply template"
                  aria-label="Apply template {template.name}"
                  type="button"
                >
                  ▶️
                </button>
                <button
                  class="icon-btn"
                  on:click={() => handleEdit(template)}
                  title="Edit template"
                  aria-label="Edit template {template.name}"
                  type="button"
                >
                  ✏️
                </button>
                <button
                  class="icon-btn danger"
                  on:click={() => handleDelete(template)}
                  title="Delete template"
                  aria-label="Delete template {template.name}"
                  type="button"
                >
                  🗑️
                </button>
              </div>
            </div>

            {#if template.description}
              <p class="template-description">{template.description}</p>
            {/if}

            <div class="template-meta">
              {#if template.priority}
                <span class="meta-item priority-{template.priority}">
                  Priority: {template.priority}
                </span>
              {/if}
              {#if template.tags && template.tags.length > 0}
                <span class="meta-item">
                  🏷️ {template.tags.join(", ")}
                </span>
              {/if}
              {#if template.recurrence}
                <span class="meta-item">
                  🔄 {template.recurrence}
                </span>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {:else}
    <!-- Create/Edit Form View -->
    <div class="template-form">
      <h3>{viewMode === "create" ? "Create Template" : "Edit Template"}</h3>

      <form on:submit|preventDefault={handleSave}>
        <div class="form-group">
          <label for="template-name">
            Template Name <span class="required">*</span>
          </label>
          <input
            id="template-name"
            type="text"
            bind:value={formName}
            placeholder="e.g., Daily Standup"
            required
          />
        </div>

        <div class="form-group">
          <label for="template-description">Description</label>
          <textarea
            id="template-description"
            bind:value={formDescription}
            placeholder="Brief description of this template..."
            rows="3"
          ></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="template-priority">Priority</label>
            <select id="template-priority" bind:value={formPriority}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div class="form-group">
            <label for="template-category">Category</label>
            <input
              id="template-category"
              type="text"
              bind:value={formCategory}
              placeholder="e.g., Work, Personal"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="template-tags">
            Tags
            <span class="hint">(comma-separated)</span>
          </label>
          <input
            id="template-tags"
            type="text"
            bind:value={formTags}
            placeholder="e.g., meeting, review, planning"
          />
        </div>

        <div class="form-group">
          <label for="template-recurrence">
            Recurrence Pattern
            <span class="hint">(optional)</span>
          </label>
          <input
            id="template-recurrence"
            type="text"
            bind:value={formRecurrence}
            placeholder="e.g., every Monday, daily at 9am"
          />
        </div>

        <div class="form-group">
          <label for="template-notes">Notes</label>
          <textarea
            id="template-notes"
            bind:value={formNotes}
            placeholder="Additional notes or instructions..."
            rows="4"
          ></textarea>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" on:click={handleCancel}>
            Cancel
          </button>
          <button type="submit" class="btn-primary" disabled={!formName.trim()}>
            {viewMode === "create" ? "Create Template" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>

<style>
  .template-manager {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--b3-theme-surface, white);
    border-radius: 8px;
    overflow: hidden;
  }

  .template-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--b3-theme-surface-lighter, #eee);
    background: var(--b3-theme-surface-light, #f9f9f9);
  }

  .template-header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--b3-theme-on-surface, #333);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 20px;
    color: var(--b3-theme-on-surface, #333);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: var(--b3-theme-surface-lighter, #eee);
  }

  .template-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--b3-theme-surface-lighter, #eee);
    flex-wrap: wrap;
  }

  .search-bar {
    flex: 1;
    min-width: 200px;
  }

  .search-bar input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--b3-theme-surface-lighter, #ddd);
    border-radius: 6px;
    font-size: 14px;
  }

  .toolbar-actions {
    display: flex;
    gap: 8px;
  }

  .template-list {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    color: var(--b3-theme-on-surface-light, #666);
  }

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .template-card {
    background: var(--b3-theme-surface, white);
    border: 1px solid var(--b3-theme-surface-lighter, #ddd);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    transition: all 0.2s;
  }

  .template-card:hover {
    border-color: var(--b3-theme-primary, #4285f4);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .template-card-header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .template-title {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .template-title h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-surface, #333);
  }

  .category-badge {
    padding: 2px 8px;
    background: var(--b3-theme-primary-light, #e8f0fe);
    color: var(--b3-theme-primary, #4285f4);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .template-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.2s;
  }

  .icon-btn:hover {
    background: var(--b3-theme-surface-light, #f0f0f0);
  }

  .icon-btn.danger:hover {
    background: rgba(211, 47, 47, 0.1);
  }

  .template-description {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light, #666);
    line-height: 1.5;
  }

  .template-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .meta-item {
    padding: 4px 8px;
    background: var(--b3-theme-surface-light, #f0f0f0);
    border-radius: 4px;
    font-size: 12px;
    color: var(--b3-theme-on-surface, #333);
  }

  .meta-item.priority-high {
    background: rgba(211, 47, 47, 0.1);
    color: #d32f2f;
  }

  .meta-item.priority-medium {
    background: rgba(255, 152, 0, 0.1);
    color: #ff9800;
  }

  .meta-item.priority-low {
    background: rgba(76, 175, 80, 0.1);
    color: #4caf50;
  }

  .template-form {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .template-form h3 {
    margin: 0 0 24px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface, #333);
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface, #333);
  }

  .required {
    color: var(--b3-theme-error, #d32f2f);
  }

  .hint {
    font-size: 12px;
    font-weight: normal;
    color: var(--b3-theme-on-surface-light, #666);
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--b3-theme-surface-lighter, #ddd);
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
  }

  .form-group textarea {
    resize: vertical;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--b3-theme-surface-lighter, #eee);
  }

  .btn-primary,
  .btn-secondary {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--b3-theme-primary, #4285f4);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--b3-theme-primary-dark, #3367d6);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--b3-theme-surface-light, #f0f0f0);
    color: var(--b3-theme-on-surface, #333);
  }

  .btn-secondary:hover {
    background: var(--b3-theme-surface-lighter, #e0e0e0);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .template-toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-bar {
      min-width: 0;
    }

    .toolbar-actions {
      justify-content: stretch;
    }

    .toolbar-actions button {
      flex: 1;
    }

    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
