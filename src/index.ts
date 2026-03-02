/**
 * Task Recurring Notification Management Plugin
 * SiYuan Plugin Entry Point
 *
 * Architecture: Official SiYuan Plugin Pattern (Decomposed)
 * - export default class extends Plugin
 * - onload()       → register icons, boot core services, register UI
 * - onLayoutReady() → boot engine, validation, pipelines, intelligence
 * - onunload()     → deterministic teardown via ShutdownSequence
 *
 * Service construction is delegated to application/BootSequence.
 * Service teardown is delegated to application/ShutdownSequence.
 * Service references are held in application/ServiceRegistry.
 *
 * @author Drmusab
 * @license MIT
 */

import {
  Plugin,
  showMessage,
  openTab,
} from "siyuan";

// ─── Global Styles ──────────────────────────────────────────
import "@frontend/styles/obsidian-compat.css";

// ─── Application Layer (Composition Root) ───────────────────
import {
  createServiceRegistry,
  toPluginServices,
  bootCoreServices,
  bootCQRSLayer,
  runMigration,
  bootEngineLayer,
  startEngineController,
  bootRuntimeValidation,
  bootPipelines,
  bootIntelligence,
  startCQRSRuntime,
  shutdownAll,
  bootWebhookSystem,
  shutdownWebhookSystem,
  type ServiceRegistry,
} from "./application";
import { NotificationState } from "@engine/index";
import { NOTIFICATION_STATE_KEY } from "@utils/index";

// ─── Stores & Frontend Services ─────────────────────────────
import { initSettingsStore } from "@stores/index";
import { initOptionsStorage } from "@modals/OptionsModal";
import { updateAnalyticsFromTasks } from "@stores/index";
import { initSavedQueryStore } from "@query/index";
import { taskStore } from "@stores/index";

import { uiQueryService, uiEventService, uiMutationService } from "@services/index";

// ─── Parsers (for UIQueryService wiring) ────────────────────
import { DateParser, parseRecurrenceRule, serializeRecurrenceRule } from "@parsers/index";
import { replaceTaskWithTasks } from "@infrastructure/index";
import type { Frequency } from "@domain/models/Frequency";
import type { ReplaceTaskOptions } from "@backend/core/file/File";
import type { TaskDTO } from "@frontend/services/DTOs";
import type { Task } from "@backend/core/models/Task";
import type { Status } from "@shared/constants/statuses/Status";

// ─── Plugin Modules (Decomposed) ────────────────────────────
import { registerCustomIcons } from "./plugin/icons";
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

// ─── Mount Adapters ─────────────────────────────────────────
import { MountService } from "@mounts/index";
import { mountCalendarDock } from "@mounts/index";
import { showReminderFloat } from "@mounts/index";
import { openAnalyticsDashboard } from "@mounts/index";

// ─── Modals ─────────────────────────────────────────────────
import { TaskModal } from "@modals/TaskModal";

// ─── Logging ────────────────────────────────────────────────
import { pluginLogger } from "@utils/index";


// ─── Plugin Class ───────────────────────────────────────────
/**
 * CRITICAL: This MUST be the default export for SiYuan's plugin loader.
 * SiYuan expects: (module.exports || exports).default || module.exports
 */
export default class TaskRecurringNotificationManagementPlugin extends Plugin {
  // ── Service Registry (all services) ──
  private registry: ServiceRegistry = createServiceRegistry();

  // ── Shared notification state (constructed before boot phases) ──
  private sharedNotificationState: NotificationState | null = null;

  // ── UI State (Decomposed) ──
  private dockState: DockState = createDockState();
  private tabState: TabState = createTabState();
  private topBarState: TopBarState = createTopBarState();
  private eventState: EventHandlerState = createEventHandlerState();

  // ── State ──
  private initialized = false;
  /** Cleanup functions for event listeners registered in onLayoutReady */
  private layoutReadyCleanups: Array<() => void> = [];

