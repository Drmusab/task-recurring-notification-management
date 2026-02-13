<script lang="ts">
/**
 * CalendarView - Monthly calendar grid view with WCAG 2.1 AA accessibility
 * 
 * Features:
 * - Monthly calendar grid (7 days × 5-6 weeks)
 * - Task occurrence display via RecurrencePreviewService
 * - Month navigation (prev/next)
 * - Current day highlighting
 * - Day selection for detailed view
 * - Performance optimized with caching
 * - Full keyboard navigation (arrow keys, Home, End, PageUp/Down)
 * 
 * @module CalendarView
 * @accessibility WCAG 2.1 AA compliant grid navigation
 * @version 2.0.0
 */

import { onMount } from "svelte";
import type { Task } from "@backend/core/models/Task";
import { globalRecurrencePreviewService } from "../../../backend/core/services/RecurrencePreviewService";
import CalendarDay from "./CalendarDay.svelte";
import { generateAriaId } from "@frontend/utils/accessibility";

export let tasks: Task[] = [];
export let onTaskClick: ((task: Task) => void) | undefined = undefined;
export let onDaySelect: ((date: Date) => void) | undefined = undefined;

// Current view state
let currentDate = new Date();
let selectedDate: Date | null = null;

// Keyboard navigation state
let focusedRowIndex = 0;
let focusedColIndex = 0;

// Calendar grid state
let calendarWeeks: Date[][] = [];
let monthOccurrences: Map<string, Task[]> = new Map();

// Generate unique IDs for ARIA
const gridId = generateAriaId('calendar-grid');
const gridLabelId = generateAriaId('calendar-label');

// Month navigation
function goToPreviousMonth() {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  updateCalendar();
}

function goToNextMonth() {
  currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  updateCalendar();
}

function goToToday() {
  currentDate = new Date();
  selectedDate = new Date();
  updateCalendar();
}

// Update calendar grid and fetch occurrences
async function updateCalendar() {
  // Generate calendar weeks
  calendarWeeks = generateCalendarWeeks(currentDate);

  // Get year-month key
  const yearMonth = formatYearMonth(currentDate);

  // Pre-cache adjacent months for smooth navigation
  globalRecurrencePreviewService.precacheMonths(yearMonth, tasks, 1);

  // Get occurrences for current month
  const result = globalRecurrencePreviewService.getOccurrencesForMonth(yearMonth, tasks);
  monthOccurrences = result.tasksByDate;
}

// Generate calendar weeks (7 days × 5-6 rows)
function generateCalendarWeeks(date: Date): Date[][] {
  const year = date.getFullYear();
  const month = date.getMonth();

  // Get first day of month
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday

  // Get last day of month
  const lastDay = new Date(year, month + 1, 0);
  const lastDayDate = lastDay.getDate();

  // Calculate start date (may be in previous month)
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDayOfWeek);

  // Generate weeks
  const weeks: Date[][] = [];
  let currentWeekDate = new Date(startDate);

  // Generate 6 weeks (max possible)
  for (let week = 0; week < 6; week++) {
    const weekDays: Date[] = [];

    for (let day = 0; day < 7; day++) {
      weekDays.push(new Date(currentWeekDate));
      currentWeekDate.setDate(currentWeekDate.getDate() + 1);
    }

    weeks.push(weekDays);

    // Stop if we've gone past the end of the month and filled at least 5 weeks
    if (week >= 4 && currentWeekDate.getMonth() !== month) {
      break;
    }
  }

  return weeks;
}

// Check if date is today
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// Check if date is in current month
function isCurrentMonth(date: Date): boolean {
  return (
    date.getMonth() === currentDate.getMonth() &&
    date.getFullYear() === currentDate.getFullYear()
  );
}

// Check if date is selected
function isSelected(date: Date): boolean {
  if (!selectedDate) return false;
  return (
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear()
  );
}

// Get tasks for a specific date
function getTasksForDate(date: Date): Task[] {
  const dateKey = formatDateKey(date);
  return monthOccurrences.get(dateKey) || [];
}

// Handle day click
function handleDayClick(date: Date) {
  selectedDate = date;
  if (onDaySelect) {
    onDaySelect(date);
  }
}

// Format date as YYYY-MM-DD
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date as YYYY-MM
function formatYearMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Format month display
function formatMonthDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// Week day names
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Reactive: Update calendar when tasks change
$: if (tasks) {
  updateCalendar();
}

// Initialize on mount
onMount(() => {
  updateCalendar();
  
  // Set initial focus to today or first day
  const todayIndex = calendarWeeks.flat().findIndex(d => isToday(d));
  if (todayIndex >= 0) {
    focusedRowIndex = Math.floor(todayIndex / 7);
    focusedColIndex = todayIndex % 7;
  }
});

