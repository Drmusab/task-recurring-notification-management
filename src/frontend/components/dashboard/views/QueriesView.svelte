<script lang="ts">
  /**
   * QueriesView Component — Session 25 Refactored (Runtime Projection Layer)
   *
   * BEFORE (violations):
   *   ❌ import Task from @backend/core/models/Task
   *   ❌ import NaturalLanguageQueryParser, QueryEngine, QueryExplainer from backend
   *   ❌ new NaturalLanguageQueryParser() / new QueryEngine() direct instantiation
   *   ❌ tasks: Task[] prop (raw domain array)
   *
   * AFTER (clean):
   *   ✅ TaskDTO from services/DTOs
   *   ✅ uiQueryService.executeQuery() / .executeQueryWithExplanation()
   *   ✅ No backend imports, no engine instantiation
   */
  import { onDestroy } from "svelte";
  import type { TaskDTO, QueryExplanationDTO } from "../../../services/DTOs";
  import { uiQueryService } from "../../../services/UIQueryService";
  import QueryExplanationPanel from "@components/query/QueryExplanationPanel.svelte";
  import SavedQueriesDropdown from "@components/query/SavedQueriesDropdown.svelte";
  import * as logger from "@shared/logging/logger";

  // Props — NO backend types
  export let tabPanelId: string;
  export let queriesTabId: string;

  // Query state
  let queryString = "";
  let queryResults: TaskDTO[] = [];
  let queryExplanation: QueryExplanationDTO | null = null;
  let showExplanation = false;
  let isExecutingQuery = false;
  let queryError: string | null = null;

  // Abort controllers
  let executeQueryAbortController: AbortController | null = null;
  let explainQueryAbortController: AbortController | null = null;

  // Status announcements for screen readers
  let statusMessage = "";

  async function handleExecuteQuery() {
    if (!queryString.trim()) {
      queryError = "Please enter a query";
      statusMessage = "Error: No query entered";
      return;
    }

    // Cancel previous query execution
    if (executeQueryAbortController) {
      executeQueryAbortController.abort();
    }

    executeQueryAbortController = new AbortController();
    const { signal } = executeQueryAbortController;

    isExecutingQuery = true;
    queryError = null;
    showExplanation = false;
    statusMessage = "Executing query...";

    try {
      // Route through UIQueryService — NO direct engine instantiation
      const results = await uiQueryService.executeQuery(queryString);

      // Only update if not aborted
      if (!signal.aborted) {
        queryResults = results;
        queryError = null;
        statusMessage = `Found ${results.length} task${results.length !== 1 ? 's' : ''}`;
      }
    } catch (error: any) {
      if (error.name !== 'AbortError' && !signal.aborted) {
        queryError = error instanceof Error ? error.message : "Query execution failed";
        queryResults = [];
        statusMessage = `Query error: ${queryError}`;
        logger.error("[QueriesView] Execution error:", error);
      }
    } finally {
      if (!signal.aborted) {
        isExecutingQuery = false;
      }
      executeQueryAbortController = null;
    }
  }

  async function handleExplainQuery() {
    if (!queryString.trim()) {
      queryError = "Please enter a query to explain";
      statusMessage = "Error: No query to explain";
      return;
    }

    // Cancel previous query explanation
    if (explainQueryAbortController) {
      explainQueryAbortController.abort();
    }

    explainQueryAbortController = new AbortController();
    const { signal } = explainQueryAbortController;

    isExecutingQuery = true;
    queryError = null;
    statusMessage = "Analyzing query...";

    try {
      // Route through UIQueryService — NO direct engine instantiation
      const { results, explanation } = await uiQueryService.executeQueryWithExplanation(queryString);

      // Only update if not aborted
      if (!signal.aborted) {
        queryResults = results;
        queryExplanation = explanation as any;
        showExplanation = true;
        queryError = null;
        statusMessage = "Query explanation ready";
      }
    } catch (error: any) {
      if (error.name !== 'AbortError' && !signal.aborted) {
        queryError = error instanceof Error ? error.message : "Query explanation failed";
        queryExplanation = null;
        showExplanation = false;
        statusMessage = `Explanation error: ${queryError}`;
        logger.error("[QueriesView] Explanation error:", error);
      }
    } finally {
      if (!signal.aborted) {
        isExecutingQuery = false;
      }
      explainQueryAbortController = null;
    }
  }

  function handleCloseExplanation() {
    showExplanation = false;
    queryExplanation = null;
    statusMessage = "Closed explanation";
  }

  function handleQuerySelected(query: any) {
    queryString = query.queryString || query;
    statusMessage = `Loaded query`;
  }

  function formatDueDate(dueAt: string): string {
    const date = new Date(dueAt);
    return date.toLocaleDateString();
  }

  function getTaskStatus(task: TaskDTO): "overdue" | "today" | "upcoming" {
    if (task.isOverdue) return "overdue";
    if (!task.dueAt) return "upcoming";
    const now = new Date();
    const due = new Date(task.dueAt);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    if (dueDay < today) return "overdue";
    if (dueDay.getTime() === today.getTime()) return "today";
    return "upcoming";
  }

  onDestroy(() => {
    // Cancel any in-flight requests
    executeQueryAbortController?.abort();
    explainQueryAbortController?.abort();
  });
</script>

<div 
  class="rtm-queries-panel" 
  role="tabpanel" 
  id={tabPanelId}
  aria-labelledby={queriesTabId}
  tabindex="0"