  // ═════════════════════════════════════════════════════════════
  // LIFECYCLE: onload()
  // ═════════════════════════════════════════════════════════════
  async onload(): Promise<void> {
    pluginLogger.info(`[${this.name}] Loading plugin...`);

    try {
      // ── 0. Register custom SVG icons FIRST ──
      registerCustomIcons(this);

      // ── 1. Boot Phase 1: Core services ──
      const core = await bootCoreServices(this);
      this.registry.core = core;

      // ── 2. Boot Phase 2: CQRS layer ──
      const cqrs = bootCQRSLayer(core);
      this.registry.cqrs = cqrs;

      // ── 3. Shared NotificationState for webhooks + escalation ──
      this.sharedNotificationState = new NotificationState(this, NOTIFICATION_STATE_KEY);

      // ── 4. Boot Phase 3: Migration ──
      const migrationResult = await runMigration(core);
      if (migrationResult.migrated > 0) {
        pluginLogger.info(`[${this.name}] Migrated ${migrationResult.migrated} tasks to RRule`);
        this.safeShowMessage(`Upgraded ${migrationResult.migrated} tasks to RRule format`, "info");
      }

      // ── 5. Initialize stores ──
      initSettingsStore(this);
      await initOptionsStorage(this);
      await initSavedQueryStore(this);

      // ── 5b. Connect TaskStore to backend ──
      taskStore.connectBackend({
        taskStorage: core.taskStorage,
        blockMetadataService: core.blockMetadataService,
        pluginEventBus: core.pluginEventBus,
      });

      // ── 5c. Wire frontend service singletons to backend ──
      uiQueryService.connect({
        taskStorage: core.taskStorage as any,
        dateParser: {
          parseNaturalLanguageDate: (input: string, ref?: Date) =>
            DateParser.parseNaturalLanguageDate(input, ref),
          toISODateString: (date: Date) => DateParser.toISODateString(date),
        },
        recurrenceParser: {
          parseRecurrenceRule: (input: string) => parseRecurrenceRule(input),
          serializeRecurrenceRule: (rule: unknown) => serializeRecurrenceRule(rule as Frequency),
        },
        fileReplacer: {
          replaceTaskWithTasks: (opts: { originalTask: unknown; newTasks: unknown }) =>
            replaceTaskWithTasks(opts as ReplaceTaskOptions),
        },
      });
      uiEventService.connect({ pluginEventBus: core.pluginEventBus });
      uiMutationService.connect({ taskService: cqrs.taskService as any });

      // ── 6. Build legacy service container for UI modules ──
      const services = toPluginServices(this.registry);

      // ── 7. Register dock panels ──
      registerDashboardDock(this, this.dockState, services);
      registerReminderDock(this, this.dockState, services);

      // ── 8. Register custom tab type ──
      registerDashboardTab(this, this.tabState, services);

      // ── 9. Register protyle slash commands ──
      registerProtyleSlash(this, () => this.openQuickTaskEditor());

      // ── 10. Initialize MountService (registrations only) ──
      const mountService = new MountService({ plugin: this, services });
      mountService.register("CalendarDock", "runtimeReady", () =>
        mountCalendarDock(this, services),
      );
      this.registry.ui = { mountService, reminderFloatHandle: null };

      this.initialized = true;
      pluginLogger.info(`[${this.name}] Plugin loaded successfully`);
    } catch (error) {
      pluginLogger.error(`[${this.name}] Plugin load failed:`, error);
      this.safeShowMessage(`Plugin load error: ${(error as Error).message}`, "error");
    }
  }

