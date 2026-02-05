import type { Plugin } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import type { TaskRepositoryProvider } from "@backend/core/storage/TaskRepository";
import type { SettingsService } from "@backend/core/settings/SettingsService";
import { QueryEngine } from "@backend/core/query/QueryEngine";
import { QueryParser } from "@backend/core/query/QueryParser";
import { QueryComposer } from "@backend/core/query/QueryComposer";
import { GlobalQuery } from "@backend/core/query/GlobalQuery";
import { pluginEventBus } from "@backend/core/events/PluginEventBus";
import * as logger from "@shared/utils/misc/logger";
import {
  InlineQueryBlockParser,
  type InlineQueryBlock,
  type InlineQueryView,
} from "@backend/core/inline-query/InlineQueryBlockParser";
import { InlineQueryCache } from "@backend/core/inline-query/InlineQueryCache";
import { InlineQueryRenderer } from "@backend/core/inline-query/InlineQueryRenderer";

interface InlineQueryBlockState {
  block: InlineQueryBlock;
  container: HTMLElement;
  renderLimit: number;
}

interface InlineQueryControllerOptions {
  plugin: Plugin;
  repository: TaskRepositoryProvider;
  settingsService: SettingsService;
  onEditTask: (task: Task) => void;
  onToggleTask: (taskId: string) => void;
  debounceMs?: number;
  pageSize?: number;
}

/**
 * InlineQueryController manages the lifecycle of inline query blocks in the editor.
 * It handles parsing, caching, rendering, and user interactions for task query results.
 */
export class InlineQueryController {
  private parser = new InlineQueryBlockParser();
  private renderer = new InlineQueryRenderer();
  private cache = new InlineQueryCache();
  private queryComposer = new QueryComposer(new QueryParser());
  private blocks = new Map<string, InlineQueryBlockState>();
  private refreshTimer?: number;
  private indexReady = false;
  private unsubs: Array<() => void> = [];
  private debounceMs: number;
  private pageSize: number;

  constructor(private options: InlineQueryControllerOptions) {
    this.debounceMs = options.debounceMs ?? 300;
    this.pageSize = options.pageSize ?? 50;
  }

  /**
   * Initializes the controller and sets up event listeners
   */
  mount(): void {
    this.refreshAll();
    const { plugin } = this.options;
    const onLoaded = () => this.scheduleRefresh();
    const onSwitch = () => this.scheduleRefresh();

    try {
      const unsubscribeLoaded = plugin.eventBus.on?.("loaded-protyle", onLoaded);
      const unsubscribeSwitch = plugin.eventBus.on?.("switch-protyle", onSwitch);
      if (typeof unsubscribeLoaded === "function") {
        this.unsubs.push(unsubscribeLoaded);
      }
      if (typeof unsubscribeSwitch === "function") {
        this.unsubs.push(unsubscribeSwitch);
      }
    } catch (error) {
      logger.warn("Inline query controller failed to bind protyle events", error);
    }

    this.unsubs.push(
      pluginEventBus.on("task:refresh", () => {
        this.cache.clear();
        this.scheduleRefresh();
      })
    );

    this.unsubs.push(
      pluginEventBus.on("task:settings", () => {
        this.cache.clear();
        this.scheduleRefresh();
      })
    );
  }

  /**
   * Cleans up resources and removes all event listeners
   */
  destroy(): void {
    if (this.refreshTimer) {
      globalThis.clearTimeout(this.refreshTimer);
    }
    this.blocks.forEach(({ container }) => container.remove());
    this.blocks.clear();
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
  }

