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
import { EventService as WebhookEventService } from "@backend/services/WebhookEventService";
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
import { initSettingsStore, resetSettingsStore } from "@stores/Settings.store";
import { initOptionsStorage, resetOptionsStorage } from "@modals/OptionsModal";
import { updateAnalyticsFromTasks } from "@stores/TaskAnalytics.store";
import { initSavedQueryStore, resetSavedQueryStore } from "@backend/core/query/SavedQueryStore";
import { taskStore } from "@stores/Task.store";
import { resetKeyboardShortcutActions } from "@stores/KeyboardShortcuts.store";

// ─── Lifecycle Cleanup Imports ──────────────────────────────
import { clearLogs as clearBackendLogs } from "@shared/logging/logger";
import { resetReportedIssues } from "@backend/core/api/SiYuanApiAdapter";
import { performanceMonitor, logger as perfLogger } from "@shared/utils/PerformanceMonitor";
import { TaskUIStateManager } from "@backend/core/ui/TaskUIState";
import { OptimisticUpdateManager } from "@backend/core/ui/OptimisticUpdateManager";
import { resetBridgeInstance } from "@backend/core/integration/TaskReminderBridge";
import { resetArchiveCompression } from "@backend/core/storage/ArchiveCompression";
import { resetOptimizedJSON } from "@backend/core/storage/OptimizedJSON";

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

// ─── Frontend Service Singletons (Session 21: Wiring) ───────
import { uiQueryService } from "@frontend/services/UIQueryService";
import { uiEventService } from "@frontend/services/UIEventService";
import { uiMutationService } from "@frontend/services/UITaskMutationService";

// ─── Mount Adapters (Phase 4/5) — Lifecycle-Aware ───────────
import { MountService } from "@frontend/mounts/MountService";
import { mountCalendarDock } from "@frontend/mounts/dockMounts";
import { showReminderFloat } from "@frontend/mounts/floatMounts";
import { openAnalyticsDashboard } from "@frontend/mounts/lazyMounts";
import type { MountHandle } from "@frontend/mounts/types";

// ─── Lifecycle Markers (RuntimeReady store) ─────────────────
import {
  markPluginLoaded,
  markStorageLoaded,
  markBlockAttrsValidated,
  markCacheRebuilt,
  markSchedulerSynced,
  markAnalyticsLoaded,
  markDependencyGraphReady,
  markDomainMapperReady,
  markTaskLifecycleReady,
  resetRuntimeReady,
} from "@stores/RuntimeReady.store";

// ─── AI Intelligence Layer ──────────────────────────────────
import { AIOrchestrator } from "@backend/core/ai/AIOrchestrator";

// ─── Attention-Aware Event Filtering ────────────────────────
import { AttentionGateFilter } from "@backend/core/attention/AttentionGateFilter";
import { UrgencyDecayTracker } from "@backend/core/attention/UrgencyDecayTracker";

// ─── Cache Layer ────────────────────────────────────────────
import { CacheManager } from "@backend/cache/CacheManager";

// ─── Dependency Layer ───────────────────────────────────────
import { DependencyManager } from "@backend/dependencies/DependencyManager";

// ─── Engine Controller ──────────────────────────────────────
import { EngineController } from "@backend/core/engine/EngineController";

// ─── Runtime Validation Layer (Session 19) ──────────────────
import { BlockAttributeValidator } from "@backend/services/BlockAttributeValidator";
import { RecurrenceResolver } from "@backend/services/RecurrenceResolver";
import { TaskLifecycle } from "@backend/services/TaskLifecycle";
import { MLRuntimeAdapter } from "@backend/services/MLRuntimeAdapter";

// ─── TaskService + SyncService (Session 21: Service Wiring) ──
import { TaskService } from "@backend/services/TaskService";
import { SyncService } from "@backend/services/SyncService";

// ─── Structural Providers for UIQueryService (Session 21) ──
import { DateParser } from "@backend/core/parsers/DateParser";
import { parseRecurrenceRule, serializeRecurrenceRule } from "@backend/core/parsers/RecurrenceRuleParser";
import { replaceTaskWithTasks } from "@backend/core/file";

// ─── Reminder Pipeline (Session 20) ─────────────────────────
import { ReminderService } from "@backend/reminders/ReminderService";

