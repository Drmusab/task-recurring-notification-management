<script lang="ts">
  /**
   * Query Explanation Panel
   * 
   * Displays detailed explanations of query results, showing why each task
   * matched or didn't match the filters.
   * 
   * Phase 1: Query Enhancement
   * 
   * @module QueryExplanationPanel
   */

  import type { Explanation, TaskExplanation } from "@backend/core/query/QueryExplainer";
  import { QueryExplainer } from "@backend/core/query/QueryExplainer";

  // Props
  export let explanation: Explanation | null = null;
  export let onClose: () => void;

  // State
  let showMatched = true;
  let showNotMatched = false;

  // Compute derived values from explanation
  $: matchedTasks = explanation ? explanation.taskExplanations.filter(te => te.matched) : [];
  $: notMatchedTasks = explanation ? explanation.taskExplanations.filter(te => !te.matched) : [];
  
  // Format explanation as markdown (use instance method)
  $: markdownExplanation = explanation ? new QueryExplainer().explainAsMarkdown(explanation) : "";
</script>

<div class="query-explanation-panel">
  <div class="panel-header">
    <h3>🔍 Query Explanation</h3>
    <button class="btn-close" on:click={onClose} title="Close explanation">
      ✕
    </button>
  </div>

  {#if explanation}
    <div class="panel-content">
      <!-- Summary -->
      <div class="summary-section">
        <div class="summary-stat">
          <span class="stat-value">{explanation.matchCount}</span>
          <span class="stat-label">Matched Tasks</span>
        </div>
        <div class="summary-stat">
          <span class="stat-value">{explanation.totalCount - explanation.matchCount}</span>
          <span class="stat-label">Not Matched</span>
        </div>
        <div class="summary-stat">
          <span class="stat-value">{explanation.totalCount}</span>
          <span class="stat-label">Total Tasks</span>
        </div>
      </div>

      <!-- Query Description -->
      <div class="query-description">
        <h4>Query</h4>
        <code>{explanation.queryString}</code>
      </div>

      <!-- Toggle Buttons -->
      <div class="toggle-section">
        <button
          class="toggle-btn"
          class:active={showMatched}
          on:click={() => (showMatched = !showMatched)}
        >
          ✓ Matched Tasks ({matchedTasks.length})
        </button>
        <button
          class="toggle-btn"
          class:active={showNotMatched}
          on:click={() => (showNotMatched = !showNotMatched)}
        >
          ✗ Not Matched ({notMatchedTasks.length})
        </button>
      </div>

      <!-- Matched Tasks -->
      {#if showMatched && matchedTasks.length > 0}
        <div class="task-explanation-section">
          <h4>✓ Why These Tasks Matched</h4>
          {#each matchedTasks as taskExp}
            <div class="task-explanation matched">
              <div class="task-name">{taskExp.task.name}</div>
              <ul class="reason-list">
                {#each taskExp.filterExplanations.filter(fe => fe.matched) as fe}
                  <li>✓ {fe.filterDescription}: {fe.reason}</li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Not Matched Tasks -->
      {#if showNotMatched && notMatchedTasks.length > 0}
        <div class="task-explanation-section">
          <h4>✗ Why These Tasks Didn't Match</h4>
          {#each notMatchedTasks as taskExp}
            <div class="task-explanation not-matched">
              <div class="task-name">{taskExp.task.name}</div>
              <ul class="reason-list">
                {#each taskExp.mismatchReasons as reason}
                  <li>✗ {reason}</li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Markdown Export Option -->
      <div class="export-section">
        <button
          class="btn-secondary"
          on:click={() => navigator.clipboard.writeText(markdownExplanation)}
          title="Copy explanation as markdown"
        >
          📋 Copy as Markdown
        </button>
      </div>
    </div>
  {:else}
    <div class="panel-empty">
      <p>No explanation available. Run a query with the "Explain" button to see detailed results.</p>
    </div>
  {/if}
</div>

<style>
  .query-explanation-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--b3-theme-surface);
    border-bottom: 1px solid var(--b3-border-color);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .btn-close {
    background: transparent;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: var(--b3-theme-on-surface);
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .btn-close:hover {
    background: var(--b3-theme-surface-light);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .panel-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    text-align: center;
    color: var(--b3-theme-on-surface-variant);
  }

  .summary-section {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }

  .summary-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px;
    background: var(--b3-theme-surface);
    border-radius: 8px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--b3-theme-primary);
  }

  .stat-label {
    font-size: 12px;
    color: var(--b3-theme-on-surface-variant);
    margin-top: 4px;
  }

  .query-description {
    margin-bottom: 20px;
    padding: 12px;
    background: var(--b3-theme-surface);
    border-radius: 8px;
  }

  .query-description h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .query-description code {
    display: block;
    padding: 8px;
    background: var(--b3-theme-code-background);
    color: var(--b3-theme-code-color);
    border-radius: 4px;
    font-family: monospace;
    font-size: 13px;
    overflow-x: auto;
  }

  .toggle-section {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }

  .toggle-btn {
    flex: 1;
    padding: 10px 16px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--b3-theme-on-surface);
    transition: all 0.2s;
  }

  .toggle-btn:hover {
    background: var(--b3-theme-surface-light);
  }

  .toggle-btn.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border-color: var(--b3-theme-primary);
  }

  .task-explanation-section {
    margin-bottom: 24px;
  }

  .task-explanation-section h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .task-explanation {
    margin-bottom: 12px;
    padding: 12px;
    border-radius: 8px;
    border-left: 4px solid;
  }

  .task-explanation.matched {
    background: var(--b3-theme-success-background, #e8f5e9);
    border-color: var(--b3-theme-success, #4caf50);
  }

  .task-explanation.not-matched {
    background: var(--b3-theme-error-background, #ffebee);
    border-color: var(--b3-theme-error, #f44336);
  }

  .task-name {
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--b3-theme-on-surface);
  }

  .reason-list {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    color: var(--b3-theme-on-surface-variant);
  }

  .reason-list li {
    margin-bottom: 4px;
  }

  .export-section {
    display: flex;
    justify-content: center;
    padding-top: 16px;
    border-top: 1px solid var(--b3-border-color);
  }

  .btn-secondary {
    padding: 8px 16px;
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
    border-color: var(--b3-theme-primary);
  }
</style>
