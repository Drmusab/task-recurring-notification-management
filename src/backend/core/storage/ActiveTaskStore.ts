import type { Plugin } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import { STORAGE_ACTIVE_KEY } from "@shared/utils/misc/constants";
import * as logger from "@shared/utils/misc/logger";
import type { TaskState, TaskStateWriter } from "@backend/core/storage/TaskPersistenceController";
import path from "path";
import { type SiYuanEnvironmentAPI, reportSiYuanApiIssue } from "@backend/core/api/SiYuanApiAdapter";

const TEMP_SUFFIX = ".tmp";
type FsPromises = typeof import("fs").promises;

export class ActiveTaskStore implements TaskStateWriter {
  private plugin: Plugin;
  private apiAdapter: SiYuanEnvironmentAPI;
  private fsPromises?: FsPromises | null;

  constructor(plugin: Plugin, apiAdapter: SiYuanEnvironmentAPI) {
    this.plugin = plugin;
    this.apiAdapter = apiAdapter;
  }

  /**
   * Load active tasks from storage.
   */
  async loadActive(): Promise<Map<string, Task>> {
    try {
      const data = await this.plugin.loadData(STORAGE_ACTIVE_KEY);
      if (data && Array.isArray(data.tasks)) {
        return new Map(data.tasks.map((task: Task) => [task.id, task]));
      }
    } catch (err) {
      logger.error("Failed to load active tasks", err);
    }
    return new Map();
  }

  /**
   * Persist active tasks to storage.
   */
  async saveActive(tasks: Map<string, Task>): Promise<void> {
    await this.write({ tasks: Array.from(tasks.values()) });
  }

  /**
   * Write a full task state snapshot.
   */
  async write(state: TaskState): Promise<void> {
    try {
      await this.saveActiveAtomic(state);
      logger.info(`Saved ${state.tasks.length} active tasks`);
    } catch (err) {
      logger.error("Failed to save active tasks", err);
      throw err;
    }
  }

  private async saveActiveAtomic(state: TaskState): Promise<void> {
    const fs = await this.getFsPromises();
    if (!fs) {
      await this.plugin.saveData(STORAGE_ACTIVE_KEY, state);
      return;
    }

    const filePath = this.resolveStoragePath(STORAGE_ACTIVE_KEY);
    if (!filePath) {
      await this.plugin.saveData(STORAGE_ACTIVE_KEY, state);
      return;
    }

    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    const tempPath = `${filePath}${TEMP_SUFFIX}`;
    const data = JSON.stringify(state);
    const handle = await fs.open(tempPath, "w");
    try {
      await handle.writeFile(data, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    try {
      await fs.rename(tempPath, filePath);
    } catch (err) {
      await fs.rm(filePath, { force: true });
      await fs.rename(tempPath, filePath);
    }
  }

  private async getFsPromises(): Promise<FsPromises | null> {
    if (this.fsPromises !== undefined) {
      return this.fsPromises;
    }

    try {
      const module = await import("fs");
      this.fsPromises = module.promises;
      return this.fsPromises;
    } catch (err) {
      logger.warn("Node.js fs unavailable; falling back to plugin storage without atomic writes.", err);
      this.fsPromises = null;
      return null;
    }
  }

  private resolveStoragePath(storageKey: string): string | null {
    const dataDir = this.apiAdapter.getDataDir();
    const pluginName = this.plugin.name;

    if (!dataDir || !pluginName) {
      if (!dataDir) {
        reportSiYuanApiIssue({
          feature: "Atomic task storage",
          capability: "dataDir",
          message:
            "SiYuan dataDir unavailable; falling back to plugin storage without atomic writes.",
        });
      }
      return null;
    }

    return path.join(dataDir, "storage", `p${pluginName}`, `${storageKey}.json`);
  }
}
