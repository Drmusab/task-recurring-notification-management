/**
 * TaskModal - Main task editor modal wrapper for SiYuan
 * 
 * This modal opens the unified task editor for creating/editing tasks.
 * Uses SiYuan's native Dialog component.
 * 
 * ARCHITECTURE:
 * - Accepts both Obsidian and SiYuan task models
 * - Converts to UnifiedTask internally
 * - Mounts EditTaskUnified which wraps legacy EditTask.svelte
 * - Adds Block Actions, Tags/Category, and AI Suggestions
 */

import { Dialog, showMessage } from "siyuan";
import type { Plugin } from "siyuan";
import { createUnifiedEditor } from "@components/common/EditTaskUnified";
import type { Task as SiYuanTask } from "@backend/core/models/Task";
import type { Task as ObsidianTask } from "@backend/core/models/Task";
import type { Status } from "@shared/types/Status";
import { TaskModelAdapter } from "@backend/services/TaskAdapterService";
import { updateAnalyticsFromTasks } from "@stores/task-analytics.store";
import { getTaskReminderBridge } from "@backend/core/integration/TaskReminderBridge";
import * as logger from "@backend/logging/logger";

export interface TaskModalParams {
    plugin: Plugin;
    task: SiYuanTask | ObsidianTask | null;
    statusOptions: Status[];
    onSubmit: (task: SiYuanTask) => void | Promise<void>;
    allTasks: (SiYuanTask | ObsidianTask)[];
}

export class TaskModal {
    private plugin: Plugin;
    private task: SiYuanTask | ObsidianTask | null;
    private statusOptions: Status[];
    private onSubmit: (task: SiYuanTask) => void | Promise<void>;
    private allTasks: (SiYuanTask | ObsidianTask)[];
    private dialog: Dialog | null = null;
    private editorInstance: { destroy: () => void } | null = null;

    constructor(
        plugin: Plugin,
        task: SiYuanTask | ObsidianTask | null,
        statusOptions: Status[],
        onSubmit: (task: SiYuanTask) => void | Promise<void>,
        allTasks: (SiYuanTask | ObsidianTask)[]
    ) {
        this.plugin = plugin;
        this.task = task;
        this.statusOptions = statusOptions;
        this.onSubmit = onSubmit;
        this.allTasks = allTasks;
    }

    public open(): void {
        const isEditing = this.task !== null;
        const title = isEditing 
            ? (this.plugin.i18n?.editTask || "Edit Task")
            : (this.plugin.i18n?.createTask || "Create Task");

        this.dialog = new Dialog({
            title,
            content: `<div id="task-editor-container" class="task-editor-modal"></div>`,
            width: "700px",  // Increased width for additional sections
            height: "auto",
            destroyCallback: () => {
                this.onClose();
            },
        });

        const container = this.dialog.element.querySelector("#task-editor-container");
        if (container) {
            this.initializeEditor(container as HTMLElement);
        }
    }

    private initializeEditor(container: HTMLElement): void {
        // Create default task if none provided
        const taskData = this.task || this.createDefaultTask();

        this.editorInstance = createUnifiedEditor(container, {
            task: taskData,
            statusOptions: this.statusOptions,
            onSubmit: async (updatedTask) => {
                try {
                    // Save task
                    await this.onSubmit(updatedTask);
                    
                    // Recalculate analytics after task save
                    try {
                        // Convert allTasks to SiYuan format for analytics calculation
                        const siyuanTasks = this.allTasks.map(t => {
                            if ('description' in t && 'status' in t) {
                                // Obsidian task - convert to SiYuan
                                const unified = TaskModelAdapter.obsidianToUnified(t as ObsidianTask);
                                return TaskModelAdapter.unifiedToSiyuan(unified);
                            }
                            return t as SiYuanTask;
                        });
                        
                        // Update analytics store
                        updateAnalyticsFromTasks(siyuanTasks);
                        logger.debug('Analytics updated after task save');
                    } catch (analyticsError) {
                        logger.error('Failed to update analytics after task save', analyticsError);
                        // Non-fatal - don't block task save
                    }
                    
                    this.close();
                } catch (error) {
                    logger.error("Error saving task:", error);
                    showMessage(this.plugin.i18n?.saveError || "Error saving task", 5000, "error");
                }
            },
            onCancel: () => {
                this.close();
            },
            allTasks: this.allTasks,
        });
    }

    private createDefaultTask(): SiYuanTask {
        return {
            id: crypto.randomUUID(),
            name: "",
            description: "",
            status: "todo",
            priority: "medium",
            dueAt: "",
            scheduledAt: undefined,
            startAt: undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            doneAt: undefined,
            cancelledAt: undefined,
            enabled: true,
            frequency: { type: 'once' },
            dependsOn: [],
            blockActions: [],
            tags: [],
            category: "",
            completionCount: 0,
            missCount: 0,
            currentStreak: 0,
            bestStreak: 0,
            version: 1,
        };
    }

    public close(): void {
        this.dialog?.destroy();
        this.dialog = null;
    }

    private onClose(): void {
        if (this.editorInstance) {
            this.editorInstance.destroy();
            this.editorInstance = null;
        }
    }
}
