/**
 * File operations module for task management
 * Handles reading and writing task data to files
 */

import type { Task } from "@backend/Task/Task";
import type { ListItem } from "@backend/Task/ListItem";

/**
 * File module state
 */
let metadataCache: any = null;
let vault: any = null;
let workspace: any = null;

/**
 * Configuration options for initializing the file module
 */
export interface FileInitOptions {
    metadataCache: any;
    vault: any;
    workspace: any;
}

/**
 * Initialize the file module with required dependencies
 */
export function initializeFile(options: FileInitOptions): void {
    metadataCache = options.metadataCache;
    vault = options.vault;
    workspace = options.workspace;
}

/**
 * Options for replacing a task with new tasks
 */
export interface ReplaceTaskOptions {
    originalTask: Task | ListItem;
    newTasks: Task | Task[] | ListItem | ListItem[];
}

/**
 * Replace a task in the file with one or more new tasks
 * This is the core function for persisting task changes
 */
export async function replaceTaskWithTasks(options: ReplaceTaskOptions): Promise<void> {
    const { originalTask, newTasks } = options;
    
    if (!vault) {
        console.error('File module not initialized. Call initializeFile first.');
        return;
    }

    try {
        const tasksArray = Array.isArray(newTasks) ? newTasks : [newTasks];
        const filePath = originalTask.taskLocation?.path;
        
        if (!filePath) {
            console.error('Task does not have a valid file path');
            return;
        }

        // Get the file from the vault
        const file = vault.getAbstractFileByPath?.(filePath);
        if (!file) {
            console.error(`File not found: ${filePath}`);
            return;
        }

        // Read the file content
        const content = await vault.read(file);
        const lines = content.split('\n');

        // Get the line number of the original task
        const lineNumber = originalTask.taskLocation?.lineNumber;
        if (lineNumber === undefined || lineNumber < 0 || lineNumber >= lines.length) {
            console.error(`Invalid line number: ${lineNumber}`);
            return;
        }

        // Generate the new task lines
        const newTaskLines = tasksArray.map(task => {
            if ('toFileLineString' in task && typeof task.toFileLineString === 'function') {
                return task.toFileLineString();
            }
            return task.toString();
        });

        // Replace the original line with new task lines
        lines.splice(lineNumber, 1, ...newTaskLines);

        // Write the modified content back to the file
        const newContent = lines.join('\n');
        await vault.modify(file, newContent);

    } catch (error) {
        console.error('Error replacing task:', error);
        throw error;
    }
}

/**
 * Read a task from a specific location in a file
 */
export async function readTaskFromFile(filePath: string, lineNumber: number): Promise<string | null> {
    if (!vault) {
        console.error('File module not initialized. Call initializeFile first.');
        return null;
    }

    try {
        const file = vault.getAbstractFileByPath?.(filePath);
        if (!file) {
            return null;
        }

        const content = await vault.read(file);
        const lines = content.split('\n');

        if (lineNumber >= 0 && lineNumber < lines.length) {
            return lines[lineNumber];
        }

        return null;
    } catch (error) {
        console.error('Error reading task from file:', error);
        return null;
    }
}

/**
 * Write content to a file
 */
export async function writeToFile(filePath: string, content: string): Promise<boolean> {
    if (!vault) {
        console.error('File module not initialized. Call initializeFile first.');
        return false;
    }

    try {
        let file = vault.getAbstractFileByPath?.(filePath);
        
        if (!file) {
            // Create the file if it doesn't exist
            file = await vault.create(filePath, content);
        } else {
            await vault.modify(file, content);
        }

        return true;
    } catch (error) {
        console.error('Error writing to file:', error);
        return false;
    }
}

/**
 * Get metadata cache
 */
export function getMetadataCache(): any {
    return metadataCache;
}

/**
 * Get vault instance
 */
export function getVault(): any {
    return vault;
}

/**
 * Get workspace instance
 */
export function getWorkspace(): any {
    return workspace;
}
