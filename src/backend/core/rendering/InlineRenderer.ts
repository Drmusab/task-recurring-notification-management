/**
 * InlineRenderer module for rendering tasks inline
 * Handles the visual representation of tasks in the editor
 */

import type { App, Plugin } from "@backend/utils/siyuan-compat";

/**
 * Configuration options for InlineRenderer
 */
export interface InlineRendererOptions {
    plugin: Plugin;
    app: App;
}

/**
 * InlineRenderer class for rendering task elements inline
 * Provides functionality to render task checkboxes, dates, and other elements
 * directly within the document editor
 */
export class InlineRenderer {
    private plugin: Plugin;
    private app: App;
    private observers: MutationObserver[] = [];
    private enabled: boolean = true;

    constructor(options: InlineRendererOptions) {
        this.plugin = options.plugin;
        this.app = options.app;
        this.initialize();
    }

    /**
     * Initialize the inline renderer
     */
    private initialize(): void {
        // Set up mutation observers or other initialization logic
        this.setupObservers();
    }

    /**
     * Set up DOM mutation observers for rendering
     */
    private setupObservers(): void {
        // Create a mutation observer to watch for new task elements
        const observer = new MutationObserver((mutations) => {
            if (!this.enabled) return;

            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of Array.from(mutation.addedNodes)) {
                        if (node instanceof HTMLElement) {
                            this.processElement(node);
                        }
                    }
                }
            }
        });

        // Observe the document body for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        this.observers.push(observer);
    }

    /**
     * Process an element for task rendering
     */
    private processElement(element: HTMLElement): void {
        // Find task list items within the element
        const taskItems = element.querySelectorAll('li[data-task]');
        for (const item of Array.from(taskItems)) {
            if (item instanceof HTMLElement) {
                this.renderTaskItem(item);
            }
        }
    }

    /**
     * Render a task item with enhanced styling
     */
    private renderTaskItem(item: HTMLElement): void {
        // Add custom classes or styling to task items
        const status = item.getAttribute('data-task');
        if (status) {
            item.classList.add('tasks-plugin-rendered');
        }
    }

    /**
     * Enable the inline renderer
     */
    public enable(): void {
        this.enabled = true;
    }

    /**
     * Disable the inline renderer
     */
    public disable(): void {
        this.enabled = false;
    }

    /**
     * Check if the renderer is enabled
     */
    public isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Force a re-render of all task elements
     */
    public refresh(): void {
        const taskItems = document.querySelectorAll('li[data-task]');
        for (const item of Array.from(taskItems)) {
            if (item instanceof HTMLElement) {
                this.renderTaskItem(item);
            }
        }
    }

    /**
     * Clean up the inline renderer
     */
    public unload(): void {
        for (const observer of this.observers) {
            observer.disconnect();
        }
        this.observers = [];
        this.enabled = false;
    }
}
