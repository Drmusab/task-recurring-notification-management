<script lang="ts">
/**
 * CalendarDay - Single day cell for calendar view with WCAG 2.1 AA accessibility
 * 
 * Displays:
 * - Day number
 * - Task chips for all tasks occurring on this day
 * - Visual indicators for current day, selected day
 * - Overflow handling for many tasks
 * - Grid cell role for keyboard navigation
 * 
 * @module CalendarDay
 * @accessibility WCAG 2.1 AA compliant gridcell
 * @version 2.0.0
 */

import type { Task } from "@backend/core/models/Task";
import TaskChip from "./TaskChip.svelte";

export let date: Date;
export let tasks: Task[] = [];
export let isCurrentMonth: boolean = true;
export let isToday: boolean = false;
export let isSelected: boolean = false;
export let maxTasksShown: number = 3;
export let tabindex: number = -1;
export let onDayClick: ((date: Date) => void) | undefined = undefined;
export let onTaskClick: ((task: Task) => void) | undefined = undefined;

// Get day number
$: dayNumber = date.getDate();

// Check if day has tasks
$: hasTasks = tasks.length > 0;

// Get visible tasks (limited by maxTasksShown)
$: visibleTasks = tasks.slice(0, maxTasksShown);

// Count overflow tasks
$: overflowCount = Math.max(0, tasks.length - maxTasksShown);

// Handle day click
function handleDayClick() {
  if (onDayClick) {
    onDayClick(date);
  }
}

// Handle task click handler
function createTaskClickHandler(task: Task) {
  return () => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };
}

// Get task count by status
$: taskCountByStatus = tasks.reduce(
  (acc, task) => {
    const status = task.status ?? "todo";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>
);

// Format date for ARIA label
function formatDateForAria(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
</script>

<div
  class="calendar-day"
  class:current-month={isCurrentMonth}
  class:other-month={!isCurrentMonth}
  class:today={isToday}
  class:selected={isSelected}
  class:has-tasks={hasTasks}
  on:click={handleDayClick}
  on:keypress={(e) => (e.key === "Enter" || e.key === " ") && handleDayClick()}
  role="gridcell"
  tabindex={tabindex}
  aria-selected={isSelected}
  aria-current={isToday ? "date" : undefined}
  aria-label="{formatDateForAria(date)}{tasks.length > 0 ? `, ${tasks.length} task${tasks.length === 1 ? '' : 's'}` : ', no tasks'}"
>
  <!-- Day number header -->
  <div class="day-header">
    <span class="day-number">{dayNumber}</span>
    {#if hasTasks}
      <span class="task-count" title="{tasks.length} task{tasks.length === 1 ? '' : 's'}">
        {tasks.length}
      </span>
    {/if}
  </div>

  <!-- Task chips -->
  {#if hasTasks}
    <div class="task-list">
      {#each visibleTasks as task (task.id)}
        <TaskChip {task} onClick={onTaskClick ? createTaskClickHandler(task) : undefined} />
      {/each}

      <!-- Overflow indicator -->
      {#if overflowCount > 0}
        <div class="overflow-indicator">
          +{overflowCount} more
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .calendar-day {
    position: relative;
    min-height: 100px;
    padding: 0.5rem;
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
  }

  .calendar-day:hover {
    background: #F9FAFB;
    border-color: #D1D5DB;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .calendar-day:focus {
    outline: 2px solid var(--interactive-accent, #3B82F6);
    outline-offset: -2px;
    z-index: 1;
  }

  .calendar-day.today {
    background: #EFF6FF;
    border-color: #3B82F6;
    border-width: 2px;
  }

  .calendar-day.selected {
    background: #E0E7FF;
    border-color: #6366F1;
    border-width: 2px;
  }

  .calendar-day.other-month {
    background: #F9FAFB;
    opacity: 0.5;
  }

  .calendar-day.other-month .day-number {
    color: #9CA3AF;
  }

  .day-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    gap: 0.25rem;
  }

  .day-number {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1F2937;
  }

  .calendar-day.today .day-number {
    color: #2563EB;
    font-weight: 700;
  }

  .task-count {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    background: #E5E7EB;
    color: #4B5563;
    border-radius: 10px;
    font-weight: 600;
    line-height: 1;
  }

  .calendar-day.today .task-count {
    background: #DBEAFE;
    color: #1E40AF;
  }

  .task-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    max-height: calc(100% - 2rem);
  }

  /* Custom scrollbar for task list */
  .task-list::-webkit-scrollbar {
    width: 4px;
  }

  .task-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .task-list::-webkit-scrollbar-thumb {
    background: #D1D5DB;
    border-radius: 2px;
  }

  .task-list::-webkit-scrollbar-thumb:hover {
    background: #9CA3AF;
  }

  .overflow-indicator {
    margin-top: 0.25rem;
    padding: 0.125rem 0.375rem;
    font-size: 0.625rem;
    color: #6B7280;
    background: #F3F4F6;
    border-radius: 3px;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .overflow-indicator:hover {
    background: #E5E7EB;
    color: #374151;
  }

  /* Responsive: Smaller day cells on mobile */
  @media (max-width: 768px) {
    .calendar-day {
      min-height: 80px;
      padding: 0.375rem;
    }

    .day-number {
      font-size: 0.75rem;
    }

    .task-count {
      font-size: 0.5rem;
      padding: 0.0625rem 0.25rem;
    }
  }
</style>
