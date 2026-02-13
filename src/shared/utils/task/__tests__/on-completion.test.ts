import { describe, it, expect, vi } from 'vitest';
import {
    OnCompletion,
    parseOnCompletionValue,
    parseComplexOnCompletion,
    handleOnCompletion,
    validateOnCompletionAction,
    type EnhancedOnCompletionAction,
} from '../on-completion';
import type { Task, OnCompletionAction } from '../../../../backend/core/models/Task';

describe('OnCompletion - parseOnCompletionValue', () => {
    it('should parse "delete" to OnCompletion.Delete', () => {
        expect(parseOnCompletionValue('delete')).toBe(OnCompletion.Delete);
        expect(parseOnCompletionValue('DELETE')).toBe(OnCompletion.Delete);
        expect(parseOnCompletionValue('  delete  ')).toBe(OnCompletion.Delete);
    });

    it('should parse "keep" to OnCompletion.Keep', () => {
        expect(parseOnCompletionValue('keep')).toBe(OnCompletion.Keep);
        expect(parseOnCompletionValue('KEEP')).toBe(OnCompletion.Keep);
        expect(parseOnCompletionValue('  keep  ')).toBe(OnCompletion.Keep);
    });

    it('should parse "archive" to OnCompletion.Archive', () => {
        expect(parseOnCompletionValue('archive')).toBe(OnCompletion.Archive);
        expect(parseOnCompletionValue('ARCHIVE')).toBe(OnCompletion.Archive);
        expect(parseOnCompletionValue('  archive  ')).toBe(OnCompletion.Archive);
    });

    it('should parse unknown values to OnCompletion.Ignore', () => {
        expect(parseOnCompletionValue('')).toBe(OnCompletion.Ignore);
        expect(parseOnCompletionValue('unknown')).toBe(OnCompletion.Ignore);
        expect(parseOnCompletionValue('foo')).toBe(OnCompletion.Ignore);
    });
});

describe('OnCompletion - parseComplexOnCompletion', () => {
    it('should return null for task without onCompletion', () => {
        const task = createTestTask({ onCompletion: undefined });
        expect(parseComplexOnCompletion(task)).toBeNull();
    });

    it('should parse simple string action', () => {
        const task = createTestTask({ onCompletion: 'delete' });
        expect(parseComplexOnCompletion(task)).toBe('delete');
    });

    it('should parse complex action object', () => {
        const action: OnCompletionAction = {
            action: 'archive',
            nextStatus: undefined,
            customHandler: undefined,
        };
        const task = createTestTask({ onCompletion: action });
        expect(parseComplexOnCompletion(task)).toEqual(action);
    });
});

describe('OnCompletion - handleOnCompletion Simple Actions', () => {
    it('should return all tasks when onCompletion is undefined', () => {
        const originalTask = createTestTask({ status: 'todo' });
        const completedTask = createTestTask({ status: 'done' });
        const newTasks = [completedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result).toEqual(newTasks);
        expect(result.length).toBe(1);
    });

    it('should return all tasks when onCompletion is Keep', () => {
        const originalTask = createTestTask({ onCompletion: 'keep', status: 'todo' });
        const completedTask = createTestTask({ onCompletion: 'keep', status: 'done' });
        const newTasks = [completedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result).toEqual(newTasks);
        expect(result.length).toBe(1);
    });

    it('should remove completed instance when onCompletion is Delete', () => {
        const originalTask = createTestTask({ onCompletion: 'delete', status: 'todo' });
        const completedTask = createTestTask({ onCompletion: 'delete', status: 'done' });
        const newTasks = [completedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result).toEqual([]);
        expect(result.length).toBe(0);
    });

    it('should mark task for archiving when onCompletion is Archive', () => {
        const action: OnCompletionAction = { action: 'archive' };
        const originalTask = createTestTask({ onCompletion: action, status: 'todo' });
        const completedTask = createTestTask({ onCompletion: action, status: 'done' });
        const newTasks = [completedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result.length).toBe(1);
        expect((result[0] as any)._shouldArchive).toBe(true);
    });

    it('should return empty array when newTasks is empty', () => {
        const originalTask = createTestTask({ onCompletion: 'delete', status: 'todo' });
        const result = handleOnCompletion(originalTask, []);
        expect(result).toEqual([]);
    });

    it('should keep tasks when status did not change', () => {
        const originalTask = createTestTask({ onCompletion: 'delete', status: 'todo' });
        const unchangedTask = createTestTask({ onCompletion: 'delete', status: 'todo' });
        const newTasks = [unchangedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result).toEqual(newTasks);
        expect(result.length).toBe(1);
    });

    it('should keep tasks when end status is cancelled', () => {
        const originalTask = createTestTask({ onCompletion: 'delete', status: 'todo' });
        const cancelledTask = createTestTask({ onCompletion: 'delete', status: 'cancelled' });
        const newTasks = [cancelledTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result).toEqual(newTasks);
        expect(result.length).toBe(1);
    });
});

