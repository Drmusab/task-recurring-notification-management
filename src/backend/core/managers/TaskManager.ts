import type { Plugin } from "siyuan";
import { TaskStorage } from "@backend/core/storage/TaskStorage";
import { TaskRepository, type TaskRepositoryProvider } from "@backend/core/storage/TaskRepository";
import { Scheduler } from "@backend/core/engine/Scheduler";
import { EventService } from "@backend/services/EventService";
import { SettingsService } from "@backend/core/settings/SettingsService";
import { GlobalFilter } from "@backend/core/filtering/GlobalFilter";
import { GlobalQuery } from "@backend/core/query/GlobalQuery";
import { SCHEDULER_INTERVAL_MS } from "@shared/utils/misc/constants";
import * as logger from "@shared/utils/misc/logger";
import { PatternLearner } from "@backend/core/ml/PatternLearner";
import { PatternLearnerStore } from "@backend/core/ml/PatternLearnerStore";

/**
 * TaskManager is a singleton that manages the lifecycle of all task-related services.
 * Based on patterns from siyuan-plugin-task-note-management (StatusManager, PomodoroRecordManager)
 */
export class TaskManager {
  private static instance: TaskManager | null = null;
  private plugin: Plugin;
  private isInitialized: boolean = false;
  
  // Core services
  private storage!: TaskStorage;
  private repository!: TaskRepositoryProvider;
  private scheduler!: Scheduler;
  private eventService!: EventService;
  private settingsService!: SettingsService;
  private patternLearner!: PatternLearner;

  private constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(plugin?: Plugin): TaskManager | null {
    if (!TaskManager.instance) {
      if (!plugin) {
        return null;
      }
      TaskManager.instance = new TaskManager(plugin);
    }
    return TaskManager.instance;
  }

  /**
   * Initialize all services
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("TaskManager already initialized");
      return;
    }

    logger.info("Initializing TaskManager");

    try {
      // Initialize settings service
      try {
        this.settingsService = new SettingsService(this.plugin);
        await this.settingsService.load();
        const settings = this.settingsService.get();
        GlobalFilter.getInstance().initialize(settings.globalFilter);
        GlobalQuery.getInstance().initialize(settings.globalQuery);
      } catch (err) {
        logger.error("Failed to initialize settings service", err);
        throw new Error("Settings service initialization failed: " + (err instanceof Error ? err.message : String(err)));
      }

      // Initialize storage
      try {
        this.storage = new TaskStorage(this.plugin);
        await this.storage.init();
        this.repository = new TaskRepository(this.storage);
      } catch (err) {
        logger.error("Failed to initialize storage", err);
        throw new Error("Storage initialization failed: " + (err instanceof Error ? err.message : String(err)));
      }

      // Initialize event service
      try {
        this.eventService = new EventService(this.plugin);
        await this.eventService.init();
      } catch (err) {
        logger.error("Failed to initialize event service", err);
        // Try to cleanup partial initialization
        try {
          await this.cleanup();
        } catch (cleanupErr) {
          logger.error("Failed to cleanup after event service init failure", cleanupErr);
        }
        throw new Error("Event service initialization failed: " + (err instanceof Error ? err.message : String(err)));
      }

      // Initialize scheduler
      try {
        this.scheduler = new Scheduler(this.storage, SCHEDULER_INTERVAL_MS, this.plugin);
        this.eventService.bindScheduler(this.scheduler);
      } catch (err) {
        logger.error("Failed to initialize scheduler", err);
        // Try to cleanup partial initialization
        try {
          await this.cleanup();
        } catch (cleanupErr) {
          logger.error("Failed to cleanup after scheduler init failure", cleanupErr);
        }
        throw new Error("Scheduler initialization failed: " + (err instanceof Error ? err.message : String(err)));
      }

      // Initialize smart recurrence pattern learner
      try {
        const patternStore = new PatternLearnerStore(this.plugin);
        this.patternLearner = new PatternLearner({
          store: patternStore,
          repository: this.repository,
          settingsProvider: () => this.settingsService.get().smartRecurrence,
        });
        await this.patternLearner.load();
      } catch (err) {
        logger.error("Failed to initialize pattern learner", err);
        // Non-fatal - pattern learner is optional
        // Create a no-op pattern learner to avoid null checks
      }

      this.isInitialized = true;
      logger.info("TaskManager initialized successfully");
    } catch (err) {
      // Ensure initialization flag is not set on failure
      this.isInitialized = false;
      logger.error("TaskManager initialization failed", err);
      throw err;
    }
  }

  /**
   * Start the scheduler and recovery process
   */
  public async start(
    onTaskDue?: (task: any) => void,
    onTaskMissed?: (task: any) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("TaskManager must be initialized before starting");
    }

    // Start scheduler
    if (onTaskDue) {
      this.scheduler.on("task:due", ({ task }) => onTaskDue(task));
    }
    if (onTaskMissed) {
      this.scheduler.on("task:overdue", ({ task }) => onTaskMissed(task));
    }
    this.scheduler.start();
    
    // Recover missed tasks from previous session
    await this.scheduler.recoverMissedTasks();

    logger.info("TaskManager started");
  }

  /**
   * Destroy the manager and cleanup resources
   */
  public async destroy(): Promise<void> {
    logger.info("Destroying TaskManager");
    await this.cleanup();
    this.isInitialized = false;
    TaskManager.instance = null;
    logger.info("TaskManager destroyed");
  }

  /**
   * Cleanup resources (used for both destroy and partial initialization failure)
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.scheduler) {
        this.scheduler.stop();
      }
    } catch (err) {
      logger.error("Failed to stop scheduler during cleanup", err);
    }

    try {
      if (this.eventService) {
        await this.eventService.shutdown();
      }
    } catch (err) {
      logger.error("Failed to shutdown event service during cleanup", err);
    }

    try {
      if (this.storage) {
        await this.storage.flush();
      }
    } catch (err) {
      logger.error("Failed to flush storage during cleanup", err);
    }
  }

  /**
   * Get the task storage instance
   */
  public getStorage(): TaskStorage {
    this.ensureInitialized();
    return this.storage;
  }

  /**
   * Get the task repository abstraction
   */
  public getRepository(): TaskRepositoryProvider {
    this.ensureInitialized();
    return this.repository;
  }

  /**
   * Get the scheduler instance
   */
  public getScheduler(): Scheduler {
    this.ensureInitialized();
    return this.scheduler;
  }

  /**
   * Get the event service instance
   */
  public getEventService(): EventService {
    this.ensureInitialized();
    return this.eventService;
  }

  /**
   * Get the settings service instance
   */
  public getSettingsService(): SettingsService {
    this.ensureInitialized();
    return this.settingsService;
  }

  /**
   * Get the smart recurrence pattern learner
   */
  public getPatternLearner(): PatternLearner {
    this.ensureInitialized();
    return this.patternLearner;
  }

  /**
   * Check if the manager is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Ensure the manager is initialized before accessing services
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error("TaskManager is not initialized. Call initialize() first.");
    }
  }
}
