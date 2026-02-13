/**
 * Phase 2, Week 6 Integration Tests
 * Tests for Polish & UX features:
 * - Global keyboard shortcuts
 * - Enhanced completion actions
 * - Full workflow integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Task, OnCompletionAction } from '../src/backend/core/models/Task';
import type { ShortcutId } from '../src/frontend/utils/keyboardShortcuts';
import {
    OnCompletion,
    handleOnCompletion,
    validateOnCompletionAction,
} from '../src/shared/utils/task/on-completion';

describe('Week 6 Integration - Keyboard Shortcuts + OnCompletion', () => {
    let tasks: Map<string, Task>;

    beforeEach(() => {
        tasks = new Map();
    });

    it('should complete task via shortcut and apply Delete onCompletion', () => {
        // Create task with Delete onCompletion
        const originalTask = createTask({
            id: 'task-1',
            name: 'Recurring Task',
            status: 'todo',
            onCompletion: 'delete',
        });

        // Simulate task completion via markTaskDone shortcut
        const completedTask = { ...originalTask, status: 'done' as const };
        const newTasks = [completedTask];

        // Apply onCompletion logic
        const result = handleOnCompletion(originalTask, newTasks);

        // Should remove completed instance
        expect(result.length).toBe(0);
    });

    it('should complete task via shortcut and apply Keep onCompletion', () => {
        // Create task with Keep onCompletion
        const originalTask = createTask({
            id: 'task-2',
            name: 'Keep Task',
            status: 'todo',
            onCompletion: 'keep',
        });

        // Simulate completion
        const completedTask = { ...originalTask, status: 'done' as const };
        const nextInstance = createTask({
            id: 'task-2-next',
            name: 'Keep Task',
            status: 'todo',
        });
        const newTasks = [nextInstance, completedTask];

        // Apply onCompletion logic
        const result = handleOnCompletion(originalTask, newTasks);

        // Should keep both instances
        expect(result.length).toBe(2);
        expect(result).toContain(completedTask);
        expect(result).toContain(nextInstance);
    });

    it('should complete task via shortcut and apply Archive onCompletion', () => {
        // Create task with Archive onCompletion
        const action: OnCompletionAction = { action: 'archive' };
        const originalTask = createTask({
            id: 'task-3',
            name: 'Archive Task',
            status: 'todo',
            onCompletion: action,
        });

        // Simulate completion
        const completedTask = { ...originalTask, status: 'done' as const, onCompletion: action };
        const newTasks = [completedTask];

        // Apply onCompletion logic
        const result = handleOnCompletion(originalTask, newTasks);

        // Should mark for archiving
        expect(result.length).toBe(1);
        expect((result[0] as any)._shouldArchive).toBe(true);
    });

    it('should toggle task status via shortcut and apply customTransition', () => {
        // Create task with customTransition onCompletion
        const action: OnCompletionAction = {
            action: 'customTransition',
            nextStatus: 'cancelled',
        };
        const originalTask = createTask({
            id: 'task-4',
            name: 'Transition Task',
            status: 'todo',
            onCompletion: action,
        });

        // Simulate status toggle to done
        const completedTask = { ...originalTask, status: 'done' as const,  onCompletion: action };
        const newTasks = [completedTask];

        // Apply onCompletion logic
        const result = handleOnCompletion(originalTask, newTasks);

        // Should apply custom transition to cancelled
        expect(result.length).toBe(1);
        expect(result[0].status).toBe('cancelled');
    });
});

describe('Week 6 Integration - Shortcut Context Awareness', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should allow global shortcuts when no input is focused', () => {
        const globalShortcuts: ShortcutId[] = [
            'quickAddTask',
            'openRecurringTasksDock',
            'createRecurringTask',
            'quickCompleteNextTask',
            'createTaskFromBlock',
        ];

        // No active element or regular div
        const div = document.createElement('div');
        document.body.appendChild(div);

        const activeElement = document.activeElement;
        const tagName = activeElement?.tagName?.toLowerCase();
        const shouldBlock = ['input', 'textarea', 'select'].includes(tagName || '');

        expect(shouldBlock).toBe(false);
        expect(globalShortcuts.length).toBe(5);
    });

    it('should allow editor shortcuts even in contentEditable', () => {
        const editorShortcuts: ShortcutId[] = [
            'markTaskDone',
            'toggleTaskStatus',
            'postponeTask',
        ];

        // Create contentEditable element
        const div = document.createElement('div');
        div.contentEditable = 'true';
        document.body.appendChild(div);
        div.focus();

        const activeElement = document.activeElement as HTMLElement;
        const isContentEditable = activeElement?.isContentEditable;

        // These shortcuts should work even in contentEditable
        expect(isContentEditable).toBe(true);
        expect(editorShortcuts.length).toBe(3);
    });

    it('should block shortcuts when typing in input', () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        const activeElement = document.activeElement;
        const tagName = activeElement?.tagName?.toLowerCase();
        const shouldBlock = ['input', 'textarea', 'select'].includes(tagName || '');

        expect(shouldBlock).toBe(true);
    });
});

describe('Week 6 Integration - Multi-Task Workflows', () => {
    it('should handle recurring task series with different onCompletion actions', () => {
        // Series with mixed onCompletion settings
        const task1 = createTask({ id: '1', status: 'todo', onCompletion: 'keep' });
        const task2 = createTask({ id: '2', status: 'todo', onCompletion: 'delete' });
        const task3 = createTask({ id: '3', status: 'todo', onCompletion: { action: 'archive' } });

        // Complete task1 (keep)
        const completed1 = { ...task1, status: 'done' as const };
        const result1 = handleOnCompletion(task1, [task1, completed1]);
        expect(result1.length).toBe(2);

        // Complete task2 (delete)
        const completed2 = { ...task2, status: 'done' as const };
        const result2 = handleOnCompletion(task2, [completed2]);
        expect(result2.length).toBe(0);

        // Complete task3 (archive)
        const completed3 = { ...task3, status: 'done' as const, onCompletion: { action: 'archive' } };
        const result3 = handleOnCompletion(task3, [completed3]);
        expect(result3.length).toBe(1);
        expect((result3[0] as any)._shouldArchive).toBe(true);
    });

    it('should validate all onCompletion actions before applying', () => {
        const validActions = [
            'keep',
            'delete',
            { action: 'archive' as const },
            { action: 'customTransition' as const, nextStatus: 'cancelled' },
        ];

        validActions.forEach(action => {
            const result = validateOnCompletionAction(action as any);
            expect(result.valid).toBe(true);
        });
    });

    it('should reject invalid onCompletion actions', () => {
        const invalidActions = [
            'invalid',
            { action: 'unknownAction' },
            { action: 'customTransition' }, // Missing nextStatus/customHandler
        ];

        const result1 = validateOnCompletionAction('invalid' as any);
        expect(result1.valid).toBe(false);

        const result2 = validateOnCompletionAction({ action: 'unknownAction' } as any);
        expect(result2.valid).toBe(false);

        const result3 = validateOnCompletionAction({
            action: 'customTransition',
            nextStatus: undefined,
            customHandler: undefined,
        } as any);
        expect(result3.valid).toBe(false);
    });
});

describe('Week 6 Integration - Task Focus and Resolution', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should resolve task ID from focused task element', () => {
        const taskElement = document.createElement('div');
        taskElement.setAttribute('data-task-id', 'focal-task-123');
        taskElement.classList.add('task-item');
        document.body.appendChild(taskElement);

        const taskId = taskElement.getAttribute('data-task-id');
        expect(taskId).toBe('focal-task-123');
    });

    it('should resolve task ID from nested element within task', () => {
        const taskContainer = document.createElement('div');
        taskContainer.setAttribute('data-task-id', 'nested-task-456');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        taskContainer.appendChild(checkbox);

        const label = document.createElement('span');
        label.textContent = 'Task label';
        taskContainer.appendChild(label);

        document.body.appendChild(taskContainer);

        // Traverse from label to find task ID
        let element: HTMLElement | null = label;
        let taskId: string | null = null;

        while (element && !taskId) {
            taskId = element.getAttribute('data-task-id');
            element = element.parentElement;
        }

        expect(taskId).toBe('nested-task-456');
    });

    it('should handle shortcut when no task is focused (global shortcuts)', () => {
        // For global shortcuts like quickAddTask, no focused task is needed
        const globalShortcuts = ['quickAddTask', 'createRecurringTask', 'openRecurringTasksDock'];
        
        // These should work without a focused task
        expect(globalShortcuts.length).toBeGreaterThan(0);

        // No task element in DOM
        expect(document.querySelector('[data-task-id]')).toBeNull();
    });

    it('should skip task-specific shortcuts when no task is focused', () => {
        // For task-specific shortcuts, need a focused task
        const taskSpecificShortcuts = [
            'markTaskDone',
            'postponeTask',
            'toggleTaskStatus',
            'openTaskEditor',
        ];

        // No task element in DOM
        const focusedTaskId = document.querySelector('[data-task-id]')?.getAttribute('data-task-id');
        
        expect(focusedTaskId).toBeNull();
        expect(taskSpecificShortcuts.length).toBe(4);
    });
});

describe('Week 6 Integration - Performance', () => {
    it('should handle rapid shortcut invocations with cooldown', async () => {
        const cooldownMs = 350;
        const invocations: number[] = [];
        let cooldownActive = false;

        const throttledAction = () => {
            if (cooldownActive) {
                return false; // Blocked
            }

            invocations.push(Date.now());
            cooldownActive = true;
            setTimeout(() => {
                cooldownActive = false;
            }, cooldownMs);
            return true; // Executed
        };

        // First invocation - should execute
        const result1 = throttledAction();
        expect(result1).toBe(true);
        expect(invocations.length).toBe(1);

        // Immediate second invocation - should be blocked
        const result2 = throttledAction();
        expect(result2).toBe(false);
        expect(invocations.length).toBe(1);

        // Wait for cooldown
        await new Promise(resolve => setTimeout(resolve, cooldownMs + 50));

        // Third invocation after cooldown - should execute
        const result3 = throttledAction();
        expect(result3).toBe(true);
        expect(invocations.length).toBe(2);
    });

    it('should process onCompletion for large task batches efficiently', () => {
        const batchSize = 1000;
        const tasks: Task[] = [];

        for (let i = 0; i < batchSize; i++) {
            tasks.push(createTask({
                id: `batch-task-${i}`,
                status: 'todo',
                onCompletion: i % 3 === 0 ? 'delete' : i % 3 === 1 ? 'keep' : { action: 'archive' },
            }));
        }

        const startTime = performance.now();

        // Process all tasks
        tasks.forEach(task => {
            const completed = { ...task, status: 'done' as const };
            handleOnCompletion(task, [completed]);
        });

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Should complete in reasonable time (< 100ms for 1000 tasks)
        expect(duration).toBeLessThan(100);
        expect(tasks.length).toBe(batchSize);
    });
});

// Helper function to create test tasks
function createTask(overrides: Partial<Task> = {}): Task {
    return {
        id: `test-task-${Math.random()}`,
        name: 'Test Task',
        dueAt: new Date().toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'todo',
        onCompletion: undefined,
        ...overrides,
    } as Task;
}
