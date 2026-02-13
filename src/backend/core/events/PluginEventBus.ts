import type { Task } from "@backend/core/models/Task";
import * as logger from "@backend/logging/logger";

type PluginEventMap = {
  'task:create': { 
    source: string;
    suggestedName?: string;
    linkedBlockId?: string;
    linkedBlockContent?: string;
    suggestedTime?: string | null;
  };
  'task:complete': { taskId: string };
  'task:snooze': { taskId: string; minutes: number };
  'task:settings': { action?: string };
  'task:refresh': void;
  'task:updated': { taskId: string };
  'task:saved': { task: Task; isNew: boolean };
  'task:edit': { task?: Task };
  'editor:open': { mode: 'create' | 'edit'; taskId?: string; prefill?: Partial<Task> };
};

type EventHandler<T> = (data: T) => void;

export class PluginEventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic event handler storage
  private handlers: Map<string, Set<EventHandler<unknown>>> = new Map();

  /**
   * Register a handler for a plugin event.
   */
  on<K extends keyof PluginEventMap>(event: K, handler: EventHandler<PluginEventMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler<unknown>);
    return () => this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  /**
   * Emit a plugin event with payload.
   */
  emit<K extends keyof PluginEventMap>(event: K, data: PluginEventMap[K]): void {
    this.handlers.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        logger.error(`PluginEventBus handler error for "${String(event)}"`, err);
      }
    });
  }

  /**
   * Clear all registered handlers.
   */
  clear(): void {
    this.handlers.clear();
  }
}

export const pluginEventBus = new PluginEventBus();
