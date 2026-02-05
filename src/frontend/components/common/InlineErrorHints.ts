/**
 * Inline error hints component for displaying validation errors
 */

export interface ErrorHint {
  message: string;
  type: 'error' | 'warning' | 'info';
  field?: string;
}

/**
 * Display inline error hints for task creation/editing
 */
export function showInlineError(hint: ErrorHint): void {
  // Simple console-based error display for now  
  // Can be enhanced with UI tooltips/notifications
  if (!hint || !hint.type) {
    console.error('[ERROR] Invalid error hint:', hint);
    return;
  }
  console.error(`[${hint.type.toUpperCase()}] ${hint.field ? `${hint.field}: ` : ''}${hint.message}`);
}

/**
 * Clear inline error hints
 */
export function clearInlineErrors(): void {
  // Placeholder for clearing UI error indicators
}

/**
 * Validate task input and show inline errors
 */
export function validateTaskInput(input: string): ErrorHint[] {
  const errors: ErrorHint[] = [];
  
  if (!input.trim()) {
    errors.push({
      message: 'Task description cannot be empty',
      type: 'error',
      field: 'description',
    });
  }
  
  // Check for invalid date formats
  const datePattern = /📅\s*([^\s]+)/;
  const dateMatch = input.match(datePattern);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    // Basic validation - can be enhanced
    if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/) && !['today', 'tomorrow'].includes(dateStr.toLowerCase())) {
      errors.push({
        message: `Invalid date format: ${dateStr}`,
        type: 'warning',
        field: 'date',
      });
    }
  }
  
  return errors;
}

/**
 * Show parse error hint (alias for showInlineError)
 */
export function showParseErrorHint(hint: ErrorHint): void {
  showInlineError(hint);
}

export const InlineErrorHints = {
  show: showInlineError,
  clear: clearInlineErrors,
  validate: validateTaskInput,
};