describe('OnCompletion - handleOnCompletion Complex Actions', () => {
    it('should handle complex delete action', () => {
        const action: OnCompletionAction = {
            action: 'delete',
            nextStatus: undefined,
            customHandler: undefined,
        };
        const originalTask = createTestTask({ onCompletion: action, status: 'todo' });
        const completedTask = createTestTask({ onCompletion: action, status: 'done' });
        const newTasks = [completedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result).toEqual([]);
    });

    it('should handle complex archive action', () => {
        const action: OnCompletionAction = {
            action: 'archive',
            nextStatus: undefined,
            customHandler: undefined,
        };
        const originalTask = createTestTask({ onCompletion: action, status: 'todo' });
        const completedTask = createTestTask({ onCompletion: action, status: 'done' });
        const newTasks = [completedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result.length).toBe(1);
        expect((result[0] as any)._shouldArchive).toBe(true);
    });

    it('should handle complex keep action', () => {
        const action: OnCompletionAction = {
            action: 'keep',
            nextStatus: undefined,
            customHandler: undefined,
        };
        const originalTask = createTestTask({ onCompletion: action, status: 'todo' });
        const completedTask = createTestTask({ onCompletion: action, status: 'done' });
        const newTasks = [completedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result).toEqual(newTasks);
        expect(result.length).toBe(1);
    });

    it('should handle customTransition with nextStatus', () => {
        const action: OnCompletionAction = {
            action: 'customTransition',
            nextStatus: 'cancelled',
            customHandler: undefined,
        };
        const originalTask = createTestTask({ onCompletion: action, status: 'todo' });
        const completedTask = createTestTask({ onCompletion: action, status: 'done' });
        const newTasks = [completedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result.length).toBe(1);
        expect(result[0].status).toBe('cancelled');
    });

    it('should handle customTransition with customHandler', () => {
        const customHandler = 'myCustomHandler';
        const action: OnCompletionAction = {
            action: 'customTransition',
            nextStatus: undefined,
            customHandler,
        };
        const originalTask = createTestTask({ onCompletion: action, status: 'todo' });
        const completedTask = createTestTask({ onCompletion: action, status: 'done' });
        const newTasks = [completedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result.length).toBe(1);
        expect((result[0] as any)._customHandler).toBe(customHandler);
    });

    it('should warn on unknown complex action', () => {
        const action = {
            action: 'unknownAction',
            nextStatus: undefined,
            customHandler: undefined,
        } as any;
        const originalTask = createTestTask({ onCompletion: action, status: 'todo' });
        const completedTask = createTestTask({ onCompletion: action, status: 'done' });
        const newTasks = [completedTask];

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = handleOnCompletion(originalTask, newTasks);
        
        expect(result).toEqual(newTasks);
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('unknownAction'));
        
        consoleWarnSpy.mockRestore();
    });
});

describe('OnCompletion - handleOnCompletion Multiple Tasks', () => {
    it('should only remove the last task when Delete is used', () => {
        const originalTask = createTestTask({ onCompletion: 'delete', status: 'todo' });
        const recurringTask1 = createTestTask({ id: 'recurring-1', status: 'todo' });
        const recurringTask2 = createTestTask({ id: 'recurring-2', status: 'todo' });
        const completedTask = createTestTask({ id: 'completed', status: 'done' });
        const newTasks = [recurringTask1, recurringTask2, completedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result.length).toBe(2);
        expect(result).toContain(recurringTask1);
        expect(result).toContain(recurringTask2);
        expect(result).not.toContain(completedTask);
    });

    it('should keep all tasks when Keep is used with multiple instances', () => {
        const originalTask = createTestTask({ onCompletion: 'keep', status: 'todo' });
        const recurringTask1 = createTestTask({ id: 'recurring-1', status: 'todo' });
        const recurringTask2 = createTestTask({ id: 'recurring-2', status: 'todo' });
        const completedTask = createTestTask({ id: 'completed', status: 'done' });
        const newTasks = [recurringTask1, recurringTask2, completedTask];

        const result = handleOnCompletion(originalTask, newTasks);
        expect(result.length).toBe(3);
        expect(result).toEqual(newTasks);
    });
});

describe('OnCompletion - validateOnCompletionAction', () => {
    it('should validate simple string actions', () => {
        expect(validateOnCompletionAction('keep')).toEqual({ valid: true });
        expect(validateOnCompletionAction('delete')).toEqual({ valid: true });
        expect(validateOnCompletionAction('archive')).toEqual({ valid: true });
        expect(validateOnCompletionAction('')).toEqual({ valid: true });
    });

    it('should reject invalid simple string actions', () => {
        const result = validateOnCompletionAction('invalid' as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid action');
    });

    it('should validate complex actions', () => {
        const action: OnCompletionAction = {
            action: 'delete',
            nextStatus: undefined,
            customHandler: undefined,
        };
        expect(validateOnCompletionAction(action)).toEqual({ valid: true });
    });

    it('should reject complex action without action property', () => {
        const action = {
            nextStatus: undefined,
        } as any;
        const result = validateOnCompletionAction(action);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('must have an "action" property');
    });

    it('should reject complex action with invalid action type', () => {
        const action = {
            action: 'invalid',
            nextStatus: undefined,
            customHandler: undefined,
        } as any;
        const result = validateOnCompletionAction(action);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid action');
    });

    it('should validate customTransition with nextStatus', () => {
        const action: OnCompletionAction = {
            action: 'customTransition',
            nextStatus: 'cancelled',
            customHandler: undefined,
        };
        expect(validateOnCompletionAction(action)).toEqual({ valid: true });
    });

    it('should validate customTransition with customHandler', () => {
        const action: OnCompletionAction = {
            action: 'customTransition',
            nextStatus: undefined,
            customHandler: 'myHandler',
        };
        expect(validateOnCompletionAction(action)).toEqual({ valid: true });
    });

    it('should reject customTransition without nextStatus or customHandler', () => {
        const action: OnCompletionAction = {
            action: 'customTransition',
            nextStatus: undefined,
            customHandler: undefined,
        };
        const result = validateOnCompletionAction(action);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('requires either nextStatus or customHandler');
    });

    it('should validate null/undefined action', () => {
        expect(validateOnCompletionAction(null as any)).toEqual({ valid: true });
        expect(validateOnCompletionAction(undefined as any)).toEqual({ valid: true });
    });
});

// Helper function to create test tasks
function createTestTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 'test-task-id',
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