  // ═════════════════════════════════════════════════════════════
  // LIFECYCLE: onLayoutReady()
  // ═════════════════════════════════════════════════════════════
  onLayoutReady(): void {
    if (!this.initialized || !this.registry.core || !this.registry.cqrs) {
      pluginLogger.warn(`[${this.name}] onLayoutReady skipped: plugin not initialized`);
      return;
    }

    const core = this.registry.core;
    const cqrs = this.registry.cqrs;

    pluginLogger.info(`[${this.name}] Layout ready — binding UI and starting engine`);

    // ── Register top bar button (DOM must be ready) ──
    registerTopBarButton(this, this.topBarState, core.isMobile, {
      openQuickTaskEditor: () => this.openQuickTaskEditor(),
      showTodayTasks: () => this.showTodayTasks(),
      openSetting: () => this.openSetting(),
    });

    // ── Register SiYuan native event bus handlers ──
    registerSiYuanEventHandlers(this.eventState, {
      plugin: this,
      pluginEventBus: core.pluginEventBus,
      blockMetadataService: core.blockMetadataService,
      scheduler: core.scheduler,
      openQuickTaskEditor: () => this.openQuickTaskEditor(),
      openTaskEditorForBlock: (blockId: string, blockContent: string) =>
        this.openTaskEditorForBlock(blockId, blockContent),
    });

    // ── Populate analytics store ──
    core.taskStorage.loadActive().then((tasks) => {
      const tasksArray = Array.from(tasks.values());
      if (tasksArray.length > 0) updateAnalyticsFromTasks(tasksArray);
      import("@stores/index").then(m => m.markAnalyticsLoaded());
    }).catch((err) => {
      pluginLogger.warn(`[${this.name}] Initial analytics population failed:`, err);
      import("@stores/index").then(m => m.markAnalyticsLoaded());
    });

    // ── Sync tasks to block DB (non-blocking) ──
    this.syncTasksToBlockDB();

    // ── Boot Phase 4: Engine layer ──
    const engine = bootEngineLayer(core);
    this.registry.engine = engine;

    // Start engine controller (async — marks lifecycle gates when done)
    startEngineController(engine);

    // ── Register scheduler event triggers ──
    registerSchedulerEventTriggers(this.eventState, core.pluginEventBus, core.scheduler);

    // ── Boot Phase 5: Runtime validation ──
    const rv = bootRuntimeValidation(core, cqrs, engine);
    this.registry.runtimeValidation = rv;

    // ── Boot Phase 6: Pipeline services ──
    if (rv && this.sharedNotificationState) {
      const pipelines = bootPipelines(core, cqrs, engine, rv, this.sharedNotificationState);
      this.registry.pipelines = pipelines;
    }

    // ── Wire reminder float to attention-filtered events ──
    const unsubAttentionDue = core.pluginEventBus.on("task:attention:due", () => {
      this.showReminderNotification();
    });
    const unsubAttentionUrgent = core.pluginEventBus.on("task:attention:urgent", () => {
      this.showReminderNotification();
    });
    this.layoutReadyCleanups.push(unsubAttentionDue, unsubAttentionUrgent);

    // ── Boot Phase 8: Start CQRS runtime ──
    startCQRSRuntime(core, cqrs, {
      plugin: this,
      openQuickTaskEditor: () => this.openQuickTaskEditor(),
      openTaskEditorForBlock: (blockId: string, blockContent: string) =>
        this.openTaskEditorForBlock(blockId, blockContent),
      showTodayTasks: () => this.showTodayTasks(),
    });

    // ── Wire workspace events to scheduler ──
    const unsubChanged = core.pluginEventBus.on("workspace:changed", (payload: { workspaceId: string }) => {
      core.scheduler.setWorkspace(payload.workspaceId);
    });
    const unsubOpened = core.pluginEventBus.on("workspace:opened", () => {
      core.scheduler.resume();
    });
    const unsubClosed = core.pluginEventBus.on("workspace:closed", () => {
      core.scheduler.pause("workspace closed");
    });
    this.layoutReadyCleanups.push(unsubChanged, unsubOpened, unsubClosed);

    // ── Boot Phase 7: Intelligence layer (async) ──
    bootIntelligence(core).then((intelligence) => {
      this.registry.intelligence = intelligence;

      // Late-bind AI engine into ExecutionPipeline (created in Phase 6)
      if (this.registry.pipelines?.executionPipeline && intelligence.aiOrchestrator) {
        this.registry.pipelines.executionPipeline.setAiEngine(
          intelligence.aiOrchestrator.getEngine(),
        );
      }
    });

    // ── Start MountService ──
    if (this.registry.ui?.mountService) {
      this.registry.ui.mountService.start().catch((err) => {
        pluginLogger.error(`[${this.name}] MountService start failed:`, err);
      });
    }

    // ── Boot Phase 10: Webhook system (async, non-blocking) ──
    bootWebhookSystem(this).then((webhookServices) => {
      this.registry.webhook = webhookServices;
      pluginLogger.info(`[${this.name}] Webhook system booted`);
    }).catch((err) => {
      pluginLogger.error(`[${this.name}] Webhook system boot failed:`, err);
    });

    // ── Boot Phase 10: Webhook system (async, non-blocking) ──
    bootWebhookSystem(this).then((webhookServices) => {
      this.registry.webhook = webhookServices;
      pluginLogger.info(`[${this.name}] Webhook system booted`);
    }).catch((err) => {
      pluginLogger.error(`[${this.name}] Webhook system boot failed:`, err);
    });
  }

