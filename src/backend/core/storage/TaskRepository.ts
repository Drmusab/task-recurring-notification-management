import type { Task } from "@backend/core/models/Task";
import type { ArchiveQuery } from "@backend/core/storage/ArchiveTaskStore";
import type { TaskStorage } from "@backend/core/storage/TaskStorage";

export interface TaskRepositoryProvider {
  /** Return all tasks. */
  getAllTasks(): Task[];
  /** Get a task by ID. */
  getTask(id: string): Task | undefined;
  /** Get a task by linked block ID. */
  getTaskByBlockId(blockId: string): Task | undefined;
  /** Return enabled tasks only. */
  getEnabledTasks(): Task[];
  /** Return tasks due on or before a date. */
  getTasksDueOnOrBefore(date: Date): Task[];
  /** Return tasks due today or overdue. */
  getTodayAndOverdueTasks(): Task[];
  /** Return tasks within a date range. */
  getTasksInRange(startDate: Date, endDate: Date): Task[];
  /** Persist a task. */
  saveTask(task: Task): Promise<void>;
  /** Remove a task by ID. */
  deleteTask(taskId: string): Promise<void>;
  /** Archive a task snapshot. */
  archiveTask(task: Task): Promise<void>;
  /** Load archived tasks. */
  loadArchive(filter?: ArchiveQuery): Promise<Task[]>;
  /** Flush pending writes. */
  flush(): Promise<void>;
}

export class TaskRepository implements TaskRepositoryProvider {
  constructor(private readonly storage: TaskStorage) {}

  /**
   * Return all tasks.
   */
  getAllTasks(): Task[] {
    return this.storage.getAllTasks();
  }

  /**
   * Get a task by ID.
   */
  getTask(id: string): Task | undefined {
    return this.storage.getTask(id);
  }

  /**
   * Get a task by linked block ID.
   */
  getTaskByBlockId(blockId: string): Task | undefined {
    return this.storage.getTaskByBlockId(blockId);
  }

  /**
   * Return enabled tasks only.
   */
  getEnabledTasks(): Task[] {
    return this.storage.getEnabledTasks();
  }

  /**
   * Return tasks due on or before a date.
   */
  getTasksDueOnOrBefore(date: Date): Task[] {
    return this.storage.getTasksDueOnOrBefore(date);
  }

  /**
   * Return tasks due today or overdue.
   */
  getTodayAndOverdueTasks(): Task[] {
    return this.storage.getTodayAndOverdueTasks();
  }

  /**
   * Return tasks within a date range.
   */
  getTasksInRange(startDate: Date, endDate: Date): Task[] {
    return this.storage.getTasksInRange(startDate, endDate);
  }

  /**
   * Persist a task.
   */
  async saveTask(task: Task): Promise<void> {
    await this.storage.saveTask(task);
  }

  /**
   * Remove a task by ID.
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.storage.deleteTask(taskId);
  }

  /**
   * Archive a task snapshot.
   */
  async archiveTask(task: Task): Promise<void> {
    await this.storage.archiveTask(task);
  }

  /**
   * Load archived tasks.
   */
  async loadArchive(filter?: ArchiveQuery): Promise<Task[]> {
    return this.storage.loadArchive(filter);
  }

  /**
   * Flush pending writes.
   */
  async flush(): Promise<void> {
    await this.storage.flush();
  }
}
