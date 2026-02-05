/**
 * LivePreviewExtension module for live preview functionality
 * Provides editor extensions for real-time task rendering
 */

/**
 * Editor extension type for compatibility
 * This represents a CodeMirror-style editor extension
 */
export type EditorExtension = {
    /** Extension name */
    name?: string;
    /** Extension configuration */
    config?: Record<string, unknown>;
};

/**
 * Creates a new live preview extension for the editor
 * This extension handles real-time rendering of tasks in the editor
 * 
 * @returns An editor extension that can be registered with the plugin
 */
export function newLivePreviewExtension(): EditorExtension {
    return {
        name: 'tasks-live-preview',
        config: {
            // Configuration for live preview behavior
            enabled: true,
            renderCheckboxes: true,
            renderDates: true,
            renderPriority: true,
            renderTags: true,
            renderRecurrence: true,
        },
    };
}

/**
 * Configuration options for the live preview extension
 */
export interface LivePreviewConfig {
    /** Whether the extension is enabled */
    enabled: boolean;
    /** Whether to render checkboxes */
    renderCheckboxes: boolean;
    /** Whether to render dates */
    renderDates: boolean;
    /** Whether to render priority indicators */
    renderPriority: boolean;
    /** Whether to render tags */
    renderTags: boolean;
    /** Whether to render recurrence indicators */
    renderRecurrence: boolean;
}

/**
 * Update the live preview configuration
 */
export function updateLivePreviewConfig(config: Partial<LivePreviewConfig>): EditorExtension {
    return {
        name: 'tasks-live-preview',
        config: {
            enabled: config.enabled ?? true,
            renderCheckboxes: config.renderCheckboxes ?? true,
            renderDates: config.renderDates ?? true,
            renderPriority: config.renderPriority ?? true,
            renderTags: config.renderTags ?? true,
            renderRecurrence: config.renderRecurrence ?? true,
        },
    };
}

/**
 * Disable the live preview extension
 */
export function disableLivePreview(): EditorExtension {
    return {
        name: 'tasks-live-preview',
        config: {
            enabled: false,
        },
    };
}
