<script lang="ts">
  /**
   * Advanced Query Dashboard - Phase 3 + Phase 4 Main Component
   * 
   * Integrates Phase 3 Advanced Query Features:
   * - Folder management
   * - Tag management
   * - Statistics dashboard
   * - Visual query builder
   * - Templates library
   * 
   * Integrates Phase 4 Explanation Enhancements:
   * - Explanation diff (before/after comparison)
   * - Suggested fixes (actionable recommendations)
   * - Visual diagrams (Mermaid flowcharts)
   * 
   * @module AdvancedQueryDashboard
   */

  import { onMount } from "svelte";
  import QueryFolderManager from "./QueryFolderManager.svelte";
  import QueryTagManager from "./QueryTagManager.svelte";
  import QueryStatisticsDashboard from "./QueryStatisticsDashboard.svelte";
  import VisualQueryBuilder from "./VisualQueryBuilder.svelte";
  import QueryTemplatesLibrary from "./QueryTemplatesLibrary.svelte";
  
  // Phase 3 Calendar View
  import CalendarView from "../calendar/CalendarView.svelte";
  
  // Phase 4 Analytics Dashboard
  import AnalyticsDashboard from "../analytics/AnalyticsDashboard.svelte";
  import { exportAndDownload } from "@backend/core/analytics/CSVExporter";
  
  // Phase 4 imports
  import ExplanationDiffPanel from "../../../ui/components/query/ExplanationDiffPanel.svelte";
  import SuggestedFixesPanel from "../../../ui/components/query/SuggestedFixesPanel.svelte";
  import ExplanationDiagramView from "../../../ui/components/query/ExplanationDiagramView.svelte";
  
  import type { SavedQuery } from "@backend/core/query/SavedQueryStore";
  import type { Explanation } from "@backend/core/query/QueryExplainer";
  import type { QueryAST } from "@backend/core/query/QueryParser";
  import type { SuggestedFix } from "@backend/core/query/SuggestedFixGenerator";
  import type { Task } from "@backend/core/models/Task";
  import { SuggestedFixGenerator } from "@backend/core/query/SuggestedFixGenerator";

  // Props
  export let onQueryExecute: (queryString: string) => void = () => {};
  export let currentExplanation: Explanation | null = null;
  export let currentQueryAST: QueryAST | null = null;
  export let onTaskUpdate: ((taskId: string, patch: any) => Promise<void>) | null = null;
  export let tasks: Task[] = []; // All tasks for calendar view

  // State
  type ActiveView = "folders" | "tags" | "stats" | "builder" | "templates" | "calendar" | "analytics" | "diff" | "fixes" | "diagram";
  let activeView: ActiveView = "folders";
  let selectedFolderId: string | null = null;
  let selectedTag: string | null = null;
  let currentQuery: string = "";
  let previousExplanation: Explanation | null = null;

  // Track explanation history for diff
  $: {
    if (currentExplanation && currentExplanation !== previousExplanation) {
      // Store previous before updating
      if (previousExplanation !== null) {
        previousExplanation = currentExplanation;
      }
    }
  }

  // View configuration
  const views: { id: ActiveView; label: string; icon: string; phase?: number }[] = [
    { id: "folders", label: "Folders", icon: "📁", phase: 3 },
    { id: "tags", label: "Tags", icon: "🏷️", phase: 3 },
    { id: "stats", label: "Statistics", icon: "📊", phase: 3 },
    { id: "builder", label: "Query Builder", icon: "🎨", phase: 3 },
    { id: "templates", label: "Templates", icon: "📚", phase: 3 },
    { id: "calendar", label: "Calendar", icon: "📅", phase: 3 },
    { id: "analytics", label: "Analytics", icon: "📈", phase: 4 },
    { id: "diff", label: "Changes", icon: "🔄", phase: 4 },
    { id: "fixes", label: "Fixes", icon: "💡", phase: 4 },
    { id: "diagram", label: "Diagram", icon: "📊", phase: 4 }
  ];

  function handleFolderSelect(folderId: string | null) {
    selectedFolderId = folderId;
    // Could trigger a query update based on folder
  }

  function handleTagSelect(tag: string | null) {
    selectedTag = tag;
    if (tag) {
      const query = `tag:${tag}`;
      currentQuery = query;
      onQueryExecute(query);
    }
  }

  function handleQueryChange(queryString: string) {
    currentQuery = queryString;
  }

  function handleTemplateApply(queryString: string) {
    currentQuery = queryString;
    activeView = "builder"; // Switch to builder to show the query
    onQueryExecute(queryString);
  }

  function handleTemplateSelect(query: SavedQuery) {
    currentQuery = query.queryString;
    onQueryExecute(query.queryString);
  }

  async function handleApplyFix(fix: SuggestedFix) {
    if (!onTaskUpdate) {
      console.warn("No task update handler provided");
      return;
    }

    try {
      // Apply the fix patch to the task
      await onTaskUpdate(fix.taskId, fix.patch);
      
      // Re-execute query to see if task now matches
      if (currentQuery) {
        onQueryExecute(currentQuery);
      }
    } catch (error) {
      console.error("Failed to apply fix:", error);
    }
  }

  // Auto-switch to diff view when we have both explanations
  $: {
    if (previousExplanation && currentExplanation && activeView === "diff") {
      // Already on diff view, stay there
    }
  }
</script>

