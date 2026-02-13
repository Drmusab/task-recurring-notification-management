/**
 * Default Keybindings - Vim-inspired keyboard shortcuts
 */

export const DEFAULT_KEYBINDINGS = {
  // Normal mode navigation
  'j': 'moveDown',
  'k': 'moveUp',
  'gg': 'moveToTop',
  'G': 'moveToBottom',
  'h': 'collapseTask',
  'l': 'expandTask',

  // Task manipulation
  'x': 'toggleComplete',
  'dd': 'deleteTask',
  'yy': 'duplicateTask',
  'i': 'enterInsertMode',
  'a': 'appendTask',
  'o': 'createTaskBelow',
  'O': 'createTaskAbove',

  // Tab switching
  'gt': 'nextTab',
  'gT': 'prevTab',
  '1gt': 'goToTab1',
  '2gt': 'goToTab2',
  '3gt': 'goToTab3',
  '4gt': 'goToTab4',
  '5gt': 'goToTab5',
  '6gt': 'goToTab6',
  '7gt': 'goToTab7',
  '8gt': 'goToTab8',
  '9gt': 'goToTab9',

  // Search
  '/': 'startSearch',
  'n': 'nextSearchResult',
  'N': 'prevSearchResult',

  // Visual mode
  'v': 'enterVisualMode',
  'V': 'enterVisualLineMode',

  // Command mode
  ':': 'enterCommandMode',

  // Quick actions
  'p': 'postpone1Day',
  'P': 'postpone1Week',
  'u': 'undo',
  'Ctrl+r': 'redo',

  // Filters
  'fp': 'filterPriority',
  'ft': 'filterToday',
  'fo': 'filterOverdue',
  'fc': 'clearFilters',

  // Escape
  'Escape': 'exitMode',
} as const;

export type KeybindingAction = typeof DEFAULT_KEYBINDINGS[keyof typeof DEFAULT_KEYBINDINGS];

/**
 * Get description for a keybinding action
 */
export function getActionDescription(action: string): string {
  const descriptions: Record<string, string> = {
    moveDown: 'Move selection down',
    moveUp: 'Move selection up',
    moveToTop: 'Jump to top',
    moveToBottom: 'Jump to bottom',
    toggleComplete: 'Toggle task completion',
    deleteTask: 'Delete task',
    duplicateTask: 'Duplicate task',
    enterInsertMode: 'Edit task',
    enterVisualMode: 'Enter visual mode',
    enterCommandMode: 'Enter command mode',
    exitMode: 'Exit to normal mode',
    postpone1Day: 'Postpone 1 day',
    postpone1Week: 'Postpone 1 week',
    nextTab: 'Next tab',
    prevTab: 'Previous tab',
    startSearch: 'Start search',
    clearFilters: 'Clear filters',
  };

  return descriptions[action] || action;
}
