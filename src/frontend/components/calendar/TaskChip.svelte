<script lang="ts">
/**
 * TaskChip - Compact task display for calendar views
 * 
 * Displays a condensed task card showing:
 * - Priority indicator (color dot)
 * - Task name (truncated if long)
 * - Status symbol
 * - Click handler for task details
 * 
 * Phase 3: Calendar View Component
 */

import type { Task } from "@backend/core/models/Task";

// Priority weights for sorting (higher = higher priority)
const PRIORITY_WEIGHTS: Record<string, number> = {
  highest: 5,
  high: 4,
  normal: 3,
  medium: 2,
  low: 1,
  lowest: 0,
};

export let task: Task;
export let onClick: ((task: Task) => void) | undefined = undefined;

// Priority color mapping
const priorityColors: Record<string, string> = {
  highest: "#EF4444", // Red
  high: "#F59E0B", // Amber
  normal: "#3B82F6", // Blue
  medium: "#3B82F6", // Blue
  low: "#10B981", // Green
  lowest: "#6B7280", // Gray
  "": "#9CA3AF", // Light gray (for undefined)
};

// Status symbol display
const statusSymbols: Record<string, string> = {
  todo: "◻️",
  done: "✅",
  cancelled: "❌",
};

// Get priority color
function getPriorityColor(task: Task): string {
  return priorityColors[task.priority ?? ""] ?? "#9CA3AF";
}

// Get status symbol
function getStatusSymbol(task: Task): string {
  if (task.statusSymbol) {
    return task.statusSymbol;
  }
  const status = task.status ?? "todo";
  return statusSymbols[status] ?? "◻️";
}

// Truncate long task names
function truncateName(name: string, maxLength: number = 25): string {
  if (name.length <= maxLength) {
    return name;
  }
  return name.substring(0, maxLength - 3) + "...";
}

// Handle click
function handleClick() {
  if (onClick) {
    onClick(task);
  }
}

// Get urgency class (for styling)
function getUrgencyClass(task: Task): string {
  const now = new Date();
  const dueDate = task.dueAt ? new Date(task.dueAt) : null;

  if (!dueDate) return "";

  const daysUntilDue = Math.floor(
    (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "due-today";
  if (daysUntilDue <= 3) return "due-soon";
  return "";
}
</script>

<button
  class="task-chip"
  class:clickable={!!onClick}
  class:done={task.status === "done"}
  class:cancelled={task.status === "cancelled"}
  class:overdue={getUrgencyClass(task) === "overdue"}
  class:due-today={getUrgencyClass(task) === "due-today"}
  class:due-soon={getUrgencyClass(task) === "due-soon"}
  on:click={handleClick}
  disabled={!onClick}
  title={task.name}
>
  <!-- Priority indicator dot -->
  <div
    class="priority-dot"
    style="background-color: {getPriorityColor(task)};"
  ></div>

  <!-- Status symbol -->
  <span class="status-symbol">{getStatusSymbol(task)}</span>

  <!-- Task name -->
  <span class="task-name">{truncateName(task.name)}</span>

  <!-- Recurrence indicator -->
  {#if task.recurrence}
    <span class="recurrence-icon" title="Recurring task">🔄</span>
  {/if}
</button>

<style>
  .task-chip {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    border-radius: 4px;
    font-size: 0.75rem;
    line-height: 1.2;
    cursor: default;
    transition: all 0.15s ease;
    margin-bottom: 0.25rem;
    width: 100%;
    text-align: left;
    font-family: inherit;
  }

  .task-chip.clickable {
    cursor: pointer;
  }

  .task-chip.clickable:hover {
    background: #F9FAFB;
    border-color: #D1D5DB;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .task-chip.done {
    opacity: 0.6;
    text-decoration: line-through;
  }

  .task-chip.cancelled {
    opacity: 0.5;
    text-decoration: line-through;
    color: #6B7280;
  }

  .task-chip.overdue {
    border-color: #FCA5A5;
    background: #FEF2F2;
  }

  .task-chip.due-today {
    border-color: #FCD34D;
    background: #FFFBEB;
  }

  .task-chip.due-soon {
    border-color: #93C5FD;
    background: #EFF6FF;
  }

  .priority-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-symbol {
    font-size: 0.625rem;
    flex-shrink: 0;
  }

  .task-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recurrence-icon {
    font-size: 0.625rem;
    flex-shrink: 0;
  }

  /* Focus styles for accessibility */
  .task-chip:focus {
    outline: 2px solid var(--interactive-accent, #3B82F6);
    outline-offset: 2px;
  }
</style>
