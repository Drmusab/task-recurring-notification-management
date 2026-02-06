// @ts-nocheck
/**
 * Keyboard shortcuts store for managing custom keybindings
 */
import { writable, get } from 'svelte/store';

interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  category: 'navigation' | 'editing' | 'bulk' | 'global' | 'other';
  default?: string[]; // Default key combination for reset
}

type ShortcutMap = Record<string, KeyboardShortcut>;

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  'navigate.next': {
    id: 'navigate.next',
    keys: ['ArrowDown'],
    default: ['ArrowDown'],
    description: 'Navigate to next task',
    category: 'navigation',
  },
  'navigate.prev': {
    id: 'navigate.prev',
    keys: ['ArrowUp'],
    default: ['ArrowUp'],
    description: 'Navigate to previous task',
    category: 'navigation',
  },
  'navigate.first': {
    id: 'navigate.first',
    keys: ['Ctrl', 'Home'],
    default: ['Ctrl', 'Home'],
    description: 'Navigate to first task',
    category: 'navigation',
  },
  'navigate.last': {
    id: 'navigate.last',
    keys: ['Ctrl', 'End'],
    default: ['Ctrl', 'End'],
    description: 'Navigate to last task',
    category: 'navigation',
  },
  'edit.complete': {
    id: 'edit.complete',
    keys: ['Ctrl', 'Enter'],
    default: ['Ctrl', 'Enter'],
    description: 'Mark task as complete',
    category: 'editing',
  },
  'edit.new': {
    id: 'edit.new',
    keys: ['Ctrl', 'N'],
    default: ['Ctrl', 'N'],
    description: 'Create new task',
    category: 'editing',
  },
  'edit.delete': {
    id: 'edit.delete',
    keys: ['Delete'],
    default: ['Delete'],
    description: 'Delete selected task',
    category: 'editing',
  },
  'edit.editTask': {
    id: 'edit.editTask',
    keys: ['Ctrl', 'E'],
    default: ['Ctrl', 'E'],
    description: 'Edit selected task',
    category: 'editing',
  },
  'edit.createTask': {
    id: 'edit.createTask',
    keys: ['Ctrl', 'Shift', 'N'],
    default: ['Ctrl', 'Shift', 'N'],
    description: 'Create new task (alternative)',
    category: 'editing',
  },
  'bulk.select': {
    id: 'bulk.select',
    keys: ['Ctrl', 'Shift', 'B'],
    default: ['Ctrl', 'Shift', 'B'],
    description: 'Enter bulk selection mode',
    category: 'bulk',
  },
  'global.search': {
    id: 'global.search',
    keys: ['Ctrl', 'K'],
    default: ['Ctrl', 'K'],
    description: 'Open global search',
    category: 'global',
  },
};

interface ActionRegistry {
  [key: string]: () => void;
}

const actionRegistry: ActionRegistry = {};

const createKeyboardShortcutsStore = () => {
  const { subscribe, set, update } = writable<ShortcutMap>(DEFAULT_SHORTCUTS);

  return {
    subscribe,
    updateShortcut: (id: string, keys: string[]) => {
      const shortcuts = get(keyboardShortcutsStore);
      
      // Check for conflicts (excluding the shortcut being updated)
      // Normalize keys to lowercase for comparison
      const keyCombo = keys.map(k => k.toLowerCase()).join('+');
      const conflict = Object.values(shortcuts).find(
        s => s.id !== id && s.keys.map(k => k.toLowerCase()).join('+') === keyCombo
      );
      
      if (conflict) {
        return { 
          success: false, 
          error: `Conflicts with ${conflict.id}: ${conflict.description}` 
        };
      }
      
      // Update the shortcut
      update(shortcuts => ({
        ...shortcuts,
        [id]: { ...shortcuts[id], keys },
      }));
      
      // Auto-persist to localStorage
      const updatedShortcuts = get(keyboardShortcutsStore);
      localStorage.setItem('keyboard-shortcuts', JSON.stringify(updatedShortcuts));
      
      return { success: true, error: undefined };
    },
    resetShortcut: (id: string) => update(shortcuts => ({
      ...shortcuts,
      [id]: DEFAULT_SHORTCUTS[id],
    })),
    resetAll: () => set(DEFAULT_SHORTCUTS),
    findConflict: (keys: string[], excludeId?: string) => {
      const shortcuts = get(keyboardShortcutsStore);
      const keyCombo = keys.join('+').toLowerCase();
      const conflict = Object.values(shortcuts).find(
        s => s.id !== excludeId && s.keys.join('+').toLowerCase() === keyCombo
      );
      return conflict || null;
    },
    persist: () => {
      // Persist to localStorage
      const shortcuts = get(keyboardShortcutsStore);
      localStorage.setItem('keyboard-shortcuts', JSON.stringify(shortcuts));
    },
    load: () => {
      const saved = localStorage.getItem('keyboard-shortcuts');
      if (saved) {
        try {
          set(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load keyboard shortcuts', e);
          // Reset to defaults on parse error
          set(DEFAULT_SHORTCUTS);
        }
      }
    },
    registerAction: (id: string, action: () => void) => {
      actionRegistry[id] = action;
    },
    unregisterAction: (id: string) => {
      delete actionRegistry[id];
    },
    executeAction: (id: string) => {
      const action = actionRegistry[id];
      if (action) {
        action();
      }
    },
  };
};

export const keyboardShortcutsStore = createKeyboardShortcutsStore();
