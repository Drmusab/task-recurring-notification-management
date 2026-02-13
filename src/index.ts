import { Plugin, showMessage } from "siyuan";
import { mount, unmount } from "svelte";
import Dashboard from "@frontend/components/dashboard/Dashboard.svelte";
import { TaskStorage } from "@backend/core/storage/TaskStorage";
import { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import { Scheduler } from "@backend/core/engine/Scheduler";
import { EventService } from "@backend/services/EventService";
import { PluginEventBus } from "@backend/core/events/PluginEventBus";
import { resolveDockElement, validateDockElement } from "@infrastructure/integrations/siyuan/DockAdapter";
import { TaskCreationService } from "@backend/core/services/TaskCreationService";
import { AutoMigrationService } from "@backend/core/services/AutoMigrationService";
import { DEFAULT_SETTINGS, mergeSettings, type PluginSettings } from "@backend/core/settings/PluginSettings";

const DOCK_TYPE = "task-recurring-notfication-mangmant-dock";

/**
 * Task Recurring Notification Management Plugin
 * Repository: https://github.com/Drmusab/task-recurring-notification-management
 *
 * CRITICAL: This MUST be the default export for SiYuan's plugin loader.
 * SiYuan expects: (module.exports || exports).default || module.exports
 */
export default class TaskRecurringNotificationManagementPlugin extends Plugin {
  // Core services
  private pluginEventBus!: PluginEventBus;
  private taskStorage!: TaskStorage;
  private recurrenceEngine!: RecurrenceEngine;
  private scheduler!: Scheduler;
  private eventService!: EventService;
  private taskCreationService!: TaskCreationService;
  private autoMigrationService!: AutoMigrationService;
  private settings!: PluginSettings;

  // UI
  private dashboardComponent: ReturnType<typeof mount> | null = null;
  /** Track the dock element for cleanup (set on init, cleared on unmount) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private dockEl: HTMLElement | null = null;
  private topBarElement: HTMLElement | null = null;

  // State
  private initialized = false;

  /**
   * Phase 3: Enforce migration of all tasks to RRule
   * Blocks plugin load if migration fails or is cancelled
   */
  private async enforceMigration(): Promise<{ success: boolean; migrated: number; error?: string }> {
    try {
      const tasks = await this.taskStorage.loadActive();
      const tasksArray = Array.from(tasks.values());
      
      // Count tasks needing migration
      const needsMigration = tasksArray.filter(t => (t as any).frequency && !(t as any).recurrence);
      
      if (needsMigration.length === 0) {
        console.log(`[${this.name}] Phase 3: All tasks already using RRule`);
        return { success: true, migrated: 0 };
      }

      console.log(`[${this.name}] Phase 3: Found ${needsMigration.length} tasks requiring migration`);

      // Auto-migrate all tasks
      let migratedCount = 0;
      for (const task of needsMigration) {
        try {
          const result = await this.autoMigrationService.migrateOnEdit(task as any);
          if (result.migrated && result.migratedTask) {
            await this.taskStorage.saveTask(result.migratedTask as any);
            migratedCount++;
          }
        } catch (error) {
          console.error(`[${this.name}] Failed to migrate task ${task.id}:`, error);
        }
      }

      return { success: true, migrated: migratedCount };
    } catch (error) {
      console.error(`[${this.name}] Migration enforcement failed:`, error);
      return { 
        success: false, 
        migrated: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * SiYuan lifecycle: Called when plugin loads
   */
  async onload(): Promise<void> {
    console.log(`[${this.name}] Loading plugin v${(this as any).version || "1.0.0"}...`);

    try {
      // 1. Load settings
      const userSettings = await this.loadData("settings") || {};
      this.settings = mergeSettings(userSettings);
      console.log(`[${this.name}] Settings loaded, Phase 2 RRule enabled:`, this.settings.recurrence.useRRuleByDefault);

      // 2. Initialize core services (order matters for dependency injection)
      this.pluginEventBus = new PluginEventBus();
      this.recurrenceEngine = new RecurrenceEngine();

      this.taskStorage = new TaskStorage(this as unknown as Plugin);
      await this.taskStorage.init();

      this.scheduler = new Scheduler(this.taskStorage, undefined, this as unknown as Plugin);

      this.eventService = new EventService(this as unknown as Plugin);
      await this.eventService.init();
      this.eventService.bindScheduler(this.scheduler);

      // 3. Initialize Phase 2 services
      this.taskCreationService = new TaskCreationService(this.settings);
      this.autoMigrationService = new AutoMigrationService(this.settings);
      console.log(`[${this.name}] Phase 2 services initialized`);

      // 3.5 PHASE 3: Enforce mandatory migration to RRule
      const migrationResult = await this.enforceMigration();
      if (!migrationResult.success) {
        throw new Error(`Migration failed: ${migrationResult.error}`);
      }
      if (migrationResult.migrated > 0) {
        console.log(`[${this.name}] ✅ Phase 3: Migrated ${migrationResult.migrated} tasks to RRule`);
        this.safeShowMessage(`Upgraded ${migrationResult.migrated} tasks to RRule format`, "info");
      }

      // 4. Register top bar button
      this.registerTopBarButton();

      // 5. Register dock panel
      this.addDock({
        config: {
          position: "RightBottom",
          size: { width: 380, height: 550 },
          icon: "iconCalendar",
          title: this.i18n?.dockTitle || "Recurring Tasks",
          hotkey: "⌘⌥T",
        },
        data: {
          text: "Recurring Tasks",
        },
        type: DOCK_TYPE,
        init: (dockArg: unknown) => {
          const { element } = resolveDockElement(dockArg);
          this.dockEl = element;

          if (!validateDockElement(element)) {
            console.warn(`[${this.name}] Dock element validation failed — mounting anyway`);
          }

          this.mountDashboard(element);
        },
        destroy: () => {
          this.unmountDashboard();
        },
      });

      this.initialized = true;
      console.log(`[${this.name}] ✅ Plugin loaded successfully`);
    } catch (error) {
      console.error(`[${this.name}] ❌ Plugin load failed:`, error);
      this.safeShowMessage(`Plugin load error: ${(error as Error).message}`, "error");
    }
  }

  /**
   * SiYuan lifecycle: Called after layout is ready
   */
  onLayoutReady(): void {
    if (!this.initialized) {
      console.warn(`[${this.name}] onLayoutReady skipped: plugin not initialized`);
      return;
    }

    console.log(`[${this.name}] Layout ready — starting scheduler`);

    // Start task scheduler (checks for due tasks every minute)
    this.scheduler.start();
  }

  /**
   * SiYuan lifecycle: Called when plugin unloads
   */
  async onunload(): Promise<void> {
    console.log(`[${this.name}] Unloading plugin...`);

    try {
      // 1. Stop scheduler (await to ensure emitted state is persisted)
      if (this.scheduler) {
        await this.scheduler.stop();
      }

      // 2. Unmount UI
      this.unmountDashboard();

      // 3. Remove top bar element
      if (this.topBarElement?.parentElement) {
        this.topBarElement.parentElement.removeChild(this.topBarElement);
        this.topBarElement = null;
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

      // 6. Clear event bus (remove all listeners)
      if (this.pluginEventBus) {
        this.pluginEventBus.clear();
      }

      this.initialized = false;
      console.log(`[${this.name}] ✅ Plugin unloaded successfully`);
    } catch (error) {
      console.error(`[${this.name}] Error during unload:`, error);
    }
  }

  // ────────────────────────────────────────────────────────
  // Private Methods
  // ────────────────────────────────────────────────────────

  /**
   * Register top bar button for quick access
   */
  private registerTopBarButton(): void {
    try {
      this.topBarElement = this.addTopBar({
        icon: "iconCalendar",
        title: this.i18n?.topBarTitle || "Recurring Tasks",
        position: "right",
        callback: () => {
          this.toggleDock();
        }
      });

      console.log(`[${this.name}] Top bar button registered`);
    } catch (error) {
      console.warn(`[${this.name}] Top bar registration failed:`, error);
      // Non-critical — dock can still be accessed via sidebar
    }
  }

  /**
   * Toggle dock visibility when top bar button is clicked
   */
  private toggleDock(): void {
    try {
      // Use stored reference first, fall back to DOM query if needed
      let dock = this.dockEl;

      if (!dock) {
        const docks = document.querySelectorAll(
          `[data-type="${DOCK_TYPE}"]`
        );
        dock = docks.length > 0 ? (docks[0] as HTMLElement) : null;
      }

      if (!dock) {
        // Dock not yet initialized - this is normal during early plugin lifecycle
        return;
      }

      const isVisible = dock.style.display !== "none" && dock.offsetParent !== null;

      if (isVisible) {
        dock.style.display = "none";
      } else {
        dock.style.display = "";

        // Focus first input/button in dock
        const firstFocusable = dock.querySelector(
          "input, button, [tabindex]"
        ) as HTMLElement | null;
        if (firstFocusable) {
          setTimeout(() => firstFocusable.focus(), 100);
        }
      }
    } catch (error) {
      console.error(`[${this.name}] Toggle dock failed:`, error);
      this.safeShowMessage("Failed to toggle task panel", "error");
    }
  }

  /**
   * Mount Svelte 5 Dashboard component into dock
   */
  private mountDashboard(target: HTMLElement): void {
    if (this.dashboardComponent) {
      console.warn(`[${this.name}] Dashboard already mounted, unmounting first`);
      this.unmountDashboard();
    }

    try {
      this.dashboardComponent = mount(Dashboard, {
        target,
        props: {
          taskStorage: this.taskStorage,
          recurrenceEngine: this.recurrenceEngine,
          taskScheduler: this.scheduler,
          notificationService: this.eventService,
          eventBus: this.pluginEventBus,
          plugin: this,
          taskCreationService: this.taskCreationService,
          autoMigrationService: this.autoMigrationService,
          settings: this.settings,
        },
      });

      console.log(`[${this.name}] Dashboard mounted successfully`);
    } catch (error) {
      console.error(`[${this.name}] Dashboard mount failed:`, error);
      this.safeShowMessage("Failed to initialize task dashboard", "error");
    }
  }

  /**
   * Unmount Svelte 5 Dashboard component
   */
  private unmountDashboard(): void {
    if (this.dashboardComponent) {
      try {
        unmount(this.dashboardComponent);
        console.log(`[${this.name}] Dashboard unmounted from`, this.dockEl?.tagName || "unknown");
      } catch (error) {
        console.error(`[${this.name}] Dashboard unmount error:`, error);
      }
      this.dashboardComponent = null;
      this.dockEl = null;
    }
  }

  /**
   * Safe wrapper for showMessage (handles cases where API is unavailable)
   */
  private safeShowMessage(msg: string, type: "info" | "error" = "info"): void {
    try {
      showMessage(msg, 6000, type);
    } catch {
      console.warn(`[${this.name}] showMessage unavailable: ${msg}`);
    }
  }
}
