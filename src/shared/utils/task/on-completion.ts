import type { Task, OnCompletionAction } from "@backend/core/models/Task";

export enum OnCompletion {
    Ignore = '',
    Keep = 'keep', // Like Ignore, but is visible on task lines
    Delete = 'delete',
    Archive = 'archive', // Move to archive storage
}

/**
 * Enhanced OnCompletion action that supports both simple strings and complex actions
 */
export type EnhancedOnCompletionAction = 
    | 'keep'
    | 'delete'
    | 'archive'
    | OnCompletionAction;

export function parseOnCompletionValue(inputOnCompletionValue: string): OnCompletion {
    const onCompletionString = inputOnCompletionValue.trim().toLowerCase();
    if (onCompletionString === 'delete') {
        return OnCompletion.Delete;
    } else if (onCompletionString === 'keep') {
        return OnCompletion.Keep;
    } else if (onCompletionString === 'archive') {
        return OnCompletion.Archive;
    } else {
        return OnCompletion.Ignore;
    }
}

/**
 * Parse complex OnCompletionAction from task
 */
export function parseComplexOnCompletion(task: Task): EnhancedOnCompletionAction | null {
    if (!task.onCompletion) {
        return null;
    }
    
    // Simple string action
    if (typeof task.onCompletion === 'string') {
        return task.onCompletion as EnhancedOnCompletionAction;
    }
    
    // Complex action object
    return task.onCompletion as OnCompletionAction;
}

function returnWithoutCompletedInstance(tasks: Task[], changedStatusTask: Task): Task[] {
    return tasks.filter((task) => task !== changedStatusTask);
}

function keepTasks(originalTask: Task, changedStatusTask: Task): boolean {
    const startStatus = originalTask.status;
    const endStatus = changedStatusTask.status;

    const statusDidNotChange = endStatus === startStatus;
    const endStatusIsNotDone = endStatus !== 'done';

    return endStatusIsNotDone || statusDidNotChange;
}

/**
 * Enhanced handler that supports complex OnCompletionAction
 */
export function handleOnCompletion(originalTask: Task, newTasks: Task[]): Task[] {
    const tasksArrayLength = newTasks.length;
    if (tasksArrayLength === 0) {
        return newTasks;
    }
    
    const changedStatusTask = newTasks[tasksArrayLength - 1];
    const keepAllTasks = keepTasks(originalTask, changedStatusTask);
    if (keepAllTasks) {
        return newTasks;
    }

    // Parse completion action
    const action = parseComplexOnCompletion(originalTask);
    
    if (!action) {
        return newTasks;
    }

    // Handle simple string actions
    if (typeof action === 'string') {
        const simpleAction = parseOnCompletionValue(action);
        
        if (simpleAction === OnCompletion.Ignore || simpleAction === OnCompletion.Keep) {
            return newTasks;
        }
        
        if (simpleAction === OnCompletion.Delete) {
            return returnWithoutCompletedInstance(newTasks, changedStatusTask);
        }
        
        if (simpleAction === OnCompletion.Archive) {
            // Mark task for archiving (actual archiving happens in storage layer)
            (changedStatusTask as any)._shouldArchive = true;
            return newTasks;
        }
    }
    
    // Handle complex action object
    if (typeof action === 'object' && action.action) {
        switch (action.action) {
            case 'delete':
                return returnWithoutCompletedInstance(newTasks, changedStatusTask);
            
            case 'archive':
                (changedStatusTask as any)._shouldArchive = true;
                return newTasks;
            
            case 'keep':
                return newTasks;
            
            case 'customTransition':
                if (action.nextStatus) {
                    changedStatusTask.status = action.nextStatus as any;
                }
                if (action.customHandler) {
                    (changedStatusTask as any)._customHandler = action.customHandler;
                }
                return newTasks;
            
            default:
                console.warn(`OnCompletion action ${action.action} not yet fully implemented.`);
                return newTasks;
        }
    }

    return newTasks;
}

/**
 * Validate OnCompletionAction configuration
 */
export function validateOnCompletionAction(action: EnhancedOnCompletionAction): { valid: boolean; error?: string } {
    if (!action) {
        return { valid: true };
    }
    
    // Simple string validation
    if (typeof action === 'string') {
        const validActions = ['keep', 'delete', 'archive', ''];
        if (!validActions.includes(action)) {
            return { valid: false, error: `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}` };
        }
        return { valid: true };
    }
    
    // Complex action validation
    if (typeof action === 'object') {
        if (!action.action) {
            return { valid: false, error: 'Complex action must have an "action" property' };
        }
        
        const validActions = ['keep', 'delete', 'archive', 'customTransition'];
        if (!validActions.includes(action.action)) {
            return { valid: false, error: `Invalid action: ${action.action}. Must be one of: ${validActions.join(', ')}` };
        }
        
        if (action.action === 'customTransition') {
            if (!action.nextStatus && !action.customHandler) {
                return { 
                    valid: false, 
                    error: 'customTransition requires either nextStatus or customHandler' 
                };
            }
        }
        
        return { valid: true };
    }
    
    return { valid: false, error: 'Invalid action format' };
}

