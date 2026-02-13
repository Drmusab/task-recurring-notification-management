import type { Plugin } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import { STORAGE_ARCHIVE_KEY } from "@shared/constants/misc-constants";
import * as logger from "@backend/logging/logger";
import { getArchiveCompression } from "@backend/core/storage/ArchiveCompression";

export interface ArchiveQuery {
  from?: string;
  to?: string;
  taskId?: string;
  limit?: number;
  offset?: number;
}

interface ArchiveIndex {
  version: number;
  totalCount: number;
  chunks: ArchiveChunkMeta[];
}

interface ArchiveChunkMeta {
  key: string;
  year: number;
  sequence: number;
  count: number;
  start?: string;
  end?: string;
}

interface ArchiveChunkPayload {
  tasks: Task[];
}

const ARCHIVE_INDEX_VERSION = 1;
const ARCHIVE_CHUNK_MAX_ITEMS = 1000;

/**
 * ArchiveTaskStore appends completed task snapshots into year-based chunks.
 * This keeps archive writes incremental and avoids rewriting the full history.
 */
export class ArchiveTaskStore {
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Archive a single task snapshot.
   */
  async archiveTask(task: Task): Promise<void> {
    await this.archiveTasks([task]);
  }

  /**
   * Archive multiple task snapshots.
   */
  async archiveTasks(tasks: Task[]): Promise<void> {
    if (tasks.length === 0) {
      return;
    }

    const index = await this.loadIndex();
    const grouped = this.groupByYear(tasks);

    for (const [year, yearlyTasks] of grouped.entries()) {
      await this.appendTasksToYear(index, year, yearlyTasks);
    }

    await this.saveIndex(index);
  }

