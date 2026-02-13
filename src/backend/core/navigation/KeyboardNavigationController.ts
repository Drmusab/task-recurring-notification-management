/**
 * Keyboard Navigation Controller - Vim-like navigation for task dashboard
 */

export type NavigationMode = 'normal' | 'insert' | 'visual' | 'command';

export interface KeyboardEvent {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/**
 * Keyboard Navigation Controller for Vim-style task navigation
 */
export class KeyboardNavigationController {
  private mode: NavigationMode = 'normal';
  private selectedTaskIndex = 0;
  private visualSelectionStart?: number;
  private commandBuffer = '';
  private keySequence = '';
  private lastKeyTime = 0;
  private listeners = new Map<string, Set<Function>>();
  private maxTaskIndex = 0;

  /**
   * Handle keyboard event and execute appropriate action
   */
  handleKey(event: KeyboardEvent): boolean {
    const now = Date.now();
    
    // Reset key sequence if too much time has passed (500ms)
    if (now - this.lastKeyTime > 500) {
      this.keySequence = '';
    }
    this.lastKeyTime = now;

    // Build key sequence
    let keyString = '';
    if (event.ctrlKey) keyString += 'Ctrl+';
    if (event.altKey) keyString += 'Alt+';
    if (event.shiftKey && event.key.length > 1) keyString += 'Shift+';
    keyString += event.key;

    this.keySequence += keyString;

    // Handle command mode differently
    if (this.mode === 'command') {
      return this.handleCommandModeKey(event);
    }

    // Try to match against keybindings
    const action = this.matchKeybinding(this.keySequence);

    if (action === 'partial') {
      // Waiting for more keys in sequence
      return true;
    }

    if (action) {
      this.executeAction(action);
      this.keySequence = '';
      return true;
    }

    // No match, reset sequence
    this.keySequence = '';
    return false;
  }

  /**
   * Set the maximum task index for navigation
   */
  setMaxTaskIndex(max: number): void {
    this.maxTaskIndex = max;
    if (this.selectedTaskIndex >= max) {
      this.selectedTaskIndex = Math.max(0, max - 1);
    }
  }

  /**
   * Get current state
   */
  getState(): {
    mode: NavigationMode;
    selectedIndex: number;
    commandBuffer: string;
    visualSelection?: { start: number; end: number };
  } {
    return {
      mode: this.mode,
      selectedIndex: this.selectedTaskIndex,
      commandBuffer: this.commandBuffer,
      visualSelection: this.visualSelectionStart !== undefined
        ? { start: this.visualSelectionStart, end: this.selectedTaskIndex }
        : undefined
    };
  }

  /**
   * Subscribe to events
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  // Mode switching
  enterNormalMode(): void {
    this.mode = 'normal';
    this.visualSelectionStart = undefined;
    this.commandBuffer = '';
    this.emit('modeChange', 'normal');
  }

  enterInsertMode(): void {
    this.mode = 'insert';
    this.emit('modeChange', 'insert');
    this.emit('action', { type: 'editTask', index: this.selectedTaskIndex });
  }

  enterVisualMode(): void {
    this.mode = 'visual';
    this.visualSelectionStart = this.selectedTaskIndex;
    this.emit('modeChange', 'visual');
  }

  enterCommandMode(): void {
    this.mode = 'command';
    this.commandBuffer = '';
    this.emit('modeChange', 'command');
  }

  // Navigation
  moveUp(count: number = 1): void {
    this.selectedTaskIndex = Math.max(0, this.selectedTaskIndex - count);
    this.emit('selectionChange', this.selectedTaskIndex);
  }

  moveDown(count: number = 1): void {
    this.selectedTaskIndex = Math.min(this.maxTaskIndex - 1, this.selectedTaskIndex + count);
    this.emit('selectionChange', this.selectedTaskIndex);
  }

  moveToTop(): void {
    this.selectedTaskIndex = 0;
    this.emit('selectionChange', this.selectedTaskIndex);
  }

  moveToBottom(): void {
    this.selectedTaskIndex = Math.max(0, this.maxTaskIndex - 1);
    this.emit('selectionChange', this.selectedTaskIndex);
  }

  // Task actions
  toggleComplete(): void {
    this.emit('action', { type: 'toggleComplete', index: this.selectedTaskIndex });
  }

  editTask(): void {
    this.emit('action', { type: 'editTask', index: this.selectedTaskIndex });
  }

  deleteTask(): void {
    this.emit('action', { type: 'deleteTask', index: this.selectedTaskIndex });
  }

  duplicateTask(): void {
    this.emit('action', { type: 'duplicateTask', index: this.selectedTaskIndex });
  }

  postponeTask(days: number): void {
    this.emit('action', { type: 'postponeTask', index: this.selectedTaskIndex, days });
  }

  // Tab navigation
  switchTab(direction: 'next' | 'prev'): void {
    this.emit('action', { type: 'switchTab', direction });
  }

  goToTab(index: number): void {
    this.emit('action', { type: 'goToTab', index });
  }

  /**
   * Match key sequence against keybindings
   */
  private matchKeybinding(sequence: string): string | 'partial' | null {
    const bindings = this.getKeybindings();

    // Exact match
    if (bindings.has(sequence)) {
      return bindings.get(sequence)!;
    }

    // Check for partial match (waiting for more keys)
    for (const [binding] of bindings.entries()) {
      if (binding.startsWith(sequence) && binding.length > sequence.length) {
        return 'partial';
      }
    }

    return null;
  }