export enum OnCompletion {
    Ignore = '',
    Keep = 'keep', // Like Ignore, but is visible on task lines
    Delete = 'delete',
    Archive = 'archive', // Move to archive storage
}

/**
 * Enhanced OnCompletion action that supports both simple strings and complex actions
 */
export type EnhancedOnCompletionAction = 
    | 'keep'
    | 'delete'
    | 'archive'
    | OnCompletionAction;

export function parseOnCompletionValue(inputOnCompletionValue: string): OnCompletion {
    const onCompletionString = inputOnCompletionValue.trim().toLowerCase();
    if (onCompletionString === 'delete') {
        return OnCompletion.Delete;
    } else if (onCompletionString === 'keep') {
        return OnCompletion.Keep;
    } else if (onCompletionString === 'archive') {
        return OnCompletion.Archive;
    } else {
        return OnCompletion.Ignore;
    }
}

/**
 * Parse complex OnCompletionAction from task
 */
export function parseComplexOnCompletion(task: Task): EnhancedOnCompletionAction | null {
    if (!task.onCompletion) {
        return null;
    }
    
    // Simple string action
    if (typeof task.onCompletion === 'string') {
        return task.onCompletion as EnhancedOnCompletionAction;
    }
    
    // Complex action object
    return task.onCompletion as OnCompletionAction;
}

function returnWithoutCompletedInstance(tasks: Task[], changedStatusTask: Task): Task[] {
    return tasks.filter((task) => task !== changedStatusTask);
}

function keepTasks(originalTask: Task, changedStatusTask: Task): boolean {
    const startStatus = originalTask.status;
    const endStatus = changedStatusTask.status;

    const statusDidNotChange = endStatus.type === startStatus.type;
    const endStatusIsNotDone = endStatus.type !== StatusType.DONE;

    return endStatusIsNotDone || statusDidNotChange;
}

/**
 * Enhanced handler that supports complex OnCompletionAction
 */
export function handleOnCompletion(originalTask: Task, newTasks: Task[]): Task[] {
    const tasksArrayLength = newTasks.length;
    if (tasksArrayLength === 0) {
        return newTasks;
    }
    
    const changedStatusTask = newTasks[tasksArrayLength - 1];
    const keepAllTasks = keepTasks(originalTask, changedStatusTask);
    if (keepAllTasks) {
        return newTasks;
    }

    // Parse completion action
    const action = parseComplexOnCompletion(originalTask);
    
    if (!action) {
        return newTasks;
    }

    // Handle simple string actions
    if (typeof action === 'string') {
        const simpleAction = parseOnCompletionValue(action);
        
        if (simpleAction === OnCompletion.Ignore || simpleAction === OnCompletion.Keep) {
            return newTasks;
        }
        
        if (simpleAction === OnCompletion.Delete) {
            return returnWithoutCompletedInstance(newTasks, changedStatusTask);
        }
        
        if (simpleAction === OnCompletion.Archive) {
            // Mark task for archiving (actual archiving happens in storage layer)
            changedStatusTask._shouldArchive = true;
            return newTasks;
        }
    }
    
    // Handle complex action object
    if (typeof action === 'object' && action.action) {
        switch (action.action) {
            case 'delete':
                return returnWithoutCompletedInstance(newTasks, changedStatusTask);
            
            case 'archive':
                changedStatusTask._shouldArchive = true;
                return newTasks;
            
            case 'keep':
                return newTasks;
            
            case 'customTransition':
                if (action.nextStatus) {
                    changedStatusTask.status = action.nextStatus;
                }
                if (action.customHandler) {
                    changedStatusTask._customHandler = action.customHandler;
                }
                return newTasks;
            
            default:
                console.warn(`OnCompletion action ${action.action} not yet fully implemented.`);
                return newTasks;
        }
    }

    return newTasks;
}

/**
 * Validate OnCompletionAction configuration
 */
export function validateOnCompletionAction(action: EnhancedOnCompletionAction): { valid: boolean; error?: string } {
    if (!action) {
        return { valid: true };
    }
    
    // Simple string validation
    if (typeof action === 'string') {
        const validActions = ['keep', 'delete', 'archive', ''];
        if (!validActions.includes(action)) {
            return { valid: false, error: `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}` };
        }
        return { valid: true };
    }
    
    // Complex action validation
    if (typeof action === 'object') {
        if (!action.action) {
            return { valid: false, error: 'Complex action must have an "action" property' };
        }
        
        const validActions = ['keep', 'delete', 'archive', 'customTransition'];
        if (!validActions.includes(action.action)) {
            return { valid: false, error: `Invalid action: ${action.action}. Must be one of: ${validActions.join(', ')}` };
        }
        
        if (action.action === 'customTransition') {
            if (!action.nextStatus && !action.customHandler) {
                return { 
                    valid: false, 
                    error: 'customTransition requires either nextStatus or customHandler' 
                };
            }
        }
        
        return { valid: true };
    }
    
    return { valid: false, error: 'Invalid action format' };
}