// Accessibility: Grid keyboard navigation
function handleGridKeyDown(event: KeyboardEvent) {
  let handled = false;
  
  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault();
      moveFocus(0, 1);
      handled = true;
      break;
    case 'ArrowLeft':
      event.preventDefault();
      moveFocus(0, -1);
      handled = true;
      break;
    case 'ArrowDown':
      event.preventDefault();
      moveFocus(1, 0);
      handled = true;
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveFocus(-1, 0);
      handled = true;
      break;
    case 'Home':
      event.preventDefault();
      if (event.ctrlKey) {
        // Ctrl+Home: Go to first day of month
        focusedRowIndex = 0;
        focusedColIndex = 0;
      } else {
        // Home: Go to start of week
        focusedColIndex = 0;
      }
      focusGridCell();
      handled = true;
      break;
    case 'End':
      event.preventDefault();
      if (event.ctrlKey) {
        // Ctrl+End: Go to last day of month
        focusedRowIndex = calendarWeeks.length - 1;
        focusedColIndex = 6;
      } else {
        // End: Go to end of week
        focusedColIndex = 6;
      }
      focusGridCell();
      handled = true;
      break;
    case 'PageUp':
      event.preventDefault();
      if (event.shiftKey) {
        // Shift+PageUp: Previous year
        currentDate = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1);
      } else {
        // PageUp: Previous month
        goToPreviousMonth();
      }
      handled = true;
      break;
    case 'PageDown':
      event.preventDefault();
      if (event.shiftKey) {
        // Shift+PageDown: Next year
        currentDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1);
      } else {
        // PageDown: Next month
        goToNextMonth();
      }
      handled = true;
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      const focusedDate = calendarWeeks[focusedRowIndex]?.[focusedColIndex];
      if (focusedDate) {
        handleDayClick(focusedDate);
      }
      handled = true;
      break;
  }
  
  return handled;
}

function moveFocus(rowDelta: number, colDelta: number) {
  const newRow = focusedRowIndex + rowDelta;
  const newCol = focusedColIndex + colDelta;
  
  // Handle wrapping within the grid
  if (newCol < 0) {
    // Move to previous week
    if (newRow > 0) {
      focusedRowIndex = newRow - 1;
      focusedColIndex = 6;
    } else {
      // Go to previous month
      goToPreviousMonth();
      setTimeout(() => {
        focusedRowIndex = calendarWeeks.length - 1;
        focusedColIndex = 6;
        focusGridCell();
      }, 50);
      return;
    }
  } else if (newCol > 6) {
    // Move to next week
    if (newRow < calendarWeeks.length - 1) {
      focusedRowIndex = newRow + 1;
      focusedColIndex = 0;
    } else {
      // Go to next month
      goToNextMonth();
      setTimeout(() => {
        focusedRowIndex = 0;
        focusedColIndex = 0;
        focusGridCell();
      }, 50);
      return;
    }
  } else if (newRow < 0 || newRow >= calendarWeeks.length) {
    // Out of bounds vertically, stay in place
    return;
  } else {
    focusedRowIndex = newRow;
    focusedColIndex = newCol;
  }
  
  focusGridCell();
}

function focusGridCell() {
  // Focus the gridcell at the current position
  const gridElement = document.getElementById(gridId);
  if (!gridElement) return;
  
  const rows = gridElement.querySelectorAll('[role="row"]');
  const targetRow = rows[focusedRowIndex + 1]; // +1 to skip header row
  if (!targetRow) return;
  
  const cells = targetRow.querySelectorAll('[role="gridcell"]');
  const targetCell = cells[focusedColIndex] as HTMLElement;
  if (targetCell) {
    targetCell.focus();
  }
}

// Get tabindex for a cell (only focused cell is in tab order)
function getCellTabIndex(rowIndex: number, colIndex: number): number {
  return (rowIndex === focusedRowIndex && colIndex === focusedColIndex) ? 0 : -1;
}

</script>

