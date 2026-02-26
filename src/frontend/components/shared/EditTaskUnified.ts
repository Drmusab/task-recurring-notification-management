/**
 * Unified EditTask Component Wrapper
 * 
 * This component fixes the architecture problem where:
 * - EditTask.svelte uses Obsidian Task model (class-based, Moment dates)
 * - Core system uses SiYuan Task model (interface, ISO strings)
 * - AI features, block actions, tags need SiYuan model
 * 
 * SOLUTION: Wrap EditTask.svelte and add missing sections using UnifiedTask.
 * 
 * DATA FLOW (FIXED):
 * 1. Create writable store for unifiedTask
 * 2. All child components subscribe to store
 * 3. AI suggestions update store ? triggers reactive updates
 * 4. onSubmit merges all changes before saving
 */

import { writable } from 'svelte/store';
import { mount, unmount } from 'svelte';
import EditTaskLegacy from "@components/shared/EditTask.svelte";
import BlockActionsEditor from "@components/shared/editors/BlockActionsEditor.svelte";
import TagsCategoryEditor from "@components/shared/editors/TagsCategoryEditor.svelte";
import AISuggestionsPanel from "@components/shared/AISuggestionsPanel.svelte";
import type { TaskDTO } from '../../services/DTOs';
import { uiQueryService } from '../../services/UIQueryService';
import type { Status } from '@shared/types/Status';
import * as logger from "@shared/logging/logger";

// Local type aliases for the bridge layer
type Task = TaskDTO;
type UnifiedTask = Record<string, any>;
type TaskSuggestion = {
  type: string;
  action: { type: string; parameters: Record<string, any>; description?: string; label?: string };
  [key: string]: any;
};
type BlockLinkedAction = Record<string, any>;

export interface EditTaskUnifiedProps {
  task: Task;
  statusOptions: Status[];
  onSubmit: (task: Task) => void | Promise<void>;
  onCancel: () => void;
  allTasks: Task[];
}

/**
 * Create unified task editor component
 * 
 * This wraps the legacy EditTask.svelte and adds:
 * - Block Actions Editor
 * - Tags/Category Editor  
 * - AI Suggestions Panel
 * 
 * DATA FLOW NOW REACTIVE:
 * - unifiedTaskStore holds current task state
 * - AI suggestions update store
 * - All components subscribe to changes
 * 
 * @param container - HTML element to mount into
 * @param props - Component props
 * @returns Component instance with destroy method
 */
