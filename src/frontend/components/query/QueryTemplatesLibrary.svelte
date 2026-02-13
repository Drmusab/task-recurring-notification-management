<script lang="ts">
  /**
   * Query Templates Library Component
   * 
   * Provides pre-built query templates for common use cases:
   * - Task management templates (today's tasks, overdue, etc.)
   * - Project management templates
   * - Personal productivity templates
   * - Custom user templates
   * - Template categories and filtering
   * 
   * Phase 3: Advanced Query Features
   * 
   * @module QueryTemplatesLibrary
   */

  import { SavedQueryStore, type SavedQuery } from "@backend/core/query/SavedQueryStore";

  // Props
  export let onTemplateSelect: (query: SavedQuery) => void = () => {};
  export let onTemplateApply: (queryString: string) => void = () => {};

  // Template categories
  type TemplateCategory = "tasks" | "productivity" | "projects" | "custom";

  interface QueryTemplate {
    id: string;
    name: string;
    description: string;
    queryString: string;
    category: TemplateCategory;
    icon: string;
    tags: string[];
  }

  // Built-in templates
  const builtInTemplates: QueryTemplate[] = [
    {
      id: "template-today",
      name: "Today's Tasks",
      description: "All tasks due today",
      queryString: "due:today",
      category: "tasks",
      icon: "📅",
      tags: ["daily", "schedule"]
    },
    {
      id: "template-overdue",
      name: "Overdue Tasks",
      description: "Tasks that are past their due date",
      queryString: "due before today AND status:pending",
      category: "tasks",
      icon: "⚠️",
      tags: ["urgent", "critical"]
    },
    {
      id: "template-this-week",
      name: "This Week",
      description: "Tasks due within the next 7 days",
      queryString: "due after today AND due before +7d",
      category: "tasks",
      icon: "📆",
      tags: ["weekly", "planning"]
    },
    {
      id: "template-high-priority",
      name: "High Priority",
      description: "All high-priority tasks",
      queryString: "priority:high",
      category: "tasks",
      icon: "⚡",
      tags: ["priority", "urgent"]
    },
    {
      id: "template-no-due-date",
      name: "No Due Date",
      description: "Tasks without a due date",
      queryString: "NOT has:due",
      category: "tasks",
      icon: "📝",
      tags: ["backlog"]
    },
    {
      id: "template-recurring",
      name: "Recurring Tasks",
      description: "All recurring tasks",
      queryString: "recurrence:*",
      category: "tasks",
      icon: "🔄",
      tags: ["recurring", "habits"]
    },
    {
      id: "template-work",
      name: "Work Tasks",
      description: "All work-related tasks",
      queryString: "tag:work",
      category: "projects",
      icon: "💼",
      tags: ["work", "professional"]
    },
    {
      id: "template-personal",
      name: "Personal Tasks",
      description: "Personal and home tasks",
      queryString: "tag:personal",
      category: "projects",
      icon: "🏠",
      tags: ["personal", "home"]
    },
    {
      id: "template-completed-today",
      name: "Completed Today",
      description: "Tasks marked done today",
      queryString: "status:done AND completed:today",
      category: "productivity",
      icon: "✅",
      tags: ["achievement", "tracking"]
    },
    {
      id: "template-in-progress",
      name: "In Progress",
      description: "Tasks currently being worked on",
      queryString: "status:in-progress",
      category: "productivity",
      icon: "🚧",
      tags: ["active", "wip"]
    },
    {
      id: "template-waiting",
      name: "Waiting For",
      description: "Tasks waiting on others",
      queryString: "status:waiting",
      category: "productivity",
      icon: "⏳",
      tags: ["blocked", "waiting"]
    },
    {
      id: "template-someday",
      name: "Someday/Maybe",
      description: "Ideas and future tasks",
      queryString: "tag:someday OR tag:maybe",
      category: "productivity",
      icon: "💭",
      tags: ["ideas", "future"]
    }
  ];

  // State
  let selectedCategory: TemplateCategory | "all" = "all";
  let searchTerm = "";
  let customTemplates: QueryTemplate[] = [];
  let showCreateDialog = false;
  let templateName = "";
  let templateDescription = "";
  let templateQuery = "";
  let templateCategory: TemplateCategory = "custom";
  let templateIcon = "📌";

  const categories: { id: TemplateCategory | "all"; label: string; icon: string }[] = [
    { id: "all", label: "All Templates", icon: "📚" },
    { id: "tasks", label: "Task Management", icon: "📋" },
    { id: "productivity", label: "Productivity", icon: "🎯" },
    { id: "projects", label: "Projects", icon: "📁" },
    { id: "custom", label: "Custom", icon: "⭐" }
  ];

  const availableIcons = ["📌", "🎯", "⭐", "💡", "🔥", "🚀", "✨", "🎨", "💻", "📊"];

  // Computed
  $: allTemplates = [...builtInTemplates, ...customTemplates];
  
  $: filteredTemplates = allTemplates
    .filter(t => selectedCategory === "all" || t.category === selectedCategory)
    .filter(t => 
      !searchTerm || 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  function handleApplyTemplate(template: QueryTemplate) {
    onTemplateApply(template.queryString);
  }

  function handleSaveAsQuery(template: QueryTemplate) {
    const newQuery: SavedQuery = {
      id: SavedQueryStore.generateId(),
      name: template.name,
      description: template.description,
      queryString: template.queryString,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: template.tags,
      useCount: 0,
    };

    SavedQueryStore.save(newQuery);
    onTemplateSelect(newQuery);
  }

  function openCreateDialog() {
    showCreateDialog = true;
    templateName = "";
    templateDescription = "";
    templateQuery = "";
    templateCategory = "custom";
    templateIcon = "📌";
  }

  function confirmCreateTemplate() {
    if (!templateName.trim() || !templateQuery.trim()) {
      alert("Template name and query are required");
      return;
    }

    const newTemplate: QueryTemplate = {
      id: `custom-${Date.now()}`,
      name: templateName.trim(),
      description: templateDescription.trim(),
      queryString: templateQuery.trim(),
      category: templateCategory,
      icon: templateIcon,
      tags: []
    };

    customTemplates = [...customTemplates, newTemplate];
    saveCustomTemplates();
    showCreateDialog = false;
  }

  function deleteCustomTemplate(templateId: string) {
    const confirm = window.confirm("Delete this custom template?");
    if (!confirm) return;

    customTemplates = customTemplates.filter(t => t.id !== templateId);
    saveCustomTemplates();
  }

  function saveCustomTemplates() {
    localStorage.setItem("custom-query-templates", JSON.stringify(customTemplates));
  }

  function loadCustomTemplates() {
    try {
      const stored = localStorage.getItem("custom-query-templates");
      if (stored) {
        customTemplates = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load custom templates", error);
    }
  }

  // Initialize
  loadCustomTemplates();
</script>

<div class="templates-library">
  <div class="library-header">
    <h3>📚 Query Templates</h3>
    <button class="btn-create" on:click={openCreateDialog}>
      + Create Template
    </button>
  </div>

  <!--Search and Filters -->
  <div class="library-controls">
    <input
      type="text"
      class="search-input"
      bind:value={searchTerm}
      placeholder="Search templates..."
    />
    
    <div class="category-tabs">
      {#each categories as category}
        <button
          class="category-tab {selectedCategory === category.id ? 'active' : ''}"
          on:click={() => (selectedCategory = category.id)}
        >
          <span class="category-icon">{category.icon}</span>
          <span class="category-label">{category.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Templates Grid -->
  <div class="templates-grid">
    {#each filteredTemplates as template (template.id)}
      <div class="template-card">
        <div class="template-header">
          <span class="template-icon">{template.icon}</span>
          <h4 class="template-name">{template.name}</h4>
          {#if template.category === "custom"}
            <button
              class="btn-delete-template"
              on:click={() => deleteCustomTemplate(template.id)}
              title="Delete template"
            >
              🗑️
            </button>
          {/if}
        </div>
        
        <p class="template-description">{template.description}</p>
        
        <div class="template-query">
          <code>{template.queryString}</code>
        </div>

        {#if template.tags.length > 0}
          <div class="template-tags">
            {#each template.tags as tag}
              <span class="template-tag">{tag}</span>
            {/each}
          </div>
        {/if}

        <div class="template-actions">
          <button
            class="btn-primary"
            on:click={() => handleApplyTemplate(template)}
            title="Apply this template to search"
          >
            🔍 Apply
          </button>
          <button
            class="btn-secondary"
            on:click={() => handleSaveAsQuery(template)}
            title="Save as a new query"
          >
            💾 Save
          </button>
        </div>
      </div>
    {/each}

    {#if filteredTemplates.length === 0}
      <div class="empty-state">
        {#if searchTerm}
          <p>No templates match "{searchTerm}"</p>
        {:else}
          <p>No templates in this category</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Create Template Dialog -->
{#if showCreateDialog}
  <div class="modal-overlay">
    <div class="modal">
      <h3>Create Custom Template</h3>
      
      <div class="form-group">
        <label for="template-name">Template Name</label>
        <input
          id="template-name"
          type="text"
          bind:value={templateName}
          placeholder="e.g., My Weekly Review"
        />
      </div>

      <div class="form-group">
        <label for="template-description">Description</label>
        <textarea
          id="template-description"
          bind:value={templateDescription}
          placeholder="What does this template do?"
          rows="3"
        />
      </div>

      <div class="form-group">
        <label for="template-query">Query String</label>
        <textarea
          id="template-query"
          bind:value={templateQuery}
          placeholder="e.g., due:today AND priority:high"
          rows="3"
          style="font-family: monospace;"
        />
      </div>

      <div class="form-group">
        <label for="template-category">Category</label>
        <select id="template-category" bind:value={templateCategory}>
          <option value="custom">Custom</option>
          <option value="tasks">Task Management</option>
          <option value="productivity">Productivity</option>
          <option value="projects">Projects</option>
        </select>
      </div>

      <div class="form-group">
        <label>Icon</label>
        <div class="icon-grid">
          {#each availableIcons as icon}
            <button
              class="icon-option {templateIcon === icon ? 'selected' : ''}"
              on:click={() => (templateIcon = icon)}
            >
              {icon}
            </button>
          {/each}
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" on:click={() => (showCreateDialog = false)}>
          Cancel
        </button>
        <button class="btn-primary" on:click={confirmCreateTemplate}>
          Create Template
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .templates-library {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 8px;
    max-height: 100%;
    overflow-y: auto;
  }

  .library-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .library-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .btn-create {
    padding: 0.5rem 1rem;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .btn-create:hover {
    background: var(--interactive-accent-hover);
  }

  .library-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .category-tabs {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .category-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .category-tab:hover {
    background: var(--background-modifier-hover);
  }

  .category-tab.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .category-icon {
    font-size: 1.1rem;
  }

  .category-label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .template-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .template-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--interactive-accent);
  }

  .template-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .template-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .template-name {
    flex: 1;
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .btn-delete-template {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .btn-delete-template:hover {
    background: var(--background-modifier-hover);
  }

  .template-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .template-query {
    padding: 0.75rem;
    background: var(--background-secondary);
    border-radius: 4px;
    border-left: 3px solid var(--interactive-accent);
  }

  .template-query code {
    font-size: 0.875rem;
    color: var(--text-accent);
    word-break: break-word;
  }

  .template-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .template-tag {
    padding: 0.125rem 0.5rem;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    font-size: 0.75rem;
    border-radius: 12px;
    font-weight: 500;
  }

  .template-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: auto;
  }

  .btn-primary,
  .btn-secondary {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.875rem;
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

  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted);
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
    max-width: 600px;
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

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .form-group textarea {
    resize: vertical;
  }

  .icon-grid {
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

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }
</style>
