<script lang="ts">
  /**
   * Query Statistics Dashboard Component
   * 
   * Provides comprehensive analytics for saved queries:
   * - Query usage statistics
   * - Most/least used queries
   * - Recently used queries
   * - Tag distribution
   * - Folder distribution
   * - Usage trends over time
   * 
   * Phase 3: Advanced Query Features
   * 
   * @module QueryStatisticsDashboard
   */

  import { onMount } from "svelte";
  import { SavedQueryStore, type SavedQuery } from "@backend/core/query/SavedQueryStore";

  // State
  let queries: SavedQuery[] = [];
  let stats = SavedQueryStore.getStats();
  let mostUsed: SavedQuery[] = [];
  let recentlyUsed: SavedQuery[] = [];
  let pinned: SavedQuery[] = [];
  let tagDistribution: { tag: string; count: number }[] = [];
  let folderDistribution: { folder: string; count: number }[] = [];

  onMount(() => {
    loadData();
  });

  function loadData() {
    queries = SavedQueryStore.load();
    stats = SavedQueryStore.getStats();
    mostUsed = SavedQueryStore.getMostUsed(10);
    recentlyUsed = SavedQueryStore.getRecentlyUsed(10);
    pinned = SavedQueryStore.getPinned();
    
    computeDistributions();
  }

  function computeDistributions() {
    // Tag distribution
    const tagCounts: Record<string, number> = {};
    queries.forEach(query => {
      if (query.tags && Array.isArray(query.tags)) {
        query.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    tagDistribution = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Folder distribution
    const folderCounts: Record<string, number> = {};
    let unfolderedCount = 0;

    queries.forEach(query => {
      if (query.folder) {
        folderCounts[query.folder] = (folderCounts[query.folder] || 0) + 1;
      } else {
        unfolderedCount++;
      }
    });

    folderDistribution = Object.entries(folderCounts)
      .map(([folder, count]) => ({ folder, count }))
      .sort((a, b) => b.count - a.count);

    if (unfolderedCount > 0) {
      folderDistribution.push({ folder: "(Unfiled)", count: unfolderedCount });
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  }

  function getPercentage(value: number, total: number): number {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }
</script>

<div class="stats-dashboard">
  <div class="dashboard-header">
    <h3>📊 Query Statistics</h3>
    <button class="btn-refresh" on:click={loadData} title="Refresh statistics">
      🔄
    </button>
  </div>

  <!-- Overview Stats -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon">📋</div>
      <div class="stat-content">
        <div class="stat-value">{stats.totalQueries}</div>
        <div class="stat-label">Total Queries</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">📁</div>
      <div class="stat-content">
        <div class="stat-value">{stats.totalFolders}</div>
        <div class="stat-label">Folders</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">🎯</div>
      <div class="stat-content">
        <div class="stat-value">{stats.totalUses}</div>
        <div class="stat-label">Total Uses</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">📈</div>
      <div class="stat-content">
        <div class="stat-value">{stats.averageUsesPerQuery.toFixed(1)}</div>
        <div class="stat-label">Avg. Uses/Query</div>
      </div>
    </div>
  </div>

  <!-- Most Used Queries -->
  <div class="section">
    <h4>🔥 Most Used Queries</h4>
    {#if mostUsed.length > 0}
      <div class="query-list">
        {#each mostUsed as query, index (query.id)}
          <div class="query-item">
            <div class="query-rank">#{index + 1}</div>
            <div class="query-info">
              <div class="query-name">{query.name}</div>
              {#if query.description}
                <div class="query-description">{query.description}</div>
              {/if}
            </div>
            <div class="query-usage">
              <div class="usage-count">{query.useCount || 0} uses</div>
              {#if query.lastUsedAt}
                <div class="usage-time">{formatDate(query.lastUsedAt)}</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-message">No queries used yet</div>
    {/if}
  </div>

  <!-- Recently Used Queries -->
  <div class="section">
    <h4>🕒 Recently Used</h4>
    {#if recentlyUsed.length > 0}
      <div class="query-list compact">
        {#each recentlyUsed as query (query.id)}
          <div class="query-item-compact">
            <div class="query-name">{query.name}</div>
            <div class="query-time">{formatDate(query.lastUsedAt || query.updatedAt)}</div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-message">No recent activity</div>
    {/if}
  </div>

  <!-- Pinned Queries -->
  {#if pinned.length > 0}
    <div class="section">
      <h4>📌 Pinned Queries</h4>
      <div class="query-list compact">
        {#each pinned as query (query.id)}
          <div class="query-item-compact">
            <div class="query-name">{query.name}</div>
            <div class="query-count">{query.useCount || 0} uses</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Tag Distribution -->
  {#if tagDistribution.length > 0}
    <div class="section">
      <h4>🏷️ Top Tags</h4>
      <div class="distribution-list">
        {#each tagDistribution as item (item.tag)}
          <div class="distribution-item">
            <div class="distribution-label">{item.tag}</div>
            <div class="distribution-bar-container">
              <div
                class="distribution-bar"
                style="width: {getPercentage(item.count, stats.totalQueries)}%;"
              ></div>
            </div>
            <div class="distribution-value">{item.count}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Folder Distribution -->
  {#if folderDistribution.length > 0}
    <div class="section">
      <h4>📂 Folder Distribution</h4>
      <div class="distribution-list">
        {#each folderDistribution as item (item.folder)}
          <div class="distribution-item">
            <div class="distribution-label">{item.folder}</div>
            <div class="distribution-bar-container">
              <div
                class="distribution-bar folder-bar"
                style="width: {getPercentage(item.count, stats.totalQueries)}%;"
              ></div>
            </div>
            <div class="distribution-value">{item.count}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Additional Insights -->
  <div class="insights-section">
    <h4>💡 Insights</h4>
    <div class="insights-list">
      {#if stats.totalQueries === 0}
        <div class="insight-item">
          <span class="insight-icon">💭</span>
          <span class="insight-text">No saved queries yet. Start by creating your first query!</span>
        </div>
      {:else}
        {#if stats.averageUsesPerQuery < 1}
          <div class="insight-item">
            <span class="insight-icon">📝</span>
            <span class="insight-text">Most queries haven't been used yet. Try running some!</span>
          </div>
        {/if}
        
        {#if stats.totalFolders === 0 && stats.totalQueries > 5}
          <div class="insight-item">
            <span class="insight-icon">📁</span>
            <span class="insight-text">Consider organizing your queries into folders</span>
          </div>
        {/if}
        
        {#if tagDistribution.length === 0 && stats.totalQueries > 3}
          <div class="insight-item">
            <span class="insight-icon">🏷️</span>
            <span class="insight-text">Add tags to your queries for better organization</span>
          </div>
        {/if}
        
        {#if mostUsed.length > 0 && mostUsed[0].useCount && mostUsed[0].useCount > stats.totalQueries}
          <div class="insight-item">
            <span class="insight-icon">⭐</span>
            <span class="insight-text">"{mostUsed[0].name}" is your go-to query!</span>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .stats-dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem;
    background: var(--background-secondary);
    border-radius: 8px;
    max-height: 100%;
    overflow-y: auto;
  }

  .dashboard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .dashboard-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .btn-refresh {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .btn-refresh:hover {
    background: var(--background-modifier-hover);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--background-primary);
    border-radius: 8px;
    border: 1px solid var(--background-modifier-border);
  }

  .stat-icon {
    font-size: 2rem;
  }

  .stat-content {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-accent);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section {
    background: var(--background-primary);
    border-radius: 8px;
    padding: 1rem;
  }

  .section h4 {
    margin: 0 0 1rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  .query-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .query-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--background-secondary);
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
  }

  .query-rank {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-accent);
    min-width: 2rem;
    text-align: center;
  }

  .query-info {
    flex: 1;
    min-width: 0;
  }

  .query-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .query-description {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .query-usage {
    text-align: right;
  }

  .usage-count {
    font-weight: 600;
    color: var(--text-accent);
  }

  .usage-time {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }

  .query-list.compact {
    gap: 0.5rem;
  }

  .query-item-compact {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--background-secondary);
    border-radius: 4px;
  }

  .query-time,
  .query-count {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .distribution-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .distribution-item {
    display: grid;
    grid-template-columns: minmax(80px, 150px) 1fr auto;
    align-items: center;
    gap: 1rem;
  }

  .distribution-label {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .distribution-bar-container {
    background: var(--background-modifier-border);
    border-radius: 4px;
    height: 20px;
    overflow: hidden;
  }

  .distribution-bar {
    background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover));
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
    min-width: 2px;
  }

  .distribution-bar.folder-bar {
    background: linear-gradient(90deg, #10b981, #059669);
  }

  .distribution-value {
    font-weight: 600;
    color: var(--text-accent);
    min-width: 2rem;
    text-align: right;
  }

  .insights-section {
    background: var(--background-primary);
    border-radius: 8px;
    padding: 1rem;
  }

  .insights-section h4 {
    margin: 0 0 1rem 0;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .insights-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .insight-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--background-secondary);
    border-radius: 6px;
    border-left: 3px solid var(--interactive-accent);
  }

  .insight-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .insight-text {
    line-height: 1.5;
    color: var(--text-normal);
  }

  .empty-message {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
