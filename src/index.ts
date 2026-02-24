/**
 * Task Recurring Notification Management Plugin
 * SiYuan Plugin Entry Point
 *
 * Architecture: Official SiYuan Plugin Pattern (Decomposed)
 * - export default class extends Plugin
 * - onload()       → register icons, services, commands, docks, tabs, slash
 * - onLayoutReady() → addTopBar, bind events, start scheduler (DOM ready)
 * - onunload()     → cleanup all resources, destroy UI, remove listeners
 *
 * Module decomposition:
 * - plugin/icons.ts       → SVG icon registration
 * - plugin/commands.ts    → Keyboard command registration
 * - plugin/docks.ts       → Dashboard & Reminder dock panels
 * - plugin/tabs.ts        → Dashboard tab registration
 * - plugin/topbar.ts      → Top bar button & quick actions menu
 * - plugin/events.ts      → SiYuan event bus integration
 * - plugin/settings-ui.ts → Settings dialog builder
 * - plugin/slash.ts       → Protyle slash commands
 * - plugin/constants.ts   → Shared constants (dock types, tab types, storage keys)
 * - plugin/types.ts       → Shared service container type
 *
 * Based on patterns from:
 * - plugin-sample (webpack) — lifecycle, addDock, addTab, addTopBar, addCommand
 * - plugin-sample-vite-svelte — Svelte component mounting, lifecycle-safe UI
 *
 * @author Drmusab
 * @license MIT
 */

import {
  Plugin,
  showMessage,
  getFrontend,
  openTab,
} from "siyuan";

// ─── Global Styles ──────────────────────────────────────────
import "@frontend/styles/obsidian-compat.css";

