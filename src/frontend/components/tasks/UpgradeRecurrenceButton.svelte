<!--
  UpgradeRecurrenceButton - Phase 2 UI component
  
  Shows an "Upgrade to RRule" button for tasks with legacy Frequency
  Displays preview of what the migration will look like
-->
<script lang="ts">
  import type { Task } from '@backend/core/models/Task';
  import { FrequencyConverter } from '@backend/core/utils/FrequencyConverter';
  import { RecurrenceEngine } from '@backend/core/engine/recurrence/RecurrenceEngine';
  
  export let task: Task;
  export let onUpgrade: (migratedTask: Task) => void;
  export let compact: boolean = false;
  
  let showPreview = false;
  let upgrading = false;
  let error: string | null = null;
  
  // Check if task can be upgraded
  $: canUpgrade = shouldShowButton(task);
  $: preview = canUpgrade ? FrequencyConverter.previewConversion(task as any) : null;
  
  function shouldShowButton(t: Task): boolean {
    return !!(t.frequency && !t.recurrence);
  }
  
  async function handleUpgrade() {
    if (!canUpgrade) return;
    
    upgrading = true;
    error = null;
    
    try {
      // Convert task
      const migrated = FrequencyConverter.updateTaskRecurrence(task as any, true);
      
      if (!migrated) {
        throw new Error('Failed to convert task to RRule');
      }
      
      // Call parent callback
      onUpgrade(migrated as any);
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      upgrading = false;
    }
  }
  
  function togglePreview() {
    showPreview = !showPreview;
  }
</script>

{#if canUpgrade}
  <div class="upgrade-recurrence-button" class:compact>
    <button
      class="upgrade-btn"
      on:click={handleUpgrade}
      disabled={upgrading}
      title="Upgrade to RFC 5545 RRule standard for better recurrence handling"
    >
      {#if upgrading}
        <span class="spinner"></span>
        Upgrading...
      {:else}
        <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 1L8 15M8 1L4 5M8 1L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        {compact ? '⬆️ RRule' : 'Upgrade to RRule'}
      {/if}
    </button>
    
    {#if !compact}
      <button 
        class="preview-btn"
        on:click={togglePreview}
        title="Preview what will happen"
      >
        {showPreview ? '▼' : '▶'}
        Preview
      </button>
    {/if}
    
    {#if showPreview && preview}
      <div class="preview-card">
        <div class="preview-row">
          <span class="label">Current:</span>
          <span class="value current">{preview.current}</span>
        </div>
        
        {#if preview.converted}
          <div class="preview-row">
            <span class="label">Upgraded:</span>
            <span class="value upgraded">{preview.converted}</span>
          </div>
        {/if}
        
        {#if preview.warning}
          <div class="preview-warning">
            ⚠️ {preview.warning}
          </div>
        {/if}
        
        <div class="preview-benefits">
          <strong>Benefits:</strong>
          <ul>
            <li>✅ Industry standard (RFC 5545)</li>
            <li>✅ Better edge case handling</li>
            <li>✅ More powerful patterns</li>
            <li>✅ Calendar app compatibility</li>
          </ul>
        </div>
      </div>
    {/if}
    
    {#if error}
      <div class="error-message">
        ❌ {error}
      </div>
    {/if}
  </div>
{/if}

<style>
  .upgrade-recurrence-button {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--background-modifier-info, #e3f2fd);
    border: 1px solid var(--background-modifier-border, #90caf9);
    border-radius: 6px;
    margin: 0.5rem 0;
  }
  
  .upgrade-recurrence-button.compact {
    padding: 0.25rem 0.5rem;
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
    background: transparent;
    border: none;
    margin: 0;
  }
  
  .upgrade-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--interactive-accent, #1976d2);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s ease;
  }
  
  .upgrade-btn:hover:not(:disabled) {
    background: var(--interactive-accent-hover, #1565c0);
  }
  
  .upgrade-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .compact .upgrade-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
  }
  
  .icon {
    width: 16px;
    height: 16px;
  }
  
  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .preview-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: 1px solid var(--background-modifier-border, #ccc);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-muted, #666);
  }
  
  .preview-btn:hover {
    background: var(--background-modifier-hover, #f5f5f5);
  }
  
  .preview-card {
    padding: 1rem;
    background: var(--background-primary, white);
    border: 1px solid var(--background-modifier-border, #e0e0e0);
    border-radius: 4px;
    font-size: 0.875rem;
  }
  
  .preview-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .label {
    font-weight: 600;
    color: var(--text-muted, #666);
    min-width: 80px;
  }
  
  .value {
    flex: 1;
  }
  
  .value.current {
    color: var(--text-muted, #666);
    text-decoration: line-through;
  }
  
  .value.upgraded {
    color: var(--text-success, #4caf50);
    font-weight: 500;
  }
  
  .preview-warning {
    padding: 0.5rem;
    background: var(--background-modifier-error-hover, #fff3cd);
    border-left: 3px solid var(--text-warning, #ff9800);
    margin: 0.5rem 0;
    font-size: 0.875rem;
  }
  
  .preview-benefits {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--background-modifier-border, #e0e0e0);
  }
  
  .preview-benefits strong {
    color: var(--text-normal, #333);
  }
  
  .preview-benefits ul {
    margin: 0.5rem 0 0 0;
    padding-left: 1.5rem;
  }
  
  .preview-benefits li {
    margin: 0.25rem 0;
    color: var(--text-muted, #666);
  }
  
  .error-message {
    padding: 0.5rem;
    background: var(--background-modifier-error, #ffebee);
    border-left: 3px solid var(--text-error, #f44336);
    color: var(--text-error, #c62828);
    font-size: 0.875rem;
    border-radius: 4px;
  }
</style>
