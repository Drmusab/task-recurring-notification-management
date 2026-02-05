<script lang="ts">
  /**
   * Block Actions Editor
   * 
   * Allows users to define smart actions triggered by SiYuan block events.
   * Examples:
   * - When block is marked done → trigger next recurrence
   * - When block content matches "urgent" → set priority to high
   * - When block is deleted → pause task recurrence
   */
  
  import type { BlockLinkedAction, BlockTrigger, TaskAction, ConditionExpr } from '@backend/core/block-actions/BlockActionTypes';
  import type { TaskPriority } from '@backend/core/models/Task';
  import { t } from '@stores/i18nStore';
  
  export let actions: BlockLinkedAction[] = [];
  export let onChange: (actions: BlockLinkedAction[]) => void;
  
  let showAddDialog = false;
  let editingAction: BlockLinkedAction | null = null;
  
  // New action form state
  let newTriggerType: BlockTrigger['type'] = 'blockCompleted';
  let newTriggerRegex = '';
  let newTriggerTag = '';
  let newTriggerKeyword = '';
  let newActionType: TaskAction['type'] = 'setStatus';
  let newActionStatus: 'done' | 'in_progress' | 'cancelled' = 'done';
  let newActionPriority: TaskPriority = 'high';
  let newActionTag = '';
  let newActionNote = '';
  let newActionUrl = '';
  let newActionMessage = '';
  let newActionEnabled = true;
  
  /**
   * Add new action
   */
  function addAction() {
    const trigger = buildTrigger();
    const action = buildAction();
    
    const newAction: BlockLinkedAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trigger,
      action,
      enabled: newActionEnabled,
    };
    
    actions = [...actions, newAction];
    onChange(actions);
    
    // Reset form
    showAddDialog = false;
    resetForm();
  }
  
  /**
   * Remove action
   */
  function removeAction(id: string) {
    if (!confirm('Remove this block action?')) return;
    
    actions = actions.filter(a => a.id !== id);
    onChange(actions);
  }
  
  /**
   * Toggle action enabled state
   */
  function toggleAction(id: string) {
    actions = actions.map(a => 
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    onChange(actions);
  }
  
  /**
   * Build trigger from form
   */
  function buildTrigger(): BlockTrigger {
    switch (newTriggerType) {
      case 'contentMatches':
        return { type: 'contentMatches', regex: newTriggerRegex };
      case 'contentNotMatches':
        return { type: 'contentNotMatches', regex: newTriggerRegex };
      case 'contentHasTag':
        return { type: 'contentHasTag', tag: newTriggerTag };
      case 'contentHasKeyword':
        return { type: 'contentHasKeyword', keyword: newTriggerKeyword };
      default:
        return { type: newTriggerType };
    }
  }
  
  /**
   * Build action from form
   */
  function buildAction(): TaskAction {
    switch (newActionType) {
      case 'setStatus':
        return { type: 'setStatus', status: newActionStatus };
      case 'changePriority':
        return { type: 'changePriority', priority: newActionPriority };
      case 'addTag':
        return { type: 'addTag', tag: newActionTag };
      case 'removeTag':
        return { type: 'removeTag', tag: newActionTag };
      case 'addCompletionNote':
        return { type: 'addCompletionNote', note: newActionNote };
      case 'sendWebhook':
        return { type: 'sendWebhook', url: newActionUrl };
      case 'notify':
        return { type: 'notify', message: newActionMessage };
      case 'reschedule':
        return { type: 'reschedule', mode: 'relative', amountDays: 1 };
      case 'triggerNextRecurrence':
        return { type: 'triggerNextRecurrence' };
      case 'pauseRecurrence':
        return { type: 'pauseRecurrence' };
      default:
        // Fallback for unknown types
        return { type: 'setStatus', status: 'done' };
    }
  }
  
  /**
   * Reset form
   */
  function resetForm() {
    newTriggerType = 'blockCompleted';
    newTriggerRegex = '';
    newTriggerTag = '';
    newTriggerKeyword = '';
    newActionType = 'setStatus';
    newActionStatus = 'done';
    newActionPriority = 'high';
    newActionTag = '';
    newActionNote = '';
    newActionUrl = '';
    newActionMessage = '';
    newActionEnabled = true;
  }
  
  /**
   * Get human-readable description of trigger
   */
  function describeTrigger(trigger: BlockTrigger): string {
    switch (trigger.type) {
      case 'blockCompleted':
        return '✅ Block marked as done';
      case 'blockDeleted':
        return '🗑️ Block deleted';
      case 'blockEmpty':
        return '📭 Block becomes empty';
      case 'blockMoved':
        return '📦 Block moved';
      case 'blockCollapsed':
        return '🔽 Block collapsed';
      case 'blockExpanded':
        return '🔼 Block expanded';
      case 'contentMatches':
        return `📝 Content matches: ${(trigger as any).regex}`;
      case 'contentNotMatches':
        return `🚫 Content doesn't match: ${(trigger as any).regex}`;
      case 'contentHasTag':
        return `🏷️ Content has tag: #${(trigger as any).tag}`;
      case 'contentHasKeyword':
        return `🔑 Content has keyword: ${(trigger as any).keyword}`;
      default:
        // TypeScript exhaustive check - should never reach here if all cases covered
        return String(trigger.type);
    }
  }
  
  /**
   * Get human-readable description of action
   */
  function describeAction(action: TaskAction): string {
    switch (action.type) {
      case 'setStatus':
        return `Set status to: ${(action as any).status}`;
      case 'reschedule':
        return 'Reschedule task';
      case 'triggerNextRecurrence':
        return 'Trigger next occurrence';
      case 'pauseRecurrence':
        return 'Pause recurrence';
      case 'addTag':
        return `Add tag: #${(action as any).tag}`;
      case 'removeTag':
        return `Remove tag: #${(action as any).tag}`;
      case 'changePriority':
        return `Set priority: ${(action as any).priority}`;
      case 'addCompletionNote':
        return `Add note: ${(action as any).note}`;
      case 'sendWebhook':
        return `Send webhook to: ${(action as any).url}`;
      case 'notify':
        return `Notify: ${(action as any).message}`;
      default:
        // TypeScript exhaustive check
        return String(action.type);
    }
  }
</script>

<section class="tasks-modal-block-actions-section">
  <div class="block-actions-header">
    <h3>⚡ Block Actions</h3>
    <button class="add-action-btn" on:click={() => showAddDialog = true}>
      + Add Action
    </button>
  </div>
  
  {#if actions.length === 0}
    <div class="no-actions">
      <p>No block actions defined.</p>
      <p class="hint">Block actions let you automate task updates based on changes to the linked SiYuan block.</p>
    </div>
  {:else}
    <div class="actions-list">
      {#each actions as action}
        <div class="action-item" class:disabled={!action.enabled}>
          <div class="action-info">
            <div class="action-trigger">
              {describeTrigger(action.trigger)}
            </div>
            <div class="action-arrow">→</div>
            <div class="action-result">
              {describeAction(action.action)}
            </div>
          </div>
          <div class="action-controls">
            <button 
              class="toggle-btn" 
              on:click={() => toggleAction(action.id)}
              title={action.enabled ? 'Disable' : 'Enable'}
            >
              {action.enabled ? '🟢' : '⭕'}
            </button>
            <button 
              class="remove-btn" 
              on:click={() => removeAction(action.id)}
              title="Remove action"
            >
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
  
  {#if showAddDialog}
    <div class="add-action-dialog">
      <h4>{$t('blockActions.addAction')}</h4>
      
      <div class="form-section">
        <label for="trigger-type">{$t('blockActions.triggers.when')}</label>
        <select id="trigger-type" bind:value={newTriggerType}>
          <option value="blockCompleted">{$t('blockActions.triggers.blockCompleted')}</option>
          <option value="blockDeleted">{$t('blockActions.triggers.blockDeleted')}</option>
          <option value="blockEmpty">{$t('blockActions.triggers.blockEmpty')}</option>
          <option value="blockMoved">{$t('blockActions.triggers.blockMoved')}</option>
          <option value="blockCollapsed">{$t('blockActions.triggers.blockCollapsed')}</option>
          <option value="blockExpanded">{$t('blockActions.triggers.blockExpanded')}</option>
          <option value="contentMatches">{$t('blockActions.triggers.contentMatches')}</option>
          <option value="contentNotMatches">{$t('blockActions.triggers.contentNotMatches')}</option>
          <option value="contentHasTag">{$t('blockActions.triggers.contentHasTag')}</option>
          <option value="contentHasKeyword">{$t('blockActions.triggers.contentHasKeyword')}</option>
        </select>
        
        {#if newTriggerType === 'contentMatches' || newTriggerType === 'contentNotMatches'}
          <input 
            type="text" 
            bind:value={newTriggerRegex} 
            placeholder={$t('blockActions.placeholders.regex')}
          />
        {/if}
        
        {#if newTriggerType === 'contentHasTag'}
          <input 
            type="text" 
            bind:value={newTriggerTag} 
            placeholder={$t('blockActions.placeholders.tagName')}
          />
        {/if}
        
        {#if newTriggerType === 'contentHasKeyword'}
          <input 
            type="text" 
            bind:value={newTriggerKeyword} 
            placeholder={$t('blockActions.placeholders.keyword')}
          />
        {/if}
      </div>
      
      <div class="form-section">
        <label for="action-type">{$t('blockActions.actions.then')}</label>
        <select id="action-type" bind:value={newActionType}>
          <option value="setStatus">{$t('blockActions.actions.setStatus')}</option>
          <option value="triggerNextRecurrence">{$t('blockActions.actions.triggerNextRecurrence')}</option>
          <option value="pauseRecurrence">{$t('blockActions.actions.pauseRecurrence')}</option>
          <option value="changePriority">{$t('blockActions.actions.changePriority')}</option>
          <option value="addTag">{$t('blockActions.actions.addTag')}</option>
          <option value="removeTag">{$t('blockActions.actions.removeTag')}</option>
          <option value="addCompletionNote">{$t('blockActions.actions.addCompletionNote')}</option>
          <option value="sendWebhook">{$t('blockActions.actions.sendWebhook')}</option>
          <option value="notify">{$t('blockActions.actions.notify')}</option>
        </select>
        
        {#if newActionType === 'setStatus'}
          <select bind:value={newActionStatus}>
            <option value="done">{$t('status.done')}</option>
            <option value="in_progress">{$t('status.inProgress')}</option>
            <option value="cancelled">{$t('status.cancelled')}</option>
          </select>
        {/if}
        
        {#if newActionType === 'changePriority'}
          <select bind:value={newActionPriority}>
            <option value="highest">{$t('priority.highest')}</option>
            <option value="high">{$t('priority.high')}</option>
            <option value="medium">{$t('priority.medium')}</option>
            <option value="low">{$t('priority.low')}</option>
            <option value="lowest">{$t('priority.lowest')}</option>
          </select>
        {/if}
        
        {#if newActionType === 'addTag' || newActionType === 'removeTag'}
          <input 
            type="text" 
            bind:value={newActionTag} 
            placeholder={$t('blockActions.placeholders.tagName')}
          />
        {/if}
        
        {#if newActionType === 'addCompletionNote'}
          <textarea 
            bind:value={newActionNote} 
            placeholder={$t('blockActions.placeholders.note')}
            rows="3"
          ></textarea>
        {/if}
        
        {#if newActionType === 'sendWebhook'}
          <input 
            type="url" 
            bind:value={newActionUrl} 
            placeholder={$t('blockActions.placeholders.webhookUrl')}
          />
        {/if}
        
        {#if newActionType === 'notify'}
          <input 
            type="text" 
            bind:value={newActionMessage} 
            placeholder={$t('blockActions.placeholders.message')}
          />
        {/if}
      </div>
      
      <div class="form-section">
        <label>
          <input type="checkbox" bind:checked={newActionEnabled} />
          {$t('enabled')}
        </label>
      </div>
      
      <div class="dialog-actions">
        <button class="add-btn" on:click={addAction}>{$t('add')}</button>
        <button class="cancel-btn" on:click={() => { showAddDialog = false; resetForm(); }}>
          {$t('cancel')}
        </button>
      </div>
    </div>
  {/if}
</section>

<style>
  .tasks-modal-block-actions-section {
    margin-top: 1.5em;
    padding: 1em;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }
  
  .block-actions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1em;
  }
  
  .block-actions-header h3 {
    margin: 0;
    font-size: 1.1em;
    font-weight: 600;
  }
  
  .add-action-btn {
    padding: 0.5em 1em;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .add-action-btn:hover {
    background: var(--interactive-accent-hover);
  }
  
  .no-actions {
    padding: 1.5em;
    text-align: center;
    color: var(--text-muted);
  }
  
  .hint {
    font-size: 0.9em;
    margin-top: 0.5em;
  }
  
  .actions-list {
    display: flex;
    flex-direction: column;
    gap: 0.75em;
  }
  
  .action-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75em;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-secondary);
  }
  
  .action-item.disabled {
    opacity: 0.5;
  }
  
  .action-info {
    display: flex;
    align-items: center;
    gap: 0.75em;
    flex: 1;
  }
  
  .action-trigger {
    font-weight: 500;
  }
  
  .action-arrow {
    color: var(--text-muted);
    font-size: 1.2em;
  }
  
  .action-result {
    color: var(--text-accent);
  }
  
  .action-controls {
    display: flex;
    gap: 0.5em;
  }
  
  .toggle-btn, .remove-btn {
    padding: 0.3em 0.6em;
    background: transparent;
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    cursor: pointer;
    font-size: 1em;
  }
  
  .toggle-btn:hover, .remove-btn:hover {
    background: var(--background-modifier-hover);
  }
  
  .add-action-dialog {
    margin-top: 1em;
    padding: 1em;
    border: 2px solid var(--interactive-accent);
    border-radius: 6px;
    background: var(--background-primary);
  }
  
  .add-action-dialog h4 {
    margin: 0 0 1em 0;
  }
  
  .form-section {
    margin-bottom: 1em;
  }
  
  .form-section label {
    display: block;
    margin-bottom: 0.5em;
    font-weight: 500;
  }
  
  .form-section select,
  .form-section input,
  .form-section textarea {
    width: 100%;
    padding: 0.5em;
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    background: var(--background-primary);
    color: var(--text-normal);
    margin-top: 0.25em;
  }
  
  .dialog-actions {
    display: flex;
    gap: 0.5em;
    margin-top: 1em;
  }
  
  .add-btn {
    padding: 0.5em 1.5em;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }
  
  .add-btn:hover {
    background: var(--interactive-accent-hover);
  }
  
  .cancel-btn {
    padding: 0.5em 1.5em;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    cursor: pointer;
  }
  
  .cancel-btn:hover {
    background: var(--background-modifier-hover);
  }
</style>
