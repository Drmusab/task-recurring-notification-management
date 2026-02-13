export type ShortcutId =
  | "createRecurringTask"
  | "openRecurringTasksDock"
  | "quickAddTask"
  | "markTaskDone"
  | "postponeTask"
  | "quickCompleteNextTask"
  | "toggleTaskStatus"
  | "openTaskEditor"
  | "createTaskFromBlock"
  | "executeQuery"
  | "explainQuery"
  | "focusSearch"
  | "saveQuery"
  | "refreshTasks"
  | "showShortcutsHelp"
  | "toggleCalendar"
  | "closePanel";

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
  {
    id: "executeQuery",
    langKey: "executeQuery",
    label: "Execute Query",
    description: "Execute the current query in the query editor.",
    defaultHotkey: "Ctrl+Enter",
    context: "Query Editor",
  },
  {
    id: "explainQuery",
    langKey: "explainQuery",
    label: "Explain Query",
    description: "Show a detailed explanation of the current query.",
    defaultHotkey: "Ctrl+Shift+E",
    context: "Query Editor",
  },
  {
    id: "focusSearch",
    langKey: "focusSearch",
    label: "Focus Search",
    description: "Focus the search/query input field.",
    defaultHotkey: "Ctrl+F",
    context: "Global",
  },
  {
    id: "saveQuery",
    langKey: "saveQuery",
    label: "Save Query",
    description: "Save the current query to your saved queries.",
    defaultHotkey: "Ctrl+S",
    context: "Query Editor",
  },
  {
    id: "refreshTasks",
    langKey: "refreshTasks",
    label: "Refresh Tasks",
    description: "Reload all tasks from storage.",
    defaultHotkey: "Ctrl+R",
    context: "Global",
  },
  {
    id: "showShortcutsHelp",
    langKey: "showShortcutsHelp",
    label: "Show Keyboard Shortcuts",
    description: "Display the keyboard shortcuts help dialog.",
    defaultHotkey: "Shift+?",
    context: "Global",
  },
  {
    id: "toggleCalendar",
    langKey: "toggleCalendar",
    label: "Toggle Calendar View",
    description: "Switch to/from calendar view.",
    defaultHotkey: "Ctrl+Alt+C",
    context: "Global",
  },
  {
    id: "closePanel",
    langKey: "closePanel",
    label: "Close Panel",
    description: "Close the currently open panel or dialog.",
    defaultHotkey: "Escape",
    context: "Global",
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

/**
 * Get a shortcut definition by ID
 */
export function getShortcutDefinition(id: ShortcutId): ShortcutDefinition | undefined {
  return SHORTCUT_DEFINITIONS.find(def => def.id === id);
}

/**
 * Get all shortcut definitions
 */
export function getAllShortcutDefinitions(): ShortcutDefinition[] {
  return SHORTCUT_DEFINITIONS;
}

    return acc;
  },
  {} as ShortcutSettings
);
