<script lang="ts">
/**
 * TaskListView - Virtual scrolling task list component with WCAG 2.1 AA accessibility
 *
 * @module TaskListView
 * @accessibility WCAG 2.1 AA compliant - Virtual scrolling with screen reader support
 * @performance Optimized for rendering 10k+ tasks without lag
 * @version 2.0.0
 */

import { createEventDispatcher, onMount } from 'svelte';
import TaskListItem from './TaskListItem.svelte';
import type { Task } from '../../../domain/models/Task';
import { 
  getTaskCountLabel, 
  announceToScreenReader,
  generateAriaId 
} from '@frontend/utils/accessibility';

export let tasks: Task[] = [];
export let filterLabel: string = 'all tasks';

const dispatch = createEventDispatcher();

// Virtual scrolling parameters
const ITEM_HEIGHT = 60; // pixels per task item
const OVERSCAN = 5; // render extra items above/below viewport
let containerHeight: number = 0;
let scrollTop: number = 0;

// Calculated values
$: totalHeight = tasks.length * ITEM_HEIGHT;
$: startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
$: endIndex = Math.min(
  tasks.length,
  Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
);
$: visibleTasks = tasks.slice(startIndex, endIndex);
$: offsetY = startIndex * ITEM_HEIGHT;

// Accessibility: Task count label for screen readers
$: taskCountLabel = getTaskCountLabel(tasks.length, filterLabel);
$: liveRegionId = generateAriaId('task-updates');

// Announce task count changes to screen readers
let previousTaskCount = tasks.length;
$: if (tasks.length !== previousTaskCount) {
  announceToScreenReader(
    `${taskCountLabel}. Showing ${visibleTasks.length} of ${tasks.length} tasks.`,
    'polite'
  );
  previousTaskCount = tasks.length;
}

// Handle scroll
function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  scrollTop = target.scrollTop;
}

// Handle keyboard navigation (Arrow keys for task navigation)
function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  const focusedTaskItem = target.querySelector('[role="button"]:focus') as HTMLElement;
  
  if (!focusedTaskItem) return;

  let nextElement: HTMLElement | null = null;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      nextElement = focusedTaskItem.nextElementSibling as HTMLElement;
      break;
    case 'ArrowUp':
      event.preventDefault();
      nextElement = focusedTaskItem.previousElementSibling as HTMLElement;
      break;
    case 'Home':
      event.preventDefault();
      nextElement = target.querySelector('[role="button"]') as HTMLElement;
      break;
    case 'End':
      event.preventDefault();
      const items = target.querySelectorAll('[role="button"]');
      nextElement = items[items.length - 1] as HTMLElement;
      break;
  }

  if (nextElement) {
    nextElement.focus();
  }
}

// Handle task actions
function handleTaskClick(task: Task) {
  dispatch('taskClick', task);
}

function handleTaskToggle(task: Task) {
  dispatch('taskToggle', task);
}

function handleTaskEdit(task: Task) {
  dispatch('taskEdit', task);
}

// Measure container
let containerElement: HTMLElement;

onMount(() => {
  if (containerElement) {
    containerHeight = containerElement.clientHeight;

    // Update on resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeight = entry.contentRect.height;
      }
    });

    resizeObserver.observe(containerElement);

    return () => {
      resizeObserver.disconnect();
    };
  }
});
</script>

<div
  class="task-list-view"
  bind:this={containerElement}
  on:scroll={handleScroll}
  on:keydown={handleKeyDown}
  role="region"
  aria-label={taskCountLabel}
  aria-live="polite"
  aria-relevant="additions removals"
  tabindex="-1"
>
  <!-- Screen reader announcement region -->
  <div id={liveRegionId} class="sr-only" aria-live="polite" aria-atomic="true">
    {#if tasks.length === 0}
      No tasks to display
    {:else}
      Showing {visibleTasks.length} of {tasks.length} tasks
    {/if}
  </div>

  {#if tasks.length === 0}
    <div class="task-list-empty" role="status">
      <p>No tasks found</p>
    </div>
  {:else}
    <div class="task-list-spacer" style="height: {totalHeight}px;">
      <div 
        class="task-list-items" 
        style="transform: translateY({offsetY}px);"
        role="list"
        aria-label="Task list items"
      >
        {#each visibleTasks as task, index (task.id)}
          <TaskListItem
            {task}
            index={startIndex + index}
            on:click={() => handleTaskClick(task)}
            on:toggle={() => handleTaskToggle(task)}
            on:edit={() => handleTaskEdit(task)}
          />
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
.task-list-view {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.task-list-view:focus {
  outline: none; /* Outline on individual task items instead */
}

.task-list-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-style: italic;
}

.task-list-spacer {
  position: relative;
  width: 100%;
}

.task-list-items {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

/* Screen reader only utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
