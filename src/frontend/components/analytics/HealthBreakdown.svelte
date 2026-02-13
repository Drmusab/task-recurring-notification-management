<script lang="ts">
  import type { Task } from "@backend/core/models/Task";
  import { calculateHealthBreakdown, calculateTaskHealth } from "@backend/core/analytics/CompletionProbabilityCalculator";
  
  export let tasks: Task[] = [];
  
  let healthCategories: { healthy: Task[]; moderate: Task[]; struggling: Task[] } = {
    healthy: [],
    moderate: [],
    struggling: [],
  };
  let selectedCategory: 'healthy' | 'moderate' | 'struggling' | null = null;
  let expandedTasks = new Set<string>();
  
  $: {
    healthCategories = calculateHealthBreakdown(tasks);
  }
  
  function getCategoryColor(category: string): string {
    switch (category) {
      case 'healthy': return '#10b981';
      case 'moderate': return '#f59e0b';
      case 'struggling': return '#ef4444';
      default: return '#6b7280';
    }
  }
  
  function getCategoryIcon(category: string): string {
    switch (category) {
      case 'healthy': return '✅';
      case 'moderate': return '⚠️';
      case 'struggling': return '🔴';
      default: return '📊';
    }
  }
  
  function getCategoryDescription(category: string): string {
    switch (category) {
      case 'healthy': return 'Consistently completing on time with good patterns';
      case 'moderate': return 'Some delays or inconsistency, needs attention';
      case 'struggling': return 'Frequent misses or late completions, requires intervention';
      default: return '';
    }
  }
  
  function toggleTaskExpansion(taskId: string) {
    if (expandedTasks.has(taskId)) {
      expandedTasks.delete(taskId);
    } else {
      expandedTasks.add(taskId);
    }
    expandedTasks = expandedTasks; // Trigger reactivity
  }
  
  function getHealthColorForScore(health: number): string {
    if (health >= 80) return '#10b981';
    if (health >= 50) return '#f59e0b';
    return '#ef4444';
  }
</script>