// ─── Core Services ──────────────────────────────────────────
import { TaskStorage } from "@backend/core/storage/TaskStorage";
import { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import { Scheduler } from "@backend/core/engine/Scheduler";
import { OccurrenceBlockCreator } from "@backend/core/engine/OccurrenceBlockCreator";
import { EventService } from "@backend/services/EventService";
import { PluginEventBus, pluginEventBus } from "@backend/core/events/PluginEventBus";
import { BlockMetadataService } from "@backend/core/api/BlockMetadataService";
import { TaskCreationService } from "@backend/core/services/TaskCreationService";
import { AutoMigrationService } from "@backend/core/services/AutoMigrationService";
import {
  mergeSettings,
  type PluginSettings,
} from "@backend/core/settings/PluginSettings";

// ─── CQRS Phase: Runtime Bridge, Reactive Manager, Command Registry ────
import { SiYuanRuntimeBridge } from "@backend/runtime/SiYuanRuntimeBridge";
import { ReactiveTaskManager } from "@backend/core/managers/ReactiveTaskManager";
import { ReactiveBlockLayer } from "@backend/blocks/ReactiveBlockLayer";
import { CommandRegistry } from "@backend/commands/CommandRegistry";

// ─── Stores & Modals ────────────────────────────────────────
import { TaskModal } from "@modals/TaskModal";
import { initSettingsStore } from "@stores/Settings.store";
import { initOptionsStorage } from "@modals/OptionsModal";
import { updateAnalyticsFromTasks } from "@stores/TaskAnalytics.store";
import { initSavedQueryStore } from "@backend/core/query/SavedQueryStore";
import { taskStore } from "@stores/Task.store";

// ─── Plugin Modules (Decomposed) ────────────────────────────
import { registerCustomIcons } from "./plugin/icons";
// NOTE: registerCommands removed — CommandRegistry (CQRS) handles all commands
import {
  createDockState,
  registerDashboardDock,
  registerReminderDock,
  unmountDashboard,
  unmountReminders,
  type DockState,
} from "./plugin/docks";
import {
  createTabState,
  registerDashboardTab,
  unmountTabDashboard,
  type TabState,
} from "./plugin/tabs";
import {
  createTopBarState,
  registerTopBarButton,
  showQuickActionsMenu,
  type TopBarState,
} from "./plugin/topbar";
import {
  createEventHandlerState,
  registerSiYuanEventHandlers,
  registerSchedulerEventTriggers,
  unregisterSiYuanEventHandlers,
  type EventHandlerState,
} from "./plugin/events";
import { openSettingsDialog } from "./plugin/settings-ui";
import { registerProtyleSlash } from "./plugin/slash";
import {
  STORAGE_NAME,
  TAB_TYPE,
  DEFAULT_STATUS_OPTIONS,
} from "./plugin/constants";
import type { PluginServices } from "./plugin/types";

// ─── Mount Adapters (Phase 4/5) ─────────────────────────────
import { mountCalendarDock } from "@frontend/mounts/dockMounts";
import { showReminderFloat } from "@frontend/mounts/floatMounts";
import { openAnalyticsDashboard } from "@frontend/mounts/lazyMounts";
import type { MountHandle } from "@frontend/mounts/types";

// ─── Plugin Class ───────────────────────────────────────────
/**
 * CRITICAL: This MUST be the default export for SiYuan's plugin loader.
 * SiYuan expects: (module.exports || exports).default || module.exports
 */
export default class TaskRecurringNotificationManagementPlugin extends Plugin {
  // ── Core Services ──
  private pluginEventBus!: PluginEventBus;
  private taskStorage!: TaskStorage;
  private recurrenceEngine!: RecurrenceEngine;
  private scheduler!: Scheduler;
  private eventService!: EventService;
  private taskCreationService!: TaskCreationService;
  private autoMigrationService!: AutoMigrationService;
  private blockMetadataService!: BlockMetadataService;
  private settings!: PluginSettings;

  // ── CQRS Phase: Runtime Bridge + Reactive Systems ──
  private runtimeBridge!: SiYuanRuntimeBridge | null;
  private reactiveTaskManager!: ReactiveTaskManager | null;
  private reactiveBlockLayer!: ReactiveBlockLayer | null;
  private commandRegistry!: CommandRegistry | null;

  // ── UI State (Decomposed) ──
  private dockState: DockState = createDockState();
  private tabState: TabState = createTabState();
  private topBarState: TopBarState = createTopBarState();
  private eventState: EventHandlerState = createEventHandlerState();
  private calendarDockHandle: MountHandle | null = null;
  private reminderFloatHandle: MountHandle | null = null;

  // ── State ──
  private initialized = false;
  private isMobile = false;

  // ═════════════════════════════════════════════════════════════
  // LIFECYCLE: onload()
  // ═════════════════════════════════════════════════════════════
  /**
   * Called when plugin loads. Register resources, commands, dock panels.
   * Per official SiYuan samples: addDock, addTab, addCommand go in onload.
   * addTopBar goes in onLayoutReady (DOM-dependent).
   */
  async onload(): Promise<void> {
    console.log(`[${this.name}] Loading plugin...`);

    try {
      // ── 0. Register custom SVG icons FIRST ──
      registerCustomIcons(this);

      // ── 1. Detect platform ──
      const frontend = getFrontend();
      this.isMobile =
        frontend === "mobile" || frontend === "browser-mobile";

      // ── 2. Load settings ──
      const userSettings = (await this.loadData(STORAGE_NAME)) || {};
      this.settings = mergeSettings(userSettings);
      console.log(
        `[${this.name}] Settings loaded. RRule default:`,
        this.settings.recurrence.useRRuleByDefault
      );

      // ── 3. Initialize core services (dependency order) ──
      // Use the module-level singleton so all backend services share the same bus
      this.pluginEventBus = pluginEventBus;
      this.recurrenceEngine = new RecurrenceEngine();
      this.blockMetadataService = new BlockMetadataService();

      this.taskStorage = new TaskStorage(this);
      await this.taskStorage.init();

      this.scheduler = new Scheduler(
        this.taskStorage,
        undefined,
        this
      );

      this.eventService = new EventService(this);
      await this.eventService.init();
      this.eventService.bindScheduler(this.scheduler);

      // Phase 7: Wire occurrence block creator for recurring tasks
      const occurrenceCreator = new OccurrenceBlockCreator(
        this,
        this.taskStorage,
        this.blockMetadataService
      );
      this.eventService.setOccurrenceCreator(occurrenceCreator);

      this.taskCreationService = new TaskCreationService(this.settings);
      this.autoMigrationService = new AutoMigrationService(this.settings);

      // ── CQRS Phase: Runtime Bridge + Reactive Systems ──
      this.runtimeBridge = new SiYuanRuntimeBridge(
        this,
        this.pluginEventBus
      );
      this.reactiveTaskManager = new ReactiveTaskManager({
        storage: this.taskStorage,
        scheduler: this.scheduler,
        pluginEventBus: this.pluginEventBus,
        runtimeBridge: this.runtimeBridge,
        blockMetadataService: this.blockMetadataService,
      });
      this.reactiveBlockLayer = new ReactiveBlockLayer({
        runtimeBridge: this.runtimeBridge,
        pluginEventBus: this.pluginEventBus,
      });
      this.commandRegistry = new CommandRegistry();

      console.log(`[${this.name}] Core services initialized (with CQRS runtime bridge)`);

      // ── 4. Phase 3: Enforce RRule migration ──
      const migrationResult = await this.enforceMigration();
      if (!migrationResult.success) {
        throw new Error(`Migration failed: ${migrationResult.error}`);
      }
      if (migrationResult.migrated > 0) {
        console.log(
          `[${this.name}] Phase 3: Migrated ${migrationResult.migrated} tasks to RRule`
        );
        this.safeShowMessage(
          `Upgraded ${migrationResult.migrated} tasks to RRule format`,
          "info"
        );
      }

      // ── 5. Initialize stores ──
      initSettingsStore(this);
      await initOptionsStorage(this);
      await initSavedQueryStore(this);

      // ── 5b. Phase 7: Connect TaskStore to backend services ──
      taskStore.connectBackend({
        taskStorage: this.taskStorage,
        blockMetadataService: this.blockMetadataService,
        pluginEventBus: this.pluginEventBus,
      });

      // ── 6. Build service container for UI modules ──
      const services = this.buildServiceContainer();

      // ── 7. Keyboard commands registered via CommandRegistry in onLayoutReady ──

      // ── 8. Register dock panel: Dashboard ──
      registerDashboardDock(this, this.dockState, services);

      // ── 9. Register dock panel: Reminders ──
      registerReminderDock(this, this.dockState, services);

      // ── 10. Register custom tab type ──
      registerDashboardTab(this, this.tabState, services);

      // ── 11. Register protyleSlash for inline task creation ──
      registerProtyleSlash(this, () => this.openQuickTaskEditor());

      // ── 12. Register calendar dock panel (Phase 4) ──
      this.calendarDockHandle = mountCalendarDock(this, services);

      this.initialized = true;
      console.log(`[${this.name}] Plugin loaded successfully`);
    } catch (error) {
      console.error(`[${this.name}] Plugin load failed:`, error);
      this.safeShowMessage(
        `Plugin load error: ${(error as Error).message}`,
        "error"
      );
    }
  }

  // ═════════════════════════════════════════════════════════════
  // LIFECYCLE: onLayoutReady()
  // ═════════════════════════════════════════════════════════════
  /**
   * Called when SiYuan layout is ready and DOM is interactive.
   * Per official samples: addTopBar, eventBus handlers, data loading.
   */
  onLayoutReady(): void {
    if (!this.initialized) {
      console.warn(
        `[${this.name}] onLayoutReady skipped: plugin not initialized`
      );
      return;
    }

    console.log(`[${this.name}] Layout ready — binding UI and starting engine`);

    // ── Register top bar button (DOM must be ready) ──
    registerTopBarButton(this, this.topBarState, this.isMobile, {
      openQuickTaskEditor: () => this.openQuickTaskEditor(),
      showTodayTasks: () => this.showTodayTasks(),
      openSetting: () => this.openSetting(),
    });

    // ── Register SiYuan native event bus handlers ──
    registerSiYuanEventHandlers(this.eventState, {
      plugin: this,
      pluginEventBus: this.pluginEventBus,
      blockMetadataService: this.blockMetadataService,
      scheduler: this.scheduler,
      openQuickTaskEditor: () => this.openQuickTaskEditor(),
      openTaskEditorForBlock: (blockId: string, blockContent: string) =>
        this.openTaskEditorForBlock(blockId, blockContent),
    });

    // ── Recover missed tasks from last session ──
    this.scheduler.recoverMissedTasks().catch((err) => {
      console.warn(`[${this.name}] Missed task recovery failed:`, err);
    });

    // ── Populate analytics store ──
    this.taskStorage
      .loadActive()
      .then((tasks) => {
        const tasksArray = Array.from(tasks.values());
        if (tasksArray.length > 0) {
          updateAnalyticsFromTasks(tasksArray);
        }
      })
      .catch((err) => {
        console.warn(
          `[${this.name}] Initial analytics population failed:`,
          err
        );
      });

    // ── Sync tasks to block DB (non-blocking) ──
    this.syncTasksToBlockDB();

    // ── Start scheduler with event-driven enhancements ──
    this.scheduler.start();
    registerSchedulerEventTriggers(
      this.eventState,
      this.pluginEventBus,
      this.scheduler
    );

    // ── Phase 5: Wire reminder float to task:due events ──
    this.pluginEventBus.on("task:due", () => {
      this.showReminderNotification();
    });

    // ── CQRS Phase: Start reactive runtime services ──
    if (this.runtimeBridge) {
      this.runtimeBridge.start();
      console.log(`[${this.name}] SiYuanRuntimeBridge started`);
    }
    if (this.reactiveTaskManager) {
      this.reactiveTaskManager.wire();
      console.log(`[${this.name}] ReactiveTaskManager wired`);
    }
    if (this.reactiveBlockLayer) {
      this.reactiveBlockLayer.start();
      console.log(`[${this.name}] ReactiveBlockLayer started`);
    }
    if (this.commandRegistry) {
      this.commandRegistry.register({
        plugin: this,
        pluginEventBus: this.pluginEventBus,
        scheduler: this.scheduler,
        runtimeBridge: this.runtimeBridge!,
        openQuickTaskEditor: () => this.openQuickTaskEditor(),
        openTaskEditorForBlock: (blockId: string, blockContent: string) =>
          this.openTaskEditorForBlock(blockId, blockContent),
        showTodayTasks: () => this.showTodayTasks(),
      });
      console.log(`[${this.name}] CommandRegistry registered`);
    }

    // ── CQRS Phase: Wire workspace events to scheduler ──
    this.pluginEventBus.on("workspace:changed", (payload: { workspaceId: string }) => {
      this.scheduler.setWorkspace(payload.workspaceId);
    });
    this.pluginEventBus.on("workspace:opened", () => {
      this.scheduler.resume();
    });
    this.pluginEventBus.on("workspace:closed", () => {
      this.scheduler.pause("workspace closed");
    });
  }

  // ═════════════════════════════════════════════════════════════
  // LIFECYCLE: onunload()
  // ═════════════════════════════════════════════════════════════
  /**
   * Called when plugin unloads. Destroy ALL UI and resources.
   * MUST be thorough — no memory leaks.
   */
  async onunload(): Promise<void> {
    console.log(`[${this.name}] Unloading plugin...`);

    try {
      // 0. CQRS Phase: Tear down reactive services (before scheduler)
      if (this.commandRegistry) {
        this.commandRegistry.destroy();
        this.commandRegistry = null;
      }
      if (this.reactiveBlockLayer) {
        this.reactiveBlockLayer.stop();
        this.reactiveBlockLayer = null;
      }
      if (this.reactiveTaskManager) {
        this.reactiveTaskManager.destroy();
        this.reactiveTaskManager = null;
      }
      if (this.runtimeBridge) {
        this.runtimeBridge.stop();
        this.runtimeBridge = null;
      }

      // 1. Stop scheduler
      if (this.scheduler) {
        await this.scheduler.stop();
      }

      // 2. Unmount all Svelte components
      unmountDashboard(this.dockState);
      unmountReminders(this.dockState);
      unmountTabDashboard(this.tabState);

      // 2b. Unmount calendar dock (Phase 4) and reminder float (Phase 5)
      if (this.calendarDockHandle) {
        this.calendarDockHandle.destroy();
        this.calendarDockHandle = null;
      }
      if (this.reminderFloatHandle) {
        this.reminderFloatHandle.destroy();
        this.reminderFloatHandle = null;
      }

      // 3. Remove top bar element
      if (this.topBarState.topBarElement?.parentElement) {
        this.topBarState.topBarElement.parentElement.removeChild(
          this.topBarState.topBarElement
        );
        this.topBarState.topBarElement = null;
      }

      // 4. Flush pending storage writes
      if (this.taskStorage) {
        await this.taskStorage.flush();
        this.taskStorage.stopSyncRetryProcessor();
      }

      // 5. Shutdown event service
      if (this.eventService) {
        await this.eventService.shutdown();
      }

      // 6. Unregister all event handlers
      unregisterSiYuanEventHandlers(this.eventState, this.eventBus);

      // 7. Clear internal event bus
      if (this.pluginEventBus) {
        this.pluginEventBus.clear();
      }

      // 8. Disconnect TaskStore from backend (Phase 7)
      taskStore.disconnectBackend();

      this.initialized = false;
      console.log(`[${this.name}] Plugin unloaded successfully`);
    } catch (error) {
      console.error(`[${this.name}] Error during unload:`, error);
    }
  }

  /**
   * Called when plugin is permanently uninstalled.
   * Clean up all stored data.
   */
  uninstall(): void {
    this.removeData(STORAGE_NAME).catch((e) => {
      console.error(
        `[${this.name}] Uninstall remove data failed:`,
        e
      );
    });
  }

  // ═════════════════════════════════════════════════════════════
  // SETTINGS (Using SiYuan native Setting class)
  // ═════════════════════════════════════════════════════════════

  /**
   * Override openSetting() — called by SiYuan when user clicks plugin settings.
   * Delegates to settings-ui module.
   */
  openSetting(): void {
    openSettingsDialog(this, this.settings, {
      saveSettings: () => this.saveSettingsToStorage(),
      syncTasksToBlockDB: () => this.syncTasksToBlockDB(),
    });
  }

  // ═════════════════════════════════════════════════════════════
  // TASK EDITOR MODAL
  // ═════════════════════════════════════════════════════════════

  /**
   * Open quick task editor using SiYuan Dialog-based modal.
   * Consistent approach for both toolbar click and keyboard shortcut.
   */
  private openQuickTaskEditor(): void {
    try {
      const modal = new TaskModal(
        this,
        null,
        [...DEFAULT_STATUS_OPTIONS],
        async (task) => {
          // Save task
          await this.taskStorage.saveTask(task);

          // Sync to block DB if block-linked
          await this.blockMetadataService.syncTaskToBlock(task);

          // Notify listeners
          this.pluginEventBus.emit("task:refresh", undefined);
          this.safeShowMessage(
            this.i18n?.taskCreated || "Task created",
            "info"
          );
        },
        []
      );
      modal.open();
    } catch (error) {
      console.error(
        `[${this.name}] Failed to open task editor:`,
        error
      );
      this.safeShowMessage("Failed to open task editor", "error");
    }
  }

  /**
   * Open task editor pre-populated from a block's content.
   * Called from block context menu "Edit as Task" item.
   */
  private openTaskEditorForBlock(blockId: string, blockContent: string): void {
    try {
      const prefilled = {
        id: crypto.randomUUID(),
        name: blockContent || "",
        description: blockContent || "",
        status: "todo" as const,
        priority: "medium" as const,
        dueAt: "",
        scheduledAt: undefined,
        startAt: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        doneAt: undefined,
        cancelledAt: undefined,
        enabled: true,
        frequency: { type: "once" as const },
        dependsOn: [],
        blockActions: [],
        tags: [],
        category: "",
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
        version: 1,
        blockId,
        linkedBlockId: blockId,
      };

      const modal = new TaskModal(
        this,
        prefilled as any,
        [...DEFAULT_STATUS_OPTIONS],
        async (task) => {
          await this.taskStorage.saveTask(task);
          await this.blockMetadataService.syncTaskToBlock(task);
          this.pluginEventBus.emit("task:refresh", undefined);
          this.safeShowMessage(
            this.i18n?.taskCreated || "Task saved",
            "info"
          );
        },
        []
      );
      modal.open();
    } catch (error) {
      console.error(
        `[${this.name}] Failed to open task editor for block:`,
        error
      );
      this.safeShowMessage("Failed to open task editor", "error");
    }
  }

  /**
   * Show quick actions menu at current position.
   * Used by commands and top bar button.
   */
  private openQuickActionsMenu(rect?: DOMRect): void {
    showQuickActionsMenu(this, this.isMobile, {
      openQuickTaskEditor: () => this.openQuickTaskEditor(),
      showTodayTasks: () => this.showTodayTasks(),
      openSetting: () => this.openSetting(),
    }, rect);
  }

  /**
   * Show today's tasks by opening the dashboard tab and filtering to today.
   */
  private showTodayTasks(): void {
    try {
      openTab({
        app: this.app,
        custom: {
          id: this.name + TAB_TYPE,
          title: this.i18n?.dockTitle || "Recurring Tasks",
          icon: "iconTaskRecurring",
        },
      });
      this.pluginEventBus.emit("dashboard:filterToday", {});
    } catch (error) {
      console.error(
        `[${this.name}] Failed to show today's tasks:`,
        error
      );
    }
  }

  /**
   * Open analytics dashboard in a lazy-loaded Dialog.
   * Phase 6: Heavy chart dependencies loaded on-demand.
   */
  private openAnalytics(): void {
    try {
      openAnalyticsDashboard({
        plugin: this,
        services: this.buildServiceContainer(),
      });
    } catch (error) {
      console.error(`[${this.name}] Failed to open analytics:`, error);
      this.safeShowMessage("Failed to open analytics", "error");
    }
  }

  /**
   * Show reminder float layer for due/overdue tasks.
   * Phase 5: Float notification triggered by scheduler.
   */
  private showReminderNotification(): void {
    try {
      // Dismiss existing float if any
      if (this.reminderFloatHandle) {
        this.reminderFloatHandle.destroy();
      }
      this.reminderFloatHandle = showReminderFloat({
        plugin: this,
        services: this.buildServiceContainer(),
        autoHideMs: 10000,
      });
    } catch (error) {
      console.error(`[${this.name}] Failed to show reminder float:`, error);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // BLOCK DB SYNC
  // ═════════════════════════════════════════════════════════════

  /**
   * Sync task metadata to SiYuan block attributes.
   * Runs non-blocking in background after layout is ready.
   */
  private async syncTasksToBlockDB(): Promise<void> {
    try {
      const tasks = await this.taskStorage.loadActive();
      const tasksArray = Array.from(tasks.values());

      // Only sync tasks that have linked block IDs
      const linkedTasks = tasksArray.filter(
        (t: any) => t.blockId || t.linkedBlockId
      );

      if (linkedTasks.length === 0) return;

      const result =
        await this.blockMetadataService.batchSyncTasks(linkedTasks);
      if (result.synced > 0) {
        console.log(
          `[${this.name}] Block DB sync: ${result.synced} tasks synced`
        );
      }
    } catch (error) {
      console.warn(`[${this.name}] Block DB sync failed:`, error);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // MIGRATION
  // ═════════════════════════════════════════════════════════════

  /**
   * Phase 3: Enforce migration of all tasks to RRule format.
   */
  private async enforceMigration(): Promise<{
    success: boolean;
    migrated: number;
    error?: string;
  }> {
    try {
      const tasks = await this.taskStorage.loadActive();
      const tasksArray = Array.from(tasks.values());

      const needsMigration =
        this.autoMigrationService.getTasksNeedingMigrationCount(
          tasksArray
        );

      if (needsMigration === 0) {
        return { success: true, migrated: 0 };
      }

      console.log(
        `[${this.name}] Phase 3: ${needsMigration} tasks require migration`
      );

      const result = await this.autoMigrationService.migrateAll(
        tasksArray,
        async (migratedTask) => {
          await this.taskStorage.saveTask(migratedTask as any);
        }
      );

      if (result.failed > 0) {
        console.warn(
          `[${this.name}] Migration: ${result.failed} failures`,
          result.errors
        );
      }

      return { success: true, migrated: result.migrated };
    } catch (error) {
      console.error(
        `[${this.name}] Migration enforcement failed:`,
        error
      );
      return {
        success: false,
        migrated: 0,
        error:
          error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ═════════════════════════════════════════════════════════════
  // SERVICE CONTAINER
  // ═════════════════════════════════════════════════════════════

  /**
   * Build the service container that UI modules need.
   * Single point of truth for all service references.
   */
  private buildServiceContainer(): PluginServices {
    return {
      plugin: this,
      taskStorage: this.taskStorage,
      recurrenceEngine: this.recurrenceEngine,
      scheduler: this.scheduler,
      eventService: this.eventService,
      pluginEventBus: this.pluginEventBus,
      blockMetadataService: this.blockMetadataService,
      taskCreationService: this.taskCreationService,
      autoMigrationService: this.autoMigrationService,
      settings: this.settings,
      isMobile: this.isMobile,
    };
  }

  // ═════════════════════════════════════════════════════════════
  // UTILITIES
  // ═════════════════════════════════════════════════════════════

  /**
   * Persist settings using SiYuan's native storage API.
   */
  private async saveSettingsToStorage(): Promise<void> {
    try {
      await this.saveData(STORAGE_NAME, this.settings);
      console.log(`[${this.name}] Settings saved`);
    } catch (error) {
      console.error(`[${this.name}] Failed to save settings:`, error);
    }
  }

  /**
   * Safe wrapper for showMessage.
   */
  private safeShowMessage(
    msg: string,
    type: "info" | "error" = "info"
  ): void {
    try {
      showMessage(msg, 6000, type);
    } catch {
      console.warn(`[${this.name}] showMessage unavailable: ${msg}`);
    }
  }
}
