<script lang="ts">
  import { ExplanationDiff } from "@backend/core/query/ExplanationDiff";
  import type { Explanation } from "@backend/core/query/QueryExplainer";
  import type { ExplanationDiff as DiffType, TaskDiffEntry } from "@backend/core/query/ExplanationDiff";

  // Props
  export let beforeExplanation: Explanation | null = null;
  export let afterExplanation: Explanation | null = null;

  // State
  let diff: DiffType | null = null;
  let showDetails: boolean = false;
  let selectedCategory: "gained" | "lost" | "changed" | "all" = "all";

  // Reactive diff calculation
  $: {
    if (beforeExplanation && afterExplanation) {
      diff = ExplanationDiff.diff(beforeExplanation, afterExplanation);
    } else {
      diff = null;
    }
  }

  // Get summary text
  $: summaryText = diff ? ExplanationDiff.getSummaryText(diff) : "No changes";

  // Get impact color
  $: impactColor = getImpactColor(diff?.summary.impactLevel);

  function getImpactColor(level?: "none" | "minor" | "moderate" | "major"): string {
    switch (level) {
      case "none": return "#6B7280";
      case "minor": return "#10B981";
      case "moderate": return "#F59E0B";
      case "major": return "#EF4444";
      default: return "#6B7280";
    }
  }

  // Filter tasks by category
  $: filteredTasks = getFilteredTasks(diff, selectedCategory);

  function getFilteredTasks(d: DiffType | null, category: string): TaskDiffEntry[] {
    if (!d) return [];
    
    switch (category) {
      case "gained":
        return d.nowMatched;
      case "lost":
        return d.nowUnmatched;
      case "changed":
        return [...d.stillMatched, ...d.stillUnmatched].filter(e => e.reasonsChanged);
      case "all":
        return [...d.nowMatched, ...d.nowUnmatched];
      default:
        return [];
    }
  }

  // Export markdown
  function exportMarkdown() {
    if (!diff) return;
    const markdown = ExplanationDiff.toMarkdown(diff);
    downloadText(markdown, "query-diff.md");
  }

  function downloadText(text: string, filename: string) {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="explanation-diff-panel">
  {#if !beforeExplanation || !afterExplanation}
    <div class="empty-state">
      <div class="empty-icon">📊</div>
      <h3>No Comparison Available</h3>
      <p>Execute a query, modify it, then re-execute to see changes</p>
    </div>
  {:else if diff}
    <!-- Summary Section -->
    <div class="diff-summary" style="border-left: 4px solid {impactColor}">
      <div class="summary-header">
        <h3>Query Changes Summary</h3>
        <span class="impact-badge" style="background-color: {impactColor}20; color: {impactColor}">
          {diff.summary.impactLevel.toUpperCase()} Impact
        </span>
      </div>

      <div class="summary-stats">
        <div class="stat">
          <div class="stat-label">Total Tasks</div>
          <div class="stat-value">{diff.summary.totalTasks}</div>
        </div>

        <div class="stat">
          <div class="stat-label">Before</div>
          <div class="stat-value">{diff.summary.beforeMatchCount}</div>
        </div>

        <div class="stat arrow">→</div>

        <div class="stat">
          <div class="stat-label">After</div>
          <div class="stat-value">{diff.summary.afterMatchCount}</div>
        </div>

        <div class="stat">
          <div class="stat-label">Net Change</div>
          <div class="stat-value" class:positive={diff.summary.matchCountChange > 0} class:negative={diff.summary.matchCountChange < 0}>
            {diff.summary.matchCountChange > 0 ? '+' : ''}{diff.summary.matchCountChange}
          </div>
        </div>
      </div>

      <div class="summary-text">{summaryText}</div>
    </div>

    <!-- Category Filter -->
    <div class="category-filter">
      <button 
        class="filter-btn" 
        class:active={selectedCategory === "all"}
        on:click={() => selectedCategory = "all"}
      >
        All Changes ({diff.nowMatched.length + diff.nowUnmatched.length})
      </button>
      
      <button 
        class="filter-btn gained" 
        class:active={selectedCategory === "gained"}
        on:click={() => selectedCategory = "gained"}
      >
        ✅ Gained ({diff.nowMatched.length})
      </button>
      
      <button 
        class="filter-btn lost" 
        class:active={selectedCategory === "lost"}
        on:click={() => selectedCategory = "lost"}
      >
        ❌ Lost ({diff.nowUnmatched.length})
      </button>
      
      <button 
        class="filter-btn changed" 
        class:active={selectedCategory === "changed"}
        on:click={() => selectedCategory = "changed"}
      >
        🔄 Reasons Changed ({diff.summary.reasonsChangedCount})
      </button>
    </div>

    <!-- Task Details -->
    <div class="task-list">
      {#if filteredTasks.length === 0}
        <div class="no-tasks">No tasks in this category</div>
      {:else}
        {#each filteredTasks as entry}
          <div class="task-entry" class:gained={diff.nowMatched.includes(entry)} class:lost={diff.nowUnmatched.includes(entry)}>
            <div class="task-header">
              <div class="task-icon">
                {#if diff.nowMatched.includes(entry)}
                  ✅
                {:else if diff.nowUnmatched.includes(entry)}
                  ❌
                {:else}
                  🔄
                {/if}
              </div>
              <div class="task-name">{entry.task.name || entry.task.id}</div>
            </div>

            <div class="task-diff">
              <div class="diff-side before">
                <div class="side-label">Before:</div>
                <ul class="reasons">
                  {#each entry.beforeReasons as reason}
                    <li>{reason}</li>
                  {/each}
                </ul>
              </div>

              <div class="diff-arrow">→</div>

              <div class="diff-side after">
                <div class="side-label">After:</div>
                <ul class="reasons">
                  {#each entry.afterReasons as reason}
                    <li>{reason}</li>
                  {/each}
                </ul>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Actions -->
    <div class="panel-actions">
      <button class="action-btn" on:click={exportMarkdown}>
        📄 Export Markdown
      </button>
      
      <button class="action-btn" on:click={() => showDetails = !showDetails}>
        {showDetails ? '🙈 Hide' : '👁️ Show'} Details
      </button>
    </div>

    {#if showDetails}
      <div class="detailed-view">
        <h4>Detailed Analysis</h4>
        <pre>{ExplanationDiff.toMarkdown(diff)}</pre>
      </div>
    {/if}
  {/if}
</div>

<style>
  .explanation-diff-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: #ffffff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #6B7280;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    margin: 0.5rem 0;
    color: #374151;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  .diff-summary {
    padding: 1rem;
    background: #F9FAFB;
    border-radius: 6px;
  }

  .summary-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .summary-header h3 {
    margin: 0;
    font-size: 1.125rem;
    color: #111827;
  }

  .impact-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .summary-stats {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
  }

  .stat {
    text-align: center;
  }

  .stat.arrow {
    font-size: 1.5rem;
    color: #9CA3AF;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6B7280;
    margin-bottom: 0.25rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }

  .stat-value.positive {
    color: #10B981;
  }

  .stat-value.negative {
    color: #EF4444;
  }

  .summary-text {
    font-size: 0.875rem;
    color: #374151;
    padding: 0.75rem;
    background: white;
    border-radius: 4px;
  }

  .category-filter {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filter-btn {
    padding: 0.5rem 1rem;
    border: 2px solid #E5E7EB;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .filter-btn:hover {
    border-color: #3B82F6;
    background: #EFF6FF;
  }

  .filter-btn.active {
    border-color: #3B82F6;
    background: #3B82F6;
    color: white;
  }

  .filter-btn.gained.active {
    background: #10B981;
    border-color: #10B981;
  }

  .filter-btn.lost.active {
    background: #EF4444;
    border-color: #EF4444;
  }

  .filter-btn.changed.active {
    background: #F59E0B;
    border-color: #F59E0B;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 500px;
    overflow-y: auto;
  }

  .no-tasks {
    text-align: center;
    padding: 2rem;
    color: #9CA3AF;
    font-style: italic;
  }

  .task-entry {
    padding: 0.75rem;
    border: 2px solid #E5E7EB;
    border-radius: 6px;
    background: white;
    transition: all 0.2s;
  }

  .task-entry:hover {
    border-color: #3B82F6;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .task-entry.gained {
    border-left: 4px solid #10B981;
  }

  .task-entry.lost {
    border-left: 4px solid #EF4444;
  }

  .task-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .task-icon {
    font-size: 1.25rem;
  }

  .task-name {
    font-weight: 600;
    color: #111827;
  }

  .task-diff {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 1rem;
    font-size: 0.875rem;
  }

  .diff-side {
    padding: 0.5rem;
    background: #F9FAFB;
    border-radius: 4px;
  }

  .diff-side.before {
    border-left: 3px solid #EF4444;
  }

  .diff-side.after {
    border-left: 3px solid #10B981;
  }

  .side-label {
    font-weight: 600;
    color: #6B7280;
    margin-bottom: 0.25rem;
    font-size: 0.75rem;
  }

  .reasons {
    margin: 0;
    padding-left: 1.25rem;
    color: #374151;
  }

  .reasons li {
    margin: 0.25rem 0;
  }

  .diff-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    color: #9CA3AF;
  }

  .panel-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    padding-top: 0.5rem;
    border-top: 1px solid #E5E7EB;
  }

  .action-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #D1D5DB;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: #F3F4F6;
    border-color: #9CA3AF;
  }

  .detailed-view {
    padding: 1rem;
    background: #F9FAFB;
    border-radius: 6px;
    margin-top: 1rem;
  }

  .detailed-view h4 {
    margin: 0 0 0.75rem 0;
    color: #111827;
  }

  .detailed-view pre {
    margin: 0;
    padding: 1rem;
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 4px;
    font-size: 0.75rem;
    overflow-x: auto;
    white-space: pre-wrap;
  }
</style>
