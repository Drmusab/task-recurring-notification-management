<script lang="ts">
  import { onMount } from "svelte";
  import type { Task } from "@backend/core/models/Task";
  import { predictiveEngine, type CompletionProbability, type PredictiveInsights } from "@backend/core/analytics/PredictiveEngine";
  import { identifyRiskyTasks, type TaskRiskAssessment } from "@backend/core/analytics/CompletionProbabilityCalculator";
  
  export let tasks: Task[] = [];
  
  let riskyTasks: TaskRiskAssessment[] = [];
  let selectedTaskInsights: PredictiveInsights | null = null;
  let selectedTaskProbability: CompletionProbability | null = null;
  let selectedTask: Task | null = null;
  
  $: {
    // Update risky tasks when tasks change
    riskyTasks = identifyRiskyTasks(tasks, 10);
  }
  
  function selectTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    selectedTask = task;
    selectedTaskInsights = predictiveEngine.generateInsights(task);
    selectedTaskProbability = predictiveEngine.calculateCompletionProbability(task);
  }
  
  function formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  
  function formatHour(hour: number): string {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${ampm}`;
  }
  
  function formatDayOfWeek(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  }
  
  function getRiskColor(level: string): string {
    switch (level) {
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#f97316';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  }
  
  function getRiskIcon(level: string): string {
    switch (level) {
      case 'low': return '✅';
      case 'medium': return '⚠️';
      case 'high': return '🔶';
      case 'critical': return '🔴';
      default: return '❓';
    }
  }
</script>

<div class="predictive-insights-panel">
  <div class="panel-header">
    <h3>🔮 Predictive Insights</h3>
    <p class="subtitle">ML-powered task completion predictions</p>
  </div>
  
  <!-- Risk Dashboard -->
  <div class="risk-dashboard">
    <h4>⚠️ Tasks Requiring Attention</h4>
    
    {#if riskyTasks.length === 0}
      <div class="empty-state">
        <span class="empty-icon">🎯</span>
        <p>All tasks on track!</p>
      </div>
    {:else}
      <div class="risky-tasks-list">
        {#each riskyTasks as riskTask}
          <div
            class="risk-card"
            class:urgent={riskTask.urgentAction}
            on:click={() => selectTask(riskTask.taskId)}
            on:keydown={(e) => e.key === 'Enter' && selectTask(riskTask.taskId)}
            role="button"
            tabindex="0"
          >
            <div class="risk-header">
              <span class="risk-icon">{getRiskIcon(riskTask.riskLevel)}</span>
              <span class="task-name">{riskTask.taskName}</span>
              <span
                class="risk-badge"
                style="background-color: {getRiskColor(riskTask.riskLevel)};"
              >
                {riskTask.riskLevel}
              </span>
            </div>
            
            <div class="risk-details">
              <div class="detail-item">
                <span class="label">Completion Probability:</span>
                <span class="value">{Math.round(riskTask.completionProbability * 100)}%</span>
              </div>
              <div class="detail-item">
                <span class="label">Due In:</span>
                <span class="value">{formatDuration(riskTask.dueIn)}</span>
              </div>
            </div>
            
            <div class="recommendation">
              💡 {riskTask.recommendation}
            </div>
            
            {#if riskTask.urgentAction}
              <div class="urgent-banner">
                🚨 URGENT ACTION NEEDED
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
  
  <!-- Detailed Insights (when task selected) -->
  {#if selectedTask && selectedTaskInsights && selectedTaskProbability}
    <div class="detailed-insights">
      <div class="insights-header">
        <h4>📊 Detailed Analysis: {selectedTask.name}</h4>
        <button
          class="close-btn"
          on:click={() => {
            selectedTask = null;
            selectedTaskInsights = null;
            selectedTaskProbability = null;
          }}
        >
          ✕
        </button>
      </div>
      
      <!-- Probability Gauge -->
      <div class="probability-section">
        <div class="probability-gauge">
          <div
            class="gauge-fill"
            style="width: {selectedTaskProbability.probability * 100}%"
          ></div>
          <span class="gauge-label">
            {Math.round(selectedTaskProbability.probability * 100)}%
          </span>
        </div>
        <p class="probability-explanation">{selectedTaskProbability.explanation}</p>
        <div class="recommendation-box">
          {selectedTaskProbability.recommendation}
        </div>
      </div>
      
      <!-- Model Breakdown -->
      <div class="model-breakdown">
        <h5>Model Contributions</h5>
        <div class="model-list">
          <div class="model-item">
            <span class="model-name">⏰ Time of Day</span>
            <div class="model-bar">
              <div
                class="model-fill"
                style="width: {selectedTaskProbability.modelContributions.timeOfDay * 100}%"
              ></div>
            </div>
            <span class="model-value">
              {Math.round(selectedTaskProbability.modelContributions.timeOfDay * 100)}%
            </span>
          </div>
          
          <div class="model-item">
            <span class="model-name">📅 Day of Week</span>
            <div class="model-bar">
              <div
                class="model-fill"
                style="width: {selectedTaskProbability.modelContributions.dayOfWeek * 100}%"
              ></div>
            </div>
            <span class="model-value">
              {Math.round(selectedTaskProbability.modelContributions.dayOfWeek * 100)}%
            </span>
          </div>
          
          <div class="model-item">
            <span class="model-name">🔄 Consistency</span>
            <div class="model-bar">
              <div
                class="model-fill"
                style="width: {selectedTaskProbability.modelContributions.consistency * 100}%"
              ></div>
            </div>
            <span class="model-value">
              {Math.round(selectedTaskProbability.modelContributions.consistency * 100)}%
            </span>
          </div>
          
          <div class="model-item">
            <span class="model-name">⌚ Delay Pattern</span>
            <div class="model-bar">
              <div
                class="model-fill"
                style="width: {selectedTaskProbability.modelContributions.delayPattern * 100}%"
              ></div>
            </div>
            <span class="model-value">
              {Math.round(selectedTaskProbability.modelContributions.delayPattern * 100)}%
            </span>
          </div>
        </div>
      </div>
      
      <!-- Optimal Patterns -->
      <div class="optimal-patterns">
        <h5>🎯 Optimal Patterns</h5>
        <div class="patterns-grid">
          <div class="pattern-card">
            <span class="pattern-icon">⏰</span>
            <span class="pattern-label">Best Time</span>
            <span class="pattern-value">{formatHour(selectedTaskInsights.optimalHour)}</span>
          </div>
          
          <div class="pattern-card">
            <span class="pattern-icon">📅</span>
            <span class="pattern-label">Best Day</span>
            <span class="pattern-value">{formatDayOfWeek(selectedTaskInsights.optimalDayOfWeek)}</span>
          </div>
          
          <div class="pattern-card">
            <span class="pattern-icon">⏱️</span>
            <span class="pattern-label">Avg Duration</span>
            <span class="pattern-value">{formatDuration(selectedTaskInsights.expectedDuration)}</span>
          </div>
          
          <div class="pattern-card">
            <span class="pattern-icon">📈</span>
            <span class="pattern-label">Consistency</span>
            <span class="pattern-value">{selectedTaskInsights.consistencyScore}/100</span>
          </div>
        </div>
      </div>
      
      <!-- Risk Metrics -->
      <div class="risk-metrics">
        <div class="metric-item">
          <span class="metric-label">Lateness Risk:</span>
          <div class="metric-bar">
            <div
              class="metric-fill risk"
              style="width: {selectedTaskInsights.latenessRisk * 100}%"
            ></div>
          </div>
          <span class="metric-value">{Math.round(selectedTaskInsights.latenessRisk * 100)}%</span>
        </div>
        
        <div class="metric-item">
          <span class="metric-label">Pattern Strength:</span>
          <div class="metric-bar">
            <div
              class="metric-fill strength"
              style="width: {selectedTaskInsights.patternStrength * 100}%"
            ></div>
          </div>
          <span class="metric-value">{Math.round(selectedTaskInsights.patternStrength * 100)}%</span>
        </div>
        
        <div class="metric-item">
          <span class="metric-label">Confidence:</span>
          <div class="metric-bar">
            <div
              class="metric-fill confidence"
              style="width: {selectedTaskProbability.confidence * 100}%"
            ></div>
          </div>
          <span class="metric-value">{Math.round(selectedTaskProbability.confidence * 100)}%</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .predictive-insights-panel {
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    color: white;
    margin-bottom: 20px;
  }
  
  .panel-header {
    margin-bottom: 20px;
  }
  
  .panel-header h3 {
    margin: 0 0 5px 0;
    font-size: 1.5rem;
    font-weight: 700;
  }
  
  .subtitle {
    margin: 0;
    font-size: 0.875rem;
    opacity: 0.9;
  }
  
  .risk-dashboard {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }
  
  .risk-dashboard h4 {
    margin: 0 0 12px 0;
    font-size: 1rem;
    font-weight: 600;
  }
  
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    opacity: 0.8;
  }
  
  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 8px;
  }
  
  .risky-tasks-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .risk-card {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    padding: 12px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .risk-card:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }
  
  .risk-card.urgent {
    border-color: #ef4444;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { border-color: #ef4444; }
    50% { border-color: #fca5a5; }
  }
  
  .risk-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .risk-icon {
    font-size: 1.2rem;
  }
  
  .task-name {
    flex: 1;
    font-weight: 600;
    font-size: 0.95rem;
  }
  
  .risk-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: white;
  }
  
  .risk-details {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
    font-size: 0.875rem;
  }
  
  .detail-item {
    display: flex;
    gap: 4px;
  }
  
  .detail-item .label {
    opacity: 0.9;
  }
  
  .detail-item .value {
    font-weight: 600;
  }
  
  .recommendation {
    font-size: 0.875rem;
    font-style: italic;
    opacity: 0.95;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .urgent-banner {
    margin-top: 8px;
    padding: 6px 12px;
    background: #ef4444;
    border-radius: 4px;
    text-align: center;
    font-weight: 700;
    font-size: 0.875rem;
    animation: flash 1s infinite;
  }
  
  @keyframes flash {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  .detailed-insights {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 16px;
  }
  
  .insights-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .insights-header h4 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }
  
  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  .probability-section {
    margin-bottom: 20px;
  }
  
  .probability-gauge {
    position: relative;
    height: 40px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  
  .gauge-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #3b82f6);
    transition: width 0.5s ease;
  }
  
  .gauge-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 1.2rem;
    font-weight: 700;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  .probability-explanation {
    font-size: 0.9rem;
    opacity: 0.95;
    margin-bottom: 12px;
  }
  
  .recommendation-box {
    background: rgba(255, 255, 255, 0.15);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 0.9rem;
    border-left: 3px solid #fbbf24;
  }
  
  .model-breakdown {
    margin-bottom: 20px;
  }
  
  .model-breakdown h5 {
    margin: 0 0 12px 0;
    font-size: 0.95rem;
    font-weight: 600;
  }
  
  .model-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .model-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .model-name {
    flex: 0 0 140px;
    font-size: 0.875rem;
  }
  
  .model-bar {
    flex: 1;
    height: 20px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    overflow: hidden;
  }
  
  .model-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #ec4899);
    transition: width 0.5s ease;
  }
  
  .model-value {
    flex: 0 0 50px;
    text-align: right;
    font-size: 0.875rem;
    font-weight: 600;
  }
  
  .optimal-patterns {
    margin-bottom: 20px;
  }
  
  .optimal-patterns h5 {
    margin: 0 0 12px 0;
    font-size: 0.95rem;
    font-weight: 600;
  }
  
  .patterns-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
  }
  
  .pattern-card {
    background: rgba(255, 255, 255, 0.15);
    padding: 12px;
    border-radius: 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .pattern-icon {
    font-size: 1.5rem;
  }
  
  .pattern-label {
    font-size: 0.75rem;
    opacity: 0.9;
  }
  
  .pattern-value {
    font-size: 0.95rem;
    font-weight: 700;
  }
  
  .risk-metrics {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .metric-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .metric-label {
    flex: 0 0 140px;
    font-size: 0.875rem;
  }
  
  .metric-bar {
    flex: 1;
    height: 18px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 9px;
    overflow: hidden;
  }
  
  .metric-fill {
    height: 100%;
    transition: width 0.5s ease;
  }
  
  .metric-fill.risk {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }
  
  .metric-fill.strength {
    background: linear-gradient(90deg, #10b981, #059669);
  }
  
  .metric-fill.confidence {
    background: linear-gradient(90deg, #3b82f6, #2563eb);
  }
  
  .metric-value {
    flex: 0 0 50px;
    text-align: right;
    font-size: 0.875rem;
    font-weight: 600;
  }
  
  @media (max-width: 768px) {
    .predictive-insights-panel {
      padding: 16px;
    }
    
    .patterns-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .model-name,
    .metric-label {
      flex: 0 0 100px;
      font-size: 0.8rem;
    }
  }
</style>