// ─── Escalation Pipeline ────────────────────────────────────
import { IntegrationManager } from "@backend/integrations/IntegrationManager";
import { EscalationManager } from "@backend/events/EscalationManager";
import { NotificationState } from "@backend/core/engine/NotificationState";
import { NOTIFICATION_STATE_KEY } from "@shared/constants/misc-constants";

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
  private webhookEventService!: WebhookEventService;
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
  private reminderFloatHandle: MountHandle | null = null;

  // ── AI Intelligence Layer ──
  private aiOrchestrator: AIOrchestrator | null = null;

  // ── Attention-Aware Event Filtering ──
  private attentionGateFilter: AttentionGateFilter | null = null;
  private urgencyDecayTracker: UrgencyDecayTracker | null = null;

  // ── Cache Layer ──
  private cacheManager: CacheManager | null = null;

  // ── Dependency Layer ──
  private dependencyManager: DependencyManager | null = null;

  // ── Engine Controller ──
  private engineController: EngineController | null = null;

  // ── Runtime Validation Layer (Session 19) ──
  private blockAttributeValidator: BlockAttributeValidator | null = null;
  private recurrenceResolver: RecurrenceResolver | null = null;
  private taskLifecycle: TaskLifecycle | null = null;
  private mlRuntimeAdapter: MLRuntimeAdapter | null = null;

  // ── Reminder Pipeline (Session 20) ──
  private reminderService: ReminderService | null = null;

  // ── TaskService + SyncService (Session 21: Service Wiring) ──
  private syncService: SyncService | null = null;
  private taskService: TaskService | null = null;

  // ── Escalation Pipeline ──
  private integrationManager: IntegrationManager | null = null;
  private escalationManager: EscalationManager | null = null;
  private sharedNotificationState: NotificationState | null = null;

  // ── MountService (Lifecycle-Aware UI Orchestrator) ──
  private mountService: MountService | null = null;

  // ── State ──
  private initialized = false;
  private isMobile = false;
  /** Cleanup functions for event listeners registered in onLayoutReady */
  private layoutReadyCleanups: Array<() => void> = [];

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

      // Create shared NotificationState (shared between EventService + EscalationManager)
      this.sharedNotificationState = new NotificationState(this, NOTIFICATION_STATE_KEY);

      this.scheduler = new Scheduler(
        this.taskStorage,
        undefined,
        this
      );

      this.eventService = new EventService({ pluginEventBus: this.pluginEventBus });
      await this.eventService.init();

      // Legacy webhook event service (n8n direct) — preserved for backward compatibility
      this.webhookEventService = new WebhookEventService(this, { notificationState: this.sharedNotificationState! });
      await this.webhookEventService.init();
      this.webhookEventService.bindScheduler(this.scheduler);

      // Phase 7: Wire occurrence block creator for recurring tasks
      const occurrenceCreator = new OccurrenceBlockCreator(
        this,
        this.taskStorage,
        this.blockMetadataService
      );
      this.webhookEventService.setOccurrenceCreator(occurrenceCreator);

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
        repository: this.taskStorage,
        settingsProvider: () => this.settings,
        recurrenceEngine: this.recurrenceEngine,
      });
      this.commandRegistry = new CommandRegistry();

      // ── Session 21: TaskService + SyncService (needed by UITaskMutationService) ──
      this.syncService = new SyncService({
        blockAttributeSync: this.reactiveBlockLayer.attributeSync,
        blockMetadataService: this.blockMetadataService,
        eventService: this.eventService,
      });
      this.syncService.start();

      this.taskService = new TaskService({
        taskStorage: this.taskStorage,
        recurrenceEngine: this.recurrenceEngine,
        eventService: this.eventService,
        syncService: this.syncService,
      });
      this.taskService.start();

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

      // ── 5c. Session 21: Wire frontend service singletons to backend ──
      uiQueryService.connect({
        taskStorage: this.taskStorage,
        dateParser: {
          parseNaturalLanguageDate: (input: string, ref?: Date) =>
            DateParser.parseNaturalLanguageDate(input, ref),
          toISODateString: (date: Date) =>
            DateParser.toISODateString(date),
        },
        recurrenceParser: {
          parseRecurrenceRule: (input: string) => parseRecurrenceRule(input),
          serializeRecurrenceRule: (rule: unknown) =>
            serializeRecurrenceRule(rule as any),
        },
        fileReplacer: {
          replaceTaskWithTasks: (opts: { originalTask: unknown; newTasks: unknown }) =>
            replaceTaskWithTasks(opts as any),
        },
      });
      uiEventService.connect({
        pluginEventBus: this.pluginEventBus,
      });
      uiMutationService.connect({
        taskService: this.taskService!,
      });

      // ── 6. Build service container for UI modules ──
      const services = this.buildServiceContainer();

      // ── 7. Keyboard commands registered via CommandRegistry in onLayoutReady ──

      // ── 8. Mark plugin loaded + storage loaded lifecycle flags ──
      markPluginLoaded();
      markStorageLoaded();

      // ── 9. Register dock panels (deferred mounting via MountService) ──
      registerDashboardDock(this, this.dockState, services);
      registerReminderDock(this, this.dockState, services);

      // ── 10. Register custom tab type ──
      registerDashboardTab(this, this.tabState, services);

      // ── 11. Register protyleSlash for inline task creation ──
      registerProtyleSlash(this, () => this.openQuickTaskEditor());

      // ── 12. Initialize MountService (registrations only — not started yet) ──
      // MountService.start() is deferred to onLayoutReady() where it awaits
      // BootProgress === 100 and subscribes to lifecycle gate stores.
      this.mountService = new MountService({ plugin: this, services });

      // Register calendar dock with runtimeReady gate
      this.mountService.register("CalendarDock", "runtimeReady", () =>
        mountCalendarDock(this, services)
      );

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
    // (Now handled by EngineController.start() in deterministic boot sequence)

    // ── Populate analytics store + mark lifecycle flag ──
    this.taskStorage
      .loadActive()
      .then((tasks) => {
        const tasksArray = Array.from(tasks.values());
        if (tasksArray.length > 0) {
          updateAnalyticsFromTasks(tasksArray);
        }
        markAnalyticsLoaded();
      })
      .catch((err) => {
        console.warn(
          `[${this.name}] Initial analytics population failed:`,
          err
        );
        // Mark anyway to unblock AI panel in degraded mode
        markAnalyticsLoaded();
      });

    // ── Sync tasks to block DB (non-blocking) ──
    this.syncTasksToBlockDB();

    // ── Register scheduler event triggers (wires PluginEventBus → scheduler.triggerCheck) ──
    registerSchedulerEventTriggers(
      this.eventState,
      this.pluginEventBus,
      this.scheduler
    );

    // ── Block attribute validation lifecycle marker ──
    markBlockAttrsValidated();

    // ── Cache Layer: Block-validated runtime caches ──
    this.cacheManager = new CacheManager({
      repository: this.taskStorage,
      pluginEventBus: this.pluginEventBus,
      computeNextOccurrence: (task) => {
        try {
          const ref = task.dueAt ? new Date(task.dueAt) : new Date();
          // Cast needed: backend/core/models/Task ↔ domain/models/Task mismatch (pre-existing)
          const next = this.recurrenceEngine.next(task as any, ref);
          return next ? next.toISOString() : null;
        } catch { return null; }
      },
    });

    // ── Dependency Layer: Block-validated dependency graph ──
    this.dependencyManager = new DependencyManager({
      repository: this.taskStorage,
      pluginEventBus: this.pluginEventBus,
    });

    // ── Engine Controller: Deterministic boot ──
    // Sequence: CacheManager.start() → DependencyManager.start() → EventQueue.start()
    //   → Scheduler.injectDependencies() → Scheduler.recoverMissedTasks() → Scheduler.start()
    this.engineController = new EngineController({
      scheduler: this.scheduler,
      cacheManager: this.cacheManager,
      dependencyManager: this.dependencyManager,
      pluginEventBus: this.pluginEventBus,
    });
    this.engineController.start().then(() => {
      // ── Lifecycle markers after engine boot ──
      markCacheRebuilt();
      markSchedulerSynced();
      markDependencyGraphReady();
      console.log(`[${this.name}] EngineController started — lifecycle gates: cache + scheduler + dependency marked`);
    }).catch((err) => {
      console.error(`[${this.name}] EngineController start failed:`, err);
      // Mark anyway to unblock UI (degraded mode)
      markCacheRebuilt();
      markSchedulerSynced();
      markDependencyGraphReady();
    });
    console.log(`[${this.name}] EngineController starting (CacheManager + DependencyManager + Scheduler)`);

    // ── Runtime Validation Layer (Session 19) ──
    // Constructed AFTER EngineController (needs DependencyGuard + BlockAttributeSync).
    if (this.reactiveBlockLayer && this.dependencyManager) {
      this.blockAttributeValidator = new BlockAttributeValidator({
        blockAttributeSync: this.reactiveBlockLayer.attributeSync,
      });

      this.recurrenceResolver = new RecurrenceResolver({
        recurrenceEngine: this.recurrenceEngine,
      });

      this.taskLifecycle = new TaskLifecycle({
        dependencyGuard: this.dependencyManager.guard,
        blockValidator: this.blockAttributeValidator,
        recurrenceResolver: this.recurrenceResolver,
        eventService: this.eventService,
      });
      this.taskLifecycle.start();

      // ── Lifecycle markers: domain mapper + task lifecycle ready ──
      markDomainMapperReady();
      markTaskLifecycleReady();

      this.mlRuntimeAdapter = new MLRuntimeAdapter({
        eventService: this.eventService,
        blockValidator: this.blockAttributeValidator,
        getTask: (taskId: string) => this.taskStorage.getTask(taskId),
      });
      this.mlRuntimeAdapter.start();
      console.log(`[${this.name}] Runtime validation layer started (BlockValidator + RecurrenceResolver + TaskLifecycle + MLAdapter)`);

      // ── Reminder Pipeline (Session 20) ──
      // Constructed AFTER Runtime Validation Layer (needs dependencyGuard + blockValidator + recurrenceResolver).
      this.reminderService = new ReminderService({
        eventService: this.eventService,
        dependencyGuard: this.dependencyManager!.guard,
        blockValidator: this.blockAttributeValidator,
        recurrenceResolver: this.recurrenceResolver,
        getTask: (taskId: string) => this.taskStorage.getTask(taskId),
      });
      this.reminderService.start();
      console.log(`[${this.name}] ReminderService started (Session 20 reminder pipeline)`);
    } else {
      // No runtime validation layer — mark gates anyway to unblock UI (degraded mode)
      markDomainMapperReady();
      markTaskLifecycleReady();
    }

    // ── Escalation Pipeline: IntegrationManager + EscalationManager ──
    // Starts AFTER EngineController (needs EventQueue, DependencyGuard active).
    if (this.reactiveBlockLayer && this.dependencyManager) {
      this.integrationManager = new IntegrationManager(
        {
          pluginEventBus: this.pluginEventBus,
          blockAttributeSync: this.reactiveBlockLayer.attributeSync,
        },
        { workspaceId: "" }
      );
      this.integrationManager.start();

      const eventQueue = this.engineController.getEventQueue();
      if (eventQueue && this.sharedNotificationState) {
        this.escalationManager = new EscalationManager({
          pluginEventBus: this.pluginEventBus,
          dependencyGuard: this.dependencyManager.guard,
          blockAttributeSync: this.reactiveBlockLayer.attributeSync,
          notificationState: this.sharedNotificationState,
          eventQueue,
          integrationManager: this.integrationManager,
          getTask: async (taskId) => this.taskStorage.getTask(taskId),
        });
        this.escalationManager.start();
        console.log(`[${this.name}] EscalationManager started`);
      }
      console.log(`[${this.name}] IntegrationManager started`);
    }


    // ── Phase 5: Wire reminder float to attention-filtered events ──
    // REPLACED: blind task:due → showReminderNotification() with attention gate.
    // Frontend now reacts ONLY to task:attention:due (filtered, scored).
    const unsubAttentionDue = this.pluginEventBus.on("task:attention:due", () => {
      this.showReminderNotification();
    });
    const unsubAttentionUrgent = this.pluginEventBus.on("task:attention:urgent", () => {
      this.showReminderNotification();
    });
    this.layoutReadyCleanups.push(unsubAttentionDue, unsubAttentionUrgent);

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
    const unsubChanged = this.pluginEventBus.on("workspace:changed", (payload: { workspaceId: string }) => {
      this.scheduler.setWorkspace(payload.workspaceId);
    });
    const unsubOpened = this.pluginEventBus.on("workspace:opened", () => {
      this.scheduler.resume();
    });
    const unsubClosed = this.pluginEventBus.on("workspace:closed", () => {
      this.scheduler.pause("workspace closed");
    });
    this.layoutReadyCleanups.push(unsubChanged, unsubOpened, unsubClosed);

    // ── AI Intelligence Layer: Event-driven, starts AFTER scheduler ──
    this.aiOrchestrator = new AIOrchestrator(
      this,
      (taskId: string) => this.taskStorage.getTask(taskId)
    );
    this.aiOrchestrator.init().catch((err) => {
      console.warn(`[${this.name}] AI Orchestrator init failed:`, err);
    });

    // ── Attention-Aware Event Filtering: Gates scheduler → frontend/notifications ──
    this.urgencyDecayTracker = new UrgencyDecayTracker(this);
    this.urgencyDecayTracker.load().then(() => {
      this.attentionGateFilter = new AttentionGateFilter(this.urgencyDecayTracker!);
      this.attentionGateFilter.bind(this.scheduler);
      console.log(`[${this.name}] AttentionGateFilter bound to scheduler`);
    }).catch((err) => {
      console.warn(`[${this.name}] AttentionGateFilter init failed:`, err);
    });

    // ── Start MountService: awaits BootProgress, then gates per-mount ──
    // This is the LAST thing in onLayoutReady — all lifecycle markers above
    // are set (or will be set async) so MountService subscribes to their
    // derived stores and mounts components as soon as their gates open.
    if (this.mountService) {
      this.mountService.start().catch((err) => {
        console.error(`[${this.name}] MountService start failed:`, err);
      });
    }
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
      // 0. Clean up event listeners registered in onLayoutReady
      for (const cleanup of this.layoutReadyCleanups) {
        try { cleanup(); } catch { /* already cleared */ }
      }
      this.layoutReadyCleanups = [];

      // 0b. CQRS Phase: Tear down reactive services (before scheduler)
      if (this.aiOrchestrator) {
        this.aiOrchestrator.destroy();
        this.aiOrchestrator = null;
      }
      // Attention gate filter (destroy before scheduler stop)
      if (this.attentionGateFilter) {
        this.attentionGateFilter.destroy();
        this.attentionGateFilter = null;
      }
      this.urgencyDecayTracker = null;

      // Reminder Pipeline: stop before Runtime Validation Layer
      if (this.reminderService) {
        this.reminderService.stop();
        this.reminderService = null;
      }

      // Runtime Validation Layer: stop before EngineController
      if (this.mlRuntimeAdapter) {
        this.mlRuntimeAdapter.stop();
        this.mlRuntimeAdapter = null;
      }
      if (this.taskLifecycle) {
        this.taskLifecycle.stop();
        this.taskLifecycle = null;
      }
      this.recurrenceResolver = null;
      this.blockAttributeValidator = null;

      // Escalation Pipeline: stop before EngineController (depends on EventQueue)
      if (this.escalationManager) {
        this.escalationManager.stop();
        this.escalationManager = null;
      }
      if (this.integrationManager) {
        this.integrationManager.stop();
        this.integrationManager = null;
      }
      this.sharedNotificationState = null;

      // Engine Controller: stops Scheduler + EventQueue (deterministic shutdown)
      if (this.engineController) {
        await this.engineController.stop();
        this.engineController = null;
      }

      // Dependency layer (stop before cache layer)
      if (this.dependencyManager) {
        this.dependencyManager.stop();
        this.dependencyManager = null;
      }
      // Cache layer (stop before command registry / block layer teardown)
      if (this.cacheManager) {
        this.cacheManager.stop();
        this.cacheManager = null;
      }
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

      // 1. Scheduler already stopped by EngineController above

      // 2. Destroy MountService (unsubscribes gates + destroys all lifecycle-aware mounts)
      if (this.mountService) {
        this.mountService.destroyAll();
        this.mountService = null;
      }

      // 2b. Unmount all Svelte components (dock panels registered in onload)
      unmountDashboard(this.dockState);
      unmountReminders(this.dockState);
      unmountTabDashboard(this.tabState);

      // 2c. Unmount reminder float (Phase 5) — calendar dock handled by MountService
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

      // 5. Shutdown event services
      if (this.eventService) {
        await this.eventService.shutdown();
      }
      if (this.webhookEventService) {
        await this.webhookEventService.shutdown();
      }

      // 6. Unregister all event handlers
      unregisterSiYuanEventHandlers(this.eventState, this.eventBus);

      // 7. Clear internal event bus
      if (this.pluginEventBus) {
        this.pluginEventBus.clear();
      }

      // 8. Disconnect frontend service singletons (Session 21)
      uiMutationService.disconnect();
      uiEventService.disconnect();
      uiQueryService.disconnect();

      // 8b. Stop TaskService + SyncService (Session 21)
      if (this.taskService) {
        this.taskService.stop();
        this.taskService = null;
      }
      if (this.syncService) {
        this.syncService.stop();
        this.syncService = null;
      }

      // 9. Disconnect TaskStore from backend (Phase 7)
      taskStore.disconnectBackend();

      // 9. Reset all module-level singletons to prevent hot-reload leaks
      resetSettingsStore();
      resetOptionsStorage();
      resetSavedQueryStore();
      resetKeyboardShortcutActions();
      resetRuntimeReady();

      // 10. Clear backend singletons (UI state managers, logging, performance)
      OptimisticUpdateManager.resetInstance();
      TaskUIStateManager.resetInstance();
      resetBridgeInstance();
      resetArchiveCompression();
      resetOptimizedJSON();
      resetReportedIssues();

      // 11. Flush accumulated logs and metrics
      clearBackendLogs();
      performanceMonitor.clearMetrics();
      perfLogger.clearLogs();

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
