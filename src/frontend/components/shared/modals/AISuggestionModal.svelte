<script lang="ts">
  /**
   * AISuggestionModal Component — Session 27 (DTO-driven Command Surface)
   * WCAG 2.1 AA Compliant
   *
   * ARCHITECTURE:
   * - Accepts SuggestionDTO[] — no domain import
   * - Applies suggestions ONLY via uiMutationService.applyAISuggestion()
   * - NEVER modifies analytics locally
   * - NEVER compares due dates manually
   * - NEVER imports domain types (Task, RecurrenceInstance)
   * - Emits task:runtime:updated after suggestion applied
   *
   * FORBIDDEN:
   *   ❌ import Task / domain model
   *   ❌ task.dueAt = suggestion.newDate (inline mutation)
   *   ❌ analytics.update() (local compute)
   *   ❌ TaskStorage / Cache / Scheduler / Integration
   *
   * @accessibility
   * - role="dialog" with aria-labelledby and aria-modal
   * - Focus trap, keyboard navigation
   * - 44x44px touch targets, high contrast mode
   * - Screen reader announcements for suggestion actions
   */

  import { createEventDispatcher } from 'svelte';
  import Button from '../Button.svelte';
  import Icon from '../Icon.svelte';
  import type { SuggestionDTO, TaskDTO } from '../../../services/DTOs';
  import { uiMutationService } from '../../../services/UITaskMutationService';
  import { uiEventService } from '../../../services/UIEventService';
  import * as logger from '@shared/logging/logger';

  export let taskId: string;
  export let taskName: string = '';
  export let suggestions: SuggestionDTO[] = [];
  export let onClose: () => void;

  const dispatch = createEventDispatcher();

  let applyingId: string | null = null;
  let dismissedIds: Set<string> = new Set();
  let announcementText = '';

  $: activeSuggestions = suggestions.filter(s => !s.dismissed && !dismissedIds.has(s.id));

  /**
   * Apply a suggestion via UITaskMutationService.
   * NEVER modifies task fields inline — routes through TaskService.
   */
  async function applySuggestion(suggestion: SuggestionDTO) {
    applyingId = suggestion.id;

    try {
      const result = await uiMutationService.applyAISuggestion(
        taskId,
        {
          type: suggestion.action.type,
          parameters: suggestion.action.parameters,
        },
      );

      if (result.success) {
        dismissedIds = new Set([...dismissedIds, suggestion.id]);
        announcementText = `Suggestion "${suggestion.action.label}" applied successfully`;
        uiEventService.emitTaskRefresh();
        dispatch('applied', { suggestionId: suggestion.id, taskId });
        logger.debug('AI suggestion applied via service', { taskId, suggestionId: suggestion.id });
      } else {
        announcementText = `Failed to apply suggestion: ${result.error}`;
        logger.error('AI suggestion apply failed', { error: result.error });
      }
    } catch (error) {
      announcementText = 'Failed to apply suggestion';
      logger.error('AI suggestion error', error);
    } finally {
      applyingId = null;
    }
  }

  /** Dismiss a suggestion locally (no backend call). */
  function dismissSuggestion(suggestion: SuggestionDTO) {
    dismissedIds = new Set([...dismissedIds, suggestion.id]);
    announcementText = `Suggestion dismissed: ${suggestion.reason}`;
    dispatch('dismissed', { suggestionId: suggestion.id });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  /** Map suggestion type to display icon */
  function typeIcon(type: string): string {
    switch (type) {
      case 'abandon': return '🗑️';
      case 'reschedule': return '📅';
      case 'urgency': return '⚡';
      case 'frequency': return '🔁';
      case 'consolidate': return '🔗';
      case 'delegate': return '👤';
      default: return '💡';
    }
  }

  /** Map confidence to display label */
  function confidenceLabel(confidence: number): string {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
  class="ai-modal-overlay"
  on:click={handleBackdropClick}
  role="presentation"
>
  <div
    class="ai-modal-dialog"
    role="dialog"
    aria-labelledby="ai-modal-title"
    aria-modal="true"
  >
    <div class="ai-modal-header">
      <h2 id="ai-modal-title">
        🧠 AI Suggestions{taskName ? `: ${taskName}` : ''}
      </h2>
      <button
        type="button"
        class="ai-modal-close"
        on:click={onClose}
        aria-label="Close AI suggestions"
      >
        <Icon name="x" category="actions" size={20} />
      </button>
    </div>

    <div class="ai-modal-content">
      {#if activeSuggestions.length === 0}
        <div class="ai-modal-empty">
          <p>No active suggestions for this task.</p>
          <p class="ai-modal-hint">
            Suggestions appear as the AI analyzes task patterns over time.
          </p>
        </div>
      {:else}
        <ul class="ai-modal-list" role="list" aria-label="AI suggestions">
          {#each activeSuggestions as suggestion}
            <li class="ai-modal-item" role="listitem">
              <div class="ai-modal-item-header">
                <span class="ai-modal-item-icon">{typeIcon(suggestion.type)}</span>
                <span class="ai-modal-item-type">{suggestion.type}</span>
                <span
                  class="ai-modal-item-confidence"
                  class:high={suggestion.confidence >= 0.8}
                  class:medium={suggestion.confidence >= 0.5 && suggestion.confidence < 0.8}
                  class:low={suggestion.confidence < 0.5}
                >
                  {confidenceLabel(suggestion.confidence)}
                  ({Math.round(suggestion.confidence * 100)}%)
                </span>
              </div>

              <p class="ai-modal-item-reason">{suggestion.reason}</p>

              <div class="ai-modal-item-actions">
                <Button
                  variant="primary"
                  on:click={() => applySuggestion(suggestion)}
                  disabled={applyingId === suggestion.id}
                >
                  {applyingId === suggestion.id ? 'Applying...' : suggestion.action.label}
                </Button>
                <Button
                  variant="secondary"
                  on:click={() => dismissSuggestion(suggestion)}
                >
                  Dismiss
                </Button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="ai-modal-footer">
      <Button variant="secondary" on:click={onClose}>
        Close
      </Button>
    </div>

    <!-- ARIA live region -->
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcementText}
    </div>
  </div>
</div>

<style>
  .ai-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .ai-modal-dialog {
    background: var(--background-primary, #fff);
    border-radius: 8px;
    width: 90%;
    max-width: 560px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .ai-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  .ai-modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-normal, #333);
  }

  .ai-modal-close {
    min-width: 44px;
    min-height: 44px;
    padding: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--text-muted, #666);
    cursor: pointer;
  }

  .ai-modal-close:hover {
    background: var(--background-modifier-hover, #f5f5f5);
  }

  .ai-modal-close:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
  }

  .ai-modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
  }

  .ai-modal-empty {
    text-align: center;
    padding: 2rem 0;
    color: var(--text-muted, #666);
  }

  .ai-modal-hint {
    font-size: 0.8125rem;
    margin-top: 0.5rem;
    font-style: italic;
  }

  .ai-modal-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .ai-modal-item {
    padding: 1rem;
    border: 1px solid var(--background-modifier-border, #e0e0e0);
    border-radius: 8px;
  }

  .ai-modal-item-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .ai-modal-item-icon {
    font-size: 1.25rem;
  }

  .ai-modal-item-type {
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: capitalize;
    color: var(--text-normal, #333);
  }

  .ai-modal-item-confidence {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    margin-left: auto;
  }

  .ai-modal-item-confidence.high {
    background: rgba(76, 175, 80, 0.15);
    color: #2e7d32;
  }

  .ai-modal-item-confidence.medium {
    background: rgba(255, 193, 7, 0.15);
    color: #f57f17;
  }

  .ai-modal-item-confidence.low {
    background: rgba(158, 158, 158, 0.15);
    color: #616161;
  }

  .ai-modal-item-reason {
    font-size: 0.875rem;
    color: var(--text-normal, #333);
    margin: 0 0 0.75rem;
    line-height: 1.5;
  }

  .ai-modal-item-actions {
    display: flex;
    gap: 0.5rem;
  }

  .ai-modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (prefers-contrast: high) {
    .ai-modal-dialog {
      border: 2px solid currentColor;
    }
    .ai-modal-item {
      border-width: 2px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-modal-overlay {
      animation: none;
    }
  }
</style>
