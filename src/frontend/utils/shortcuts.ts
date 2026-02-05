export type ShortcutId =
  | "createRecurringTask"
  | "openRecurringTasksDock"
  | "quickAddTask"
  | "markTaskDone"
  | "postponeTask"
  | "quickCompleteNextTask"
  | "toggleTaskStatus"
  | "openTaskEditor"
  | "createTaskFromBlock";

export interface ShortcutDefinition {
  id: ShortcutId;
  langKey: string;
  label: string;
  description: string;
  defaultHotkey: string;
  context?: string;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: "quickAddTask",
    langKey: "quickAddTask",
    label: "Quick add recurring task",
    description: "Open the quick add dialog with focus on the task title.",
    defaultHotkey: "Ctrl+Shift+T",
    context: "Global / Editor",
  },
  {
    id: "markTaskDone",
    langKey: "markTaskDone",
    label: "Mark task as done",
    description: "Complete the focused task and trigger recurrence.",
    defaultHotkey: "Ctrl+Enter",
    context: "Task focus / Task block",
  },
  {
    id: "postponeTask",
    langKey: "postponeTask",
    label: "Postpone task",
    description: "Open the snooze selector for the focused task.",
    defaultHotkey: "Ctrl+Shift+P",
    context: "Task focus",
  },
  {
    id: "openRecurringTasksDock",
    langKey: "openRecurringTasksDock",
    label: "Open recurring tasks dock",
    description: "Focus the recurring tasks dashboard.",
    defaultHotkey: "Ctrl+Shift+O",
    context: "Global",
  },
  {
    id: "createRecurringTask",
    langKey: "createRecurringTask",
    label: "Create recurring task from selection",
    description: "Create a recurring task based on the current editor block.",
    defaultHotkey: "Ctrl+Shift+R",
    context: "Editor",
  },
  {
    id: "quickCompleteNextTask",
    langKey: "quickCompleteNextTask",
    label: "Quick complete next task",
    description: "Marks the most overdue task as complete.",
    defaultHotkey: "Ctrl+Shift+D",
    context: "Global",
  },
  {
    id: "toggleTaskStatus",
    langKey: "toggleTaskStatus",
    label: "Toggle task status",
    description: "Cycle the status of the focused task.",
    defaultHotkey: "Ctrl+Shift+X",
    context: "Task focus",
  },
  {
    id: "openTaskEditor",
    langKey: "openTaskEditor",
    label: "Open task editor",
    description: "Open the full task editor modal.",
    defaultHotkey: "Ctrl+Shift+E",
    context: "Global",
  },
  {
    id: "createTaskFromBlock",
    langKey: "createTaskFromBlock",
    label: "Create or Edit Task from Block",
    description: "Parse current block as inline task and open editor with pre-populated data.",
    defaultHotkey: "Ctrl+Shift+I",
    context: "Editor / Block",
  },
];

export type ShortcutSettings = Record<ShortcutId, string>;

export const DEFAULT_SHORTCUT_SETTINGS: ShortcutSettings = SHORTCUT_DEFINITIONS.reduce(
  (acc, definition) => {
    acc[definition.id] = definition.defaultHotkey;
    return acc;
  },
  {} as ShortcutSettings
);
