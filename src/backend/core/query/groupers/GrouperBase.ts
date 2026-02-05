import type { Task } from '@backend/core/models/Task';

export abstract class Grouper {
  abstract getGroupKey(task: Task): string;

  /**
   * Default implementation of group() method
   * Subclasses can override for custom behavior
   */
  group(tasks: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();
    
    for (const task of tasks) {
      const key = this.getGroupKey(task);
      this.addToGroup(groups, key, task);
    }
    
    return groups;
  }

  /**
   * Helper method to add a task to a group
   */
  protected addToGroup(groups: Map<string, Task[]>, key: string, task: Task): void {
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(task);
  }
}