<div class="health-breakdown">
  <div class="breakdown-header">
    <h3>💊 Task Health Breakdown</h3>
    <p class="subtitle">Distribution of tasks by performance health</p>
  </div>
  
  <!-- Health Distribution Cards -->
  <div class="health-categories">
    <!-- Healthy Tasks -->
    <div
      class="category-card healthy"
      class:selected={selectedCategory === 'healthy'}
      on:click={() => selectedCategory = selectedCategory === 'healthy' ? null : 'healthy'}
      on:keydown={(e) => e.key === 'Enter' && (selectedCategory = selectedCategory === 'healthy' ? null : 'healthy')}
      role="button"
      tabindex="0"
    >
      <div class="card-icon">{getCategoryIcon('healthy')}</div>
      <div class="card-content">
        <h4>Healthy</h4>
        <div class="card-count">{healthCategories.healthy.length}</div>
        <div class="card-percentage">
          {tasks.length > 0 ? Math.round((healthCategories.healthy.length / tasks.length) * 100) : 0}%
        </div>
        <p class="card-description">{getCategoryDescription('healthy')}</p>
      </div>
      <div class="card-arrow">{selectedCategory === 'healthy' ? '▼' : '▶'}</div>
    </div>
    
    <!-- Moderate Tasks -->
    <div
      class="category-card moderate"
      class:selected={selectedCategory === 'moderate'}
      on:click={() => selectedCategory = selectedCategory === 'moderate' ? null : 'moderate'}
      on:keydown={(e) => e.key === 'Enter' && (selectedCategory = selectedCategory === 'moderate' ? null : 'moderate')}
      role="button"
      tabindex="0"
    >
      <div class="card-icon">{getCategoryIcon('moderate')}</div>
      <div class="card-content">
        <h4>Moderate</h4>
        <div class="card-count">{healthCategories.moderate.length}</div>
        <div class="card-percentage">
          {tasks.length > 0 ? Math.round((healthCategories.moderate.length / tasks.length) * 100) : 0}%
        </div>
        <p class="card-description">{getCategoryDescription('moderate')}</p>
      </div>
      <div class="card-arrow">{selectedCategory === 'moderate' ? '▼' : '▶'}</div>
    </div>
    
    <!-- Struggling Tasks -->
    <div
      class="category-card struggling"
      class:selected={selectedCategory === 'struggling'}
      on:click={() => selectedCategory = selectedCategory === 'struggling' ? null : 'struggling'}
      on:keydown={(e) => e.key === 'Enter' && (selectedCategory = selectedCategory === 'struggling' ? null : 'struggling')}
      role="button"
      tabindex="0"
    >
      <div class="card-icon">{getCategoryIcon('struggling')}</div>
      <div class="card-content">
        <h4>Struggling</h4>
        <div class="card-count">{healthCategories.struggling.length}</div>
        <div class="card-percentage">
          {tasks.length > 0 ? Math.round((healthCategories.struggling.length / tasks.length) * 100) : 0}%
        </div>
        <p class="card-description">{getCategoryDescription('struggling')}</p>
      </div>
      <div class="card-arrow">{selectedCategory === 'struggling' ? '▼' : '▶'}</div>
    </div>
  </div>
  
  <!-- Task List for Selected Category -->
  {#if selectedCategory}
    <div class="task-list-section">
      <h4>{selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Tasks</h4>
      
      {#if healthCategories[selectedCategory].length === 0}
        <div class="empty-list">
          <span class="empty-icon">🎉</span>
          <p>No {selectedCategory} tasks!</p>
        </div>
      {:else}
        <div class="task-list">
          {#each healthCategories[selectedCategory] as task}
            {@const health = calculateTaskHealth(task)}
            {@const isExpanded = expandedTasks.has(task.id)}
            
            <div class="task-item">
              <div class="task-header" on:click={() => toggleTaskExpansion(task.id)} on:keydown={(e) => e.key === 'Enter' && toggleTaskExpansion(task.id)} role="button" tabindex="0">
                <span class="task-name">{task.name}</span>
                <div class="health-indicator">
                  <div class="health-bar">
                    <div
                      class="health-fill"
                      style="width: {health}%; background-color: {getHealthColorForScore(health)};"
                    ></div>
                  </div>
                  <span class="health-value">{health}/100</span>
                </div>
                <span class="expand-arrow">{isExpanded ? '▼' : '▶'}</span>
              </div>
              
              {#if isExpanded}
                <div class="task-details">
                  <div class="detail-grid">
                    <div class="detail-item">
                      <span class="detail-label">Completions:</span>
                      <span class="detail-value">{task.completionCount || 0}</span>
                    </div>
                    
                    <div class="detail-item">
                      <span class="detail-label">Misses:</span>
                      <span class="detail-value">{task.missCount || 0}</span>
                    </div>
                    
                    <div class="detail-item">
                      <span class="detail-label">Current Streak:</span>
                      <span class="detail-value">{task.currentStreak || 0}</span>
                    </div>
                    
                    <div class="detail-item">
                      <span class="detail-label">Best Streak:</span>
                      <span class="detail-value">{task.bestStreak || 0}</span>
                    </div>
                    
                    {#if task.learningMetrics}
                      <div class="detail-item">
                        <span class="detail-label">Avg Delay:</span>
                        <span class="detail-value">{task.learningMetrics.averageDelayMinutes}m</span>
                      </div>
                      
                      <div class="detail-item">
                        <span class="detail-label">Consistency:</span>
                        <span class="detail-value">{task.learningMetrics.consistencyScore}/100</span>
                      </div>
                    {/if}
                  </div>
                  
                  {#if selectedCategory === 'struggling'}
                    <div class="action-recommendations">
                      <h5>💡 Recommendations:</h5>
                      <ul>
                        <li>Review time allocation for this task</li>
                        <li>Consider breaking into smaller sub-tasks</li>
                        <li>Adjust recurrence pattern if too frequent</li>
                        <li>Set reminders before due time</li>
                      </ul>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Health Distribution Chart -->
  <div class="distribution-chart">
    <h4>📊 Health Distribution</h4>
    <div class="chart-bars">
      <div class="bar-group">
        <div class="bar-label">Healthy</div>
        <div class="bar-container">
          <div
            class="bar healthy"
            style="width: {tasks.length > 0 ? (healthCategories.healthy.length / tasks.length) * 100 : 0}%;"
          ></div>
          <span class="bar-count">{healthCategories.healthy.length}</span>
        </div>
      </div>
      
      <div class="bar-group">
        <div class="bar-label">Moderate</div>
        <div class="bar-container">
          <div
            class="bar moderate"
            style="width: {tasks.length > 0 ? (healthCategories.moderate.length / tasks.length) * 100 : 0}%;"
          ></div>
          <span class="bar-count">{healthCategories.moderate.length}</span>
        </div>
      </div>
      
      <div class="bar-group">
        <div class="bar-label">Struggling</div>
        <div class="bar-container">
          <div
            class="bar struggling"
            style="width: {tasks.length > 0 ? (healthCategories.struggling.length / tasks.length) * 100 : 0}%;"
          ></div>
          <span class="bar-count">{healthCategories.struggling.length}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .health-breakdown {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .breakdown-header {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 2px solid #e5e7eb;
  }
  
  .breakdown-header h3 {
    margin: 0 0 5px 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: #1f2937;
  }
  
  .subtitle {
    margin: 0;
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .health-categories {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  
  .category-card {
    position: relative;
    padding: 20px;
    border-radius: 10px;
    border: 3px solid;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .category-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }
  
  .category-card.selected {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  }
  
  .category-card.healthy {
    border-color: #10b981;
    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
 }
  
  .category-card.moderate {
    border-color: #f59e0b;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  }
  
  .category-card.struggling {
    border-color: #ef4444;
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  }
  
  .card-icon {
    font-size: 3rem;
    margin-bottom: 12px;
  }
  
  .card-content {
    text-align: center;
    flex: 1;
  }
  
  .card-content h4 {
    margin: 0 0 8px 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #1f2937;
  }
  
  .card-count {
    font-size: 2.5rem;
    font-weight: 800;
    color: #1f2937;
    line-height: 1;
    margin-bottom: 4px;
  }
  
  .card-percentage {
    font-size: 1rem;
    font-weight: 600;
    color: #6b7280;
    margin-bottom: 8px;
  }
  
  .card-description {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.4;
  }
  
  .card-arrow {
    position: absolute;
    top: 10px;
    right: 10px;
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .task-list-section {
    background: #f9fafb;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }
  
  .task-list-section h4 {
    margin: 0 0 12px 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
  }
  
  .empty-list {
    text-align: center;
    padding: 40px 20px;
  }
  
  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 8px;
  }
  
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .task-item {
    background: white;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
  }
  
  .task-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .task-header:hover {
    background: #f9fafb;
  }
  
  .task-name {
    flex: 1;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1f2937;
  }
  
  .health-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .health-bar {
    width: 100px;
    height: 18px;
    background: #e5e7eb;
    border-radius: 9px;
    overflow: hidden;
  }
  
  .health-fill {
    height: 100%;
    transition: width 0.5s ease;
  }
  
  .health-value {
    font-size: 0.875rem;
    font-weight: 700;
    color: #1f2937;
    min-width: 50px;
    text-align: right;
  }
  
  .expand-arrow {
    font-size: 0.75rem;
    color: #6b7280;
  }
  
  .task-details {
    padding: 12px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }
  
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .detail-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 8px;
    background: white;
    border-radius: 4px;
  }
  
  .detail-label {
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .detail-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
  }
  
  .action-recommendations {
    background: #fffbeb;
    border-left: 3px solid #f59e0b;
    padding: 12px;
    border-radius: 4px;
  }
  
  .action-recommendations h5 {
    margin: 0 0 8px 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
  }
  
  .action-recommendations ul {
    margin: 0;
    padding-left: 20px;
    font-size: 0.875rem;
    color: #6b7280;
    line-height: 1.6;
  }
  
  .action-recommendations li {
    margin-bottom: 4px;
  }
  
  .distribution-chart {
    background: #f9fafb;
    border-radius: 8px;
    padding: 16px;
  }
  
  .distribution-chart h4 {
    margin: 0 0 16px 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
  }
  
  .chart-bars {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .bar-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .bar-label {
    flex: 0 0 80px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
  }
  
  .bar-container {
    flex: 1;
    position: relative;
    height: 32px;
    background: #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
  }
  
  .bar {
    height: 100%;
    transition: width 0.5s ease;
  }
  
  .bar.healthy {
    background: linear-gradient(90deg, #10b981, #059669);
  }
  
  .bar.moderate {
    background: linear-gradient(90deg, #f59e0b, #d97706);
  }
  
  .bar.struggling {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }
  
  .bar-count {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.875rem;
    font-weight: 700;
    color: #1f2937;
  }
  
  @media (max-width: 768px) {
    .health-categories {
      grid-template-columns: 1fr;
    }
    
    .detail-grid {
      grid-template-columns: 1fr;
    }
    
    .bar-label {
      flex: 0 0 60px;
      font-size: 0.75rem;
    }
  }
</style>
