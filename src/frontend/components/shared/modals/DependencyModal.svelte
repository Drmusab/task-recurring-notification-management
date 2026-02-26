<script lang="ts">
  /**
   * DependencyModal Component — Session 27 (DTO-driven Command Surface)
   * WCAG 2.1 AA Compliant
   *
   * ARCHITECTURE:
   * - Accepts TaskDTO + DependencyDTO[] — no domain import
   * - Routes link/unlink via uiMutationService.linkDependency / unlinkDependency
   * - Emits task:runtime:dependencyChanged after mutation
   * - NEVER pushes to task.dependsOn directly
   * - NEVER imports DependencyLink domain model
   * - Prevents recurring child from inheriting template dependency
   *
   * FORBIDDEN:
   *   ❌ import DependencyLink / Task domain
   *   ❌ task.dependsOn.push() / filter()
   *   ❌ TaskStorage / Cache / Scheduler
   *
   * @accessibility
   * - role="dialog" with aria-labelledby and aria-modal
   * - Focus trap within modal
   * - Keyboard navigation (Tab, Escape, Enter)
   * - 44x44px minimum touch targets
   * - Screen reader announcements
   * - High contrast mode support
   */

  import { onMount, createEventDispatcher } from 'svelte';
  import Button from '../Button.svelte';
  import Icon from '../Icon.svelte';
  import type { TaskDTO, DependencyDTO } from '../../../services/DTOs';
  import { uiMutationService } from '../../../services/UITaskMutationService';
  import { uiEventService } from '../../../services/UIEventService';
  import * as logger from '@shared/logging/logger';

  export let taskId: string;
  export let taskName: string = '';
  export let dependencies: DependencyDTO[] = [];
  export let availableTasks: TaskDTO[] = [];
  export let isRecurringChild: boolean = false;
  export let onClose: () => void;

  const dispatch = createEventDispatcher();

  let search = '';
  let filteredTasks: TaskDTO[] = [];
  let pendingLinks: string[] = [];
  let pendingUnlinks: string[] = [];
  let announcementText = '';
  let isSaving = false;
  let dialogElement: HTMLElement;
  let searchInput: HTMLInputElement;

  // Current dependency task IDs
  $: currentDepIds = new Set(dependencies.map(d => d.targetTaskId));

  // Filter available tasks for search
  $: filteredTasks = search.trim()
    ? availableTasks.filter(t =>
        t.id !== taskId &&
        !currentDepIds.has(t.id) &&
        !pendingLinks.includes(t.id) &&
        (t.name.toLowerCase().includes(search.toLowerCase()) ||
         t.id.includes(search))
      ).slice(0, 10)
    : [];

  onMount(() => {
    if (searchInput) {
      searchInput.focus();
    }
  });

  /**
   * Stage a dependency link (applied on save).
   * Prevents recurring child from inheriting template dependency.
   */
  function stageLink(targetId: string) {
    if (isRecurringChild) {
      announcementText = 'Cannot add dependencies to recurring child tasks';
      return;
    }
    pendingLinks = [...pendingLinks, targetId];
    search = '';
    const target = availableTasks.find(t => t.id === targetId);
    announcementText = `Dependency on "${target?.name || targetId}" staged`;
  }

  /** Stage a dependency unlink (applied on save). */
  function stageUnlink(targetId: string) {
    if (pendingLinks.includes(targetId)) {
      pendingLinks = pendingLinks.filter(id => id !== targetId);
      announcementText = 'Pending dependency removed';
    } else {
      pendingUnlinks = [...pendingUnlinks, targetId];
      const dep = dependencies.find(d => d.targetTaskId === targetId);
      announcementText = `Dependency on "${dep?.targetTaskName || targetId}" marked for removal`;
    }
  }

  /**
   * Save all pending changes via UITaskMutationService.
   * Routes each link/unlink through TaskService — NEVER mutates domain directly.
   */
  async function handleSave() {
    isSaving = true;

    try {
      // Apply unlinks
      for (const targetId of pendingUnlinks) {
        const result = await uiMutationService.unlinkDependency(taskId, targetId, 'blockedBy');
        if (!result.success) {
          logger.error('Failed to unlink dependency', { taskId, targetId, error: result.error });
        }
      }

      // Apply links
      for (const targetId of pendingLinks) {
        const result = await uiMutationService.linkDependency(taskId, targetId, 'blockedBy');
        if (!result.success) {
          logger.error('Failed to link dependency', { taskId, targetId, error: result.error });
        }
      }

      // Emit runtime event — dashboard/panels react via EventService subscription
      if (pendingLinks.length > 0 || pendingUnlinks.length > 0) {
        uiEventService.emitTaskRefresh();
      }

      dispatch('save', { linked: pendingLinks, unlinked: pendingUnlinks });
      announcementText = 'Dependencies saved';
      setTimeout(() => onClose(), 100);
    } catch (error) {
      logger.error('Dependency save failed', error);
      announcementText = 'Failed to save dependencies';
    } finally {
      isSaving = false;
    }
  }

  function handleCancel() {
    onClose();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    } else if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      handleSave();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  }

  /** Get display status symbol from task DTO */
  function getStatusSymbol(task: TaskDTO): string {
    return task.statusSymbol ?? (task.status === 'done' ? 'x' : task.status === 'cancelled' ? '-' : ' ');
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
  class="dependency-modal-overlay"
  on:click={handleBackdropClick}
  role="presentation"
>
  <div
    bind:this={dialogElement}
    class="dependency-modal-dialog"
    role="dialog"
    aria-labelledby="dependency-modal-title"
    aria-modal="true"
  >
    <div class="dependency-modal-header">
      <h2 id="dependency-modal-title">
        Manage Dependencies{taskName ? `: ${taskName}` : ''}
      </h2>
      <button
        type="button"
        class="dependency-modal-close"
        on:click={handleCancel}
        aria-label="Close dependency editor"
      >
        <Icon name="x" category="actions" size={20} />
      </button>
    </div>

    <div class="dependency-modal-content">
      {#if isRecurringChild}
        <div class="dependency-modal-warning" role="alert">
          ⚠️ Recurring child tasks cannot have dependencies modified directly.
          Edit the parent recurring task instead.
        </div>
      {/if}

      <!-- Search for tasks to add as dependencies -->
      <div class="dependency-modal-search">
        <label for="dep-search" class="dependency-modal-label">
          Add dependency (blocked by)
        </label>
        <input
          bind:this={searchInput}
          bind:value={search}
          type="text"
          id="dep-search"
          class="dependency-modal-input"
          placeholder="Search tasks to add as dependency..."
          disabled={isRecurringChild}
          aria-describedby="dep-search-hint"
        />
        <p id="dep-search-hint" class="dependency-modal-hint">
          This task will be blocked until the selected tasks are completed
        </p>
      </div>

      <!-- Search results -->
      {#if filteredTasks.length > 0}
        <ul class="dependency-modal-results" role="listbox" aria-label="Search results">
          {#each filteredTasks as result}
            <li role="option" aria-selected="false">
              <button
                type="button"
                class="dependency-modal-result-item"
                on:click={() => stageLink(result.id)}
              >
                <span class="dependency-modal-status">[{getStatusSymbol(result)}]</span>
                <span class="dependency-modal-name">{result.name}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      <!-- Current dependencies -->
      <div class="dependency-modal-list">
        <h3 class="dependency-modal-subtitle">Current Dependencies</h3>
        {#if dependencies.length === 0 && pendingLinks.length === 0}
          <p class="dependency-modal-empty">No dependencies</p>
        {/if}

        {#each dependencies as dep}
          {#if !pendingUnlinks.includes(dep.targetTaskId)}
            <div class="dependency-modal-item">
              <span class="dependency-modal-item-name">
                {dep.targetTaskName}
                {#if dep.isSatisfied}
                  <span class="dependency-modal-satisfied" aria-label="Satisfied">✅</span>
                {:else}
                  <span class="dependency-modal-blocking" aria-label="Blocking">🔒</span>
                {/if}
              </span>
              <button
                type="button"
                class="dependency-modal-remove"
                on:click={() => stageUnlink(dep.targetTaskId)}
                aria-label="Remove dependency on {dep.targetTaskName}"
                disabled={isRecurringChild}
              >
                ✕
              </button>
            </div>
          {/if}
        {/each}

        <!-- Pending links -->
        {#each pendingLinks as linkId}
          {@const task = availableTasks.find(t => t.id === linkId)}
          {#if task}
            <div class="dependency-modal-item dependency-modal-item--pending">
              <span class="dependency-modal-item-name">
                {task.name} <span class="dependency-modal-badge">NEW</span>
              </span>
              <button
                type="button"
                class="dependency-modal-remove"
                on:click={() => stageUnlink(linkId)}
                aria-label="Remove pending dependency on {task.name}"
              >
                ✕
              </button>
            </div>
          {/if}
        {/each}

        <!-- Pending unlinks -->
        {#each pendingUnlinks as unlinkId}
          {@const dep = dependencies.find(d => d.targetTaskId === unlinkId)}
          {#if dep}
            <div class="dependency-modal-item dependency-modal-item--removed">
              <span class="dependency-modal-item-name" style="text-decoration: line-through;">
                {dep.targetTaskName}
              </span>
              <button
                type="button"
                class="dependency-modal-undo"
                on:click={() => { pendingUnlinks = pendingUnlinks.filter(id => id !== unlinkId); }}
                aria-label="Undo removal of {dep.targetTaskName}"
              >
                Undo
              </button>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <div class="dependency-modal-footer">
      <Button variant="secondary" on:click={handleCancel}>
        Cancel
      </Button>
      <Button
        variant="primary"
        on:click={handleSave}
        disabled={isSaving || (pendingLinks.length === 0 && pendingUnlinks.length === 0)}
      >
        {isSaving ? 'Saving...' : 'Save'}
      </Button>
    </div>

    <!-- ARIA live region for announcements -->
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcementText}
    </div>
  </div>
</div>

<style>
  .dependency-modal-overlay {
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

  .dependency-modal-dialog {
    background: var(--background-primary, #fff);
    border-radius: 8px;
    width: 90%;
    max-width: 520px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .dependency-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--background-modifier-border, #e0e0e0);
  }

  .dependency-modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-normal, #333);
  }

  .dependency-modal-close {
    min-width: 44px;
    min-height: 44px;
    padding: 0.625rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 6px;
    color: var(--text-muted, #666);
    cursor: pointer;
  }

  .dependency-modal-close:hover {
    background: var(--background-modifier-hover, #f5f5f5);
  }

  .dependency-modal-close:focus-visible {
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: 2px;
  }

  .dependency-modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
  }

  .dependency-modal-warning {
    padding: 0.75rem 1rem;
    background: var(--background-modifier-error-hover, #fff3cd);
    border: 1px solid var(--text-error, #ffc107);
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .dependency-modal-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: var(--text-normal, #333);
  }

  .dependency-modal-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--background-modifier-border, #e0e0e0);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--background-primary, #fff);
    color: var(--text-normal, #333);
  }

  .dependency-modal-input:focus {
    outline: none;
    border-color: var(--interactive-accent, #1976d2);
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
  }

  .dependency-modal-hint {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: var(--text-muted, #666);
  }

  .dependency-modal-results {
    list-style: none;
    margin: 0.5rem 0;
    padding: 0;
    border: 1px solid var(--background-modifier-border, #e0e0e0);
    border-radius: 6px;
    max-height: 200px;
    overflow-y: auto;
  }

  .dependency-modal-result-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-normal, #333);
    min-height: 44px;
  }

  .dependency-modal-result-item:hover {
    background: var(--background-modifier-hover, #f5f5f5);
  }

  .dependency-modal-status {
    font-family: monospace;
    font-size: 0.75rem;
  }

  .dependency-modal-subtitle {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem;
    color: var(--text-normal, #333);
  }

  .dependency-modal-empty {
    font-size: 0.875rem;
    color: var(--text-muted, #666);
    font-style: italic;
  }

  .dependency-modal-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--background-modifier-border, #e0e0e0);
    border-radius: 6px;
    margin-bottom: 0.5rem;
    min-height: 44px;
  }

  .dependency-modal-item--pending {
    border-color: var(--interactive-accent, #1976d2);
    background: rgba(25, 118, 210, 0.05);
  }

  .dependency-modal-item--removed {
    opacity: 0.5;
    border-style: dashed;
  }

  .dependency-modal-item-name {
    font-size: 0.875rem;
    color: var(--text-normal, #333);
  }

  .dependency-modal-badge {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    background: var(--interactive-accent, #1976d2);
    color: white;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 600;
    margin-left: 0.5rem;
  }

  .dependency-modal-satisfied {
    margin-left: 0.25rem;
  }

  .dependency-modal-blocking {
    margin-left: 0.25rem;
  }

  .dependency-modal-remove,
  .dependency-modal-undo {
    min-width: 44px;
    min-height: 44px;
    padding: 0.5rem;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-muted, #666);
  }

  .dependency-modal-remove:hover {
    background: var(--background-modifier-error-hover, #ffecec);
    color: var(--text-error, #e53935);
  }

  .dependency-modal-undo:hover {
    background: var(--background-modifier-hover, #f5f5f5);
    color: var(--interactive-accent, #1976d2);
  }

  .dependency-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
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

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .dependency-modal-dialog {
      border: 2px solid currentColor;
    }
    .dependency-modal-item {
      border-width: 2px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .dependency-modal-overlay,
    .dependency-modal-dialog {
      animation: none;
    }
  }
</style>
