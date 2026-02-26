import type { Plugin } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import { STORAGE_ACTIVE_KEY } from "@shared/constants/misc-constants";
import * as logger from "@backend/logging/logger";
import type { TaskState, TaskStateWriter } from "@backend/core/storage/TaskStorage";
import { type SiYuanEnvironmentAPI, reportSiYuanApiIssue } from "@backend/core/api/SiYuanApiAdapter";
import { getOptimizedJSON } from "@backend/core/storage/OptimizedJSON";

const TEMP_SUFFIX = ".tmp";

/**
 * Schema version for the active task store format.
 * Increment when the stored shape changes (new fields, renamed fields, etc.)
 *
 * Version history:
 *   0 (implicit) — original format: { tasks: Task[] } with no version field
 *   1            — first versioned format: { version: 1, tasks: Task[] }
 */
const SCHEMA_VERSION = 1;

// Dynamic import types — avoid bundling Node.js modules in browser builds
type FsPromises = {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void | string>;
  open(path: string, flags: string): Promise<{
    writeFile(data: string, encoding: string): Promise<void>;
    sync(): Promise<void>;
    close(): Promise<void>;
  }>;
  rename(oldPath: string, newPath: string): Promise<void>;
  rm(path: string, options?: { force?: boolean }): Promise<void>;
};

/** Platform-safe path.join replacement (no Node.js `path` import) */
function joinPath(...segments: string[]): string {
  return segments
    .map((s, i) => (i > 0 ? s.replace(/^[/\\]+/, "") : s))
    .join("/")
    .replace(/\/+/g, "/");
}

/** Platform-safe path.dirname replacement */
function dirName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : ".";
}

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
   * @param signal - Optional AbortSignal for cancellation support
   */
  async loadActive(signal?: AbortSignal): Promise<Map<string, Task>> {
    // Check if already aborted
    if (signal?.aborted) {
      throw new DOMException('Operation aborted', 'AbortError');
    }

    try {
      const data = await this.plugin.loadData(STORAGE_ACTIVE_KEY);
      
      // Check abort after async operation
      if (signal?.aborted) {
        throw new DOMException('Operation aborted', 'AbortError');
      }
      
      if (data && Array.isArray(data.tasks)) {
        // Schema version check
        const storedVersion = typeof data.version === 'number' ? data.version : 0;
        if (storedVersion > SCHEMA_VERSION) {
          logger.warn(
            `[ActiveTaskStore] Stored schema version (${storedVersion}) is newer than ` +
            `current (${SCHEMA_VERSION}). Data will be loaded as-is but some fields may be ignored.`
          );
        }
        return new Map(data.tasks.map((task: Task) => [task.id, task]));
      }
    } catch (err) {
      // Re-throw abort errors
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw err;
      }
      logger.error("Failed to load active tasks", err);
    }
    return new Map();
  }

  /**
   * Persist active tasks to storage.
   */
  async saveActive(tasks: Map<string, Task>): Promise<void> {
    const optimizedJSON = getOptimizedJSON();
    const tasksArray = Array.from(tasks.values());
    await this.write({ tasks: tasksArray });
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
    // Include schema version in persisted data
    const versionedState = { version: SCHEMA_VERSION, tasks: state.tasks };

    const fs = await this.getFsPromises();
    if (!fs) {
      await this.plugin.saveData(STORAGE_ACTIVE_KEY, versionedState);
      return;
    }

    const filePath = this.resolveStoragePath(STORAGE_ACTIVE_KEY);
    if (!filePath) {
      await this.plugin.saveData(STORAGE_ACTIVE_KEY, versionedState);
      return;
    }

    const dir = dirName(filePath);
    await fs.mkdir(dir, { recursive: true });

    const tempPath = `${filePath}${TEMP_SUFFIX}`;
    
    // Use OptimizedJSON for serialization
    const optimizedJSON = getOptimizedJSON();
    const tasksMap = new Map(state.tasks.map(task => [task.id, task]));
    const data = optimizedJSON.serialize(tasksMap, { pretty: false, includeNulls: false });
    const wrappedData = JSON.stringify({ version: SCHEMA_VERSION, tasks: state.tasks });
    
    const handle = await fs.open(tempPath, "w");
    try {
      await handle.writeFile(wrappedData, "utf8");
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
      // Dynamic import with computed string to prevent Vite from statically analyzing this
      // SiYuan desktop runs on Electron which has Node.js; browser/mobile does not
      const fsModuleName = "f" + "s";
      const module = await Function("m", "return import(m)")(fsModuleName);
      this.fsPromises = module.promises as FsPromises;
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

    return joinPath(dataDir, "storage", `p${pluginName}`, `${storageKey}.json`);
  }
}