<div class="advanced-query-dashboard">
  <!-- Dashboard Header -->
  <div class="dashboard-header">
    <h2>⚡ Advanced Query Features</h2>
    <p class="dashboard-subtitle">
      Powerful tools for managing and building complex task queries
    </p>
  </div>

  <!-- View Tabs -->
  <div class="view-tabs">
    {#each views as view}
      <button
        class="view-tab {activeView === view.id ? 'active' : ''} {view.phase === 4 ? 'phase-4' : ''}"
        on:click={() => (activeView = view.id)}
        disabled={view.phase === 4 && !currentExplanation}
        title={view.phase === 4 && !currentExplanation ? 'Execute a query first to use Phase 4 features' : ''}
      >
        <span class="view-icon">{view.icon}</span>
        <span class="view-label">{view.label}</span>
        {#if view.phase === 4}
          <span class="phase-badge">P4</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Active View Content -->
  <div class="view-content">
    {#if activeView === "folders"}
      <QueryFolderManager 
        onFolderSelect={handleFolderSelect}
        selectedFolderId={selectedFolderId}
      />
    {:else if activeView === "tags"}
      <QueryTagManager
        onTagSelect={handleTagSelect}
        selectedTag={selectedTag}
      />
    {:else if activeView === "stats"}
      <QueryStatisticsDashboard />
    {:else if activeView === "builder"}
      <VisualQueryBuilder
        onQueryChange={handleQueryChange}
        initialQuery={currentQuery}
      />
    {:else if activeView === "templates"}
      <QueryTemplatesLibrary
        onTemplateApply={handleTemplateApply}
        onTemplateSelect={handleTemplateSelect}
      />
    {:else if activeView === "calendar"}
      <CalendarView
        {tasks}
        onTaskClick={(task) => {
          // Could navigate to task details or show modal
          console.log('Task clicked:', task);
        }}
        onDaySelect={(date) => {
          // Could filter tasks by date
          console.log('Day selected:', date);
        }}
      />
    {:else if activeView === "analytics"}
      <AnalyticsDashboard
        {tasks}
        onExportCSV={() => exportAndDownload(tasks, { includeTasks: true, includeSummary: true, includeCompletionHistory: true })}
      />
    {:else if activeView === "diff"}
      <ExplanationDiffPanel
        beforeExplanation={previousExplanation}
        afterExplanation={currentExplanation}
      />
    {:else if activeView === "fixes"}
      <SuggestedFixesPanel
        taskExplanations={currentExplanation?.taskExplanations || []}
        onApplyFix={handleApplyFix}
      />
    {:else if activeView === "diagram"}
      <ExplanationDiagramView
        query={currentQueryAST}
        explanation={currentExplanation}
      />
    {/if}
  </div>

  <!-- Current Query Display (Always visible) -->
  {#if currentQuery}
    <div class="current-query-banner">
      <div class="banner-label">Active Query:</div>
      <code class="banner-query">{currentQuery}</code>
      <button
        class="btn-execute"
        on:click={() => onQueryExecute(currentQuery)}
        title="Execute query"
      >
        🔍 Execute
      </button>
      <button
        class="btn-clear"
        on:click={() => (currentQuery = "")}
        title="Clear query"
      >
        ✕
      </button>
    </div>
  {/if}
</div>

<style>
  .advanced-query-dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    min-height: 600px;
    background: var(--background-primary);
  }

  .dashboard-header {
    text-align: center;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .dashboard-header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-normal);
  }

  .dashboard-subtitle {
    margin: 0;
    font-size: 0.95rem;
    color: var(--text-muted);
  }

  .view-tabs {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--background-secondary);
    border-radius: 8px;
    overflow-x: auto;
  }

  .view-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .view-tab:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .view-tab.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .view-tab:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .view-tab:disabled:hover {
    background: var(--background-primary);
    border-color: var(--background-modifier-border);
  }

  .view-tab.phase-4 {
    border-color: #FBBF24;
  }

  .view-tab.phase-4.active {
    background: linear-gradient(135deg, var(--interactive-accent) 0%, #FBBF24 100%);
  }

  .view-icon {
    font-size: 1.2rem;
  }

  .view-label {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .phase-badge {
    padding: 0.125rem 0.375rem;
    background: #FBBF24;
    color: #78350F;
    border-radius: 8px;
    font-size: 0.65rem;
    font-weight: 700;
    margin-left: 0.25rem;
  }

  .view-tab.active .phase-badge {
    background: rgba(255, 255, 255, 0.3);
    color: white;
  }

  .view-content {
    flex: 1;
    min-height: 400px;
    overflow: hidden;
  }

  .current-query-banner {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--background-secondary);
    border: 2px solid var(--interactive-accent);
    border-radius: 8px;
    position: sticky;
    bottom: 0;
    z-index: 10;
  }

  .banner-label {
    font-weight: 600;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .banner-query {
    flex: 1;
    padding: 0.5rem 0.75rem;
    background: var(--background-primary);
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9rem;
    color: var(--text-accent);
    overflow-x: auto;
  }

  .btn-execute,
  .btn-clear {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .btn-execute {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .btn-execute:hover {
    background: var(--interactive-accent-hover);
  }

  .btn-clear {
    background: var(--background-modifier-border);
    color: var(--text-normal);
    padding: 0.5rem;
  }

  .btn-clear:hover {
    background: var(--background-modifier-hover);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .advanced-query-dashboard {
      padding: 1rem;
    }

    .view-tabs {
      overflow-x: scroll;
    }

    .current-query-banner {
      flex-wrap: wrap;
    }

    .banner-query {
      width: 100%;
    }
  }
</style>