  /**
   * Load archived tasks with optional filtering.
   */
  async loadArchive(query?: ArchiveQuery): Promise<Task[]> {
    const index = await this.loadIndex();
    if (index.chunks.length === 0) {
      return [];
    }

    const filteredChunks = this.filterChunks(index.chunks, query);
    const results: Task[] = [];

    for (const chunk of filteredChunks) {
      const payload = await this.loadChunk(chunk.key);
      if (!payload) {
        continue;
      }

      for (const task of payload.tasks) {
        if (!this.matchesQuery(task, query)) {
          continue;
        }
        results.push(task);
      }
    }

    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  private async loadIndex(): Promise<ArchiveIndex> {
    try {
      const data = await this.plugin.loadData(STORAGE_ARCHIVE_KEY);
      if (data && typeof data === "object" && Array.isArray(data.chunks)) {
        return {
          version: data.version ?? ARCHIVE_INDEX_VERSION,
          totalCount: data.totalCount ?? 0,
          chunks: data.chunks as ArchiveChunkMeta[],
        };
      }
    } catch (err) {
      logger.error("Failed to load archive index", err);
    }

    return {
      version: ARCHIVE_INDEX_VERSION,
      totalCount: 0,
      chunks: [],
    };
  }

  private async saveIndex(index: ArchiveIndex): Promise<void> {
    try {
      await this.plugin.saveData(STORAGE_ARCHIVE_KEY, index);
    } catch (err) {
      logger.error("Failed to save archive index", err);
      throw err;
    }
  }

  private buildChunkKey(year: number, sequence: number): string {
    return `${STORAGE_ARCHIVE_KEY}-${year}-${sequence}`;
  }

  private async loadChunk(key: string): Promise<ArchiveChunkPayload | null> {
    try {
      const rawData = await this.plugin.loadData(key);
      if (!rawData) {
        return null;
      }

      // Check if data is compressed (string format)
      if (typeof rawData === 'string') {
        const compression = getArchiveCompression();
        const decompressed = await compression.decompress(rawData);
        const data = JSON.parse(decompressed);
        if (data && Array.isArray(data.tasks)) {
          return data as ArchiveChunkPayload;
        }
      }
      
      // Legacy uncompressed object format
      if (rawData && Array.isArray(rawData.tasks)) {
        return rawData as ArchiveChunkPayload;
      }
    } catch (err) {
      logger.error("Failed to load archive chunk", { key, err });
    }
    return null;
  }

  private async saveChunk(key: string, payload: ArchiveChunkPayload): Promise<void> {
    try {
      // Compress the payload before saving
      const compression = getArchiveCompression();
      const jsonData = JSON.stringify(payload);
      const compressed = await compression.compress(jsonData);
      await this.plugin.saveData(key, compressed);
    } catch (err) {
      logger.error("Failed to save archive chunk", { key, err });
      throw err;
    }
  }

  private groupByYear(tasks: Task[]): Map<number, Task[]> {
    const grouped = new Map<number, Task[]>();
    for (const task of tasks) {
      const completedAt = this.getCompletionTimestamp(task);
      const year = new Date(completedAt).getFullYear();
      const bucket = grouped.get(year);
      if (bucket) {
        bucket.push(task);
      } else {
        grouped.set(year, [task]);
      }
    }
    return grouped;
  }

  private async appendTasksToYear(index: ArchiveIndex, year: number, tasks: Task[]): Promise<void> {
    let remaining = [...tasks];
    while (remaining.length > 0) {
      const chunkMeta = this.findOrCreateChunk(index, year);
      const payload = (await this.loadChunk(chunkMeta.key)) || { tasks: [] };
      const capacity = ARCHIVE_CHUNK_MAX_ITEMS - payload.tasks.length;
      const toAppend = remaining.slice(0, capacity);

      payload.tasks.push(...toAppend);
      remaining = remaining.slice(toAppend.length);

      const updated = this.updateChunkMeta(chunkMeta, toAppend);
      chunkMeta.count = updated.count;
      chunkMeta.start = updated.start;
      chunkMeta.end = updated.end;

      await this.saveChunk(chunkMeta.key, payload);

      index.totalCount += toAppend.length;
    }
  }

  private findOrCreateChunk(index: ArchiveIndex, year: number): ArchiveChunkMeta {
    const candidates = index.chunks.filter((chunk) => chunk.year === year);
    const lastChunk = candidates.sort((a, b) => a.sequence - b.sequence).at(-1);

    if (lastChunk && lastChunk.count < ARCHIVE_CHUNK_MAX_ITEMS) {
      return lastChunk;
    }

    const nextSequence = lastChunk ? lastChunk.sequence + 1 : 1;
    const chunkMeta: ArchiveChunkMeta = {
      key: this.buildChunkKey(year, nextSequence),
      year,
      sequence: nextSequence,
      count: 0,
    };

    index.chunks.push(chunkMeta);
    return chunkMeta;
  }

  private updateChunkMeta(chunk: ArchiveChunkMeta, tasks: Task[]): ArchiveChunkMeta {
    let start = chunk.start;
    let end = chunk.end;

    for (const task of tasks) {
      const completedAt = this.getCompletionTimestamp(task);
      if (!start || completedAt < start) {
        start = completedAt;
      }
      if (!end || completedAt > end) {
        end = completedAt;
      }
    }

    return {
      ...chunk,
      count: chunk.count + tasks.length,
      start,
      end,
    };
  }

  private filterChunks(chunks: ArchiveChunkMeta[], query?: ArchiveQuery): ArchiveChunkMeta[] {
    if (!query?.from && !query?.to) {
      return chunks;
    }

    const from = query?.from ? new Date(query.from).getTime() : null;
    const to = query?.to ? new Date(query.to).getTime() : null;

    return chunks.filter((chunk) => {
      const chunkStart = chunk.start ? new Date(chunk.start).getTime() : null;
      const chunkEnd = chunk.end ? new Date(chunk.end).getTime() : null;

      if (from && chunkEnd && chunkEnd < from) {
        return false;
      }
      if (to && chunkStart && chunkStart > to) {
        return false;
      }
      return true;
    });
  }

  private matchesQuery(task: Task, query?: ArchiveQuery): boolean {
    if (!query) {
      return true;
    }

    if (query.taskId && task.id !== query.taskId) {
      return false;
    }

    const completedAt = this.getCompletionTimestamp(task);
    const completedTime = new Date(completedAt).getTime();
    if (query.from && completedTime < new Date(query.from).getTime()) {
      return false;
    }
    if (query.to && completedTime > new Date(query.to).getTime()) {
      return false;
    }

    return true;
  }

  private getCompletionTimestamp(task: Task): string {
    return task.lastCompletedAt || task.updatedAt || task.dueAt;
  }
}
