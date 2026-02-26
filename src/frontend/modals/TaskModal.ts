/**
 * TaskModal - Main task editor modal wrapper for SiYuan
 * 
 * This modal opens the unified task editor for creating/editing tasks.
 * Uses SiYuan's native Dialog component.
 * 
 * ARCHITECTURE (Session 27 — DTO-driven Command Surface):
 * - Accepts TaskDTO only — no domain imports
 * - Delegates mutation to UITaskMutationService
 * - Emits runtime events via UIEventService
 * - NEVER computes analytics, reschedules, or accesses storage
 * - NEVER imports domain types (Task, RecurrenceInstance, DependencyLink)
 * 
 * FORBIDDEN:
 *   ❌ import Task / domain model
 *   ❌ updateAnalyticsFromTasks() — analytics reacts via event subscription
 *   ❌ TaskStorage / Cache / SiYuan API
 *   ❌ Scheduler / Integration
 *   ❌ Inline domain mutation
 */

import { Dialog, showMessage } from "siyuan";
import type { Plugin } from "siyuan";
import { createUnifiedEditor } from "@components/shared/EditTaskUnified";
import type { TaskDTO } from '../services/DTOs';
import type { Status } from "@shared/types/Status";
import { uiMutationService } from '../services/UITaskMutationService';
import { uiEventService } from '../services/UIEventService';
import * as logger from "@shared/logging/logger";

export interface TaskModalParams {
    plugin: Plugin;
    task: TaskDTO | null;
    statusOptions: Status[];
    onSubmit: (task: TaskDTO) => void | Promise<void>;
    allTasks: TaskDTO[];
}

export class TaskModal {
    private plugin: Plugin;
    private task: TaskDTO | null;
    private statusOptions: Status[];
    private onSubmit: (task: TaskDTO) => void | Promise<void>;
    private allTasks: TaskDTO[];
    private dialog: Dialog | null = null;
    private editorInstance: { destroy: () => void } | null = null;

    constructor(
        plugin: Plugin,
        task: TaskDTO | null,
        statusOptions: Status[],
        onSubmit: (task: TaskDTO) => void | Promise<void>,
        allTasks: TaskDTO[]
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
            width: "700px",
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
        const taskData = this.task;

        this.editorInstance = createUnifiedEditor(container, {
            task: taskData,
            statusOptions: this.statusOptions,
            onSubmit: async (updatedTask: TaskDTO) => {
                try {
                    // Route mutation through UITaskMutationService
                    await this.onSubmit(updatedTask);
                    
                    // Emit runtime event — dashboard/analytics react via EventService subscription
                    uiEventService.emitTaskRefresh();
                    
                    logger.debug('Task saved via modal, refresh emitted');
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