>
  <!-- ARIA live region for status announcements -->
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {statusMessage}
  </div>

  <div class="rtm-panel-header">
    <h3>🔍 Advanced Query & Explanation</h3>
  </div>

  <!-- Saved Queries Dropdown -->
  <div class="rtm-query-section">
    <SavedQueriesDropdown
      currentQueryString={queryString}
      onQuerySelected={handleQuerySelected}
    />
  </div>

  <!-- Query Input -->
  <div class="rtm-query-section">
    <label class="rtm-field">
      <span class="rtm-field-label">Query (Natural Language or AST Syntax)</span>
      <textarea
        bind:value={queryString}
        placeholder='Try: "due before today AND priority is high"&#10;Or: "overdue high-priority tasks in /work"&#10;Or: "tasks due this week with tag #important"'
        rows="4"
        class="rtm-query-input"
        aria-label="Query input"
      ></textarea>
    </label>
  </div>

  <!-- Query Actions -->
  <div class="rtm-query-actions">
    <button
      class="rtm-btn-primary"
      on:click={handleExecuteQuery}
      disabled={isExecutingQuery || !queryString.trim()}
      aria-label="Execute query"
    >
      {isExecutingQuery ? "⏳ Executing..." : "▶️ Execute Query"}
    </button>
    <button
      class="rtm-btn-secondary"
      on:click={handleExplainQuery}
      disabled={isExecutingQuery || !queryString.trim()}
      aria-label="Explain query"
    >
      {isExecutingQuery ? "⏳ Analyzing..." : "🔍 Explain Query"}
    </button>
  </div>

  <!-- Query Error -->
  {#if queryError}
    <div class="rtm-error-box" role="alert">
      ❌ {queryError}
    </div>
  {/if}

  <!-- Query Results -->
  {#if queryResults.length > 0}
    <div class="rtm-query-results">
      <div class="rtm-results-header">
        <h4>Query Results ({queryResults.length})</h4>
      </div>
      <div class="rtm-task-list">
        {#each queryResults as task (task.id)}
          <div class="rtm-task-card">
            <div class="rtm-task-main">
              <div class="rtm-task-name">{task.name}</div>
              {#if task.description}
                <div class="rtm-task-description">{task.description}</div>
              {/if}
              <div class="rtm-task-meta">
                <span class="rtm-task-status" class:overdue={getTaskStatus(task) === "overdue"}>
                  📅 {task.dueAt ? formatDueDate(task.dueAt) : "No due date"}
                </span>
                {#if task.tags && task.tags.length > 0}
                  <span class="rtm-task-tags">
                    {task.tags.map(t => `#${t}`).join(" ")}
                  </span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if !isExecutingQuery && queryString.trim() && !queryError && !showExplanation}
    <div class="rtm-info-box" role="status">
      ℹ️ No tasks match your query.
    </div>
  {/if}

  <!-- Query Explanation Panel -->
  {#if showExplanation && queryExplanation}
    <QueryExplanationPanel
      explanation={queryExplanation}
      onClose={handleCloseExplanation}
    />
  {/if}
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .rtm-queries-panel {
    padding: 16px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .rtm-panel-header {
    margin-bottom: 20px;
  }

  .rtm-panel-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .rtm-query-section {
    margin-bottom: 16px;
  }

  .rtm-field {
    display: flex;
    flex-direction: column;
  }

  .rtm-field-label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .rtm-query-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-background);
    font-size: 13px;
    font-family: var(--b3-font-family-code, monospace);
    resize: vertical;
    min-height: 80px;
  }

  .rtm-query-input:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 2px var(--b3-theme-primary-light);
  }

  .rtm-query-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .rtm-btn-primary {
    padding: 8px 16px;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.2s;
  }

  .rtm-btn-primary:hover:not(:disabled) {
    background: var(--b3-theme-primary-light);
  }

  .rtm-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rtm-btn-secondary {
    padding: 8px 16px;
    background: transparent;
    color: var(--b3-theme-primary);
    border: 1px solid var(--b3-theme-primary);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .rtm-btn-secondary:hover:not(:disabled) {
    background: var(--b3-theme-primary-light);
  }

  .rtm-btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rtm-error-box {
    padding: 12px;
    background: var(--b3-card-error-background, rgba(239, 68, 68, 0.1));
    color: var(--b3-card-error-color, #ef4444);
    border: 1px solid var(--b3-card-error-color, #ef4444);
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 13px;
  }

  .rtm-info-box {
    padding: 12px;
    background: var(--b3-card-info-background, rgba(59, 130, 246, 0.1));
    color: var(--b3-card-info-color, #3b82f6);
    border: 1px solid var(--b3-card-info-color, #3b82f6);
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 13px;
  }

  .rtm-query-results {
    margin-top: 24px;
  }

  .rtm-results-header {
    margin-bottom: 12px;
  }

  .rtm-results-header h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .rtm-task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rtm-task-card {
    padding: 16px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    transition: all 0.2s;
  }

  .rtm-task-card:hover {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .rtm-task-main {
    flex: 1;
  }

  .rtm-task-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-background);
    margin-bottom: 4px;
  }

  .rtm-task-description {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    margin-top: 4px;
  }

  .rtm-task-meta {
    display: flex;
    gap: 12px;
    margin-top: 6px;
    font-size: 12px;
  }

  .rtm-task-status {
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-task-status.overdue {
    color: var(--b3-card-error-color, #ef4444);
    font-weight: 500;
  }

  .rtm-task-tags {
    color: var(--b3-theme-primary);
  }
</style>
