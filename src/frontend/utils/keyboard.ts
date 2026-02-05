/**
 * Keyboard Handler Utility
 * Helper functions for keyboard event handling
 */

/**
 * Get human-readable key display name
 */
export function getKeyDisplayName(key: string): string {
  const displayNames: Record<string, string> = {
    'Ctrl': 'Ctrl',
    'Control': 'Ctrl',
    'Shift': 'Shift',
    'Alt': 'Alt',
    'Meta': '⌘',
    'Cmd': '⌘',
    'Command': '⌘',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Enter': '↵',
    'Escape': 'Esc',
    'Backspace': '⌫',
    'Delete': 'Del',
    'Tab': '⇥',
    ' ': 'Space'
  };
  
  return displayNames[key] || key;
}

/**
 * Format key combination for display
 */
export function formatKeyCombo(keys: string[]): string {
  return keys.map(getKeyDisplayName).join('+');
}

/**
 * Check if a key event matches a modifier-only state
 */
export function isModifierKey(key: string): boolean {
  return ['Control', 'Shift', 'Alt', 'Meta', 'Cmd'].includes(key);
}

/**
 * Extract keys from a keyboard event
 */
export function extractKeys(event: KeyboardEvent): string[] {
  const keys: string[] = [];
  
  if (event.ctrlKey) keys.push('Ctrl');
  if (event.shiftKey) keys.push('Shift');
  if (event.altKey) keys.push('Alt');
  if (event.metaKey) keys.push('Cmd');
  
  if (event.key && !isModifierKey(event.key)) {
    keys.push(event.key);
  }
  
  return keys;
}

/**
 * Check if we should ignore keyboard events (e.g., when typing in input)
 */
export function shouldIgnoreKeyEvent(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  
  if (!target) return false;
  
  const tagName = target.tagName?.toUpperCase() || '';
  const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA';
  const isContentEditable = target.isContentEditable || false;
  
  return isInput || isContentEditable;
}

/**
 * Debounce keyboard event to prevent rapid firing
 */
export function debounceKeyEvent(
  callback: (event: KeyboardEvent) => void,
  delay: number = 100
): (event: KeyboardEvent) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (event: KeyboardEvent) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      callback(event);
      timeoutId = null;
    }, delay);
  };
}
