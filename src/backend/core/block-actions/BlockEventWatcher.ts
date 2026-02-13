// @ts-nocheck
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskRepository";
import type { BlockActionEngine } from "@backend/core/block-actions/BlockActionEngine";
import type { BlockEvent } from "@backend/core/block-actions/BlockActionTypes";
import type { BlockActionSettings } from "@backend/core/settings/PluginSettings";
import * as logger from "@backend/logging/logger";

interface BlockEventWatcherOptions {
  engine: BlockActionEngine;
  repository: TaskRepositoryProvider;
  settingsProvider: () => BlockActionSettings;
}

export class BlockEventWatcher {
  private observers = new Map<string, MutationObserver>();
  private removalObserver: MutationObserver | null = null;
  private contentCache = new Map<string, string>();
  private debounceTimers = new Map<string, number>();
  private linkedBlockIds = new Set<string>();
  private active = false;

  constructor(private options: BlockEventWatcherOptions) {}

  start(): void {
    if (this.active) return;
    this.active = true;
    this.refreshLinkedBlocks();
  }

  stop(): void {
    this.active = false;
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
    this.removalObserver?.disconnect();
    this.removalObserver = null;
    this.linkedBlockIds.clear();
    this.contentCache.clear();
  }

  refreshLinkedBlocks(): void {
    if (!this.active) return;
    const settings = this.options.settingsProvider();
    if (!settings.enabled) {
      this.clearObservers();
      this.removalObserver?.disconnect();
      this.removalObserver = null;
      return;
    }

    if (!this.removalObserver) {
      this.startRemovalObserver();
    }

    const linkedBlockIds = new Set(
      this.options.repository
        .getAllTasks()
        .filter((task) =>
          task.linkedBlockId &&
          task.blockActions?.some((action) => action.enabled)
        )
        .map((task) => task.linkedBlockId as string)
    );

    // Remove observers for blocks no longer needed
    for (const blockId of this.linkedBlockIds) {
      if (!linkedBlockIds.has(blockId)) {
        this.observers.get(blockId)?.disconnect();
        this.observers.delete(blockId);
        this.contentCache.delete(blockId);
      }
    }

    this.linkedBlockIds = linkedBlockIds;

    for (const blockId of linkedBlockIds) {
      if (!this.observers.has(blockId)) {
        this.attachObserver(blockId);
      }
    }
  }

  notifyBlockMoved(event: Omit<BlockEvent, "type">): void {
    if (!this.active) return;
    const movedEvent: BlockEvent = {
      type: "moved",
      ...event,
    };
    this.options.engine.handleBlockEvent(movedEvent).catch((error) => {
      logger.error("Failed to handle block moved event", error);
    });
  }

  notifyBlockCollapsed(blockId: string, collapsed: boolean): void {
    if (!this.active) return;
    const event: BlockEvent = {
      type: "collapsed",
      blockId,
      collapsed,
      timestamp: new Date().toISOString(),
    };
    this.options.engine.handleBlockEvent(event).catch((error) => {
      logger.error("Failed to handle block collapsed event", error);
    });
  }

  private attachObserver(blockId: string): void {
    const element = document.querySelector(`[data-node-id="${blockId}"]`);
    if (!element) {
      return;
    }

    const observer = new MutationObserver(() => {
      const content = element.textContent ?? "";
      this.handleContentChange(blockId, content);
    });

    observer.observe(element, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    this.observers.set(blockId, observer);
    this.contentCache.set(blockId, element.textContent ?? "");
  }

  private handleContentChange(blockId: string, content: string): void {
    const settings = this.options.settingsProvider();
    if (!settings.enabled) return;

    const previous = this.contentCache.get(blockId) ?? "";
    if (previous === content) return;

    const debounceMs = settings.debounceMs ?? 250;
    const existing = this.debounceTimers.get(blockId);
    if (existing) {
      clearTimeout(existing);
    }

    const timeoutId = globalThis.setTimeout(() => {
      this.contentCache.set(blockId, content);
      const event: BlockEvent = {
        type: "contentChanged",
        blockId,
        content,
        previousContent: previous,
        timestamp: new Date().toISOString(),
        source: "editor",
      };
      this.options.engine.handleBlockEvent(event).catch((error) => {
        logger.error("Failed to handle content changed event", error);
      });
      this.debounceTimers.delete(blockId);
    }, debounceMs);

    this.debounceTimers.set(blockId, timeoutId);
  }

  private startRemovalObserver(): void {
    if (this.removalObserver) return;
    this.removalObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.removedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          const blockId = node.getAttribute("data-node-id");
          if (blockId && this.linkedBlockIds.has(blockId)) {
            logger.info("Linked block removed from DOM", { blockId });
            this.handleBlockDeleted(blockId);
          }
          node
            .querySelectorAll?.("[data-node-id]")
            .forEach((child) => {
              const childId = child.getAttribute("data-node-id");
              if (childId && this.linkedBlockIds.has(childId)) {
                logger.info("Linked block removed from DOM", { blockId: childId });
                this.handleBlockDeleted(childId);
              }
            });
        });
      }
    });

    this.removalObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private handleBlockDeleted(blockId: string): void {
    const event: BlockEvent = {
      type: "deleted",
      blockId,
      timestamp: new Date().toISOString(),
      source: "editor",
    };
    this.options.engine.handleBlockEvent(event).catch((error) => {
      logger.error("Failed to handle block deleted event", error);
    });
    this.observers.get(blockId)?.disconnect();
    this.observers.delete(blockId);
    this.contentCache.delete(blockId);
  }

  private clearObservers(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
    this.contentCache.clear();
    this.linkedBlockIds.clear();
  }
}
