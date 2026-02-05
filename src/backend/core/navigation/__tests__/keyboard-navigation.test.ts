/**
 * Tests for KeyboardNavigationController
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KeyboardNavigationController } from "@backend/core/navigation/KeyboardNavigationController";

describe('KeyboardNavigationController', () => {
  let controller: KeyboardNavigationController;

  beforeEach(() => {
    controller = new KeyboardNavigationController();
    controller.setMaxTaskIndex(10);
  });

  describe('mode switching', () => {
    it('should start in normal mode', () => {
      const state = controller.getState();
      expect(state.mode).toBe('normal');
    });

    it('should switch to insert mode on "i" key', () => {
      let modeChanged = false;
      controller.on('modeChange', (mode: string) => {
        if (mode === 'insert') modeChanged = true;
      });

      controller.handleKey({ key: 'i', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(controller.getState().mode).toBe('insert');
      expect(modeChanged).toBe(true);
    });

    it('should switch to visual mode on "v" key', () => {
      controller.handleKey({ key: 'v', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(controller.getState().mode).toBe('visual');
    });

    it('should switch to command mode on ":" key', () => {
      controller.handleKey({ key: ':', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(controller.getState().mode).toBe('command');
    });

    it('should return to normal mode on Escape', () => {
      controller.enterCommandMode();
      controller.handleKey({ key: 'Escape', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(controller.getState().mode).toBe('normal');
    });
  });

  describe('navigation', () => {
    it('should move down on "j" key', () => {
      let selectionChanged = false;
      controller.on('selectionChange', (index: number) => {
        if (index === 1) selectionChanged = true;
      });

      controller.handleKey({ key: 'j', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(controller.getState().selectedIndex).toBe(1);
      expect(selectionChanged).toBe(true);
    });

    it('should move up on "k" key', () => {
      controller.setMaxTaskIndex(10);
      controller.handleKey({ key: 'j', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'j', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      controller.handleKey({ key: 'k', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(controller.getState().selectedIndex).toBe(1);
    });

    it('should not move above 0', () => {
      controller.handleKey({ key: 'k', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(controller.getState().selectedIndex).toBe(0);
    });

    it('should not move below max index', () => {
      controller.setMaxTaskIndex(5);
      for (let i = 0; i < 10; i++) {
        controller.handleKey({ key: 'j', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      }

      expect(controller.getState().selectedIndex).toBe(4);
    });

    it('should jump to top on "gg"', () => {
      controller.handleKey({ key: 'j', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'j', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      controller.handleKey({ key: 'g', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'g', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(controller.getState().selectedIndex).toBe(0);
    });

    it('should jump to bottom on "G"', () => {
      controller.setMaxTaskIndex(10);

      controller.handleKey({ key: 'G', ctrlKey: false, shiftKey: true, altKey: false, metaKey: false });

      expect(controller.getState().selectedIndex).toBe(9);
    });
  });

  describe('task actions', () => {
    it('should emit toggleComplete action on "x" key', () => {
      let actionEmitted = false;
      controller.on('action', (action: any) => {
        if (action.type === 'toggleComplete') actionEmitted = true;
      });

      controller.handleKey({ key: 'x', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(actionEmitted).toBe(true);
    });

    it('should emit deleteTask action on "dd"', () => {
      let actionEmitted = false;
      controller.on('action', (action: any) => {
        if (action.type === 'deleteTask') actionEmitted = true;
      });

      controller.handleKey({ key: 'd', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'd', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(actionEmitted).toBe(true);
    });

    it('should emit duplicateTask action on "yy"', () => {
      let actionEmitted = false;
      controller.on('action', (action: any) => {
        if (action.type === 'duplicateTask') actionEmitted = true;
      });

      controller.handleKey({ key: 'y', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'y', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(actionEmitted).toBe(true);
    });
  });

  describe('key sequence handling', () => {
    it('should wait for second key in multi-key sequence', () => {
      const result = controller.handleKey({ key: 'g', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(result).toBe(true); // Consumed, waiting for next key
    });

    it('should reset sequence after timeout', (done) => {
      controller.handleKey({ key: 'g', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      setTimeout(() => {
        // After timeout, 'g' should not be part of 'gg' sequence
        controller.handleKey({ key: 'g', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
        
        // Should still be waiting for second 'g', not at top
        expect(controller.getState().selectedIndex).not.toBe(0);
        done();
      }, 600);
    });
  });

  describe('command mode', () => {
    beforeEach(() => {
      controller.enterCommandMode();
    });

    it('should build command buffer as keys are pressed', () => {
      controller.handleKey({ key: 's', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'o', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'r', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 't', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(controller.getState().commandBuffer).toBe('sort');
    });

    it('should handle backspace in command mode', () => {
      controller.handleKey({ key: 't', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'e', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 's', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 't', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      controller.handleKey({ key: 'Backspace', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(controller.getState().commandBuffer).toBe('tes');
    });

    it('should execute command on Enter', () => {
      let commandExecuted = false;
      controller.on('action', (action: any) => {
        if (action.type === 'executeCommand' && action.command === 'help') {
          commandExecuted = true;
        }
      });

      controller.handleKey({ key: 'h', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'e', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'l', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'p', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'Enter', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(commandExecuted).toBe(true);
      expect(controller.getState().mode).toBe('normal');
    });
  });

  describe('visual mode', () => {
    it('should track visual selection', () => {
      controller.enterVisualMode();

      controller.handleKey({ key: 'j', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'j', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      const state = controller.getState();
      expect(state.visualSelection).toBeDefined();
      expect(state.visualSelection?.start).toBe(0);
      expect(state.visualSelection?.end).toBe(2);
    });

    it('should clear visual selection when exiting visual mode', () => {
      controller.enterVisualMode();
      controller.handleKey({ key: 'j', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      controller.enterNormalMode();

      expect(controller.getState().visualSelection).toBeUndefined();
    });
  });

  describe('tab navigation', () => {
    it('should emit switchTab action on "gt"', () => {
      let actionEmitted = false;
      controller.on('action', (action: any) => {
        if (action.type === 'switchTab' && action.direction === 'next') {
          actionEmitted = true;
        }
      });

      controller.handleKey({ key: 'g', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 't', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(actionEmitted).toBe(true);
    });

    it('should emit goToTab action on "1gt"', () => {
      let actionEmitted = false;
      controller.on('action', (action: any) => {
        if (action.type === 'goToTab' && action.index === 0) {
          actionEmitted = true;
        }
      });

      controller.handleKey({ key: '1', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 'g', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });
      controller.handleKey({ key: 't', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false });

      expect(actionEmitted).toBe(true);
    });
  });
});
