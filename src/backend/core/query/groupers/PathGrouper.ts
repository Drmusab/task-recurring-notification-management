// @ts-nocheck
import { Grouper } from "@backend/core/query/groupers/GrouperBase";
import type { Task } from '@backend/core/models/Task';

export class PathGrouper extends Grouper {
  getGroupKey(task: Task): string {
    const path = task.path || '';
    return path || 'No path';
  }
}

export class FolderGrouper extends Grouper {
  getGroupKey(task: Task): string {
    const path = task.path || '';
    
    if (!path) {
      return 'No folder';
    }

    // Extract folder from path (everything before the last /)
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) {
      return 'Root';
    }
    
    return path.substring(0, lastSlash) || 'Root';
  }
}

export class TagGrouper extends Grouper {
  // Override group() for special tag grouping behavior
  // where tasks can appear in multiple groups
  group(tasks: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();
    
    for (const task of tasks) {
      const tags = task.tags || [];
      
      if (tags.length === 0) {
        this.addToGroup(groups, 'No tags', task);
      } else {
        // Add task to each tag group
        for (const tag of tags) {
          this.addToGroup(groups, tag, task);
        }
      }
    }
    
    return groups;
  }

  getGroupKey(task: Task): string {
    const tags = task.tags || [];
    return tags.length > 0 ? tags[0] : 'No tags';
  }
}
