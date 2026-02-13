<script lang="ts">
  import { SuggestedFixGenerator } from "@backend/core/query/SuggestedFixGenerator";
  import type { TaskExplanation } from "@backend/core/query/QueryExplainer";
  import type { SuggestedFix, FixGroup } from "@backend/core/query/SuggestedFixGenerator";

  // Props
  export let taskExplanations: TaskExplanation[] = [];
  export let onApplyFix: ((fix: SuggestedFix) => void) | null = null;

  // State
  const generator = new SuggestedFixGenerator();
  let fixGroups: FixGroup[] = [];
  let selectedTaskId: string | null = null;
  let showOnlyQuickFixes: boolean = false;

  // Reactive fix generation
  $: fixGroups = generator.generateBatchFixes(taskExplanations);

  // Filter quick fixes
  $: displayedGroups = showOnlyQuickFixes
    ? fixGroups.filter(g => g.quickFixAvailable)
    : fixGroups;

  //  Statistics
  $: totalFixes = fixGroups.reduce((sum, g) => sum + g.fixes.length, 0);
  $: quickFixCount = fixGroups.filter(g => g.quickFixAvailable).length;

  function applyFix(fix: SuggestedFix) {
    if (onApplyFix) {
      onApplyFix(fix);
    }
  }

  function toggleTask(taskId: string) {
    selectedTaskId = selectedTaskId === taskId ? null : taskId;
  }

  function getEffortStars(effort: number): string {
    return '⭐'.repeat(effort);
  }

  function getConfidencePercent(confidence: number): number {
    return Math.round(confidence * 100);
  }

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return '#10B981';
    if (confidence >= 0.6) return '#F59E0B';
    return '#EF4444';
  }

  function exportMarkdown() {
    const markdown = SuggestedFixGenerator.toMarkdown(fixGroups);
    downloadText(markdown, "suggested-fixes.md");
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

<div class="suggested-fixes-panel">
  <!-- Header -->
  <div class="panel-header">
    <div class="header-left">
      <h3>💡 Suggested Fixes</h3>
      <div class="stats">
        <span class="stat-badge">{fixGroups.length} tasks</span>
        <span class="stat-badge">{totalFixes} fixes</span>
        <span class="stat-badge quick">⚡ {quickFixCount} quick</span>
      </div>
    </div>

    <div class="header-actions">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={showOnlyQuickFixes} />
        Show only quick fixes
      </label>

      <button class="action-btn" on:click={exportMarkdown}>
        📄 Export
      </button>
    </div>
  </div>

  {#if displayedGroups.length === 0}
    <div class="empty-state">
      {#if fixGroups.length === 0}
        <div class="empty-icon">✅</div>
        <h4>All Tasks Matched!</h4>
        <p>No suggested fixes needed - all tasks match the query filters.</p>
      {:else}
        <div class="empty-icon">🔍</div>
        <h4>No Quick Fixes Available</h4>
        <p>Try disabling the quick fix filter to see all suggestions.</p>
      {/if}
    </div>
  {:else}
    <!-- Fix Groups -->
    <div class="fix-groups">
      {#each displayedGroups as group}
        <div 
          class="fix-group" 
          class:expanded={selectedTaskId === group.task.id}
          class:quick-fix={group.quickFixAvailable}
        >
          <!-- Task Header -->
          <button 
            class="task-header"
            on:click={() => toggleTask(group.task.id)}
          >
            <div class="task-info">
              {#if group.quickFixAvailable}
                <span class="quick-badge">⚡</span>
              {/if}
              <span class="task-name">{group.task.name || group.task.id}</span>
              <span class="fix-count">{group.fixes.length} fix{group.fixes.length !== 1 ? 'es' : ''}</span>
            </div>

            <div class="expand-icon">
              {selectedTaskId === group.task.id ? '▼' : '▶'}
            </div>
          </button>

          <!-- Best Fix Preview -->
          {#if group.bestFix && selectedTaskId !== group.task.id}
            <div class="best-fix-preview">
              <div class="preview-label">Recommended:</div>
              <div class="preview-description">{group.bestFix.description}</div>
              <button 
                class="apply-btn quick"
                on:click|stopPropagation={() => applyFix(group.bestFix!)}
              >
                Apply
              </button>
            </div>
          {/if}

          <!-- Expanded Fix List -->
          {#if selectedTaskId === group.task.id}
            <div class="fix-list">
              {#each group.fixes as fix, index}
                <div class="fix-item" class:best={index === 0}>
                  {#if index === 0}
                    <div class="best-badge">⭐ Recommended</div>
                  {/if}

                  <div class="fix-header">
                    <div class="fix-description">{fix.description}</div>
                    <button 
                      class="apply-btn"
                      class:quick={fix.effort <= 2 && fix.confidence >= 0.8}
                      on:click={() => applyFix(fix)}
                    >
                      Apply Fix
                    </button>
                  </div>

                  <div class="fix-details">
                    <div class="detail-row">
                      <span class="detail-label">Target Filter:</span>
                      <span class="detail-value">{fix.targetFilter}</span>
                    </div>

                    <div class="detail-row">
                      <span class="detail-label">Type:</span>
                      <span class="detail-value type-badge">{fix.type.replace(/_/g, ' ')}</span>
                    </div>

                    <div class="detail-row">
                      <span class="detail-label">Confidence:</span>
                      <div class="confidence-bar">
                        <div 
                          class="confidence-fill"
                          style="width: {getConfidencePercent(fix.confidence)}%; background-color: {getConfidenceColor(fix.confidence)}"
                        ></div>
                        <span class="confidence-text">{getConfidencePercent(fix.confidence)}%</span>
                      </div>
                    </div>

                    <div class="detail-row">
                      <span class="detail-label">Effort:</span>
                      <span class="detail-value">{getEffortStars(fix.effort)}</span>
                    </div>

                    {#if fix.patch && Object.keys(fix.patch).length > 0}
                      <div class="detail-row patch">
                        <span class="detail-label">Changes:</span>
                        <div class="patch-details">
                          {#each Object.entries(fix.patch) as [key, value]}
                            <div class="patch-item">
                              <code class="patch-key">{key}</code>
                              <span class="patch-arrow">→</span>
                              <code class="patch-value">{JSON.stringify(value)}</code>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .suggested-fixes-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: #ffffff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #E5E7EB;
  }

  .header-left h3 {
    margin: 0 0 0.5rem 0;
    color: #111827;
    font-size: 1.25rem;
  }

  .stats {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .stat-badge {
    padding: 0.25rem 0.75rem;
    background: #F3F4F6;
    border-radius: 12px;
    font-size: 0.75rem;
    color: #374151;
    font-weight: 600;
  }

  .stat-badge.quick {
    background: #FEF3C7;
    color: #92400E;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
  }

  .checkbox-label input {
    cursor: pointer;
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

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #6B7280;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-state h4 {
    margin: 0.5rem 0;
    color: #374151;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  .fix-groups {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .fix-group {
    border: 2px solid #E5E7EB;
    border-radius: 8px;
    background: white;
    overflow: hidden;
    transition: all 0.2s;
  }

  .fix-group.quick-fix {
    border-color: #FBBF24;
  }

  .fix-group.expanded {
    border-color: #3B82F6;
  }

  .task-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: white;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;
  }

  .task-header:hover {
    background: #F9FAFB;
  }

  .task-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .quick-badge {
    font-size: 1.25rem;
  }

  .task-name {
    font-weight: 600;
    color: #111827;
  }

  .fix-count {
    padding: 0.125rem 0.5rem;
    background: #E5E7EB;
    border-radius: 10px;
    font-size: 0.75rem;
    color: #374151;
  }

  .expand-icon {
    color: #9CA3AF;
    font-size: 0.875rem;
  }

  .best-fix-preview {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #F9FAFB;
    border-top: 1px solid #E5E7EB;
  }

  .preview-label {
    font-size: 0.75rem;
    color: #6B7280;
    font-weight: 600;
  }

  .preview-description {
    flex: 1;
    font-size: 0.875rem;
    color: #374151;
  }

  .apply-btn {
    padding: 0.375rem 0.75rem;
    border: 1px solid #D1D5DB;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .apply-btn:hover {
    background: #3B82F6;
    border-color: #3B82F6;
    color: white;
  }

  .apply-btn.quick {
    background: #FEF3C7;
    border-color: #FBBF24;
    color: #92400E;
  }

  .apply-btn.quick:hover {
    background: #FBBF24;
    color: white;
  }

  .fix-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: #F9FAFB;
    border-top: 1px solid #E5E7EB;
  }

  .fix-item {
    padding: 0.75rem;
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 6px;
  }

  .fix-item.best {
    border-color: #FBBF24;
    background: #FFFBEB;
  }

  .best-badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    background: #FBBF24;
    color: white;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .fix-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .fix-description {
    font-weight: 600;
    color: #111827;
  }

  .fix-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .detail-row.patch {
    flex-direction: column;
    align-items: flex-start;
  }

  .detail-label {
    font-weight: 600;
    color: #6B7280;
    min-width: 6rem;
  }

  .detail-value {
    color: #374151;
  }

  .type-badge {
    padding: 0.125rem 0.5rem;
    background: #DBEAFE;
    color: #1E40AF;
    border-radius: 4px;
    font-size: 0.75rem;
    text-transform: capitalize;
  }

  .confidence-bar {
    position: relative;
    flex: 1;
    height: 1.5rem;
    background: #E5E7EB;
    border-radius: 4px;
    overflow: hidden;
  }

  .confidence-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    transition: width 0.3s;
  }

  .confidence-text {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-size: 0.75rem;
    font-weight: 700;
    color: #374151;
  }

  .patch-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    background: #F9FAFB;
    border-radius: 4px;
    width: 100%;
  }

  .patch-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .patch-key,
  .patch-value {
    padding: 0.125rem 0.375rem;
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.75rem;
  }

  .patch-arrow {
    color: #9CA3AF;
  }
</style>
