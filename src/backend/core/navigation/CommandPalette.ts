/**
 * Command Palette - Vim-style command mode
 */

import type { Task } from '@backend/core/models/Task';

export interface Command {
  execute: (args: string[]) => Promise<void> | void;
  autocomplete: string[];
  description?: string;
}

/**
 * Command Palette for executing commands in command mode
 */
export class CommandPalette {
  private commands: Map<string, Command> = new Map();
  private commandCallbacks: Map<string, Function> = new Map();

  constructor() {
    this.registerDefaultCommands();
  }

  /**
   * Register command callback handlers
   */
  setCommandCallback(name: string, callback: Function): void {
    this.commandCallbacks.set(name, callback);
  }

  /**
   * Execute a command line
   */
  async executeCommand(commandLine: string): Promise<void> {
    const trimmed = commandLine.trim();
    if (!trimmed) return;

    const [cmd, ...args] = trimmed.split(/\s+/);
    const command = this.commands.get(cmd);

    if (!command) {
      throw new Error(`Unknown command: ${cmd}`);
    }

    await command.execute(args);
  }

  /**
   * Get autocomplete suggestions for partial command
   */
  autocomplete(partial: string): string[] {
    const suggestions: string[] = [];

    // If no space, suggest command names
    if (!partial.includes(' ')) {
      for (const [cmdName] of this.commands.entries()) {
        if (cmdName.startsWith(partial)) {
          suggestions.push(cmdName);
        }
      }
      return suggestions;
    }

    // If space, suggest command-specific autocomplete
    const [cmd, ...argParts] = partial.split(/\s+/);
    const command = this.commands.get(cmd);

    if (command && command.autocomplete.length > 0) {
      const lastArg = argParts[argParts.length - 1] || '';
      for (const option of command.autocomplete) {
        if (option.startsWith(lastArg)) {
          suggestions.push(`${cmd} ${option}`);
        }
      }
    }

    return suggestions;
  }

  /**
   * Get all available commands
   */
  getCommands(): Array<{ name: string; description: string }> {
    const result: Array<{ name: string; description: string }> = [];

    for (const [name, cmd] of this.commands.entries()) {
      result.push({
        name,
        description: cmd.description || ''
      });
    }

    return result;
  }

  /**
   * Register default commands
   */
  private registerDefaultCommands(): void {
    this.commands.set('sort', {
      execute: async (args) => {
        const callback = this.commandCallbacks.get('sort');
        if (callback) {
          callback(args[0] || 'due');
        }
      },
      autocomplete: ['due', 'priority', 'created', 'modified', 'name'],
      description: 'Sort tasks by field'
    });

    this.commands.set('filter', {
      execute: async (args) => {
        const callback = this.commandCallbacks.get('filter');
        if (callback) {
          callback(args.join(' '));
        }
      },
      autocomplete: ['priority:high', 'priority:medium', 'priority:low', 'status:todo', 'status:done', 'tag:'],
      description: 'Filter tasks'
    });

    this.commands.set('goto', {
      execute: async (args) => {
        const callback = this.commandCallbacks.get('goto');
        if (callback) {
          callback(args.join(' '));
        }
      },
      autocomplete: [],
      description: 'Go to task by name'
    });

    this.commands.set('export', {
      execute: async (args) => {
        const callback = this.commandCallbacks.get('export');
        if (callback) {
          callback(args[0] || 'json');
        }
      },
      autocomplete: ['json', 'csv', 'markdown'],
      description: 'Export tasks'
    });

    this.commands.set('help', {
      execute: async () => {
        const callback = this.commandCallbacks.get('help');
        if (callback) {
          callback();
        }
      },
      autocomplete: [],
      description: 'Show help'
    });

    this.commands.set('clear', {
      execute: async () => {
        const callback = this.commandCallbacks.get('clear');
        if (callback) {
          callback();
        }
      },
      autocomplete: [],
      description: 'Clear all filters'
    });

    this.commands.set('tab', {
      execute: async (args) => {
        const callback = this.commandCallbacks.get('tab');
        if (callback) {
          callback(args[0]);
        }
      },
      autocomplete: ['today', 'upcoming', 'done', 'all', 'timeline', 'analytics', 'insights'],
      description: 'Switch to tab'
    });
  }
}