  /**
   * Execute action by name
   */
  private executeAction(action: string): void {
    switch (action) {
      case 'moveDown':
        this.moveDown();
        break;
      case 'moveUp':
        this.moveUp();
        break;
      case 'moveToTop':
        this.moveToTop();
        break;
      case 'moveToBottom':
        this.moveToBottom();
        break;
      case 'toggleComplete':
        this.toggleComplete();
        break;
      case 'editTask':
        this.editTask();
        break;
      case 'deleteTask':
        this.deleteTask();
        break;
      case 'duplicateTask':
        this.duplicateTask();
        break;
      case 'enterInsertMode':
        this.enterInsertMode();
        break;
      case 'enterVisualMode':
        this.enterVisualMode();
        break;
      case 'enterCommandMode':
        this.enterCommandMode();
        break;
      case 'exitMode':
        this.enterNormalMode();
        break;
      case 'postpone1Day':
        this.postponeTask(1);
        break;
      case 'postpone1Week':
        this.postponeTask(7);
        break;
      case 'nextTab':
        this.switchTab('next');
        break;
      case 'prevTab':
        this.switchTab('prev');
        break;
      default:
        // Handle goToTab1-9
        if (action.startsWith('goToTab')) {
          const tabIndex = parseInt(action.replace('goToTab', ''));
          this.goToTab(tabIndex - 1);
        }
        break;
    }
  }

  /**
   * Handle keys in command mode
   */
  private handleCommandModeKey(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      this.enterNormalMode();
      return true;
    }

    if (event.key === 'Enter') {
      this.emit('action', { type: 'executeCommand', command: this.commandBuffer });
      this.enterNormalMode();
      return true;
    }

    if (event.key === 'Backspace') {
      this.commandBuffer = this.commandBuffer.slice(0, -1);
      this.emit('commandBufferChange', this.commandBuffer);
      return true;
    }

    if (event.key.length === 1) {
      this.commandBuffer += event.key;
      this.emit('commandBufferChange', this.commandBuffer);
      return true;
    }

    return false;
  }

  /**
   * Get keybindings map
   */
  private getKeybindings(): Map<string, string> {
    return new Map([
      // Navigation
      ['j', 'moveDown'],
      ['k', 'moveUp'],
      ['gg', 'moveToTop'],
      ['G', 'moveToBottom'],

      // Task actions
      ['x', 'toggleComplete'],
      ['dd', 'deleteTask'],
      ['yy', 'duplicateTask'],
      ['i', 'enterInsertMode'],

      // Mode switching
      ['v', 'enterVisualMode'],
      [':', 'enterCommandMode'],
      ['Escape', 'exitMode'],

      // Quick actions
      ['p', 'postpone1Day'],
      ['P', 'postpone1Week'],

      // Tab navigation
      ['gt', 'nextTab'],
      ['gT', 'prevTab'],
      ['1gt', 'goToTab1'],
      ['2gt', 'goToTab2'],
      ['3gt', 'goToTab3'],
      ['4gt', 'goToTab4'],
      ['5gt', 'goToTab5'],
    ]);
  }
}
