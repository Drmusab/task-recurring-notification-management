<!--
  CalendarView.svelte — Task Calendar Dock Panel
  
  Displays tasks on a month-view calendar grid.
  Mounted via addDock() in dockMounts.ts (Phase 4).
  
  Props:
    - taskStorage: TaskStorage instance for loading tasks
    - pluginEventBus: PluginEventBus for reactive updates
    - plugin: SiYuan Plugin instance
    - isMobile: boolean for responsive layout
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { Plugin } from "siyuan";
  import type { TaskStorage } from "@backend/core/storage/TaskStorage";
  import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
  import type { Task } from "@backend/core/models/Task";

  // Props
  export let taskStorage: TaskStorage;
  export let pluginEventBus: PluginEventBus;
  export let plugin: Plugin;
  export let isMobile: boolean = false;

  // State
  let currentDate = new Date();
  let tasks: Task[] = [];
  let loading = true;
  let calendarDays: Array<{
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    tasks: Task[];
  }> = [];

  // Computed
  $: monthLabel = currentDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
  $: weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Load tasks
  async function loadTasks() {
    loading = true;
    try {
      const taskMap = await taskStorage.loadActive();
      tasks = Array.from(taskMap.values());
      buildCalendarGrid();
    } catch (err) {
      console.error("[CalendarView] Failed to load tasks:", err);
    } finally {
      loading = false;
    }
  }

  // Build the calendar grid for the current month
  function buildCalendarGrid() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: typeof calendarDays = [];

    // Fill in days before the first of the month
    const startPad = firstDay.getDay();
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: false,
        tasks: getTasksForDate(d),
      });
    }

    // Fill in days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        tasks: getTasksForDate(date),
      });
    }

    // Fill remaining cells (up to 42 = 6 weeks)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: false,
        tasks: getTasksForDate(d),
      });
    }

    calendarDays = days;
  }

  // Get tasks due on a specific date
  function getTasksForDate(date: Date): Task[] {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return tasks.filter((task) => {
      const dueStr = (task as any).dueAt || (task as any).dueDate;
      if (!dueStr) return false;
      const dueDate = new Date(dueStr);
      return dueDate >= dayStart && dueDate <= dayEnd;
    });
  }

  // Navigate months
  function prevMonth() {
    currentDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1
    );
    buildCalendarGrid();
  }

  function nextMonth() {
    currentDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      1
    );
    buildCalendarGrid();
  }

  function goToToday() {
    currentDate = new Date();
    buildCalendarGrid();
  }

  // Event bus subscription
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    loadTasks();
    unsubscribe = pluginEventBus.on("task:refresh", () => {
      loadTasks();
    });
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });
</script>

<div class="calendar-view" class:calendar-view--mobile={isMobile}>
  <!-- Header -->
  <div class="calendar-header">
    <button class="calendar-nav-btn" on:click={prevMonth} aria-label="Previous month">
      ‹
    </button>
    <button class="calendar-today-btn" on:click={goToToday}>
      {monthLabel}
    </button>
    <button class="calendar-nav-btn" on:click={nextMonth} aria-label="Next month">
      ›
    </button>
  </div>

  {#if loading}
    <div class="calendar-loading">Loading tasks...</div>
  {:else}
    <!-- Week day headers -->
    <div class="calendar-weekdays">
      {#each weekDays as day}
        <div class="calendar-weekday">{day}</div>
      {/each}
    </div>

    <!-- Calendar grid -->
    <div class="calendar-grid">
      {#each calendarDays as day}
        <div
          class="calendar-day"
          class:calendar-day--other={!day.isCurrentMonth}
          class:calendar-day--today={day.isToday}
          class:calendar-day--has-tasks={day.tasks.length > 0}
        >
          <span class="calendar-day-number">{day.date.getDate()}</span>
          {#if day.tasks.length > 0}
            <div class="calendar-day-tasks">
              {#each day.tasks.slice(0, 3) as task}
                <div
                  class="calendar-task-dot"
                  title={task.description || (task as any).name || "Task"}
                ></div>
              {/each}
              {#if day.tasks.length > 3}
                <span class="calendar-task-more">+{day.tasks.length - 3}</span>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .calendar-view {
    padding: 12px;
    font-family: var(--b3-font-family);
    color: var(--b3-theme-on-background);
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 8px;
  }

  .calendar-nav-btn,
  .calendar-today-btn {
    background: transparent;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    cursor: pointer;
    color: var(--b3-theme-on-background);
    font-size: 14px;
    padding: 4px 12px;
    transition: background 0.15s;
  }

  .calendar-nav-btn:hover,
  .calendar-today-btn:hover {
    background: var(--b3-list-hover);
  }

  .calendar-today-btn {
    font-weight: 600;
    flex: 1;
    text-align: center;
  }

  .calendar-loading {
    text-align: center;
    padding: 40px 0;
    color: var(--b3-theme-on-surface-light);
  }

  .calendar-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    margin-bottom: 4px;
  }

  .calendar-weekday {
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: var(--b3-theme-on-surface-light);
    padding: 4px 0;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    flex: 1;
  }

  .calendar-day {
    min-height: 48px;
    padding: 4px;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: default;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: background 0.1s;
  }

  .calendar-day:hover {
    background: var(--b3-list-hover);
  }

  .calendar-day--other {
    opacity: 0.35;
  }

  .calendar-day--today {
    background: var(--b3-theme-primary-lightest, rgba(52, 120, 246, 0.08));
    border-color: var(--b3-theme-primary);
  }

  .calendar-day--today .calendar-day-number {
    color: var(--b3-theme-primary);
    font-weight: 700;
  }

  .calendar-day-number {
    font-size: 12px;
    line-height: 1;
    margin-bottom: 2px;
  }

  .calendar-day-tasks {
    display: flex;
    gap: 2px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .calendar-task-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--b3-theme-primary);
  }

  .calendar-task-more {
    font-size: 9px;
    color: var(--b3-theme-on-surface-light);
  }

  .calendar-view--mobile .calendar-day {
    min-height: 36px;
    padding: 2px;
  }

  .calendar-view--mobile .calendar-day-number {
    font-size: 11px;
  }
</style>