<div class="calendar-view">
  <!-- Calendar header -->
  <div class="calendar-header">
    <h2 class="month-display" id={gridLabelId}>
      {formatMonthDisplay(currentDate)}
    </h2>

    <div class="calendar-controls">
      <button
        class="control-btn"
        on:click={goToPreviousMonth}
        type="button"
        title="Previous month (or press PageUp)"
        aria-label="Previous month"
      >
        <span aria-hidden="true">◀</span>
      </button>

      <button
        class="control-btn today-btn"
        on:click={goToToday}
        type="button"
        title="Go to today (current date)"
        aria-label="Go to today"
      >
        Today
      </button>

      <button
        class="control-btn"
        on:click={goToNextMonth}
        type="button"
        title="Next month (or press PageDown)"
        aria-label="Next month"
      >
        <span aria-hidden="true">▶</span>
      </button>
    </div>
  </div>

  <!-- Stats display -->
  <div class="calendar-stats" role="status" aria-live="polite">
    <span class="stat">
      <span class="stat-label">Total Occurrences:</span>
      <span class="stat-value">{Array.from(monthOccurrences.values()).flat().length}</span>
    </span>
    <span class="stat">
      <span class="stat-label">Days with Tasks:</span>
      <span class="stat-value">{monthOccurrences.size}</span>
    </span>
  </div>

  <!-- Calendar grid - WCAG 2.1 AA Grid Pattern -->
  <div 
    class="calendar-grid"
    role="grid"
    aria-labelledby={gridLabelId}
    aria-readonly="false"
    id={gridId}
    tabindex="-1"
    on:keydown={handleGridKeyDown}
  >
    <!-- Week day headers -->
    <div class="week-header" role="row">
      {#each weekDays as day}
        <div class="week-day-label" role="columnheader" aria-label={day}>
          {day}
        </div>
      {/each}
    </div>

    <!-- Calendar weeks -->
    {#each calendarWeeks as week, rowIndex}
      <div class="calendar-week" role="row">
        {#each week as dayDate, colIndex}
          <CalendarDay
            date={dayDate}
            tasks={getTasksForDate(dayDate)}
            isCurrentMonth={isCurrentMonth(dayDate)}
            isToday={isToday(dayDate)}
            isSelected={isSelected(dayDate)}
            tabindex={getCellTabIndex(rowIndex, colIndex)}
            onDayClick={handleDayClick}
            {onTaskClick}
          />
        {/each}
      </div>
    {/each}
  </div>

  <!-- Selected day details -->
  {#if selectedDate}
    <div class="selected-day-details">
      <h3>
        {selectedDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </h3>
      <p class="task-count-text">
        {getTasksForDate(selectedDate).length} task{getTasksForDate(selectedDate).length === 1 ? "" : "s"}
      </p>
      <button class="close-btn" on:click={() => (selectedDate = null)}>✕</button>
    </div>
  {/if}
</div>

<style>
  .calendar-view {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    background: #FFFFFF;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .month-display {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1F2937;
    margin: 0;
  }

  .calendar-controls {
    display: flex;
    gap: 0.5rem;
  }

  .control-btn {
    padding: 0.5rem 1rem;
    background: #F3F4F6;
    border: 1px solid #D1D5DB;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .control-btn:hover {
    background: #E5E7EB;
    border-color: #9CA3AF;
  }

  .control-btn:focus {
    outline: 2px solid var(--interactive-accent, #3B82F6);
    outline-offset: 2px;
  }

  .today-btn {
    background: var(--interactive-accent, #3B82F6);
    color: #FFFFFF;
    border-color: var(--interactive-accent, #3B82F6);
  }

  .today-btn:hover {
    background: #2563EB;
    border-color: #2563EB;
  }

  .calendar-stats {
    display: flex;
    gap: 1.5rem;
    padding: 0.75rem 1rem;
    background: #F9FAFB;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .stat {
    display: flex;
    gap: 0.5rem;
  }

  .stat-label {
    color: #6B7280;
  }

  .stat-value {
    font-weight: 600;
    color: #1F2937;
  }

  .calendar-grid {
    flex: 1;
    display: flex;
    flex-direction: column;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    overflow: hidden;
  }

  .week-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: #F3F4F6;
    border-bottom: 1px solid #E5E7EB;
  }

  .week-day-label {
    padding: 0.75rem;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6B7280;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .calendar-week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    flex: 1;
  }

  .calendar-week:not(:last-child) {
    border-bottom: 1px solid #E5E7EB;
  }

  .calendar-week > :global(*:not(:last-child)) {
    border-right: 1px solid #E5E7EB;
  }

  .selected-day-details {
    position: relative;
    padding: 1rem;
    background: #EFF6FF;
    border: 2px solid #3B82F6;
    border-radius: 8px;
  }

  .selected-day-details h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1E40AF;
  }

  .task-count-text {
    margin: 0;
    font-size: 0.875rem;
    color: #1F2937;
  }

  .close-btn {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: none;
    font-size: 1.25rem;
    color: #6B7280;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .close-btn:hover {
    color: #374151;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .calendar-header {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .calendar-controls {
      justify-content: center;
    }
  }

  @media (max-width: 768px) {
    .calendar-view {
      padding: 1rem;
    }

    .month-display {
      font-size: 1.25rem;
    }

    .calendar-stats {
      flex-direction: column;
      gap: 0.5rem;
    }

    .week-day-label {
      font-size: 0.625rem;
      padding: 0.5rem;
    }
  }
</style>
