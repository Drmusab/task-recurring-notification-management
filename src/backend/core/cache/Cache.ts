/**
 * Cache module for task management
 * Provides caching functionality for tasks across the plugin
 */

import type { Task } from "@backend/Task/Task";
import * as logger from "@backend/logging/logger";

/**
 * Represents the state of the cache
 */
export enum State {
    /** Cache is not initialized yet */
    Cold = 'Cold',
    /** Cache is initializing */
    Initializing = 'Initializing',
    /** Cache is ready and warm */
    Warm = 'Warm',
}

/**
 * Configuration options for the Cache
 */
export interface CacheOptions {
    metadataCache: any;
    vault: any;
    workspace: any;
    events: any;
}

/**
 * Cache class for managing tasks
 * Provides efficient access to parsed tasks from the vault
 */
export class Cache {
    private tasks: Task[] = [];
    private state: State = State.Cold;
    private metadataCache: any;
    private vault: any;
    private workspace: any;
    private events: any;
    private unloadCallbacks: (() => void)[] = [];

    constructor(options: CacheOptions) {
        this.metadataCache = options.metadataCache;
        this.vault = options.vault;
        this.workspace = options.workspace;
        this.events = options.events;
        this.initialize();
    }

    /**
     * Initialize the cache by loading tasks from the vault
     */
    private async initialize(): Promise<void> {
        this.state = State.Initializing;
        try {
            // Subscribe to events for cache updates
            if (this.events) {
                const unsubscribe = this.events.onCacheUpdate?.(() => {
                    this.refreshTasks();
                });
                if (unsubscribe) {
                    this.unloadCallbacks.push(unsubscribe);
                }
            }

            await this.refreshTasks();
            this.state = State.Warm;
        } catch (error) {
            logger.error('Failed to initialize cache', error);
            this.state = State.Cold;
        }
    }

    /**
     * Refresh tasks from the vault
     */
    private async refreshTasks(): Promise<void> {
        // Task loading logic will be implemented based on vault scanning
        // For now, this is a placeholder that maintains the existing task list
        this.notifySubscribers();
    }

    /**
     * Notify subscribers of cache changes
     */
    private notifySubscribers(): void {
        this.events?.triggerCacheUpdate?.();
    }

    /**
     * Get all cached tasks
     */
    public getTasks(): Task[] {
        return [...this.tasks];
    }

    /**
     * Get the current state of the cache
     */
    public getState(): State {
        return this.state;
    }

    /**
     * Add a task to the cache
     */
    public addTask(task: Task): void {
        this.tasks.push(task);
        this.notifySubscribers();
    }

    /**
     * Remove a task from the cache
     */
    public removeTask(task: Task): void {
        const index = this.tasks.findIndex(t => 
            t.taskLocation.path === task.taskLocation.path && 
            t.taskLocation.lineNumber === task.taskLocation.lineNumber
        );
        if (index !== -1) {
            this.tasks.splice(index, 1);
            this.notifySubscribers();
        }
    }

    /**
     * Update a task in the cache
     */
    public updateTask(originalTask: Task, newTask: Task): void {
        const index = this.tasks.findIndex(t => 
            t.taskLocation.path === originalTask.taskLocation.path && 
            t.taskLocation.lineNumber === originalTask.taskLocation.lineNumber
        );
        if (index !== -1) {
            this.tasks[index] = newTask;
            this.notifySubscribers();
        }
    }

    /**
     * Clean up the cache and unsubscribe from events
     */
    public unload(): void {
        for (const callback of this.unloadCallbacks) {
            callback();
        }
        this.unloadCallbacks = [];
        this.tasks = [];
        this.state = State.Cold;
    }
}
