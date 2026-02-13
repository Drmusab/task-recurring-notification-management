/**
 * @fileoverview Accessibility utility functions for WCAG 2.1 AA compliance
 * 
 * @reference WCAG 2.1 Guidelines - https://www.w3.org/WAI/WCAG21/quickref/
 * @constraint UX - WCAG 2.1 AA compliance required
 * 
 * @module accessibility
 * @version 1.0.0
 * @since February 13, 2026
 */

import type { Task, TaskPriority, TaskStatus } from '@/domain/models/Task';

/**
 * Generate accessible label for task items
 * 
 * @description Creates comprehensive screen reader text for tasks
 * @param task - Task object
 * @returns Accessible label string
 * 
 * @example
 * ```typescript
 * const label = getTaskAriaLabel(task);
 * // "Incomplete task: Buy groceries. High priority. Due tomorrow. Recurring weekly."
 * ```
 */
export function getTaskAriaLabel(task: Task): string {
  const parts: string[] = [];
  
  // Status
  const statusText = getStatusText(task.status);
  parts.push(`${statusText} task:`);
  
  // Name
  parts.push(task.name);
  
  // Priority
  if (task.priority && task.priority !== 'none') {
    parts.push(`${getPriorityText(task.priority)} priority`);
  }
  
  // Due date
  if (task.dueAt) {
    const dueText = formatDateForScreenReader(task.dueAt);
    const isOverdue = new Date(task.dueAt) < new Date() && task.status !== 'done';
    if (isOverdue) {
      parts.push(`Overdue: was due ${dueText}`);
    } else {
      parts.push(`Due ${dueText}`);
    }
  }
  
  // Scheduled date
  if (task.scheduledAt && task.scheduledAt !== task.dueAt) {
    parts.push(`Scheduled ${formatDateForScreenReader(task.scheduledAt)}`);
  }
  
  // Recurrence
  if (task.recurrence || task.frequency) {
    const recText = task.recurrenceText || task.frequency || 'recurring';
    parts.push(`Recurring ${recText}`);
  }
  
  // Tags
  if (task.tags && task.tags.length > 0) {
    parts.push(`Tagged: ${task.tags.join(', ')}`);
  }
  
  return parts.join('. ');
}

/**
 * Get human-readable status text
 */
export function getStatusText(status: TaskStatus): string {
  switch (status) {
    case 'done':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'todo':
      return 'Incomplete';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Get human-readable priority text
 */
export function getPriorityText(priority: TaskPriority): string {
  switch (priority) {
    case 'highest':
      return 'Highest';
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    case 'lowest':
      return 'Lowest';
    case 'none':
      return 'No';
    default:
      return priority;
  }
}

/**
 * Format date for screen readers in natural language
 * 
 * @param dateStr - ISO date string
 * @returns Human-readable date text
 * 
 * @example
 * ```typescript
 * formatDateForScreenReader('2024-02-14T00:00:00Z');
 * // "tomorrow" or "February 14, 2024"
 * ```
 */
export function formatDateForScreenReader(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (dateOnly.getTime() === today.getTime()) {
    return 'today';
  } else if (dateOnly.getTime() === tomorrow.getTime()) {
    return 'tomorrow';
  } else if (dateOnly.getTime() === yesterday.getTime()) {
    return 'yesterday';
  }
  
  // Format as "February 14, 2024"
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Generate aria-label for task count announcements
 * 
 * @param count - Number of tasks
 * @param filter - Optional filter description
 * @returns Accessible count text
 */
export function getTaskCountLabel(count: number, filter?: string): string {
  const taskText = count === 1 ? 'task' : 'tasks';
  const filterText = filter ? ` matching ${filter}` : '';
  return `${count} ${taskText}${filterText}`;
}

/**
 * Generate aria-live announcement for task actions
 * 
 * @param action - Action performed
 * @param task - Affected task
 * @returns Announcement text
 */
export function getTaskActionAnnouncement(
  action: 'created' | 'updated' | 'deleted' | 'completed' | 'snoozed',
  task: Task
): string {
  switch (action) {
    case 'created':
      return `Task created: ${task.name}`;
    case 'updated':
      return `Task updated: ${task.name}`;
    case 'deleted':
      return `Task deleted: ${task.name}`;
    case 'completed':
      return `Task completed: ${task.name}`;
    case 'snoozed':
      return `Task snoozed: ${task.name}`;
    default:
      return `Task ${action}: ${task.name}`;
  }
}

/**
 * Get keyboard shortcut description for ARIA
 * 
 * @param key - Keyboard shortcut (e.g., "Ctrl+Shift+N")
 * @returns Descriptive text for screen readers
 */
export function getShortcutAriaLabel(key: string): string {
  return key
    .replace('Ctrl', 'Control')
    .replace('Cmd', 'Command')
    .replace('Shift', 'Shift')
    .replace('Alt', 'Alt')
    .replace('+', ' plus ');
}

/**
 * Check if element is keyboard focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  const focusableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  
  if (focusableTags.includes(element.tagName)) {
    return !element.hasAttribute('disabled');
  }
  
  return (
    element.hasAttribute('tabindex') &&
    element.getAttribute('tabindex') !== '-1'
  );
}

/**
 * Trap focus within a modal or dialog
 * 
 * @param containerElement - Container to trap focus within
 * @returns Cleanup function
 * 
 * @example
 * ```typescript
 * const cleanup = trapFocus(dialogElement);
 * // Later:
 * cleanup();
 * ```
 */
export function trapFocus(containerElement: HTMLElement): () => void {
  const focusableElements = Array.from(
    containerElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  );
  
  if (focusableElements.length === 0) return () => {};
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    
    if (event.shiftKey) {
      // Shift+Tab: focus last element when on first
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: focus first element when on last
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };
  
  containerElement.addEventListener('keydown', handleKeyDown);
  
  // Focus first element
  firstElement.focus();
  
  // Return cleanup function
  return () => {
    containerElement.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Announce message to screen readers via aria-live
 * 
 * @param message - Message to announce
 * @param priority - 'polite' (default) or 'assertive'
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  // Find or create live region
  let liveRegion = document.querySelector<HTMLElement>(`[data-live-region="${priority}"]`);
  
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('data-live-region', priority);
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
  }
  
  // Clear and set new message (triggers announcement)
  liveRegion.textContent = '';
  setTimeout(() => {
    liveRegion!.textContent = message;
  }, 100);
}

/**
 * Generate unique ID for aria-describedby/aria-labelledby
 * 
 * @param prefix - ID prefix
 * @returns Unique ID string
 */
export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}
