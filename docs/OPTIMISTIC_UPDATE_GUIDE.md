# Optimistic UI Update System - Integration Guide

## Overview

The optimistic update system provides instant user feedback while async operations complete in the background. If the operation fails, UI automatically rolls back to the previous state with error indication.

## Architecture

```
┌─────────────────────┐
│ User Action         │
│ (checkbox click)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Apply Optimistic    │
│ Update to UI        │ ← INSTANT
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Execute Async       │
│ Backend Operation   │ ← BACKGROUND
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
SUCCESS      FAILURE
    │           │
    ▼           ▼
 Commit      Rollback + Error
```

## Core Components

### 1. OptimisticUpdateManager

**Location**: [src/core/ui/OptimisticUpdateManager.ts](../src/core/ui/OptimisticUpdateManager.ts)

**Purpose**: Generic manager for all optimistic updates with retry logic and rollback.

**Key Methods**:
```typescript
executeOptimistically<T>(
  updateId: string,
  optimisticFn: () => void,
  actualFn: () => Promise<T>,
  rollbackFn: () => void,
  options?: {
    timeout?: number;     // Default: 30000ms
    retryCount?: number;  // Default: 0 (no retry)
    retryDelay?: number;  // Default: 1000ms
    showError?: boolean;  // Default: true
    errorMessage?: string;
  }
): Promise<T>
```

**Example Usage**:
```typescript
const manager = OptimisticUpdateManager.getInstance();

await manager.executeOptimistically(
  'task-123-toggle',
  
  // Optimistic: Update UI immediately
  () => {
    taskCheckbox.checked = true;
    taskElement.classList.add('task-item--updating');
  },
  
  // Actual: Persist to backend
  async () => {
    const result = await taskManager.updateTask({ ...task, status: 'done' });
    return result;
  },
  
  // Rollback: Restore on failure
  () => {
    taskCheckbox.checked = false;
    taskElement.classList.remove('task-item--updating');
    taskElement.classList.add('task-item--failed');
  },
  
  {
    timeout: 15000,
    retryCount: 2,
    showError: true,
    errorMessage: 'Failed to update task status'
  }
);

// Success: Checkbox stays checked
// Failure: Checkbox unchecks, element gets red border (via task-item--failed class)
```

### 2. TaskUIStateManager

**Location**: [src/core/ui/TaskUIState.ts](../src/core/ui/TaskUIState.ts)

**Purpose**: Task-specific UI state management with reactive updates.

**Key Methods**:
```typescript
updateOptimistically(
  taskId: string,
  currentTask: Task,
  optimisticUpdate: (task: Task) => Task,
  persistFn: (task: Task) => Promise<Task>
): Promise<Task>
```

**Example Usage**:
```typescript
const uiManager = TaskUIStateManager.getInstance();

// Toggle task status with optimistic update
await uiManager.updateOptimistically(
  task.id,
  task,
  
  // Create optimistic version
  (t) => ({ ...t, status: 'done' }),
  
  // Persist to backend
  async (updatedTask) => {
    return await taskManager.repository.saveTask(updatedTask);
  }
);

// Subscribe to state changes for reactive UI
const unsubscribe = uiManager.subscribe(task.id, (state) => {
  if (state.isUpdating) {
    element.classList.add('task-item--updating');
  } else {
    element.classList.remove('task-item--updating');
  }
  
  if (state.hasFailed) {
    element.classList.add('task-item--failed');
    showError(state.errorMessage);
  }
});

// Cleanup
unsubscribe();
```

## Integration Examples

### Example 1: Checkbox Toggle (index.ts)

**Current Implementation**:
```typescript
checkbox?.addEventListener("change", async (e) => {
  const target = e.target as HTMLInputElement;
  const newStatus = target.checked ? "done" : "todo";
  const originalChecked = !target.checked;
  
  try {
    await this.uiStateManager.updateOptimistically(
      task.id,
      task,
      (t) => ({ ...t, status: newStatus } as Task),
      async (updatedTask) => {
        const result = await this.taskManager?.getRepository()?.saveTask(updatedTask);
        if (!result) throw new Error('Failed to save task');
        return result;
      }
    );
    
    // Refresh list on success
    this.refreshTaskList();
  } catch (error) {
    // Rollback checkbox state
    target.checked = originalChecked;
    logger.error('Failed to toggle task status', error);
  }
});
```