  /**
   * Schedules a refresh of all query blocks with debouncing
   * Cancels any pending refresh and schedules a new one
   */
  scheduleRefresh(): void {
    if (this.refreshTimer) {
      globalThis.clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = globalThis.setTimeout(() => {
      this.refreshAll();
    }, this.debounceMs);
  }

  /**
   * Refreshes all inline query blocks in the current protyle instances
   * Parses blocks, executes queries, and renders results
   */
  refreshAll(): void {
    const roots = this.getProtyleRoots();
    if (roots.length === 0) {
      return;
    }

    if (!this.indexReady) {
      this.indexReady = true;
    }

    const seen = new Set<string>();
    roots.forEach((root) => {
      const blocks = this.parser.parse(root);
      blocks.forEach((block) => {
        seen.add(block.id);
        const state = this.getOrCreateBlockState(block);
        this.renderBlock(state);
      });
    });

    Array.from(this.blocks.keys()).forEach((id) => {
      if (!seen.has(id)) {
        const state = this.blocks.get(id);
        state?.container.remove();
        this.blocks.delete(id);
      }
    });

  }

  private renderBlock(state: InlineQueryBlockState): void {
    const { block } = state;
    const view = block.view ?? "list";

    if (!this.indexReady) {
      this.renderer.render(state.container, {
        query: block.query,
        view,
        isIndexing: true,
      });
      return;
    }

    let error: string | undefined;
    let result;
    try {
      result = this.executeQuery(block.query);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const renderedCount = result ? Math.min(state.renderLimit, result.tasks.length) : 0;

    this.renderer.render(state.container, {
      query: block.query,
      view,
      result,
      error,
      maxItems: state.renderLimit,
      renderedCount,
    });
  }

  private executeQuery(queryText: string) {
    const settings = this.options.settingsService.get();
    const settingsHash = this.buildSettingsHash(settings);
    const cacheKey = this.cache.buildKey(queryText, settingsHash);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.result;
    }

    const taskIndex = {
      getAllTasks: () => this.options.repository.getAllTasks(),
    };
    const engine = new QueryEngine(taskIndex, {
      urgencySettings: settings.urgency,
      escalationSettings: settings.escalation,
      attentionSettings: settings.attention,
    });
    const globalQuery = GlobalQuery.getInstance();
    if (globalQuery.isEnabled() && globalQuery.getError()) {
      throw new Error(`Global query error: ${globalQuery.getError()}`);
    }
    const ast = this.queryComposer.compose(queryText, globalQuery.getAST()).ast;
    const result = engine.execute(ast);
    this.cache.set(cacheKey, result);
    return result;
  }

  private buildSettingsHash(settings: unknown): string {
    try {
      return JSON.stringify(settings);
    } catch {
      return String(Date.now());
    }
  }

  private getOrCreateBlockState(block: InlineQueryBlock): InlineQueryBlockState {
    const existing = this.blocks.get(block.id);
    if (existing) {
      existing.block = block;
      return existing;
    }

    const container = document.createElement("div");
    container.dataset.rtInlineQuery = block.id;
    container.className = "rt-inline-query";
    block.element.insertAdjacentElement("afterend", container);
    container.addEventListener("click", (event) => this.handleContainerClick(event));

    const state: InlineQueryBlockState = {
      block,
      container,
      renderLimit: this.pageSize,
    };
    this.blocks.set(block.id, state);
    return state;
  }

  private handleContainerClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const actionEl = target.closest<HTMLElement>("[data-rt-action]");
    if (!actionEl) {
      return;
    }
    const action = actionEl.dataset.rtAction;
    const container = target.closest<HTMLElement>(".rt-inline-query");
    if (!container) {
      return;
    }
    const blockId = container.dataset.rtInlineQuery;
    if (!blockId) {
      return;
    }
    const state = this.blocks.get(blockId);
    if (!state) {
      return;
    }

    if (action === "more") {
      state.renderLimit += this.pageSize;
      this.renderBlock(state);
      return;
    }

    const taskRow = target.closest<HTMLElement>("[data-task-id]");
    const taskId = taskRow?.dataset.taskId;
    if (!taskId) {
      return;
    }

    if (action === "toggle") {
      this.options.onToggleTask(taskId);
      return;
    }

    if (action === "edit") {
      const task = this.options.repository.getTask(taskId);
      if (task) {
        this.options.onEditTask(task);
      }
    }
  }

  private getProtyleRoots(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(".protyle-wysiwyg"));
  }
}
