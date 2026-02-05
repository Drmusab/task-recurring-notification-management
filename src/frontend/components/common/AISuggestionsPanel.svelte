<script lang="ts">
  /**
   * AI Suggestions Panel
   * 
   * Displays AI-driven recommendations for task optimization.
   * All features are rule-based (no external ML services).
   * User must approve all suggestions before they're applied.
   */
  
  import { SmartSuggestionEngine, type TaskSuggestion } from '@backend/core/ai/SmartSuggestionEngine';
  import type { UnifiedTask } from '@backend/adapters/TaskModelAdapter';
  import { TaskModelAdapter } from '@backend/adapters/TaskModelAdapter';
  import { t } from '@stores/i18nStore';
  
  export let task: UnifiedTask;
  export let allTasks: UnifiedTask[] = [];
  export let onApplySuggestion: (suggestion: TaskSuggestion) => void;
  
  let engine = new SmartSuggestionEngine();
  let currentSuggestions: TaskSuggestion[] = [];
  let isAnalyzing = false;
  let selectedFeature: string | null = null;
  
  // Feature states
  let abandonmentSuggestion: TaskSuggestion | null = null;
  let rescheduleSuggestion: TaskSuggestion | null = null;
  let urgencySuggestion: TaskSuggestion | null = null;
  let frequencySuggestion: TaskSuggestion | null = null;
  let consolidationSuggestions: TaskSuggestion[] = [];
  let delegationSuggestion: TaskSuggestion | null = null;
  
  /**
   * Analyze all suggestions for current task
   */
  async function analyzeAll() {
    if (!TaskModelAdapter.hasAIData(task)) {
      alert('No completion history available for AI analysis. Complete this task a few times first.');
      return;
    }
    
    isAnalyzing = true;
    selectedFeature = 'all';
    
    try {
      // Analyze single-task patterns
      const taskSuggestions = await engine.analyzeTask(task as any, allTasks as any);
      
      // Analyze cross-task patterns
      const crossSuggestions = await engine.analyzeCrossTaskPatterns(allTasks as any);
      
      currentSuggestions = [...taskSuggestions, ...crossSuggestions];
      
      // Categorize suggestions
      abandonmentSuggestion = currentSuggestions.find(s => s.type === 'abandon') || null;
      rescheduleSuggestion = currentSuggestions.find(s => s.type === 'reschedule') || null;
      urgencySuggestion = currentSuggestions.find(s => s.type === 'urgency') || null;
      frequencySuggestion = currentSuggestions.find(s => s.type === 'frequency') || null;
      consolidationSuggestions = currentSuggestions.filter(s => s.type === 'consolidate');
      delegationSuggestion = currentSuggestions.find(s => s.type === 'delegate') || null;
      
    } catch (error) {
      console.error('AI Analysis failed:', error);
      alert(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      isAnalyzing = false;
    }
  }
  
  /**
   * Analyze specific feature
   */
  async function analyzeFeature(feature: string) {
    isAnalyzing = true;
    selectedFeature = feature;
    
    try {
      const suggestions = await engine.analyzeTask(task as any, allTasks as any);
      const featureSuggestion = suggestions.find(s => s.type === feature as any);
      
      switch (feature) {
        case 'abandon':
          abandonmentSuggestion = featureSuggestion || null;
          break;
        case 'reschedule':
          rescheduleSuggestion = featureSuggestion || null;
          break;
        case 'urgency':
          urgencySuggestion = featureSuggestion || null;
          break;
        case 'frequency':
          frequencySuggestion = featureSuggestion || null;
          break;
      }
      
      if (!featureSuggestion) {
        alert('No suggestions for this feature at this time.');
      }
    } catch (error) {
      console.error(`${feature} analysis failed:`, error);
      alert(`${feature} analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      isAnalyzing = false;
    }
  }
  
  /**
   * Apply a suggestion - with null check
   */
  function applySuggestion(suggestion: TaskSuggestion | null) {
    if (!suggestion) return;
    
    if (!confirm(`Apply suggestion: ${suggestion.reason}\n\nThis will modify your task. Continue?`)) {
      return;
    }
    
    onApplySuggestion(suggestion);
    
    // Clear the applied suggestion
    switch (suggestion.type) {
      case 'abandon':
        abandonmentSuggestion = null;
        break;
      case 'reschedule':
        rescheduleSuggestion = null;
        break;
      case 'urgency':
        urgencySuggestion = null;
        break;
      case 'frequency':
        frequencySuggestion = null;
        break;
      case 'consolidate':
        consolidationSuggestions = consolidationSuggestions.filter(s => s.id !== suggestion.id);
        break;
      case 'delegate':
        delegationSuggestion = null;
        break;
    }
  }
  
  /**
   * Dismiss a suggestion - with null check
   */
  function dismissSuggestion(suggestion: TaskSuggestion | null) {
    if (!suggestion) return;
    
    suggestion.dismissed = true;
    
    // Remove from UI
    switch (suggestion.type) {
      case 'abandon':
        abandonmentSuggestion = null;
        break;
      case 'reschedule':
        rescheduleSuggestion = null;
        break;
      case 'urgency':
        urgencySuggestion = null;
        break;
      case 'frequency':
        frequencySuggestion = null;
        break;
      case 'consolidate':
        consolidationSuggestions = consolidationSuggestions.filter(s => s.id !== suggestion.id);
        break;
      case 'delegate':
        delegationSuggestion = null;
        break;
    }
  }
  
  /**
   * Format confidence as percentage
   */
  function formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }
  
  /**
   * Get confidence color class
   */
  function getConfidenceClass(confidence: number): string {
    if (confidence >= 0.8) return 'confidence-high';
    if (confidence >= 0.6) return 'confidence-medium';
    return 'confidence-low';
  }
</script>

<section class="tasks-modal-ai-section">
  <div class="ai-header">
    <h3>🤖 {$t('ai.title')}</h3>
    <button 
      class="ai-analyze-all" 
      on:click={analyzeAll} 
      disabled={isAnalyzing}
    >
      {isAnalyzing ? $t('ai.analyzing') : $t('ai.analyzeAll')}
    </button>
  </div>
  
  {#if !TaskModelAdapter.hasAIData(task)}
    <div class="ai-no-data">
      <p>⚠️ {$t('ai.noHistoryWarning')}</p>
    </div>
  {:else}
    <div class="ai-features">
      
      <!-- 1. Abandonment Detection -->
      <div class="ai-feature">
        <div class="ai-feature-header">
          <span class="ai-icon">🗑️</span>
          <span class="ai-feature-name">{$t('ai.features.abandonment.name')}</span>
          <button 
            class="ai-feature-btn" 
            on:click={() => analyzeFeature('abandon')}
            disabled={isAnalyzing}
          >
            Check
          </button>
        </div>
        {#if abandonmentSuggestion}
          <div class="ai-result">
            <div class="ai-result-header">
              <span class={getConfidenceClass(abandonmentSuggestion.confidence)}>
                {formatConfidence(abandonmentSuggestion.confidence)} confidence
              </span>
            </div>
            <p class="ai-reason">{abandonmentSuggestion.reason}</p>
            <div class="ai-actions">
              <button class="ai-apply" on:click={() => applySuggestion(abandonmentSuggestion)}>
                Apply
              </button>
              <button class="ai-dismiss" on:click={() => dismissSuggestion(abandonmentSuggestion)}>
                Dismiss
              </button>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- 2. Reschedule Suggestions -->
      <div class="ai-feature">
        <div class="ai-feature-header">
          <span class="ai-icon">⏰</span>
          <span class="ai-feature-name">{$t('ai.features.reschedule.name')}</span>
          <button 
            class="ai-feature-btn" 
            on:click={() => analyzeFeature('reschedule')}
            disabled={isAnalyzing}
          >
            Optimize
          </button>
        </div>
        {#if rescheduleSuggestion}
          <div class="ai-result">
            <div class="ai-result-header">
              <span class={getConfidenceClass(rescheduleSuggestion.confidence)}>
                {formatConfidence(rescheduleSuggestion.confidence)} confidence
              </span>
            </div>
            <p class="ai-reason">{rescheduleSuggestion.reason}</p>
            <div class="ai-actions">
              <button class="ai-apply" on:click={() => applySuggestion(rescheduleSuggestion)}>
                Apply
              </button>
              <button class="ai-dismiss" on:click={() => dismissSuggestion(rescheduleSuggestion)}>
                Dismiss
              </button>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- 3. Urgency Alerts -->
      <div class="ai-feature">
        <div class="ai-feature-header">
          <span class="ai-icon">⚠️</span>
          <span class="ai-feature-name">{$t('ai.features.urgency.name')}</span>
          <button 
            class="ai-feature-btn" 
            on:click={() => analyzeFeature('urgency')}
            disabled={isAnalyzing}
          >
            Check
          </button>
        </div>
        {#if urgencySuggestion}
          <div class="ai-result">
            <div class="ai-result-header">
              <span class={getConfidenceClass(urgencySuggestion.confidence)}>
                {formatConfidence(urgencySuggestion.confidence)} confidence
              </span>
            </div>
            <p class="ai-reason">{urgencySuggestion.reason}</p>
            <div class="ai-actions">
              <button class="ai-apply" on:click={() => applySuggestion(urgencySuggestion)}>
                Apply
              </button>
              <button class="ai-dismiss" on:click={() => dismissSuggestion(urgencySuggestion)}>
                Dismiss
              </button>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- 4. Frequency Optimization -->
      <div class="ai-feature">
        <div class="ai-feature-header">
          <span class="ai-icon">📊</span>
          <span class="ai-feature-name">{$t('ai.features.frequency.name')}</span>
          <button 
            class="ai-feature-btn" 
            on:click={() => analyzeFeature('frequency')}
            disabled={isAnalyzing}
          >
            Tune
          </button>
        </div>
        {#if frequencySuggestion}
          <div class="ai-result">
            <div class="ai-result-header">
              <span class={getConfidenceClass(frequencySuggestion.confidence)}>
                {formatConfidence(frequencySuggestion.confidence)} confidence
              </span>
            </div>
            <p class="ai-reason">{frequencySuggestion.reason}</p>
            <div class="ai-actions">
              <button class="ai-apply" on:click={() => applySuggestion(frequencySuggestion)}>
                Apply
              </button>
              <button class="ai-dismiss" on:click={() => dismissSuggestion(frequencySuggestion)}>
                Dismiss
              </button>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- 5. Consolidation (Cross-task analysis required) -->
      <div class="ai-feature">
        <div class="ai-feature-header">
          <span class="ai-icon">📦</span>
          <span class="ai-feature-name">{$t('ai.features.consolidation.name')}</span>
          <span class="ai-hint-text">(Requires 'Analyze All')</span>
        </div>
        {#each consolidationSuggestions as suggestion}
          <div class="ai-result">
            <div class="ai-result-header">
              <span class={getConfidenceClass(suggestion.confidence)}>
                {formatConfidence(suggestion.confidence)} confidence
              </span>
            </div>
            <p class="ai-reason">{suggestion.reason}</p>
            <div class="ai-actions">
              <button class="ai-apply" on:click={() => applySuggestion(suggestion)}>
                Apply
              </button>
              <button class="ai-dismiss" on:click={() => dismissSuggestion(suggestion)}>
                Dismiss
              </button>
            </div>
          </div>
        {/each}
      </div>
      
      <!-- 6. Delegation -->
      <div class="ai-feature">
        <div class="ai-feature-header">
          <span class="ai-icon">👥</span>
          <span class="ai-feature-name">{$t('ai.features.delegation.name')}</span>
          <span class="ai-hint-text">(Requires 'Analyze All')</span>
        </div>
        {#if delegationSuggestion}
          <div class="ai-result">
            <div class="ai-result-header">
              <span class={getConfidenceClass(delegationSuggestion.confidence)}>
                {formatConfidence(delegationSuggestion.confidence)} confidence
              </span>
            </div>
            <p class="ai-reason">{delegationSuggestion.reason}</p>
            <div class="ai-actions">
              <button class="ai-apply" on:click={() => applySuggestion(delegationSuggestion)}>
                Apply
              </button>
              <button class="ai-dismiss" on:click={() => dismissSuggestion(delegationSuggestion)}>
                Dismiss
              </button>
            </div>
          </div>
        {/if}
      </div>
      
    </div>
  {/if}
</section>

<style>
  .tasks-modal-ai-section {
    margin-top: 1.5em;
    padding: 1em;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
  }
  
  .ai-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1em;
  }
  
  .ai-header h3 {
    margin: 0;
    font-size: 1.1em;
    font-weight: 600;
  }
  
  .ai-analyze-all {
    padding: 0.5em 1em;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }
  
  .ai-analyze-all:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }
  
  .ai-analyze-all:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .ai-no-data {
    padding: 1.5em;
    text-align: center;
    color: var(--text-muted);
  }
  
  .ai-hint {
    font-size: 0.9em;
    margin-top: 0.5em;
  }
  
  .ai-features {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }
  
  .ai-feature {
    padding: 0.75em;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
  }
  
  .ai-feature-header {
    display: flex;
    align-items: center;
    gap: 0.5em;
    margin-bottom: 0.5em;
  }
  
  .ai-icon {
    font-size: 1.2em;
  }
  
  .ai-feature-name {
    flex: 1;
    font-weight: 500;
  }
  
  .ai-hint-text {
    font-size: 0.85em;
    color: var(--text-muted);
    font-style: italic;
  }
  
  .ai-feature-btn {
    padding: 0.4em 0.8em;
    background: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.9em;
  }
  
  .ai-feature-btn:hover:not(:disabled) {
    background: var(--background-modifier-active-hover);
  }
  
  .ai-feature-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .ai-result {
    margin-top: 0.75em;
    padding: 0.75em;
    background: var(--background-secondary);
    border-left: 3px solid var(--interactive-accent);
    border-radius: 3px;
  }
  
  .ai-result-header {
    margin-bottom: 0.5em;
  }
  
  .confidence-high {
    color: var(--text-success);
    font-weight: 600;
  }
  
  .confidence-medium {
    color: var(--text-warning);
    font-weight: 600;
  }
  
  .confidence-low {
    color: var(--text-muted);
    font-weight: 600;
  }
  
  .ai-reason {
    margin: 0.5em 0;
    line-height: 1.5;
    color: var(--text-normal);
  }
  
  .ai-actions {
    display: flex;
    gap: 0.5em;
    margin-top: 0.75em;
  }
  
  .ai-apply {
    padding: 0.4em 1em;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-weight: 500;
  }
  
  .ai-apply:hover {
    background: var(--interactive-accent-hover);
  }
  
  .ai-dismiss {
    padding: 0.4em 1em;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    cursor: pointer;
  }
  
  .ai-dismiss:hover {
    background: var(--background-modifier-hover);
  }
</style>
