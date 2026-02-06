import { Plugin, showMessage } from "siyuan";
import { mount, unmount } from "svelte";
import Dashboard from "@/components/dashboard/Dashboard.svelte";
import { TaskStorage } from "@backend/core/storage/TaskStorage";
import { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import { Scheduler } from "@backend/core/engine/Scheduler";
import { EventService } from "@backend/services/EventService";
import { PluginEventBus } from "@backend/core/events/PluginEventBus";
import { resolveDockElement, validateDockElement } from "@/core/api/DockAdapter";

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

  // UI
  private dashboardComponent: ReturnType<typeof mount> | null = null;
  /** Track the dock element for cleanup (set on init, cleared on unmount) */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private dockEl: HTMLElement | null = null;
  private topBarElement: HTMLElement | null = null;

  // State
  private initialized = false;

  /**
   * SiYuan lifecycle: Called when plugin loads
   */
  async onload(): Promise<void> {
    console.log(`[${this.name}] Loading plugin v${(this as any).version || "1.0.0"}...`);

    try {
      // 1. Initialize core services (order matters for dependency injection)
      this.pluginEventBus = new PluginEventBus();
      this.recurrenceEngine = new RecurrenceEngine();

      this.taskStorage = new TaskStorage(this as unknown as Plugin);
      await this.taskStorage.init();

      this.scheduler = new Scheduler(this.taskStorage, undefined, this as unknown as Plugin);

      this.eventService = new EventService(this as unknown as Plugin);
      await this.eventService.init();
      this.eventService.bindScheduler(this.scheduler);

      // 2. Register top bar button
      this.registerTopBarButton();

      // 3. Register dock panel
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