### Example 2: Modal Save with Visual Feedback

```typescript
// In EditTaskUnified onSubmit
async function handleSave(updatedTask: Task) {
  const saveButton = modalEl.querySelector('.save-button');
  saveButton.classList.add('b3-button--loading');
  
  try {
    await uiStateManager.updateOptimistically(
      task.id,
      task,
      () => updatedTask,
      async (t) => {
        const result = await taskManager.repository.saveTask(t);
        if (!result) throw new Error('Save failed');
        return result;
      }
    );
    
    // Success feedback
    saveButton.classList.remove('b3-button--loading');
    modal.close();
    showMessage('Task saved successfully', 3000);
    
  } catch (error) {
    // Error handling
    saveButton.classList.remove('b3-button--loading');
    showMessage('Failed to save task', 5000, 'error');
  }
}
```

### Example 3: Calendar Cell Click

```typescript
calendarCell.addEventListener('click', async () => {
  const cellTaskEl = calendarCell.querySelector('.calendar-task');
  cellTaskEl.classList.add('calendar-task--updating');
  
  try {
    await uiStateManager.updateOptimistically(
      task.id,
      task,
      (t) => ({ ...t, dueAt: selectedDate }),
      async (updatedTask) => {
        return await taskManager.repository.saveTask(updatedTask);
      }
    );
    
    cellTaskEl.classList.remove('calendar-task--updating');
    refreshCalendar();
    
  } catch (error) {
    cellTaskEl.classList.remove('calendar-task--updating');
    cellTaskEl.classList.add('calendar-task--failed');
  }
});
```

## CSS Classes for Visual States

**Location**: [src/styles/optimistic-ui.scss](../src/styles/optimistic-ui.scss)

### Available Classes:

#### Task Items
- `.task-item--updating`: Faded with spinner (opacity: 0.7, spinner animation)
- `.task-item--failed`: Red left border + shake animation
- `.task-item--optimistic`: Blue left border, checkbox at 60% opacity
- `.task-item--success`: Green flash animation

#### Calendar Cells
- `.calendar-task--updating`: Cursor wait, opacity 50%
- `.calendar-task--failed`: Strikethrough, red color

#### AI Suggestions
- `.ai-suggestion--applying`: Disabled with spinner on Apply button
- `.ai-suggestion--applied`: Success flash animation

#### Buttons
- `.b3-button--loading`: Spinner on right side, disabled pointer events

### Example Custom Styling:

```scss
// Your component styles
.my-task-card {
  transition: all 0.2s ease;
  
  &.task-item--updating {
    // Override default updating styles
    background-color: rgba(var(--b3-theme-primary-rgb), 0.05);
  }
  
  &.task-item--failed {
    // Custom error indication
    box-shadow: 0 0 0 2px var(--b3-theme-error);
  }
}
```

## Error Handling Best Practices

### 1. Always Provide Rollback

```typescript
// ✅ GOOD: Specific rollback logic
rollbackFn: () => {
  taskElement.querySelector('input').checked = originalState;
  taskElement.classList.remove('task-item--updating');
  taskElement.classList.add('task-item--failed');
}

// ❌ BAD: Empty rollback
rollbackFn: () => {}
```

### 2. User-Friendly Error Messages

```typescript
{
  errorMessage: 'Failed to update task status', // ✅ Clear
  // vs
  errorMessage: 'Error', // ❌ Vague
}
```

### 3. Cleanup After Errors

```typescript
try {
  await optimisticUpdate(...);
} catch (error) {
  // Show error UI
  showErrorMessage(error);
  
  // Automatically clear error state after 5 seconds
  setTimeout(() => {
    element.classList.remove('task-item--failed');
  }, 5000);
}
```

## Advanced Patterns

### Pattern 1: Retry with Exponential Backoff

```typescript
await manager.executeOptimistically(
  'task-update',
  optimisticFn,
  actualFn,
  rollbackFn,
  {
    retryCount: 3,
    retryDelay: 1000, // First retry: 1s, 2nd: 2s, 3rd: 4s
  }
);
```

