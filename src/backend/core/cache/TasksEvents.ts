/**
 * TasksEvents module for handling plugin-wide task events
 */

import * as logger from "@backend/logging/logger";

type EventCallback = (...args: unknown[]) => void;

/**
 * Configuration options for TasksEvents
 */
export interface TasksEventsOptions {
    workspace?: any;
}

/**
 * TasksEvents class for managing task-related events
 * Provides a centralized event system for the plugin
 */
export class TasksEvents {
    private workspace: any;
    private eventHandlers: Map<string, Set<EventCallback>> = new Map();
    private unsubscribeCallbacks: (() => void)[] = [];

    constructor(options: TasksEventsOptions = {}) {
        this.workspace = options.workspace;
        this.setupWorkspaceEvents();
    }

    /**
     * Set up workspace event listeners
     */
    private setupWorkspaceEvents(): void {
        if (!this.workspace) return;

        // Subscribe to layout changes
        const onLayoutChange = () => this.emit('layout-change');
        this.workspace.on?.('layout-change', onLayoutChange);
        this.unsubscribeCallbacks.push(() => {
            this.workspace.off?.('layout-change', onLayoutChange);
        });

        // Subscribe to file modifications
        const onFileChange = () => this.emit('file-change');
        this.workspace.on?.('file-change', onFileChange);
        this.unsubscribeCallbacks.push(() => {
            this.workspace.off?.('file-change', onFileChange);
        });
    }

    /**
     * Subscribe to an event
     */
    public on(event: string, callback: EventCallback): () => void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event)!.add(callback);

        return () => {
            this.eventHandlers.get(event)?.delete(callback);
        };
    }

    /**
     * Emit an event to all subscribers
     */
    public emit(event: string, ...args: unknown[]): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(...args);
                } catch (error) {
                    logger.error(`Error in event handler for ${event}`, error);
                }
            }
        }
    }

    /**
     * Trigger a cache update event
     */
    public triggerCacheUpdate(): void {
        this.emit('cache-update');
    }

    /**
     * Subscribe to cache update events
     */
    public onCacheUpdate(callback: EventCallback): () => void {
        return this.on('cache-update', callback);
    }

    /**
     * Trigger a request for cache refresh
     */
    public triggerRequestCacheUpdate(): void {
        this.emit('request-cache-update');
    }

    /**
     * Subscribe to cache refresh requests
     */
    public onRequestCacheUpdate(callback: EventCallback): () => void {
        return this.on('request-cache-update', callback);
    }

    /**
     * Clean up all event subscriptions
     */
    public unload(): void {
        for (const callback of this.unsubscribeCallbacks) {
            callback();
        }
        this.unsubscribeCallbacks = [];
        this.eventHandlers.clear();
    }
}
