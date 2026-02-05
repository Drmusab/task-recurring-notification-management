import type { Plugin } from "siyuan";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskRepository";
import type { RecurrenceEngineRRULE as RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngineRRULE";
import type { PluginSettings } from "@backend/core/settings/PluginSettings";
import { TaskCommands } from "@backend/commands/TaskCommands";
import { SettingUtils } from "@shared/utils/misc/SettingUtils";
import { toast } from "@shared/utils/misc/notifications";
import * as logger from "@shared/utils/misc/logger";
import {
  DEFAULT_SHORTCUT_SETTINGS,
  SHORTCUT_DEFINITIONS,
  type ShortcutDefinition,
  type ShortcutId,
  type ShortcutSettings,
} from "@shared/utils/misc/shortcuts";
import { extractTaskName, extractTimeFromContent } from "@/plugin/menus";

export interface ShortcutDisplay {
  id: ShortcutId;
  label: string;
  description: string;
  context?: string;
  currentHotkey: string;
  defaultHotkey: string;
}

export interface ShortcutHandlers {
  createTask: (payload: {
    source: string;
    suggestedName?: string;
    linkedBlockId?: string;
    linkedBlockContent?: string;
    suggestedTime?: string | null;
  }) => void;
  completeTask: (taskId: string) => void | Promise<void>;
  postponeTask: (taskId: string) => void;
  openDock: () => void;
  openTaskEditor: () => void;
  createTaskFromBlock: () => void | Promise<void>;
}

const SHORTCUT_SETTINGS_KEY = "recurring-task-shortcuts";
const QUICK_ADD_COOLDOWN_MS = 350;

type BlockSelectionContext = {
  blockId: string;
  blockContent: string;
};

/**
 * Centralized shortcut manager that registers commands and enforces
 * context-safe shortcut behavior for recurring tasks.
 */
export class ShortcutManager {
  private settingsStore: SettingUtils<ShortcutSettings>;
  private settings: ShortcutSettings = { ...DEFAULT_SHORTCUT_SETTINGS };
  private taskCommands: TaskCommands;
  private cooldownTimers = new Map<ShortcutId, number>();

  constructor(
    private plugin: Plugin,
    private repository: TaskRepositoryProvider,
    recurrenceEngine: RecurrenceEngine | undefined,
    getSettings: (() => PluginSettings) | undefined,
    private handlers: ShortcutHandlers
  ) {
    this.settingsStore = new SettingUtils(
      plugin,
      SHORTCUT_SETTINGS_KEY,
      DEFAULT_SHORTCUT_SETTINGS
    );
    this.taskCommands = new TaskCommands(
      repository,
      recurrenceEngine,
      getSettings,
      undefined
    );
  }

  async initialize(): Promise<void> {
    this.settings = await this.settingsStore.load();
  }

  registerShortcuts(): void {
    SHORTCUT_DEFINITIONS.forEach((definition) => {
      const hotkey = this.settings[definition.id] || definition.defaultHotkey;
      this.plugin.addCommand({
        langKey: definition.langKey,
        hotkey,
        callback: () => {
          this.handleShortcut(definition.id).catch((error) => {
            logger.error(`Failed to handle shortcut ${definition.id}`, error);
          });
        },
      });
    });

    logger.info("Registered shortcut commands", {
      shortcuts: SHORTCUT_DEFINITIONS.map((definition) => ({
        id: definition.id,
        hotkey: this.settings[definition.id],
      })),
    });
  }

  getShortcutDisplay(): ShortcutDisplay[] {
    return SHORTCUT_DEFINITIONS.map((definition) => ({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      context: definition.context,
      currentHotkey: this.settings[definition.id] || "",
      defaultHotkey: definition.defaultHotkey,
    }));
  }

  async updateShortcut(id: ShortcutId, hotkey: string): Promise<{ success: boolean; message?: string }> {
    const trimmed = hotkey.trim();
    const duplicate = this.findDuplicateHotkey(id, trimmed);
    if (duplicate) {
      return {
        success: false,
        message: `Hotkey already assigned to "${duplicate.label}".`,
      };
    }

    this.settings = { ...this.settings, [id]: trimmed };
    await this.settingsStore.save(this.settings);
    this.registerShortcuts();
    return { success: true };
  }

  async resetShortcut(id: ShortcutId): Promise<void> {
    const definition = this.getDefinition(id);
    if (!definition) return;
    this.settings = { ...this.settings, [id]: definition.defaultHotkey };
    await this.settingsStore.save(this.settings);
    this.registerShortcuts();
  }

  async resetAllShortcuts(): Promise<void> {
    this.settings = { ...DEFAULT_SHORTCUT_SETTINGS };
    await this.settingsStore.save(this.settings);
    this.registerShortcuts();
  }

  destroy(): void {
    this.cooldownTimers.forEach((timeoutId) => globalThis.clearTimeout(timeoutId));
    this.cooldownTimers.clear();
  }

  private async handleShortcut(id: ShortcutId): Promise<void> {
    if (this.shouldIgnoreShortcut(id)) {
      return;
    }

    switch (id) {
      case "quickAddTask":
        this.guardCooldown(id, QUICK_ADD_COOLDOWN_MS, () => {
          this.handlers.createTask(this.buildCreatePayload("shortcut"));
        });
        break;
      case "createRecurringTask":
        this.handlers.createTask(this.buildCreatePayload("shortcut"));
        break;
      case "openRecurringTasksDock":
        this.handlers.openDock();
        break;
      case "markTaskDone": {
        const taskId = this.resolveTaskId();
        if (!taskId) return;
        await this.handlers.completeTask(taskId);
        break;
      }
      case "postponeTask": {
        const taskId = this.resolveTaskId();
        if (!taskId) return;
        this.handlers.postponeTask(taskId);
        break;
      }
      case "quickCompleteNextTask":
        await this.quickCompleteNextTask();
        break;
      case "toggleTaskStatus": {
        const taskId = this.resolveTaskId();
        if (!taskId) return;
        await this.taskCommands.toggleStatus(taskId);
        break;
      }
      case "openTaskEditor":
        this.handlers.openTaskEditor();
        break;
      case "createTaskFromBlock":
        await this.handlers.createTaskFromBlock();
        break;
      default:
        break;
    }
  }

  private guardCooldown(id: ShortcutId, durationMs: number, action: () => void): void {
    if (this.cooldownTimers.has(id)) {
      return;
    }
    action();
    const timeoutId = globalThis.setTimeout(() => {
      this.cooldownTimers.delete(id);
    }, durationMs);
    this.cooldownTimers.set(id, timeoutId);
  }

  private shouldIgnoreShortcut(id: ShortcutId): boolean {
    const active = document.activeElement as HTMLElement | null;
    if (!active) {
      return false;
    }

    const tag = active.tagName.toLowerCase();
    if (["input", "textarea", "select"].includes(tag)) {
      return true;
    }

    if (active.isContentEditable) {
      return !this.isEditorAllowedShortcut(id);
    }

    return false;
  }

  private isEditorAllowedShortcut(id: ShortcutId): boolean {
    return id === "quickAddTask" || id === "createRecurringTask";
  }

  private resolveTaskId(): string | null {
    const focusedTaskId = this.getFocusedTaskId();
    if (focusedTaskId) return focusedTaskId;

    const blockContext = this.getSelectedBlockContext();
    if (!blockContext) return null;
    const task = this.repository.getTaskByBlockId(blockContext.blockId);
    return task?.id ?? null;
  }

  private getFocusedTaskId(): string | null {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return null;
    const taskElement = active.closest("[data-task-id]") as HTMLElement | null;
    return taskElement?.dataset.taskId ?? null;
  }

  private getSelectedBlockContext(): BlockSelectionContext | null {
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    if (!anchor) return null;

    const element = anchor instanceof HTMLElement ? anchor : anchor.parentElement;
    if (!element) return null;

    const blockElement = element.closest("[data-node-id]") as HTMLElement | null;
    if (!blockElement) return null;

    const blockId = blockElement.getAttribute("data-node-id");
    if (!blockId) return null;

    return {
      blockId,
      blockContent: blockElement.textContent || "",
    };
  }

  private buildCreatePayload(source: string): ShortcutHandlers["createTask"] extends (
    payload: infer T
  ) => void
    ? T
    : never {
    const blockContext = this.getSelectedBlockContext();
    if (!blockContext) {
      return { source };
    }

    return {
      source,
      linkedBlockId: blockContext.blockId,
      linkedBlockContent: blockContext.blockContent,
      suggestedName: extractTaskName(blockContext.blockContent),
      suggestedTime: extractTimeFromContent(blockContext.blockContent),
    };
  }

  private async quickCompleteNextTask(): Promise<void> {
    try {
      const tasks = this.repository.getTodayAndOverdueTasks();
      if (tasks.length === 0) {
        return;
      }

      const task = tasks[0];
      await this.taskCommands.completeTask(task.id);
    } catch (err) {
      logger.error("Failed to quick complete task", err);
      toast.error("Failed to complete task");
    }
  }

  private getDefinition(id: ShortcutId): ShortcutDefinition | undefined {
    return SHORTCUT_DEFINITIONS.find((definition) => definition.id === id);
  }

  private findDuplicateHotkey(id: ShortcutId, hotkey: string): ShortcutDisplay | null {
    if (!hotkey) return null;
    const normalized = hotkey.toLowerCase();
    const duplicate = SHORTCUT_DEFINITIONS.find((definition) => {
      if (definition.id === id) return false;
      return (this.settings[definition.id] || "").toLowerCase() === normalized;
    });

    if (!duplicate) return null;
    return {
      id: duplicate.id,
      label: duplicate.label,
      description: duplicate.description,
      context: duplicate.context,
      currentHotkey: this.settings[duplicate.id],
      defaultHotkey: duplicate.defaultHotkey,
    };
  }
}
