<script lang="ts">
  /**
   * Timeline View Component
   * 
   * Displays tasks in a chronological timeline format
   * Shows tasks grouped by date with visual timeline
   * 
   * Features:
   * - Chronological task display
   * - Date grouping
   * - Past/present/future sections
   * - Overdue highlighting
   * - Scroll to today
   * - Zoom levels (week, month, quarter)
   * 
   * @module TimelineView
   */

  import { onMount } from "svelte";
  import type { Task } from "@backend/core/models/Task";
  import { TIMELINE_DAYS } from "@shared/constants/misc-constants";
  
  export let tasks: Task[] = [];
  export let onTaskClick: ((task: Task) => void) | undefined = undefined;
  export let daysToShow: number = TIMELINE_DAYS;
  export let showCompleted: boolean = false;

  type TimelineZoom = "week" | "month" | "quarter";
  type DateGroup = {
    date: Date;
    dateStr: string;
    tasks: Task[];
    isToday: boolean;
    isPast: boolean;
    isOverdue: boolean;
  };

  let zoom: TimelineZoom = "month";
  let timelineData: DateGroup[] = [];
  let todayRef: HTMLElement | null = null;

  $: {
    // Update timeline when tasks or zoom changes
    updateTimeline(tasks, zoom, daysToShow, showCompleted);
  }

  function updateTimeline(
    taskList: Task[],
    zoomLevel: TimelineZoom,
    days: number,
    includeCompleted: boolean
  ) {
    // Filter tasks
    let filteredTasks = taskList;
    if (!includeCompleted) {
      filteredTasks = taskList.filter(t => t.status?.toLowerCase() !== "done");
    }

    // Calculate date range based on zoom
    const dayRange = getDayRange(zoomLevel, days);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dayRange.past);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + dayRange.future);

    // Group tasks by date
    const groupMap = new Map<string, Task[]>();
    const today = formatDateStr(new Date());

    for (const task of filteredTasks) {
      if (!task.dueAt) continue;

      const dueDate = new Date(task.dueAt);
      if (dueDate < startDate || dueDate > endDate) continue;

      const dateStr = formatDateStr(dueDate);
      if (!groupMap.has(dateStr)) {
        groupMap.set(dateStr, []);
      }
      groupMap.get(dateStr)!.push(task);
    }

    // Build timeline data
    const timeline: DateGroup[] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = formatDateStr(currentDate);
      const tasksForDate = groupMap.get(dateStr) || [];
      
      // Only include dates with tasks or today
      if (tasksForDate.length > 0 || dateStr === today) {
        const isPast = currentDate < new Date();
        const isOverdue = isPast && tasksForDate.some(t => 
          t.status?.toLowerCase() !== "done"
        );

        timeline.push({
          date: new Date(currentDate),
          dateStr,
          tasks: tasksForDate.sort((a, b) => {
            // Sort by priority then name
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
            const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
            if (aPriority !== bPriority) return bPriority - aPriority;
            return a.name.localeCompare(b.name);
          }),
          isToday: dateStr === today,
          isPast,
          isOverdue,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    timelineData = timeline;
  }

  function getDayRange(zoomLevel: TimelineZoom, defaultDays: number): { past: number; future: number } {
    switch (zoomLevel) {
      case "week":
        return { past: 7, future: 7 };
      case "month":
        return { past: 15, future: defaultDays };
      case "quarter":
        return { past: 30, future: 60 };
      default:
        return { past: 15, future: defaultDays };
    }
  }

  function formatDateStr(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDateDisplay(date: Date): string {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = formatDateStr(date);
    const todayStr = formatDateStr(today);
    const tomorrowStr = formatDateStr(tomorrow);
    const yesterdayStr = formatDateStr(yesterday);

    if (dateStr === todayStr) return "Today";
    if (dateStr === tomorrowStr) return "Tomorrow";
    if (dateStr === yesterdayStr) return "Yesterday";

    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    };
    return date.toLocaleDateString(undefined, options);
  }

  function getRelativeTime(date: Date): string {
    const today = new Date();
    const diffMs = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays > 0) return `in ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  }

  function handleTaskClick(task: Task) {
    if (onTaskClick) {
      onTaskClick(task);
    }
  }

  function handleZoomChange(newZoom: TimelineZoom) {
    zoom = newZoom;
  }

  function scrollToToday() {
    if (todayRef) {
      todayRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  onMount(() => {
    // Scroll to today on mount
    setTimeout(scrollToToday, 100);
  });

  function getTaskStatusClass(task: Task): string {
    const status = task.status?.toLowerCase();
    if (status === "done") return "task-done";
    if (status === "in-progress") return "task-in-progress";
    return "task-todo";
  }

  function getPriorityClass(priority?: string): string {
    return `priority-${priority?.toLowerCase() || 'medium'}`;
  }
</script>

<div class="timeline-view" role="region" aria-label="Task timeline">
  <!-- Toolbar -->
  <div class="timeline-toolbar">
    <div class="timeline-zoom-controls" role="toolbar" aria-label="Zoom controls">
      <button
        class="zoom-btn"
        class:active={zoom === "week"}
        on:click={() => handleZoomChange("week")}
        aria-label="Week view"
        type="button"
      >
        Week
      </button>
      <button
        class="zoom-btn"
        class:active={zoom === "month"}
        on:click={() => handleZoomChange("month")}
        aria-label="Month view"
        type="button"
      >
        Month
      </button>
      <button
        class="zoom-btn"
        class:active={zoom === "quarter"}
        on:click={() => handleZoomChange("quarter")}
        aria-label="Quarter view"
        type="button"
      >
        Quarter
      </button>
    </div>
    
    <button
      class="scroll-to-today-btn"
      on:click={scrollToToday}
      aria-label="Scroll to today"
      type="button"
    >
      📅 Today
    </button>
  </div>

  <!-- Timeline -->
  <div class="timeline-content">
    {#if timelineData.length === 0}
      <div class="timeline-empty" role="status">
        <div class="empty-icon" aria-hidden="true">📋</div>
        <p>No tasks scheduled in this time range</p>
        <p class="empty-hint">Try adjusting the zoom level or adding more tasks</p>
      </div>
    {:else}
      <div class="timeline-track">
        {#each timelineData as group (group.dateStr)}
          {#if group.isToday}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
              class="timeline-group is-today"
              class:is-past={group.isPast}
              class:is-overdue={group.isOverdue}
              bind:this={todayRef}
            >
              <!-- Date Header -->
              <div class="timeline-date-header">
                <div class="date-marker" aria-hidden="true">
                  <div class="marker-dot"></div>
                  <div class="marker-line"></div>
                </div>
                <div class="date-content">
                  <h3 class="date-title">
                    {formatDateDisplay(group.date)}
                    <span class="today-badge" aria-label="Today">Today</span>
                  </h3>
                  <span class="date-subtitle">{getRelativeTime(group.date)}</span>
                  <span class="task-count" aria-label="{group.tasks.length} tasks">
                    {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
              </div>

              <!-- Tasks for this date -->
              <div class="timeline-tasks" role="list">
                {#each group.tasks as task (task.id)}
                  <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
                  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                  <div
                    class="timeline-task {getTaskStatusClass(task)}"
                    role="listitem"
                    tabindex="0"
                    on:click={() => handleTaskClick(task)}
                    on:keydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTaskClick(task);
                      }
                    }}
                  >
                    <div class="task-connector" aria-hidden="true"></div>
                    <div class="task-content">
                      <div class="task-header">
                        <span class="task-priority {getPriorityClass(task.priority)}" aria-label="Priority {task.priority}">
                          {#if task.priority === 'high'}🔴{:else if task.priority === 'medium'}🟡{:else}🟢{/if}
                        </span>
                        <h4 class="task-name">{task.name}</h4>
                        <span class="task-status-badge">{task.status}</span>
                      </div>
                      {#if task.description}
                        <p class="task-description">{task.description}</p>
                      {/if}
                      {#if task.tags && task.tags.length > 0}
                        <div class="task-tags">
                          {#each task.tags as tag}
                            <span class="task-tag">{tag}</span>
                          {/each}
                        </div>
                      {/if}
                      {#if task.dueAt}
                        <div class="task-time">
                          <span aria-label="Due time">🕐 {new Date(task.dueAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
              class="timeline-group"
              class:is-past={group.isPast}
              class:is-overdue={group.isOverdue}
            >
            <!-- Date Header -->
            <div class="timeline-date-header">
              <div class="date-marker" aria-hidden="true">
                <div class="marker-dot"></div>
                <div class="marker-line"></div>
              </div>
              <div class="date-content">
                <h3 class="date-title">
                  {formatDateDisplay(group.date)}
                  {#if group.isToday}
                    <span class="today-badge" aria-label="Today">Today</span>
                  {/if}
                </h3>
                <span class="date-subtitle">{getRelativeTime(group.date)}</span>
                <span class="task-count" aria-label="{group.tasks.length} tasks">
                  {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>
            </div>

            <!-- Tasks for this date -->
            <div class="timeline-tasks" role="list">
              {#each group.tasks as task (task.id)}
                <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
                <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                <div
                  class="timeline-task {getTaskStatusClass(task)}"
                  role="listitem"
                  tabindex="0"
                  on:click={() => handleTaskClick(task)}
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTaskClick(task);
                    }
                  }}
                >
                  <div class="task-connector" aria-hidden="true"></div>
                  <div class="task-content">
                    <div class="task-header">
                      <span class="task-priority {getPriorityClass(task.priority)}" aria-label="Priority {task.priority}">
                        {#if task.priority === 'high'}🔴{:else if task.priority === 'medium'}🟡{:else}🟢{/if}
                      </span>
                      <h4 class="task-name">{task.name}</h4>
                      <span class="task-status-badge">{task.status}</span>
                    </div>
                    {#if task.description}
                      <p class="task-description">{task.description}</p>
                    {/if}
                    {#if task.tags && task.tags.length > 0}
                      <div class="task-tags">
                        {#each task.tags as tag}
                          <span class="task-tag">{tag}</span>
                        {/each}
                      </div>
                    {/if}
                    {#if task.dueAt}
                      <div class="task-time">
                        <span aria-label="Due time">🕐 {new Date(task.dueAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .timeline-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--b3-theme-surface, white);
    border-radius: 8px;
    overflow: hidden;
  }

  .timeline-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--b3-theme-surface-lighter, #eee);
    background: var(--b3-theme-surface-light, #f9f9f9);
  }

  .timeline-zoom-controls {
    display: flex;
    gap: 8px;
    background: var(--b3-theme-surface, white);
    border-radius: 6px;
    padding: 4px;
  }

  .zoom-btn {
    padding: 6px 16px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-on-surface, #333);
    transition: all 0.2s;
  }

  .zoom-btn.active {
    background: var(--b3-theme-primary, #4285f4);
    color: white;
  }

  .zoom-btn:hover:not(.active) {
    background: var(--b3-theme-surface-lighter, #eee);
  }

  .scroll-to-today-btn {
    padding: 8px 16px;
    border: 1px solid var(--b3-theme-primary, #4285f4);
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--b3-theme-primary, #4285f4);
    transition: all 0.2s;
  }

  .scroll-to-today-btn:hover {
    background: var(--b3-theme-primary, #4285f4);
    color: white;
  }

  .timeline-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px 16px;
  }

  .timeline-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    color: var(--b3-theme-on-surface-light, #666);
  }

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .timeline-empty p {
    margin: 4px 0;
  }

  .empty-hint {
    font-size: 14px;
    opacity: 0.7;
  }

  .timeline-track {
    position: relative;
    max-width: 900px;
    margin: 0 auto;
  }

  .timeline-group {
    position: relative;
    margin-bottom: 40px;
    padding-left: 40px;
  }

  .timeline-group.is-today {
    background: rgba(66, 133, 244, 0.05);
    border-radius: 8px;
    padding: 16px 16px 16px 56px;
    margin-left: -16px;
    margin-right: -16px;
  }

  .timeline-date-header {
    display: flex;
    align-items: start;
    margin-bottom: 16px;
    position: relative;
  }

  .date-marker {
    position: absolute;
    left: -40px;
    top: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .marker-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--b3-theme-primary, #4285f4);
    border: 3px solid var(--b3-theme-surface, white);
    box-shadow: 0 0 0 2px var(--b3-theme-primary, #4285f4);
    z-index: 2;
  }

  .timeline-group.is-past .marker-dot {
    background: var(--b3-theme-on-surface-light, #999);
    box-shadow: 0 0 0 2px var(--b3-theme-on-surface-light, #999);
  }

  .timeline-group.is-overdue .marker-dot {
    background: var(--b3-theme-error, #d32f2f);
    box-shadow: 0 0 0 2px var(--b3-theme-error, #d32f2f);
  }

  .marker-line {
    width: 2px;
    height: 100%;
    min-height: 60px;
    background: var(--b3-theme-surface-lighter, #ddd);
    margin-top: -3px;
  }

  .date-content {
    flex: 1;
  }

  .date-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-surface, #333);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .today-badge {
    display: inline-block;
    padding: 2px 8px;
    background: var(--b3-theme-primary, #4285f4);
    color: white;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .date-subtitle {
    display: block;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light, #666);
    margin-top: 4px;
  }

  .task-count {
    display: inline-block;
    margin-top: 4px;
    padding: 2px 8px;
    background: var(--b3-theme-surface-light, #f0f0f0);
    border-radius: 4px;
    font-size: 12px;
    color: var(--b3-theme-on-surface-light, #666);
  }

  .timeline-tasks {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .timeline-task {
    position: relative;
    background: var(--b3-theme-surface, white);
    border: 1px solid var(--b3-theme-surface-lighter, #ddd);
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .timeline-task:hover {
    border-color: var(--b3-theme-primary, #4285f4);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateX(4px);
  }

  .timeline-task:focus {
    outline: 2px solid var(--b3-theme-primary, #4285f4);
    outline-offset: 2px;
  }

  .timeline-task.task-done {
    opacity: 0.6;
    border-color: var(--b3-theme-success, #4caf50);
  }

  .timeline-task.task-in-progress {
    border-left: 4px solid var(--b3-theme-warning, #ff9800);
  }

  .task-connector {
    position: absolute;
    left: -28px;
    top: 24px;
    width: 24px;
    height: 2px;
    background: var(--b3-theme-surface-lighter, #ddd);
  }

  .task-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .task-priority {
    font-size: 14px;
    line-height: 1;
  }

  .task-name {
    flex: 1;
    margin: 0;
    font-size: 16px;
    font-weight: 500;
    color: var(--b3-theme-on-surface, #333);
  }

  .task-done .task-name {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .task-status-badge {
    padding: 2px 8px;
    background: var(--b3-theme-surface-light, #f0f0f0);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .task-description {
    margin: 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface-light, #666);
    line-height: 1.5;
  }

  .task-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .task-tag {
    padding: 2px 8px;
    background: var(--b3-theme-surface-light, #f0f0f0);
    border-radius: 4px;
    font-size: 12px;
    color: var(--b3-theme-on-surface, #333);
  }

  .task-time {
    font-size: 13px;
    color: var(--b3-theme-on-surface-light, #666);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .timeline-toolbar {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }

    .timeline-zoom-controls {
      justify-content: center;
    }

    .timeline-group {
      padding-left: 32px;
    }

    .date-marker {
      left: -32px;
    }

    .task-connector {
      left: -20px;
      width: 16px;
    }
  }
</style>