### Pattern 2: Batch Operations

```typescript
const batchManager = OptimisticUpdateManager.getInstance();

// Update UI for all tasks immediately
tasks.forEach(task => {
  const el = getTaskElement(task.id);
  el.classList.add('task-item--updating');
});

// Execute batch operation
try {
  await batchManager.executeOptimistically(
    'batch-complete-tasks',
    () => {}, // Already updated above
    async () => await taskManager.bulkUpdate(tasks, { status: 'done' }),
    () => {
      // Rollback all
      tasks.forEach(task => {
        const el = getTaskElement(task.id);
        el.classList.remove('task-item--updating');
        el.classList.add('task-item--failed');
      });
    }
  );
  
  // Success
  tasks.forEach(task => {
    const el = getTaskElement(task.id);
    el.classList.remove('task-item--updating');
  });
  
} catch (error) {
  showMessage('Batch operation failed', 5000, 'error');
}
```

### Pattern 3: Conditional Optimistic Updates

```typescript
async function updateTask(task: Task, changes: Partial<Task>) {
  const isOnline = navigator.onLine;
  
  if (!isOnline) {
    // Queue for later (offline mode)
    await queueOfflineUpdate(task.id, changes);
    showMessage('Saved offline - will sync when online', 3000);
    return;
  }
  
  // Online: Use optimistic update
  await uiStateManager.updateOptimistically(
    task.id,
    task,
    (t) => ({ ...t, ...changes }),
    async (updated) => await persist(updated)
  );
}
```

## Testing

### Unit Test Example:

```typescript
import { OptimisticUpdateManager } from '@backend/core/ui/OptimisticUpdateManager';

describe('OptimisticUpdateManager', () => {
  it('should rollback on failure', async () => {
    const manager = OptimisticUpdateManager.getInstance();
    let uiState = 'initial';
    
    try {
      await manager.executeOptimistically(
        'test-update',
        () => { uiState = 'optimistic'; },
        async () => { throw new Error('Failed'); },
        () => { uiState = 'rollback'; },
        { showError: false }
      );
    } catch (error) {
      // Expected
    }
    
    expect(uiState).toBe('rollback');
  });
});
```

## Performance Considerations

1. **Debounce rapid updates**: Use debouncing for text inputs
2. **Limit concurrent updates**: OptimisticUpdateManager tracks active updates via `getActiveUpdates()`
3. **Clean up subscriptions**: Always call unsubscribe() when components unmount
4. **Batch UI updates**: Use `requestAnimationFrame` for multiple DOM changes

## Troubleshooting

### Issue: Updates not rolling back

**Solution**: Ensure rollback function is actually reverting state:
```typescript
// Check rollback is being called
rollbackFn: () => {
  console.log('Rolling back task', taskId);
  // ... actual rollback code
}
```

### Issue: Stale UI state

**Solution**: Use fresh state from manager:
```typescript
const currentState = uiStateManager.getState(task.id);
if (currentState?.isUpdating) {
  // Don't allow new update while one is pending
  return;
}
```

### Issue: Memory leaks from subscriptions

**Solution**: Always clean up:
```typescript
let unsubscribe: (() => void) | null = null;

onMount(() => {
  unsubscribe = uiStateManager.subscribe(task.id, handleStateChange);
});

onDestroy(() => {
  unsubscribe?.();
});
```

## Migration Checklist

- [ ] Import OptimisticUpdateManager and TaskUIStateManager
- [ ] Replace direct state mutations with optimistic updates
- [ ] Add CSS classes for loading/error states
- [ ] Implement rollback functions for all operations
- [ ] Test error scenarios (network failures, invalid data)
- [ ] Add user feedback (spinners, error messages)
- [ ] Set up subscription cleanup in component lifecycle
- [ ] Update documentation for new UI behavior

## Additional Resources

- [OptimisticUpdateManager.ts](../src/core/ui/OptimisticUpdateManager.ts) - Full API reference
- [TaskUIState.ts](../src/core/ui/TaskUIState.ts) - Task-specific state management
- [optimistic-ui.scss](../src/styles/optimistic-ui.scss) - Visual feedback styles
- [index.ts](../src/index.ts) - Live integration examples