  // ═════════════════════════════════════════════════════════════
  // LIFECYCLE: onunload()
  // ═════════════════════════════════════════════════════════════
  async onunload(): Promise<void> {
    pluginLogger.info(`[${this.name}] Unloading plugin...`);

    try {
      // Unmount dock panels (registered in onload, not part of registry)
      unmountDashboard(this.dockState);
      unmountReminders(this.dockState);
      unmountTabDashboard(this.tabState);

      // Remove top bar element
      if (this.topBarState.topBarElement?.parentElement) {
        this.topBarState.topBarElement.parentElement.removeChild(this.topBarState.topBarElement);
        this.topBarState.topBarElement = null;
      }

      // Unregister SiYuan event handlers
      unregisterSiYuanEventHandlers(this.eventState, this.eventBus);

      // Deterministic shutdown via ShutdownSequence
      await shutdownAll(this.registry, this.layoutReadyCleanups);
      this.layoutReadyCleanups = [];

      this.initialized = false;
      this.sharedNotificationState = null;
      pluginLogger.info(`[${this.name}] Plugin unloaded successfully`);
    } catch (error) {
      pluginLogger.error(`[${this.name}] Error during unload:`, error);
    }
  }

  /**
   * Called when plugin is permanently uninstalled.
   */
  uninstall(): void {
    this.removeData(STORAGE_NAME).catch((e) => {
      pluginLogger.error(`[${this.name}] Uninstall remove data failed:`, e);
    });
  }

  // ═════════════════════════════════════════════════════════════
  // SETTINGS
  // ═════════════════════════════════════════════════════════════

  openSetting(): void {
    if (!this.registry.core) return;
    openSettingsDialog(this, this.registry.core.settings, {
      saveSettings: () => this.saveSettingsToStorage(),
      syncTasksToBlockDB: () => this.syncTasksToBlockDB(),
    });
  }

  // ═════════════════════════════════════════════════════════════
  // TASK EDITOR MODAL
  // ═════════════════════════════════════════════════════════════

  private openQuickTaskEditor(): void {
    if (!this.registry.core) return;
    const core = this.registry.core;

    try {
      const modal = new TaskModal(
        this,
        null,
        [...DEFAULT_STATUS_OPTIONS] as unknown as Status[],
        async (task) => {
          await core.taskStorage.saveTask(task as unknown as Task);
          await core.blockMetadataService.syncTaskToBlock(task as unknown as Task);
          core.pluginEventBus.emit("task:refresh", undefined);
          this.safeShowMessage(this.i18n?.taskCreated || "Task created", "info");
        },
        [],
      );
      modal.open();
    } catch (error) {
      pluginLogger.error(`[${this.name}] Failed to open task editor:`, error);
      this.safeShowMessage("Failed to open task editor", "error");
    }
  }

