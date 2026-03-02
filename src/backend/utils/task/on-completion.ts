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
