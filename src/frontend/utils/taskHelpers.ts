/**
 * Task Helper Utilities
 * 
 * Centralized task-related helper functions for priority, status, and other task properties.
 * Replaces duplicate helper implementations across components.
 * 
 * @module taskHelpers
 */

import type { TaskPriority } from '@backend/core/models/Task';

export type { TaskPriority };
export type TaskStatus = 'todo' | 'in-progress' | 'waiting' | 'done' | 'cancelled' | null;

/**
 * Priority color mapping
 * Maps TaskPriority values to their corresponding colors
 */
const PRIORITY_COLORS: Record<string, string> = {
  highest: '#EF4444',  // Red
  high: '#F59E0B',     // Amber
  normal: '#3B82F6',   // Blue
  medium: '#3B82F6',   // Blue
  low: '#10B981',      // Green
  lowest: '#6B7280'    // Gray
};

/**
 * Priority label mapping
 */
const PRIORITY_LABELS: Record<string, string> = {
  highest: 'Highest',
  high: 'High',
  normal: 'Normal',
  medium: 'Medium',
  low: 'Low',
  lowest: 'Lowest'
};

/**
 * Status color mapping
 */
const STATUS_COLORS: Record<string, string> = {
  todo: '#888888',
  'in-progress': '#4488ff',
  waiting: '#ffaa44',
  done: '#44ff88',
  cancelled: '#ff4444'
};

/**
 * Status label mapping
 */
const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  waiting: 'Waiting',
  done: 'Done',
  cancelled: 'Cancelled'
};

const DEFAULT_PRIORITY_COLOR = '#3B82F6';  // Blue (normal priority)
const DEFAULT_PRIORITY_LABEL = 'Normal';
const DEFAULT_STATUS_COLOR = '#888888';
const DEFAULT_STATUS_LABEL = 'To Do';

/**
 * Get color for a task priority
 */
export function getPriorityColor(priority: TaskPriority | null | undefined): string {
  if (!priority) return DEFAULT_PRIORITY_COLOR;
  return PRIORITY_COLORS[priority] ?? DEFAULT_PRIORITY_COLOR;
}

/**
 * Get label for a task priority
 */
export function getPriorityLabel(priority: TaskPriority | null | undefined): string {
  if (!priority) return DEFAULT_PRIORITY_LABEL;
  return PRIORITY_LABELS[priority] ?? DEFAULT_PRIORITY_LABEL;
}

/**
 * Get color for a task status
 */
export function getStatusColor(status: TaskStatus | null | undefined): string {
  if (!status) return STATUS_COLORS.todo ?? DEFAULT_STATUS_COLOR;
  return STATUS_COLORS[status] ?? DEFAULT_STATUS_COLOR;
}

/**
 * Get label for a task status
 */
export function getStatusLabel(status: TaskStatus | null | undefined): string {
  if (!status) return STATUS_LABELS.todo ?? DEFAULT_STATUS_LABEL;
  return STATUS_LABELS[status] ?? DEFAULT_STATUS_LABEL;
}

/**
 * Get icon name for a task priority
 */
export function getPriorityIcon(priority: TaskPriority | null | undefined): string {
  const icons: Record<string, string> = {
    highest: 'alert-circle',
    high: 'chevron-up',
    normal: 'minus',
    medium: 'minus',
    low: 'chevron-down',
    lowest: 'chevron-down'
  };
  if (!priority) return 'minus';
  return icons[priority] ?? 'minus';
}

/**
 * Get icon name for a task status
 */
export function getStatusIcon(status: TaskStatus | null | undefined): string {
  const icons: Record<string, string> = {
    todo: 'circle',
    'in-progress': 'loader',
    waiting: 'clock',
    done: 'check-circle',
    cancelled: 'x-circle'
  };
  if (!status) return icons.todo ?? 'circle';
  return icons[status] ?? 'circle';
}

/**
 * Check if a task is completed
 */
export function isTaskCompleted(status: TaskStatus | null | undefined): boolean {
  return status === 'done';
}

/**
 * Check if a task is cancelled
 */
export function isTaskCancelled(status: TaskStatus | null | undefined): boolean {
  return status === 'cancelled';
}

/**
 * Check if a task is active (not done or cancelled)
 */
export function isTaskActive(status: TaskStatus | null | undefined): boolean {
  return status !== 'done' && status !== 'cancelled';
}

/**
 * Get priority level as number (higher = more important)
 */
export function getPriorityLevel(priority: TaskPriority | null | undefined): number {
  const levels: Record<string, number> = {
    highest: 5,
    high: 4,
    normal: 3,
    medium: 3,
    low: 2,
    lowest: 1
  };
  if (!priority) return 3; // Default to normal
  return levels[priority] ?? 3;
}

/**
 * Compare two priorities (for sorting)
 * Returns: negative if p1 < p2, positive if p1 > p2, 0 if equal
 */
export function comparePriorities(p1: TaskPriority | null | undefined, p2: TaskPriority | null | undefined): number {
  return getPriorityLevel(p2) - getPriorityLevel(p1); // Higher priority first
}

/**
 * Get CSS class name for priority
 */
export function getPriorityClassName(priority: TaskPriority | null | undefined): string {
  if (!priority) return 'priority-normal';
  return `priority-${priority}`;
}

/**
 * Get CSS class name for status
 */
export function getStatusClassName(status: TaskStatus): string {
  if (!status) return 'status-todo';
  return `status-${status}`;
}

/**
 * Format task title with truncation
 */
export function formatTaskTitle(title: string, maxLength: number = 50): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}

/**
 * Get urgency level based on due date and priority
 */
export function getTaskUrgency(dueDate: Date | string | null, priority: TaskPriority | null | undefined): 'urgent' | 'high' | 'medium' | 'low' {
  if (!dueDate) {
    // No due date, use priority
    if (priority === 'highest') return 'urgent';
    if (priority === 'high') return 'high';
    if (priority === 'medium' || priority === 'normal') return 'medium';
    return 'low';
  }

  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return 'urgent'; // Overdue
  if (daysUntilDue <= 1) return 'urgent'; // Due today or tomorrow
  if (daysUntilDue <= 3) return 'high'; // Due in 2-3 days
  if (daysUntilDue <= 7) return 'medium'; // Due this week

  // Factor in priority for tasks due > 7 days
  if (priority === 'highest') return 'high';
  if (priority === 'high') return 'medium';
  return 'low';
}

/**
 * Get urgency color
 */
export function getUrgencyColor(urgency: 'urgent' | 'high' | 'medium' | 'low'): string {
  const colors: Record<string, string> = {
    urgent: '#ff4444',
    high: '#ff9944',
    medium: '#ffcc44',
    low: '#44ff88'
  };
  return colors[urgency] ?? '#44ff88';
}