  private openTaskEditorForBlock(blockId: string, blockContent: string): void {
    if (!this.registry.core) return;
    const core = this.registry.core;

    try {
      const prefilled: TaskDTO = {
        id: crypto.randomUUID(),
        name: blockContent || "",
        description: blockContent || "",
        status: "todo",
        lifecycleState: "idle",
        priority: "medium",
        dueAt: "",
        enabled: true,
        isRecurring: false,
        isBlocked: false,
        isOverdue: false,
        healthScore: 100,
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        blockId,
      };

      const modal = new TaskModal(
        this,
        prefilled,
        [...DEFAULT_STATUS_OPTIONS] as unknown as Status[],
        async (task) => {
          await core.taskStorage.saveTask(task as unknown as Task);
          await core.blockMetadataService.syncTaskToBlock(task as unknown as Task);
          core.pluginEventBus.emit("task:refresh", undefined);
          this.safeShowMessage(this.i18n?.taskCreated || "Task saved", "info");
        },
        [],
      );
      modal.open();
    } catch (error) {
      pluginLogger.error(`[${this.name}] Failed to open task editor for block:`, error);
      this.safeShowMessage("Failed to open task editor", "error");
    }
  }

  // ═════════════════════════════════════════════════════════════
  // UI ACTIONS
  // ═════════════════════════════════════════════════════════════

  private showTodayTasks(): void {
    if (!this.registry.core) return;
    try {
      openTab({
        app: this.app,
        custom: {
          id: this.name + TAB_TYPE,
          title: this.i18n?.dockTitle || "Recurring Tasks",
          icon: "iconTaskRecurring",
        },
      });
      this.registry.core.pluginEventBus.emit("dashboard:filterToday", {});
    } catch (error) {
      pluginLogger.error(`[${this.name}] Failed to show today's tasks:`, error);
    }
  }

  private showReminderNotification(): void {
    if (!this.registry.core || !this.registry.ui) return;
    try {
      if (this.registry.ui.reminderFloatHandle) {
        this.registry.ui.reminderFloatHandle.destroy();
      }
      this.registry.ui.reminderFloatHandle = showReminderFloat({
        plugin: this,
        services: toPluginServices(this.registry),
        autoHideMs: 10000,
      });
    } catch (error) {
      pluginLogger.error(`[${this.name}] Failed to show reminder float:`, error);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // INTERNAL HELPERS
  // ═════════════════════════════════════════════════════════════

  private async syncTasksToBlockDB(): Promise<void> {
    if (!this.registry.core) return;
    const core = this.registry.core;

    try {
      const tasks = await core.taskStorage.loadActive();
      const tasksArray = Array.from(tasks.values());
      const linkedTasks = tasksArray.filter((t: any) => t.blockId || t.linkedBlockId);
      if (linkedTasks.length === 0) return;

      const result = await core.blockMetadataService.batchSyncTasks(linkedTasks);
      if (result.synced > 0) {
        pluginLogger.info(`[${this.name}] Block DB sync: ${result.synced} tasks synced`);
      }
    } catch (error) {
      pluginLogger.warn(`[${this.name}] Block DB sync failed:`, error);
    }
  }

  private async saveSettingsToStorage(): Promise<void> {
    if (!this.registry.core) return;
    try {
      await this.saveData(STORAGE_NAME, this.registry.core.settings);
      pluginLogger.info(`[${this.name}] Settings saved`);
    } catch (error) {
      pluginLogger.error(`[${this.name}] Failed to save settings:`, error);
    }
  }

  private safeShowMessage(msg: string, type: "info" | "error" = "info"): void {
    try {
      showMessage(msg, 6000, type);
    } catch {
      pluginLogger.warn(`[${this.name}] showMessage unavailable: ${msg}`);
    }
  }
}