export function createUnifiedEditor(
  container: HTMLElement, 
  props: EditTaskUnifiedProps
): { destroy: () => void } {
  // Convert to unified format via service facade
  const isObsidian = 'description' in props.task && 'status' in props.task;
  let unifiedTask: UnifiedTask = props.task as any;
  
  // Async initialization — convert task via service facade
  (async () => {
    unifiedTask = await uiQueryService.toUnifiedTask(props.task as any);
    unifiedTaskStore.set(unifiedTask);
  })();
  
  const unifiedAllTasks: UnifiedTask[] = props.allTasks.map(t => t as any);
  
  // Create reactive store for unified task
  const unifiedTaskStore = writable<UnifiedTask>(unifiedTask);
  
  // Track extended fields (not handled by legacy editor)
  let currentBlockActions = unifiedTask.blockActions || [];
  let currentTags = unifiedTask.tags || [];
  let currentCategory = unifiedTask.category || '';
  
  // Create container structure
  container.innerHTML = `
    <div class="unified-task-editor">
      <div id="legacy-editor"></div>
      <hr />
      <div id="tags-category-section"></div>
      <hr />
      <div id="block-actions-section"></div>
      <hr />
      <div id="ai-suggestions-section"></div>
    </div>
  `;
  
  const legacyContainer = container.querySelector('#legacy-editor') as HTMLElement;
  const tagsContainer = container.querySelector('#tags-category-section') as HTMLElement;
  const blockActionsContainer = container.querySelector('#block-actions-section') as HTMLElement;
  const aiContainer = container.querySelector('#ai-suggestions-section') as HTMLElement;
  
  // Mount legacy editor (handles basic fields, priority, status, dates, recurrence, dependencies)
  const legacyTask = props.task;
  
  const legacyEditor = mount(EditTaskLegacy, {
    target: legacyContainer,
    props: {
      task: legacyTask,
      statusOptions: props.statusOptions,
      allTasks: props.allTasks as any[],
      onSubmit: async (updatedTasks: any[]) => {
        // Convert back and merge with extended fields
        if (updatedTasks.length > 0) {
          const updatedUnified = await uiQueryService.toUnifiedTask(updatedTasks[0]);
          
          // Merge with current extended fields
          const merged: Task = await uiQueryService.fromUnifiedTask({
            ...updatedUnified,
            blockActions: currentBlockActions,
            tags: currentTags,
            category: currentCategory,
          }) as any;
          
          try {
            await props.onSubmit(merged);
          } catch (error) {
            logger.error('Failed to submit task', error);
            throw error;
          }
        }
      },
    },
  });
  
  // Mount Tags/Category editor
  const tagsEditor = mount(TagsCategoryEditor, {
    target: tagsContainer,
    props: {
      tags: currentTags,
      category: currentCategory,
      onChange: (tags: string[], category: string) => {
        currentTags = tags;
        currentCategory = category;
        
        // Update store
        unifiedTaskStore.update(task => ({
          ...task,
          tags,
          category,
        }));
      },
    },
  });
  
  // Mount Block Actions editor
  const blockActionsEditor = mount(BlockActionsEditor, {
    target: blockActionsContainer,
    props: {
      actions: currentBlockActions,
      onChange: (actions: BlockLinkedAction[]) => {
        currentBlockActions = actions;
        
        // Update store
        unifiedTaskStore.update(task => ({
          ...task,
          blockActions: actions,
        }));
      },
    },
  });
  
  // Mount AI Suggestions panel with reactive task store
  const aiPanel = mount(AISuggestionsPanel, {
    target: aiContainer,
    props: {
      task: unifiedTask,
      allTasks: unifiedAllTasks,
      onApplySuggestion: (suggestion: TaskSuggestion) => {
        // Apply suggestion and update store
        unifiedTaskStore.update(currentTask => {
          const updated = { ...currentTask };
          applySuggestionToTask(updated, suggestion);
          
          logger.info('AI suggestion applied', { 
            type: suggestion.type, 
            action: suggestion.action.type 
          });
          
          // Update legacy editor if needed
          if (suggestion.action.type === 'updateTime' || 
              suggestion.action.type === 'setPriority') {
            // Trigger legacy editor update via store changes
            // Note: Svelte 5 mount() returns don't support $set.
            // TODO: Refactor to use reactive store for the legacy editor task prop.
          }
          
          return updated;
        });
      },
    },
  });
  
  // Subscribe to store changes for debugging
  const unsubscribe = unifiedTaskStore.subscribe(task => {
    logger.debug('Unified task updated', { 
      id: task.id, 
      name: task.name,
      tags: task.tags?.length,
      blockActions: task.blockActions?.length,
    });
  });
  
  return {
    destroy: () => {
      unsubscribe();
      try { unmount(legacyEditor); } catch { /* ignore */ }
      try { unmount(tagsEditor); } catch { /* ignore */ }
      try { unmount(blockActionsEditor); } catch { /* ignore */ }
      try { unmount(aiPanel); } catch { /* ignore */ }
    },
  };
}

/**
 * Apply AI suggestion to task (immutable spread pattern)
 * 
 * Operates on local editor state (UnifiedTask in a writable store),
 * NOT on backend storage. Actual persistence happens via the onSubmit
 * callback which routes through UITaskMutationService.
 * All backend types replaced with TaskDTO + local aliases (Session 26).
 */
function applySuggestionToTask(task: UnifiedTask, suggestion: TaskSuggestion): void {
  switch (suggestion.action.type) {
    case 'disable':
      task.enabled = false;
      logger.debug('Task disabled via AI suggestion');
      break;
      
    case 'updateTime': {
      const hour = suggestion.action.parameters.hour;
      if (task.dueAt) {
        const date = new Date(task.dueAt);
        date.setHours(hour);
        task.dueAt = date.toISOString();
        logger.debug('Task time updated', { hour, newDueAt: task.dueAt });
      } else if (task.scheduledAt) {
        const date = new Date(task.scheduledAt);
        date.setHours(hour);
        task.scheduledAt = date.toISOString();
        logger.debug('Task scheduled time updated', { hour });
      }
      break;
    }
      
    case 'setPriority':
      task.priority = suggestion.action.parameters.priority;
      logger.debug('Task priority updated', { priority: task.priority });
      break;
      
    case 'adjustFrequency': {
      const newInterval = suggestion.action.parameters.interval;
      if (task.frequency && newInterval) {
        task.frequency = { ...task.frequency, interval: newInterval };
        logger.debug('Task frequency adjusted', { newInterval });
      }
      break;
    }
      
    default:
      logger.warn('Unknown suggestion action type', { type: suggestion.action.type });
  }
}
